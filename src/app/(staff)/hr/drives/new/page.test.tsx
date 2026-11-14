import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/supabase", () => ({ supabase: null }));
const dispatch = vi.hoisted(() => vi.fn());
vi.mock("@/mock/store", () => ({ useStore: () => ({ dispatch }) }));

import NewDrivePage from "./page";

beforeEach(() => {
  localStorage.clear();
  dispatch.mockReset();
});
const field = (name: string) => screen.getByLabelText(new RegExp(`^${name}`));

it("blocks Continue with per-field errors, focuses the first, and clears each error as it is fixed", async () => {
  render(<NewDrivePage />);
  fireEvent.change(field("Company"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  expect(await screen.findByText("Enter the company name.")).toBeInTheDocument();
  expect(screen.getByText("Enter the campus name.")).toBeInTheDocument();
  await vi.waitFor(() => expect(document.activeElement).toBe(field("Company")));
  fireEvent.change(field("Campus"), { target: { value: "ABC College" } });
  expect(screen.queryByText("Enter the campus name.")).not.toBeInTheDocument();
  expect(screen.getByText("Enter the company name.")).toBeInTheDocument();
});

it("validates round minutes and cut-off, and keeps at least one assessment round", () => {
  render(<NewDrivePage />);
  fireEvent.change(field("Campus"), { target: { value: "ABC College" } });
  fireEvent.change(field("Role title"), { target: { value: "SWE" } });
  fireEvent.change(field("Job description"), { target: { value: "Build and ship web services in Java." } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));

  const minutes = screen.getAllByLabelText("Minutes")[0]!;
  fireEvent.change(minutes, { target: { value: "" } });
  expect(minutes).toHaveValue(null); // emptied, not snapped to 0
  fireEvent.change(screen.getAllByLabelText("Cut-off %")[0]!, { target: { value: "150" } });
  fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
  expect(screen.getByText("5–600 minutes.")).toBeInTheDocument();
  expect(screen.getByText("0–100%.")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Remove Round 1 · Aptitude & technical" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Round 2 · Coding" }));
  expect(screen.getByRole("button", { name: "Remove Round 3 · AI interview" })).toBeDisabled();
});

it("restores an unsaved draft after a reload", () => {
  const { unmount } = render(<NewDrivePage />);
  fireEvent.change(field("Campus"), { target: { value: "XYZ Institute" } });
  unmount();
  render(<NewDrivePage />);
  expect(field("Campus")).toHaveValue("XYZ Institute");
  expect(screen.getByText("We restored the drive you were setting up.")).toBeInTheDocument();
});
