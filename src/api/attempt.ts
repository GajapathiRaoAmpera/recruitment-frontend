import { call, json } from "@/api/entry";

// The running test (backend app/attempts + app/integrity). The server owns the deadline, the
// tab-switch count and the lock; this client only displays them.

export interface McqQuestion {
  kind: "mcq";
  id: string;
  body: string;
  options: string[];
  marks: number;
}

/** Only sample cases reach the browser; hidden cases never do. */
export interface CodingQuestion {
  kind: "coding";
  id: string;
  title: string;
  statement: string;
  marks: number;
  languages: { key: string; name: string }[];
  samples: { input: string; expected: string }[];
}

export type AttemptQuestion = McqQuestion | CodingQuestion;
export type SavedCode = { code: string; language: string | null };

export interface AttemptState {
  status: "in_progress" | "locked" | "submitted" | "expired" | "not_started";
  deadlineAt: string;
  serverNow: string;
  tabSwitches: number;
  maxTabSwitches: number;
  questions: AttemptQuestion[];
  savedAnswers: Record<string, number | SavedCode>;
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
    questions: ({ kind?: AttemptQuestion["kind"] } & Record<string, unknown>)[];
    saved_answers: Record<string, number | SavedCode>;
  }>("/attempt", auth(attemptToken));
  // Older servers sent MCQs without `kind`.
  const questions = r.questions.map((q) => ({ ...q, kind: q.kind ?? ("options" in q ? "mcq" : "coding") }) as unknown as AttemptQuestion);
  return { status: r.status, deadlineAt: r.deadline_at, serverNow: r.server_now, tabSwitches: r.tab_switches, maxTabSwitches: r.max_tab_switches, questions, savedAnswers: r.saved_answers };
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

// Coding (backend app/execution). Only sample results and pass counts come back, never hidden cases.

export interface CaseResult {
  case: number;
  passed: boolean;
  status: "passed" | "wrong_answer" | "compile_error" | "runtime_error" | "time_limit" | string;
  stdout: string;
  stderr: string;
  time: number | null;
}

const code = (attemptToken: string, questionId: string, source: string, language: string) => json({ question_id: questionId, code: source, language }, attemptToken);

export const runCode = (attemptToken: string, questionId: string, source: string, language: string) =>
  call<{ results: CaseResult[] }>("/attempt/run", code(attemptToken, questionId, source, language)).then((r) => r.results);

export const submitCode = (attemptToken: string, questionId: string, source: string, language: string) =>
  call<{ passed: number; total: number }>("/attempt/submit-code", code(attemptToken, questionId, source, language));

/** Editor autosave for one question (may be empty). */
export const saveCodeDraft = (attemptToken: string, questionId: string, source: string, language: string) =>
  call<void>(`/attempt/code-drafts/${questionId}`, { ...json({ code: source, language }, attemptToken), method: "PUT" }).then(() => undefined);

/** Drafts newer than each question's last submission; a question without one falls back to saved_answers. */
export const getCodeDrafts = (attemptToken: string) =>
  call<{ drafts: Record<string, { code: string; language: string | null; saved_at: string }> }>("/attempt/code-drafts", auth(attemptToken)).then((r) => r.drafts);
