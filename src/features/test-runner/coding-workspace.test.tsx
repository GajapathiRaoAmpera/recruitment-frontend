// AC-5 (FR-15/16/17) Round 2 coding workspace: API questions, draft restore + autosave, Run/Submit results, closed attempt.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AttemptState } from "@/api/attempt";
import { ApiError } from "@/api/client";

const api = vi.hoisted(() => ({ getCodeDrafts: vi.fn(), saveCodeDraft: vi.fn(), runCode: vi.fn(), submitCode: vi.fn() }));
vi.mock("@/api/attempt", async (orig) => ({ ...(await orig<typeof import("@/api/attempt")>()), ...api }));
vi.mock("./code-editor", () => ({
  CodeEditor: ({ value, onChange, label, readOnly }: { value: string; onChange: (v: string) => void; label: string; readOnly?: boolean }) => (
    <textarea aria-label={label} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { CodingWorkspace, LOCAL_SAVE_MS, SERVER_SAVE_MS } from "./coding-workspace";
import { readLocal, writeLocal } from "./drafts";

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const TOKEN = `h.${b64({ typ: "attempt", cid: "c1", aid: "A2" })}.sig`;

const attempt = (over: Partial<AttemptState> = {}): AttemptState => ({
  status: "in_progress",
  deadlineAt: "2026-01-01T11:00:00Z",
  serverNow: "2026-01-01T10:00:00Z",
  tabSwitches: 0,
  maxTabSwitches: 3,
  remainingSecOnLock: null,
  questions: [],
  savedAnswers: {},
  coding: [
    { id: "q1", title: "Sum", statement: "Add the numbers.", marks: 10, languages: [{ key: "python", name: "Python 3.8" }, { key: "cpp", name: "C++ (GCC 9)" }], samples: [{ input: "1 2", expected: "3", inputDisplay: "1 2" }, { input: "2 2", expected: "4", inputDisplay: "2 2" }], mode: "stdin", signature: null, starterCode: null },
    { id: "q2", title: "Max", statement: "Print the max.", marks: 20, languages: [{ key: "java", name: "Java 13" }], samples: [], mode: "stdin", signature: null, starterCode: null },
  ],
  savedCode: {},
  ...over,
});

const onClosed = vi.fn();
const view = (props: Partial<Parameters<typeof CodingWorkspace>[0]> = {}) =>
  render(<CodingWorkspace token={TOKEN} attempt={attempt()} live submitted={false} onClosed={onClosed} {...props} />);
const settle = () => act(async () => {});
const editor = () => screen.getByRole("textbox", { name: /^Code for/ }) as HTMLTextAreaElement;

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  onClosed.mockReset();
  api.getCodeDrafts.mockResolvedValue({});
  api.saveCodeDraft.mockResolvedValue(undefined);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2030-06-01T00:00:00Z")); // the laptop clock is wrong on purpose: only server time may matter
});
afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

it("shows the API's problems, languages and samples, never the mock store's", async () => {
  view();
  await settle();
  expect(screen.getByRole("heading", { name: "Sum" })).toBeInTheDocument();
  expect(screen.getByText("Add the numbers.")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "C++ (GCC 9)" })).toHaveValue("cpp");
  expect(screen.getByText("1 2")).toBeInTheDocument();
  expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([expect.stringContaining("P1: Sum"), expect.stringContaining("P2: Max")]);
  expect(editor().value).toContain("def solve()"); // nothing saved yet: the starter
});

it("restores the newest of browser draft, server draft and submitted code", async () => {
  // Browser draft written at server time 10:01; the server's draft is from 10:02, so the server wins for q1.
  writeLocal("A2", "q1", { language: "python", code: { python: "browser py", cpp: "browser cpp" }, savedAt: Date.parse("2026-01-01T10:01:00Z") });
  api.getCodeDrafts.mockResolvedValue({ q1: { code: "server py", language: "python", savedAt: Date.parse("2026-01-01T10:02:00Z") } });
  view({ attempt: attempt({ savedCode: { q2: { code: "class Main {}", language: "java" } } }) });
  await settle();
  expect(editor().value).toBe("server py");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "cpp" } });
  expect(editor().value).toBe("browser cpp"); // other languages from this browser are kept
  fireEvent.click(screen.getByRole("tab", { name: /Max/ }));
  expect(editor().value).toBe("class Main {}"); // no draft for q2: the last submitted code
});

it("saves to this browser 500 ms after typing (server-clock stamp) and to the server every 10 s and on problem switch", async () => {
  view();
  await settle();
  fireEvent.change(editor(), { target: { value: "print(3)" } });
  expect(readLocal("A2", "q1")).toBeNull();
  await act(async () => vi.advanceTimersByTime(LOCAL_SAVE_MS));
  const saved = readLocal("A2", "q1")!;
  expect(saved.code.python).toBe("print(3)");
  expect(Math.abs(saved.savedAt - Date.parse("2026-01-01T10:00:00Z"))).toBeLessThan(5_000); // server time, not the 2030 laptop clock
  expect(api.saveCodeDraft).not.toHaveBeenCalled();

  await act(async () => vi.advanceTimersByTime(SERVER_SAVE_MS));
  expect(api.saveCodeDraft).toHaveBeenCalledWith(TOKEN, "q1", { code: "print(3)", language: "python" });

  fireEvent.change(editor(), { target: { value: "print(4)" } });
  fireEvent.click(screen.getByRole("tab", { name: /Max/ }));
  await settle();
  expect(api.saveCodeDraft).toHaveBeenLastCalledWith(TOKEN, "q1", { code: "print(4)", language: "python" });
  expect(api.saveCodeDraft).toHaveBeenCalledTimes(2);
});

