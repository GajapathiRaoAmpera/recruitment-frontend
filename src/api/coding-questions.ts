import { api } from "@/api/client";
import { num, type RoundTest } from "@/api/rounds";
import { fromWire, json } from "@/api/wire";

// HR authoring of Round 2 coding questions and the round's test set-up.
// Contract: ../recruitment-backend/docs/04-api-contracts.md (/questions*, PUT /rounds/{id}/test, PUT /tests/{id}/questions).
// These shapes carry the hidden test cases: HR / Super Admin only.

export type Difficulty = "easy" | "medium" | "advanced";
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "advanced"];
export const SAMPLE_CASES = 3;
export const HIDDEN_CASES = 15;

/** "stdin": a whole program (stdin/stdout). "function": students write one function; a hidden driver calls it. */
export type CodingMode = "stdin" | "function";
/** The fixed type set a function-mode signature may use (contract: Function-mode coding questions). */
export const PARAM_TYPES = ["int", "long", "double", "bool", "string", "int[]", "string[]", "int[][]"] as const;
export type ParamType = (typeof PARAM_TYPES)[number];
export const MAX_PARAMS = 6;

/** Wire: `{function_name, parameters:[{name, type}], return_type}`. */
export interface Signature {
  functionName: string;
  parameters: { name: string; type: ParamType }[];
  returnType: ParamType;
}

export interface QuestionSummary {
  id: string;
  body: string;
  difficulty: Difficulty;
  tags: string[];
  marks: number;
  approved: boolean;
  createdAt: string;
}

export interface TestCase {
  input: string;
  expected: string;
  isSample: boolean;
}

export interface CodingQuestion extends QuestionSummary {
  testCases: (TestCase & { id: string; position: number })[];
  /** AI drafts only: the program whose Judge0 output became each `expected`. Not editable. */
  referenceSolution: string | null;
  referenceLanguage: string | null;
  mode: CodingMode;
  /** Set for and only for mode "function". */
  signature: Signature | null;
}

export interface GenerateInput {
  difficulty: Difficulty;
  topic?: string;
  tags: string[];
  marks: number;
  count: number; // 1-3
}

export interface GenerateResult {
  created: CodingQuestion[];
  failed: { index: number; reason: string }[]; // index: 0-based within `count`
}

/** Above the server's 150 s budget for one generate request. */
export const GENERATE_TIMEOUT_MS = 170_000;

export interface QuestionInput {
  body: string;
  difficulty: Difficulty;
  tags: string[];
  marks: number;
  testCases: TestCase[];
  /** Omitted = "stdin" (the API default). */
  mode?: CodingMode;
  /** Required for and only for mode "function". */
  signature?: Signature;
}

export interface TestQuestions {
  testId: string;
  questionCount: number;
  levels: Partial<Record<Difficulty, number>>;
  questions: { questionId: string; position: number; difficulty: Difficulty; marks: number }[];
}

/** The first line of the statement is what students see as the title. */
export const titleOf = (body: string) => body.trim().split("\n")[0]!.trim() || "Untitled question";

const summary = <T extends QuestionSummary>(q: T): T => ({ ...q, marks: num(q.marks) ?? 0 });

/** Newest first, no test cases. `limit` 1-200. */
export async function listCodingQuestions(f: { difficulty?: Difficulty; tags?: string[]; limit?: number } = {}): Promise<QuestionSummary[]> {
  const q = new URLSearchParams({ kind: "coding", limit: String(f.limit ?? 200) });
  if (f.difficulty) q.set("difficulty", f.difficulty);
  f.tags?.forEach((t) => q.append("tags", t));
  return fromWire<QuestionSummary[]>(await api<unknown>(`/questions?${q}`)).map(summary);
}

export async function getCodingQuestion(id: string): Promise<CodingQuestion> {
  const r = summary(fromWire<CodingQuestion>(await api<unknown>(`/questions/${id}`)));
  return { ...r, mode: r.mode === "function" ? "function" : "stdin", signature: r.signature ?? null, testCases: [...r.testCases].sort((a, b) => a.position - b.position) };
}

/** Manual questions are approved at once. Needs exactly 3 sample + 15 hidden cases (else 422). */
export const createCodingQuestion = async (q: QuestionInput) =>
  summary(fromWire<CodingQuestion>(await api<unknown>("/questions", json("POST", { kind: "coding", ...q }))));

/** Only the sent fields change; `testCases` replaces the whole set (409 QUESTION_IN_USE once students answered it). */
export const updateCodingQuestion = async (id: string, patch: Partial<QuestionInput> & { approved?: boolean }) =>
  summary(fromWire<CodingQuestion>(await api<unknown>(`/questions/${id}`, json("PATCH", patch))));

/** Approves an AI draft, optionally saving edits in the same PATCH. Only approved questions can go in a round. */
export const approveCodingQuestion = (id: string, edits: Partial<QuestionInput> = {}) => updateCodingQuestion(id, { ...edits, approved: true });

/**
 * AI drafts (approved: false). Synchronous: about 11 s per question, up to 150 s; partial success is normal.
 * Aborts after `timeoutMs` with a DOMException named "TimeoutError".
 */
export async function generateCodingQuestions(input: GenerateInput, timeoutMs = GENERATE_TIMEOUT_MS): Promise<GenerateResult> {
  const body = { ...input, topic: input.topic?.trim() || undefined };
  const r = fromWire<GenerateResult>(await api<unknown>("/questions/generate", { ...json("POST", body), signal: AbortSignal.timeout(timeoutMs) }));
  return { created: r.created.map(summary), failed: r.failed };
}

/** Creates the round's test if it has none. Duration 60-36000 seconds. */
export const saveTestSettings = async (roundId: string, s: { durationSec: number }) =>
  fromWire<Omit<RoundTest, "questionIds" | "locked">>(await api<unknown>(`/rounds/${roundId}/test`, json("PUT", s)), new Set(["settings"]));

/** Replaces the test's question list; the order is the order students see. */
export async function saveTestQuestions(testId: string, questionIds: string[]): Promise<TestQuestions> {
  const r = fromWire<TestQuestions>(await api<unknown>(`/tests/${testId}/questions`, json("PUT", { questionIds })));
  return { ...r, questions: r.questions.map((q) => ({ ...q, marks: num(q.marks) ?? 0 })) };
}
