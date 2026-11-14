// FR-13/FR-14, AC-5: HR writes a coding question; Save needs 3 sample + 15 hidden cases with an expected output each.
// fetch is stubbed with a small fake of /questions.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: false }));
const editorRenders = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/features/test-runner/code-editor", () => ({
  CodeEditor: ({ value, label, readOnly }: { value: string; label: string; readOnly?: boolean }) => {
    editorRenders.n++;
    return <textarea aria-label={label} value={value} readOnly={readOnly} onChange={() => {}} />;
  },
}));

import { QuestionForm } from "./question-form";

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
const SUMMARY = { id: "q1", kind: "coding", body: "Sum two numbers\nRead a and b.", difficulty: "easy", tags: ["math"], marks: "10.00", approved: true, created_by: "u1", created_at: "2026-01-01T00:00:00Z" };
const wireCases = () => [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, input: `${i} ${i}`, expected: String(2 * i), is_sample: true, position: i + 1 })),
  ...Array.from({ length: 15 }, (_, i) => ({ id: `h${i}`, input: `${i} 1`, expected: String(i + 1), is_sample: false, position: i + 4 })),
];
const pasteJson = (sample = 3, hidden = 15) =>
  JSON.stringify([
    ...Array.from({ length: sample }, (_, i) => ({ input: `${i}`, expected: `S${i}`, sample: true })),
    ...Array.from({ length: hidden }, (_, i) => ({ input: `${i}`, expected: `H${i}`, sample: false })),
  ]);

let fetchMock: ReturnType<typeof vi.fn>;
let reply: { status: number; body: unknown };
const onClose = vi.fn();
const onSaved = vi.fn();

beforeEach(() => {
  onClose.mockReset();
  onSaved.mockReset();
  reply = { status: 201, body: { ...SUMMARY, test_cases: wireCases() } };
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/v1/questions/q1" && !init?.method) return json(200, { ...SUMMARY, test_cases: wireCases() });
    return json(reply.status, reply.body);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const dialog = () => within(screen.getByRole("dialog"));
const createBtn = () => dialog().getByRole("button", { name: "Create question" });
const counter = () => dialog().getByText(/\d+\/3 sample, \d+\/15 hidden/);
const sentBody = (i = 0) => JSON.parse(String(fetchMock.mock.calls[i]![1].body));
const fill = (label: string, value: string) => fireEvent.change(dialog().getByRole("textbox", { name: label }), { target: { value } });
const paste = (text: string) => {
  fireEvent.click(dialog().getByRole("button", { name: "Paste cases as JSON" }));
  fill("Cases JSON", text);
  fireEvent.click(dialog().getByRole("button", { name: "Fill the 18 rows" }));
};

it("blocks Create until the statement and all 3 + 15 expected outputs are filled", () => {
  render(<QuestionForm onClose={onClose} onSaved={onSaved} />);
  expect(counter()).toHaveTextContent("0/3 sample, 0/15 hidden");
  expect(createBtn()).toBeDisabled();
  expect(dialog().getByText(/To save: write the statement · fill every expected output \(18 left\)/)).toBeInTheDocument();

  fill("Statement", "Sum two numbers\nRead a and b.");
  for (let i = 1; i <= 3; i++) fill(`Sample ${i} expected output`, String(i));
  for (let i = 1; i <= 14; i++) fill(`Hidden ${i} expected output`, String(i));
  expect(counter()).toHaveTextContent("3/3 sample, 14/15 hidden");
  expect(createBtn()).toBeDisabled();
  fill("Hidden 15 expected output", "   "); // blank doesn't count
  expect(createBtn()).toBeDisabled();
  fill("Hidden 15 expected output", "15");
  expect(counter()).toHaveTextContent("3/3 sample, 15/15 hidden");
  expect(createBtn()).toBeEnabled();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("pasted JSON fills the 18 rows, and Create sends them samples first", async () => {
  render(<QuestionForm onClose={onClose} onSaved={onSaved} />);
  fill("Statement", "  Sum two numbers\nRead a and b.  ");
  fill("Tags", "math, io, math");
  fireEvent.change(dialog().getByRole("spinbutton", { name: "Marks" }), { target: { value: "12.5" } });
  fireEvent.change(dialog().getByRole("combobox", { name: "Difficulty" }), { target: { value: "medium" } });
  paste(pasteJson());
  expect(counter()).toHaveTextContent("3/3 sample, 15/15 hidden");
  expect(dialog().getByRole("textbox", { name: "Hidden 15 expected output" })).toHaveValue("H14");
  fireEvent.click(createBtn());
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "q1" }), true));
  expect(onClose).toHaveBeenCalled();
  const body = sentBody();
  expect([fetchMock.mock.calls[0]![0], fetchMock.mock.calls[0]![1].method]).toEqual(["/api/v1/questions", "POST"]);
  expect(body).toMatchObject({ kind: "coding", body: "Sum two numbers\nRead a and b.", difficulty: "medium", marks: 12.5, tags: ["math", "io"] });
  expect(body.test_cases).toHaveLength(18);
  expect(body.test_cases[0]).toEqual({ input: "0", expected: "S0", is_sample: true });
  expect(body.test_cases[3]).toEqual({ input: "0", expected: "H0", is_sample: false });
});

