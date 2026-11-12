import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";

const api = vi.hoisted(() => ({ editQuestion: vi.fn() }));
vi.mock("@/api/papers", () => api);

import { ToastProvider } from "@/components/ui/toast";
import type { KeyItem } from "@/features/papers/types";
import { QuestionEditDialog, validateEdit } from "./question-edit-dialog";

const q: KeyItem = { id: "q1", level: "easy", section: "aptitude", topic: "t", text: "2+2?", options: ["3", "4", "5", "6"], answer: 1, why: "Sum.", fixedOptions: false, edited: false };
const save = () => act(async () => fireEvent.click(screen.getByRole("button", { name: "Save question" })));
const open = () =>
  render(
    <ToastProvider>
      <QuestionEditDialog draftId="p-1" question={q} onClose={vi.fn()} onSaved={vi.fn()} />
    </ToastProvider>,
  );

beforeEach(() => {
  api.editQuestion.mockReset(); // block body: a returned function would run as a teardown hook
});

it("edit dialog blocks duplicate options and blank text", async () => {
  open();
  expect(screen.getByText(/every candidate/i)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/option b/i), { target: { value: " 3 " } });
  await save();
  expect(screen.getByRole("alert")).toHaveTextContent("Each option must be different.");
  fireEvent.change(screen.getByLabelText(/option b/i), { target: { value: "4" } });
  fireEvent.change(screen.getByLabelText(/^question/i), { target: { value: "   " } });
  await save();
  expect(screen.getByRole("alert")).toHaveTextContent("Enter the question text.");
  expect(api.editQuestion).not.toHaveBeenCalled();
});

it("server rejection keeps the dialog open with the message", async () => {
  api.editQuestion.mockImplementation(async () => {
    throw new ApiError(409, "DRAFT_LOCKED", "This paper is already accepted.");
  });
  open();
  await save();
  expect(screen.getByRole("alert")).toHaveTextContent("This paper is already accepted.");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("validateEdit mirrors the backend rules", () => {
  const ok = { text: "x", options: ["a", "b", "c", "d"], answer: 0, why: "w" };
  expect(validateEdit(ok)).toBeUndefined();
  expect(validateEdit({ ...ok, options: ["a", "A", "c", "d"] })).toMatch(/different/);
  expect(validateEdit({ ...ok, options: ["a", "", "c", "d"] })).toMatch(/four options/);
  expect(validateEdit({ ...ok, why: " " })).toMatch(/why/i);
});
