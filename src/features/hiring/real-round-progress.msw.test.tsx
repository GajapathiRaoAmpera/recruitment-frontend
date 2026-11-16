// AC-7 (HR resume): Resume on a locked attempt, through the real API client with MSW at the HTTP level.
// Contract: ../recruitment-backend/docs/04-api-contracts.md, GET /drives/{id}/rounds/{rid}/progress and POST /attempts/{id}/resume.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RealRoundProgress } from "./real-round-progress";

const steps = { id_dob: true, location: true, terms: true, fullscreen: true };
const candidate = (over: Record<string, unknown>) => ({
  candidate_id: "c1", student_id: "S1", full_name: "Asha Rao", status: "in_progress", steps,
  attempt_status: "locked", started_at: "2026-01-01T10:00:00Z", submitted_at: null, marks: null,
  tab_switches: 3, attempt_id: "a1", resume_count: 0, ...over,
});

let roundStatus = "active";
let asha: Record<string, unknown> = {};
let progressCalls = 0;
let resumeBodies: unknown[] = [];
let resumeReply: () => Response = () => HttpResponse.json({ attempt_id: "a1", status: "in_progress", deadline_at: "2026-01-01T11:00:00Z", tab_switches: 0 });

const server = setupServer(
  http.get("*/api/v1/drives/d1/rounds/r1/progress", () => {
    progressCalls += 1;
    return HttpResponse.json({
      round_id: "r1", type: "aptitude", status: roundStatus,
      candidates: [
        candidate(asha),
        candidate({ candidate_id: "c2", student_id: "S2", full_name: "Ravi Kumar", attempt_status: "in_progress", tab_switches: 6, attempt_id: "a2", resume_count: 1 }),
        candidate({ candidate_id: "c3", student_id: "S3", full_name: "Meena Iyer", status: "invited", attempt_status: null, tab_switches: 0, attempt_id: null, resume_count: 0 }),
      ],
    });
  }),
  http.post("*/api/v1/attempts/:id/resume", async ({ request, params }) => {
    resumeBodies.push({ id: params.id, body: await request.json() });
    const r = resumeReply();
    if (r.ok) asha = { attempt_status: "in_progress", tab_switches: 3, resume_count: 1 }; // what the server now reports
    return r;
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  roundStatus = "active";
  asha = {};
  progressCalls = 0;
  resumeBodies = [];
  resumeReply = () => HttpResponse.json({ attempt_id: "a1", status: "in_progress", deadline_at: "2026-01-01T11:00:00Z", tab_switches: 0 });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const refuse = (status: number, code: string, message = "refused") => () => HttpResponse.json({ error: { code, message, details: {} } }, { status });
const rowOf = (name: string) => screen.getByRole("link", { name }).closest("tr")!;

async function openDialog() {
  render(<RealRoundProgress driveId="d1" roundId="r1" />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume Asha Rao's test" }));
  return screen.findByRole("dialog", { name: "Resume Asha Rao's test?" });
}
const typeReason = (text: string) => fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: text } });
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Resume test" }));

describe("the progress table", () => {
  it("offers Resume only on locked attempts, and labels the all-time switch total next to Resumed ×N", async () => {
    render(<RealRoundProgress driveId="d1" roundId="r1" />);
    await screen.findByRole("link", { name: "Asha Rao" });
    expect(within(rowOf("Asha Rao")).getByRole("button", { name: "Resume Asha Rao's test" })).toBeInTheDocument();
    expect(within(rowOf("Ravi Kumar")).queryByRole("button", { name: /Resume/ })).toBeNull();
    expect(within(rowOf("Meena Iyer")).queryByRole("button", { name: /Resume/ })).toBeNull();
    // 3 switches, a resume, 3 more: the total is 6 and never treated as the student's current count
    expect(within(rowOf("Ravi Kumar")).getByText("Resumed ×1")).toBeInTheDocument();
    expect(within(rowOf("Ravi Kumar")).getByText("total across 1 resume").parentElement).toHaveTextContent("6");
    expect(within(rowOf("Asha Rao")).queryByText(/Resumed ×/)).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Tab switches (all time)" })).toBeInTheDocument();
    // the four entry checks are one icon row, each named for screen readers
    expect(within(rowOf("Asha Rao")).getByText("ID + DOB: done")).toBeInTheDocument();
    expect(within(rowOf("Asha Rao")).getByText("Full screen: done")).toBeInTheDocument();
  });

  it("no Resume once the round is no longer active", async () => {
    roundStatus = "completed";
    render(<RealRoundProgress driveId="d1" roundId="r1" />);
    await screen.findByRole("link", { name: "Asha Rao" });
    expect(screen.queryByRole("button", { name: /Resume Asha/ })).toBeNull();
  });

  it("a 403 shows permission denied, not the table", async () => {
    server.use(http.get("*/api/v1/drives/d1/rounds/r1/progress", refuse(403, "FORBIDDEN")));
    render(<RealRoundProgress driveId="d1" roundId="r1" />);
    expect(await screen.findByRole("heading", { name: /access|permission/i })).toBeInTheDocument();
  });
});

describe("Resume dialog", () => {
  it("explains what resume does and needs a reason of at least 3 characters", async () => {
    const dialog = await openDialog();
    expect(dialog).toHaveTextContent("The student continues with the time they had left and the tab-switch count restarts at 0.");
    confirm();
    expect(await within(dialog).findByText("Enter a reason of at least 3 characters.")).toBeInTheDocument();
    typeReason("  ok ");
    confirm();
    expect(within(dialog).getByText("Enter a reason of at least 3 characters.")).toBeInTheDocument();
    expect(resumeBodies).toEqual([]);
  });

  it("resumes, toasts, closes and refreshes the list", async () => {
    await openDialog();
    typeReason("  Power cut in lab 2  ");
    confirm();
    expect(await screen.findByText("Asha Rao's test is resumed")).toBeInTheDocument();
    expect(resumeBodies).toEqual([{ id: "a1", body: { reason: "Power cut in lab 2" } }]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(within(rowOf("Asha Rao")).getByText("Resumed ×1")).toBeInTheDocument());
    expect(progressCalls).toBe(2);
    expect(within(rowOf("Asha Rao")).queryByRole("button", { name: /Resume/ })).toBeNull();
  });

  it("NOT_LOCKED: someone already changed it, so it refreshes the list and says so", async () => {
    resumeReply = refuse(409, "NOT_LOCKED");
    await openDialog();
    typeReason("Power cut");
    confirm();
    expect(await screen.findByText(/already changed/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(progressCalls).toBe(2));
  });

  it("404: the attempt is gone, so it refreshes the list and says so", async () => {
    resumeReply = refuse(404, "ATTEMPT_NOT_FOUND");
    await openDialog();
    typeReason("Power cut");
    confirm();
    expect(await screen.findByText(/wasn't found/)).toBeInTheDocument();
    await waitFor(() => expect(progressCalls).toBe(2));
  });

  it.each([
    [409, "ROUND_NOT_ACTIVE", "This round isn't active any more, so its attempts can't be resumed."],
    [409, "REMAINING_TIME_UNKNOWN", "This attempt has no saved time to restore, so it can't be resumed. Close it from Advance with 'finalize locked' instead."],
    [403, "FORBIDDEN", "You don't have permission to resume attempts in this drive."],
  ])("%s %s: explains why in the dialog and keeps it open", async (status, code, text) => {
    resumeReply = refuse(status, code);
    const dialog = await openDialog();
    typeReason("Power cut");
    confirm();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(progressCalls).toBe(1);
  });

  it("shows a loading state while the request runs", async () => {
    let release!: () => void;
    resumeReply = () => HttpResponse.json({ attempt_id: "a1", status: "in_progress", deadline_at: "2026-01-01T11:00:00Z", tab_switches: 0 });
    server.use(
      http.post("*/api/v1/attempts/:id/resume", async () => {
        await new Promise<void>((r) => (release = r));
        return resumeReply();
      }),
    );
    await openDialog();
    typeReason("Power cut");
    confirm();
    await waitFor(() => expect(screen.getByRole("button", { name: /Resume test/ })).toBeDisabled());
    release();
    expect(await screen.findByText("Asha Rao's test is resumed")).toBeInTheDocument();
  });
});
