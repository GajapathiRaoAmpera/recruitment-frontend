import { call, json } from "@/api/entry";

// The running test (backend app/attempts + app/integrity). The server owns the deadline, the
// tab-switch count and the lock; this client only displays them.

export interface AttemptQuestion {
  id: string;
  body: string;
  options: string[];
  marks: number;
}

export interface AttemptState {
  status: "in_progress" | "locked" | "submitted" | "expired" | "not_started";
  deadlineAt: string;
  serverNow: string;
  tabSwitches: number;
  maxTabSwitches: number;
  questions: AttemptQuestion[];
  savedAnswers: Record<string, number>;
}

const auth = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` } });

/** Needs the entry token. Safe to repeat: the same attempt (and deadline) comes back. 409 STEPS_MISSING if the system check isn't done. */
export const entryStart = (entryToken: string, roundId: string) =>
  call<{ attempt_token: string; attempt_id: string }>("/entry/start", json({ round_id: roundId }, entryToken)).then((r) => r.attempt_token);

export async function getAttempt(attemptToken: string): Promise<AttemptState> {
  const r = await call<{
    status: AttemptState["status"];
    deadline_at: string;
    server_now: string;
    tab_switches: number;
    max_tab_switches: number;
    questions: AttemptQuestion[];
    saved_answers: Record<string, number>;
  }>("/attempt", auth(attemptToken));
  return { status: r.status, deadlineAt: r.deadline_at, serverNow: r.server_now, tabSwitches: r.tab_switches, maxTabSwitches: r.max_tab_switches, questions: r.questions, savedAnswers: r.saved_answers };
}

/** Milliseconds left by the SERVER's clock, so a wrong laptop clock changes nothing. */
export const msLeft = (s: Pick<AttemptState, "deadlineAt" | "serverNow">) => Math.max(0, new Date(s.deadlineAt).getTime() - new Date(s.serverNow).getTime());

export const saveAnswer = (attemptToken: string, questionId: string, response: number) =>
  call<void>(`/attempt/answers/${questionId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${attemptToken}` }, body: JSON.stringify({ response }) }).then(() => undefined);

export const reportViolation = (attemptToken: string, kind: "tab_switch" | "fullscreen_exit") =>
  call<{ tab_switches: number; locked: boolean }>("/attempt/violations", json({ kind }, attemptToken)).then((r) => ({ tabSwitches: r.tab_switches, locked: r.locked }));

/** Finalizes the answers and records the time taken. Repeating it is harmless. Marks are never returned. */
export const submitAttempt = (attemptToken: string) =>
  call<{ status: "submitted"; time_taken_sec: number | null }>("/attempt/submit", { method: "POST", ...auth(attemptToken) }).then((r) => ({ timeTakenSec: r.time_taken_sec }));
