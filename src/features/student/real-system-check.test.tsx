import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
const api = vi.hoisted(() => ({ entryStep: vi.fn(), entrySteps: vi.fn(), entryConfirm: vi.fn() }));
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

  it("never shows Start without walking the steps", async () => {
    render(<RealSystemCheck student={student} roundId="r1" />);
    expect(screen.queryByText("Verification complete")).toBeNull();
  });
});
