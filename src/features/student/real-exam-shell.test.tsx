import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const api = vi.hoisted(() => ({ entryStart: vi.fn(), getAttempt: vi.fn(), reportViolation: vi.fn(), saveAnswer: vi.fn(), submitAttempt: vi.fn(), entryStep: vi.fn(), getCodeDrafts: vi.fn(), runCode: vi.fn(), submitCode: vi.fn(), saveCodeDraft: vi.fn() }));
vi.mock("@/api/attempt", async (orig) => ({ ...(await orig<typeof import("@/api/attempt")>()), ...api }));
vi.mock("@/api/entry", async (orig) => ({ ...(await orig<typeof import("@/api/entry")>()), entryStep: api.entryStep }));

import { ApiError } from "@/api/client";
import type { StudentSession } from "@/api/entry";
import { RealExamShell } from "./real-exam-shell";

const student: StudentSession = { entryToken: "t", studentId: "S1", fullName: "Asha Rao", rounds: [{ roundId: "r1", type: "aptitude", testId: null, durationMin: 45 }] };
const state = (over = {}) => ({
  status: "in_progress",
  deadlineAt: "2026-01-01T10:45:00Z",
  serverNow: "2026-01-01T10:00:00Z", // 45 min left by the SERVER's clock
  tabSwitches: 0,
  maxTabSwitches: 3,
  questions: [
    { id: "q1", body: "What is 2+2?", options: ["3", "4"], marks: 1 },
    { id: "q2", body: "Pick one", options: ["x", "y"], marks: 1 },
  ],
  savedAnswers: {},
  ...over,
});

// A real student is "at the test" (tab visible + window focused) until they go away.
let focused = true;
const setFocus = (on: boolean, event: "blur" | "focus" | "visibility" | "none" = "none") => {
  focused = on;
  Object.defineProperty(document, "visibilityState", { value: event === "visibility" && !on ? "hidden" : "visible", configurable: true });
  act(() => {
    if (event === "blur") window.dispatchEvent(new Event("blur"));
    if (event === "focus") window.dispatchEvent(new Event("focus"));
    if (event === "visibility") document.dispatchEvent(new Event("visibilitychange"));
  });
};
const goAway = (how: "visibility" | "blur" = "visibility") => setFocus(false, how);
const comeBack = () => setFocus(true, "focus");

