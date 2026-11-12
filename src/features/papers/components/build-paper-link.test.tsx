import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { BuildPaperLink } from "./build-paper-link";

it("aptitude round shows the Build paper link with the drive id; coding round does not", () => {
  const { unmount } = render(<BuildPaperLink round={{ type: "aptitude", driveId: "d1" }} />);
  expect(screen.getByRole("link", { name: /build round 1 paper/i })).toHaveAttribute("href", "/hr/papers/new?drive=d1");
  unmount();
  render(<BuildPaperLink round={{ type: "coding", driveId: "d1" }} />);
  expect(screen.queryByRole("link", { name: /build round 1 paper/i })).not.toBeInTheDocument();
});
