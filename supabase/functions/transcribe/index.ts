// Supabase Edge Function: turns a voice note into text using OpenAI

// Construction terms to help the AI spell site language correctly.
// Add your own terms here anytime.
const CONSTRUCTION_TERMS =
  "Daily construction site report. Terms: FF&E, OS&E, RFI, MEP, HVAC, PTAC, " +
  "punch list, submittal, change order, GC, subcontractor, superintendent, " +
  "drywall, framing, rough-in, top-out, slab, rebar, formwork, concrete pour, " +
  "millwork, casework, sprinkler, fire alarm, low voltage, guestroom, corridor.";

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

Deno.serve(async (req) => {
  // Browsers check permission first with an "OPTIONS" request
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) return json({ error: "No audio received." }, 400);

    // Send the recording to OpenAI
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

    return json({ text: data.text });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});