beforeEach(() => {
  push.mockReset();
  Object.values(api).forEach((f) => f.mockReset());
  api.entryStart.mockResolvedValue("ATT");
  api.getAttempt.mockResolvedValue(state());
  api.reportViolation.mockResolvedValue({ tabSwitches: 1, locked: false });
  api.saveAnswer.mockResolvedValue(undefined);
  api.submitAttempt.mockResolvedValue({ timeTakenSec: 600 });
  api.entryStep.mockResolvedValue(undefined);
  focused = true;
  Object.defineProperty(document, "fullscreenElement", { value: document.documentElement, configurable: true });
  const pos = { coords: { latitude: 1, longitude: 2, accuracy: 3 } };
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (ok: (p: unknown) => void) => ok(pos), watchPosition: (ok: (p: unknown) => void) => (ok(pos), 1), clearWatch: () => {} },
  });
  vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("RealExamShell (server-driven)", () => {
  it("starts with the entry token, shows the server's time and the questions, never an answer key", async () => {
    render(<RealExamShell student={student} roundId="r1" />);
    expect(await screen.findByText("What is 2+2?")).toBeInTheDocument();
    expect(api.entryStart).toHaveBeenCalledWith("t", "r1");
    expect(api.getAttempt).toHaveBeenCalledWith("ATT");
    expect(screen.getByRole("timer")).toHaveTextContent(/4[45]:\d\d/);
  });

  it("autosaves a chosen option to the server", async () => {
    render(<RealExamShell student={student} roundId="r1" />);
    (await screen.findByRole("radio", { name: /B\. 4/ })).click();
    await waitFor(() => expect(api.saveAnswer).toHaveBeenCalledWith("ATT", "q1", 1));
  });

  it("counts a trip away once, and again only after they come back; the 3rd closes the test", async () => {
    api.reportViolation.mockResolvedValueOnce({ tabSwitches: 1, locked: false }).mockResolvedValueOnce({ tabSwitches: 2, locked: false }).mockResolvedValueOnce({ tabSwitches: 3, locked: true });
    render(<RealExamShell student={student} roundId="r1" />);
    await screen.findByText("What is 2+2?");
    goAway();
    goAway("blur"); // tab hidden AND window blurred is still ONE trip
    await screen.findByText(/Tab switches 1 \/ 3/);
    expect(api.reportViolation).toHaveBeenCalledTimes(1);
    comeBack();
    goAway();
    await screen.findByText(/Tab switches 2 \/ 3 · 1 more closes the test/);
    comeBack();
    goAway();
    expect(await screen.findByRole("alertdialog", { name: "Your test is paused" })).toBeInTheDocument();
    expect(screen.getByText(/Tab switches 3 \/ 3 · test closed/)).toBeInTheDocument();
    expect(api.reportViolation).toHaveBeenCalledTimes(3);
  });

  it("counts changing to another WINDOW (focus lost, tab still visible)", async () => {
    render(<RealExamShell student={student} roundId="r1" />);
    await screen.findByText("What is 2+2?");
    goAway("blur");
    await waitFor(() => expect(api.reportViolation).toHaveBeenCalledWith("ATT", "tab_switch"));
  });

  it("catches a trip away that fires no event, with the focus check", async () => {
    render(<RealExamShell student={student} roundId="r1" />);
    await screen.findByText("What is 2+2?");
    focused = false; // e.g. alt-tab the browser never announced
    await waitFor(() => expect(api.reportViolation).toHaveBeenCalledWith("ATT", "tab_switch"), { timeout: 3000 });
  });

  it("keeps a switch it couldn't send and re-sends it (a network drop must not hide a switch)", async () => {
    api.reportViolation.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue({ tabSwitches: 1, locked: false });
    render(<RealExamShell student={student} roundId="r1" />);
    await screen.findByText("What is 2+2?");
    goAway();
    expect(await screen.findByText(/Offline/)).toBeInTheDocument();
    act(() => void window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(api.reportViolation).toHaveBeenCalledTimes(2));
    await screen.findByText(/Tab switches 1 \/ 3/);
  });

  it("opens straight on the lock screen when the server says the attempt is locked", async () => {
    api.getAttempt.mockResolvedValue(state({ status: "locked", tabSwitches: 3 }));
    render(<RealExamShell student={student} roundId="r1" />);
    expect(await screen.findByRole("alertdialog", { name: "Your test is paused" })).toBeInTheDocument();
  });

  it("sends the student back to the system check when the server says it isn't done", async () => {
    api.entryStart.mockRejectedValue(new ApiError(409, "STEPS_MISSING", "Finish the system check first"));
    render(<RealExamShell student={student} roundId="r1" />);
    expect(await screen.findByText(/Finish the system check/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to system check" })).toHaveAttribute("href", "/exam/r1");
  });

  it("refuses a round the student isn't invited to", () => {
    render(<RealExamShell student={student} roundId="other" />);
    expect(screen.getByText("Round not found")).toBeInTheDocument();
    expect(api.entryStart).not.toHaveBeenCalled();
  });
});

describe("Submit and Leave", () => {
  it("Submit warns about unanswered questions, then makes the answers final and shows the time taken", async () => {
    render(<RealExamShell student={student} roundId="r1" />);
    (await screen.findByRole("radio", { name: /B\. 4/ })).click();
    fireEvent.click(await screen.findByRole("button", { name: "Submit test" }));
    expect(await screen.findByText(/1 question\(s\) are unanswered/)).toBeInTheDocument();
    expect(api.submitAttempt).not.toHaveBeenCalled(); // not until confirmed
    fireEvent.click(screen.getAllByRole("button", { name: "Submit test" }).at(-1)!);
    expect(await screen.findByRole("alertdialog", { name: "Test submitted" })).toBeInTheDocument();
    expect(api.submitAttempt).toHaveBeenCalledWith("ATT");
    expect(screen.getByText(/Your answers are final\. Time taken: 10 min/)).toBeInTheDocument();
  });

  it("Leave asks first, keeps the answers un-submitted and goes back to the dashboard", async () => {
    render(<RealExamShell student={student} roundId="r1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Leave" }));
    expect(await screen.findByText(/not final until you press Submit/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Leave" }).at(-1)!);
    expect(push).toHaveBeenCalledWith("/student");
    expect(api.submitAttempt).not.toHaveBeenCalled();
  });

  it("shows the server's reason if submitting fails, and lets them try again", async () => {
    api.submitAttempt.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "Can't reach the server.")).mockResolvedValue({ timeTakenSec: 60 });
    render(<RealExamShell student={student} roundId="r1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Submit test" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Submit test" }).at(-1)!);
    expect(await screen.findByText(/Can't reach the server/)).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "Test submitted" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Submit test" }).at(-1)!);
    expect(await screen.findByRole("alertdialog", { name: "Test submitted" })).toBeInTheDocument();
  });

  it("submits by itself when time runs out", async () => {
    api.getAttempt.mockResolvedValue(state({ status: "expired" }));
    render(<RealExamShell student={student} roundId="r1" />);
    await waitFor(() => expect(api.submitAttempt).toHaveBeenCalledWith("ATT"));
    expect(await screen.findByRole("alertdialog", { name: "Test submitted" })).toBeInTheDocument();
  });

  it("can't submit once locked, and a submitted attempt opens on the done screen", async () => {
    api.getAttempt.mockResolvedValue(state({ status: "locked", tabSwitches: 3 }));
    const { unmount } = render(<RealExamShell student={student} roundId="r1" />);
    await screen.findByRole("alertdialog", { name: "Your test is paused" });
    expect(screen.getByRole("button", { name: "Submit test" })).toBeDisabled();
    unmount();
    api.getAttempt.mockResolvedValue(state({ status: "submitted" }));
    render(<RealExamShell student={student} roundId="r1" />);
    expect(await screen.findByRole("alertdialog", { name: "Test submitted" })).toBeInTheDocument();
    expect(api.submitAttempt).not.toHaveBeenCalled();
  });

  it("does not start the timer until location and full screen pass the start check", async () => {
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    render(<RealExamShell student={student} roundId="r1" />);
    await screen.findByText("Before you start");
    // Full screen is off, so the one button both enters it and re-checks.
    await screen.findByRole("button", { name: "Enter full screen and check" });
    expect(api.entryStart).not.toHaveBeenCalled();
    expect(api.entryStep).toHaveBeenCalledWith("t", "r1", "location", true, expect.anything());
  });
});

describe("navigation, saving and round types", () => {
  it("jumps straight to a question from the navigator and shows its state", async () => {
    render(<RealExamShell student={student} roundId="r1" />);
    await screen.findByText("What is 2+2?");
    fireEvent.click(screen.getByRole("button", { name: "Question 2, not answered" }));
    expect(screen.getByText("Pick one")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /A\. x/ }));
    expect(screen.getByRole("button", { name: "Question 2, answered" })).toBeInTheDocument();
  });

  it("keeps a failed save, says so, and retries until the server has it", async () => {
    api.saveAnswer.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "offline")).mockResolvedValue(undefined);
    render(<RealExamShell student={student} roundId="r1" />);
    fireEvent.click(await screen.findByRole("radio", { name: /B\. 4/ }));
    expect(await screen.findByText("1 answer not saved yet, retrying…")).toBeInTheDocument();
    act(() => window.dispatchEvent(new Event("online")));
    await screen.findByText(/1 of 2 answered/);
    expect(api.saveAnswer).toHaveBeenLastCalledWith("ATT", "q1", 1);
  });

  it("sends only the latest choice when the student changes their mind mid-save", async () => {
    let release!: () => void;
    api.saveAnswer.mockImplementationOnce(() => new Promise<void>((r) => (release = r))).mockResolvedValue(undefined);
    render(<RealExamShell student={student} roundId="r1" />);
    fireEvent.click(await screen.findByRole("radio", { name: /A\. 3/ }));
    fireEvent.click(screen.getByRole("radio", { name: /B\. 4/ }));
    await act(async () => release());
    await waitFor(() => expect(api.saveAnswer).toHaveBeenLastCalledWith("ATT", "q1", 1));
    expect(api.saveAnswer).toHaveBeenCalledTimes(2);
  });

  it("closes an open dialog and makes the page inert when full screen drops", async () => {
    render(<RealExamShell student={student} roundId="r1" />);
    await screen.findByText("What is 2+2?");
    fireEvent.click(screen.getByRole("button", { name: "Submit test" }));
    expect(await screen.findByRole("alertdialog", { name: "Submit your test?" })).toBeInTheDocument();
    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
    act(() => document.dispatchEvent(new Event("fullscreenchange")));
    expect(await screen.findByRole("alertdialog", { name: "Return to full screen" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "Submit your test?" })).not.toBeInTheDocument();
    expect(document.querySelector("main")).toHaveAttribute("inert");
  });

  it("shows a coding round with its editor, runs samples and counts a submission", async () => {
    const coding: StudentSession = { ...student, rounds: [{ roundId: "r2", type: "coding", testId: null, durationMin: 60 }] };
    api.getAttempt.mockResolvedValue(
      state({ questions: [{ kind: "coding", id: "c1", title: "Sum", statement: "Add two numbers", marks: 10, languages: [{ key: "python", name: "Python 3" }], samples: [{ input: "1 2", expected: "3" }] }] }),
    );
    api.getCodeDrafts.mockResolvedValue({ c1: { code: "print(3)", language: "python", saved_at: "2026-01-01T10:01:00Z" } });
    api.runCode.mockResolvedValue([{ case: 1, passed: true, status: "passed", stdout: "3", stderr: "", time: 0.01 }]);
    api.submitCode.mockResolvedValue({ passed: 7, total: 10 });
    render(<RealExamShell student={coding} roundId="r2" />);
    expect(await screen.findByRole("textbox", { name: "Code for Sum" })).toHaveValue("print(3)");
    fireEvent.click(screen.getByRole("button", { name: /Run samples/ }));
    expect(await screen.findByText(/Passed · 10 ms/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Submit code/ }));
    expect(await screen.findByText(/test cases passed/)).toHaveTextContent("7 / 10 test cases passed");
    expect(api.submitCode).toHaveBeenCalledWith("ATT", "c1", "print(3)", "python");
    expect(screen.getByText("1 of 1 submitted")).toBeInTheDocument();
  });

  it("says the AI interview isn't open instead of starting a test", async () => {
    const iv: StudentSession = { ...student, rounds: [{ roundId: "r3", type: "ai_interview", testId: null, durationMin: 20 }] };
    render(<RealExamShell student={iv} roundId="r3" />);
    expect(screen.getByRole("heading", { name: /AI interview isn.t open here yet/ })).toBeInTheDocument();
    expect(api.entryStart).not.toHaveBeenCalled();
  });
});

