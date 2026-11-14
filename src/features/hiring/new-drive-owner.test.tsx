import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

// Real mode (Supabase configured): a Super Admin picks which HR runs the new drive.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const session = vi.hoisted(() => ({ role: "SUPER_ADMIN" as "SUPER_ADMIN" | "HR" }));
vi.mock("@/mock/store", () => ({ useStore: () => ({ state: { session }, dispatch: vi.fn() }) }));
const api = vi.hoisted(() => ({ createDrive: vi.fn(), listHrOwners: vi.fn() }));
vi.mock("@/api/hiring", async (orig) => ({ ...(await orig<typeof import("@/api/hiring")>()), ...api }));
vi.mock("@/features/hiring/import-panel", () => ({ ImportPanel: () => <p>import panel</p> }));

import { NewDriveScreen } from "./new-drive-screen";

beforeEach(() => {
  localStorage.clear();
  session.role = "SUPER_ADMIN";
  api.createDrive.mockReset().mockResolvedValue({ id: "d1" });
  api.listHrOwners.mockReset().mockResolvedValue([{ id: "hr-1", name: "Priya Sharma", email: "priya@ampera.tech" }]);
});

const fill = () => {
  fireEvent.change(screen.getByLabelText(/^Campus/), { target: { value: "ABC College" } });
  fireEvent.change(screen.getByLabelText(/^Role title/), { target: { value: "SWE" } });
  fireEvent.change(screen.getByLabelText(/^Job description/), { target: { value: "Build and ship web services in Java." } });
};

it("makes a Super Admin choose the HR who runs the drive, and sends it", async () => {
  render(<NewDriveScreen />);
  fill();
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  expect(await screen.findByText("Choose who runs this drive.")).toBeInTheDocument();

  const picker = screen.getByLabelText(/^Who runs this drive\?/);
  await screen.findByRole("option", { name: "Priya Sharma (priya@ampera.tech)" });
  fireEvent.change(picker, { target: { value: "hr-1" } });
  expect(screen.queryByText("Choose who runs this drive.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Continue/ })); // → rounds
  fireEvent.click(screen.getByRole("button", { name: /Continue/ })); // → review
  expect(screen.getByText("Priya Sharma (priya@ampera.tech)")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Create drive/ }));
  await waitFor(() => expect(api.createDrive).toHaveBeenCalledWith(expect.objectContaining({ ownerId: "hr-1" })));
  expect(await screen.findByText(/Priya Sharma runs it and now sees it in their HR portal/)).toBeInTheDocument();
});

it("lets a Super Admin keep the drive, sending no owner", async () => {
  render(<NewDriveScreen />);
  fill();
  fireEvent.change(screen.getByLabelText(/^Who runs this drive\?/), { target: { value: "me" } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("button", { name: /Create drive/ }));
  await waitFor(() => expect(api.createDrive).toHaveBeenCalled());
  expect(api.createDrive.mock.calls[0]![0].ownerId).toBeUndefined();
});

it("shows HR no picker: they always own what they create", async () => {
  session.role = "HR";
  render(<NewDriveScreen />);
  expect(screen.queryByLabelText(/^Who runs this drive\?/)).not.toBeInTheDocument();
  fill();
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  fireEvent.click(screen.getByRole("button", { name: /Create drive/ }));
  await waitFor(() => expect(api.createDrive).toHaveBeenCalled());
  expect(api.createDrive.mock.calls[0]![0].ownerId).toBeUndefined();
  expect(api.listHrOwners).not.toHaveBeenCalled();
});
