"use client";

// Browser only (loaded through code-editor.tsx with ssr: false). Monaco comes from our own bundle, never a CDN,
// so the editor works on a locked-down exam network. Only the core editor and syntax colouring for the
// languages the API accepts are loaded; no language services (no TypeScript/JSON workers).
import Editor, { loader } from "@monaco-editor/react";
import "monaco-editor/esm/vs/editor/editor.all.js";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution.js";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution.js"; // registers both c and cpp
import "monaco-editor/esm/vs/basic-languages/java/java.contribution.js";
import "monaco-editor/esm/vs/basic-languages/go/go.contribution.js";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js";
import { useState } from "react";
import { monacoLanguage } from "./coding-shared";

declare global {
  interface Window {
    MonacoEnvironment?: { getWorker: (workerId: string, label: string) => Worker };
  }
}

window.MonacoEnvironment = {
  getWorker: () => new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), { type: "module" }),
};
loader.config({ monaco });

const THEME = "ampera-exam";

/** The editor panel is always the navy surface (see .editorWrap); Monaco needs literal colours, so read the tokens once. */
function defineTheme(m: typeof monaco) {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  const bg = token("--ampera-navy-900");
  const fg = token("--ampera-cream");
  m.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: { ...(bg.startsWith("#") ? { "editor.background": bg } : {}), ...(fg.startsWith("#") ? { "editor.foreground": fg } : {}) },
  });
}

export interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (code: string) => void;
  label: string;
  readOnly?: boolean;
  /** Changes when the editor should show a different document (question or language), so undo history doesn't mix them. */
  path: string;
}

export default function MonacoCodeEditor({ value, language, onChange, label, readOnly, path }: CodeEditorProps) {
  const [reduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  return (
    <Editor
      height="22rem"
      path={path}
      value={value}
      language={monacoLanguage(language)}
      theme={THEME}
      beforeMount={defineTheme}
      onChange={(v) => onChange(v ?? "")}
      loading={<p style={{ padding: 16 }}>Loading editor…</p>}
      options={{
        ariaLabel: label,
        readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        tabSize: 4,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        smoothScrolling: !reduced,
        cursorBlinking: reduced ? "solid" : "blink",
        accessibilitySupport: "auto",
        contextmenu: false,
        quickSuggestions: false, // no language services: keep suggestions from guessing
      }}
    />
  );
}
