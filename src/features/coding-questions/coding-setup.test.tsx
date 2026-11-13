// FR-13, AC-5/AC-9: HR sets up the Round 2 coding test: duration, ordered questions from the bank, locked once started.
// fetch is stubbed with a small fake of GET/PUT /rounds/{id}/test, GET /questions and PUT /tests/{id}/questions.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: null }));
vi.mock("./question-form", () => ({
  QuestionForm: ({ questionId }: { questionId?: string }) => <p>form for {questionId ?? "new"}</p>,
}));

import { CodingSetup } from "./coding-setup";

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });
const q = (id: string, body: string, difficulty: string, marks: string, approved = true) => ({ id, kind: "coding", body, difficulty, tags: ["t"], marks, approved, created_at: "2026-01-01T00:00:00Z" });
const BANK = [q("q1", "Sum two numbers\nRead a, b.", "easy", "10.00"), q("q2", "Max of array", "medium", "20.00"), q("q3", "Shortest path", "advanced", "30.00"), q("q4", "Draft from AI", "easy", "5.00", false)];

let test: { exists: boolean; locked: boolean; ids: string[]; durationSec: number };
let questionsReply: { status: number; body: unknown } | null;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  test = { exists: true, locked: false, ids: ["q1", "q2"], durationSec: 3600 };
  questionsReply = null;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url, "http://x");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const testOut = () => ({ id: "t1", round_id: "r1", difficulty: null, duration_sec: test.durationSec, question_count: test.ids.length, settings: {}, opens_at: null, closes_at: null });
    if (u.pathname === "/api/v1/rounds/r1/test" && method === "GET")
      return test.exists ? json(200, { ...testOut(), question_ids: test.ids, locked: test.locked }) : json(404, { error: { code: "TEST_NOT_FOUND", message: "raw", details: {} } });
    if (u.pathname === "/api/v1/rounds/r1/test" && method === "PUT") {
      test.exists = true;
      test.durationSec = body.duration_sec;
      return json(200, testOut());
    }
    if (u.pathname === "/api/v1/questions") {
      const d = u.searchParams.get("difficulty");
      return json(200, BANK.filter((x) => !d || x.difficulty === d));
    }
    if (u.pathname === "/api/v1/tests/t1/questions" && method === "PUT") {
      if (questionsReply) return json(questionsReply.status, questionsReply.body);
      test.ids = body.question_ids;
      const chosen = BANK.filter((x) => test.ids.includes(x.id));
      return json(200, { test_id: "t1", question_count: chosen.length, levels: { easy: chosen.filter((x) => x.difficulty === "easy").length, medium: chosen.filter((x) => x.difficulty === "medium").length, advanced: chosen.filter((x) => x.difficulty === "advanced").length }, questions: [] });
    }
    return json(404, { error: { code: "NOT_FOUND", message: "no route" } });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const view = () => render(<CodingSetup roundId="r1" />);
const roundList = () => within(screen.getByRole("list", { name: "Questions in this round" }));
const titles = () => roundList().getAllByRole("listitem").map((li) => li.querySelector("span:nth-child(2)")!.textContent);
const bankRow = (title: string) => within(within(screen.getByRole("table", { name: "Question bank" })).getByText(title).closest("tr")!);
const calls = (method: string, path: string) => fetchMock.mock.calls.filter(([u, i]) => (i?.method ?? "GET") === method && String(u).startsWith(path));
const ready = () => waitFor(() => expect(titles()).not.toContain("Loading…"));

