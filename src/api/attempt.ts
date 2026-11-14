import { ApiError } from "@/api/client";
import type { CodingMode, Signature } from "@/api/coding-questions";
import { call, json } from "@/api/entry";
import { fromWire } from "@/api/wire";

// The running test (backend app/attempts + app/integrity). The server owns the deadline, the
// tab-switch count and the lock; this client only displays them.

export interface AttemptQuestion {
  id: string;
  body: string;
  options: string[];
  marks: number;
}

/** One table of a SQL sample's data: column names, then rows of values (numbers, strings or null). */
export interface SqlTable {
  columns: string[];
  rows: (number | string | null)[][];
}

/** A sample case. `tables` and `expectedRows` are present for mode "sql" only (stdin/function samples are unchanged). */
export interface CodingSample {
  input: string;
  expected: string;
  inputDisplay: string;
  /** SQL only: that sample's data, keyed by table name (kept as sent: names are data, not mapped). */
  tables?: Record<string, SqlTable>;
  /** SQL only: `expected` split into rows and values; NULL prints as "NULL". */
  expectedRows?: string[][];
}

/** A Round 2 question. Only sample cases are ever sent; hidden cases never reach the browser (D7). */
export interface CodingQuestion {
  id: string;
  title: string;
  statement: string;
  marks: number;
  languages: { key: string; name: string }[];
  /** At most 3. `inputDisplay` is the readable form (function mode: "nums = [1,2,3], target = 5"; stdin: same as `input`). */
  samples: CodingSample[];
  mode: CodingMode;
  /** Function mode only; null for stdin. */
  signature: Signature | null;
  /** Function mode only: the editor's initial code per language key. Null for stdin (the editor uses LANGS). */
  starterCode: Record<string, string> | null;
  /** SQL only (absent for stdin/function): the CREATE TABLE statements. */
  schema?: string | null;
  /** SQL only (absent for stdin/function): true = the row order is compared. */
  orderMatters?: boolean | null;
}

/** A coding question as GET /attempt sends it. */
interface RawCoding {
  kind: "coding";
  id: string;
  title: string;
  statement: string;
  marks: number;
  languages: { key: string; name: string }[];
  samples: { input: string; expected: string; input_display?: string | null; tables?: unknown; expected_rows?: unknown }[];
  mode?: CodingMode;
  signature?: unknown;
  starter_code?: Record<string, string> | null;
  schema?: string | null;
  order_matters?: boolean | null;
}

const isCell = (v: unknown): v is number | string | null => v === null || typeof v === "number" || typeof v === "string";
const strRows = (v: unknown): string[][] => (Array.isArray(v) ? v.filter(Array.isArray).map((r: unknown[]) => r.map((x) => (x === null ? "NULL" : String(x)))) : []);

/** SQL sample data, kept by table name (never camel-cased: names are data). A malformed table is dropped. */
function sqlTables(t: unknown): Record<string, SqlTable> {
  const out: Record<string, SqlTable> = {};
  if (!t || typeof t !== "object") return out;
  for (const [name, v] of Object.entries(t as Record<string, { columns?: unknown; rows?: unknown } | null>)) {
    if (!v || !Array.isArray(v.columns) || !Array.isArray(v.rows)) continue;
    out[name] = { columns: v.columns.map(String), rows: v.rows.filter(Array.isArray).map((r: unknown[]) => r.map((x) => (isCell(x) ? x : String(x)))) };
  }
  return out;
}

const toCoding = (q: RawCoding): CodingQuestion => {
  if (q.mode === "sql")
    return {
      id: q.id,
      title: q.title,
      statement: q.statement,
      marks: q.marks,
      languages: q.languages,
      samples: q.samples.map((c) => ({
        input: c.input,
        expected: c.expected,
        inputDisplay: c.input_display ?? c.input,
        tables: sqlTables(c.tables),
        expectedRows: strRows(c.expected_rows),
      })),
      mode: "sql",
      signature: null,
      starterCode: null,
      schema: q.schema ?? null,
      orderMatters: typeof q.order_matters === "boolean" ? q.order_matters : null,
    };
  // stdin / function: exactly as before SQL existed.
  return {
    id: q.id,
    title: q.title,
    statement: q.statement,
    marks: q.marks,
    languages: q.languages,
    samples: q.samples.map((c) => ({ input: c.input, expected: c.expected, inputDisplay: c.input_display ?? c.input })),
    mode: q.mode === "function" ? "function" : "stdin",
    signature: q.mode === "function" && q.signature ? fromWire<Signature>(q.signature) : null,
    starterCode: q.mode === "function" ? (q.starter_code ?? null) : null,
  };
};

/** The last SUBMITTED code for a coding question (drafts come from GET /attempt/code-drafts). */
export interface SavedCode {
  code: string;
  language: string | null;
}

