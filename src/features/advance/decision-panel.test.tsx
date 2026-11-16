// Interview / final round: the AI score is advice, HR picks pass/fail for every student and confirms.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const getDecisions = vi.hoisted(() => vi.fn());
const decideRound = vi.hoisted(() => vi.fn());
vi.mock("@/api/rounds", () => ({ getDecisions, decideRound }));
const downloadDriveReport = vi.hoisted(() => vi.fn());
vi.mock("@/api/hiring", () => ({ downloadDriveReport }));
const getInterview = vi.hoisted(() => vi.fn());
const interviewFrame = vi.hoisted(() => vi.fn());
vi.mock("@/api/interviews", () => ({ getInterview, interviewFrame }));

import { DecisionPanel } from "./decision-panel";

const row = (id: string, name: string, extra = {}) => ({
  candidateId: id, studentId: `S-${id}`, name, status: "in_progress", interviewId: `i-${id}`,
  interviewStatus: "completed", scoring: "done", aiAverage: 4, ...extra,
}); // prettier-ignore

beforeEach(() => {
  interviewFrame.mockReset().mockRejectedValue(new Error("NO_FRAME")); // camera paused unless a test says otherwise
  getDecisions.mockReset();
  decideRound.mockReset();
});

it("shows the AI score as advice and sends HR's picks once every student is decided", async () => {
  getDecisions.mockResolvedValue({ roundId: "r1", roundType: "ai_interview", roundStatus: "active", candidates: [row("a", "Asha"), row("b", "Ben", { scoring: "pending", aiAverage: null })] });
  decideRound.mockResolvedValue({ roundId: "r1", passed: 1, failed: 1, nextRoundId: "f1", invited: [], driveClosed: false });
  const onDecided = vi.fn();
  render(<DecisionPanel roundId="r1" driveId="d1" onDecided={onDecided} />);

  expect(await screen.findByText("4 / 5")).toBeInTheDocument();
  expect(screen.getByText("Scoring…")).toBeInTheDocument();
  const confirm = screen.getByRole("button", { name: "Confirm decisions" });
  expect(confirm).toBeDisabled();

  fireEvent.click(within(screen.getByRole("group", { name: "Decision for Asha" })).getByRole("button", { name: "Fail" }));
  fireEvent.click(within(screen.getByRole("group", { name: "Decision for Ben" })).getByRole("button", { name: "Pass" }));
  fireEvent.click(confirm);
  const dialog = await screen.findByRole("dialog");
  await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Confirm decisions" })));

  expect(decideRound).toHaveBeenCalledWith("r1", { a: "fail", b: "pass" });
  expect(onDecided).toHaveBeenCalled();
  expect(await screen.findByText("Round decided")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open next round/ })).toHaveAttribute("href", "/hr/drives/d1/rounds/f1");
});

it("final round uses Select / Reject and blocks while an interview is live", async () => {
  getDecisions.mockResolvedValue({ roundId: "r1", roundType: "final", roundStatus: "active", candidates: [row("a", "Asha", { interviewStatus: "live" })] });
  render(<DecisionPanel roundId="r1" driveId="d1" onDecided={() => {}} />);
  expect(await screen.findByRole("button", { name: "Select" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  expect(screen.getByRole("button", { name: "Finish drive" })).toBeDisabled();
  expect(screen.getByText(/still in their interview/)).toBeInTheDocument();
});

it("finishing the drive offers the report and says students are not emailed", async () => {
  getDecisions.mockResolvedValue({ roundId: "r1", roundType: "final", roundStatus: "active", candidates: [row("a", "Asha")] });
  decideRound.mockResolvedValue({ roundId: "r1", passed: 1, failed: 0, nextRoundId: null, invited: [], driveClosed: true });
  downloadDriveReport.mockResolvedValue(undefined);
  render(<DecisionPanel roundId="r1" driveId="d1" onDecided={vi.fn()} />);

  fireEvent.click(within(await screen.findByRole("group", { name: "Decision for Asha" })).getByRole("button", { name: "Select" }));
  fireEvent.click(screen.getByRole("button", { name: "Finish drive" }));
  await act(async () => fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Finish drive" })));

  expect(await screen.findByText("Drive finished")).toBeInTheDocument();
  const summary = screen.getByRole("status");
  expect(within(summary).getByText("Selected").nextSibling).toHaveTextContent("1");
  expect(within(summary).getByText("Rejected").nextSibling).toHaveTextContent("0");
  expect(screen.getByText(/not emailed automatically/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to drive" })).toHaveAttribute("href", "/hr/drives/d1");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Download report/ })));
  expect(downloadDriveReport).toHaveBeenCalledWith("d1");
});

it("opens a student's transcript in a side panel without leaving the round (AC: HR reviews the interview before deciding)", async () => {
  getDecisions.mockResolvedValue({ roundId: "r1", roundType: "final", roundStatus: "active", candidates: [row("a", "Asha")] });
  getInterview.mockResolvedValue({ id: "i-a", turns: 2, scoring: "done", average: 4, transcript: [{ role: "ai", text: "Tell me about yourself." }, { role: "candidate", text: "I build APIs." }] });
  render(<DecisionPanel roundId="r1" driveId="d1" onDecided={vi.fn()} />);

  fireEvent.click(await screen.findByRole("button", { name: "Transcript" }));
  const panel = within(await screen.findByRole("dialog", { name: "Asha · transcript" }));
  expect(await panel.findByText("I build APIs.")).toBeInTheDocument();
  expect(getInterview).toHaveBeenCalledWith("i-a");
  expect(panel.getByRole("link", { name: "Open full interview" })).toHaveAttribute("href", "/hr/interviews/i-a");
});

it("shows a Live now camera wall on the interview round for students in their interview (AC: HR watches the live AI interview)", async () => {
  getDecisions.mockResolvedValue({
    roundId: "r1", roundType: "ai_interview", roundStatus: "active",
    candidates: [row("a", "Asha", { interviewStatus: "live", scoring: null, aiAverage: null }), row("b", "Ben")],
  }); // prettier-ignore
  render(<DecisionPanel roundId="r1" driveId="d1" onDecided={vi.fn()} />);

  const wall = await screen.findByRole("list", { name: "Live interviews" });
  expect(screen.getByRole("heading", { name: /Live now \(1\)/ })).toBeInTheDocument();
  expect(within(wall).getByRole("link", { name: "Watch Asha's interview" })).toHaveAttribute("href", "/hr/interviews/i-a");
  expect(within(wall).queryByText("Ben")).toBeNull(); // finished interviews are not on the wall
  expect(await within(wall).findByText("Waiting for camera…")).toBeInTheDocument(); // no fresh still yet: placeholder, not an error
  expect(interviewFrame).toHaveBeenCalledWith("i-a");
});

it("no camera wall when nobody is live", async () => {
  getDecisions.mockResolvedValue({ roundId: "r1", roundType: "ai_interview", roundStatus: "active", candidates: [row("a", "Asha")] });
  render(<DecisionPanel roundId="r1" driveId="d1" onDecided={vi.fn()} />);
  await screen.findByText("4 / 5");
  expect(screen.queryByRole("list", { name: "Live interviews" })).toBeNull();
  expect(interviewFrame).not.toHaveBeenCalled();
});
