import { api } from "@/api/client";
import { fromWire, json } from "@/api/wire";

// HR round actions on test rounds (aptitude / coding / technical): the cut-off preview, advancing, and the round's test.
// Contract: ../recruitment-backend/docs/04-api-contracts.md (GET /rounds/{id}/ranking, POST /rounds/{id}/advance, GET /rounds/{id}/test).

export type RoundStatus = "pending" | "active" | "completed" | "skipped";
export type AttemptStatus = "not_started" | "in_progress" | "locked" | "submitted" | "expired";

export interface RankingRow {
  candidateId: string;
  studentId: string;
  name: string;
  attemptStatus: AttemptStatus | null; // null = never opened the test
  marks: number | null;
  maxMarks: number | null;
  percent: number | null;
  rank: number | null; // finished attempts only
  timeTakenSec: number | null;
  wouldPass: boolean | null; // null while still writing / locked, or with no threshold
}

export interface RankingCounts {
  pass: number | null; // null with no threshold
  fail: number | null;
  absent: number;
  stillWriting: number;
  locked: number;
}

export interface Ranking {
  roundId: string;
  roundStatus: RoundStatus;
  threshold: number | null;
  counts: RankingCounts;
  candidates: RankingRow[];
}

export interface AdvanceResult {
  roundId: string;
  threshold: number;
  passed: number;
  failed: number;
  absent: number;
  nextRoundId: string | null;
  invited: { candidateId: string; studentId: string; name: string }[];
}

export interface RoundTest {
  id: string; // the test id for /tests/{id}/results
  roundId: string;
  difficulty: string | null;
  durationSec: number;
  questionCount: number;
  settings: Record<string, unknown>;
  opensAt: string | null;
  closesAt: string | null;
  questionIds: string[];
  locked: boolean;
}

/** The API sends some decimals as strings ("62.50"); null stays null. */
export const num = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

/** Cut-off preview. `threshold` is a percent 0-100; omitted → the round's saved threshold (or none). */
export async function getRanking(roundId: string, threshold?: number): Promise<Ranking> {
  const q = threshold === undefined ? "" : `?threshold=${threshold}`;
  const r = fromWire<Ranking>(await api<unknown>(`/rounds/${roundId}/ranking${q}`));
  return {
    ...r,
    threshold: num(r.threshold),
    candidates: r.candidates.map((c) => ({ ...c, marks: num(c.marks), maxMarks: num(c.maxMarks), percent: num(c.percent), timeTakenSec: num(c.timeTakenSec) })),
  };
}

/** Closes the round at `threshold` percent and invites those who passed to the next round. Can't be undone. */
export async function advanceRound(roundId: string, threshold: number, finalizeLocked = false): Promise<AdvanceResult> {
  const r = fromWire<AdvanceResult>(await api<unknown>(`/rounds/${roundId}/advance`, json("POST", { threshold, finalizeLocked })));
  return { ...r, threshold: num(r.threshold) ?? threshold };
}

/** The round's test (404 TEST_NOT_FOUND when none is set up yet). `settings` is passed through untouched. */
export const getRoundTest = async (roundId: string) => fromWire<RoundTest>(await api<unknown>(`/rounds/${roundId}/test`), new Set(["settings"]));

// HR-decided rounds (ai_interview / final): the AI interview score is advice, HR passes or fails each student.
// Contract: GET /rounds/{id}/decisions, POST /rounds/{id}/decide.

export type Decision = "pass" | "fail";

export interface DecisionRow {
  candidateId: string;
  studentId: string;
  name: string;
  status: string; // round_candidates.status
  interviewId: string | null;
  interviewStatus: "scheduled" | "live" | "completed" | "failed" | null; // null = never signed in
  scoring: "pending" | "done" | "error" | null;
  aiAverage: number | null; // 1-5, a recommendation only
}

export interface Decisions {
  roundId: string;
  roundType: string;
  roundStatus: RoundStatus;
  candidates: DecisionRow[];
}

export interface DecideResult {
  roundId: string;
  passed: number;
  failed: number;
  nextRoundId: string | null;
  invited: { candidateId: string; studentId: string; name: string }[];
  driveClosed: boolean;
}

export async function getDecisions(roundId: string): Promise<Decisions> {
  const r = fromWire<Decisions>(await api<unknown>(`/rounds/${roundId}/decisions`));
  return { ...r, candidates: r.candidates.map((c) => ({ ...c, aiAverage: num(c.aiAverage) })) };
}

/** HR's final pass/fail for every student. Closes the round; the last round closes the drive. Can't be undone. */
export const decideRound = async (roundId: string, decisions: Record<string, Decision>) =>
  fromWire<DecideResult>(
    await api<unknown>(`/rounds/${roundId}/decide`, json("POST", { decisions: Object.entries(decisions).map(([candidateId, decision]) => ({ candidateId, decision })) })),
  );
