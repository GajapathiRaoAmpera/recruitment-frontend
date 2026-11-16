import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type CharacterState, stateLabel } from "./character-state";
import { InterviewerCharacter } from "./interviewer-character";
import { NetworkBars } from "./network-bars";

// AC-8 (AI interview screen): the interviewer never depends on WebGL, and its state is readable as text.

describe("InterviewerCharacter", () => {
  it("falls back to the flat SVG face when WebGL is missing (jsdom has none)", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { container } = render(<InterviewerCharacter state="idle" getLevel={() => 0} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it.each(Object.keys(stateLabel) as CharacterState[])("shows the label for %s", (state) => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<InterviewerCharacter state={state} getLevel={() => 0} />);
    expect(screen.getByRole("status")).toHaveTextContent(stateLabel[state]);
  });
});

describe("NetworkBars", () => {
  it.each([
    ["good", 3, "Good"],
    ["weak", 2, "Weak"],
    ["offline", 1, "Offline"],
    ["checking", 0, "Checking"],
  ] as const)("%s lights %i bars", (verdict, lit, label) => {
    const { container } = render(<NetworkBars verdict={verdict} />);
    expect(container.querySelectorAll('i[data-on="true"]')).toHaveLength(lit);
    expect(container).toHaveTextContent(label);
  });
});
