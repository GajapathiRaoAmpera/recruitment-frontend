import type { State } from "./store";
import type { Role, Session } from "./types";

/** Each role signs in at its own URL and only that role is accepted there. */
export type Portal = "student" | "hr" | "admin";

export const loginPath: Record<Portal, string> = { student: "/student/login", hr: "/hr/login", admin: "/admin/login" };
export const homePath: Record<Portal, string> = { student: "/student", hr: "/hr", admin: "/admin" };
export const portalOf = (role: Role): Portal => (role === "STUDENT" ? "student" : role === "SUPER_ADMIN" ? "admin" : "hr");

/**
 * shortcut: any non-empty staff password is accepted; the API checks it for real (POST /auth/login, D3).
 */
export function signIn(state: State, portal: Portal, identifier: string, secret: string): { session: Session; home: string } | { error: string } {
  const id = identifier.trim();

  if (portal === "student") {
    if (!id || !secret) return { error: "Enter your Student ID and date of birth." };
    const c = state.candidates.find((x) => x.studentId.toLowerCase() === id.toLowerCase() && x.dob === secret);
    // Same message for unknown ID and wrong DOB so the form can't be used to probe IDs.
    if (!c) return { error: "Student ID and date of birth don't match your registration form." };
    return { session: { role: "STUDENT", candidateId: c.id }, home: homePath.student };
  }

  if (!id || !secret) return { error: "Enter your work email and password." };
  const user = state.staff.find((u) => u.email.toLowerCase() === id.toLowerCase());
  // Accounts of the other staff role get the same message as unknown ones: this page is for one role only.
  if (!user || portalOf(user.role) !== portal) return { error: `That email and password don't match ${portal === "admin" ? "a Super Admin" : "an HR"} account.` };
  if (!user.active) return { error: "This account is deactivated. Ask a Super Admin to reactivate it." };
  return { session: { role: user.role, userId: user.id }, home: homePath[portal] };
}
