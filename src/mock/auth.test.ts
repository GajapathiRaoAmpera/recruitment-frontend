import { describe, expect, it } from "vitest";
import { signIn } from "./auth";
import { DEMO_STUDENT } from "./data";
import { initialState } from "./store";

describe("each login URL accepts only its own role (AC-1)", () => {
  it("HR login accepts HR and rejects Super Admin", () => {
    expect(signIn(initialState, "hr", "priya.sharma@ampera.tech", "x")).toMatchObject({ session: { role: "HR" }, home: "/hr" });
    expect(signIn(initialState, "hr", "alex.chen@ampera.tech", "x")).toHaveProperty("error");
  });

  it("Admin login accepts Super Admin and rejects HR", () => {
    expect(signIn(initialState, "admin", "ALEX.CHEN@ampera.tech", "x")).toMatchObject({ session: { role: "SUPER_ADMIN" }, home: "/admin" });
    expect(signIn(initialState, "admin", "priya.sharma@ampera.tech", "x")).toHaveProperty("error");
  });

  it("blocks deactivated staff", () => {
    expect(signIn(initialState, "hr", "anita.d@ampera.tech", "x")).toHaveProperty("error");
  });

  it("student login uses Student ID + DOB and hides which part was wrong", () => {
    expect(signIn(initialState, "student", DEMO_STUDENT.studentId, DEMO_STUDENT.dob)).toMatchObject({ session: { role: "STUDENT" }, home: "/student" });
    expect(signIn(initialState, "student", DEMO_STUDENT.studentId, "2000-01-01")).toEqual(signIn(initialState, "student", "NOPE999", DEMO_STUDENT.dob));
    expect(signIn(initialState, "student", "priya.sharma@ampera.tech", "x")).toHaveProperty("error");
  });
});
