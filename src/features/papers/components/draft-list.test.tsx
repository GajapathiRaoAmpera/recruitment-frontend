import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";

const api = vi.hoisted(() => ({ listDrafts: vi.fn() }));
vi.mock("@/api/papers", () => api);

import type { Draft } from "@/features/papers/types";
import { DraftList, shownStatus } from "./draft-list";

const d = (patch: Partial<Draft> = {}) =>
  ({
    id: "p-1", driveRef: "d1", ownerId: "u-2", title: "Round 1 — SDE", track: "it", status: "draft", progress: { done: 0, total: 0 }, error: null,
    poolSize: 0, createdAt: "2026-11-10T10:00:00Z", acceptedAt: null, persistedAt: null,
    settings: { track: "it", counts: { easy: 5, medium: 3, advanced: 2 }, mix: { aptitude: 40, reasoning: 30, technical: 30 }, itSyntaxPercent: 50, poolFactor: 2, durationMin: 45, differentPerStudent: true, shuffleQuestions: true, shuffleOptions: true },
    ...patch,
  }) as Draft;
const ownerName = (id: string) => (id === "u-2" ? "Priya HR" : id);

beforeEach(() => {
  api.listDrafts.mockReset();
});

it("draft list loading state", () => {
  api.listDrafts.mockReturnValue(new Promise(() => {}));
  render(<DraftList showOwner={false} ownerName={ownerName} />);
  expect(screen.getByRole("status")).toHaveTextContent(/loading papers/i);
});

it("draft list empty state offers a new paper", async () => {
  api.listDrafts.mockResolvedValue([]);
  render(<DraftList showOwner={false} ownerName={ownerName} />);
  expect(await screen.findByText("No papers yet")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /new paper/i })).toHaveAttribute("href", "/hr/papers/new");
});

it("draft list error state retries", async () => {
  api.listDrafts.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "Server unavailable")).mockResolvedValue([d()]);
  render(<DraftList showOwner={false} ownerName={ownerName} />);
  (await screen.findByRole("button", { name: /try again/i })).click();
  expect(await screen.findByText("Round 1 — SDE")).toBeInTheDocument();
});

it("super admin sees owner column, hr does not", async () => {
  api.listDrafts.mockResolvedValue([d()]);
  const { unmount } = render(<DraftList showOwner ownerName={ownerName} />);
  expect(await screen.findByText(/owner priya hr/i)).toBeInTheDocument();
  unmount();
  render(<DraftList showOwner={false} ownerName={ownerName} />);
  expect(await screen.findByText("Round 1 — SDE")).toBeInTheDocument();
  expect(screen.queryByText(/owner/i)).not.toBeInTheDocument();
});

it("shows Sent once persisted and card details", async () => {
  expect(shownStatus(d({ status: "accepted", persistedAt: "2026-11-11T00:00:00Z" }))).toBe("Sent");
  expect(shownStatus(d({ status: "failed" }))).toBe("Failed");
  api.listDrafts.mockResolvedValue([d()]);
  render(<DraftList showOwner={false} ownerName={ownerName} />);
  expect(await screen.findByText(/IT · 10 questions · 45 min/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /round 1 — sde/i })).toHaveAttribute("href", "/hr/papers/p-1");
});
