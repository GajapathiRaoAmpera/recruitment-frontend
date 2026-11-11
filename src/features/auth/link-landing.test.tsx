import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The page was opened from an invite email / copied invite link (implicit flow puts tokens in the hash).
const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: { access_token: "tok" } } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth }, linkHash: "#access_token=tok&type=invite" }));

import { MockStoreProvider, useStore } from "@/mock/store";

function Probe() {
  const { state, ready } = useStore();
  return <p>{ready ? (state.session ? "signed-in" : "signed-out") : "loading"}</p>;
}

const realLocation = window.location;
afterEach(() => Object.defineProperty(window, "location", { value: realLocation, configurable: true }));

describe("invite/reset links always go through Set your password", () => {
  it("landing anywhere else redirects to /set-password with the link tokens and does not sign in", async () => {
    const replace = vi.fn();
    Object.defineProperty(window, "location", { value: { pathname: "/student/login", replace }, configurable: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "u1", email: "v@x.com", full_name: "V", role: "hr" }), { status: 200 })));
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/set-password#access_token=tok&type=invite"));
    expect(screen.queryByText("signed-in")).toBeNull();
    expect(fetch).not.toHaveBeenCalled(); // no GET /me: the account is not usable until a password is saved
  });

  it("on /set-password itself: no redirect, no sign-in (the page saves the password first)", async () => {
    const replace = vi.fn();
    Object.defineProperty(window, "location", { value: { pathname: "/set-password", replace }, configurable: true });
    render(<MockStoreProvider><Probe /></MockStoreProvider>);
    await waitFor(() => expect(screen.getByText("signed-out")).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });
});
