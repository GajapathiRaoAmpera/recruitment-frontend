import { expect, it } from "vitest";
import { navItems } from "./nav";

it("nav has no Paper builder or Question bank: the Round 1 paper lives on the aptitude round page", () => {
  for (const role of ["HR", "SUPER_ADMIN"] as const) {
    const labels = navItems(role).map((i) => i.label);
    expect(labels).not.toContain("Question bank");
    expect(labels).not.toContain("Paper builder");
  }
});

it("nav no longer offers PDF question banks: papers get Technical questions from the AI", () => {
  for (const role of ["HR", "SUPER_ADMIN"] as const) {
    expect(navItems(role).some((i) => i.href === "/hr/question-banks")).toBe(false);
  }
});
