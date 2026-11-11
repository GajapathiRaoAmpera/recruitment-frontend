import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
  },
}));

import { MockStoreProvider } from "@/mock/store";
import { useStaffUsers } from "./use-staff-users";

const hr = { id: "u-1", email: "hr@x.com", full_name: "Asha", role: "hr", is_active: true };
const wrapper = ({ children }: { children: ReactNode }) => <MockStoreProvider>{children}</MockStoreProvider>;

describe("Users page data via /admin/users (FR-27)", () => {
  it("loads, invites, deactivates, edits and deletes through the API", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ id: "u-2", email: "new@x.com", full_name: "New", role: "super_admin", is_active: true }), { status: 201 });
      if (init?.method === "PATCH") return new Response(JSON.stringify({ ...hr, ...JSON.parse(init.body as string), is_active: false }), { status: 200 });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return new Response(JSON.stringify({ items: [hr], next_cursor: null }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useStaffUsers(), { wrapper });
    await waitFor(() => expect(result.current.users).toHaveLength(1));
    expect(result.current.users![0]).toMatchObject({ name: "Asha", role: "HR", active: true });

    await act(async () => {
      expect(await result.current.invite({ name: "New", email: " new@x.com ", title: "", role: "SUPER_ADMIN" })).toBeUndefined();
    });
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/v1/admin/users");
    expect(JSON.parse(init!.body as string)).toEqual({ email: "new@x.com", full_name: "New", role: "super_admin" });
    expect(result.current.users!.map((u) => u.role)).toEqual(["HR", "SUPER_ADMIN"]);

    await act(async () => void (await result.current.update(result.current.users![0], { active: false })));
    expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/admin/users/u-1");
    expect(JSON.parse(fetchMock.mock.calls[2][1]!.body as string)).toEqual({ is_active: false });
    expect(result.current.users![0].active).toBe(false);

    await act(async () => void (await result.current.update(result.current.users![0], { name: "Asha R", role: "SUPER_ADMIN" })));
    expect(JSON.parse(fetchMock.mock.calls[3][1]!.body as string)).toEqual({ full_name: "Asha R", role: "super_admin" });

    await act(async () => void (await result.current.remove(result.current.users![0])));
    expect(fetchMock.mock.calls[4]).toEqual(["/api/v1/admin/users/u-1", expect.objectContaining({ method: "DELETE" })]);
    expect(result.current.users!.map((u) => u.id)).toEqual(["u-2"]);
  });

  it("returns the API's message when an invite fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? new Response(JSON.stringify({ error: { code: "USER_EXISTS", message: "An account with this email already exists", details: {} } }), { status: 409 })
          : new Response(JSON.stringify({ items: [] }), { status: 200 }),
      ),
    );
    const { result } = renderHook(() => useStaffUsers(), { wrapper });
    await waitFor(() => expect(result.current.users).toEqual([]));
    let err: string | undefined;
    await act(async () => {
      err = await result.current.invite({ name: "X", email: "x@x.com", title: "", role: "HR" });
    });
    expect(err).toBe("An account with this email already exists");
  });
});

it("shows the API's reason when a user can't be deleted", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? new Response(JSON.stringify({ error: { code: "USER_IN_USE", message: "Deactivate them instead.", details: {} } }), { status: 409 })
        : new Response(JSON.stringify({ items: [hr] }), { status: 200 }),
    ),
  );
  const { result } = renderHook(() => useStaffUsers(), { wrapper });
  await waitFor(() => expect(result.current.users).toHaveLength(1));
  let err: string | undefined;
  await act(async () => {
    err = await result.current.remove(result.current.users![0]);
  });
  expect(err).toBe("Deactivate them instead.");
  expect(result.current.users).toHaveLength(1);
});
