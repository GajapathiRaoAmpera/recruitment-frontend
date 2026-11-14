// FR-13/FR-14, AC-5: HR picks the mode of a coding question and edits its function signature.
// The API is mocked with MSW at the HTTP level; the request bodies checked here are what reaches the server (snake_case).
// Contract: ../recruitment-backend/docs/04-api-contracts.md, POST/PATCH /questions + "Function-mode coding questions".
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: false }));
vi.mock("@/features/test-runner/code-editor", () => ({
  CodeEditor: ({ value, label }: { value: string; label: string }) => <textarea aria-label={label} value={value} readOnly />,
}));

import { QuestionForm } from "./question-form";

const SIGNATURE = { function_name: "twoSum", parameters: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }], return_type: "int[]" };
const cases = () => [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, input: `[${i},1]\n${i + 1}\n`, expected: "[0,1]", is_sample: true, position: i + 1 })),
  ...Array.from({ length: 15 }, (_, i) => ({ id: `h${i}`, input: `[${i},2]\n${i + 2}\n`, expected: "[0,1]", is_sample: false, position: i + 4 })),
];
const question = (over: Record<string, unknown> = {}) => ({
  id: "q1",
  kind: "coding",
  body: "Two sum\nReturn the indices.",
  difficulty: "easy",
  tags: ["arrays"],
  marks: "10.00",
  approved: true,
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  reference_solution: null,
  reference_language: null,
  mode: "function",
  signature: SIGNATURE,
  test_cases: cases(),
  ...over,
});
/** Function-mode cases: one JSON value per line, one line per parameter. */
const pasteJson = JSON.stringify([
  ...Array.from({ length: 3 }, (_, i) => ({ input: `[${i},1]\n${i + 1}`, expected: "[0,1]", sample: true })),
  ...Array.from({ length: 15 }, (_, i) => ({ input: `[${i},2]\n${i + 2}`, expected: "[0,1]", sample: false })),
]);

const sent: { method: string; path: string; body: Record<string, unknown> }[] = [];
let stored: Record<string, unknown> = question();
const server = setupServer(
  http.get("*/api/v1/questions/:id", () => HttpResponse.json(stored)),
  http.post("*/api/v1/questions", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    sent.push({ method: "POST", path: "/questions", body });
    return HttpResponse.json(question(body), { status: 201 });
  }),
  http.patch("*/api/v1/questions/:id", async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    sent.push({ method: "PATCH", path: `/questions/${params.id}`, body });
    return HttpResponse.json({ ...stored, ...body });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  sent.length = 0;
  stored = question();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const onClose = vi.fn();
const onSaved = vi.fn();
const dialog = () => within(screen.getByRole("dialog"));
const fill = (name: string, value: string) => fireEvent.change(dialog().getByRole("textbox", { name }), { target: { value } });
const choose = (name: string, value: string) => fireEvent.change(dialog().getByRole("combobox", { name }), { target: { value } });
const paste = (text: string) => {
  fireEvent.click(dialog().getByRole("button", { name: "Paste cases as JSON" }));
  fill("Cases JSON", text);
  fireEvent.click(dialog().getByRole("button", { name: "Fill the 18 rows" }));
};

describe("create", () => {
  it("function mode: Create sends the mode and the signature HR typed", async () => {
    render(<QuestionForm onClose={onClose} onSaved={onSaved} />);
    fill("Statement", "Two sum\nReturn the indices of the two numbers that add up to target.");
    choose("Mode", "function");
    fill("Function name", "twoSum");
    fill("Parameter 1 name", "nums");
    choose("Parameter 1 type", "int[]");
    fireEvent.click(dialog().getByRole("button", { name: "Add parameter" }));
    fill("Parameter 2 name", "target");
    choose("Return type", "int[]");
    paste(pasteJson);
    expect(dialog().getByRole("textbox", { name: "Sample 1 input" })).toHaveAttribute("placeholder", "One JSON value per line, one line per parameter");

    fireEvent.click(dialog().getByRole("button", { name: "Create question" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "q1" }), true));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ method: "POST", path: "/questions" });
    expect(sent[0]!.body).toMatchObject({ kind: "coding", mode: "function", signature: SIGNATURE });
    expect((sent[0]!.body.test_cases as unknown[]).length).toBe(18);
  });

  it("function mode: Create stays off until the name and parameters follow the contract", () => {
    render(<QuestionForm onClose={onClose} onSaved={onSaved} />);
    fill("Statement", "Two sum\nReturn the indices.");
    paste(pasteJson);
    choose("Mode", "function");
    const create = dialog().getByRole("button", { name: "Create question" });
    expect(create).toBeDisabled();
    fill("Function name", "twosum"); // no capital letter
    fill("Parameter 1 name", "nums");
    expect(dialog().getByText(/lowerCamelCase with at least one capital letter/)).toBeInTheDocument();
    fill("Function name", "twoSum");
    fireEvent.click(dialog().getByRole("button", { name: "Add parameter" }));
    fill("Parameter 2 name", "nums"); // duplicate
    expect(dialog().getByText(/give each parameter a different name/)).toBeInTheDocument();
    expect(create).toBeDisabled();
    fireEvent.click(dialog().getByRole("button", { name: "Remove parameter 2" }));
    expect(create).toBeEnabled();
    expect(dialog().getByRole("button", { name: "Remove parameter 1" })).toBeDisabled(); // at least one stays
    expect(sent).toHaveLength(0);
  });

  it("stdin mode (the default) sends no mode or signature, as before", async () => {
    render(<QuestionForm onClose={onClose} onSaved={onSaved} />);
    expect(dialog().getByRole("combobox", { name: "Mode" })).toHaveValue("stdin");
    expect(dialog().queryByRole("textbox", { name: "Function name" })).not.toBeInTheDocument();
    fill("Statement", "Sum\nRead a and b.");
    paste(pasteJson);
    fireEvent.click(dialog().getByRole("button", { name: "Create question" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).not.toHaveProperty("mode");
    expect(sent[0]!.body).not.toHaveProperty("signature");
  });
});

