// AC-7 (HR resume) and AC-3 (entry): the shared closed-attempt screens, and the paused screen noticing a resume.
// GET /entry/rounds is mocked with MSW. Contract: ../recruitment-backend/docs/04-api-contracts.md, "/entry/rounds".
import { act, fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { AttemptClosedOverlay } from "./attempt-closed";
import { RESUME_POLL_MS } from "./use-entry-rounds";

const round = (attempt_status: string) => ({ round_id: "r1", type: "coding", test_id: "t1", duration_min: 60, attempt_status });
let status = "locked";
let calls: string[] = [];
const server = setupServer(
  http.get("*/api/v1/entry/rounds", ({ request }) => {
    calls.push(request.headers.get("Authorization") ?? "");
    return HttpResponse.json({ rounds: [round(status)] });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  status = "locked";
  calls = [];
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] }); // only the poll; MSW and promises stay real
});
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

// Fire the poll, then let MSW answer (a real setTimeout: RTL's waitFor polls with the faked setInterval).
const tick = () =>
  act(async () => {
    vi.advanceTimersByTime(RESUME_POLL_MS);
    await new Promise((r) => setTimeout(r, 30));
  });

it("a paused test checks every 10 s and offers Continue once HR resumes it", async () => {
  const { unmount } = render(<AttemptClosedOverlay kind="locked" entryToken="E" roundId="r1" />);
  expect(screen.getByRole("alertdialog", { name: "Your test is paused" })).toBeInTheDocument();
  expect(calls).toEqual([]); // nothing on mount

  await tick();
  expect(calls).toEqual(["Bearer E"]);
  expect(screen.getByRole("heading", { name: "Your test is paused" })).toBeInTheDocument(); // still locked

  status = "in_progress";
  await tick();
  expect(await screen.findByRole("heading", { name: "HR has resumed your test" })).toBeInTheDocument();
  // Continue goes back through the system check, then the same attempt reopens with its saved work.
  expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/exam/r1");
  expect(screen.getByRole("link", { name: "Continue" })).toHaveFocus();

  const before = calls.length;
  await tick();
  expect(calls.length).toBe(before); // stops once resumed
  unmount();
});

it("stops polling when it unmounts", async () => {
  const { unmount } = render(<AttemptClosedOverlay kind="locked" entryToken="E" roundId="r1" />);
  await tick();
  expect(calls.length).toBe(1);
  unmount();
  await tick();
  await tick();
  expect(calls.length).toBe(1);
});

it("a failed check keeps waiting instead of erroring", async () => {
  server.use(http.get("*/api/v1/entry/rounds", () => HttpResponse.json({ error: { code: "X", message: "down" } }, { status: 503 }), { once: true }));
  render(<AttemptClosedOverlay kind="locked" entryToken="E" roundId="r1" />);
  await tick();
  status = "in_progress";
  await tick();
  expect(await screen.findByRole("heading", { name: "HR has resumed your test" })).toBeInTheDocument();
});

it("Continue can be handled in place (the gate already sits on /exam/{id})", async () => {
  const onContinue = vi.fn();
  status = "in_progress";
  render(<AttemptClosedOverlay kind="locked" entryToken="E" roundId="r1" onContinue={onContinue} />);
  await tick();
  fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
  expect(onContinue).toHaveBeenCalled();
});

it("submitted and time-over screens never poll, show no marks, and only lead to the dashboard", async () => {
  for (const kind of ["submitted", "expired"] as const) {
    const { unmount } = render(<AttemptClosedOverlay kind={kind} entryToken="E" roundId="r1" />);
    await tick();
    await tick();
    expect(screen.queryByText(/marks|score/i)).toBeNull();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/student"]);
    unmount();
  }
  expect(calls).toEqual([]);
});
