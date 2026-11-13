import { afterEach, expect, it, vi } from "vitest";
import { entryStart, getAttempt, msLeft, reportViolation, saveAnswer } from "./attempt";

afterEach(() => vi.unstubAllGlobals());
const reply = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stub = (...r: Response[]) => {
  const f = vi.fn();
  r.forEach((x) => f.mockResolvedValueOnce(x));
  vi.stubGlobal("fetch", f);
  return f;
};
const auth = (f: ReturnType<typeof vi.fn>, i = 0) => new Headers(f.mock.calls[i]![1].headers).get("Authorization");

it("starts with the ENTRY token and returns the attempt token", async () => {
  const f = stub(reply({ attempt_token: "ATT", attempt_id: "a1" }));
  expect(await entryStart("ENTRY", "r1")).toBe("ATT");
  expect(auth(f)).toBe("Bearer ENTRY");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ round_id: "r1" });
});

it("reads the attempt with the ATTEMPT token and maps names; time left uses the server clock", async () => {
  const f = stub(reply({ status: "in_progress", deadline_at: "2026-01-01T10:45:00Z", server_now: "2026-01-01T10:00:00Z", tab_switches: 2, max_tab_switches: 3, questions: [], saved_answers: { q1: 1 } }));
  const a = await getAttempt("ATT");
  expect(auth(f)).toBe("Bearer ATT");
  expect(a).toMatchObject({ tabSwitches: 2, maxTabSwitches: 3, savedAnswers: { q1: 1 } });
  expect(msLeft(a)).toBe(45 * 60_000);
  expect(msLeft({ deadlineAt: "2026-01-01T10:00:00Z", serverNow: "2026-01-01T10:05:00Z" })).toBe(0); // never negative
});

it("saves an answer and reports a violation; the API's error text surfaces", async () => {
  const f = stub(reply(null, 204), reply({ tab_switches: 3, locked: true }), reply({ error: { code: "ATTEMPT_LOCKED", message: "This attempt is not open for answers", details: {} } }, 409));
  await saveAnswer("ATT", "q1", 2);
  expect(f.mock.calls[0]![0]).toBe("/api/v1/attempt/answers/q1");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ response: 2 });
  expect(await reportViolation("ATT", "tab_switch")).toEqual({ tabSwitches: 3, locked: true });
  await expect(saveAnswer("ATT", "q1", 0)).rejects.toMatchObject({ status: 409, code: "ATTEMPT_LOCKED" });
});

it("submits with the ATTEMPT token and returns the time taken, never marks", async () => {
  const { submitAttempt } = await import("./attempt");
  const f = stub(reply({ status: "submitted", time_taken_sec: 600 }));
  expect(await submitAttempt("ATT")).toEqual({ timeTakenSec: 600 });
  expect(f.mock.calls[0]![0]).toBe("/api/v1/attempt/submit");
  expect(f.mock.calls[0]![1].method).toBe("POST");
  expect(auth(f)).toBe("Bearer ATT");
});
