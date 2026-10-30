// Connection to the Supabase cloud database
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase settings are missing. Check your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);