import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const getRoundProgress = vi.hoisted(() => vi.fn());
vi.mock("@/api/hiring", () => ({ getRoundProgress }));

import { RealRoundProgress } from "./real-round-progress";

beforeEach(() => getRoundProgress.mockReset());

it("a pending round explains how students arrive instead of showing empty stats", async () => {
  getRoundProgress.mockResolvedValue({ type: "coding", status: "pending", candidates: [] });
  render(<RealRoundProgress driveId="d1" roundId="r2" />);
  expect(await screen.findByText("This round isn't open yet")).toBeInTheDocument();
  expect(screen.getByText(/Set up the coding test below first/)).toBeInTheDocument();
  expect(screen.queryByText("In round")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /auto-refresh/i })).not.toBeInTheDocument();
});

it("an open round keeps the live stats and candidate table", async () => {
  getRoundProgress.mockResolvedValue({ type: "aptitude", status: "active", candidates: [] });
  render(<RealRoundProgress driveId="d1" roundId="r1" />);
  expect(await screen.findByText("In round")).toBeInTheDocument();
  expect(screen.getByText(/pass the round before this one/)).toBeInTheDocument();
});
