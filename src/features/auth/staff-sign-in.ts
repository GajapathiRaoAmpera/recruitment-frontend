import { homePath, portalOf, type Portal } from "@/mock/auth";
import type { Session, StaffRole, StaffUser } from "@/mock/types";
import { api, ApiError } from "@/api/client";
import { supabase } from "@/lib/supabase";

export type ApiUser = { id: string; email: string; full_name: string; role: "hr" | "super_admin"; is_active?: boolean };

export const toStaff = (u: ApiUser): StaffUser => {
  const role: StaffRole = u.role === "super_admin" ? "SUPER_ADMIN" : "HR";
  return { id: u.id, name: u.full_name, email: u.email, title: role === "SUPER_ADMIN" ? "Super Admin" : "HR", role, active: u.is_active ?? true, lastLogin: "—" };
};

type Result = { session: Session; home: string } | { error: string };

/** Ask GET /me who the current Supabase user is. On any failure the Supabase session is ended. */
export async function loadStaffSession(): Promise<Result> {
  try {
    const staff = toStaff(await api<ApiUser>("/me"));
    return { session: { role: staff.role, userId: staff.id, staff }, home: homePath[portalOf(staff.role)] };
  } catch (e) {
    await supabase?.auth.signOut();
    if (e instanceof ApiError && e.code === "NOT_STAFF") return { error: "This account has no access to Campus Hire yet. Ask a Super Admin to add you." };
    return { error: "Signed in, but the Campus Hire server didn't answer. Try again in a minute." };
  }
}

/**
 * Real HR/Admin sign-in (D3): Supabase checks the password, then GET /me says who this is.
 * The role comes from the API, never from the browser.
 */
export async function signInStaff(portal: Exclude<Portal, "student">, email: string, password: string): Promise<Result> {
  if (!supabase) return { error: "Sign-in isn't configured. Ask the team for the Supabase settings." };
  if (!email.trim() || !password) return { error: "Enter your work email and password." };
  const mismatch = { error: `That email and password don't match ${portal === "admin" ? "a Super Admin" : "an HR"} account.` };

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return error.code === "invalid_credentials" ? mismatch : { error: `Couldn't sign in (${error.message}). Try again.` };

  const res = await loadStaffSession();
  // Same message as a wrong password: each login page is for one role only.
  if ("session" in res && portalOf(res.session.role) !== portal) return (await supabase.auth.signOut(), mismatch);
  return res;
}
