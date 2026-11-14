// FR-11/FR-12, AC-4: cut-off preview and advance calls; GET /rounds/{id}/test for the coding results.
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getToken: () => "tok" }));

import { advanceRound, getRanking, getRoundTest } from "./rounds";

afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stub = (...replies: Response[]) => {
  const f = vi.fn();
  replies.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", f);
  return f;
};

const RANKING = {
  round_id: "r1",
  round_status: "active",
  threshold: "60.00",
  counts: { pass: 1, fail: 0, absent: 0, still_writing: 2, locked: 1 },
  candidates: [{ candidate_id: "c1", student_id: "S1", name: "Asha", attempt_status: "submitted", marks: "7.50", max_marks: "10.00", percent: "75.00", rank: 1, time_taken_sec: 600, would_pass: true }],
};

it("asks for the ranking with or without a threshold and maps it", async () => {
  const f = stub(reply(RANKING), reply(RANKING));
  const r = await getRanking("r1");
  expect(f.mock.calls[0]![0]).toBe("/api/v1/rounds/r1/ranking");
  expect(new Headers(f.mock.calls[0]![1].headers).get("Authorization")).toBe("Bearer tok");
  expect(r.threshold).toBe(60);
  expect(r.counts).toEqual({ pass: 1, fail: 0, absent: 0, stillWriting: 2, locked: 1 });
  expect(r.candidates[0]).toMatchObject({ candidateId: "c1", studentId: "S1", attemptStatus: "submitted", marks: 7.5, maxMarks: 10, percent: 75, timeTakenSec: 600, wouldPass: true });
  await getRanking("r1", 45);
  expect(f.mock.calls[1]![0]).toBe("/api/v1/rounds/r1/ranking?threshold=45");
});

it("advances with the threshold and finalize_locked", async () => {
  const f = stub(reply({ round_id: "r1", threshold: 60, passed: 2, failed: 1, absent: 0, next_round_id: "r2", invited: [{ candidate_id: "c1", student_id: "S1", name: "Asha" }] }));
  const r = await advanceRound("r1", 60, true);
  expect(f.mock.calls[0]![0]).toBe("/api/v1/rounds/r1/advance");
  expect(f.mock.calls[0]![1].method).toBe("POST");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ threshold: 60, finalize_locked: true });
  expect(r).toMatchObject({ passed: 2, nextRoundId: "r2", invited: [{ candidateId: "c1", studentId: "S1", name: "Asha" }] });
});

it("keeps the API's error code and details on a refusal", async () => {
  stub(reply({ error: { code: "LOCKED_ATTEMPTS", message: "Locked", details: { attempts: [{ attempt_id: "a1", name: "Asha" }] } } }, 409));
  await expect(advanceRound("r1", 60)).rejects.toMatchObject({ status: 409, code: "LOCKED_ATTEMPTS", details: { attempts: [{ attempt_id: "a1", name: "Asha" }] } });
});

it("reads the round's test id from `id` and leaves settings untouched", async () => {
  stub(reply({ id: "t1", round_id: "r1", difficulty: null, duration_sec: 3600, question_count: 2, settings: { max_tab_switches: 3 }, opens_at: null, closes_at: null, question_ids: ["q1"], locked: true }));
  const t = await getRoundTest("r1");
  expect(t).toMatchObject({ id: "t1", roundId: "r1", durationSec: 3600, questionIds: ["q1"], settings: { max_tab_switches: 3 } });
});
