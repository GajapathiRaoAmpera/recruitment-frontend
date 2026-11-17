import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DesktopOnly } from "./desktop-only";

function fakeScreen(small: boolean) {
  const listeners = new Set<() => void>();
  const mq = {
    matches: small,
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  };
  vi.stubGlobal("matchMedia", () => mq);
  return (next: boolean) => act(() => { mq.matches = next; listeners.forEach((cb) => cb()); });
}

afterEach(() => vi.unstubAllGlobals());

it("asks phone users to switch to a desktop instead of opening the page", () => {
  fakeScreen(true);
  render(<DesktopOnly>exam</DesktopOnly>);
  expect(screen.queryByText("exam")).not.toBeInTheDocument();
  expect(screen.getByText("Please use a desktop or laptop")).toBeInTheDocument();
});

it("opens on a desktop and stays open if the window is later narrowed", () => {
  const resize = fakeScreen(false);
  render(<DesktopOnly>exam</DesktopOnly>);
  expect(screen.getByText("exam")).toBeInTheDocument();
  resize(true);
  expect(screen.getByText("exam")).toBeInTheDocument();
});

it("opens once a too-narrow window is widened", () => {
  const resize = fakeScreen(true);
  render(<DesktopOnly>exam</DesktopOnly>);
  resize(false);
  expect(screen.getByText("exam")).toBeInTheDocument();
});
