import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable key only: it is meant for browsers. Never put the secret/service key here.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * The URL hash of an invite or password-reset link, captured before supabase-js reads and clears it.
 * Such a link signs the person in before they have a password, so only /set-password may use it.
 */
export const linkHash =
  typeof window !== "undefined" && /[#&]type=(invite|recovery)(&|$)/.test(window.location.hash) ? window.location.hash : null;

/** null when the env is not set: staff sign-in then falls back to the clickable prototype. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
