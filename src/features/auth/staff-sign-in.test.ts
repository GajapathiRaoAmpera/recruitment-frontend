import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

import { signInStaff } from "./staff-sign-in";

const me = (role: string) => ({ id: "u-1", email: "a@x.com", full_name: "Asha Rao", role });
const reply = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));

beforeEach(() => {
  vi.clearAllMocks();
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
});

describe("real staff sign-in: Supabase password, role from GET /me (AC-1)", () => {
  it("HR signs in at /hr/login and the token is sent to /me", async () => {
    reply(200, me("hr"));
    const res = await signInStaff("hr", " A@X.com ", "pw");
    expect(res).toMatchObject({ home: "/hr", session: { role: "HR", userId: "u-1", staff: { name: "Asha Rao" } } });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@x.com", password: "pw" });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/api/v1/me");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok");
  });

  it("Super Admin signs in at /admin/login", async () => {
    reply(200, me("super_admin"));
    expect(await signInStaff("admin", "a@x.com", "pw")).toMatchObject({ home: "/admin", session: { role: "SUPER_ADMIN" } });
  });

  it("wrong password gives the role's mismatch message", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", message: "Invalid login credentials" } });
    expect(await signInStaff("hr", "a@x.com", "bad")).toEqual({ error: "That email and password don't match an HR account." });
  });

  it("an HR account at the admin page is rejected like a wrong password, and signed out", async () => {
    reply(200, me("hr"));
    expect(await signInStaff("admin", "a@x.com", "pw")).toEqual({ error: "That email and password don't match a Super Admin account." });
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("a Supabase user missing from users gets NOT_STAFF and is signed out", async () => {
    reply(403, { error: { code: "NOT_STAFF", message: "no", details: {} } });
    expect(await signInStaff("hr", "a@x.com", "pw")).toHaveProperty("error", expect.stringContaining("no access"));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("API down: signed out with a retry message", async () => {
    reply(502, "bad gateway");
    expect(await signInStaff("hr", "a@x.com", "pw")).toHaveProperty("error", expect.stringContaining("Try again"));
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("empty fields never call Supabase", async () => {
    expect(await signInStaff("hr", "", "")).toHaveProperty("error");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
