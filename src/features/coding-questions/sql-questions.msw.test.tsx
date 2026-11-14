// FR-13/FR-14, AC-5: SQL coding questions on the HR side. HR only picks "SQL" when generating; a SQL question's schema,
// datasets and expected rows are read-only, and PATCH sends only {body, difficulty, tags, marks, approved}.
// The API is mocked with MSW at the HTTP level (no LLM, no Judge0); bodies checked here are what reaches the server.
// Contract: ../recruitment-backend/docs/04-api-contracts.md, /questions, /questions/generate, PATCH /questions/{id} + "SQL coding questions".
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: false }));
vi.mock("@/features/test-runner/code-editor", () => ({
  CodeEditor: ({ value, label }: { value: string; label: string }) => <textarea aria-label={label} value={value} readOnly />,
}));

import { getCodingQuestion } from "@/api/coding-questions";
import { GenerateDialog } from "./generate-dialog";
import { QuestionForm, SQL_NOTE } from "./question-form";

const SCHEMA = "CREATE TABLE emp (id INTEGER PRIMARY KEY, dept TEXT);";
const cases = () => [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, input: `INSERT INTO emp (id, dept) VALUES (${i + 1}, 'Eng');`, expected: "Eng|1\n", is_sample: true, position: i + 1 })),
  // A generated dataset may give no rows at all: still valid, and shown as "No rows".
  ...Array.from({ length: 15 }, (_, i) => ({ id: `h${i}`, input: `INSERT INTO emp (id, dept) VALUES (${i + 9}, 'HR');`, expected: i === 0 ? "" : "HR|1\n", is_sample: false, position: i + 4 })),
];
const sqlQuestion = (over: Record<string, unknown> = {}) => ({
  id: "q9",
  kind: "coding",
  body: "Headcount by department\nReturn each department and its number of employees.",
  difficulty: "medium",
  tags: ["sql"],
  marks: "10.00",
  approved: false,
  ai_generated: true,
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  reference_solution: "SELECT dept, COUNT(*) FROM emp GROUP BY dept ORDER BY dept;",
  reference_language: "sql",
  mode: "sql",
  signature: null,
  schema: SCHEMA,
  order_matters: true,
  test_cases: cases(),
  ...over,
});

const sent: { method: string; path: string; body: Record<string, unknown> }[] = [];
let stored: Record<string, unknown> = sqlQuestion();
const server = setupServer(
  http.get("*/api/v1/questions/:id", () => HttpResponse.json(stored)),
  http.patch("*/api/v1/questions/:id", async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    sent.push({ method: "PATCH", path: `/questions/${params.id}`, body });
    return HttpResponse.json({ ...stored, ...body });
  }),
  http.post("*/api/v1/questions/generate", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    sent.push({ method: "POST", path: "/questions/generate", body });
    return HttpResponse.json({ created: [sqlQuestion()], failed: [] }, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  sent.length = 0;
  stored = sqlQuestion();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const onClose = vi.fn();
const onSaved = vi.fn();
const dialog = () => within(screen.getByRole("dialog"));
const ALLOWED = ["body", "difficulty", "tags", "marks", "approved"];

describe("mapper", () => {
  it('keeps mode "sql" (it used to become "stdin") and maps schema + order_matters', async () => {
    const q = await getCodingQuestion("q9");
    expect(q.mode).toBe("sql");
    expect(q.schema).toBe(SCHEMA);
    expect(q.orderMatters).toBe(true);
    expect(q.signature).toBeNull();
  });

  it("schema and orderMatters are null for a non-SQL question", async () => {
    stored = sqlQuestion({ mode: "stdin", schema: null, order_matters: null });
    const q = await getCodingQuestion("q9");
    expect([q.mode, q.schema, q.orderMatters]).toEqual(["stdin", null, null]);
  });
});

describe("generate dialog", () => {
  const view = () => render(<GenerateDialog onClose={onClose} onGenerated={() => {}} onReview={() => {}} />);
  const generate = () => fireEvent.click(dialog().getByRole("button", { name: /Generate/ }));

  it('offers the three question types, defaulting to "Full program"', () => {
    view();
    const type = dialog().getByRole("combobox", { name: "Question type" });
    expect(type).toHaveValue("stdin");
    expect(within(type).getAllByRole("option").map((o) => [o.getAttribute("value"), o.textContent])).toEqual([
      ["stdin", "Full program (stdin / stdout)"],
      ["function", "Function (LeetCode style)"],
      ["sql", "SQL query (SQLite)"],
    ]);
  });

  it('sends mode "sql" and labels the created draft as SQL', async () => {
    view();
    fireEvent.change(dialog().getByRole("combobox", { name: "Question type" }), { target: { value: "sql" } });
    generate();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).toEqual({ difficulty: "easy", tags: [], marks: 10, count: 1, mode: "sql" });
    const created = await dialog().findByRole("list", { name: "Created drafts" });
    expect(within(created).getByText("SQL")).toBeInTheDocument();
  });

  it('sends mode "function" for Function', async () => {
    view();
    fireEvent.change(dialog().getByRole("combobox", { name: "Question type" }), { target: { value: "function" } });
    generate();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).toMatchObject({ mode: "function" });
  });

  it("Full program sends no mode (the API default), as before", async () => {
    view();
    generate();
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).not.toHaveProperty("mode");
  });
});

