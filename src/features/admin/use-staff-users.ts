"use client";

import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { toStaff, type ApiUser } from "@/features/auth/staff-sign-in";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/mock/store";
import type { StaffRole, StaffUser } from "@/mock/types";

export type InviteForm = { name: string; email: string; title: string; role: StaffRole };

/**
 * Staff list for the Users page: /admin/users when Supabase is configured, the mock store otherwise.
 * invite/toggle resolve to an error message, or undefined on success.
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
      toggle: async (u: StaffUser) => void dispatch({ type: "toggleUser", id: u.id }),
    };
  }

  const replace = (u: StaffUser) => setUsers((list) => list?.map((x) => (x.id === u.id ? u : x)));
  return {
    real,
    users,
    loadError,
    invite: async (f: InviteForm) => {
      try {
        const body = JSON.stringify({ email: f.email.trim(), full_name: f.name, role: f.role === "SUPER_ADMIN" ? "super_admin" : "hr" });
        const created = toStaff(await api<ApiUser>("/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body }));
        setUsers((list) => [...(list ?? []), created]);
      } catch (e) {
        return (e as Error).message;
      }
    },
    toggle: async (u: StaffUser) => {
      try {
        const body = JSON.stringify({ is_active: !u.active });
        replace(toStaff(await api<ApiUser>(`/admin/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body })));
      } catch (e) {
        return (e as Error).message;
      }
    },
  };
}
