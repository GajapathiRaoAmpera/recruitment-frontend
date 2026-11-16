import { clearToken, getToken } from "@/lib/auth";

/** The API's error shape: {"error": {"code", "message", "details"}}. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** fetch to the same-origin /api/v1 rewrite with the signed-in user's token; non-2xx → ApiError. */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers); // FormData bodies: no Content-Type, the browser adds the boundary
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`/api/v1${path}`, { ...init, headers });
  // A sent token was rejected (expired, revoked): sign this browser out; the store sends the user to sign in.
  if (res.status === 401 && token) clearToken();
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body?.error?.code ?? `HTTP_${res.status}`,
      body?.error?.message ?? "Something went wrong. Try again.",
      body?.error?.details ?? {},
    );
  }
  return res;
}

/** JSON call; a body-less response (204) gives null. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init);
  return (await res.json().catch(() => null)) as T;
}

/** A file behind the login (e.g. a PDF download). */
export async function apiBlob(path: string): Promise<Blob> {
  return (await request(path)).blob();
}
