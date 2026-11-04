// Supabase Edge Function: turns a voice note into clean report bullets using OpenAI

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
(construction and similar field work).
Rules:
- Split the notes into short, clear bullet points, one fact per bullet.
- Fix obvious transcription mistakes in industry terms when the meaning is clear
  (for example "epiphany" -> "FF&E" when talking about furniture installation).
- Keep every number, name, quantity, location, and time exactly as spoken. Never invent information.
- Remove filler words, false starts, and side conversations that are not about the work.
- Use plain, professional wording.
- Output only the bullet points, one per line. No title, no extra text.
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

// Turn the raw transcript into a list of clean bullet points
async function cleanUp(raw: string): Promise<string[]> {
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
    .map((line) => line.replace(/^\s*[•\-\*]\s*/, "").trim()) // remove any bullet symbol the AI added
    .filter(Boolean);
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

    // 2. Clean up into bullets (if this fails, fall back to the plain transcript)
    let bullets: string[] = [];
    try {
      bullets = await cleanUp(text);
    } catch (err) {
      console.error("Cleanup failed:", err);
    }
    if (bullets.length === 0 && text) bullets = [text];

    return json({ text, bullets });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});