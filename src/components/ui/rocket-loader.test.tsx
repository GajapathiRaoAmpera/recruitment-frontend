import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RocketLoader } from "./rocket-loader";

it("announces what is loading with the rocket drawn inline (no WebGL, no canvas)", () => {
  const { container } = render(<RocketLoader label="Loading drives" />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading drives…");
  expect(container.querySelector("svg")).not.toBeNull();
  expect(container.querySelector("canvas")).toBeNull();
});

it("still mode (student test screens) marks the loader so nothing animates", () => {
  render(<RocketLoader size="inline" still label="Submitting your answers" />);
  expect(screen.getByRole("status").className).toMatch(/still/);
});
