import { ApiError } from "@/api/client";

// Student entry (backend app/auth/entry.py). Students have no staff account: their 2-hour entry
// token comes from Student ID + DOB, so these calls use it directly and never touch the staff session.

/** Where the student's attempt in a round stands. `in_progress` past its deadline reads `expired` on the server. */
export type EntryAttemptStatus = "not_started" | "in_progress" | "locked" | "submitted" | "expired";

export interface EntryRound {
  roundId: string;
  type: string;
  testId: string | null;
  durationMin: number | null;
  /** Missing only in a session saved before the API sent it; treat as not started and let the server decide. */
  attemptStatus?: EntryAttemptStatus;
}

export interface StudentSession {
  entryToken: string;
  studentId: string;
  fullName: string;
  rounds: EntryRound[];
}

interface WireRound {
  round_id: string;
  type: string;
  test_id: string | null;
  duration_min: number | null;
  attempt_status: EntryAttemptStatus;
}
const toRound = (x: WireRound): EntryRound => ({ roundId: x.round_id, type: x.type, testId: x.test_id, durationMin: x.duration_min, attemptStatus: x.attempt_status });

export async function call<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, init);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? `HTTP_${res.status}`, body?.error?.message ?? "Something went wrong. Try again.");
  return body as T;
}

export const json = (body: unknown, token?: string): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

/**
 * Student ID + date of birth (yyyy-mm-dd). A wrong ID and a wrong DOB get the same 401 on purpose.
 * A student who has finished still gets 200, with `rounds: []` or only submitted/locked/expired rounds.
 */
export async function entryVerify(studentId: string, dob: string): Promise<StudentSession> {
  const r = await call<{ entry_token: string; candidate: { full_name: string }; rounds: WireRound[] }>("/entry/verify", json({ student_id: studentId.trim(), dob }));
  return { entryToken: r.entry_token, studentId: studentId.trim(), fullName: r.candidate.full_name, rounds: r.rounds.map(toRound) };
}

/** The same round list as sign-in, read fresh (e.g. after HR resumes a locked attempt). Read only. */
export const getEntryRounds = async (entryToken: string): Promise<EntryRound[]> =>
  (await call<{ rounds: WireRound[] }>("/entry/rounds", { headers: { Authorization: `Bearer ${entryToken}` } })).rounds.map(toRound);

export type EntryStep = "location" | "terms" | "fullscreen";

export const entryStep = (token: string, roundId: string, step: EntryStep, ok: boolean, meta: Record<string, unknown> = {}) =>
  call<void>("/entry/steps", json({ round_id: roundId, step, ok, meta }, token)).then(() => undefined);

/** Latest result per step for a round (location / terms / fullscreen / id_dob), so a refresh keeps progress. */
export const entrySteps = (token: string, roundId: string) =>
  call<Partial<Record<EntryStep | "id_dob", boolean>>>(`/entry/steps?round_id=${encodeURIComponent(roundId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

/** Per-round "confirm it's you": Student ID + DOB checked again and logged against this round (204). */
export const entryConfirm = (token: string, roundId: string, studentId: string, dob: string) =>
  call<void>("/entry/confirm", json({ round_id: roundId, student_id: studentId.trim(), dob }, token)).then(() => undefined);
