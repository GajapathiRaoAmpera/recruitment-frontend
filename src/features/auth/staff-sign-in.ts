import { homePath, portalOf, type Portal } from "@/mock/auth";
import type { Session, StaffRole } from "@/mock/types";
import { api, ApiError } from "@/api/client";
import { supabase } from "@/lib/supabase";

type Me = { id: string; email: string; full_name: string; role: "hr" | "super_admin" };

/**
 * Real HR/Admin sign-in (D3): Supabase checks the password, then GET /me says who this is.
 * The role comes from the API, never from the browser.
 */
export async function signInStaff(portal: Exclude<Portal, "student">, email: string, password: string): Promise<{ session: Session; home: string } | { error: string }> {
  if (!supabase) return { error: "Sign-in isn't configured. Ask the team for the Supabase settings." };
  if (!email.trim() || !password) return { error: "Enter your work email and password." };
  const mismatch = { error: `That email and password don't match ${portal === "admin" ? "a Super Admin" : "an HR"} account.` };

  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return error.code === "invalid_credentials" ? mismatch : { error: `Couldn't sign in (${error.message}). Try again.` };

  try {
    const me = await api<Me>("/me");
    const role: StaffRole = me.role === "super_admin" ? "SUPER_ADMIN" : "HR";
    // Same message as a wrong password: each login page is for one role only.
    if (portalOf(role) !== portal) return (await supabase.auth.signOut(), mismatch);
    const staff = { id: me.id, name: me.full_name, email: me.email, title: role === "SUPER_ADMIN" ? "Super Admin" : "HR", role, active: true, lastLogin: "Now" };
    return { session: { role, userId: me.id, staff }, home: homePath[portal] };
  } catch (e) {
    await supabase.auth.signOut();
    if (e instanceof ApiError && e.code === "NOT_STAFF") return { error: "This account has no access to Campus Hire yet. Ask a Super Admin to add you." };
    return { error: "Signed in, but the Campus Hire server didn't answer. Try again in a minute." };
  }
}
