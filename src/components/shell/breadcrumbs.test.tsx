import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const getDrive = vi.hoisted(() => vi.fn());
vi.mock("@/api/hiring", () => ({ getDrive }));

import { Breadcrumbs, BreadcrumbsProvider, useBreadcrumbs, type Crumb } from "./breadcrumbs";

function Page({ crumbs }: { crumbs: Crumb[] }) {
  useBreadcrumbs(crumbs);
  return null;
}
const view = (crumbs: Crumb[]) =>
  render(
    <BreadcrumbsProvider>
      <Breadcrumbs />
      <Page crumbs={crumbs} />
    </BreadcrumbsProvider>,
  );

beforeEach(() => getDrive.mockReset());

it("names the drive (role · campus) instead of a generic 'Drive', and shows the trail only once it is known", async () => {
  let answer!: (d: unknown) => void;
  getDrive.mockReturnValue(new Promise((r) => (answer = r)));
  view([{ label: "Drives", href: "/hr/drives" }, { driveId: "d1", href: "/hr/drives/d1" }, { label: "Aptitude test" }]);

  expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull(); // no "Drives > Drive" stand-in
  answer({ roleTitle: "SDE Intern", campus: "VIT Vellore" });

  expect(await screen.findByRole("link", { name: "SDE Intern · VIT Vellore" })).toHaveAttribute("href", "/hr/drives/d1");
  expect(screen.getByText("Aptitude test")).toHaveAttribute("aria-current", "page");
  expect(getDrive).toHaveBeenCalledWith("d1");
});

it("waits for a page still loading its own label", () => {
  view([{ label: "Drives", href: "/hr/drives" }, { label: undefined }]);
  expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
});

it("falls back to 'Drive' when the name can't be loaded, so the trail still works", async () => {
  getDrive.mockRejectedValueOnce(new TypeError("fetch failed"));
  view([{ label: "Drives", href: "/hr/drives" }, { driveId: "d-err" }]);
  expect(await screen.findByText("Drive")).toHaveAttribute("aria-current", "page");
});
