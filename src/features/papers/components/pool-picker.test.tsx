import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ setSelection: vi.fn() }));
vi.mock("@/api/papers", () => api);

import { ToastProvider } from "@/components/ui/toast";
import { needed } from "@/features/papers/needed";
import type { DraftDetail, Level, PaperSettings, PoolItem, Section } from "@/features/papers/types";
import { PoolPicker } from "./pool-picker";

const settings = {
  track: "it", counts: { easy: 2, medium: 0, advanced: 0 }, mix: { aptitude: 50, reasoning: 50, technical: 0 },
  itSyntaxPercent: 50, poolFactor: 2, durationMin: 30, differentPerStudent: true, shuffleQuestions: true, shuffleOptions: true,
} as PaperSettings;
const item = (id: string, level: Level, section: Section, selected = true): PoolItem => ({
  id, level, section, topic: "t", text: `Question ${id}`, options: ["a", "b", "c", "d"], answer: 0, why: "w", fixedOptions: false, edited: false, selected,
});
const pool = [item("a1", "easy", "aptitude"), item("a2", "easy", "aptitude"), item("r1", "easy", "reasoning"), item("r2", "easy", "reasoning")];
const draft = (patch: Partial<DraftDetail> = {}) => ({ id: "p-1", status: "draft", track: "it", settings, pool, selectedCount: 4, ...patch }) as DraftDetail;
const renderPicker = (d = draft(), onChange = vi.fn(), onDirtyChange = vi.fn()) => {
  render(
    <ToastProvider>
      <PoolPicker draft={d} onChange={onChange} onDirtyChange={onDirtyChange} />
    </ToastProvider>,
  );
  return { onChange, onDirtyChange };
};
const box = (id: string) => screen.getByRole("checkbox", { name: `Select: Question ${id}` });
const cell = (row: string, col: number) => within(screen.getByRole("row", { name: new RegExp(`^${row}`) })).getAllByRole("cell")[col]!;

beforeEach(() => {
  api.setSelection.mockReset();
});

it("needed mirrors the backend largest-remainder split", () => {
  expect(needed(settings).easy).toEqual({ aptitude: 1, reasoning: 1, technical: 0 });
  expect(needed({ ...settings, counts: { easy: 10, medium: 3, advanced: 3 }, mix: { aptitude: 40, reasoning: 30, technical: 30 } }).medium).toEqual({ aptitude: 1, reasoning: 1, technical: 1 });
});

it("shows selected vs needed counts and flags short cells", () => {
  const { onDirtyChange } = renderPicker();
  expect(screen.getByText("4 of 4 selected · each paper needs 2")).toBeInTheDocument();
  expect(cell("Easy", 0)).toHaveTextContent("2 selected / 1 needed");
  fireEvent.click(box("r1"));
  fireEvent.click(box("r2"));
  expect(cell("Easy", 1)).toHaveTextContent("0 selected / 1 needed (too few)");
  expect(screen.getByText(/select more questions in the red cells/i)).toBeInTheDocument();
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
});

it("select all and clear apply only to filtered rows", () => {
  renderPicker();
  fireEvent.change(screen.getByLabelText("Section"), { target: { value: "reasoning" } });
  fireEvent.click(screen.getByRole("button", { name: /clear shown/i }));
  fireEvent.change(screen.getByLabelText("Section"), { target: { value: "" } });
  expect(box("a1")).toBeChecked();
  expect(box("r1")).not.toBeChecked();
  expect(screen.getByText("2 of 4 selected · each paper needs 2")).toBeInTheDocument();
});

it("save sends the picked ids and hands back the refreshed draft", async () => {
  const fresh = draft({ pool: pool.map((p) => ({ ...p, selected: p.id !== "a2" && p.id !== "r2" })), selectedCount: 2 });
  api.setSelection.mockResolvedValue(fresh);
  const { onChange } = renderPicker();
  expect(screen.getByRole("button", { name: "Save selection" })).toBeDisabled();
  fireEvent.click(box("a2"));
  fireEvent.click(box("r2"));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save selection" })));
  expect(api.setSelection).toHaveBeenCalledWith("p-1", ["a1", "r1"]);
  expect(onChange).toHaveBeenCalledWith(fresh);
});

it("undo restores the saved selection; accepted drafts are read-only", () => {
  renderPicker();
  fireEvent.click(box("a1"));
  fireEvent.click(screen.getByRole("button", { name: "Undo changes" }));
  expect(box("a1")).toBeChecked();
  screen.getByText("Selection saved.");
  document.body.innerHTML = "";
  renderPicker(draft({ status: "accepted" }));
  expect(box("a1")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Save selection" })).not.toBeInTheDocument();
});