it.each([
  ["invalid JSON", "[{", /That isn't valid JSON/],
  ["wrong counts", pasteJson(2, 15), /Found 2 sample and 15 hidden cases/],
])("shows a clear paste error for %s and keeps the rows", (_, text, msg) => {
  render(<QuestionForm onClose={onClose} onSaved={onSaved} />);
  paste(text);
  expect(dialog().getByRole("alert")).toHaveTextContent(msg);
  expect(counter()).toHaveTextContent("0/3 sample, 0/15 hidden");
});

it("puts a 422 VALIDATION_ERROR on the right fields and case row", async () => {
  reply = {
    status: 422,
    body: {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request is invalid",
        details: { errors: [{ loc: ["body", "marks"], msg: "Input should be less than or equal to 999" }, { loc: ["body", "test_cases", 4, "expected"], msg: "Value error, expected output must not be blank" }] },
      },
    },
  };
  render(<QuestionForm onClose={onClose} onSaved={onSaved} />);
  fill("Statement", "Sum");
  paste(pasteJson());
  fireEvent.click(createBtn());
  expect(await dialog().findByText("Input should be less than or equal to 999")).toBeInTheDocument();
  const hidden2 = dialog().getByRole("textbox", { name: "Hidden 2 expected output" }); // index 4 = 3 samples + hidden #2
  expect(hidden2).toHaveAttribute("aria-invalid", "true");
  expect(hidden2.parentElement).toHaveTextContent("expected output must not be blank");
  expect(dialog().getByText(/Some fields need fixing/)).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

it("edit: loads the question and sends only what changed", async () => {
  reply = { status: 200, body: { ...SUMMARY, marks: "15.00", test_cases: wireCases() } };
  render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
  const marks = await screen.findByRole("spinbutton", { name: "Marks" });
  expect(marks).toHaveValue(10);
  expect(counter()).toHaveTextContent("3/3 sample, 15/15 hidden");
  expect(dialog().getByRole("textbox", { name: "Sample 2 input" })).toHaveValue("1 1");
  fireEvent.change(marks, { target: { value: "15" } });
  fireEvent.click(dialog().getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ marks: 15 }), false));
  const patch = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")!;
  expect(patch[0]).toBe("/api/v1/questions/q1");
  expect(JSON.parse(String(patch[1].body))).toEqual({ marks: 15 }); // no test_cases: a question in use still takes a marks fix
});

