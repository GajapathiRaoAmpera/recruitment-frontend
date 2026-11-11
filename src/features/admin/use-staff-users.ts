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
 * update/remove resolve to an error message, or undefined on success.
 * invite resolves to {error} or, when sendEmail is false, {link}: a one-time invite link to share.
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
      invite: async (f: InviteForm, sendEmail = true): Promise<{ error?: string; link?: string }> => {
        dispatch({ type: "addUser", user: f });
        return sendEmail ? {} : { link: "https://example.invalid/prototype-invite-link" };
      },
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
    invite: async (f: InviteForm, sendEmail = true): Promise<{ error?: string; link?: string }> => {
      try {
        const body = { email: f.email.trim(), full_name: f.name, role: apiRole(f.role), send_email: sendEmail };
        const created = await api<ApiUser & { invite_link: string | null }>("/admin/users", json("POST", body));
        setUsers((list) => [...(list ?? []), toStaff(created)]);
        return { link: created.invite_link ?? undefined };
      } catch (e) {
        return { error: (e as Error).message };
      }
    },
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
