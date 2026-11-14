import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), liveApi: true }));

import { getToken, setToken } from "@/lib/auth";
import { requestPasswordReset, signInStaff } from "./staff-sign-in";

const user = (role: string) => ({ id: "u-1", email: "a@x.com", full_name: "Asha Rao", role });
const login = (role: string) => ({ access_token: "tok", expires_in: 28800, user: user(role) });
const reply = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
const err = (code: string, message = "x") => ({ error: { code, message, details: {} } });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("real staff sign-in: password checked by POST /auth/login, role from the API (AC-1)", () => {
  it("HR signs in at /hr/login and the token is kept for later calls", async () => {
    reply(200, login("hr"));
    const res = await signInStaff("hr", " A@X.com ", "pw");
    expect(res).toMatchObject({ home: "/hr", session: { role: "HR", userId: "u-1", staff: { name: "Asha Rao" } } });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/auth/login");
    expect(JSON.parse(init!.body as string)).toEqual({ email: "a@x.com", password: "pw" });
    expect(getToken()).toBe("tok");
  });

  it("Super Admin signs in at /admin/login", async () => {
    reply(200, login("super_admin"));
    expect(await signInStaff("admin", "a@x.com", "pw")).toMatchObject({ home: "/admin", session: { role: "SUPER_ADMIN" } });
  });

  it("wrong password gives the role's mismatch message", async () => {
    reply(401, err("INVALID_CREDENTIALS"));
    expect(await signInStaff("hr", "a@x.com", "bad")).toEqual({ error: "That email and password don't match an HR account." });
    expect(getToken()).toBeNull();
  });

  it("an HR account at the admin page is rejected like a wrong password, and no token is kept", async () => {
    reply(200, login("hr"));
    expect(await signInStaff("admin", "a@x.com", "pw")).toEqual({ error: "That email and password don't match a Super Admin account." });
    expect(getToken()).toBeNull();
  });

  it("lockout shows the API's message", async () => {
    reply(429, err("TOO_MANY_ATTEMPTS", "Too many attempts. Try again in 15 minutes"));
    expect(await signInStaff("hr", "a@x.com", "pw")).toEqual({ error: "Too many attempts. Try again in 15 minutes" });
  });

  it("API down: a retry message", async () => {
    reply(502, "bad gateway");
    expect(await signInStaff("hr", "a@x.com", "pw")).toHaveProperty("error", expect.stringContaining("try again"));
  });

  it("empty fields never call the API", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await signInStaff("hr", "", "")).toHaveProperty("error");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("an expired saved token reads as signed out", () => {
    setToken("old", -1);
    expect(getToken()).toBeNull();
  });
});

describe("forgot password", () => {
  it("posts the lowercased email", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    expect(await requestPasswordReset(" Jay@X.com ")).toBeUndefined();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/auth/forgot-password");
    expect(JSON.parse(init!.body as string)).toEqual({ email: "jay@x.com" });
  });

  it("rejects a malformed email without calling the API", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await requestPasswordReset("nope")).toBe("Enter your work email.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("explains a failed request", async () => {
    reply(500, err("BOOM"));
    expect(await requestPasswordReset("a@x.com")).toContain("Try again");
  });
});
