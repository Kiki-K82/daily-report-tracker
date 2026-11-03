// Connection to the Supabase cloud database
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase settings are missing. Check your .env.local file.");
}
// Remember if the app was opened from a password-reset link
// (checked before Supabase reads the link and removes it from the address bar)
export const openedFromResetLink =
  window.location.hash.includes("type=recovery") || // forgot-password link
  window.location.hash.includes("type=invite");     // invite link for a new tester

export const supabase = createClient(supabaseUrl, supabaseKey);