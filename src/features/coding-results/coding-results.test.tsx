// FR-10/FR-23, AC-5: HR reads Round 2 coding results and each student's last submitted code (read-only).
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: null }));
const editorRenders = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/features/test-runner/code-editor", () => ({
  CodeEditor: ({ value, label, readOnly, language }: { value: string; label: string; readOnly?: boolean; language: string }) => {
    editorRenders.n++;
    return <textarea aria-label={label} value={value} readOnly={readOnly} data-language={language} onChange={() => {}} />;
  },
}));

import { CodingResults } from "./coding-results";

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
let routes: Record<string, { status: number; body: unknown }>;
let fetchMock: ReturnType<typeof vi.fn>;

const RESULTS = {
  test_id: "t1",
  max_score: "30.00",
  questions: [
    { question_id: "q2", position: 2, difficulty: "hard", marks: "20.00" },
    { question_id: "q1", position: 1, difficulty: "easy", marks: "10.00" },
  ],
  candidates: [
    {
      attempt_id: "a1", candidate_id: "c1", student_id: "S1", full_name: "Asha", status: "submitted", started_at: null, submitted_at: null, score: "21.11",
      answers: [
        { question_id: "q1", submitted: true, language: "python", passed: 18, total: 18, marks_earned: "10.00" },
        { question_id: "q2", submitted: true, language: "cpp", passed: 10, total: 18, marks_earned: "11.11" },
      ],
    },
    { attempt_id: "a2", candidate_id: "c2", student_id: "S2", full_name: "Ravi", status: "in_progress", started_at: null, submitted_at: null, score: "0", answers: [] },
  ],
};

beforeEach(() => {
  editorRenders.n = 0;
  routes = {
    "/api/v1/rounds/r1/test": { status: 200, body: { id: "t1", round_id: "r1", difficulty: null, duration_sec: 3600, question_count: 2, settings: {}, opens_at: null, closes_at: null, question_ids: ["q1", "q2"], locked: true } },
    "/api/v1/tests/t1/results": { status: 200, body: RESULTS },
    "/api/v1/tests/t1/results/a1": {
      status: 200,
      body: {
        attempt_id: "a1", candidate_id: "c1", student_id: "S1", full_name: "Asha", status: "submitted", score: "21.11", max_score: "30.00",
        submissions: [{ question_id: "q1", submitted: true, language: "python", passed: 18, total: 18, marks_earned: "10.00", code: "print(sum(map(int, input().split())))", updated_at: "2026-01-01T10:00:00Z" }],
      },
    },
  };
  fetchMock = vi.fn(async (url: string) => {
    const r = routes[url];
    return r ? json(r.status, r.body) : json(404, { error: { code: "NOT_FOUND", message: "no route" } });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it("lists each student's status, score and passed/total per question, in question order", async () => {
  render(<CodingResults roundId="r1" />);
  const table = within(await screen.findByRole("table", { name: "Coding results" }));
  expect(table.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Student", "Status", "Score", "Q1", "Q2", "Code"]);
  const [asha, ravi] = table.getAllByRole("row").slice(1).map((r) => within(r));
  expect(asha!.getByText("Asha")).toBeInTheDocument();
  expect(asha!.getByText("Submitted")).toBeInTheDocument();
  expect(asha!.getByText("21.11 / 30")).toBeInTheDocument();
  expect(asha!.getByText("18/18")).toBeInTheDocument();
  expect(asha!.getByText("10/18")).toBeInTheDocument();
  expect(ravi!.getByText("Still writing")).toBeInTheDocument();
  expect(ravi!.getAllByText("—")).toHaveLength(2);
  expect(editorRenders.n).toBe(0); // the editor (Monaco) isn't loaded until a row is opened
});

it("opens a row to show the submitted code read-only, per question", async () => {
  render(<CodingResults roundId="r1" />);
  fireEvent.click(await screen.findByText("Asha"));
  const dialog = within(await screen.findByRole("dialog", { name: "Asha: submitted code" }));
  const code = await dialog.findByRole("textbox", { name: "Submitted code for question 1" });
  expect(code).toHaveValue("print(sum(map(int, input().split())))");
  expect(code).toHaveAttribute("readonly");
  expect(code).toHaveAttribute("data-language", "python");
  expect(dialog.getByText("Test cases 18/18")).toBeInTheDocument();
  expect(dialog.getByText("Marks 10 / 10")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith("/api/v1/tests/t1/results/a1", expect.anything());

  fireEvent.click(dialog.getByRole("tab", { name: "Q2" }));
  expect(dialog.getByText("Not submitted")).toBeInTheDocument(); // no submitted code for q2 in the detail
  expect(dialog.queryByRole("textbox")).not.toBeInTheDocument();
});

it("the Code button opens the same panel from the keyboard", async () => {
  render(<CodingResults roundId="r1" />);
  fireEvent.click(await screen.findByRole("button", { name: "View code for Asha" }));
  expect(await screen.findByRole("dialog", { name: "Asha: submitted code" })).toBeInTheDocument();
});

it("says there are no results yet when the round has no test", async () => {
  routes["/api/v1/rounds/r1/test"] = { status: 404, body: { error: { code: "TEST_NOT_FOUND", message: "No test", details: {} } } };
  render(<CodingResults roundId="r1" />);
  expect(await screen.findByText("No results yet")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("says there are no results yet when nobody has started", async () => {
  routes["/api/v1/tests/t1/results"] = { status: 200, body: { ...RESULTS, candidates: [] } };
  render(<CodingResults roundId="r1" />);
  expect(await screen.findByText("Results appear once students start the coding test.")).toBeInTheDocument();
});

it("shows an error with a retry", async () => {
  routes["/api/v1/tests/t1/results"] = { status: 500, body: { error: { code: "INTERNAL", message: "Results are down" } } };
  render(<CodingResults roundId="r1" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Results are down");
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});
