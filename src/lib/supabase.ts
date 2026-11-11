import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable key only: it is meant for browsers. Never put the secret/service key here.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** null when the env is not set: staff sign-in then falls back to the clickable prototype. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
