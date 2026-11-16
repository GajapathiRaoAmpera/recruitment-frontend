import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";

const api = vi.hoisted(() => ({ aiStatus: vi.fn(), createDraft: vi.fn() }));
const auth = vi.hoisted(() => ({ configured: true }));
vi.mock("@/api/papers", () => api);
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  get liveApi() {
    return auth.configured;
  },
}));

import { balance } from "./mix-editor";
import { SetupStep } from "./setup-step";

const drives = [
  { id: "d1", label: "SDE — ABC College", role: "SDE" },
  { id: "d2", label: "Analyst — XYZ College", role: "Analyst" },
];
const create = () => screen.getByRole("button", { name: /create and generate/i });
const renderSetup = (onCreated = vi.fn()) => {
  render(<SetupStep drives={drives} initialDrive="d2" onCreated={onCreated} />);
  return onCreated;
};

beforeEach(() => {
  auth.configured = true;
  api.aiStatus.mockReset().mockResolvedValue({ nvidia: true });
  api.createDraft.mockReset();
});

it("track toggle is a radiogroup operable by arrow keys", async () => {
  renderSetup();
  // The form appears once the AI provider check is done (one loader before it).
  const group = await screen.findByRole("radiogroup", { name: "Track" });
  const it_ = screen.getByRole("radio", { name: "IT" });
  expect(group).toBeInTheDocument();
  expect(it_).toHaveAttribute("aria-checked", "true");
  fireEvent.keyDown(it_, { key: "ArrowRight" });
  const nonIt = screen.getByRole("radio", { name: "Non-IT" });
  expect(nonIt).toHaveAttribute("aria-checked", "true");
  expect(nonIt).toHaveFocus();
  expect(screen.getByLabelText("Soft skills %")).toBeInTheDocument();
  expect(screen.queryByText(/syntax vs concept/i)).not.toBeInTheDocument();
  await waitFor(() => expect(create()).toBeEnabled());
});

it("mix editor blocks submit unless total is 100", async () => {
  renderSetup();
  await waitFor(() => expect(create()).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Aptitude %"), { target: { value: "50" } });
  expect(screen.getByText(/total 110%/i)).toBeInTheDocument();
  expect(create()).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /balance to 100/i }));
  expect(screen.getByText(/total 100%/i)).toBeInTheDocument();
  expect(create()).toBeEnabled();
});

it("balance rescales to exactly 100 and splits zeros evenly", () => {
  expect(balance({ aptitude: 50, reasoning: 30, technical: 30 })).toEqual({ aptitude: 46, reasoning: 27, technical: 27 });
  expect(balance({ aptitude: 0, reasoning: 0, technical: 0 })).toEqual({ aptitude: 34, reasoning: 33, technical: 33 });
});

it("create disabled while counts total 0", async () => {
  renderSetup();
  await waitFor(() => expect(create()).toBeEnabled());
  for (const name of ["Easy", "Medium", "Advanced"]) fireEvent.change(screen.getByLabelText(name), { target: { value: "0" } });
  expect(create()).toBeDisabled();
  expect(screen.getByText("Add at least one question.")).toBeInTheDocument();
});

it("both tracks are blocked without the NVIDIA key", async () => {
  api.aiStatus.mockResolvedValue({ nvidia: false });
  renderSetup();
  expect(await screen.findByRole("alert")).toHaveTextContent(/missing nvidia api key/i);
  expect(create()).toBeDisabled();
  fireEvent.click(screen.getByRole("radio", { name: "Non-IT" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/missing nvidia api key/i);
  expect(create()).toBeDisabled();
});

it("shows permission state in prototype mode", () => {
  auth.configured = false;
  renderSetup();
  expect(screen.getByText(/needs a real sign-in/i)).toBeInTheDocument();
  expect(api.aiStatus).not.toHaveBeenCalled();
});

it("server 422 shown without losing form values", async () => {
  api.createDraft.mockRejectedValue(new ApiError(422, "VALIDATION_ERROR", "mix must sum to 100"));
  const onCreated = renderSetup();
  await waitFor(() => expect(create()).toBeEnabled());
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "My paper" } });
  await act(async () => fireEvent.click(create()));
  expect(await screen.findByText("mix must sum to 100")).toBeInTheDocument();
  expect(screen.getByLabelText(/title/i)).toHaveValue("My paper");
  expect(screen.getByLabelText(/drive/i)).toHaveValue("d2");
  expect(onCreated).not.toHaveBeenCalled();
  expect(api.createDraft).toHaveBeenCalledWith(expect.objectContaining({ driveRef: "d2", title: "My paper" }));
});

it("successful create hands the draft to the page", async () => {
  api.createDraft.mockResolvedValue({ id: "p-1" });
  const onCreated = renderSetup();
  await waitFor(() => expect(create()).toBeEnabled());
  await act(async () => fireEvent.click(create()));
  expect(onCreated).toHaveBeenCalledWith({ id: "p-1" });
});

it("role is pre-filled from the drive, required, and sent trimmed for both tracks", async () => {
  api.createDraft.mockResolvedValue({ id: "p-1" });
  renderSetup();
  const role = await screen.findByLabelText(/role/i);
  expect(role).toHaveValue("Analyst"); // initialDrive d2
  fireEvent.change(screen.getByLabelText(/drive/i), { target: { value: "d1" } });
  expect(role).toHaveValue("SDE");
  fireEvent.change(role, { target: { value: "   " } });
  expect(screen.getByText("Enter the role the Technical questions are for.")).toBeInTheDocument();
  expect(create()).toBeDisabled();
  fireEvent.change(role, { target: { value: "  Sales Executive " } });
  fireEvent.click(screen.getByRole("radio", { name: "Non-IT" }));
  await waitFor(() => expect(create()).toBeEnabled());
  await act(async () => fireEvent.click(create()));
  const sent = api.createDraft.mock.calls[0][0].settings;
  expect(sent).toMatchObject({ track: "non_it", role: "Sales Executive" });
  expect(sent).not.toHaveProperty("subjects"); // the PDF banks are no longer part of a paper
});

it("level counts stop at the backend limit of 100", async () => {
  renderSetup();
  fireEvent.change(await screen.findByLabelText("Easy"), { target: { value: "150" } });
  expect(screen.getByLabelText("Easy")).toHaveValue(100);
  expect(screen.getByRole("button", { name: "Increase Easy" })).toBeDisabled();
});
