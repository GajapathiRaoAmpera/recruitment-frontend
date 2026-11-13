// AC-5 (FR-16) Run/Submit through the API, and the in_progress → locked transition on 409.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { saveAttemptToken } from "@/api/attempt-token";
import { MockStoreProvider } from "@/mock/store";
import CodingTestPage from "./page";

vi.mock("@/lib/supabase", () => ({ supabase: null, linkHash: null }));
vi.mock("next/navigation", () => ({ useParams: () => ({ roundId: "d1-r2" }), useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => window.sessionStorage.setItem("ampera.session", JSON.stringify({ role: "STUDENT", candidateId: "d1-c0" })));
afterEach(() => {
  vi.unstubAllGlobals();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

const page = () =>
  render(
    <MockStoreProvider>
      <CodingTestPage />
    </MockStoreProvider>,
  );

it("Run calls the API with the round's token and shows each sample's verdict", async () => {
  saveAttemptToken("d1-r2", "AT");
  const f = vi.fn().mockResolvedValue(
    reply({
      results: [
        { case: 1, passed: true, status: "passed", stdout: "0 1", stderr: "", time: 0.004 },
        { case: 2, passed: false, status: "compile_error", stdout: "", stderr: "\nSyntaxError: invalid syntax", time: null },
      ],
    }),
  );
  vi.stubGlobal("fetch", f);
  page();
  fireEvent.click(await screen.findByRole("button", { name: /run samples/i }));
  expect(await screen.findByText("Passed · 4 ms")).toBeInTheDocument();
  expect(screen.getByText("Compile error — SyntaxError: invalid syntax")).toBeInTheDocument();
  expect(new Headers(f.mock.calls[0]![1].headers).get("Authorization")).toBe("Bearer AT");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toMatchObject({ question_id: "c1", language: "python" });
  expect(screen.queryByText(/simulated judge0/i)).not.toBeInTheDocument();
});

it("Submit shows the API's total, not the mock 18", async () => {
  saveAttemptToken("d1-r2", "AT");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ passed: 5, total: 12 })));
  page();
  fireEvent.click(await screen.findByRole("button", { name: /submit/i }));
  expect(await screen.findByText(/\/ 12 test cases passed/)).toBeInTheDocument();
  expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("5/12");
});

it("409 ATTEMPT_LOCKED shows the lock screen", async () => {
  saveAttemptToken("d1-r2", "AT");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "ATTEMPT_LOCKED", message: "This attempt is not open for answers", details: {} } }, 409)));
  page();
  fireEvent.click(await screen.findByRole("button", { name: /submit/i }));
  expect(await screen.findByRole("alertdialog", { name: "Your test is paused" })).toBeInTheDocument();
});

it("409 ATTEMPT_EXPIRED shows time is up; other errors stay inline", async () => {
  saveAttemptToken("d1-r2", "AT");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "RUN_IN_PROGRESS", message: "Wait for your current run to finish", details: {} } }, 429)));
  page();
  fireEvent.click(await screen.findByRole("button", { name: /run samples/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Wait for your current run to finish");
  expect(screen.queryByRole("alertdialog", { name: /paused|time is up/i })).not.toBeInTheDocument();

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "ATTEMPT_EXPIRED", message: "Time is up for this test", details: {} } }, 409)));
  await waitFor(() => expect(screen.getByRole("button", { name: /run samples/i })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: /run samples/i }));
  expect(await screen.findByRole("alertdialog", { name: "Time is up" })).toBeInTheDocument();
});

it("without a token it stays on the simulated judge and never calls the API", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  page();
  expect(await screen.findByText(/simulated judge0/i)).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "JavaScript (Node)" })).toHaveValue("javascript");
  fireEvent.click(screen.getByRole("button", { name: /run samples/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /run samples/i })).toBeEnabled(), { timeout: 2000 });
  expect(f).not.toHaveBeenCalled();
});
