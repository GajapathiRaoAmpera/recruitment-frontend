// AC-3 (entry): the student dashboard shows each round's true state, read fresh from GET /entry/rounds (MSW).
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { StudentSession } from "@/api/entry";
import { MockStoreProvider } from "@/mock/store";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { RealStudentHome } from "./real-student-home";

const wire = (round_id: string, type: string, attempt_status: string) => ({ round_id, type, test_id: null, duration_min: 30, attempt_status });
const cached: StudentSession = {
  entryToken: "E",
  studentId: "S1",
  fullName: "Asha Rao",
  rounds: [{ roundId: "r1", type: "aptitude", testId: null, durationMin: 30, attemptStatus: "not_started" }],
};

let reply: () => Response = () => HttpResponse.json({ rounds: [] });
let calls = 0;
const server = setupServer(
  http.get("*/api/v1/entry/rounds", ({ request }) => {
    calls += 1;
    expect(request.headers.get("Authorization")).toBe("Bearer E");
    return reply();
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  calls = 0;
  window.sessionStorage.clear();
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const list = () => screen.getByRole("list");
const row = (name: string) => within(list()).getByText(name).closest("li")!;

it("shows each round's state: Start, Resume, Submitted, Paused, Time over", async () => {
  reply = () =>
    HttpResponse.json({
      rounds: [wire("r1", "aptitude", "not_started"), wire("r2", "coding", "in_progress"), wire("r3", "technical", "submitted"), wire("r4", "coding", "locked"), wire("r5", "aptitude", "expired")],
    });
  render(<RealStudentHome student={cached} />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your rounds");
  await waitFor(() => expect(within(list()).getAllByRole("listitem")).toHaveLength(5));
  const items = within(list()).getAllByRole("listitem");
  expect(within(items[0]!).getByRole("link", { name: /Start/ })).toHaveAttribute("href", "/exam/r1");
  expect(within(items[1]!).getByRole("link", { name: /Resume/ })).toHaveAttribute("href", "/exam/r2");
  expect(items[2]).toHaveTextContent("Submitted");
  expect(within(items[2]!).queryByRole("link")).toBeNull();
  expect(items[3]).toHaveTextContent("Paused, waiting for HR");
  expect(within(items[3]!).queryByRole("link")).toBeNull();
  expect(items[4]).toHaveTextContent("Time over");
  expect(within(items[4]!).queryByRole("link")).toBeNull();
  expect(screen.queryByText(/marks|score/i)).toBeNull();
});

it("an empty list is not an error: 'No open rounds', no wrong-ID wording", async () => {
  reply = () => HttpResponse.json({ rounds: [] });
  render(<RealStudentHome student={{ ...cached, rounds: [] }} />);
  expect(await screen.findByText("No open rounds")).toBeInTheDocument();
  expect(screen.queryByText(/wrong|doesn.t match|not match/i)).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("if the refresh fails, it keeps the list from sign-in and offers to try again", async () => {
  reply = () => HttpResponse.json({ error: { code: "INTERNAL", message: "down" } }, { status: 500 });
  render(<RealStudentHome student={cached} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t refresh your rounds/i);
  expect(within(row("Round 1 · Aptitude & technical")).getByRole("link", { name: /Start/ })).toHaveAttribute("href", "/exam/r1");

  reply = () => HttpResponse.json({ rounds: [wire("r1", "aptitude", "submitted")] });
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(row("Round 1 · Aptitude & technical")).toHaveTextContent("Submitted");
  expect(calls).toBe(2);
});

it("saves the fresh list in the signed-in session, so the exam screens see it too", async () => {
  window.sessionStorage.setItem("ampera.session", JSON.stringify({ role: "STUDENT", student: cached }));
  reply = () => HttpResponse.json({ rounds: [wire("r1", "aptitude", "locked")] });
  render(
    <MockStoreProvider>
      <RealStudentHome student={cached} />
    </MockStoreProvider>,
  );
  expect(await screen.findByText("Paused, waiting for HR")).toBeInTheDocument();
  await waitFor(() => expect(JSON.parse(window.sessionStorage.getItem("ampera.session")!).student.rounds[0].attemptStatus).toBe("locked"));
  expect(calls).toBe(1); // saving doesn't trigger another fetch
});
