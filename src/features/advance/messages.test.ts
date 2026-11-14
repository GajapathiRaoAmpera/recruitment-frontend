// FR-12, AC-4: every refusal of POST /rounds/{id}/advance gets a clear message.
import { expect, it } from "vitest";
import { ApiError } from "@/api/client";
import { advanceErrorMessage, formatDuration } from "./messages";

const err = (code: string, details: Record<string, unknown> = {}) => new ApiError(409, code, "raw server text", details);

it.each([
  ["ROUND_NOT_FOUND", /wasn't found/],
  ["ROUND_ALREADY_ADVANCED", /already been advanced/],
  ["ROUND_NOT_ACTIVE", /isn't active/],
  ["ROUND_HAS_NO_TEST", /has no test/],
])("%s", (code, text) => {
  expect(advanceErrorMessage(err(code))).toMatch(text);
});

it("ROUND_STILL_RUNNING says how many are still writing", () => {
  expect(advanceErrorMessage(err("ROUND_STILL_RUNNING", { counts: { still_writing: 3 } }))).toMatch(/^3 students are still writing\. .*Nothing was saved/);
  expect(advanceErrorMessage(err("ROUND_STILL_RUNNING", { counts: { still_writing: 1 } }))).toMatch(/^1 student is still writing/);
  expect(advanceErrorMessage(err("ROUND_STILL_RUNNING"))).toMatch(/^Some students are still writing/);
});

it("LOCKED_ATTEMPTS names the locked students and points to the checkbox", () => {
  const m = advanceErrorMessage(err("LOCKED_ATTEMPTS", { attempts: [{ attempt_id: "a1", name: "Asha" }, { attempt_id: "a2", student_id: "S2" }] }));
  expect(m).toMatch(/^2 attempts are locked after tab switches \(Asha, S2\)/);
  expect(m).toContain("Finish locked attempts with their current marks");
});

it("falls back to the server's message for other errors", () => {
  expect(advanceErrorMessage(new ApiError(422, "VALIDATION_ERROR", "threshold must be 0-100"))).toBe("threshold must be 0-100");
});

it("formats time taken", () => {
  expect([formatDuration(null), formatDuration(42), formatDuration(725)]).toEqual(["—", "42s", "12m 05s"]);
});
