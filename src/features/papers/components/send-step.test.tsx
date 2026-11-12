import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ sendPapers: vi.fn() }));
vi.mock("@/api/papers", () => api);
vi.mock("@/features/papers/use-drive-candidates", () => ({
  useDriveCandidates: () => [
    { id: "c1", name: "Asha Rao", studentId: "S1", branch: "CSE", cgpa: 8.2, email: "a@x.in" },
    { id: "c2", name: "Bala K", studentId: "S2", branch: "ECE", cgpa: 7.5, email: "b@x.in" },
    { id: "c3", name: "Chitra M", studentId: "S3", branch: "CSE", cgpa: 9.1, email: "c@x.in" },
  ],
}));

import { ToastProvider } from "@/components/ui/toast";
import type { DraftDetail } from "@/features/papers/types";
import { SendStep } from "./send-step";

const draft = (patch: Partial<DraftDetail> = {}) => ({ id: "p-1", driveRef: "d1", status: "accepted", issues: [], ...patch }) as DraftDetail;
const renderSend = (d = draft(), onSent = vi.fn()) => {
  render(
    <ToastProvider>
      <SendStep draft={d} onSent={onSent} />
    </ToastProvider>,
  );
  return onSent;
};
const sendBtn = () => screen.getByRole("button", { name: /send to \d+ selected/i });

beforeEach(() => {
  api.sendPapers.mockReset();
});

it("select all selects only filtered rows", () => {
  renderSend();
  fireEvent.change(screen.getByLabelText("Search candidates"), { target: { value: "cse" } });
  fireEvent.click(screen.getByLabelText("Select all shown"));
  fireEvent.change(screen.getByLabelText("Search candidates"), { target: { value: "" } });
  expect(screen.getByLabelText("Select Asha Rao")).toBeChecked();
  expect(screen.getByLabelText("Select Chitra M")).toBeChecked();
  expect(screen.getByLabelText("Select Bala K")).not.toBeChecked();
  expect(sendBtn()).toHaveTextContent("Send to 2 selected");
});

it("send disabled until accepted and a candidate is selected", () => {
  renderSend(draft({ status: "draft" }));
  fireEvent.click(screen.getByLabelText("Select Asha Rao"));
  expect(sendBtn()).toBeDisabled();
  expect(screen.getByText(/accept the paper before sending/i)).toBeInTheDocument();
});

it("send is enabled once accepted with a selection, after confirm", async () => {
  api.sendPapers.mockResolvedValue({ sent: 1, alreadySent: 0 });
  const onSent = renderSend();
  expect(sendBtn()).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Select Bala K"));
  fireEvent.click(sendBtn());
  expect(api.sendPapers).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Send paper" })));
  expect(api.sendPapers).toHaveBeenCalledWith("p-1", ["c2"]);
  expect(onSent).toHaveBeenCalled();
  expect(await screen.findByText("Sent to 1 candidate")).toBeInTheDocument();
});

it("already-sent candidates labelled and not an error", async () => {
  api.sendPapers.mockResolvedValue({ sent: 1, alreadySent: 1 });
  renderSend(draft({ issues: [{ candidateRef: "c1", issuedAt: "2026-11-12T00:00:00Z" }] }));
  expect(within(screen.getByLabelText("Select Asha Rao").closest("tr")!).getByText("Sent")).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText("Select Asha Rao"));
  fireEvent.click(screen.getByLabelText("Select Bala K"));
  fireEvent.click(sendBtn());
  await act(async () => fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Send paper" })));
  const toast = await screen.findByText("Sent to 1 candidate");
  expect(toast.closest("[role]")).toHaveAttribute("role", "status");
  expect(screen.getByText(/1 already had this paper/)).toBeInTheDocument();
});