export interface AttemptState {
  status: "in_progress" | "locked" | "submitted" | "expired" | "not_started";
  deadlineAt: string;
  serverNow: string;
  tabSwitches: number;
  maxTabSwitches: number;
  remainingSecOnLock: number | null;
  questions: AttemptQuestion[]; // multiple choice only
  savedAnswers: Record<string, number>; // multiple choice: chosen option
  coding: CodingQuestion[];
  savedCode: Record<string, SavedCode>; // coding: last submitted code
}

type RawQuestion = (AttemptQuestion & { kind?: "mcq" }) | RawCoding;

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
    remaining_sec_on_lock?: number | null;
    questions: RawQuestion[];
    saved_answers: Record<string, number | SavedCode>;
  }>("/attempt", auth(attemptToken));
  // One round is either multiple choice or coding; split by each question's `kind` so neither screen sees the other's shape.
  const questions: AttemptQuestion[] = [];
  const coding: CodingQuestion[] = [];
  for (const q of r.questions) {
    if (q.kind === "coding") coding.push(toCoding(q));
    else questions.push({ id: q.id, body: q.body, options: q.options, marks: q.marks });
  }
  const savedAnswers: Record<string, number> = {};
  const savedCode: Record<string, SavedCode> = {};
  for (const [id, v] of Object.entries(r.saved_answers)) {
    if (typeof v === "number") savedAnswers[id] = v;
    else if (v && typeof v.code === "string") savedCode[id] = { code: v.code, language: v.language ?? null };
  }
  return {
    status: r.status,
    deadlineAt: r.deadline_at,
    serverNow: r.server_now,
    tabSwitches: r.tab_switches,
    maxTabSwitches: r.max_tab_switches,
    remainingSecOnLock: r.remaining_sec_on_lock ?? null,
    questions,
    savedAnswers,
    coding,
    savedCode,
  };
}

/**
 * The attempt id from the attempt token's `aid` claim, used only to name this attempt's browser drafts
 * (`attempt:<aid>:q:<qid>`). Not verified here: the server checks the token on every call. Null if unreadable.
 */
export function attemptIdOf(attemptToken: string): string | null {
  try {
    const part = attemptToken.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const aid = (JSON.parse(atob(b64)) as { aid?: unknown }).aid;
    return typeof aid === "string" && aid ? aid : null;
  } catch {
    return null;
  }
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

/** Editor autosave on the server (204). Only the draft changes; the submitted code and its marks stay. */
export const saveCodeDraft = (attemptToken: string, questionId: string, draft: { code: string; language: string }) =>
  call<void>(`/attempt/code-drafts/${encodeURIComponent(questionId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${attemptToken}` },
    body: JSON.stringify({ code: draft.code, language: draft.language }),
  }).then(() => undefined);

export interface ServerDraft {
  code: string;
  language: string | null;
  savedAt: number; // epoch ms on the server's clock
}

/** Server drafts newer than each question's last submit; a question without one is absent. */
export async function getCodeDrafts(attemptToken: string): Promise<Record<string, ServerDraft>> {
  const r = await call<{ drafts: Record<string, { code: string; language: string | null; saved_at: string }> }>("/attempt/code-drafts", auth(attemptToken));
  const out: Record<string, ServerDraft> = {};
  for (const [id, d] of Object.entries(r.drafts ?? {})) {
    const savedAt = Date.parse(d.saved_at);
    if (typeof d.code === "string" && Number.isFinite(savedAt)) out[id] = { code: d.code, language: d.language ?? null, savedAt };
  }
  return out;
}

/** What to tell the student when Run / Submit fails (the attempt-closed codes are handled separately). */
export function codingErrorMessage(e: unknown): string {
  const code = e instanceof ApiError ? e.code : undefined;
  switch (code) {
    case "RUN_IN_PROGRESS":
      return "Your previous run is still going. Wait for it to finish, then try again.";
    case "EXECUTION_UNAVAILABLE":
      return "The code runner is unavailable right now. Your code is saved; try again in a moment.";
    case "EXECUTION_TIMEOUT":
      return "The code runner took too long to answer. Your code is saved; try again.";
    case "NO_TEST_CASES":
      return "This problem has no test cases yet. Tell the invigilator or HR.";
    case "QUESTION_NOT_FOUND":
      return "This problem is no longer part of your test. Reload the page.";
    case "VALIDATION_ERROR":
      return "The code couldn't be sent: check it isn't empty or longer than 64,000 characters.";
    case "LANGUAGE_NOT_ALLOWED":
      return "This problem can't be solved in that language. Pick another one from the list.";
    default:
      return e instanceof Error && e.message ? e.message : "Something went wrong. Try again.";
  }
}
