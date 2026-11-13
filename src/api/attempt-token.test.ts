import { afterEach, expect, it, vi } from "vitest";
import { attemptToken, clearAttemptToken, saveAttemptToken } from "./attempt-token";

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

it("keeps one token per round", () => {
  saveAttemptToken("r1", "A");
  saveAttemptToken("r2", "B");
  expect(attemptToken("r1")).toBe("A");
  expect(attemptToken("r2")).toBe("B");
  clearAttemptToken("r1");
  expect(attemptToken("r1")).toBeNull();
  expect(attemptToken("r2")).toBe("B");
});

it("never throws when storage is blocked", () => {
  const boom = () => {
    throw new DOMException("blocked", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
  expect(() => saveAttemptToken("r1", "A")).not.toThrow();
  expect(attemptToken("r1")).toBeNull();
  expect(() => clearAttemptToken("r1")).not.toThrow();
});
