import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

import { MockStoreProvider } from "@/mock/store";
import { useStaffUsers } from "./use-staff-users";

const hr = { id: "u-1", email: "hr@x.com", full_name: "Asha", role: "hr", is_active: true };
const wrapper = ({ children }: { children: ReactNode }) => {
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      <MockStoreProvider>{children}</MockStoreProvider>
    </QueryClientProvider>
  );
};

describe("Users page data via /admin/users (FR-27)", () => {
  it("loads, invites and deactivates through the API", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ id: "u-2", email: "new@x.com", full_name: "New", role: "super_admin", is_active: true }), { status: 201 });
      if (init?.method === "PATCH") return new Response(JSON.stringify({ ...hr, is_active: false }), { status: 200 });
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
    await waitFor(() => expect(result.current.users!.map((u) => u.role)).toEqual(["HR", "SUPER_ADMIN"]));

    await act(async () => void (await result.current.toggle(result.current.users![0])));
    expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/admin/users/u-1");
    await waitFor(() => expect(result.current.users![0].active).toBe(false));
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
