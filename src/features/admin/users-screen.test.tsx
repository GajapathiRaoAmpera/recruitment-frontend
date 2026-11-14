import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({ invite: vi.fn(), update: vi.fn(), remove: vi.fn(), reload: vi.fn() }));
const users = [
  { id: "me", name: "Alex Chen", email: "alex@ampera.tech", title: "", role: "SUPER_ADMIN", active: true, lastLogin: "Today" },
  { id: "u1", name: "Priya Sharma", email: "priya@ampera.tech", title: "", role: "HR", active: true, lastLogin: "Today" },
];
vi.mock("@/features/admin/use-staff-users", () => ({ useStaffUsers: () => ({ real: true, users, loadError: undefined, ...hook }) }));
vi.mock("@/mock/store", () => ({ useStore: () => ({ state: { session: { userId: "me" } } }) }));

import { UsersScreen as UsersPage } from "./users-screen";

beforeEach(() => Object.values(hook).forEach((f) => f.mockReset()));

it("shows invite errors on the field that is wrong, and Enter submits", async () => {
  render(<UsersPage />);
  fireEvent.click(screen.getByRole("button", { name: /Invite user/ }));
  fireEvent.change(screen.getByLabelText(/^Full name/), { target: { value: "Maya" } });
  fireEvent.change(screen.getByLabelText(/^Work email/), { target: { value: "priya@ampera.tech" } });
  fireEvent.submit(screen.getByLabelText(/^Work email/).closest("form")!);
  expect(await screen.findByText("Someone already has an account with this email.")).toBeInTheDocument();
  expect(hook.invite).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Work email/), { target: { value: " maya@ampera.tech " } });
  expect(screen.queryByText("Someone already has an account with this email.")).not.toBeInTheDocument();
  hook.invite.mockResolvedValue({});
  fireEvent.submit(screen.getByLabelText(/^Work email/).closest("form")!);
  await waitFor(() => expect(hook.invite).toHaveBeenCalledWith(expect.objectContaining({ name: "Maya", email: "maya@ampera.tech" }), true));
});

it("asks before deactivating someone", async () => {
  hook.update.mockResolvedValue(undefined);
  render(<UsersPage />);
  fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
  expect(hook.update).not.toHaveBeenCalled();
  const dialog = await screen.findByRole("alertdialog", { name: "Deactivate Priya Sharma?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Deactivate" }));
  await waitFor(() => expect(hook.update).toHaveBeenCalledWith(users[1], { active: false }));
});

it("asks once more before making someone a Super Admin", async () => {
  hook.update.mockResolvedValue(undefined);
  render(<UsersPage />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText("Role"), { target: { value: "SUPER_ADMIN" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alertdialog", { name: "Make Priya Sharma a Super Admin?" })).toBeInTheDocument();
  expect(hook.update).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Make Super Admin" }));
  await waitFor(() => expect(hook.update).toHaveBeenCalledWith(users[1], { name: "Priya Sharma", role: "SUPER_ADMIN" }));
});