it("edit: QUESTION_IN_USE explains that the cases can't change", async () => {
  reply = { status: 409, body: { error: { code: "QUESTION_IN_USE", message: "raw", details: {} } } };
  render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
  await screen.findByRole("spinbutton", { name: "Marks" });
  fill("Hidden 1 expected output", "changed");
  fireEvent.click(dialog().getByRole("button", { name: "Save changes" }));
  expect(await dialog().findByRole("alert")).toHaveTextContent(/already answered this question, so its test cases can't change/);
  const patch = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")!;
  expect(Object.keys(JSON.parse(String(patch[1].body)))).toEqual(["test_cases"]);
  expect(onSaved).not.toHaveBeenCalled();
});

describe("AI draft review", () => {
  const DRAFT = { ...SUMMARY, id: "d1", approved: false, reference_solution: "a, b = map(int, input().split())\nprint(a + b)", reference_language: "python", test_cases: wireCases() };
  beforeEach(() => {
    editorRenders.n = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/questions/d1" && !init?.method) return json(200, DRAFT);
      if (url === "/api/v1/questions/q1" && !init?.method) return json(200, { ...SUMMARY, reference_solution: null, reference_language: null, test_cases: wireCases() });
      if (url === "/api/v1/questions/d1" && init?.method === "PATCH") return json(200, { ...DRAFT, ...JSON.parse(String(init.body)), marks: "15.00" });
      return json(404, { error: { code: "NOT_FOUND", message: "no route" } });
    });
  });
  const patchBody = () => JSON.parse(String(fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH")![1].body));

  it("shows the draft badges, the note and the reference solution only on request (lazy editor)", async () => {
    render(<QuestionForm questionId="d1" onClose={onClose} onSaved={onSaved} />);
    expect(await screen.findByRole("dialog", { name: "Review AI draft" })).toBeInTheDocument();
    await screen.findByRole("spinbutton", { name: "Marks" });
    expect(dialog().getByText("Draft (AI)")).toBeInTheDocument();
    expect(dialog().getByText("Not approved")).toBeInTheDocument();
    expect(dialog().getByText(/Expected outputs came from running the reference solution\. If you change an input, update its expected output yourself\./)).toBeInTheDocument();
    expect(editorRenders.n).toBe(0);
    fireEvent.click(dialog().getByRole("button", { name: "Show reference solution" }));
    const code = dialog().getByRole("textbox", { name: "Reference solution" });
    expect(code).toHaveValue("a, b = map(int, input().split())\nprint(a + b)");
    expect(code).toHaveAttribute("readonly");
    fireEvent.click(dialog().getByRole("button", { name: "Hide reference solution" }));
    expect(dialog().queryByRole("textbox", { name: "Reference solution" })).not.toBeInTheDocument();
  });

  it("Approve sends PATCH {approved: true}", async () => {
    render(<QuestionForm questionId="d1" onClose={onClose} onSaved={onSaved} />);
    await screen.findByRole("spinbutton", { name: "Marks" });
    fireEvent.click(dialog().getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "d1", approved: true }), false));
    expect(patchBody()).toEqual({ approved: true });
    expect(onClose).toHaveBeenCalled();
  });

  it("with edits the button reads Save & approve and sends both in one PATCH", async () => {
    render(<QuestionForm questionId="d1" onClose={onClose} onSaved={onSaved} />);
    fireEvent.change(await screen.findByRole("spinbutton", { name: "Marks" }), { target: { value: "15" } });
    fireEvent.click(dialog().getByRole("button", { name: "Save & approve" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(patchBody()).toEqual({ marks: 15, approved: true });
  });

  it("an approved question has no Approve button", async () => {
    render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
    await screen.findByRole("spinbutton", { name: "Marks" });
    expect(screen.getByRole("dialog", { name: "Edit coding question" })).toBeInTheDocument();
    expect(dialog().queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
    expect(dialog().queryByText("Draft (AI)")).not.toBeInTheDocument();
  });
});
