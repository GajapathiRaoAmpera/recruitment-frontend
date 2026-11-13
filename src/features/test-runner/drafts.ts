import type { SavedCode, ServerDraft } from "@/api/attempt";

// Coding drafts in the browser: one localStorage key per question of ONE attempt, `attempt:<attempt_id>:q:<question_id>`,
// so nothing from another round (another attempt) can ever be read back. Times are on the SERVER's clock
// (browser time + the offset worked out from GET /attempt's server_now) so they compare with server drafts.

export interface LocalDraft {
  language: string;
  code: Record<string, string>; // per language, so switching language never loses work
  savedAt: number; // epoch ms, server clock
}

/** What the editor opens with for one question. `code` holds every language the student has typed in. */
export interface Restored {
  language: string;
  code: Record<string, string>;
  source: "local" | "server" | "submitted" | "new";
}

const PREFIX = "attempt:";
export const draftKey = (attemptId: string, questionId: string) => `${PREFIX}${attemptId}:q:${questionId}`;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readLocal(attemptId: string, questionId: string): LocalDraft | null {
  try {
    const raw = storage()?.getItem(draftKey(attemptId, questionId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<LocalDraft>;
    if (typeof d.language !== "string" || !d.code || typeof d.code !== "object" || typeof d.savedAt !== "number") return null;
    const code: Record<string, string> = {};
    for (const [k, v] of Object.entries(d.code)) if (typeof v === "string") code[k] = v;
    return { language: d.language, code, savedAt: d.savedAt };
  } catch {
    return null; // corrupt or blocked: fall back to the server
  }
}

export function writeLocal(attemptId: string, questionId: string, draft: LocalDraft) {
  try {
    storage()?.setItem(draftKey(attemptId, questionId), JSON.stringify(draft));
  } catch {
    /* storage full or blocked: the server draft (every 10 s) still covers it */
  }
}

/** Removes every draft of this attempt (all questions), e.g. after the final submit. Other attempts are untouched. */
export function clearAttemptDrafts(attemptId: string) {
  const s = storage();
  if (!s) return;
  try {
    const mine = `${PREFIX}${attemptId}:q:`;
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(mine)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    /* nothing to clear */
  }
}

/**
 * Picks what the editor restores for one question:
 *  1. the newer of the local draft and the server draft (both on the server's clock);
 *  2. otherwise whichever of the two exists;
 *  3. otherwise the last submitted code (saved_answers);
 *  4. otherwise nothing (the editor shows the language's starter).
 * The server only returns a draft when it is newer than the last submit, so a server draft always beats saved_answers.
 * saved_answers has no timestamp: a local draft is preferred over it (typing on this device after the submit is
 * the usual case). Languages the question doesn't allow are dropped.
 */
export function pickRestore(
  allowed: string[],
  local: LocalDraft | null,
  server: ServerDraft | undefined,
  submitted: SavedCode | undefined,
): Restored {
  const ok = (l: string | null | undefined): l is string => !!l && allowed.includes(l);
  const keep = (code: Record<string, string>) => Object.fromEntries(Object.entries(code).filter(([l]) => ok(l)));
  const fallback = allowed[0] ?? "python";

  const serverOk = server && ok(server.language) ? server : undefined;
  const localOk = local && ok(local.language) ? local : null;

  if (localOk && (!serverOk || localOk.savedAt >= serverOk.savedAt)) return { language: localOk.language, code: keep(localOk.code), source: "local" };
  if (serverOk) return { language: serverOk.language!, code: { ...keep(local?.code ?? {}), [serverOk.language!]: serverOk.code }, source: "server" };
  if (submitted && ok(submitted.language)) return { language: submitted.language, code: { ...keep(local?.code ?? {}), [submitted.language]: submitted.code }, source: "submitted" };
  return { language: fallback, code: keep(local?.code ?? {}), source: "new" };
}
