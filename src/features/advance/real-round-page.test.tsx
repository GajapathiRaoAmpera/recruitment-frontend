// AC-9 HR flow: the real round page mounts the advance panel on test rounds and coding results on coding rounds;
// advancing remounts the progress view so it refetches the new round status.
import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const listRounds = vi.hoisted(() => vi.fn());
const mounts = vi.hoisted(() => ({ progress: 0 }));
const advanced = vi.hoisted(() => ({ fn: () => {} }));

vi.mock("@/api/hiring", () => ({ listRounds }));
vi.mock("@/features/hiring/real-round-progress", async () => {
  const { useEffect } = await import("react");
  return {
    RealRoundProgress: () => {
      useEffect(() => {
        mounts.progress++;
      }, []);
      return <p>progress view</p>;
    },
  };
});
vi.mock("./advance-panel", () => ({
  AdvancePanel: ({ onAdvanced }: { onAdvanced: () => void }) => {
    advanced.fn = onAdvanced;
    return <p>advance panel</p>;
  },
}));
vi.mock("./decision-panel", () => ({ DecisionPanel: () => <p>decision panel</p> }));
vi.mock("@/features/coding-results/coding-results", () => ({ CodingResults: () => <p>coding results</p> }));
vi.mock("@/features/coding-questions/coding-setup", () => ({ CodingSetup: () => <p>coding setup</p> }));

import { RealRoundPage } from "./real-round-page";

beforeEach(() => {
  mounts.progress = 0;
  listRounds.mockReset();
});

const withType = (type: string) => listRounds.mockResolvedValue([{ id: "r1", position: 2, type, status: "active" }]);

it("coding round: progress, coding setup, advance panel and coding results, in that order", async () => {
  withType("coding");
  const { container } = render(<RealRoundPage driveId="d1" roundId="r1" />);
  expect(await screen.findByText("advance panel")).toBeInTheDocument();
  expect([...container.querySelectorAll("p")].map((p) => p.textContent)).toEqual(["progress view", "coding setup", "advance panel", "coding results"]);
  expect(listRounds).toHaveBeenCalledWith("d1");
});

it("aptitude round: advance panel only", async () => {
  withType("aptitude");
  render(<RealRoundPage driveId="d1" roundId="r1" />);
  expect(await screen.findByText("advance panel")).toBeInTheDocument();
  expect(screen.queryByText("coding results")).not.toBeInTheDocument();
  expect(screen.queryByText("coding setup")).not.toBeInTheDocument();
});

it.each(["ai_interview", "final"])("%s round: HR decision panel, no cut-off", async (type) => {
  withType(type);
  render(<RealRoundPage driveId="d1" roundId="r1" />);
  expect(await screen.findByText("decision panel")).toBeInTheDocument();
  expect(screen.getByText("progress view")).toBeInTheDocument();
  expect(screen.queryByText("advance panel")).not.toBeInTheDocument();
});

it("advancing remounts the progress view", async () => {
  withType("technical");
  render(<RealRoundPage driveId="d1" roundId="r1" />);
  await screen.findByText("advance panel");
  expect(mounts.progress).toBe(1);
  act(() => advanced.fn());
  expect(mounts.progress).toBe(2);
});