describe("manual create", () => {
  it("never offers SQL (the API answers 422)", () => {
    render(<QuestionForm onClose={onClose} onSaved={onSaved} />);
    const mode = dialog().getByRole("combobox", { name: "Mode" });
    expect(within(mode).getAllByRole("option").map((o) => o.getAttribute("value"))).toEqual(["stdin", "function"]);
  });
});

describe("editing a SQL question", () => {
  it("shows the schema, the row-order rule and every case read-only, with the note; no mode, signature or case editing", async () => {
    render(<QuestionForm questionId="q9" onClose={onClose} onSaved={onSaved} />);
    expect(await dialog().findByLabelText("Schema")).toHaveTextContent(SCHEMA);
    expect(dialog().getByText(SQL_NOTE)).toBeInTheDocument();
    expect(dialog().getByText(/Row order matters/)).toBeInTheDocument();
    expect(dialog().getByLabelText("Sample 1 data")).toHaveTextContent("INSERT INTO emp (id, dept) VALUES (1, 'Eng');");
    expect(dialog().getByLabelText("Hidden 15 data")).toBeInTheDocument();
    expect(dialog().getByLabelText("Hidden 1 expected rows")).toHaveTextContent("No rows");
    expect(dialog().getAllByText("SQL").length).toBeGreaterThan(0);

    expect(dialog().queryByRole("combobox", { name: "Mode" })).not.toBeInTheDocument();
    expect(dialog().queryByRole("textbox", { name: "Function name" })).not.toBeInTheDocument();
    expect(dialog().queryByRole("textbox", { name: "Sample 1 input" })).not.toBeInTheDocument();
    expect(dialog().queryByRole("button", { name: "Paste cases as JSON" })).not.toBeInTheDocument();
  });

  it("Save & approve PATCHes only the changed allowed fields, never test_cases, mode or signature", async () => {
    render(<QuestionForm questionId="q9" onClose={onClose} onSaved={onSaved} />);
    const marks = await dialog().findByRole("spinbutton", { name: "Marks" });
    fireEvent.change(marks, { target: { value: "15" } });
    fireEvent.change(dialog().getByRole("textbox", { name: /Tags/ }), { target: { value: "sql, joins" } });
    fireEvent.click(dialog().getByRole("button", { name: "Save & approve" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ method: "PATCH", path: "/questions/q9" });
    expect(sent[0]!.body).toEqual({ marks: 15, tags: ["sql", "joins"], approved: true });
    expect(Object.keys(sent[0]!.body).every((k) => ALLOWED.includes(k))).toBe(true);
  });

  it("Save on an approved SQL question sends just the statement change (an empty expected result does not block it)", async () => {
    stored = sqlQuestion({ approved: true });
    render(<QuestionForm questionId="q9" onClose={onClose} onSaved={onSaved} />);
    const statement = await dialog().findByRole("textbox", { name: "Statement" });
    fireEvent.change(statement, { target: { value: "Headcount\nReturn each department with its headcount." } });
    const save = dialog().getByRole("button", { name: "Save changes" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).toEqual({ body: "Headcount\nReturn each department with its headcount." });
    expect(sent[0]!.body).not.toHaveProperty("test_cases");
    expect(sent[0]!.body).not.toHaveProperty("mode");
    expect(sent[0]!.body).not.toHaveProperty("signature");
  });

  it("Approve without edits sends only approved: true", async () => {
    render(<QuestionForm questionId="q9" onClose={onClose} onSaved={onSaved} />);
    fireEvent.click(await dialog().findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.body).toEqual({ approved: true });
  });

  it("permission denied on load shows the forbidden state", async () => {
    server.use(http.get("*/api/v1/questions/:id", () => HttpResponse.json({ error: { code: "FORBIDDEN", message: "no" } }, { status: 403 })));
    render(<QuestionForm questionId="q9" onClose={onClose} onSaved={onSaved} />);
    await waitFor(() => expect(dialog().queryByLabelText("Schema")).not.toBeInTheDocument());
    expect(await dialog().findByText(/permission|access/i)).toBeInTheDocument();
  });
});
