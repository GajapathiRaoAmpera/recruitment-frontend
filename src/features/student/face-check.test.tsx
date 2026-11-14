import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const faces = vi.hoisted(() => ({ countFaces: vi.fn() }));
vi.mock("@/lib/face-detect", () => faces);

import { FACE_MESSAGES, FaceCheck } from "./face-check";

const stop = vi.fn();
function camera(result: "ok" | "denied") {
  const getUserMedia = vi.fn(() => (result === "ok" ? Promise.resolve({ getTracks: () => [{ stop }] }) : Promise.reject(new DOMException("no", "NotAllowedError"))));
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
}

beforeEach(() => {
  faces.countFaces.mockReset();
  stop.mockReset();
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { value: 640, configurable: true });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/jpeg;base64,AA");
});
afterEach(() => cleanup());

async function capture() {
  fireEvent.click(await screen.findByRole("button", { name: /Capture photo/ }));
}

describe("FaceCheck", () => {
  it("shows how to re-enable the camera when permission is denied", async () => {
    camera("denied");
    render(<FaceCheck onVerified={vi.fn()} />);
    expect(await screen.findByText(/Camera access was blocked/)).toBeTruthy();
    expect(screen.getByText(/set Camera to Allow/)).toBeTruthy();
  });

  it("shows the oval face guide over the live preview, hidden from screen readers, with the camera-on pill", async () => {
    camera("ok");
    render(<FaceCheck onVerified={vi.fn()} />);
    await screen.findByRole("button", { name: /Capture photo/ });
    expect(screen.getByLabelText("Live camera preview")).toBeTruthy();
    expect(screen.getByTestId("face-oval").getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByText("Keep your face inside the oval")).toBeTruthy();
    expect(screen.getByText("Camera on")).toBeTruthy();
  });

  it("blocks Verify when no face is found, and when several people are in the photo", async () => {
    camera("ok");
    render(<FaceCheck onVerified={vi.fn()} />);
    faces.countFaces.mockResolvedValueOnce({ count: 0 });
    await capture();
    expect(await screen.findByText(FACE_MESSAGES.none)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Verify/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Retake photo/ }));
    faces.countFaces.mockResolvedValueOnce({ count: 2 });
    await capture();
    expect(await screen.findByText(FACE_MESSAGES.many)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Verify/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("rejects a cut-off face and a side-on face even though one face was found", async () => {
    camera("ok");
    render(<FaceCheck onVerified={vi.fn()} />);
    faces.countFaces.mockResolvedValueOnce({ count: 1, problem: "partial" });
    await capture();
    expect(await screen.findByText(FACE_MESSAGES.partial)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Verify/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Retake photo/ }));
    faces.countFaces.mockResolvedValueOnce({ count: 1, problem: "angled" });
    await capture();
    expect(await screen.findByText(FACE_MESSAGES.angled)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Verify/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the photo, and with exactly one face lets them continue and releases the camera", async () => {
    camera("ok");
    const onVerified = vi.fn();
    render(<FaceCheck onVerified={onVerified} />);
    faces.countFaces.mockResolvedValue({ count: 1 });
    await capture();
    expect(await screen.findByAltText("Your captured photo")).toBeTruthy();
    await screen.findByText("One face detected.");
    fireEvent.click(screen.getByRole("button", { name: /Verify/ }));
    expect(onVerified).toHaveBeenCalledWith("data:image/jpeg;base64,AA");
    expect(stop).toHaveBeenCalled();
  });
});
