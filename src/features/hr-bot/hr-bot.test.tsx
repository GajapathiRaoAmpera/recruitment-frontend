import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { HrBot } from "./hr-bot";

let pathname = "/hr";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

beforeEach(() => {
  pathname = "/hr";
});

const open = () =>
  fireEvent.click(screen.getByRole("button", { name: "Open HR assistant" }));
const ask = (text: string) => {
  const input = screen.getByLabelText("Ask the HR assistant");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest("form")!);
};

it("opens from the launcher, answers a question with steps and a link, and closes on Escape", () => {
  render(<HrBot role="HR" />);

  expect(screen.queryByRole("dialog")).toBeNull();
  open();
  expect(
    screen.getByRole("dialog", { name: "HR assistant" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Ask the HR assistant")).toHaveFocus();

  ask("how do I create a drive");
  expect(screen.getByText(/opens a short wizard/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /New drive/ })).toHaveAttribute(
    "href",
    "/hr/drives/new",
  );
  expect(screen.getByLabelText("Ask the HR assistant")).toHaveValue("");

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Open HR assistant" }),
  ).toHaveFocus();
});

it("shows suggestions for the current page and answers a chip", () => {
  pathname = "/hr/drives/d1/rounds/r1";
  render(<HrBot role="HR" />);
  open();

  expect(screen.getByText(/You're on this round/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Advance a round (pass / fail)" }),
  );
  expect(
    screen.getByRole("link", { name: /This drive's rounds/ }),
  ).toHaveAttribute("href", "/hr/drives/d1");

  fireEvent.click(screen.getByRole("button", { name: "Start over" }));
  expect(
    screen.queryByRole("link", { name: /This drive's rounds/ }),
  ).toBeNull();
});

it("send is disabled for an empty message", () => {
  render(<HrBot role="HR" />);
  open();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
});
