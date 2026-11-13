import { ApiError } from "@/api/client";

// Student coding calls (backend app/execution/router.py). Auth is the attempt token from /entry/start,
// never the staff Supabase session. Only sample-case results come back; hidden cases are counts only (D7).

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

async function call<T>(token: string, path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error?.code ?? `HTTP_${res.status}`, data?.error?.message ?? "Something went wrong. Try again.", data?.error?.details ?? {});
  return data as T;
}

const wire = (r: CodeRequest) => ({ question_id: r.questionId, code: r.code, language: r.language });

/** Runs the sample cases only. */
export async function runCode(token: string, req: CodeRequest): Promise<CaseResult[]> {
  const r = await call<{ results: { case: number; passed: boolean; status: CaseStatus; stdout: string; stderr: string; time: number | null }[] }>(token, "/attempt/run", wire(req));
  return r.results.map(({ time, ...x }) => ({ ...x, timeS: time }));
}

/** Samples + hidden cases; counts only. The API saves the latest submission per question. */
export const submitCode = (token: string, req: CodeRequest) => call<{ passed: number; total: number }>(token, "/attempt/submit-code", wire(req));
