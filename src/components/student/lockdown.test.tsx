// AC-7 Integrity: exam lockdown. Copy/cut/paste/drag-drop are blocked everywhere, the code editor included;
// the editor only keeps text selection and normal editing keys.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ALLOW_SELECT, useLockdown } from "./lockdown";
import { TabSwitchBadge } from "./tab-switch-badge";

function Page({ on = true }: { on?: boolean }) {
  useLockdown(on);
  return (
    <div>
      <p data-testid="text">question</p>
      <div {...{ [ALLOW_SELECT]: "" }}>
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

  it("blocks copy, cut, paste and drag-drop inside the code editor too", () => {
    render(<Page />);
    const editor = screen.getByLabelText("code");
    // Stands in for Monaco's own textarea handler, which reads clipboardData itself and ignores defaultPrevented.
    const widgetPaste = vi.fn();
    editor.addEventListener("paste", widgetPaste);
    for (const type of ["copy", "cut", "paste", "dragstart", "dragover", "drop"]) {
      expect(fireEvent(editor, new Event(type, { bubbles: true, cancelable: true })), type).toBe(false);
    }
    expect(widgetPaste).not.toHaveBeenCalled();
  });

  it("blocks clipboard shortcuts in the editor: Ctrl/Cmd+C/X/V, Ctrl+Shift+V, Ctrl+Insert, Shift+Insert, Shift+Delete", () => {
    render(<Page />);
    const editor = screen.getByLabelText("code");
    const keys = [
      { key: "c", ctrlKey: true },
      { key: "x", ctrlKey: true },
      { key: "v", ctrlKey: true },
      { key: "C", metaKey: true },
      { key: "X", metaKey: true },
      { key: "V", metaKey: true },
      { key: "V", ctrlKey: true, shiftKey: true },
      { key: "Insert", ctrlKey: true },
      { key: "Insert", shiftKey: true },
      { key: "Delete", shiftKey: true },
    ];
    for (const init of keys) expect(fireEvent.keyDown(editor, init), JSON.stringify(init)).toBe(false);
    expect(fireEvent.keyDown(editor, { key: "F12" })).toBe(false); // dev tools still blocked there
  });

  it("still lets the editor type, select, select-all, undo/redo, indent and delete", () => {
    render(<Page />);
    const editor = screen.getByLabelText("code");
    const keys = [
      { key: "a" },
      { key: "A", shiftKey: true },
      { key: "a", ctrlKey: true },
      { key: "a", metaKey: true },
      { key: "z", ctrlKey: true },
      { key: "z", ctrlKey: true, shiftKey: true },
      { key: "y", ctrlKey: true },
      { key: "Tab" },
      { key: "Tab", shiftKey: true },
      { key: "Backspace" },
      { key: "Delete" },
      { key: "ArrowLeft", shiftKey: true },
      { key: "Insert" },
    ];
    for (const init of keys) expect(fireEvent.keyDown(editor, init), JSON.stringify(init)).toBe(true);
    expect(fireEvent(editor, new Event("selectstart", { bubbles: true, cancelable: true }))).toBe(true);
    // Outside the editor, select-all and selection stay blocked.
    const text = screen.getByTestId("text");
    expect(fireEvent.keyDown(text, { key: "a", ctrlKey: true })).toBe(false);
    expect(fireEvent(text, new Event("selectstart", { bubbles: true, cancelable: true }))).toBe(false);
  });

  it("lets only text selection through in the editor area (CSS)", () => {
    render(<Page />);
    const css = [...document.head.querySelectorAll("style")].map((el) => el.textContent).join("");
    expect(css).toContain(`[${ALLOW_SELECT}] *{-webkit-user-select:text;user-select:text}`);
    expect(ALLOW_SELECT).toBe("data-allow-select");
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