describe("edit", () => {
  it("loads the stored signature and PATCHes only the changed signature", async () => {
    render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
    expect(await dialog().findByRole("textbox", { name: "Function name" })).toHaveValue("twoSum");
    expect(dialog().getByRole("textbox", { name: "Parameter 2 name" })).toHaveValue("target");
    choose("Return type", "int");
    fill("Parameter 2 name", "goal");
    fireEvent.click(dialog().getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ method: "PATCH", path: "/questions/q1" });
    expect(sent[0]!.body).toEqual({
      signature: { function_name: "twoSum", parameters: [{ name: "nums", type: "int[]" }, { name: "goal", type: "int" }], return_type: "int" },
    });
  });

  it("switching function → stdin sends only mode: stdin (the server clears the signature)", async () => {
    render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
    await dialog().findByRole("textbox", { name: "Function name" });
    choose("Mode", "stdin");
    expect(dialog().queryByRole("textbox", { name: "Function name" })).not.toBeInTheDocument();
    fireEvent.click(dialog().getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).toEqual({ mode: "stdin" });
  });

  it("switching stdin → function sends the mode with the signature", async () => {
    stored = question({ mode: "stdin", signature: null });
    render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
    await dialog().findByRole("combobox", { name: "Mode" });
    choose("Mode", "function");
    fill("Function name", "twoSum");
    fill("Parameter 1 name", "nums");
    choose("Parameter 1 type", "int[]");
    fireEvent.click(dialog().getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).toEqual({ mode: "function", signature: { function_name: "twoSum", parameters: [{ name: "nums", type: "int[]" }], return_type: "int" } });
  });
});

describe("states", () => {
  it("loading, then permission denied when the API answers 403", async () => {
    server.use(http.get("*/api/v1/questions/:id", () => HttpResponse.json({ error: { code: "FORBIDDEN", message: "no" } }, { status: 403 })));
    render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
    expect(dialog().getByRole("status")).toHaveTextContent("Loading question");
    expect(await dialog().findByText("You don't have access to this page")).toBeInTheDocument();
    expect(dialog().queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("load error offers a retry", async () => {
    server.use(http.get("*/api/v1/questions/:id", () => HttpResponse.json({ error: { code: "QUESTION_NOT_FOUND", message: "x" } }, { status: 404 })));
    render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
    expect(await dialog().findByText(/This question wasn't found/)).toBeInTheDocument();
    expect(dialog().getByRole("button", { name: /retry|try again/i })).toBeInTheDocument();
  });

  it("a 422 on the signature is shown under the signature", async () => {
    server.use(
      http.patch("*/api/v1/questions/:id", () =>
        HttpResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "x", details: { errors: [{ loc: ["body", "signature"], msg: "Value error, parameter name 'len' is reserved" }] } } },
          { status: 422 },
        ),
      ),
    );
    render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
    await dialog().findByRole("textbox", { name: "Function name" });
    fill("Parameter 2 name", "len");
    fireEvent.click(dialog().getByRole("button", { name: "Save changes" }));
    expect(await dialog().findByText("parameter name 'len' is reserved")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("a 403 on save says nothing was saved", async () => {
    server.use(http.patch("*/api/v1/questions/:id", () => HttpResponse.json({ error: { code: "FORBIDDEN", message: "no" } }, { status: 403 })));
    render(<QuestionForm questionId="q1" onClose={onClose} onSaved={onSaved} />);
    await dialog().findByRole("textbox", { name: "Function name" });
    choose("Return type", "int");
    fireEvent.click(dialog().getByRole("button", { name: "Save changes" }));
    expect(await dialog().findByText("You don't have permission to change this question. Nothing was saved.")).toBeInTheDocument();
  });
});
