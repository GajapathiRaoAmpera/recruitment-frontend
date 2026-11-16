import { homePath, portalOf, type Portal } from "@/mock/auth";
import type { Session, StaffRole, StaffUser } from "@/mock/types";
import { api, ApiError } from "@/api/client";
import { clearToken, setToken } from "@/lib/auth";

export type ApiUser = { id: string; email: string; full_name: string; role: "hr" | "super_admin"; is_active?: boolean };

export const toStaff = (u: ApiUser): StaffUser => {
  const role: StaffRole = u.role === "super_admin" ? "SUPER_ADMIN" : "HR";
  return { id: u.id, name: u.full_name, email: u.email, title: role === "SUPER_ADMIN" ? "Super Admin" : "HR", role, active: u.is_active ?? true, lastLogin: "—" };
};

type Result = { session: Session; home: string } | { error: string };

const asSession = (u: ApiUser): { session: Session; home: string } => {
  const staff = toStaff(u);
  return { session: { role: staff.role, userId: staff.id, staff }, home: homePath[portalOf(staff.role)] };
};

/** Ask GET /me who holds the saved staff token. On any failure this browser is signed out. */
export async function loadStaffSession(): Promise<Result> {
  try {
    return asSession(await api<ApiUser>("/me"));
  } catch (e) {
    clearToken();
    if (e instanceof ApiError && e.code === "NOT_STAFF") return { error: "This account has no access to Campus Hire yet. Ask a Super Admin to add you." };
    return { error: "Signed in, but the Campus Hire server didn't answer. Try again in a minute." };
  }
}

/**
 * Email a password-reset link that opens /set-password. Resolves to an error message, or undefined.
 * The API answers 204 for unknown emails too, so the page can't be used to discover accounts.
 */
export async function requestPasswordReset(email: string): Promise<string | undefined> {
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter your work email.";
  try {
    await api("/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase() }) });
    return undefined;
  } catch {
    return "Couldn't send the email. Try again.";
  }
}

/**
 * Real HR/Admin sign-in (D3): the API checks the password and returns a staff token plus the user.
 * The role comes from the API, never from the browser.
 */
export async function signInStaff(portal: Exclude<Portal, "student">, email: string, password: string): Promise<Result> {
  if (!email.trim() || !password) return { error: "Enter your work email and password." };
  const mismatch = { error: `That email and password don't match ${portal === "admin" ? "a Super Admin" : "an HR"} account.` };
  let res: { access_token: string; expires_in: number; user: ApiUser };
  try {
    res = await api("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), password }) });
  } catch (e) {
    if (e instanceof ApiError && e.code === "INVALID_CREDENTIALS") return mismatch;
    if (e instanceof ApiError && e.code === "TOO_MANY_ATTEMPTS") return { error: e.message };
    return { error: "Couldn't sign in. Check your connection and try again." };
  }
  const out = asSession(res.user);
  // Same message as a wrong password: each login page is for one role only.
  if (portalOf(out.session.role) !== portal) return mismatch;
  setToken(res.access_token, res.expires_in);
  return out;
}
