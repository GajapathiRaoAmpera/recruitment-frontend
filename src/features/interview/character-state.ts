// What the interviewer character is doing. Shared by the 3D scene and the flat SVG fallback.
export type CharacterState = "idle" | "speaking" | "listening" | "thinking" | "reconnecting" | "ended";

export const stateLabel: Record<CharacterState, string> = {
  idle: "Interviewer is ready",
  speaking: "Interviewer is speaking",
  listening: "Interviewer is listening",
  thinking: "Interviewer is thinking",
  reconnecting: "Reconnecting…",
  ended: "Interview finished",
};

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}
