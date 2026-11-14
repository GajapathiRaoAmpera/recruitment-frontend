import { api, apiBlob } from "@/api/client";
import { call, json } from "@/api/entry";
import { fromWire } from "@/api/wire";

// Round 3 AI interview (backend app/interviews). Standalone for now: the student signs in with Student ID +
// DOB on /interview and gets a token for that one interview. The Gemini key and both prompts stay on the server;
// the browser only ever holds a one-use ephemeral token.

// ------------------------------------------------------------------------------------------------ student

export interface InterviewStart {
  interviewToken: string;
  interviewId: string;
  status: "scheduled" | "live" | "completed" | "failed";
  candidateName: string;
  roleTitle: string;
  company: string;
  durationMin: number;
  secondsLeft: number | null; // null until the interview has started
}

export interface InterviewSession {
  ephemeralToken: string;
  model: string;
  expiresAt: string;
  deadlineAt: string;
  serverNow: string;
  secondsLeft: number;
  resumed: boolean;
  roleTitle: string;
  candidateName: string;
  clientConfig: Record<string, unknown>; // sent as-is to live.connect (never contains the prompt)
  protocol: { systemTag: string; typedPrefix: string; closingPhrase: string };
}

export type TurnKind = "spoken" | "typed" | "question";
export interface Turn {
  role: "ai" | "candidate";
  kind?: TurnKind;
  text: string;
  language?: string | null;
  ts: string; // ISO time the turn started
}

const bearer = (token: string): RequestInit => ({ headers: { Authorization: `Bearer ${token}` } });

export const interviewStart = (studentId: string, dob: string, roundId?: string) =>
  call<unknown>("/interview/start", json({ student_id: studentId.trim(), dob, round_id: roundId ?? null })).then((r) => fromWire<InterviewStart>(r));

/** Starts the clock (first call only) and mints a Gemini token. Raw keys of client_config are kept for the SDK. */
export const interviewSession = (token: string) =>
  call<unknown>("/interview/session", { method: "POST", ...bearer(token) }).then((r) => fromWire<InterviewSession>(r, new Set(["client_config"])));

export const postTranscript = (token: string, turns: Turn[], ended = false) =>
  call<{ saved: number; status: string }>("/interview/transcript", json({ turns, ended }, token));

export async function postFrame(token: string, jpeg: Blob): Promise<void> {
  await call<null>("/interview/frame", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, body: jpeg });
}

/** One timed request for the network check (204, no DB). Throws on failure or after `timeoutMs`. */
export async function ping(timeoutMs = 5000): Promise<number> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(`/api/v1/interview/ping?t=${Date.now()}`, { cache: "no-store", signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return performance.now() - t0;
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------------------------------------------------------------- HR

export type ScoringState = "pending" | "done" | "error" | null;

export interface InterviewRow {
  id: string;
  roundId: string;
  driveId: string;
  company: string;
  roleTitle: string;
  candidateId: string;
  studentId: string;
  fullName: string;
  status: "scheduled" | "live" | "completed" | "failed";
  startedAt: string | null;
  endedAt: string | null;
  turns: number;
  scoring: ScoringState;
  average: number | null;
  hasNotes: boolean;
}

export interface AiScores {
  communication: number;
  technicalDepth: number;
  problemSolving: number;
  culture: number;
  sentiment: { overall: "positive" | "neutral" | "negative"; confidence: "low" | "medium" | "high"; note: string };
  summary: string;
  model: string;
  evaluatedAt: string;
}

export interface InterviewDetail extends InterviewRow {
  transcript: Turn[];
  aiScores: AiScores | { pending: true } | { error: string } | null;
  hrNotes: string | null;
  skills: string[];
  deadlineAt: string | null;
}

export const isScored = (s: InterviewDetail["aiScores"]): s is AiScores => Boolean(s && "summary" in s);

export function listInterviews(filter: { roundId?: string; driveId?: string } = {}): Promise<InterviewRow[]> {
  const q = new URLSearchParams();
  if (filter.roundId) q.set("round_id", filter.roundId);
  if (filter.driveId) q.set("drive_id", filter.driveId);
  const qs = q.toString();
  return api<unknown>(`/interviews${qs ? `?${qs}` : ""}`).then((r) => fromWire<InterviewRow[]>(r));
}

export const getInterview = (id: string) => api<unknown>(`/interviews/${id}`).then((r) => fromWire<InterviewDetail>(r));

/** Latest camera still (under 10 s old). Throws ApiError 404 NO_FRAME when there is none. */
export const interviewFrame = (id: string) => apiBlob(`/interviews/${id}/frame`);

export const evaluateInterview = (id: string) => api<{ scoring: ScoringState }>(`/interviews/${id}/evaluate`, { method: "POST" });

export const saveInterviewNotes = (id: string, hrNotes: string) =>
  api<unknown>(`/interviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hr_notes: hrNotes }) }).then((r) =>
    fromWire<InterviewDetail>(r),
  );
