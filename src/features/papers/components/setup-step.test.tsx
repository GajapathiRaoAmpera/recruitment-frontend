import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";

const api = vi.hoisted(() => ({ aiStatus: vi.fn(), createDraft: vi.fn() }));
const qbank = vi.hoisted(() => ({ getAvailability: vi.fn() }));
const auth = vi.hoisted(() => ({ configured: true }));
vi.mock("@/api/papers", () => api);
vi.mock("@/api/qbank", () => qbank);
vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return auth.configured ? {} : null;
  },
}));

import { balance } from "./mix-editor";
import { SetupStep } from "./setup-step";

const drives = [
  { id: "d1", label: "SDE — ABC College" },
  { id: "d2", label: "Analyst — XYZ College" },
];
const create = () => screen.getByRole("button", { name: /create and generate/i });
const renderSetup = (onCreated = vi.fn()) => {
  render(<SetupStep drives={drives} initialDrive="d2" onCreated={onCreated} />);
  return onCreated;
};

beforeEach(() => {
  auth.configured = true;
  api.aiStatus.mockReset().mockResolvedValue({ gemini: true, groq: true });
  api.createDraft.mockReset();
  qbank.getAvailability.mockReset().mockResolvedValue(stock(40));
});

const SUBJECTS = ["Computer Networks", "Operating Systems"];
/** `n` approved questions per subject and level. */
const stock = (n: number) => ({
  track: "it",
  subjects: Object.fromEntries(SUBJECTS.map((sub) => [sub, { easy: n, medium: n, advanced: n }])),
  byLevel: { easy: 2 * n, medium: 2 * n, advanced: 2 * n },
  total: 6 * n,
});

it("track toggle is a radiogroup operable by arrow keys", async () => {
  renderSetup();
  const group = screen.getByRole("radiogroup", { name: "Track" });
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

it("IT needs only Gemini; Non-IT also needs Groq", async () => {
  api.aiStatus.mockResolvedValue({ gemini: true, groq: false });
  renderSetup();
  await waitFor(() => expect(create()).toBeEnabled()); // IT: no Groq needed
  fireEvent.click(screen.getByRole("radio", { name: "Non-IT" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/missing api key for groq/i);
  expect(create()).toBeDisabled();
});

it("IT without a Gemini key is blocked", async () => {
  api.aiStatus.mockResolvedValue({ gemini: false, groq: true });
  renderSetup();
  expect(await screen.findByRole("alert")).toHaveTextContent(/missing api key for gemini \(picks the sample paper\)/i);
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

it("shows bank availability per level and blocks create when the banks are short", async () => {
  qbank.getAvailability.mockResolvedValue(stock(4)); // 8 per level; defaults need 6 / 7 / 4 technical
  renderSetup();
  const table = await screen.findByRole("table", { name: /needed vs approved/i });
  expect(table).toHaveTextContent(/Medium\s*7\s*8/);
  await waitFor(() => expect(create()).toBeEnabled());
  fireEvent.change(screen.getByLabelText("Medium"), { target: { value: "40" } }); // medium technical 12
  expect(screen.getByText(/banks are short of approved technical questions \(medium 4\)/i)).toBeInTheDocument();
  expect(create()).toBeDisabled();
});

it("empty banks link to the question banks page", async () => {
  qbank.getAvailability.mockResolvedValue({ track: "it", subjects: {}, byLevel: { easy: 0, medium: 0, advanced: 0 }, total: 0 });
  renderSetup();
  expect(await screen.findByRole("link", { name: /upload a bank or approve/i })).toHaveAttribute("href", "/hr/question-banks");
  expect(create()).toBeDisabled();
});

it("subject mix: even split by default, custom weights must total 100 and are sent with the focus", async () => {
  api.createDraft.mockResolvedValue({ id: "p-1" });
  renderSetup();
  const even = await screen.findByRole("checkbox", { name: /even split across subjects/i });
  expect(even).toBeChecked();
  fireEvent.click(even);
  expect(screen.getByLabelText("Operating Systems %")).toHaveValue(50);
  fireEvent.change(screen.getByLabelText("Operating Systems %"), { target: { value: "70" } });
  expect(screen.getByText(/subjects total 120%/i)).toBeInTheDocument();
  await waitFor(() => expect(create()).toBeDisabled());
  fireEvent.change(screen.getByLabelText("Computer Networks %"), { target: { value: "30" } });
  fireEvent.change(screen.getByLabelText(/focus/i), { target: { value: "  process scheduling  " } });
  await waitFor(() => expect(create()).toBeEnabled());
  await act(async () => fireEvent.click(create()));
  expect(api.createDraft).toHaveBeenCalledWith(
    expect.objectContaining({ settings: expect.objectContaining({ subjects: { "Computer Networks": 30, "Operating Systems": 70 }, focus: "process scheduling" }) }),
  );
});

it("Non-IT sends no subjects or focus", async () => {
  api.createDraft.mockResolvedValue({ id: "p-1" });
  renderSetup();
  fireEvent.click(screen.getByRole("radio", { name: "Non-IT" }));
  expect(screen.queryByLabelText(/focus/i)).not.toBeInTheDocument();
  await waitFor(() => expect(create()).toBeEnabled());
  await act(async () => fireEvent.click(create()));
  expect(api.createDraft).toHaveBeenCalledWith(expect.objectContaining({ settings: expect.objectContaining({ track: "non_it", subjects: null, focus: null }) }));
});

it("bank load error offers a retry and blocks create", async () => {
  qbank.getAvailability.mockRejectedValueOnce(new ApiError(500, "INTERNAL", "down")).mockResolvedValue(stock(40));
  renderSetup();
  expect(await screen.findByText(/could not load the question banks: down/i)).toBeInTheDocument();
  expect(create()).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: /try again/i }));
  await waitFor(() => expect(create()).toBeEnabled());
});

it("level counts stop at the backend limit of 100", () => {
  renderSetup();
  fireEvent.change(screen.getByLabelText("Easy"), { target: { value: "150" } });
  expect(screen.getByLabelText("Easy")).toHaveValue(100);
  expect(screen.getByRole("button", { name: "Increase Easy" })).toBeDisabled();
});
