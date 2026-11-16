import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import { Field } from "./field";
import { FormattedText, RichTextArea } from "./rich-text";

function Editor({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <Field label="Job description">
      <RichTextArea value={v} onChange={setV} />
    </Field>
  );
}

it("bolds the selected words and keeps the field label wired", () => {
  render(<Editor initial="Knows Python well" />);
  const box = screen.getByLabelText("Job description") as HTMLTextAreaElement;
  box.setSelectionRange(6, 12);
  fireEvent.click(screen.getByRole("button", { name: "Bold (Ctrl+B)" }));
  expect(box.value).toBe("Knows **Python** well");
});

it("numbers every selected line and Ctrl+I italicises", () => {
  render(<Editor initial={"SQL\nDocker"} />);
  const box = screen.getByLabelText("Job description") as HTMLTextAreaElement;
  box.setSelectionRange(0, box.value.length);
  fireEvent.click(screen.getByRole("button", { name: "Numbered list" }));
  expect(box.value).toBe("1. SQL\n2. Docker");

  box.setSelectionRange(3, 6);
  fireEvent.keyDown(box, { key: "i", ctrlKey: true });
  expect(box.value).toBe("1. *SQL*\n2. Docker");
});

it("shows headings, lists and emphasis, and leaves pasted HTML as text", () => {
  const { container } = render(
    <FormattedText text={"## Skills\n- **Python**\n- *React*\n1. Apply\n\nPlain line <script>alert(1)</script>"} />,
  );
  expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
  expect(container.querySelector("ul strong")).toHaveTextContent("Python");
  expect(container.querySelector("ul em")).toHaveTextContent("React");
  expect(container.querySelectorAll("ul li")).toHaveLength(2);
  expect(container.querySelector("ol li")).toHaveTextContent("Apply");
  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByText(/Plain line <script>/)).toBeInTheDocument();
});
