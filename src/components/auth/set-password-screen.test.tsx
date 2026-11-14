import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ token: null as string | null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.token ? `token=${nav.token}` : "") }));
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: true }));

import { getToken, setToken } from "@/lib/auth";
import { SetPasswordScreen } from "./set-password-screen";

const reply = (status: number, body: unknown = null) => vi.stubGlobal("fetch", vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status })));
const fill = (pw: string, again = pw) => {
  fireEvent.change(screen.getByLabelText(/New password/), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText("Repeat password"), { target: { value: again } });
  fireEvent.click(screen.getByRole("button", { name: "Save password" }));
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  nav.token = "link-token";
});

describe("Set your password works only with the link's token (AC-1)", () => {
  it("posts the token with the new password, then offers sign-in", async () => {
    reply(204);
    render(<SetPasswordScreen />);
    fill("Strong-pass-1");
    await screen.findByText("Password saved");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/auth/set-password");
    expect(JSON.parse(init!.body as string)).toEqual({ token: "link-token", password: "Strong-pass-1" });
    expect(screen.getByRole("link", { name: "Sign in as HR" })).toHaveAttribute("href", "/hr/login");
  });

  it("a session already in this browser stays as it is (the API uses only the link's token)", async () => {
    setToken("admin-session", 600);
    reply(204);
    render(<SetPasswordScreen />);
    fill("Strong-pass-1");
    await screen.findByText("Password saved");
    expect(getToken()).toBe("admin-session");
  });

  it("without a token, there is no form", () => {
    nav.token = null;
    render(<SetPasswordScreen />);
    expect(screen.getByText(/expired or was already used/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/New password/)).toBeNull();
  });

  it("a used or expired link switches to the new-link message", async () => {
    reply(400, { error: { code: "LINK_INVALID", message: "x", details: {} } });
    render(<SetPasswordScreen />);
    fill("Strong-pass-1");
    expect(await screen.findByText(/expired or was already used/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("checks length and match before calling the API", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<SetPasswordScreen />);
    fill("short");
    expect(await screen.findByText("Use at least 10 characters.")).toBeInTheDocument();
    fill("long-enough-1", "different-12");
    expect(await screen.findByText("The two passwords don't match.")).toBeInTheDocument();
    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });
});
