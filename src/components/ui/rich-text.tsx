"use client";

import { Bold, Heading2, Italic, List, ListOrdered } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Textarea } from "./input";
import s from "./rich-text.module.scss";

/*
 * Light formatting kept as plain-text markers (**bold**, *italic*, "## " heading, "- " / "1. " lists), so the text
 * stays plain for resume keyword matching and the interview prompt. Only `*` markers: the backend's skill regex
 * misses words wrapped in underscores (`__SQL__`).
 */

type Tool = { label: string; keys?: string; icon: typeof Bold } & ({ wrap: string } | { line: string });

const TOOLS: Tool[] = [
  { label: "Bold", keys: "Ctrl+B", icon: Bold, wrap: "**" },
  { label: "Italic", keys: "Ctrl+I", icon: Italic, wrap: "*" },
  { label: "Heading", icon: Heading2, line: "## " },
  { label: "Bullet list", icon: List, line: "- " },
  { label: "Numbered list", icon: ListOrdered, line: "1. " },
];

/** Applies a tool to the selection; returns the new text and the range to select afterwards. */
export function applyTool(value: string, start: number, end: number, tool: Tool) {
  if ("wrap" in tool) {
    const inner = value.slice(start, end) || "text";
    const at = start + tool.wrap.length;
    return { text: value.slice(0, start) + tool.wrap + inner + tool.wrap + value.slice(end), from: at, to: at + inner.length };
  }
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lines = value.slice(lineStart, end).split("\n");
  const block = lines.map((l, i) => (tool.line === "1. " ? `${i + 1}. ${l}` : tool.line + l)).join("\n");
  return { text: value.slice(0, lineStart) + block + value.slice(end), from: lineStart, to: lineStart + block.length };
}

type EditorProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

/** Textarea with a small formatting toolbar; place it inside a <Field> like a Textarea. */
export function RichTextArea({ value, onChange, className, onKeyDown, ...rest }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const format = (tool: Tool) => {
    const el = ref.current;
    if (!el) return;
    const { text, from, to } = applyTool(value, el.selectionStart, el.selectionEnd, tool);
    onChange(text);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(from, to);
    });
  };

  const keys = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e);
    const tool = (e.ctrlKey || e.metaKey) && TOOLS.find((t) => t.keys?.endsWith(`+${e.key.toUpperCase()}`));
    if (!tool || e.defaultPrevented) return;
    e.preventDefault();
    format(tool);
  };

  return (
    <div className={s.editor}>
      <div role="toolbar" aria-label="Formatting" className={s.toolbar}>
        {TOOLS.map((t) => {
          const name = t.keys ? `${t.label} (${t.keys})` : t.label;
          return (
            <button key={t.label} type="button" className={s.tool} aria-label={name} title={name} onClick={() => format(t)}>
              <t.icon aria-hidden size={16} />
            </button>
          );
        })}
      </div>
      <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={keys} className={cn(s.area, className)} {...rest} />
    </div>
  );
}

/** **bold** and *italic* inside one line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

/** Shows text written with RichTextArea. Builds React elements only (never HTML), so pasted markup stays text. */
export function FormattedText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const open: { list: { ordered: boolean; items: string[] } | null } = { list: null };
  const flush = () => {
    const l = open.list;
    if (!l) return;
    const items = l.items.map((t, i) => <li key={i}>{inline(t)}</li>);
    blocks.push(l.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    open.list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const item = /^\s*(?:([-*•])|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      const ordered = !item[1];
      if (open.list && open.list.ordered !== ordered) flush();
      open.list ??= { ordered, items: [] };
      open.list.items.push(item[2]!);
      continue;
    }
    flush();
    const heading = /^#{1,3}\s+(.*)$/.exec(line);
    if (heading) blocks.push(<h3 key={blocks.length}>{inline(heading[1]!)}</h3>);
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();

  return <div className={cn(s.formatted, className)}>{blocks}</div>;
}
