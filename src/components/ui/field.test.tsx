import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";

it("shows the hint in an info tooltip next to the label, still read out with the input", () => {
  render(
    <Field label="Skills" hint="Comma separated.">
      <Input />
    </Field>,
  );
  const input = screen.getByLabelText("Skills");
  const tip = screen.getByRole("tooltip");
  expect(tip).toHaveTextContent("Comma separated.");
  expect(input.getAttribute("aria-describedby")).toContain(tip.id); // screen readers get it with the field
  expect(tip.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); // sits by the label, not as a line under the box

  const info = screen.getByRole("button", { name: "More info" });
  expect(info).toHaveAttribute("type", "button"); // never submits the form
  info.focus();
  fireEvent.keyDown(info, { key: "Escape" });
  expect(info).not.toHaveFocus();
});

it("renders no info button without a hint", () => {
  render(
    <Field label="Name">
      <Input />
    </Field>,
  );
  expect(screen.queryByRole("button", { name: "More info" })).not.toBeInTheDocument();
});
