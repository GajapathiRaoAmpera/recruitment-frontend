import { afterEach, expect, it, vi } from "vitest";
import { entryStart, getAttempt, isAttemptClosed, msLeft, reportViolation, runCode, saveAnswer, submitCode } from "./attempt";

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

// --- Coding: AC-5 (FR-16), Run returns sample results only; Submit returns counts only ---------

const req = { questionId: "q-1", code: "print(1)", language: "python" };

it("runs samples with the attempt token and maps the results", async () => {
  const f = vi.fn().mockResolvedValue(reply({ results: [{ case: 1, passed: false, status: "runtime_error", stdout: "", stderr: "ZeroDivisionError", time: 0.012 }] }));
  vi.stubGlobal("fetch", f);
  const out = await runCode("AT", req);
  expect(f.mock.calls[0]![0]).toBe("/api/v1/attempt/run");
  expect(new Headers(f.mock.calls[0]![1].headers).get("Authorization")).toBe("Bearer AT");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ question_id: "q-1", code: "print(1)", language: "python" });
  expect(out).toEqual([{ case: 1, passed: false, status: "runtime_error", stdout: "", stderr: "ZeroDivisionError", timeS: 0.012 }]);
});

it("submits and returns the API's passed / total", async () => {
  const f = vi.fn().mockResolvedValue(reply({ passed: 7, total: 12 }));
  vi.stubGlobal("fetch", f);
  expect(await submitCode("AT", { ...req, language: "javascript" })).toEqual({ passed: 7, total: 12 });
  expect(f.mock.calls[0]![0]).toBe("/api/v1/attempt/submit-code");
  expect(JSON.parse(f.mock.calls[0]![1].body).language).toBe("javascript");
});

it("flags a locked or expired attempt, but not other errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "ATTEMPT_LOCKED", message: "This attempt is not open for answers", details: {} } }, 409)));
  const locked = await runCode("AT", req).catch((e: unknown) => e);
  expect(locked).toMatchObject({ status: 409, code: "ATTEMPT_LOCKED" });
  expect(isAttemptClosed(locked)).toBe(true);

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "ATTEMPT_EXPIRED", message: "Time is up for this test", details: {} } }, 409)));
  expect(isAttemptClosed(await submitCode("AT", req).catch((e: unknown) => e))).toBe(true);

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "RUN_IN_PROGRESS", message: "Wait for your current run to finish", details: {} } }, 429)));
  const busy = await runCode("AT", req).catch((e: unknown) => e);
  expect(busy).toMatchObject({ status: 429, message: "Wait for your current run to finish" });
  expect(isAttemptClosed(busy)).toBe(false);

  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  await expect(runCode("AT", req)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
});
