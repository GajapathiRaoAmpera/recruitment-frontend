// FR-13/FR-14, AC-5: coding question authoring and Round 2 test set-up calls (wire shapes).
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }), signOut: async () => ({ error: null }) } },
}));

import { createCodingQuestion, getCodingQuestion, listCodingQuestions, saveTestQuestions, saveTestSettings, titleOf, updateCodingQuestion } from "./coding-questions";

afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stub = (...replies: Response[]) => {
  const f = vi.fn();
  replies.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", f);
  return f;
};
const Q = { id: "q1", kind: "coding", body: "Sum two numbers\nRead a and b.", difficulty: "easy", tags: ["math"], marks: "10.00", approved: true, created_by: "u1", created_at: "2026-01-01T00:00:00Z" };

it("lists coding questions with the filters and parses marks", async () => {
  const f = stub(reply([Q]));
  const rows = await listCodingQuestions({ difficulty: "medium", tags: ["a", "b"], limit: 50 });
  const url = new URL(f.mock.calls[0]![0], "http://x");
  expect(url.pathname).toBe("/api/v1/questions");
  expect([url.searchParams.get("kind"), url.searchParams.get("difficulty"), url.searchParams.getAll("tags"), url.searchParams.get("limit")]).toEqual(["coding", "medium", ["a", "b"], "50"]);
  expect(rows[0]).toMatchObject({ id: "q1", marks: 10, approved: true, createdAt: "2026-01-01T00:00:00Z" });
});

it("creates a question with snake_case test cases", async () => {
  const f = stub(reply({ ...Q, test_cases: [] }, 201));
  await createCodingQuestion({ body: "Sum", difficulty: "easy", tags: ["math"], marks: 10, testCases: [{ input: "1 2", expected: "3", isSample: true }] });
  expect(f.mock.calls[0]![0]).toBe("/api/v1/questions");
  expect(f.mock.calls[0]![1].method).toBe("POST");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ kind: "coding", body: "Sum", difficulty: "easy", tags: ["math"], marks: 10, test_cases: [{ input: "1 2", expected: "3", is_sample: true }] });
});

it("reads one question with its cases in position order; patches only the sent fields", async () => {
  const f = stub(
    reply({ ...Q, test_cases: [{ id: "c2", input: "", expected: "b", is_sample: false, position: 2 }, { id: "c1", input: "x", expected: "a", is_sample: true, position: 1 }] }),
    reply({ ...Q, test_cases: [] }),
  );
  const q = await getCodingQuestion("q1");
  expect(q.testCases.map((c) => [c.id, c.isSample])).toEqual([["c1", true], ["c2", false]]);
  await updateCodingQuestion("q1", { marks: 12.5 });
  expect(f.mock.calls[1]![0]).toBe("/api/v1/questions/q1");
  expect(f.mock.calls[1]![1].method).toBe("PATCH");
  expect(JSON.parse(f.mock.calls[1]![1].body)).toEqual({ marks: 12.5 });
});

it("saves the duration and the ordered question list", async () => {
  const f = stub(
    reply({ id: "t1", round_id: "r1", difficulty: null, duration_sec: 2700, question_count: 0, settings: {}, opens_at: null, closes_at: null }),
    reply({ test_id: "t1", question_count: 2, levels: { easy: 1, medium: 1, advanced: 0 }, questions: [{ question_id: "q2", position: 1, difficulty: "medium", marks: "20.00" }] }),
  );
  expect(await saveTestSettings("r1", { durationSec: 2700 })).toMatchObject({ id: "t1", durationSec: 2700 });
  expect([f.mock.calls[0]![0], f.mock.calls[0]![1].method, JSON.parse(f.mock.calls[0]![1].body)]).toEqual(["/api/v1/rounds/r1/test", "PUT", { duration_sec: 2700 }]);
  const r = await saveTestQuestions("t1", ["q2", "q1"]);
  expect([f.mock.calls[1]![0], f.mock.calls[1]![1].method, JSON.parse(f.mock.calls[1]![1].body)]).toEqual(["/api/v1/tests/t1/questions", "PUT", { question_ids: ["q2", "q1"] }]);
  expect(r).toMatchObject({ questionCount: 2, levels: { easy: 1, medium: 1 }, questions: [{ questionId: "q2", marks: 20 }] });
});

it("titleOf is the statement's first line", () => {
  expect(titleOf("  Sum two numbers  \nRead a and b.")).toBe("Sum two numbers");
  expect(titleOf("   ")).toBe("Untitled question");
});

it("generates AI drafts with a timeout signal; empty topic is left out", async () => {
  const { generateCodingQuestions } = await import("./coding-questions");
  const draft = { ...Q, approved: false, reference_solution: "print(1)", reference_language: "python", test_cases: [] };
  const f = stub(reply({ created: [draft], failed: [{ index: 1, reason: "solution timed out" }] }, 201));
  const r = await generateCodingQuestions({ difficulty: "medium", topic: "   ", tags: ["dp"], marks: 10, count: 2 });
  expect([f.mock.calls[0]![0], f.mock.calls[0]![1].method]).toEqual(["/api/v1/questions/generate", "POST"]);
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ difficulty: "medium", tags: ["dp"], marks: 10, count: 2 });
  expect(f.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
  expect(r.created[0]).toMatchObject({ approved: false, marks: 10, referenceSolution: "print(1)", referenceLanguage: "python" });
  expect(r.failed).toEqual([{ index: 1, reason: "solution timed out" }]);
});

it("aborts generation after the client timeout", async () => {
  const { generateCodingQuestions } = await import("./coding-questions");
  vi.stubGlobal(
    "fetch",
    vi.fn((_: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))),
  );
  await expect(generateCodingQuestions({ difficulty: "easy", tags: [], marks: 10, count: 1 }, 20)).rejects.toMatchObject({ name: "TimeoutError" });
});

it("approves a draft, with any edits in the same PATCH", async () => {
  const { approveCodingQuestion } = await import("./coding-questions");
  const f = stub(reply({ ...Q, test_cases: [] }), reply({ ...Q, test_cases: [] }));
  await approveCodingQuestion("q1");
  expect([f.mock.calls[0]![0], f.mock.calls[0]![1].method, JSON.parse(f.mock.calls[0]![1].body)]).toEqual(["/api/v1/questions/q1", "PATCH", { approved: true }]);
  await approveCodingQuestion("q1", { marks: 15 });
  expect(JSON.parse(f.mock.calls[1]![1].body)).toEqual({ marks: 15, approved: true });
});
