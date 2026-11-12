import { ApiError } from "@/api/client";

// Student entry (backend app/auth/entry.py). Students have no Supabase account: their 2-hour entry
// token comes from Student ID + DOB, so these calls use it directly and never touch the staff session.

export interface StudentSession {
  entryToken: string;
  studentId: string;
  fullName: string;
  rounds: { roundId: string; type: string; testId: string | null; durationMin: number | null }[];
}

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

/** Student ID + date of birth (yyyy-mm-dd). A wrong ID and a wrong DOB get the same 401 on purpose. */
export async function entryVerify(studentId: string, dob: string): Promise<StudentSession> {
  const r = await call<{ entry_token: string; candidate: { full_name: string }; rounds: { round_id: string; type: string; test_id: string | null; duration_min: number | null }[] }>(
    "/entry/verify",
    json({ student_id: studentId.trim(), dob }),
  );
  return {
    entryToken: r.entry_token,
    studentId: studentId.trim(),
    fullName: r.candidate.full_name,
    rounds: r.rounds.map((x) => ({ roundId: x.round_id, type: x.type, testId: x.test_id, durationMin: x.duration_min })),
  };
}

export type EntryStep = "location" | "terms" | "fullscreen";

export const entryStep = (token: string, roundId: string, step: EntryStep, ok: boolean, meta: Record<string, unknown> = {}) =>
  call<void>("/entry/steps", json({ round_id: roundId, step, ok, meta }, token)).then(() => undefined);
