import { render, screen } from "@testing-library/react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { expect, it } from "vitest";
import { Button } from "./button";

const svgs = (el: HTMLElement) => [...el.querySelectorAll("svg")];

it("puts the icon on the right of the label and drops its own margin", () => {
  render(
    <Button>
      <Sparkles aria-hidden size={14} style={{ marginRight: 6 }} /> Generate
    </Button>,
  );
  const btn = screen.getByRole("button", { name: "Generate" });
  expect(btn.lastElementChild?.tagName.toLowerCase()).toBe("svg");
  expect(btn.lastElementChild).toHaveClass("lucide-sparkles");
  expect((btn.lastElementChild as SVGElement).style.marginRight).toBe("");
});

it("while loading, the spinner replaces the icon on the right at the same size", () => {
  render(
    <Button loading>
      <Sparkles aria-hidden size={14} /> Generating…
    </Button>,
  );
  const btn = screen.getByRole("button", { name: "Generating…" });
  expect(btn).toBeDisabled();
  expect(btn).toHaveAttribute("aria-busy", "true");
  expect(svgs(btn)).toHaveLength(1); // spinner only, no icon beside it
  expect(btn.lastElementChild).toHaveClass("lucide-loader-circle");
  expect(btn.lastElementChild).toHaveAttribute("width", "14");
});

it("a button without an icon gets the spinner on the right; back arrows stay on the left", () => {
  render(
    <>
      <Button loading>Save notes</Button>
      <Button>
        <ArrowLeft aria-hidden size={16} /> Back
      </Button>
    </>,
  );
  expect(screen.getByRole("button", { name: "Save notes" }).lastElementChild).toHaveClass("lucide-loader-circle");
  expect(screen.getByRole("button", { name: "Back" }).firstElementChild).toHaveClass("lucide-arrow-left");
});

it("arranges the icon inside an asChild link too", () => {
  render(
    <Button asChild>
      <a href="/x">
        <Sparkles aria-hidden size={16} /> Open
      </a>
    </Button>,
  );
  expect(screen.getByRole("link", { name: "Open" }).lastElementChild).toHaveClass("lucide-sparkles");
});
