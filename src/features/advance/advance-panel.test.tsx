// FR-11/FR-12, AC-4: HR cut-off preview, Advance guard rails (still writing, locked), refusals and the success flow.
// fetch is stubbed with a tiny fake of GET /rounds/{id}/ranking and POST /rounds/{id}/advance.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: false }));

import { AdvancePanel } from "./advance-panel";

interface Row {
  id: string;
  name: string;
  status: "not_started" | "in_progress" | "locked" | "submitted" | "expired" | null;
  percent?: number;
}

let roundStatus = "active";
let saved: number | null = 70;
let rows: Row[] = [];
let advanceReply: { status: number; body: unknown } = { status: 200, body: {} };
let fetchMock: ReturnType<typeof vi.fn>;

function ranking(threshold: number | null) {
  const finished = rows.filter((r) => r.status === "submitted" || r.status === "expired").sort((a, b) => b.percent! - a.percent!);
  const pass = (r: Row) => threshold !== null && r.percent! >= threshold;
  const absent = rows.filter((r) => r.status === null || r.status === "not_started");
  return {
    round_id: "r1",
    round_status: roundStatus,
    threshold,
    counts: {
      pass: threshold === null ? null : finished.filter(pass).length,
      fail: threshold === null ? null : finished.filter((r) => !pass(r)).length,
      absent: absent.length,
      still_writing: rows.filter((r) => r.status === "in_progress").length,
      locked: rows.filter((r) => r.status === "locked").length,
    },
    candidates: [...finished, ...rows.filter((r) => !finished.includes(r))].map((r) => {
      const done = finished.includes(r);
      return {
        candidate_id: r.id,
        student_id: `S-${r.id}`,
        name: r.name,
        attempt_status: r.status,
        marks: done ? String(r.percent! / 10) : null,
        max_marks: done ? "10.00" : null,
        percent: done ? `${r.percent}.00` : null,
        rank: done ? finished.indexOf(r) + 1 : null,
        time_taken_sec: done ? 725 : null,
        would_pass: done ? (threshold === null ? null : pass(r)) : absent.includes(r) ? false : null,
      };
    }),
  };
}

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body });

beforeEach(() => {
  roundStatus = "active";
  saved = 70;
  rows = [
    { id: "c1", name: "Asha", status: "submitted", percent: 80 },
    { id: "c2", name: "Ravi", status: "submitted", percent: 50 },
    { id: "c3", name: "Meena", status: null },
  ];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url, "http://x");
    if (u.pathname === "/api/v1/rounds/r1/ranking") {
      const t = u.searchParams.get("threshold");
      return json(200, ranking(t === null ? saved : Number(t)));
    }
    if (u.pathname === "/api/v1/rounds/r1/advance" && init?.method === "POST") {
      if (advanceReply.status === 200) {
        roundStatus = "completed";
        saved = JSON.parse(String(init.body)).threshold;
      }
      return json(advanceReply.status, advanceReply.body);
    }
    return json(404, { error: { code: "NOT_FOUND", message: "no route" } });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const onAdvanced = vi.fn();
const view = () => render(<AdvancePanel roundId="r1" onAdvanced={onAdvanced} />);
const rankingCalls = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes("/ranking"));
const stat = (label: string) => within(screen.getByRole("group", { name: "Counts at this cut-off" })).getByText(label).parentElement!.parentElement!.querySelector("p")!.textContent;
const advanceBtn = () => screen.getByRole("button", { name: "Advance" });
/** Wait until the preview has caught up with the slider (Advance is only enabled then). */
const ready = () => waitFor(() => expect(advanceBtn()).toBeEnabled(), { timeout: 2000 });

it("starts at the saved cut-off and previews a new one after the debounce", async () => {
  view();
  await ready();
  expect(screen.getByRole("slider")).toHaveValue("70");
  expect(screen.getByRole("spinbutton", { name: "Cut-off (%)" })).toHaveValue(70);
  expect(rankingCalls()[0]).toBe("/api/v1/rounds/r1/ranking"); // first call: the saved threshold
  expect([stat("Pass"), stat("Fail"), stat("Absent"), stat("Still writing"), stat("Locked")]).toEqual(["1", "1", "1", "0", "0"]);

  const table = within(screen.getByRole("table", { name: "Ranking" }));
  const first = within(table.getAllByRole("row")[1]!);
  expect(first.getByText("#1")).toBeInTheDocument();
  expect(first.getByText("S-c1")).toBeInTheDocument();
  expect(first.getByText("Asha")).toBeInTheDocument();
  expect(first.getByText("8 / 10")).toBeInTheDocument();
  expect(first.getByText("80%")).toBeInTheDocument();
  expect(first.getByText("12m 05s")).toBeInTheDocument();
  expect(first.getByText("Pass")).toBeInTheDocument();
  expect(within(table.getAllByRole("row")[2]!).getByText("Fail")).toBeInTheDocument();
  expect(within(table.getAllByRole("row")[3]!).getByText("Absent")).toBeInTheDocument();

  fireEvent.change(screen.getByRole("slider"), { target: { value: "40" } });
  expect(advanceBtn()).toBeDisabled(); // the preview is behind the slider
  expect(screen.getByText("Updating the preview…")).toBeInTheDocument();
  await ready();
  expect(rankingCalls().at(-1)).toBe("/api/v1/rounds/r1/ranking?threshold=40");
  expect(stat("Pass")).toBe("2");
  expect(within(screen.getByRole("table", { name: "Ranking" })).getAllByText("Pass")).toHaveLength(2);
});

