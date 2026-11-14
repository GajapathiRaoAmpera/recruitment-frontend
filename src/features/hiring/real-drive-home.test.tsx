import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ driveId: "d1" }) }));
const session = vi.hoisted(() => ({ role: "SUPER_ADMIN" as "SUPER_ADMIN" | "HR" }));
vi.mock("@/mock/store", () => ({ useStore: () => ({ state: { session } }) }));
const api = vi.hoisted(() => ({ getDrive: vi.fn(), listRounds: vi.fn(), reassignDrive: vi.fn(), listHrOwners: vi.fn(), downloadDriveReport: vi.fn() }));
vi.mock("@/api/hiring", async (orig) => ({ ...(await orig<typeof import("@/api/hiring")>()), ...api }));

import { RealDriveHome } from "./real-drive-home";

const drive = (ownerId: string, ownerName: string) => ({ id: "d1", company: "Ampera", campus: "ABC", roleTitle: "SWE", jdText: "", status: "active", candidates: 0, ownerId, ownerName });

beforeEach(() => {
  session.role = "SUPER_ADMIN";
  Object.values(api).forEach((f) => f.mockReset());
  api.getDrive.mockResolvedValue(drive("hr-1", "Priya Sharma"));
  api.listRounds.mockResolvedValue([]);
  api.listHrOwners.mockResolvedValue([
    { id: "hr-1", name: "Priya Sharma", email: "priya@ampera.tech" },
    { id: "hr-2", name: "Sneha Rao", email: "sneha@ampera.tech" },
  ]);
});

it("shows who runs the drive and lets a Super Admin hand it to another HR", async () => {
  api.reassignDrive.mockResolvedValue(drive("hr-2", "Sneha Rao"));
  render(<RealDriveHome />);
  expect(await screen.findByText(/Run by Priya Sharma/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Change HR/ }));
  const dialog = await screen.findByRole("dialog", { name: "Change who runs this drive" });
  await within(dialog).findByRole("option", { name: "Sneha Rao (sneha@ampera.tech)" });
  expect(within(dialog).queryByRole("option", { name: /Priya Sharma/ })).not.toBeInTheDocument(); // the current owner isn't offered
  fireEvent.click(within(dialog).getByRole("button", { name: "Move drive" }));
  expect(await within(dialog).findByText("Choose who runs this drive.")).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText(/^Who runs this drive\?/), { target: { value: "hr-2" } });
  api.getDrive.mockResolvedValue(drive("hr-2", "Sneha Rao"));
  fireEvent.click(within(dialog).getByRole("button", { name: "Move drive" }));
  await waitFor(() => expect(api.reassignDrive).toHaveBeenCalledWith("d1", "hr-2"));
  expect(await screen.findByText(/Run by Sneha Rao/)).toBeInTheDocument();
});

it("lists rounds with readable names and sends the shortlist round to the resume review", async () => {
  api.listRounds.mockResolvedValue([
    { id: "r0", position: 0, type: "shortlist", status: "active" },
    { id: "r1", position: 1, type: "ai_interview", status: "pending" },
  ]);
  render(<RealDriveHome />);
  expect(await screen.findByRole("link", { name: "Review resumes" })).toHaveAttribute("href", "/hr/drives/d1/candidates");
  expect(screen.getByRole("link", { name: "View progress" })).toHaveAttribute("href", "/hr/drives/d1/rounds/r1");
  expect(screen.getByText("Resume shortlist")).toBeInTheDocument();
  expect(screen.getByText("Not started")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Shortlist" })).not.toBeInTheDocument();
});

it("gives HR no way to move a drive", async () => {
  session.role = "HR";
  render(<RealDriveHome />);
  await screen.findByText(/Run by Priya Sharma/);
  expect(screen.queryByRole("button", { name: /Change HR/ })).not.toBeInTheDocument();
});

it("offers the drive report only once the drive is closed", async () => {
  session.role = "HR";
  render(<RealDriveHome />);
  await screen.findByText(/Run by Priya Sharma/);
  expect(screen.queryByRole("button", { name: /Download report/ })).not.toBeInTheDocument();
});

it("downloads the report for a closed drive", async () => {
  session.role = "HR";
  api.getDrive.mockResolvedValue({ ...drive("hr-1", "Priya Sharma"), status: "closed" });
  api.downloadDriveReport.mockResolvedValue(undefined);
  render(<RealDriveHome />);
  fireEvent.click(await screen.findByRole("button", { name: /Download report/ }));
  await waitFor(() => expect(api.downloadDriveReport).toHaveBeenCalledWith("d1", "Ampera-SWE-report.pdf"));
});
