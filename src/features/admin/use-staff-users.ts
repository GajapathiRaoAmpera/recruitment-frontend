"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { toStaff, type ApiUser } from "@/features/auth/staff-sign-in";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/mock/store";
import type { StaffRole, StaffUser } from "@/mock/types";

export type InviteForm = { name: string; email: string; title: string; role: StaffRole };

const staffUsersKey = ["admin", "staff-users"] as const;

/**
 * Staff list for the Users page: /admin/users when Supabase is configured, the mock store otherwise.
 * invite/toggle resolve to an error message, or undefined on success.
 */
export function useStaffUsers() {
  const { state, dispatch } = useStore();
  const real = supabase !== null;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: staffUsersKey,
    queryFn: async () => (await api<{ items: ApiUser[] }>("/admin/users")).items.map(toStaff),
    enabled: real,
  });

  const inviteMutation = useMutation({
    mutationFn: (f: InviteForm) => {
      const body = JSON.stringify({ email: f.email.trim(), full_name: f.name, role: f.role === "SUPER_ADMIN" ? "super_admin" : "hr" });
      return api<ApiUser>("/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body }).then(toStaff);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<StaffUser[]>(staffUsersKey, (list) => [...(list ?? []), created]);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (u: StaffUser) => {
      const body = JSON.stringify({ is_active: !u.active });
      return api<ApiUser>(`/admin/users/${u.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body }).then(toStaff);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<StaffUser[]>(staffUsersKey, (list) => list?.map((x) => (x.id === updated.id ? updated : x)));
    },
  });

  if (!real) {
    return {
      real,
      users: state.staff,
      loadError: undefined,
      invite: async (f: InviteForm) => void dispatch({ type: "addUser", user: f }),
      toggle: async (u: StaffUser) => void dispatch({ type: "toggleUser", id: u.id }),
    };
  }

  return {
    real,
    users: query.data,
    loadError: query.error instanceof Error ? query.error.message : undefined,
    invite: async (f: InviteForm) => {
      try {
        await inviteMutation.mutateAsync(f);
      } catch (e) {
        return (e as Error).message;
      }
    },
    toggle: async (u: StaffUser) => {
      try {
        await toggleMutation.mutateAsync(u);
      } catch (e) {
        return (e as Error).message;
      }
    },
  };
}
