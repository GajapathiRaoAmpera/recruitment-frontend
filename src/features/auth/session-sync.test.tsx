import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: true }));

import { api } from "@/api/client";
import { clearToken, getToken, setToken } from "@/lib/auth";
import { initialState, MockStoreProvider, reducer, useStore } from "@/mock/store";

function Probe() {
  const { state, ready } = useStore();
  return <p>{ready ? (state.session ? `in:${state.session.role}:${state.session.staff?.name}` : "out") : "loading"}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("staff session follows the staff token (AC-1)", () => {
  it("new tab: rebuilds the session from GET /me when a token is saved", async () => {
    setToken("tok", 600);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "u1", email: "a@x.com", full_name: "Asha", role: "hr" }), { status: 200 })));
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(screen.getByText("in:HR:Asha")).toBeInTheDocument());
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer tok");
  });

  it("no token: a stale tab session is dropped", async () => {
    window.sessionStorage.setItem("ampera.session", JSON.stringify({ role: "HR", userId: "u1" }));
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(screen.getByText("out")).toBeInTheDocument());
  });

  it("signing out (here or in another tab) drops the staff session", async () => {
    setToken("tok", 600);
    window.sessionStorage.setItem("ampera.session", JSON.stringify({ role: "HR", userId: "u1", staff: { name: "Asha" } }));
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(screen.getByText("in:HR:Asha")).toBeInTheDocument());
    act(() => clearToken());
    await waitFor(() => expect(screen.getByText("out")).toBeInTheDocument());
  });

  it("another tab removing the token signs this one out", async () => {
    setToken("tok", 600);
    window.sessionStorage.setItem("ampera.session", JSON.stringify({ role: "HR", userId: "u1", staff: { name: "Asha" } }));
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(screen.getByText("in:HR:Asha")).toBeInTheDocument());
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: "campushire.staffToken", newValue: null })));
    await waitFor(() => expect(screen.getByText("out")).toBeInTheDocument());
  });

  it("staff sign-out leaves a student session alone", () => {
    const student = reducer(initialState, { type: "login", session: { role: "STUDENT", candidateId: "c1" } });
    expect(reducer(student, { type: "staffSignedOut" }).session).toEqual({ role: "STUDENT", candidateId: "c1" });
  });

  it("a 401 for a sent token clears it", async () => {
    setToken("expired", 600);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "INVALID_TOKEN", message: "Sign in again", details: {} } }), { status: 401 })));
    await expect(api("/me")).rejects.toThrow("Sign in again");
    expect(getToken()).toBeNull();
  });
});
