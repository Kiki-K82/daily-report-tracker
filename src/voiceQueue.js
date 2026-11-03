// Offline voice notes: transcribe waiting recordings once there's signal
import { db } from "./db";
import { supabase } from "./supabase";

// The report currently open in the form (its notes wait until it's saved)
let openReportId = null;
export const setOpenReport = (id) => {
  openReportId = id;
};

// Send one recording to the "transcribe" function and return the text
async function transcribeBlob(blob) {
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("audio", blob, `note.${ext}`);
  const { data, error } = await supabase.functions.invoke("transcribe", { body: form });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return (data?.text || "").trim();
}

// Add each waiting note's text to its saved report, oldest first
export async function processQueuedNotes() {
  if (!navigator.onLine) return 0;
  const notes = await db.voiceNotes.orderBy("createdAt").toArray();
  let added = 0;

  for (const note of notes) {
    if (note.reportId === openReportId) continue; // still being edited: wait until it's saved

    const report = await db.reports.get(note.reportId);
    if (!report) {
      // The report was never saved (form cancelled). Remove notes older than 7 days.
      if (Date.now() - note.createdAt > 7 * 24 * 60 * 60 * 1000) {
        await db.voiceNotes.delete(note.key);
      }
      continue;
    }

    const text = await transcribeBlob(note.blob);
    if (text) {
      const bullets = report.bullets ? `${report.bullets}\n• ${text}` : `• ${text}`;
      await db.reports.update(note.reportId, { bullets, updatedAt: Date.now(), dirty: 1 });
      added++;
    }
    await db.voiceNotes.delete(note.key);
  }
  return added;
}