import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const api = vi.hoisted(() => ({ entryStep: vi.fn(), entrySteps: vi.fn(), entryConfirm: vi.fn() }));
const faces = vi.hoisted(() => ({ countFaces: vi.fn() }));
vi.mock("@/lib/face-detect", () => faces);
vi.mock("@/api/entry", async (orig) => ({ ...(await orig<typeof import("@/api/entry")>()), ...api }));

import type { StudentSession } from "@/api/entry";
import { RealSystemCheck } from "./real-system-check";

const student: StudentSession = { entryToken: "t", studentId: "S1", fullName: "Asha Rao", rounds: [{ roundId: "r1", type: "aptitude", testId: null, durationMin: 45 }] };

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.entryStep.mockResolvedValue(undefined);
  api.entrySteps.mockResolvedValue({ location: true, terms: true });
  Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

describe("RealSystemCheck", () => {
  it("starts at Identity every time, even if the server already has location and terms", async () => {
    render(<RealSystemCheck student={student} roundId="r1" />);
    expect(screen.queryByText("Location shared")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Photo, location & full screen");
  });

  it("starts with the camera step and keeps location locked until the photo passes", async () => {
    api.entrySteps.mockResolvedValue({});
    render(<RealSystemCheck student={student} roundId="r1" />);
    expect(screen.queryByLabelText("Date of birth")).toBeNull();
    expect(await screen.findByText(/Camera access was blocked|No camera was found/)).toBeTruthy(); // jsdom has no camera
    expect((screen.getByRole("button", { name: /Allow location/ }) as HTMLButtonElement).disabled).toBe(true); // locked until the photo passes
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent("Photo, location & full screen");
  });

  it("stage 0 shows the camera panel with the oval guide next to the System check list", async () => {
    const getUserMedia = vi.fn(() => new Promise(() => {})); // camera prompt left open, so the preview stays up
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    try {
      render(<RealSystemCheck student={student} roundId="r1" />);
      const camera = screen.getByRole("region", { name: "Identity photo" });
      const checklist = screen.getByRole("region", { name: "System check" });
      expect(camera.parentElement).toBe(checklist.parentElement); // the two columns share one grid
      expect(within(camera).getByTestId("face-oval").getAttribute("aria-hidden")).toBe("true");
      expect(within(camera).getByLabelText("Live camera preview")).toBeTruthy();
      const steps = within(checklist).getAllByRole("listitem");
      expect(steps.map((li) => li.getAttribute("data-state"))).toEqual(["current", "locked", "locked"]);
      expect(steps[1]).toHaveTextContent("2. Share your location");
    } finally {
      delete (navigator as { mediaDevices?: unknown }).mediaDevices;
    }
  });

  it("shows a missing camera inside the camera panel with Try again", async () => {
    render(<RealSystemCheck student={student} roundId="r1" />);
    const camera = screen.getByRole("region", { name: "Identity photo" });
    expect(await within(camera).findByText(/No camera was found/)).toBeTruthy(); // jsdom has no camera
    expect(within(camera).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(within(camera).getByText("Camera off")).toBeTruthy();
  });

  it("after verify the camera panel shows the photo in a circle, camera off, and location becomes the current step", async () => {
    const getUserMedia = vi.fn(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] }));
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { value: 640, configurable: true });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/jpeg;base64,AA");
    faces.countFaces.mockResolvedValue({ count: 1 });
    try {
      render(<RealSystemCheck student={student} roundId="r1" />);
      fireEvent.click(await screen.findByRole("button", { name: /Capture photo/ }));
      await screen.findByText("One face detected.");
      fireEvent.click(screen.getByRole("button", { name: /Verify/ }));
      const camera = screen.getByRole("region", { name: "Identity photo" });
      expect(within(camera).getByAltText("Your verification photo")).toBeTruthy();
      expect(within(camera).getByText("Photo verified · camera off")).toBeTruthy();
      expect(within(camera).getByText("Camera off")).toBeTruthy();
      expect(within(camera).queryByTestId("face-oval")).toBeNull();
      const steps = within(screen.getByRole("region", { name: "System check" })).getAllByRole("listitem");
      expect(steps.map((li) => li.getAttribute("data-state"))).toEqual(["done", "current", "locked"]);
      expect((screen.getByRole("button", { name: /Allow location/ }) as HTMLButtonElement).disabled).toBe(false);
    } finally {
      delete (navigator as { mediaDevices?: unknown }).mediaDevices;
    }
  });

  it("never shows Start without walking the steps", async () => {
    render(<RealSystemCheck student={student} roundId="r1" />);
    expect(screen.queryByText("Verification complete")).toBeNull();
  });
});
