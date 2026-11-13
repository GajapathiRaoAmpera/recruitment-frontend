// The student's attempt token (from POST /entry/start), kept per round in sessionStorage so it dies with the tab.
// Every read and write is guarded: private mode, blocked storage or SSR just mean "no token".

const key = (roundId: string) => `attempt-token:${roundId}`;

export function saveAttemptToken(roundId: string, token: string) {
  try {
    window.sessionStorage.setItem(key(roundId), token);
  } catch {
    /* storage blocked: the coding page falls back to "no token" */
  }
}

export function attemptToken(roundId: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(key(roundId));
  } catch {
    return null;
  }
}

export function clearAttemptToken(roundId: string) {
  try {
    window.sessionStorage.removeItem(key(roundId));
  } catch {
    /* nothing to clear */
  }
}
