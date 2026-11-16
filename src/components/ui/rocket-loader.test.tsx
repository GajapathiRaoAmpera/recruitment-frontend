import { act, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { expect, it } from "vitest";
import { LoadGate, RocketLoader } from "./rocket-loader";

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

// A panel that shows its own loader until the test says its fetch answered.
const loaded: Record<string, () => void> = {};
function Panel({ name }: { name: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    loaded[name] = () => setDone(true);
  }, [name]);
  return done ? <p>{name} ready</p> : <RocketLoader label={`Loading ${name}`} />;
}

it("LoadGate shows one loader until every panel has loaded, then reveals them together", () => {
  render(
    <LoadGate label="Loading round">
      <Panel name="progress" />
      <Panel name="ranking" />
    </LoadGate>,
  );
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status")).toHaveTextContent("Loading round…");

  act(() => loaded.progress!());
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByText("progress ready")).not.toBeVisible(); // no half-built page

  act(() => loaded.ranking!());
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByText("progress ready")).toBeVisible();
  expect(screen.getByText("ranking ready")).toBeVisible();
});

it("LoadGate stays closed while the page's own fetch (ready) is pending", () => {
  const { rerender } = render(<LoadGate ready={false}>content</LoadGate>);
  expect(screen.getByRole("status")).toBeInTheDocument();
  rerender(<LoadGate ready>content</LoadGate>);
  expect(screen.queryByRole("status")).toBeNull();
});
