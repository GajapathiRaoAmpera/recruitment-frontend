// FR-13/FR-14, AC-5: HR asks the AI for 1-3 coding drafts: validation, a locked loading state, partial success and errors.
// fetch is stubbed; POST /questions/generate can be held open to check the loading state.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: null }));

import { GenerateDialog, LOADING_TEXT } from "./generate-dialog";

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
const draft = (id: string, body: string) => ({ id, kind: "coding", body, difficulty: "easy", tags: [], marks: "10.00", approved: false, created_by: "u1", created_at: "2026-01-01T00:00:00Z", reference_solution: "print(1)", reference_language: "python", test_cases: [] });

let fetchMock: ReturnType<typeof vi.fn>;
const onClose = vi.fn();
const onGenerated = vi.fn();
const onReview = vi.fn();

beforeEach(() => {
  [onClose, onGenerated, onReview].forEach((f) => f.mockReset());
  fetchMock = vi.fn(async () => json(201, { created: [draft("n1", "Reverse words\nReverse each word.")], failed: [] }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const view = () => render(<GenerateDialog onClose={onClose} onGenerated={onGenerated} onReview={onReview} />);
const dialog = () => within(screen.getByRole("dialog", { name: "Generate with AI" }));
const generateBtn = () => dialog().getByRole("button", { name: /Generat/ });
const sent = () => JSON.parse(String(fetchMock.mock.calls[0]![1].body));

it("starts at easy, 1 question, 10 marks and validates topic, tags and marks", () => {
  view();
  expect(dialog().getByRole("combobox", { name: "Difficulty" })).toHaveValue("easy");
  expect(dialog().getByRole("combobox", { name: "How many" })).toHaveValue("1");
  expect(dialog().getByRole("spinbutton", { name: "Marks each" })).toHaveValue(10);
  expect(generateBtn()).toBeEnabled();

  fireEvent.change(dialog().getByRole("textbox", { name: "Topic (optional)" }), { target: { value: "x".repeat(201) } });
  expect(generateBtn()).toBeDisabled();
  expect(dialog().getByText(/keep the topic to 200 characters/)).toBeInTheDocument();
  fireEvent.change(dialog().getByRole("textbox", { name: "Topic (optional)" }), { target: { value: "strings" } });

  fireEvent.change(dialog().getByRole("textbox", { name: "Tags (optional)" }), { target: { value: Array.from({ length: 11 }, (_, i) => `t${i}`).join(",") } });
  expect(dialog().getByText(/at most 10 tags/)).toBeInTheDocument();
  expect(generateBtn()).toBeDisabled();
  fireEvent.change(dialog().getByRole("textbox", { name: "Tags (optional)" }), { target: { value: "a, b" } });

  fireEvent.change(dialog().getByRole("spinbutton", { name: "Marks each" }), { target: { value: "0" } });
  expect(dialog().getByText(/set marks above 0 and at most 999/)).toBeInTheDocument();
  expect(generateBtn()).toBeDisabled();
  fireEvent.change(dialog().getByRole("spinbutton", { name: "Marks each" }), { target: { value: "12.5" } });
  expect(generateBtn()).toBeEnabled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("locks the dialog while generating, sends one request, then shows the result", async () => {
  let finish!: (r: unknown) => void;
  fetchMock.mockImplementation(() => new Promise((res) => (finish = res)));
  view();
  fireEvent.change(dialog().getByRole("combobox", { name: "Difficulty" }), { target: { value: "advanced" } });
  fireEvent.change(dialog().getByRole("combobox", { name: "How many" }), { target: { value: "3" } });
  fireEvent.change(dialog().getByRole("textbox", { name: "Topic (optional)" }), { target: { value: "  graphs " } });
  fireEvent.change(dialog().getByRole("textbox", { name: "Tags (optional)" }), { target: { value: "bfs, bfs, dfs" } });
  fireEvent.click(generateBtn());
  fireEvent.click(generateBtn()); // double click

  expect(dialog().getByText(LOADING_TEXT)).toBeInTheDocument();
  expect(dialog().getByText(/Elapsed 0:00/)).toBeInTheDocument();
  expect(generateBtn()).toBeDisabled();
  expect(generateBtn()).toHaveTextContent("Generating…");
  expect(dialog().getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(dialog().getByRole("combobox", { name: "Difficulty" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  fireEvent.click(dialog().getByRole("button", { name: "Close" }));
  expect(onClose).not.toHaveBeenCalled(); // locked until the request finishes
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(sent()).toEqual({ difficulty: "advanced", topic: "graphs", tags: ["bfs", "dfs"], marks: 10, count: 3 });
  expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);

  await act(async () => finish(json(201, { created: [draft("n1", "Shortest path\n…")], failed: [] })));
  expect(await dialog().findByText("1 created, 0 failed")).toBeInTheDocument();
  expect(onGenerated).toHaveBeenCalledTimes(1);
});

it("shows a partial success: what was created (with Review) and why the rest failed", async () => {
  fetchMock.mockResolvedValue(json(201, { created: [draft("n1", "Reverse words\nReverse each word.")], failed: [{ index: 1, reason: "The reference solution printed the same output for every input" }] }));
  view();
  fireEvent.change(dialog().getByRole("combobox", { name: "How many" }), { target: { value: "2" } });
  fireEvent.click(generateBtn());
  const status = (await dialog().findByText("1 created, 1 failed")).closest("[role=status]") as HTMLElement;
  expect(within(status).getByRole("list", { name: "Created drafts" })).toHaveTextContent("Reverse words");
  expect(within(status).getByRole("list", { name: "Failed questions" })).toHaveTextContent("Question 2: The reference solution printed the same output for every input.");
  expect(status).toHaveTextContent("Drafts are saved as not approved.");
  expect(onGenerated).toHaveBeenCalledTimes(1);
  fireEvent.click(within(status).getByRole("button", { name: "Review Reverse words" }));
  expect(onReview).toHaveBeenCalledWith("n1");

  fireEvent.click(dialog().getByRole("button", { name: "Generate more" }));
  expect(generateBtn()).toBeEnabled();
});

it.each([
  [503, "AI_PROVIDER_NOT_CONFIGURED", {}, /AI generation isn't set up on the server/],
  [503, "EXECUTION_UNAVAILABLE", {}, /code runner \(Judge0\) is down/],
  [502, "AI_BAD_OUTPUT", { failed: [{ index: 0, reason: "invalid JSON from the model" }] }, /nothing was saved\. Question 1: invalid JSON from the model\. Try again/],
  [502, "AI_PROVIDER_ERROR", {}, /AI provider failed for every question/],
  [429, "AI_PROVIDER_RATE_LIMITED", {}, /busy \(rate limited\)/],
  [422, "VALIDATION_ERROR", { errors: [{ loc: ["body", "count"], msg: "Input should be less than or equal to 3" }] }, /Some fields need fixing.*\(Input should be less than or equal to 3\)/],
])("shows a clear message for %s %s and stays open", async (status, code, details, msg) => {
  fetchMock.mockResolvedValue(json(status, { error: { code, message: "raw", details } }));
  view();
  fireEvent.click(generateBtn());
  expect(await dialog().findByRole("alert")).toHaveTextContent(msg);
  expect(generateBtn()).toBeEnabled(); // can try again
  expect(onClose).not.toHaveBeenCalled();
});

it("on timeout says so and reloads the bank (drafts may have been saved)", async () => {
  fetchMock.mockRejectedValue(new DOMException("signal timed out", "TimeoutError"));
  view();
  fireEvent.click(generateBtn());
  expect(await dialog().findByRole("alert")).toHaveTextContent(/No answer after almost 3 minutes.*reloaded/);
  await waitFor(() => expect(onGenerated).toHaveBeenCalledTimes(1));
});
