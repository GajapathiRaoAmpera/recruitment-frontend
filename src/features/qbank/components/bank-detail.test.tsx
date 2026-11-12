import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";

const api = vi.hoisted(() => ({
  getBank: vi.fn(),
  listBankQuestions: vi.fn(),
  setApproval: vi.fn(),
  editBankQuestion: vi.fn(),
  downloadBankFile: vi.fn(),
  deleteBank: vi.fn(),
  replaceBankFile: vi.fn(),
}));
vi.mock("@/api/qbank", () => api);
vi.mock("@/api/papers", () => ({ editQuestion: vi.fn() }));

import { ToastProvider } from "@/components/ui/toast";
import type { BankDetail as Detail, BankQuestion } from "@/features/qbank/types";
import { BankDetail, PAGE_SIZE } from "./bank-detail";

const detail = (patch: Partial<Detail> = {}): Detail => ({
  id: "b1", name: "Core CS", filename: "core.pdf", sha256: "x", track: "it", notes: null, status: "ready", isActive: true, uploadedBy: "u1",
  embeddingStatus: "done", createdAt: "c", updatedAt: "u", questionCount: 45, approvedCount: 3, canManage: true,
  report: { total: 45, bySubject: { "Operating Systems": 45 }, byLevel: { easy: 45 }, warnings: ["Q7: answer key letter missing"], skipped: ["page 3: stray text"] },
  counts: { "Operating Systems": { easy: { total: 40, approved: 3 } }, "Computer Networks": { medium: { total: 5, approved: 0 } } },
  ...patch,
});
const question = (patch: Partial<BankQuestion> = {}): BankQuestion => ({
  id: "q1", sourceId: "b1", subject: "Operating Systems", topic: "scheduling", level: "easy", text: "Which scheduler is preemptive?",
  options: ["FCFS", "Round robin", "SJF (non-preemptive)", "None"], answer: 1, explanation: null, approved: false, warnings: [], sourceNumber: 1, createdAt: "c",
  ...patch,
});
const qpage = (items: BankQuestion[], total = items.length) => ({ items, total, page: 1, pageSize: PAGE_SIZE });
const renderDetail = () =>
  render(
    <ToastProvider>
      <BankDetail id="b1" />
    </ToastProvider>,
  );

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.getBank.mockResolvedValue(detail());
  api.listBankQuestions.mockResolvedValue(qpage([question()]));
});

it("shows the summary table, a readable parse report and the questions", async () => {
  renderDetail();
  expect(await screen.findByRole("heading", { name: "Core CS" })).toBeInTheDocument();
  const table = screen.getByRole("table");
  expect(within(table).getByRole("row", { name: /operating systems/i })).toHaveTextContent("3 / 40");
  expect(screen.getByText("Q7: answer key letter missing")).toBeInTheDocument();
  expect(screen.getByText("page 3: stray text")).toBeInTheDocument();
  expect(await screen.findByText("Which scheduler is preemptive?")).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Bank questions" })).getByText("Not approved")).toBeInTheDocument();
  expect(screen.getByText("No explanation in the PDF.")).toBeInTheDocument();
});

it("filters go to the API and reset to page 1", async () => {
  renderDetail();
  await screen.findByText("Which scheduler is preemptive?");
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Operating Systems" } });
  fireEvent.change(screen.getByLabelText("Level"), { target: { value: "easy" } });
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "false" } });
  await waitFor(() =>
    expect(api.listBankQuestions).toHaveBeenLastCalledWith("b1", { subject: "Operating Systems", level: "easy", approved: false, page: 1, pageSize: PAGE_SIZE }),
  );
});

it("pagination", async () => {
  api.listBankQuestions.mockResolvedValue(qpage([question()], 45));
  renderDetail();
  expect(await screen.findByText(/page 1 of 3 · 45 questions/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(api.listBankQuestions).toHaveBeenLastCalledWith("b1", expect.objectContaining({ page: 2 })));
});

it("approve scopes send the right payloads", async () => {
  api.setApproval.mockResolvedValue({ changed: 1, questionCount: 45, approvedCount: 4 });
  renderDetail();
  await screen.findByText("Which scheduler is preemptive?");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Approve all clean" })));
  expect(api.setApproval).toHaveBeenLastCalledWith("b1", { approved: true, scope: "all_clean" });

  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Operating Systems" } });
  await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Approve Operating Systems" })));
  expect(api.setApproval).toHaveBeenLastCalledWith("b1", { approved: true, scope: "subject", subject: "Operating Systems" });

  await act(async () => fireEvent.click(await screen.findByRole("button", { name: "Approve" })));
  expect(api.setApproval).toHaveBeenLastCalledWith("b1", { approved: true, scope: "ids", questionIds: ["q1"] });

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Unapprove all" })));
  expect(api.setApproval).toHaveBeenLastCalledWith("b1", { approved: false, scope: "all_clean" });
});

it("edit validates like the paper editor and saves to the bank", async () => {
  api.editBankQuestion.mockResolvedValue(question());
  renderDetail();
  fireEvent.click(await screen.findByRole("button", { name: "Edit question 1" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent(/papers already generated keep their own copy/i);
  await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Save question" })));
  expect(within(dialog).getByRole("alert")).toHaveTextContent(/explain why/i); // the PDF had no explanation
  expect(api.editBankQuestion).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByLabelText(/why this is correct/i), { target: { value: "Round robin preempts on time slices." } });
  await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Save question" })));
  expect(api.editBankQuestion).toHaveBeenCalledWith("b1", "q1", expect.objectContaining({ answer: 1, why: "Round robin preempts on time slices." }));
});

it("non-owner sees a read-only bank", async () => {
  api.getBank.mockResolvedValue(detail({ canManage: false, embeddingStatus: "skipped" }));
  renderDetail();
  expect(await screen.findByText(/read only/i)).toBeInTheDocument();
  expect(screen.getAllByText(/has no search index/i).length).toBeGreaterThan(0);
  await screen.findByText("Which scheduler is preemptive?");
  expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /edit question/i })).not.toBeInTheDocument();
});

it("missing bank shows not found", async () => {
  api.getBank.mockRejectedValue(new ApiError(404, "NOT_FOUND", "Question bank not found"));
  renderDetail();
  expect(await screen.findByText("Question bank not found")).toBeInTheDocument();
});
