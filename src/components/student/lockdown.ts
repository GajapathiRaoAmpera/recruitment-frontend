"use client";

import { useEffect } from "react";

/**
 * Elements marked with this attribute (the code editor) may select text, so candidates can edit their own code
 * (mouse/keyboard selection, Ctrl/Cmd+A). It does NOT allow the clipboard: copy, cut, paste and drag-drop are blocked
 * everywhere during the exam, editor included.
 */
export const ALLOW_SELECT = "data-allow-select";
const inAllowed = (t: EventTarget | null) => t instanceof Element && t.closest(`[${ALLOW_SELECT}]`) !== null;

/** Shortcuts that only open tools or leave the page: view source, save, print, dev tools. */
const isToolKey = (e: KeyboardEvent) => {
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  return k === "f12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || (mod && ["u", "s", "p"].includes(k));
};
/** Copy/cut/paste shortcuts, including the Insert/Delete variants (Ctrl+Insert copy, Shift+Insert paste, Shift+Delete cut). */
export const isClipboardKey = (e: KeyboardEvent) => {
  const k = e.key.toLowerCase();
  return ((e.ctrlKey || e.metaKey) && ["c", "x", "v", "insert"].includes(k)) || (e.shiftKey && (k === "insert" || k === "delete"));
};
const isSelectAllKey = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a";

/**
 * While `enabled`: no right-click menu, copy/cut/paste, drag-drop, text selection (outside ALLOW_SELECT),
 * dev-tool/print/save shortcuts, and a leave-page prompt on refresh or close. Best effort only: a browser cannot stop
 * screenshots or a second device, so the tab-switch count and the server stay the real checks.
 * Listeners run in the capture phase so a widget that stops propagation (Monaco) cannot skip them.
 */
export function useLockdown(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const block = (e: Event) => e.preventDefault();
    // Clipboard and drag-drop: blocked everywhere, and stopped so no widget handler can read the clipboard data itself.
    const blockClipboard = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const dt = (e as DragEvent).dataTransfer;
      if (e.type === "dragover" && dt) dt.dropEffect = "none"; // "no drop" cursor; the drop never fires
    };
    const blockSelect = (e: Event) => {
      if (!inAllowed(e.target)) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (isToolKey(e) || isClipboardKey(e) || (isSelectAllKey(e) && !inAllowed(e.target))) e.preventDefault();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const style = document.createElement("style");
    style.textContent = `body{-webkit-user-select:none;user-select:none}[${ALLOW_SELECT}],[${ALLOW_SELECT}] *{-webkit-user-select:text;user-select:text}`;
    document.head.appendChild(style);
    const clipboardEvents = ["copy", "cut", "paste", "dragstart", "dragover", "drop"] as const;
    clipboardEvents.forEach((n) => document.addEventListener(n, blockClipboard, true));
    document.addEventListener("contextmenu", block, true);
    document.addEventListener("selectstart", blockSelect, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clipboardEvents.forEach((n) => document.removeEventListener(n, blockClipboard, true));
      document.removeEventListener("contextmenu", block, true);
      document.removeEventListener("selectstart", blockSelect, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("beforeunload", onUnload);
      style.remove();
    };
  }, [enabled]);
}
