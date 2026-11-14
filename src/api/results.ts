import { api } from "@/api/client";
import { num } from "@/api/rounds";
import { fromWire } from "@/api/wire";

// HR read-only coding results (GET /tests/{id}/results, GET /tests/{id}/results/{attempt_id}). Decimals arrive as strings.

export interface ResultAnswer {
  questionId: string;
  submitted: boolean;
  language: string | null;
  passed: number | null;
  total: number | null;
  marksEarned: number | null;
}

export interface ResultQuestion {
  questionId: string;
  position: number;
  difficulty: string | null;
  marks: number | null;
}

export interface ResultCandidate {
  attemptId: string;
  candidateId: string;
  studentId: string;
  fullName: string;
  status: string; // in_progress | submitted | locked | expired
  startedAt: string | null;
  submittedAt: string | null;
  score: number | null;
  answers: ResultAnswer[];
}

export interface TestResults {
  testId: string;
  maxScore: number | null;
  questions: ResultQuestion[]; // sorted by position
  candidates: ResultCandidate[];
}

export interface Submission extends ResultAnswer {
  code: string | null; // the last SUBMITTED code (drafts are never shown)
  updatedAt: string | null;
}

export interface AttemptResult {
  attemptId: string;
  candidateId: string;
  studentId: string;
  fullName: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  submissions: Submission[];
}

const answer = <T extends ResultAnswer>(a: T): T => ({ ...a, passed: num(a.passed), total: num(a.total), marksEarned: num(a.marksEarned) });

export async function getTestResults(testId: string): Promise<TestResults> {
  const r = fromWire<TestResults>(await api<unknown>(`/tests/${testId}/results`));
  return {
    ...r,
    maxScore: num(r.maxScore),
    questions: r.questions.map((q) => ({ ...q, marks: num(q.marks) })).sort((a, b) => a.position - b.position),
    candidates: r.candidates.map((c) => ({ ...c, score: num(c.score), answers: c.answers.map(answer) })),
  };
}

export async function getAttemptResult(testId: string, attemptId: string): Promise<AttemptResult> {
  const r = fromWire<AttemptResult>(await api<unknown>(`/tests/${testId}/results/${attemptId}`));
  return { ...r, score: num(r.score), maxScore: num(r.maxScore), submissions: r.submissions.map(answer) };
}
