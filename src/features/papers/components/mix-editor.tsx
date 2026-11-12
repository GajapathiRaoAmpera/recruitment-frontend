"use client";

import { Button } from "@/components/ui/button";
import { hire as h } from "@/components/hire/ui";
import type { Section } from "@/features/papers/types";
import { CountSteppers } from "./count-steppers";
import s from "./papers.module.scss";

export const SECTIONS: readonly Section[] = ["aptitude", "reasoning", "technical"];
export const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

/** Rescales the mix to total exactly 100 (largest-remainder rounding); all zero → an even split. */
export function balance(mix: Record<Section, number>): Record<Section, number> {
  const total = sum(mix);
  const raw = SECTIONS.map((k) => (total ? (mix[k] * 100) / total : 100 / SECTIONS.length));
  const out = raw.map(Math.floor);
  // Hand the leftover points to the sections with the largest fractional parts.
  const order = raw.map((v, i) => ({ frac: v - Math.floor(v), i })).sort((a, b) => b.frac - a.frac);
  const leftover = 100 - out.reduce((a, b) => a + b, 0);
  for (let j = 0; j < leftover; j++) out[order[j]!.i]! += 1;
  return Object.fromEntries(SECTIONS.map((k, i) => [k, out[i]!])) as Record<Section, number>;
}

/** Aptitude / Reasoning / Technical percentages with a visible running total and "Balance to 100". */
export function MixEditor({ value, onChange, technicalLabel }: { value: Record<Section, number>; onChange: (v: Record<Section, number>) => void; technicalLabel: string }) {
  const total = sum(value);
  return (
    <div className={h.stackSm}>
      <CountSteppers keys={SECTIONS} labels={{ aptitude: "Aptitude %", reasoning: "Reasoning %", technical: technicalLabel }} value={value} onChange={onChange} />
      <div className={h.row}>
        <span className={s.total} data-ok={total === 100} aria-live="polite">
          Total {total}% {total === 100 ? "" : "— must be 100%"}
        </span>
        {total !== 100 && (
          <Button variant="tertiary" size="sm" onClick={() => onChange(balance(value))}>
            Balance to 100
          </Button>
        )}
      </div>
    </div>
  );
}
