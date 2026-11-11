import { supabase } from "@/lib/supabase";

/** The API's error shape: {"error": {"code", "message", "details"}}. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Calls FastAPI through the same-origin /api/v1 rewrite, with the signed-in user's token. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`/api/v1${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);
  // Token rejected (expired, revoked): end this browser's Supabase session; the store sends the user to sign in.
  if (res.status === 401) await supabase?.auth.signOut({ scope: "local" });
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? `HTTP_${res.status}`, body?.error?.message ?? "Something went wrong. Try again.");
  }
  return body as T;
}
