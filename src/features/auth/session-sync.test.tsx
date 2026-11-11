import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  listener: undefined as undefined | ((event: string) => void),
  onAuthStateChange: vi.fn((cb: (event: string) => void) => {
    auth.listener = cb;
    return { data: { subscription: { unsubscribe() {} } } };
  }),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth }, linkHash: null }));

import { api } from "@/api/client";
import { initialState, MockStoreProvider, reducer, useStore } from "@/mock/store";

function Probe() {
  const { state, ready } = useStore();
  return <p>{ready ? (state.session ? `in:${state.session.role}:${state.session.staff?.name}` : "out") : "loading"}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("staff session follows Supabase (AC-1)", () => {
  it("new tab: rebuilds the session from GET /me when Supabase is signed in", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "u1", email: "a@x.com", full_name: "Asha", role: "hr" }), { status: 200 })));
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(screen.getByText("in:HR:Asha")).toBeInTheDocument());
  });

  it("no Supabase session: a stale tab session is dropped", async () => {
    window.sessionStorage.setItem("ampera.session", JSON.stringify({ role: "HR", userId: "u1" }));
    auth.getSession.mockResolvedValue({ data: { session: null } });
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(screen.getByText("out")).toBeInTheDocument());
  });

  it("Supabase SIGNED_OUT (other tab, dead refresh token) signs the staff user out", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
    window.sessionStorage.setItem("ampera.session", JSON.stringify({ role: "HR", userId: "u1", staff: { name: "Asha" } }));
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(screen.getByText("in:HR:Asha")).toBeInTheDocument());
    auth.listener!("SIGNED_OUT");
    await waitFor(() => expect(screen.getByText("out")).toBeInTheDocument());
  });

  it("SIGNED_OUT leaves a student session alone", () => {
    const student = reducer(initialState, { type: "login", session: { role: "STUDENT", candidateId: "c1" } });
    expect(reducer(student, { type: "staffSignedOut" }).session).toEqual({ role: "STUDENT", candidateId: "c1" });
  });

  it("a 401 from the API ends this browser's Supabase session only", async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "expired" } } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "INVALID_TOKEN", message: "Sign in again", details: {} } }), { status: 401 })));
    await expect(api("/me")).rejects.toThrow("Sign in again");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
