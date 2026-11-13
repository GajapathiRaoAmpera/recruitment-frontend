// AC-5 (FR-16): Run returns sample results only; Submit returns counts only.
import { afterEach, expect, it, vi } from "vitest";
import { isAttemptClosed, runCode, submitCode } from "./attempt";

afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
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
