"use client";

import { useRef, type KeyboardEvent } from "react";
import type { Track } from "@/features/papers/types";
import s from "./papers.module.scss";

const OPTIONS: { id: Track; label: string }[] = [
  { id: "it", label: "IT" },
  { id: "non_it", label: "Non-IT" },
];

/** IT / Non-IT segmented control: a radiogroup with roving tabindex and arrow-key selection. */
export function TrackToggle({ value, onChange, labelledBy }: { value: Track; onChange: (t: Track) => void; labelledBy?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + OPTIONS.length) % OPTIONS.length;
    onChange(OPTIONS[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={labelledBy ? undefined : "Track"} aria-labelledby={labelledBy} className={s.radiogroup}>
      {OPTIONS.map((o, i) => (
        <button
          key={o.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={o.id === value}
          tabIndex={o.id === value ? 0 : -1}
          className={s.radio}
          onClick={() => onChange(o.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
