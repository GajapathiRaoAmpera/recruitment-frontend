import { ApiError } from "@/api/client";
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

// --- Coding (backend app/execution/router.py) ---------------------------------------------------
// Only sample-case results come back; hidden cases are counts only (D7).

export type CaseStatus = "passed" | "wrong_answer" | "compile_error" | "runtime_error" | "time_limit";

export interface CaseResult {
  case: number; // 1-based, in sample order
  passed: boolean;
  status: CaseStatus;
  stdout: string;
  stderr: string;
  timeS: number | null;
}

export interface CodeRequest {
  questionId: string;
  code: string;
  language: string;
}

/** True when the API says the attempt can't take more work (409 ATTEMPT_LOCKED / ATTEMPT_EXPIRED). */
export const isAttemptClosed = (e: unknown): e is ApiError => e instanceof ApiError && (e.code === "ATTEMPT_LOCKED" || e.code === "ATTEMPT_EXPIRED");

const wire = (r: CodeRequest) => ({ question_id: r.questionId, code: r.code, language: r.language });

/** Runs the sample cases only. */
export async function runCode(attemptToken: string, req: CodeRequest): Promise<CaseResult[]> {
  const r = await call<{ results: { case: number; passed: boolean; status: CaseStatus; stdout: string; stderr: string; time: number | null }[] }>(
    "/attempt/run",
    json(wire(req), attemptToken),
  );
  return r.results.map(({ time, ...x }) => ({ ...x, timeS: time }));
}

/** Samples + hidden cases; counts only. The API saves the latest submission per question. */
export const submitCode = (attemptToken: string, req: CodeRequest) => call<{ passed: number; total: number }>("/attempt/submit-code", json(wire(req), attemptToken));
