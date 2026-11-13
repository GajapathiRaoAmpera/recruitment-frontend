import { expect, it } from "vitest";
import { navItems } from "./nav";

it("nav shows Paper builder for HR and Super Admin, and no Question bank", () => {
  for (const role of ["HR", "SUPER_ADMIN"] as const) {
    const items = navItems(role);
    expect(items.map((i) => i.label)).not.toContain("Question bank");
    expect(items.find((i) => i.label === "Paper builder")).toMatchObject({ href: "/hr/papers", section: "main" });
  }
});

it("nav shows PDF question banks for HR and Super Admin", () => {
  for (const role of ["HR", "SUPER_ADMIN"] as const) {
    expect(navItems(role).find((i) => i.label === "PDF question banks")).toMatchObject({ href: "/hr/question-banks", section: "main" });
  }
});
