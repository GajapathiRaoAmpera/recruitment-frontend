import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ALLOW_CLIPBOARD, useLockdown } from "./lockdown";
import { TabSwitchBadge } from "./tab-switch-badge";

function Page({ on = true }: { on?: boolean }) {
  useLockdown(on);
  return (
    <div>
      <p data-testid="text">question</p>
      <div {...{ [ALLOW_CLIPBOARD]: "" }}>
        <textarea aria-label="code" />
      </div>
    </div>
  );
}

// fireEvent returns false when a listener called preventDefault
describe("useLockdown", () => {
  it("blocks right-click, copy, paste, drag and tool shortcuts on the test page", () => {
    render(<Page />);
    const text = screen.getByTestId("text");
    for (const type of ["contextmenu", "copy", "cut", "paste", "dragstart", "selectstart"]) expect(fireEvent(text, new Event(type, { bubbles: true, cancelable: true }))).toBe(false);
    for (const init of [{ key: "F12" }, { key: "I", ctrlKey: true, shiftKey: true }, { key: "u", ctrlKey: true }, { key: "p", ctrlKey: true }, { key: "c", ctrlKey: true }, { key: "v", metaKey: true }]) {
      expect(fireEvent.keyDown(text, init)).toBe(false);
    }
  });

  it("lets the code editor use the clipboard, but still blocks dev-tool shortcuts there", () => {
    render(<Page />);
    const editor = screen.getByLabelText("code");
    expect(fireEvent(editor, new Event("paste", { bubbles: true, cancelable: true }))).toBe(true);
    expect(fireEvent.keyDown(editor, { key: "v", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(editor, { key: "F12" })).toBe(false);
  });

  it("asks before leaving the page, and stops when disabled", () => {
    const { rerender } = render(<Page />);
    expect(fireEvent(window, new Event("beforeunload", { cancelable: true }))).toBe(false);
    rerender(<Page on={false} />);
    expect(fireEvent(window, new Event("beforeunload", { cancelable: true }))).toBe(true);
    expect(fireEvent(screen.getByTestId("text"), new Event("contextmenu", { bubbles: true, cancelable: true }))).toBe(true);
  });
});

describe("TabSwitchBadge", () => {
  it("is neutral at 0, warns while switches remain, and goes red at the limit", () => {
    const { rerender, container } = render(<TabSwitchBadge count={0} max={3} />);
    const tone = () => container.firstElementChild!.className;
    expect(screen.getByRole("status")).toHaveTextContent("Tab switches 0 / 3");
    const neutral = tone();
    rerender(<TabSwitchBadge count={2} max={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tab switches 2 / 3 · 1 more closes the test");
    const warning = tone();
    rerender(<TabSwitchBadge count={3} max={3} />);
    expect(screen.getByRole("status")).toHaveTextContent("Tab switches 3 / 3 · test closed");
    expect(new Set([neutral, warning, tone()]).size).toBe(3); // three different looks
  });
});
