import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";

const api = vi.hoisted(() => ({ listDrafts: vi.fn() }));
vi.mock("@/api/papers", () => api);

import type { Draft } from "@/features/papers/types";
import { RoundPaperPanel } from "./round-paper-panel";

const d = (patch: Partial<Draft> = {}) =>
  ({
    id: "p-1", driveRef: "d1", ownerId: "u-2", title: "Round 1 — SDE", track: "it", status: "draft", progress: { done: 0, total: 0 }, error: null,
    poolSize: 0, createdAt: "2026-11-10T10:00:00Z", acceptedAt: null, persistedAt: null,
    settings: { track: "it", counts: { easy: 5, medium: 3, advanced: 2 }, mix: { aptitude: 40, reasoning: 30, technical: 30 }, itSyntaxPercent: 50, poolFactor: 2, durationMin: 45, differentPerStudent: true, shuffleQuestions: true, shuffleOptions: true },
    ...patch,
  }) as Draft;

beforeEach(() => api.listDrafts.mockReset());

it("no paper for this drive: offers Build paper for the drive (other drives' papers ignored)", async () => {
  api.listDrafts.mockResolvedValue([d({ driveRef: "other" })]);
  render(<RoundPaperPanel driveId="d1" />);
  expect(await screen.findByText("No paper for this round yet")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /build paper/i })).toHaveAttribute("href", "/hr/papers/new?drive=d1");
});

it("shows the sent paper first with its next step, and tucks the rest away", async () => {
  api.listDrafts.mockResolvedValue([
    d({ id: "p-new", title: "Newer draft", createdAt: "2026-11-12T10:00:00Z" }),
    d({ id: "p-sent", title: "Final paper", status: "accepted", persistedAt: "2026-11-11T00:00:00Z" }),
  ]);
  render(<RoundPaperPanel driveId="d1" />);
  expect(await screen.findByText("Final paper")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View paper" })).toHaveAttribute("href", "/hr/papers/p-sent");
  expect(screen.getByText(/other papers for this drive \(1\)/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /new paper/i })).toHaveAttribute("href", "/hr/papers/new?drive=d1");
});

it("draft in review points to Review paper", async () => {
  api.listDrafts.mockResolvedValue([d()]);
  render(<RoundPaperPanel driveId="d1" />);
  expect(await screen.findByRole("link", { name: "Review paper" })).toHaveAttribute("href", "/hr/papers/p-1");
});

it("error state retries", async () => {
  api.listDrafts.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "Server unavailable")).mockResolvedValue([d()]);
  render(<RoundPaperPanel driveId="d1" />);
  (await screen.findByRole("button", { name: /try again/i })).click();
  expect(await screen.findByText("Round 1 — SDE")).toBeInTheDocument();
});
