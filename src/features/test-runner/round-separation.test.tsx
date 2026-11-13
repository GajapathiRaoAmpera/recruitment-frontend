// AC-6 round separation: Round 1 (multiple choice) finished, then Round 2 (coding) on the same login starts clean —
// its own /entry/start, its own attempt and deadline, the server's tab-switch count, the coding screen, no Round 1 state.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AttemptState } from "@/api/attempt";
import type { StudentSession } from "@/api/entry";

const params = vi.hoisted(() => ({ roundId: "r1" }));
vi.mock("next/navigation", () => ({ useParams: () => params, useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
const student: StudentSession = {
  entryToken: "ENTRY",
  studentId: "S1",
  fullName: "Asha Rao",
  rounds: [
    { roundId: "r1", type: "aptitude", testId: "t1", durationMin: 30 },
    { roundId: "r2", type: "coding", testId: "t2", durationMin: 60 },
  ],
};
vi.mock("@/components/student/hooks", async (orig) => ({ ...(await orig<typeof import("@/components/student/hooks")>()), useStudent: () => ({ real: student }) }));
const api = vi.hoisted(() => ({ entryStart: vi.fn(), getAttempt: vi.fn(), reportViolation: vi.fn(), saveAnswer: vi.fn(), submitAttempt: vi.fn(), getCodeDrafts: vi.fn(), saveCodeDraft: vi.fn(), entryStep: vi.fn() }));
vi.mock("@/api/attempt", async (orig) => ({ ...(await orig<typeof import("@/api/attempt")>()), ...api }));
vi.mock("@/api/entry", async (orig) => ({ ...(await orig<typeof import("@/api/entry")>()), entryStep: api.entryStep }));
vi.mock("./code-editor", () => ({
  CodeEditor: ({ value, label }: { value: string; label: string }) => <textarea aria-label={label} value={value} readOnly />,
}));

import AptitudeTestPage from "@/app/exam/[roundId]/test/page";
import { readLocal, writeLocal } from "./drafts";

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const T1 = `h.${b64({ typ: "attempt", aid: "A1" })}.s`;
const T2 = `h.${b64({ typ: "attempt", aid: "A2" })}.s`;
const base = { deadlineAt: "2026-01-01T10:45:00Z", serverNow: "2026-01-01T10:00:00Z", maxTabSwitches: 3, remainingSecOnLock: null, savedAnswers: {}, savedCode: {} };
const round1: AttemptState = { ...base, status: "submitted", tabSwitches: 2, questions: [{ id: "m1", body: "What is 2+2?", options: ["3", "4"], marks: 1 }], coding: [] };
const round2: AttemptState = {
  ...base,
  deadlineAt: "2026-01-02T11:00:00Z",
  serverNow: "2026-01-02T10:00:00Z", // a different day, a fresh 60-minute deadline
  status: "in_progress",
  tabSwitches: 0,
  questions: [],
  coding: [{ id: "c1", title: "Sum", statement: "Add the numbers.", marks: 10, languages: [{ key: "python", name: "Python 3.8" }], samples: [] }],
};

beforeEach(() => {
  params.roundId = "r1";
  Object.values(api).forEach((f) => f.mockReset());
  api.entryStart.mockImplementation(async (_entry: string, roundId: string) => (roundId === "r1" ? T1 : T2));
  api.getAttempt.mockImplementation(async (token: string) => (token === T1 ? round1 : round2));
  api.getCodeDrafts.mockResolvedValue({});
  api.saveCodeDraft.mockResolvedValue(undefined);
  api.entryStep.mockResolvedValue(undefined);
  api.reportViolation.mockResolvedValue({ tabSwitches: 0, locked: false });
  Object.defineProperty(document, "fullscreenElement", { value: document.documentElement, configurable: true });
  const pos = { coords: { latitude: 1, longitude: 2, accuracy: 3 } };
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (ok: (p: unknown) => void) => ok(pos), watchPosition: (ok: (p: unknown) => void) => (ok(pos), 1), clearWatch: () => {} },
  });
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

it("Round 1 submitted → Round 2 starts clean", async () => {
  // Leftovers in this browser from Round 1's attempt, under the SAME question id the coding round uses.
  writeLocal("A1", "c1", { language: "python", code: { python: "round one code" }, savedAt: Date.parse("2026-01-02T10:30:00Z") });

  const { rerender } = render(<AptitudeTestPage />);
  expect(await screen.findByRole("heading", { name: "Test submitted" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Tab switches 2 / 3");

  // The student opens Round 2 with the same login.
  params.roundId = "r2";
  rerender(<AptitudeTestPage />);

  expect(await screen.findByRole("heading", { name: "Sum" })).toBeInTheDocument(); // coding screen, chosen by the round type
  expect(api.entryStart).toHaveBeenLastCalledWith("ENTRY", "r2");
  expect(api.getAttempt).toHaveBeenLastCalledWith(T2);
  expect(screen.queryByRole("heading", { name: "Test submitted" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /paused|time is up/i })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Tab switches 0 / 3"); // the server's count, not Round 1's 2
  expect(screen.getByRole("timer")).toHaveTextContent(/^\s*(60:00|59:5\d)/); // Round 2's own deadline from server time
  expect(screen.queryByRole("radio")).not.toBeInTheDocument(); // no multiple-choice UI
  const editor = screen.getByRole("textbox", { name: "Code for Sum" }) as HTMLTextAreaElement;
  expect(editor.value).not.toContain("round one code"); // Round 1's attempt key is never read
  expect(editor.value).toContain("def solve()");
  expect(screen.getByRole("button", { name: /run samples/i })).toBeEnabled();

  await act(async () => {});
  expect(readLocal("A1", "c1")).not.toBeNull(); // and never touched
});
