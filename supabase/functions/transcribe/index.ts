// Supabase Edge Function: turns a voice note into clean report notes using OpenAI

// Construction terms to help the AI spell site language correctly.
// Add your own terms here anytime.
const CONSTRUCTION_TERMS =
  "Daily construction site report. Terms: FF&E, OS&E, RFI, MEP, HVAC, PTAC, " +
  "punch list, submittal, change order, GC, subcontractor, superintendent, " +
  "drywall, framing, rough-in, top-out, slab, rebar, formwork, concrete pour, " +
  "millwork, casework, sprinkler, fire alarm, low voltage, guestroom, corridor.";

// Model that tidies up the transcript (cheap and fast)
const CLEANUP_MODEL = "gpt-4o-mini";

const CLEANUP_INSTRUCTIONS = `You clean up voice-dictated notes for a daily field report
(construction, manufacturing, and similar field work).
Rules:
- Split the notes into short, clear bullet points, one fact per bullet.
- Write each bullet point on its own line starting with "- ".
- Sections: only when the speaker clearly divides the notes into sections (for example by
  saying "section", naming the sections up front, or saying "in mechanical..., in electrical..."),
  start each section with a heading line written as "## Name", followed by that section's
  bullet points. Use only the section name in the heading (no "Section 1"), and don't repeat
  it in the bullets. Leave out remarks about the report itself, like "I will have three sections".
- Mentioning a trade, area, or floor in passing is NOT a section. Never make a heading
  that would have only one bullet point under it.
- If the speaker doesn't divide the notes into sections, output only bullet points, with no headings.
- Don't add words the speaker didn't say (for example, don't add "unit" before a number).
- Write counts and quantities as digits (for example "six people" -> "6 people").
- Keep product, part, lot, unit, and model numbers exactly as spoken, including letters and dashes.
- Fix obvious transcription mistakes in industry terms when the meaning is clear
  (for example "epiphany" -> "FF&E" when talking about furniture installation).
- Keep every name, location, and time exactly as spoken. Never invent information.
- Remove filler words, false starts, and side conversations that are not about the work.
- Use plain, professional wording.
- Output only the headings and bullet points. No title, no extra text.
Known terms: ${CONSTRUCTION_TERMS}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// One line of the cleaned-up notes: either a section heading or a bullet point
type Line = { heading: boolean; text: string };

// Turn the raw transcript into headings and clean bullet points
async function cleanUp(raw: string): Promise<Line[]> {
  if (!raw.trim()) return [];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CLEANUP_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: CLEANUP_INSTRUCTIONS },
        { role: "user", content: raw },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Cleanup failed");
  const out: string = data.choices?.[0]?.message?.content || "";
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line.startsWith("#")
        ? { heading: true, text: line.replace(/^#+\s*/, "").replace(/:$/, "").trim() } // "## Mechanical"
        : { heading: false, text: line.replace(/^[•\-\*]\s*/, "").trim() } // remove the bullet symbol
    )
    .filter((line) => line.text);
}

Deno.serve(async (req) => {
  // Browsers check permission first with an "OPTIONS" request
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) return json({ error: "No audio received." }, 400);

    // 1. Speech to text
    const openaiForm = new FormData();
    openaiForm.append("file", audio, audio.name || "note.webm");
    openaiForm.append("model", "gpt-4o-mini-transcribe");
    openaiForm.append("prompt", CONSTRUCTION_TERMS);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
      body: openaiForm,
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data.error?.message || "Transcription failed." }, 502);
    const text: string = (data.text || "").trim();

    // 2. Clean up into headings and bullets (if this fails, fall back to the plain transcript)
    let lines: Line[] = [];
    try {
      lines = await cleanUp(text);
    } catch (err) {
      console.error("Cleanup failed:", err);
    }
    if (lines.length === 0 && text) lines = [{ heading: false, text }];

    // Ready-to-use notes: headings end with ":", bullets start with "• "
    const notes = lines.map((l) => (l.heading ? `${l.text}:` : `• ${l.text}`)).join("\n");
    // The current app version expects a plain list (it adds the "• " itself)
    const bullets = lines.map((l) => (l.heading ? `${l.text}:` : l.text));

    return json({ text, bullets, notes });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});