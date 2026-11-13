import { expect, it } from "vitest";
import { navItems } from "./nav";

it("nav shows Paper builder for HR and Super Admin, after Question bank", () => {
  for (const role of ["HR", "SUPER_ADMIN"] as const) {
    const items = navItems(role);
    const labels = items.map((i) => i.label);
    expect(labels.indexOf("Paper builder")).toBe(labels.indexOf("Question bank") + 1);
    expect(items.find((i) => i.label === "Paper builder")).toMatchObject({ href: "/hr/papers", section: "main" });
  }
});

it("nav no longer offers PDF question banks: papers get Technical questions from the AI", () => {
  for (const role of ["HR", "SUPER_ADMIN"] as const) {
    expect(navItems(role).some((i) => i.href === "/hr/question-banks")).toBe(false);
  }
});
