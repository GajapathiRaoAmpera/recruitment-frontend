import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  it("restores location and terms from the server after a refresh", async () => {
    render(<RealSystemCheck student={student} roundId="r1" />);
    await screen.findByText("Location shared");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("asks for Student ID + DOB for this round, and remembers it in this tab", async () => {
    api.entryConfirm.mockResolvedValue(undefined);
    window.sessionStorage.setItem("confirmed:r1", "1");
    render(<RealSystemCheck student={student} roundId="r1" />);
    await screen.findByText("Verified as Asha Rao");
    cleanup();
    window.sessionStorage.clear();
    render(<RealSystemCheck student={student} roundId="r1" />);
    expect(screen.getByLabelText("Date of birth")).toBeTruthy();
    expect(screen.queryByText("Verified as Asha Rao")).toBeNull();
  });

  it("hides Start when full screen is off, and logs unticking the terms", async () => {
    window.sessionStorage.setItem("confirmed:r1", "1");
    render(<RealSystemCheck student={student} roundId="r1" />);
    await screen.findByText("Location shared");
    expect(screen.queryByText("Verification complete")).toBeNull(); // terms + location ok but not full screen
    screen.getByRole("checkbox").click();
    await waitFor(() => expect(api.entryStep).toHaveBeenCalledWith("t", "r1", "terms", false, {}));
  });
});
