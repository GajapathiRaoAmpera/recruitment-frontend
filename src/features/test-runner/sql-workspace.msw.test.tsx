// AC-5 (FR-15/16/17) Round 2 coding workspace with SQL questions. The API is mocked with MSW at the HTTP level (no Judge0),
// so GET /attempt goes through the real mapper (src/api/attempt.ts) before it reaches the screen.
// Contract: ../recruitment-backend/docs/04-api-contracts.md, GET /attempt, POST /attempt/run + "SQL coding questions".
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getAttempt } from "@/api/attempt";

vi.mock("./code-editor", () => ({
  CodeEditor: ({ value, onChange, label, language }: { value: string; onChange: (v: string) => void; label: string; language: string }) => (
    <textarea aria-label={label} data-language={language} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { sqlRows } from "./coding-shared";
import { CodingWorkspace } from "./coding-workspace";

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const TOKEN = `h.${b64({ typ: "attempt", cid: "c1", aid: "A7" })}.sig`;
const SCHEMA = "CREATE TABLE emp_data (id INTEGER, dept_name TEXT);\nCREATE TABLE audit_log (note TEXT);";

const sqlQuestion = (over: Record<string, unknown> = {}) => ({
  kind: "coding",
  id: "q1",
  title: "Headcount",
  statement: "Return each department and its number of employees.",
  marks: 10,
  languages: [{ key: "sql", name: "SQL (SQLite 3)" }],
  samples: [
    {
      input: "",
      expected: "Eng|2\nNULL|1\n",
      input_display: null,
      // Table and column names are data: they must reach the screen exactly as sent (not camel-cased).
      tables: {
        emp_data: { columns: ["id", "dept_name"], rows: [[1, "Eng"], [2, "Eng"], [3, null]] },
        audit_log: { columns: ["note"], rows: [] },
      },
      expected_rows: [["Eng", "2"], ["NULL", "1"]],
    },
  ],
  mode: "sql",
  signature: null,
  starter_code: null,
  schema: SCHEMA,
  order_matters: false,
  ...over,
});

let attemptQuestions: unknown[] = [];
const runs: Record<string, unknown>[] = [];
let runReply: { results: Record<string, unknown>[] } = { results: [] };
const server = setupServer(
  http.get("*/api/v1/attempt", () =>
    HttpResponse.json({ status: "in_progress", deadline_at: "2026-01-01T11:00:00Z", server_now: "2026-01-01T10:00:00Z", tab_switches: 0, max_tab_switches: 3, questions: attemptQuestions, saved_answers: {} }),
  ),
  http.get("*/api/v1/attempt/code-drafts", () => HttpResponse.json({ drafts: {} })),
  http.post("*/api/v1/attempt/run", async ({ request }) => {
    runs.push((await request.json()) as Record<string, unknown>);
    return HttpResponse.json(runReply);
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  localStorage.clear();
  runs.length = 0;
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function open(questions: unknown[]) {
  attemptQuestions = questions;
  const attempt = await getAttempt(TOKEN);
  render(<CodingWorkspace token={TOKEN} attempt={attempt} live submitted={false} onClosed={() => {}} />);
  return screen.findByRole("textbox", { name: /^Code for / });
}
const cells = (table: HTMLElement) => within(table).getAllByRole("row").map((r) => within(r).queryAllByRole("cell").map((c) => c.textContent));

describe("mapper", () => {
  it("maps mode, schema, orderMatters, tables (names kept) and expectedRows", async () => {
    attemptQuestions = [sqlQuestion()];
    const q = (await getAttempt(TOKEN)).coding[0]!;
    expect(q).toMatchObject({ mode: "sql", schema: SCHEMA, orderMatters: false, signature: null, starterCode: null });
    expect(q.samples[0]!.tables).toEqual({
      emp_data: { columns: ["id", "dept_name"], rows: [[1, "Eng"], [2, "Eng"], [3, null]] },
      audit_log: { columns: ["note"], rows: [] },
    });
    expect(q.samples[0]!.expectedRows).toEqual([["Eng", "2"], ["NULL", "1"]]);
  });

  it("splits SQL stdout into rows and values, ignoring trailing whitespace", () => {
    expect(sqlRows("Eng|2\nHR|1\n")).toEqual([["Eng", "2"], ["HR", "1"]]);
    expect(sqlRows("a||NULL  \n")).toEqual([["a", "", "NULL"]]);
    expect(sqlRows("\n")).toEqual([]);
  });
});

describe("statement", () => {
  it("shows the schema, each sample's tables with headers, the expected rows and the order note; no empty input", async () => {
    await open([sqlQuestion()]);
    expect(screen.getByLabelText("Database schema")).toHaveTextContent("CREATE TABLE emp_data");
    expect(screen.getByText(/Write a SQLite query\./)).toHaveTextContent("Write a SQLite query. Row order does not matter.");

    const emp = screen.getByRole("table", { name: "Sample 1 table emp_data" });
    expect(within(emp).getAllByRole("columnheader").map((h) => [h.textContent, h.getAttribute("scope")])).toEqual([
      ["id", "col"],
      ["dept_name", "col"],
    ]);
    expect(cells(emp).slice(1)).toEqual([["1", "Eng"], ["2", "Eng"], ["3", "NULL"]]);
    expect(within(screen.getByRole("table", { name: "Sample 1 table audit_log" })).getByText("No rows")).toBeInTheDocument();
    expect(cells(screen.getByRole("table", { name: "Sample 1 expected rows" })).slice(1)).toEqual([["Eng", "2"], ["NULL", "1"]]);

    expect(screen.queryByText("Input 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Expected output")).not.toBeInTheDocument();
  });

  it('says "Row order matters." when order_matters is true', async () => {
    await open([sqlQuestion({ order_matters: true })]);
    expect(screen.getByText(/Write a SQLite query\./)).toHaveTextContent("Write a SQLite query. Row order matters.");
  });

  it("an empty expected result shows No rows", async () => {
    await open([sqlQuestion({ samples: [{ ...sqlQuestion().samples[0], expected: "", expected_rows: [] }] })]);
    expect(within(screen.getByRole("table", { name: "Sample 1 expected rows" })).getByText("No rows")).toBeInTheDocument();
  });
});

describe("editor", () => {
  it("is fixed to SQL and a new draft starts empty (not the stdin SQL template)", async () => {
    const editor = await open([sqlQuestion()]);
    expect(editor).toHaveValue("");
    expect(editor).toHaveAttribute("data-language", "sql");
    const lang = screen.getByRole("combobox", { name: "Language" });
    expect(lang).toBeDisabled();
    expect(within(lang).getAllByRole("option").map((o) => o.getAttribute("value"))).toEqual(["sql"]);
  });
});

describe("run", () => {
  it("shows Your rows vs Expected rows as tables on a wrong answer", async () => {
    runReply = { results: [{ case: 1, passed: false, status: "wrong_answer", stdout: "Eng|2\n", stderr: "", time: 0.01 }] };
    const editor = await open([sqlQuestion()]);
    fireEvent.change(editor, { target: { value: "SELECT dept_name, COUNT(*) FROM emp_data WHERE dept_name IS NOT NULL GROUP BY 1" } });
    fireEvent.click(screen.getByRole("button", { name: /Run samples/ }));

    const yours = await screen.findByRole("table", { name: "Run sample 1: your rows" });
    expect(runs[0]).toEqual({ question_id: "q1", code: "SELECT dept_name, COUNT(*) FROM emp_data WHERE dept_name IS NOT NULL GROUP BY 1", language: "sql" });
    expect(cells(yours).slice(1)).toEqual([["Eng", "2"]]);
    expect(cells(screen.getByRole("table", { name: "Run sample 1: expected rows" })).slice(1)).toEqual([["Eng", "2"], ["NULL", "1"]]);
    expect(screen.getByText("Wrong answer — compare the rows below")).toBeInTheDocument();
  });

  it("no output rows shows No rows", async () => {
    runReply = { results: [{ case: 1, passed: false, status: "wrong_answer", stdout: "", stderr: "", time: 0.01 }] };
    const editor = await open([sqlQuestion()]);
    fireEvent.change(editor, { target: { value: "SELECT 1 WHERE 0" } });
    fireEvent.click(screen.getByRole("button", { name: /Run samples/ }));
    expect(within(await screen.findByRole("table", { name: "Run sample 1: your rows" })).getByText("No rows")).toBeInTheDocument();
  });

  it("a SQL error shows stderr, not row tables", async () => {
    runReply = { results: [{ case: 1, passed: false, status: "runtime_error", stdout: "", stderr: "Error: near line 1: no such table: x", time: null }] };
    const editor = await open([sqlQuestion()]);
    fireEvent.change(editor, { target: { value: "SELECT * FROM x" } });
    fireEvent.click(screen.getByRole("button", { name: /Run samples/ }));
    expect(await screen.findByText("Error output")).toBeInTheDocument();
    expect(screen.getAllByText(/no such table: x/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("table", { name: "Run sample 1: your rows" })).not.toBeInTheDocument();
  });

  it("a run error from the API is shown as an alert", async () => {
    server.use(http.post("*/api/v1/attempt/run", () => HttpResponse.json({ error: { code: "EXECUTION_UNAVAILABLE", message: "down" } }, { status: 503 })));
    const editor = await open([sqlQuestion()]);
    fireEvent.change(editor, { target: { value: "SELECT 1" } });
    fireEvent.click(screen.getByRole("button", { name: /Run samples/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/code runner is unavailable/));
  });
});
