// AC-3 (entry) + AC-7: before the system check, the round's attempt status decides the screen. A closed round gets
// no camera, location, terms or full-screen steps. GET /entry/rounds is mocked with MSW.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { EntryAttemptStatus, StudentSession } from "@/api/entry";

// The real check opens the camera; a stub shows whether the gate let the student through.
vi.mock("./real-system-check", () => ({ RealSystemCheck: () => <p>system check steps</p> }));

import { RealRoundGate } from "./real-round-gate";
import { RESUME_POLL_MS } from "./use-entry-rounds";

const student = (attemptStatus?: EntryAttemptStatus): StudentSession => ({
  entryToken: "E",
  studentId: "S1",
  fullName: "Asha Rao",
  rounds: [{ roundId: "r1", type: "coding", testId: "t1", durationMin: 60, attemptStatus }],
});
let serverStatus: string | null = "not_started";
const server = setupServer(
  http.get("*/api/v1/entry/rounds", () =>
    serverStatus === null
      ? HttpResponse.json({ error: { code: "INTERNAL", message: "down" } }, { status: 500 })
      : HttpResponse.json({ rounds: [{ round_id: "r1", type: "coding", test_id: "t1", duration_min: 60, attempt_status: serverStatus }] }),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  serverStatus = "not_started";
});
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

it("a live round runs the system check, after the server confirms it", async () => {
  serverStatus = "in_progress";
  render(<RealRoundGate student={student("in_progress")} roundId="r1" />);
  expect(screen.getByRole("status")).toHaveTextContent("Checking your test"); // no camera until confirmed
  expect(screen.queryByText("system check steps")).toBeNull();
  expect(await screen.findByText("system check steps")).toBeInTheDocument();
});

it.each([
  ["submitted", "Test recorded", "Your test has been recorded. Our team will review it and contact you soon."],
  ["locked", "Your test is paused", "Your test is paused. HR needs to resume it before you can continue."],
  ["expired", "Time is up", "Time is up. Your answers were submitted."],
])("server says %s: its own screen, no system check", async (status, title, text) => {
  serverStatus = status;
  render(<RealRoundGate student={student("not_started")} roundId="r1" />); // the cached status is out of date
  expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
  expect(screen.getByText(text)).toBeInTheDocument();
  expect(screen.queryByText("system check steps")).toBeNull();
});

it("a cached closed status shows its screen at once, before the server answers", () => {
  serverStatus = "submitted";
  render(<RealRoundGate student={student("submitted")} roundId="r1" />);
  expect(screen.getByRole("heading", { name: "Test recorded" })).toBeInTheDocument();
});

it("if the refresh fails, the cached status stands (POST /entry/start has the final word)", async () => {
  serverStatus = null;
  render(<RealRoundGate student={student("not_started")} roundId="r1" />);
  expect(await screen.findByText("system check steps")).toBeInTheDocument();
});

it("paused, then HR resumes: Continue opens the system check in place", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  serverStatus = "locked";
  render(<RealRoundGate student={student("locked")} roundId="r1" />);
  await act(() => new Promise((r) => setTimeout(r, 30))); // the on-mount refresh confirms "locked"
  expect(screen.getByRole("heading", { name: "Your test is paused" })).toBeInTheDocument();
  expect(screen.queryByText("system check steps")).toBeNull();
  serverStatus = "in_progress"; // HR resumes
  await act(async () => {
    vi.advanceTimersByTime(RESUME_POLL_MS);
    await new Promise((r) => setTimeout(r, 30)); // real timeout: let MSW answer
  });
  fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
  expect(await screen.findByText("system check steps")).toBeInTheDocument();
});
