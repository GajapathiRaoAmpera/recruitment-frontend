// AC-7 Integrity: on exam screens Monaco gets its own clipboard guard (it reads paste data from a hidden textarea,
// so page-level blocking alone is not enough). HR screens (question form, results) keep normal copy/paste.
import { fireEvent, render } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const KeyMod = { CtrlCmd: 1 << 11, Shift: 1 << 10 };
const KeyCode = { KeyC: 33, KeyV: 52, KeyX: 54, Insert: 19, Delete: 20 };

const fake = vi.hoisted(() => ({ node: null as HTMLElement | null, addCommand: vi.fn(), options: {} as Record<string, unknown> }));

vi.mock("@monaco-editor/react", () => ({
  loader: { config: vi.fn() },
  default: function Editor(props: { options: Record<string, unknown>; onMount?: (e: unknown, m: unknown) => void }) {
    fake.options = props.options;
    useEffect(() => {
      props.onMount?.({ getDomNode: () => fake.node, addCommand: fake.addCommand }, { KeyMod, KeyCode });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount once, like Monaco
    return null;
  },
}));
vi.mock("monaco-editor/esm/vs/editor/editor.all.js", () => ({}));
vi.mock("monaco-editor/esm/vs/editor/editor.api.js", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/python/python.contribution.js", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/java/java.contribution.js", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/go/go.contribution.js", () => ({}));
vi.mock("monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js", () => ({}));

import MonacoCodeEditor from "./monaco-editor";

const EVENTS = ["copy", "cut", "paste", "dragstart", "dragover", "drop"];

/** Monaco's root node with its hidden textarea inside; the textarea listener stands in for Monaco's own paste handler. */
function editorDom() {
  const root = document.createElement("div");
  const textarea = document.createElement("textarea");
  root.appendChild(textarea);
  document.body.appendChild(root);
  const monacoHandler = vi.fn();
  EVENTS.forEach((n) => textarea.addEventListener(n, monacoHandler));
  return { root, textarea, monacoHandler };
}

const props = { value: "", language: "python", onChange: () => {}, label: "Code", path: "q1/python" };

describe("MonacoCodeEditor clipboard guard", () => {
  beforeEach(() => {
    fake.addCommand.mockClear();
    document.body.innerHTML = "";
  });

  it("with blockClipboard: stops copy/cut/paste/drag-drop before Monaco sees them, no-ops the shortcuts, no drag-and-drop", () => {
    const { textarea, root, monacoHandler } = editorDom();
    fake.node = root;
    const { unmount } = render(<MonacoCodeEditor {...props} blockClipboard />);
    for (const type of EVENTS) expect(fireEvent(textarea, new Event(type, { bubbles: true, cancelable: true })), type).toBe(false);
    expect(monacoHandler).not.toHaveBeenCalled();

    const bound = fake.addCommand.mock.calls.map(([k]) => k);
    expect(bound).toEqual(
      expect.arrayContaining([
        KeyMod.CtrlCmd | KeyCode.KeyC,
        KeyMod.CtrlCmd | KeyCode.KeyX,
        KeyMod.CtrlCmd | KeyCode.KeyV,
        KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyV,
        KeyMod.CtrlCmd | KeyCode.Insert,
        KeyMod.Shift | KeyCode.Insert,
        KeyMod.Shift | KeyCode.Delete,
      ]),
    );
    expect(fake.options).toMatchObject({ dragAndDrop: false, contextmenu: false });

    unmount(); // listeners are removed with the editor
    expect(fireEvent(textarea, new Event("paste", { bubbles: true, cancelable: true }))).toBe(true);
    expect(monacoHandler).toHaveBeenCalledTimes(1);
  });

  it("without blockClipboard (HR screens): copy/paste untouched", () => {
    const { textarea, root, monacoHandler } = editorDom();
    fake.node = root;
    render(<MonacoCodeEditor {...props} />);
    expect(fireEvent(textarea, new Event("paste", { bubbles: true, cancelable: true }))).toBe(true);
    expect(monacoHandler).toHaveBeenCalledTimes(1);
    expect(fake.addCommand).not.toHaveBeenCalled();
    expect(fake.options).toMatchObject({ dragAndDrop: true });
  });
});