it("shows the duration, the round's questions in order and the bank", async () => {
  view();
  await screen.findByRole("list", { name: "Questions in this round" });
  await ready();
  expect(screen.getByRole("spinbutton", { name: "Duration (minutes)" })).toHaveValue(60);
  expect(titles()).toEqual(["Sum two numbers", "Max of array"]);
  expect(screen.getByText("Questions in this round (2)")).toBeInTheDocument();
  expect(screen.getByText("Total 30 marks")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save questions" })).toBeDisabled(); // nothing changed yet
  expect(await screen.findByRole("button", { name: "Sum two numbers is in this round" })).toBeDisabled();
  expect(bankRow("Draft from AI").getByText("Not approved")).toBeInTheDocument();
  expect(bankRow("Draft from AI").getByRole("button", { name: "Add Draft from AI to round" })).toBeDisabled();
  expect(bankRow("Shortest path").getByRole("button", { name: "Add Shortest path to round" })).toBeEnabled();
});

it("adds, reorders and removes, then saves the new order", async () => {
  view();
  await screen.findByRole("list", { name: "Questions in this round" });
  await ready();
  fireEvent.click(await screen.findByRole("button", { name: "Add Shortest path to round" }));
  fireEvent.click(screen.getByRole("button", { name: "Move Max of array up" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Sum two numbers" }));
  expect(titles()).toEqual(["Max of array", "Shortest path"]);
  expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Sum two numbers to round" })).toBeEnabled(); // back in the bank

  fireEvent.click(screen.getByRole("button", { name: "Save questions" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Saved 2 question(s) (1 medium, 1 advanced). Students see them in this order.");
  const put = calls("PUT", "/api/v1/tests/t1/questions");
  expect(put).toHaveLength(1);
  expect(JSON.parse(String(put[0]![1].body))).toEqual({ question_ids: ["q2", "q3"] });
  await waitFor(() => expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Save questions" })).toBeDisabled();
});

it("is read-only once a student has started (locked)", async () => {
  test.locked = true;
  view();
  expect(await screen.findByText("A student has started this test, so its settings and questions are read-only.")).toBeInTheDocument();
  await ready();
  expect(screen.getByRole("spinbutton", { name: "Duration (minutes)" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Save settings" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save questions" })).not.toBeInTheDocument();
  expect(roundList().queryAllByRole("button")).toHaveLength(0); // no move / edit / remove
  await screen.findByRole("table", { name: "Question bank" });
  expect(bankRow("Shortest path").getByRole("button", { name: "Add Shortest path to round" })).toBeDisabled();
  expect(bankRow("Sum two numbers").queryByRole("button", { name: "Edit Sum two numbers" })).not.toBeInTheDocument(); // in this locked round
  expect(bankRow("Shortest path").getByRole("button", { name: "Edit Shortest path" })).toBeEnabled(); // not in it
});

it("TEST_IN_USE on save explains why and switches to read-only", async () => {
  view();
  await screen.findByRole("list", { name: "Questions in this round" });
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Remove Max of array" }));
  questionsReply = { status: 409, body: { error: { code: "TEST_IN_USE", message: "raw", details: {} } } };
  test.locked = true; // a student started meanwhile
  fireEvent.click(screen.getByRole("button", { name: "Save questions" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("A student has already started this test, so its questions can't change any more.");
  expect(await screen.findByText("A student has started this test, so its settings and questions are read-only.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save questions" })).not.toBeInTheDocument();
});

it.each([
  ["QUESTIONS_NOT_APPROVED", "Not approved", /aren't approved yet/],
  ["QUESTIONS_INCOMPLETE", "Needs 3 + 15 cases", /exactly 3 sample and 15 hidden/],
  ["QUESTIONS_NOT_FOUND", "Not found", /don't exist any more/],
])("%s flags the refused questions", async (code, badge, msg) => {
  view();
  await screen.findByRole("list", { name: "Questions in this round" });
  await ready();
  fireEvent.click(screen.getByRole("button", { name: "Move Max of array up" }));
  questionsReply = { status: 422, body: { error: { code, message: "raw", details: { question_ids: ["q2"] } } } };
  fireEvent.click(screen.getByRole("button", { name: "Save questions" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(msg);
  const items = roundList().getAllByRole("listitem");
  expect(within(items[0]!).getByText(badge)).toBeInTheDocument(); // Max of array, now first
  expect(within(items[1]!).queryByText(badge)).not.toBeInTheDocument();
});

it("with no test yet: Create test sends the duration in seconds, then questions can be saved", async () => {
  test.exists = false;
  test.ids = [];
  view();
  expect(await screen.findByText("No test set up yet. Save the settings to create it, then add questions.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save questions" })).toBeDisabled();
  expect(screen.getByText("Create the test first (Test settings above).")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("spinbutton", { name: "Duration (minutes)" }), { target: { value: "45" } });
  fireEvent.click(screen.getByRole("button", { name: "Create test" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Saved: 45 minutes. The test is created; now add questions.");
  expect(JSON.parse(String(calls("PUT", "/api/v1/rounds/r1/test")[0]![1].body))).toEqual({ duration_sec: 2700 });
  await waitFor(() => expect(screen.queryByText(/No test set up yet/)).not.toBeInTheDocument());
  expect(screen.getByRole("spinbutton", { name: "Duration (minutes)" })).toHaveValue(45);
});

it("validates the duration before saving it", async () => {
  view();
  const box = await screen.findByRole("spinbutton", { name: "Duration (minutes)" });
  expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled(); // unchanged
  fireEvent.change(box, { target: { value: "0" } });
  expect(screen.getByText("Enter whole minutes from 1 to 600.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save settings" })).toBeDisabled();
  fireEvent.change(box, { target: { value: "90" } });
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Saved: 90 minutes.");
  expect(JSON.parse(String(calls("PUT", "/api/v1/rounds/r1/test")[0]![1].body))).toEqual({ duration_sec: 5400 });
});

it("filters the bank by difficulty (API) and search (browser); opens the form", async () => {
  view();
  await screen.findByRole("table", { name: "Question bank" });
  fireEvent.change(screen.getByRole("combobox", { name: "Difficulty" }), { target: { value: "advanced" } });
  await waitFor(() => expect(calls("GET", "/api/v1/questions?").some(([u]) => new URL(String(u), "http://x").searchParams.get("difficulty") === "advanced")).toBe(true));
  await waitFor(() => expect(within(screen.getByRole("table", { name: "Question bank" })).getAllByRole("row")).toHaveLength(2));
  fireEvent.change(screen.getByRole("combobox", { name: "Difficulty" }), { target: { value: "" } });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "max" } });
  await waitFor(() => expect(within(screen.getByRole("table", { name: "Question bank" })).getAllByRole("row")).toHaveLength(2));
  expect(bankRow("Max of array")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "zzz" } });
  expect(screen.getByText("No questions match")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "New question" }));
  expect(screen.getByText("form for new")).toBeInTheDocument();
});

it("Edit in the round list opens the form for that question", async () => {
  view();
  await screen.findByRole("list", { name: "Questions in this round" });
  await ready();
  fireEvent.click(roundList().getByRole("button", { name: "Edit Max of array" }));
  expect(screen.getByText("form for q2")).toBeInTheDocument();
});

it("shows an error with a retry when the test can't load", async () => {
  fetchMock.mockImplementation(async () => json(500, { error: { code: "INTERNAL", message: "Server is down" } }));
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent("Server is down");
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});
