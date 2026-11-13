"use client";

import { useEffect } from "react";

/** Elements marked with this attribute (the code editor) keep copy/paste/select, so candidates can edit their own code. */
export const ALLOW_CLIPBOARD = "data-allow-clipboard";
const inAllowed = (t: EventTarget | null) => t instanceof Element && t.closest(`[${ALLOW_CLIPBOARD}]`) !== null;

/** Shortcuts that only open tools or leave the page: view source, save, print, dev tools. */
const isToolKey = (e: KeyboardEvent) => {
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  return k === "f12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || (mod && ["u", "s", "p"].includes(k));
};
const isClipboardKey = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && ["c", "x", "v", "a"].includes(e.key.toLowerCase());

/**
 * While `enabled`: no right-click menu, copy/cut/paste, drag, text selection, dev-tool/print/save shortcuts,
 * and a leave-page prompt on refresh or close. Best effort only: a browser cannot stop screenshots or a second device,
 * so the tab-switch count and the server stay the real checks.
 */
export function useLockdown(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const stop = (e: Event) => {
      if (!inAllowed(e.target)) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (isToolKey(e) || (isClipboardKey(e) && !inAllowed(e.target))) e.preventDefault();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const style = document.createElement("style");
    style.textContent = `body{-webkit-user-select:none;user-select:none}[${ALLOW_CLIPBOARD}],[${ALLOW_CLIPBOARD}] *{-webkit-user-select:text;user-select:text}`;
    document.head.appendChild(style);
    const events = ["contextmenu", "copy", "cut", "paste", "dragstart", "drop", "selectstart"] as const;
    events.forEach((n) => document.addEventListener(n, stop));
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      events.forEach((n) => document.removeEventListener(n, stop));
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
      style.remove();
    };
  }, [enabled]);
}
