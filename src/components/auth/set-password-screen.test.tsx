import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ linkHash: null as string | null }));
const auth = vi.hoisted(() => ({
  // The browser already holds someone else's session (a signed-in Super Admin).
  getSession: vi.fn(async () => ({ data: { session: { access_token: "admin-token", user: { email: "admin@x.com" } } } })),
  onAuthStateChange: vi.fn((cb: (e: string, s: unknown) => void) => {
    cb("INITIAL_SESSION", { access_token: "admin-token", user: { email: "admin@x.com" } });
    return { data: { subscription: { unsubscribe() {} } } };
  }),
  setSession: vi.fn(async ({ access_token }: { access_token: string }) => ({
    data: { session: { access_token, user: { email: "invited@x.com" } } },
    error: null,
  })),
  updateUser: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth },
  get linkHash() {
    return env.linkHash;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

import { MockStoreProvider } from "@/mock/store";
import { SetPasswordScreen } from "./set-password-screen";

const realLocation = window.location;
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: { ...new URL("http://localhost:3000/set-password"), href: "http://localhost:3000/set-password", origin: "http://localhost:3000", pathname: "/set-password", replace: vi.fn() }, configurable: true });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "u2", email: "invited@x.com", full_name: "I", role: "hr" }), { status: 200 })));
});
afterEach(() => Object.defineProperty(window, "location", { value: realLocation, configurable: true }));

const page = () => render(<MockStoreProvider><SetPasswordScreen /></MockStoreProvider>);

describe("Set your password only ever changes the account in the link", () => {
  it("uses the link's tokens, names the account, then saves", async () => {
    env.linkHash = "#access_token=link-at&refresh_token=link-rt&type=invite";
    page();
    expect(await screen.findByText("invited@x.com")).toBeInTheDocument();
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: "link-at", refresh_token: "link-rt" });

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "Strong-pass-1" } });
    fireEvent.change(screen.getByLabelText("Repeat password"), { target: { value: "Strong-pass-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    await waitFor(() => expect(auth.updateUser).toHaveBeenCalledWith({ password: "Strong-pass-1" }));
    expect(auth.setSession.mock.invocationCallOrder[0]).toBeLessThan(auth.updateUser.mock.invocationCallOrder[0]);
  });

  it("without a link, an existing session never gets the form (no changing the signed-in admin's password)", async () => {
    env.linkHash = null;
    page();
    expect(await screen.findByText(/expired or was already used/)).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