it("Run shows each sample's status, output, error and expected output", async () => {
  api.runCode.mockResolvedValue([
    { case: 1, passed: true, status: "passed", stdout: "3", stderr: "", timeS: 0.004 },
    { case: 2, passed: false, status: "runtime_error", stdout: "partial", stderr: "ZeroDivisionError: division by zero", timeS: null },
  ]);
  view();
  await settle();
  fireEvent.click(screen.getByRole("button", { name: /run samples/i }));
  await settle();
  expect(api.runCode).toHaveBeenCalledWith(TOKEN, { questionId: "q1", code: expect.stringContaining("def solve()"), language: "python" });
  expect(screen.getByText("Passed · 4 ms")).toBeInTheDocument();
  expect(screen.getByText("Runtime error — ZeroDivisionError: division by zero")).toBeInTheDocument();
  expect(screen.getByText("partial")).toBeInTheDocument();
  expect(screen.getAllByText("4").length).toBeGreaterThan(0); // expected output of sample 2
});

it("Submit shows only passed / total", async () => {
  api.submitCode.mockResolvedValue({ passed: 11, total: 18 });
  view();
  await settle();
  fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
  await settle();
  expect(screen.getByText(/\/ 18 test cases passed/)).toBeInTheDocument();
  expect(screen.getByText("11")).toBeInTheDocument();
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("11/18");
});

it.each([
  [429, "RUN_IN_PROGRESS", /previous run is still going/],
  [503, "EXECUTION_UNAVAILABLE", /runner is unavailable/],
  [504, "EXECUTION_TIMEOUT", /took too long/],
])("%i %s shows a clear message and keeps the test open", async (status, code, text) => {
  api.runCode.mockRejectedValue(new ApiError(status, code, "raw"));
  view();
  await settle();
  fireEvent.click(screen.getByRole("button", { name: /run samples/i }));
  await settle();
  expect(screen.getByRole("alert")).toHaveTextContent(text);
  expect(onClosed).not.toHaveBeenCalled();
});

it("409 ATTEMPT_LOCKED / ATTEMPT_EXPIRED from any call closes the attempt", async () => {
  api.submitCode.mockRejectedValue(new ApiError(409, "ATTEMPT_EXPIRED", "Time is up"));
  api.saveCodeDraft.mockRejectedValue(new ApiError(409, "ATTEMPT_LOCKED", "locked"));
  view();
  await settle();
  fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
  await settle();
  expect(onClosed).toHaveBeenCalledWith("expired");
  fireEvent.change(editor(), { target: { value: "x" } });
  await act(async () => vi.advanceTimersByTime(SERVER_SAVE_MS));
  expect(onClosed).toHaveBeenLastCalledWith("locked");
});

it("a closed attempt is read-only and stops autosave", async () => {
  view({ live: false });
  await settle();
  expect(editor()).toHaveAttribute("readonly");
  expect(screen.getByRole("button", { name: /run samples/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /^submit$/i })).toBeDisabled();
  await act(async () => vi.advanceTimersByTime(SERVER_SAVE_MS * 2));
  expect(api.saveCodeDraft).not.toHaveBeenCalled();
});

it("after the final submit this attempt's drafts are deleted; another attempt's are kept", async () => {
  writeLocal("A2", "q1", { language: "python", code: { python: "mine" }, savedAt: 1 });
  writeLocal("A1", "q9", { language: "python", code: { python: "round 1" }, savedAt: 1 });
  const { rerender } = view();
  await settle();
  rerender(<CodingWorkspace token={TOKEN} attempt={attempt()} live={false} submitted onClosed={onClosed} />);
  await settle();
  expect(readLocal("A2", "q1")).toBeNull();
  expect(readLocal("A1", "q9")).not.toBeNull();
});

it("no coding problems: an empty state, no editor", async () => {
  view({ attempt: attempt({ coding: [] }) });
  await settle();
  expect(screen.getByRole("heading", { name: "No problems yet" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("marks exactly the current problem tab as selected, and moves it on switch (AC-5)", async () => {
  view();
  await settle();
  const selected = () => screen.getAllByRole("tab").map((t) => t.getAttribute("aria-selected"));
  expect(selected()).toEqual(["true", "false"]);
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("P1: Sum");
  fireEvent.click(screen.getByRole("tab", { name: /Max/ }));
  expect(selected()).toEqual(["false", "true"]);
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("P2: Max");
  expect(screen.getByRole("tablist", { name: "Problems" }).querySelectorAll("[role=tab]")).toHaveLength(2);
});
