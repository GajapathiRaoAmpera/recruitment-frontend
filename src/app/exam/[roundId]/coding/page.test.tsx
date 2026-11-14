// AC-5 (FR-16) prototype coding page: demo students get the simulated judge; real students are sent to the API-driven test.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MockStoreProvider } from "@/mock/store";
import CodingTestPage from "./page";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: null, linkHash: null }));
vi.mock("next/navigation", () => ({ useParams: () => ({ roundId: "d1-r2" }), useRouter: () => nav }));
// Monaco needs a real browser; a textarea stands in for it.
vi.mock("@/features/test-runner/code-editor", () => ({
  CodeEditor: ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const session = (s: object) => window.sessionStorage.setItem("ampera.session", JSON.stringify(s));
beforeEach(() => {
  nav.push.mockReset();
  nav.replace.mockReset();
});
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

it("a demo student gets the labelled simulated judge, and Run never calls the API", async () => {
  session({ role: "STUDENT", candidateId: "d1-c0" });
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  page();
  expect(await screen.findByText(/simulated judge0/i)).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "JavaScript (Node)" })).toHaveValue("javascript");
  expect((screen.getByRole("textbox", { name: /^Code for/ }) as HTMLTextAreaElement).value).toContain("def solve()");
  fireEvent.click(screen.getByRole("button", { name: /run samples/i }));
  await waitFor(() => expect(screen.getByRole("button", { name: /run samples/i })).toBeEnabled(), { timeout: 2000 });
  expect(f).not.toHaveBeenCalled();
});

it("a student signed in through the API is sent to the server-driven test screen", async () => {
  session({ role: "STUDENT", student: { entryToken: "E", studentId: "S1", fullName: "Asha Rao", rounds: [{ roundId: "d1-r2", type: "coding", testId: "t2", durationMin: 60 }] } });
  page();
  await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/exam/d1-r2/test"));
  expect(screen.queryByText(/simulated judge0/i)).not.toBeInTheDocument();
});