it("typing a cut-off keeps whole percents in 0-100", async () => {
  view();
  await ready();
  const box = screen.getByRole("spinbutton", { name: "Cut-off (%)" });
  fireEvent.change(box, { target: { value: "150" } });
  expect(screen.getByRole("slider")).toHaveValue("100");
  fireEvent.change(box, { target: { value: "55" } });
  await ready();
  expect(rankingCalls().at(-1)).toBe("/api/v1/rounds/r1/ranking?threshold=55");
});

it("starts at 60% when the round has no saved cut-off", async () => {
  saved = null;
  view();
  await ready();
  expect(screen.getByRole("slider")).toHaveValue("60");
  expect(rankingCalls().at(-1)).toBe("/api/v1/rounds/r1/ranking?threshold=60");
});

it("keeps Advance off with a reason while students are still writing", async () => {
  rows.push({ id: "c4", name: "Kiran", status: "in_progress" }, { id: "c5", name: "Divya", status: "in_progress" });
  view();
  await waitFor(() => expect(screen.getByText(/2 students are still writing/)).toBeInTheDocument(), { timeout: 2000 });
  expect(advanceBtn()).toBeDisabled();
  expect(advanceBtn()).toHaveAccessibleDescription(/2 students are still writing/);
  expect(stat("Still writing")).toBe("2");
});

it("lists locked attempts and only confirms once 'finish locked attempts' is ticked", async () => {
  rows.push({ id: "c4", name: "Kiran", status: "locked" });
  advanceReply = { status: 200, body: { round_id: "r1", threshold: 70, passed: 1, failed: 3, absent: 1, next_round_id: "r2", invited: [{ candidate_id: "c1", student_id: "S-c1", name: "Asha" }] } };
  view();
  await ready();
  fireEvent.click(advanceBtn());
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("1 pass, 1 fail, 1 absent. Pass students go to the next round. This can't be undone.")).toBeInTheDocument();
  expect(dialog.getByText("Kiran")).toBeInTheDocument();
  const confirm = dialog.getByRole("button", { name: "Advance round" });
  expect(confirm).toBeDisabled();
  expect(dialog.getByText(/stays off until you tick this/)).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("checkbox", { name: "Finish locked attempts with their current marks" }));
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  await screen.findByText("Round advanced");
  const post = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/advance"))!;
  expect(JSON.parse(String(post[1].body))).toEqual({ threshold: 70, finalize_locked: true });
});

it("advances: shows the summary, refreshes the page and goes read-only", async () => {
  onAdvanced.mockReset();
  advanceReply = {
    status: 200,
    body: { round_id: "r1", threshold: 70, passed: 1, failed: 1, absent: 1, next_round_id: "r2", invited: [{ candidate_id: "c1", student_id: "S-c1", name: "Asha" }] },
  };
  view();
  await ready();
  fireEvent.click(advanceBtn());
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getByText("1 pass, 1 fail, 1 absent. Pass students go to the next round. This can't be undone.")).toBeInTheDocument();
  fireEvent.click(dialog.getByRole("button", { name: "Advance round" }));

  const summary = await screen.findByRole("status");
  expect(summary).toHaveTextContent("Round advanced");
  expect(summary).toHaveTextContent("At a 70% cut-off: 1 passed, 1 failed, 1 absent.");
  expect(summary).toHaveTextContent("1 student invited to the next round.");
  expect(summary).toHaveTextContent("No emails were sent");
  expect(onAdvanced).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(screen.getByText(/Final ranking at a 70% cut-off\. Read-only\./)).toBeInTheDocument());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Advance" })).not.toBeInTheDocument();
  expect(screen.getByText("Completed")).toBeInTheDocument();
});

it.each([
  ["ROUND_STILL_RUNNING", { counts: { still_writing: 1 } }, /1 student is still writing\. .*Nothing was saved/],
  ["LOCKED_ATTEMPTS", { attempts: [{ attempt_id: "a9", candidate_id: "c9", student_id: "S9", name: "Nila" }] }, /1 attempt is locked after tab switches \(Nila\)/],
  ["ROUND_ALREADY_ADVANCED", {}, /already been advanced/],
  ["ROUND_NOT_ACTIVE", {}, /isn't active/],
  ["ROUND_HAS_NO_TEST", {}, /has no test/],
  ["ROUND_NOT_FOUND", {}, /wasn't found/],
])("shows a clear message for a %s refusal", async (code, details, text) => {
  advanceReply = { status: code === "ROUND_NOT_FOUND" ? 404 : 409, body: { error: { code, message: "raw", details } } };
  view();
  await ready();
  fireEvent.click(advanceBtn());
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Advance round" }));
  expect(await dialog.findByRole("alert")).toHaveTextContent(text);
  expect(screen.queryByText("Round advanced")).not.toBeInTheDocument();
});

it("shows a completed round's final ranking read-only", async () => {
  roundStatus = "completed";
  view();
  await screen.findByText("Final ranking at a 70% cut-off. Read-only.");
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Advance" })).not.toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Ranking" })).toBeInTheDocument();
  expect(rankingCalls()).toEqual(["/api/v1/rounds/r1/ranking"]); // only the saved cut-off is asked for
});

it("shows a short note for a round that isn't active yet", async () => {
  roundStatus = "pending";
  view();
  expect(await screen.findByText(/Round not active yet\./)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("shows the error with a retry when the ranking can't load", async () => {
  fetchMock.mockImplementation(async () => json(500, { error: { code: "INTERNAL", message: "Ranking is down" } }));
  view();
  expect(await screen.findByRole("alert")).toHaveTextContent("Ranking is down");
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});
