import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ acceptDraft: vi.fn(), editQuestion: vi.fn() }));
vi.mock("@/api/papers", () => api);

import { ToastProvider } from "@/components/ui/toast";
import type { DraftDetail, KeyItem } from "@/features/papers/types";
import { ReviewStep } from "./review-step";

const item = (id: string, patch: Partial<KeyItem> = {}): KeyItem => ({
  id, level: "easy", section: "aptitude", topic: "Percentages", text: `Question ${id}?`, options: ["10", "20", "30", "40"],
  answer: 1, why: "Because.", fixedOptions: false, edited: false, ...patch,
});
export const detail = (patch: Partial<DraftDetail> = {}): DraftDetail =>
  ({
    id: "p-1", driveRef: "d1", title: "T", track: "it", status: "draft", poolSize: 6, editedCount: 0, issues: [], overlap: null,
    checks: [{ id: "pool_covers", label: "Pool covers the paper", ok: true, detail: "OK" }],
    sample: [item("q1"), item("q2", { text: "What prints?\n```python\nprint(1)\n```" }), item("q3")],
    pool: [], selectedCount: 3,
    settings: { track: "it", counts: { easy: 3, medium: 0, advanced: 0 }, mix: { aptitude: 100, reasoning: 0, technical: 0 }, itSyntaxPercent: 50, poolFactor: 1, durationMin: 30, differentPerStudent: false, shuffleQuestions: true, shuffleOptions: true },
    ...patch,
  }) as DraftDetail;

const renderReview = (d = detail(), onChange = vi.fn()) => {
  render(
    <ToastProvider>
      <ReviewStep draft={d} onChange={onChange} />
    </ToastProvider>,
  );
  return onChange;
};

beforeEach(() => {
  api.acceptDraft.mockReset();
  api.editQuestion.mockReset();
});

it("shows exactly one sample paper", () => {
  renderReview();
  expect(screen.getAllByRole("list", { name: "Sample paper" })).toHaveLength(1);
  expect(within(screen.getByRole("list", { name: "Sample paper" })).getAllByText(/^Q\d$/)).toHaveLength(3);
});

it("every card has an Edit button while draft", () => {
  renderReview();
  expect(screen.getAllByRole("button", { name: /edit question/i })).toHaveLength(3);
});

it("saving calls editQuestion and refreshes", async () => {
  const fresh = detail({ sample: [item("q1", { text: "Fixed?", edited: true }), item("q2"), item("q3")], editedCount: 1 });
  api.editQuestion.mockResolvedValue(fresh);
  const onChange = renderReview();
  fireEvent.click(screen.getByRole("button", { name: "Edit question 1" }));
  fireEvent.change(screen.getByLabelText(/^question/i), { target: { value: "Fixed?" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save question" })));
  expect(api.editQuestion).toHaveBeenCalledWith("p-1", "q1", { text: "Fixed?", options: ["10", "20", "30", "40"], answer: 1, why: "Because." });
  expect(onChange).toHaveBeenCalledWith(fresh);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("edited badge appears after save", () => {
  renderReview(detail({ sample: [item("q1", { edited: true }), item("q2")] }));
  expect(screen.getAllByText("Edited")).toHaveLength(1);
});

it("accept disabled until all checks pass", () => {
  renderReview(detail({ checks: [{ id: "pool_covers", label: "Pool covers the paper", ok: false, detail: "2 short at medium/aptitude" }] }));
  expect(screen.getByRole("button", { name: "Accept paper" })).toBeDisabled();
  expect(screen.getByText(/2 short at medium\/aptitude/)).toBeInTheDocument();
  expect(screen.getByText("failed")).toBeInTheDocument();
});

it("confirm dialog before accept", async () => {
  api.acceptDraft.mockResolvedValue({ id: "p-1", status: "accepted" });
  const onChange = renderReview();
  fireEvent.click(screen.getByRole("button", { name: "Accept paper" }));
  expect(api.acceptDraft).not.toHaveBeenCalled();
  const dialog = screen.getByRole("alertdialog");
  expect(dialog).toHaveTextContent(/lock/i);
  await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Accept paper" })));
  expect(api.acceptDraft).toHaveBeenCalledWith("p-1");
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted", sample: expect.any(Array) }));
});

it("accepted draft hides Edit and shows locked banner", () => {
  renderReview(detail({ status: "accepted" }));
  expect(screen.queryByRole("button", { name: /edit question/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Accept paper" })).not.toBeInTheDocument();
  expect(screen.getByText(/paper is accepted/i)).toBeInTheDocument();
});

it("code fences render as code blocks", () => {
  renderReview();
  const code = screen.getByText("print(1)");
  expect(code.tagName).toBe("CODE");
  expect(code.parentElement?.tagName).toBe("PRE");
  expect(screen.queryByText(/```/)).not.toBeInTheDocument();
});

it("accept waits until the question selection is saved", () => {
  const pool = detail().sample.map((q) => ({ ...q, selected: true }));
  renderReview(detail({ pool }));
  expect(screen.getByRole("button", { name: "Accept paper" })).toBeEnabled();
  fireEvent.click(screen.getAllByRole("checkbox")[0]!);
  expect(screen.getByRole("button", { name: "Accept paper" })).toBeDisabled();
  expect(screen.getByText(/save or undo your question selection/i)).toBeInTheDocument();
});
