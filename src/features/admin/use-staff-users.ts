"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { toStaff, type ApiUser } from "@/features/auth/staff-sign-in";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/mock/store";
import type { StaffRole, StaffUser } from "@/mock/types";

export type InviteForm = { name: string; email: string; title: string; role: StaffRole };
export type UserChanges = Partial<Pick<StaffUser, "name" | "role" | "active">>;

const apiRole = (r: StaffRole) => (r === "SUPER_ADMIN" ? "super_admin" : "hr");
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * Staff CRUD for the Users page: /admin/users when Supabase is configured, the mock store otherwise.
 * invite/update/remove resolve to an error message, or undefined on success.
 */
export function useStaffUsers() {
  const { state, dispatch } = useStore();
  const real = supabase !== null;
  const [users, setUsers] = useState<StaffUser[]>();
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (!real) return;
    api<{ items: ApiUser[] }>("/admin/users")
      .then((r) => setUsers(r.items.map(toStaff)))
      .catch((e: Error) => setLoadError(e.message));
  }, [real]);

  if (!real) {
    return {
      real,
      users: state.staff,
      loadError: undefined,
      invite: async (f: InviteForm) => void dispatch({ type: "addUser", user: f }),
      update: async (u: StaffUser, c: UserChanges) => {
        if (c.active !== undefined && c.active !== u.active) dispatch({ type: "toggleUser", id: u.id });
        if (c.name !== undefined || c.role !== undefined) dispatch({ type: "updateUser", id: u.id, changes: { name: c.name, role: c.role } });
        return undefined;
      },
      remove: async (u: StaffUser) => void dispatch({ type: "deleteUser", id: u.id }),
    };
  }

  const attempt = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      return (e as Error).message;
    }
  };
  return {
    real,
    users,
    loadError,
    invite: (f: InviteForm) =>
      attempt(async () => {
        const created = toStaff(await api<ApiUser>("/admin/users", json("POST", { email: f.email.trim(), full_name: f.name, role: apiRole(f.role) })));
        setUsers((list) => [...(list ?? []), created]);
      }),
    update: (u: StaffUser, c: UserChanges) =>
      attempt(async () => {
        const body = { full_name: c.name, role: c.role && apiRole(c.role), is_active: c.active };
        const saved = toStaff(await api<ApiUser>(`/admin/users/${u.id}`, json("PATCH", body)));
        setUsers((list) => list?.map((x) => (x.id === u.id ? saved : x)));
      }),
    remove: (u: StaffUser) =>
      attempt(async () => {
        await api(`/admin/users/${u.id}`, { method: "DELETE" });
        setUsers((list) => list?.filter((x) => x.id !== u.id));
      }),
  };
}
