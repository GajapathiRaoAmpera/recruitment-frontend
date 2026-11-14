/**
 * Staff sign-in token from POST /api/v1/auth/login (our own API; no third-party auth).
 * Kept in localStorage so a new tab stays signed in. It is only a bearer token: the role
 * always comes from the API, never from here.
 */

/** true: screens use the real API. false (env unset): the clickable prototype with mock data. */
export const liveApi = process.env.NEXT_PUBLIC_LIVE_API === "true";

const KEY = "campushire.staffToken";
const SIGNED_OUT = "campushire:signedout";

type Saved = { token: string; exp: number }; // exp: ms since epoch

export function getToken(): string | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Saved;
    if (saved.exp > Date.now()) return saved.token;
    window.localStorage.removeItem(KEY); // expired: sign in again
  } catch {
    /* no storage or bad value: treated as signed out */
  }
  return null;
}

export function setToken(token: string, expiresInSec: number): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ token, exp: Date.now() + expiresInSec * 1000 } satisfies Saved));
  } catch {
    /* storage blocked: this tab works until reload */
  }
}

/** Sign this browser out and tell every listener (this tab now, other tabs via `storage`). */
export function clearToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SIGNED_OUT));
}

/** Runs `cb` when the staff token is removed here or in another tab. Returns the unsubscribe. */
export function onSignedOut(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && e.newValue === null) cb();
  };
  window.addEventListener(SIGNED_OUT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SIGNED_OUT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
