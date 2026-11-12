import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";

const api = vi.hoisted(() => ({
  listBanks: vi.fn(),
  updateBank: vi.fn(),
  deleteBank: vi.fn(),
  uploadBank: vi.fn(),
  replaceBankFile: vi.fn(),
  downloadBankFile: vi.fn(),
}));
vi.mock("@/api/qbank", () => api);

import { ToastProvider } from "@/components/ui/toast";
import type { Bank } from "@/features/qbank/types";
import { BankList } from "./bank-list";
import { checkPdf, UploadDialog } from "./upload-dialog";

const bank = (patch: Partial<Bank> = {}): Bank => ({
  id: "b1", name: "Core CS", filename: "core.pdf", sha256: "x", track: "it", notes: null, status: "ready", isActive: true, uploadedBy: "u1",
  embeddingStatus: "done", createdAt: "2026-11-10T10:00:00Z", updatedAt: "2026-11-10T10:00:00Z", questionCount: 10, approvedCount: 4, canManage: true,
  ...patch,
});
const page = (items: Bank[]) => ({ items, total: items.length, page: 1, pageSize: 100 });
const renderList = (onUpload = vi.fn()) => {
  render(
    <ToastProvider>
      <BankList uploaderName={(id) => (id === "u1" ? "Priya HR" : id)} version={0} onUpload={onUpload} />
    </ToastProvider>,
  );
  return onUpload;
};

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset(); // block body: a returned value would run as teardown
});

it("loading state", () => {
  api.listBanks.mockReturnValue(new Promise(() => {}));
  renderList();
  expect(screen.getByRole("status")).toHaveTextContent(/loading question banks/i);
});

it("empty state asks for the first upload", async () => {
  api.listBanks.mockResolvedValue(page([]));
  const onUpload = renderList();
  expect(await screen.findByText("Upload your first question bank")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /upload pdf/i }));
  expect(onUpload).toHaveBeenCalled();
});

it("error state retries; 403 shows the permission state", async () => {
  api.listBanks.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "Server unavailable")).mockResolvedValue(page([bank()]));
  const { unmount } = render(
    <ToastProvider>
      <BankList uploaderName={String} version={0} onUpload={vi.fn()} />
    </ToastProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /try again/i }));
  expect(await screen.findByRole("link", { name: "Core CS" })).toHaveAttribute("href", "/hr/question-banks/b1");
  unmount();
  api.listBanks.mockRejectedValue(new ApiError(403, "FORBIDDEN", "no"));
  renderList();
  expect(await screen.findByText(/don't have access/i)).toBeInTheDocument();
});

it("cards show counts, embedding status and uploader; owner-only actions", async () => {
  api.listBanks.mockResolvedValue(page([bank(), bank({ id: "b2", name: "Other HR bank", canManage: false, embeddingStatus: "skipped", isActive: false })]));
  renderList();
  const mine = (await screen.findByRole("link", { name: "Core CS" })).closest("li")!;
  expect(within(mine).getByText("4 of 10 questions approved")).toBeInTheDocument();
  expect(within(mine).getByText(/by Priya HR/)).toBeInTheDocument();
  expect(within(mine).getByText("Search ready")).toBeInTheDocument();
  expect(within(mine).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  expect(within(mine).getByRole("checkbox", { name: /use in new papers/i })).toBeChecked();

  const other = screen.getByRole("link", { name: "Other HR bank" }).closest("li")!;
  expect(within(other).getByText("No search index")).toBeInTheDocument();
  expect(within(other).getByText("Inactive")).toBeInTheDocument();
  expect(within(other).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  expect(within(other).queryByRole("button", { name: /replace file/i })).not.toBeInTheDocument();
  expect(within(other).queryByRole("checkbox")).not.toBeInTheDocument();
  expect(within(other).getByRole("button", { name: /download other hr bank/i })).toBeInTheDocument(); // any HR can download
});

it("deactivate toggles is_active", async () => {
  api.listBanks.mockResolvedValue(page([bank()]));
  api.updateBank.mockResolvedValue({});
  renderList();
  const box = await screen.findByRole("checkbox", { name: /use in new papers/i });
  await act(async () => fireEvent.click(box));
  expect(api.updateBank).toHaveBeenCalledWith("b1", { isActive: false });
});

it("delete asks for confirmation that names sent papers as unaffected", async () => {
  api.listBanks.mockResolvedValue(page([bank()]));
  api.deleteBank.mockResolvedValue(undefined);
  renderList();
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  const dialog = screen.getByRole("alertdialog");
  expect(dialog).toHaveTextContent(/papers already sent are unaffected/i);
  expect(api.deleteBank).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Delete bank" })));
  expect(api.deleteBank).toHaveBeenCalledWith("b1");
  expect(api.listBanks).toHaveBeenCalledTimes(2); // reloaded
});

it("delete blocked by the server keeps the dialog open with the reason", async () => {
  api.listBanks.mockResolvedValue(page([bank()]));
  api.deleteBank.mockRejectedValue(new ApiError(409, "BANK_IN_USE", "Used by issued tests. Deactivate it instead."));
  renderList();
  fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete bank" })));
  expect(screen.getByRole("alertdialog")).toHaveTextContent(/deactivate it instead/i);
});

it("upload validates type and size on the client", () => {
  expect(checkPdf(undefined)).toMatch(/choose/i);
  expect(checkPdf(new File(["x"], "notes.docx", { type: "application/msword" }))).toMatch(/must be a pdf/i);
  const big = new File(["x"], "big.pdf", { type: "application/pdf" });
  Object.defineProperty(big, "size", { value: 21 * 1024 * 1024 });
  expect(checkPdf(big)).toMatch(/20 MB/);
  expect(checkPdf(new File(["%PDF"], "ok.pdf", { type: "application/pdf" }))).toBeUndefined();
});

it("upload dialog: blocks a non-PDF, sends a PDF, links a duplicate to the existing bank", async () => {
  const onUploaded = vi.fn();
  render(
    <ToastProvider>
      <UploadDialog onClose={vi.fn()} onUploaded={onUploaded} />
    </ToastProvider>,
  );
  const input = screen.getByLabelText(/pdf file/i);
  fireEvent.change(input, { target: { files: [new File(["x"], "a.txt", { type: "text/plain" })] } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /upload and read pdf/i })));
  expect(screen.getByRole("alert")).toHaveTextContent(/must be a pdf/i);
  expect(api.uploadBank).not.toHaveBeenCalled();

  api.uploadBank.mockRejectedValueOnce(new ApiError(409, "DUPLICATE_FILE", "Already uploaded as 'Core CS'.", { existing_id: "b1", existing_name: "Core CS" }));
  fireEvent.change(input, { target: { files: [new File(["%PDF"], "core_cs.pdf", { type: "application/pdf" })] } });
  expect(screen.getByLabelText(/^name/i)).toHaveValue("core_cs"); // filled from the file name
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /upload and read pdf/i })));
  expect(screen.getByRole("link", { name: /open the existing bank/i })).toHaveAttribute("href", "/hr/question-banks/b1");

  api.uploadBank.mockResolvedValueOnce(bank());
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /upload and read pdf/i })));
  expect(api.uploadBank).toHaveBeenLastCalledWith(expect.objectContaining({ name: "core_cs", track: "it" }));
  expect(onUploaded).toHaveBeenCalledWith(bank());
});
