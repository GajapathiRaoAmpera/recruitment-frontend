"use client";

import dynamic from "next/dynamic";
import type { CodeEditorProps } from "./monaco-editor";

/** Monaco touches `window` at import time, so it is loaded only in the browser and only on the coding screen. */
export const CodeEditor = dynamic<CodeEditorProps>(() => import("./monaco-editor"), {
  ssr: false,
  loading: () => <p style={{ padding: 16 }}>Loading editor…</p>,
});
