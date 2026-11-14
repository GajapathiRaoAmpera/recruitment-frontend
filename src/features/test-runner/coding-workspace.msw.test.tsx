// AC-5 (FR-15/16/17) Round 2 coding workspace with function-mode questions. The API is mocked with MSW at the HTTP level,
// so GET /attempt goes through the real mapper (src/api/attempt.ts) before it reaches the screen.
// Contract: ../recruitment-backend/docs/04-api-contracts.md, GET /attempt + "Function-mode coding questions".
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getAttempt } from "@/api/attempt";

vi.mock("./code-editor", () => ({
  CodeEditor: ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { LANGS } from "./coding-shared";
import { CodingWorkspace } from "./coding-workspace";

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const TOKEN = `h.${b64({ typ: "attempt", cid: "c1", aid: "A9" })}.sig`;

const STARTER = {
  python: "def twoSum(nums, target):\n    pass\n",
  javascript: "function twoSum(nums, target) {\n}\n",
  c: "int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n}\n",
  cpp: "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n    }\n};\n",
  java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n    }\n}\n",
  go: "func twoSum(nums []int, target int) []int {\n}\n",
};
const SIX = [
  { key: "python", name: "Python 3.8" },
  { key: "javascript", name: "JavaScript (Node.js 12)" },
  { key: "c", name: "C (GCC 9)" },
  { key: "cpp", name: "C++ (GCC 9)" },
  { key: "java", name: "Java 13" },
  { key: "go", name: "Go 1.13" },
];

const functionQuestion = (over: Record<string, unknown> = {}) => ({
  kind: "coding",
  id: "f1",
  title: "Two sum",
  statement: "Return the indices of the two numbers that add up to target.",
  marks: 10,
  languages: SIX,
  samples: [{ input: "[2,7,11,15]\n9\n", expected: "[0,1]", input_display: "nums = [2,7,11,15], target = 9" }],
  mode: "function",
  signature: { function_name: "twoSum", parameters: [{ name: "nums", type: "int[]" }, { name: "target", type: "int" }], return_type: "int[]" },
  starter_code: STARTER,
  ...over,
});

const stdinQuestion = {
  kind: "coding",
  id: "s1",
  title: "Sum",
  statement: "Read a and b, print a + b.",
  marks: 10,
  languages: [{ key: "python", name: "Python 3.8" }, ...SIX.slice(1), { key: "sql", name: "SQL (SQLite 3)" }],
  samples: [{ input: "1 2", expected: "3", input_display: "1 2" }],
  mode: "stdin",
  signature: null,
  starter_code: null,
};

let attemptQuestions: unknown[] = [];
let drafts: Record<string, unknown> = {};
const server = setupServer(
  http.get("*/api/v1/attempt", () =>
    HttpResponse.json({ status: "in_progress", deadline_at: "2026-01-01T11:00:00Z", server_now: "2026-01-01T10:00:00Z", tab_switches: 0, max_tab_switches: 3, questions: attemptQuestions, saved_answers: {} }),
  ),
  http.get("*/api/v1/attempt/code-drafts", () => HttpResponse.json({ drafts })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  localStorage.clear();
  drafts = {};
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** GET /attempt through MSW, then the screen. */
async function open(questions: unknown[]) {
  attemptQuestions = questions;
  const attempt = await getAttempt(TOKEN);
  render(<CodingWorkspace token={TOKEN} attempt={attempt} live submitted={false} onClosed={() => {}} />);
  return screen.findByRole("textbox", { name: /^Code for / });
}

const pickLanguage = (key: string) => fireEvent.change(screen.getByRole("combobox"), { target: { value: key } });

describe("function-mode questions", () => {
  it("opens each language with the API's starter code, not the stdin template", async () => {
    const editor = await open([functionQuestion()]);
    expect(editor).toHaveValue(STARTER.python);
    for (const key of ["javascript", "c", "cpp", "java", "go"] as const) {
      pickLanguage(key);
      expect(screen.getByRole("textbox", { name: "Code for Two sum" })).toHaveValue(STARTER[key]);
    }
    expect(screen.queryByRole("option", { name: /SQL/ })).not.toBeInTheDocument(); // the API lists the six only
  });

  it("shows the signature above the statement and the readable sample input", async () => {
    await open([functionQuestion()]);
    const sig = screen.getByLabelText("Function signature");
    expect(sig).toHaveTextContent("twoSum(nums: int[], target: int): int[]");
    const statement = screen.getByText(/Return the indices/);
    expect(sig.compareDocumentPosition(statement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // signature first
    expect(screen.getByText("nums = [2,7,11,15], target = 9")).toBeInTheDocument();
    expect(screen.queryByText(/\[2,7,11,15\]\s+9/)).not.toBeInTheDocument(); // not the raw driver input
    expect(screen.getByText("[0,1]")).toBeInTheDocument();
  });

  it("a blank saved draft counts as new and opens with the starter; real code is kept", async () => {
    drafts = { f1: { code: "  \n", language: "go", saved_at: "2026-01-01T10:01:00Z" } };
    const editor = await open([functionQuestion()]);
    expect(editor).toHaveValue(STARTER.go);
    pickLanguage("python");
    expect(screen.getByRole("textbox", { name: "Code for Two sum" })).toHaveValue(STARTER.python);
  });

  it("keeps the student's own draft over the starter", async () => {
    drafts = { f1: { code: "def twoSum(nums, target):\n    return [0, 1]\n", language: "python", saved_at: "2026-01-01T10:01:00Z" } };
    const editor = await open([functionQuestion()]);
    expect(editor).toHaveValue("def twoSum(nums, target):\n    return [0, 1]\n");
  });

  it("no starter for a language: an empty editor and a note, never the stdin template", async () => {
    const editor = await open([functionQuestion({ starter_code: { ...STARTER, go: undefined } })]);
    expect(editor).toHaveValue(STARTER.python);
    pickLanguage("go");
    expect(screen.getByRole("textbox", { name: "Code for Two sum" })).toHaveValue("");
    expect(screen.getByText("No starter code came for this language. Write the function twoSum yourself.")).toBeInTheDocument();
  });

  it("no signature sent: says so instead of showing a broken one", async () => {
    await open([functionQuestion({ signature: null })]);
    expect(screen.queryByLabelText("Function signature")).not.toBeInTheDocument();
    expect(screen.getByText(/The signature isn.t available/)).toBeInTheDocument();
  });
});

describe("stdin questions are unchanged", () => {
  it("open with the LANGS template, show the raw sample input and no signature", async () => {
    const editor = await open([stdinQuestion]);
    expect(editor).toHaveValue(LANGS.python.starter);
    pickLanguage("sql");
    expect(screen.getByRole("textbox", { name: "Code for Sum" })).toHaveValue(LANGS.sql.starter);
    expect(screen.queryByText("Function to write")).not.toBeInTheDocument();
    expect(screen.getByText("1 2")).toBeInTheDocument();
  });

  it("an old-shape payload (no mode, starter_code or input_display) still works as stdin", async () => {
    const { kind, id, title, statement, marks, languages } = stdinQuestion;
    const editor = await open([{ kind, id, title, statement, marks, languages, samples: [{ input: "4 5", expected: "9" }] }]);
    expect(editor).toHaveValue(LANGS.python.starter);
    expect(screen.getByText("4 5")).toBeInTheDocument();
  });

  it("a blank saved stdin draft stays blank, as before", async () => {
    drafts = { s1: { code: "", language: "python", saved_at: "2026-01-01T10:01:00Z" } };
    const editor = await open([stdinQuestion]);
    await waitFor(() => expect(editor).toHaveValue(""));
  });
});
