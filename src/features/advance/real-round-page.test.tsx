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
vi.mock("@/features/coding-results/coding-results", () => ({ CodingResults: () => <p>coding results</p> }));

import { RealRoundPage } from "./real-round-page";

beforeEach(() => {
  mounts.progress = 0;
  listRounds.mockReset();
});

const withType = (type: string) => listRounds.mockResolvedValue([{ id: "r1", position: 2, type, status: "active" }]);

it("coding round: progress, advance panel and coding results", async () => {
  withType("coding");
  render(<RealRoundPage driveId="d1" roundId="r1" />);
  expect(await screen.findByText("advance panel")).toBeInTheDocument();
  expect(screen.getByText("progress view")).toBeInTheDocument();
  expect(screen.getByText("coding results")).toBeInTheDocument();
  expect(listRounds).toHaveBeenCalledWith("d1");
});

it("aptitude round: advance panel only", async () => {
  withType("aptitude");
  render(<RealRoundPage driveId="d1" roundId="r1" />);
  expect(await screen.findByText("advance panel")).toBeInTheDocument();
  expect(screen.queryByText("coding results")).not.toBeInTheDocument();
});

it("non-test round: progress view only", async () => {
  withType("ai_interview");
  render(<RealRoundPage driveId="d1" roundId="r1" />);
  await act(async () => {});
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
