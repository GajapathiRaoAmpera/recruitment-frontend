// Interview / final round: the AI score is advice, HR picks pass/fail for every student and confirms.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const getDecisions = vi.hoisted(() => vi.fn());
const decideRound = vi.hoisted(() => vi.fn());
vi.mock("@/api/rounds", () => ({ getDecisions, decideRound }));
const downloadDriveReport = vi.hoisted(() => vi.fn());
vi.mock("@/api/hiring", () => ({ downloadDriveReport }));

import { DecisionPanel } from "./decision-panel";

const row = (id: string, name: string, extra = {}) => ({
  candidateId: id, studentId: `S-${id}`, name, status: "in_progress", interviewId: `i-${id}`,
  interviewStatus: "completed", scoring: "done", aiAverage: 4, ...extra,
}); // prettier-ignore

beforeEach(() => {
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
  expect(screen.getByText(/1 selected, 0 rejected/)).toBeInTheDocument();
  expect(screen.getByText(/not emailed automatically/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Back to drive" })).toHaveAttribute("href", "/hr/drives/d1");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Download report/ })));
  expect(downloadDriveReport).toHaveBeenCalledWith("d1");
});
