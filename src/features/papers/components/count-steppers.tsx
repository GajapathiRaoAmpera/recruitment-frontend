"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import s from "./papers.module.scss";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min));

/** A labelled number input with − / + buttons. */
export function NumberStepper({ label, value, onChange, min = 0, max = 100, hint }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className={s.stepper}>
        <Button variant="secondary" size="sm" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - 1, min, max))}>
          <Minus aria-hidden size={14} />
        </Button>
        <Input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => onChange(clamp(e.target.valueAsNumber, min, max))} />
        <Button variant="secondary" size="sm" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + 1, min, max))}>
          <Plus aria-hidden size={14} />
        </Button>
      </div>
    </Field>
  );
}

/** Generic set of steppers over a record, e.g. easy / medium / advanced counts. */
export function CountSteppers<K extends string>({ keys, labels, value, onChange, max = 100 }: { keys: readonly K[]; labels: Record<K, string>; value: Record<K, number>; onChange: (v: Record<K, number>) => void; max?: number }) {
  return (
    <div className={s.numbers}>
      {keys.map((k) => (
        <NumberStepper key={k} label={labels[k]} value={value[k]} max={max} onChange={(n) => onChange({ ...value, [k]: n })} />
      ))}
    </div>
  );
}
