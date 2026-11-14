import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getDraft: vi.fn() }));
vi.mock("@/api/papers", () => api);

import type { DraftDetail } from "@/features/papers/types";
import { GenerationProgress, POLL_MS } from "./generation-progress";

const draft = (patch: Partial<DraftDetail> = {}) =>
  ({ id: "p-1", driveRef: "d1", title: "T", status: "generating", progress: { done: 3, total: 12 }, error: null, ...patch }) as DraftDetail;

beforeEach(() => {
  vi.useFakeTimers();
  api.getDraft.mockReset();
});
afterEach(() => vi.useRealTimers());

it("progress bar reflects done/total and stops polling on unmount", async () => {
  const onUpdate = vi.fn();
  api.getDraft.mockResolvedValue(draft({ progress: { done: 6, total: 12 } }));
  const view = render(<GenerationProgress draft={draft()} onUpdate={onUpdate} />);
  expect(screen.getByRole("progressbar", { name: "Generation progress" })).toHaveAttribute("aria-valuenow", "25");
  expect(screen.getByText(/3 \/ 12/)).toBeInTheDocument();
  expect(screen.getByText(/questions written/)).toBeInTheDocument();

  await act(async () => vi.advanceTimersByTime(POLL_MS));
  expect(api.getDraft).toHaveBeenCalledWith("p-1");
  expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ progress: { done: 6, total: 12 } }));

  view.unmount();
  await act(async () => vi.advanceTimersByTime(POLL_MS * 5));
  expect(api.getDraft).toHaveBeenCalledTimes(1);
});

it("does not poll once generation has finished", async () => {
  render(<GenerationProgress draft={draft({ status: "draft" })} onUpdate={vi.fn()} />);
  await act(async () => vi.advanceTimersByTime(POLL_MS * 3));
  expect(api.getDraft).not.toHaveBeenCalled();
});

it("keeps polling after a network blip", async () => {
  api.getDraft.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValue(draft());
  render(<GenerationProgress draft={draft()} onUpdate={vi.fn()} />);
  await act(async () => vi.advanceTimersByTime(POLL_MS));
  expect(screen.getByText(/retrying/i)).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTime(POLL_MS));
  expect(api.getDraft).toHaveBeenCalledTimes(2);
});

it("failed generation shows message and start over", async () => {
  render(<GenerationProgress draft={draft({ status: "failed", error: "Only 40 questions passed verification." })} onUpdate={vi.fn()} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Only 40 questions passed verification.");
  expect(screen.getByRole("link", { name: /start over/i })).toHaveAttribute("href", "/hr/papers/new?drive=d1");
  await act(async () => vi.advanceTimersByTime(POLL_MS * 2));
  expect(api.getDraft).not.toHaveBeenCalled();
});
