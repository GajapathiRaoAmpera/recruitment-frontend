import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Hint, InlineEmpty, Notice } from "./notice";

it("Notice announces results politely and alerts as alerts, with title, text and actions", () => {
  render(
    <>
      <Notice role="status" tone="success" title="Saved" actions={<button>Next</button>}>
        All good.
      </Notice>
      <Notice role="alert" tone="danger" title="Failed" />
    </>,
  );
  const status = screen.getByRole("status");
  expect(status).toHaveAttribute("aria-live", "polite");
  expect(status).toHaveTextContent("SavedAll good.Next");
  expect(screen.getByRole("alert")).toHaveTextContent("Failed");
  expect(screen.getByRole("alert")).not.toHaveAttribute("aria-live");
});

it("InlineEmpty and Hint render their text with a decorative icon", () => {
  render(
    <>
      <InlineEmpty>No scores yet.</InlineEmpty>
      <Hint role="alert" tone="danger">
        Fix this.
      </Hint>
    </>,
  );
  expect(screen.getByText("No scores yet.")).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent("Fix this.");
  expect(screen.getByRole("alert").querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});
