// FR-10/FR-23, AC-5: HR reads coding results (decimals arrive as strings).
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: null }));

import { getAttemptResult, getTestResults } from "./results";

afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

it("maps the results, parses decimals and sorts questions by position", async () => {
  const f = vi.fn().mockResolvedValue(
    reply({
      test_id: "t1",
      max_score: "30.00",
      questions: [
        { question_id: "q2", position: 2, difficulty: "hard", marks: "20.00" },
        { question_id: "q1", position: 1, difficulty: "easy", marks: "10.00" },
      ],
      candidates: [
        { attempt_id: "a1", candidate_id: "c1", student_id: "S1", full_name: "Asha", status: "submitted", started_at: null, submitted_at: null, score: "12.50", answers: [{ question_id: "q1", submitted: true, language: "python", passed: 15, total: 18, marks_earned: "8.33" }] },
      ],
    }),
  );
  vi.stubGlobal("fetch", f);
  const r = await getTestResults("t1");
  expect(f.mock.calls[0]![0]).toBe("/api/v1/tests/t1/results");
  expect(r.maxScore).toBe(30);
  expect(r.questions.map((q) => [q.questionId, q.marks])).toEqual([["q1", 10], ["q2", 20]]);
  expect(r.candidates[0]).toMatchObject({ attemptId: "a1", fullName: "Asha", score: 12.5, answers: [{ questionId: "q1", passed: 15, total: 18, marksEarned: 8.33 }] });
});

it("reads one attempt's submitted code", async () => {
  const f = vi.fn().mockResolvedValue(
    reply({ attempt_id: "a1", candidate_id: "c1", student_id: "S1", full_name: "Asha", status: "submitted", score: "10", max_score: "30", submissions: [{ question_id: "q1", submitted: true, language: "cpp", passed: 18, total: 18, marks_earned: "10.00", code: "int main(){}", updated_at: "2026-01-01T10:00:00Z" }] }),
  );
  vi.stubGlobal("fetch", f);
  const r = await getAttemptResult("t1", "a1");
  expect(f.mock.calls[0]![0]).toBe("/api/v1/tests/t1/results/a1");
  expect(r.submissions[0]).toMatchObject({ code: "int main(){}", language: "cpp", marksEarned: 10, updatedAt: "2026-01-01T10:00:00Z" });
  expect(r.maxScore).toBe(30);
});
