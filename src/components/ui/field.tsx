"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./field.module.scss";
import { InfoTip } from "./info-tip";

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Props a form control spreads to wire itself to the surrounding <Field>. */
export function useFieldControl() {
  const ctx = useContext(FieldContext);
  if (!ctx) return {};
  return {
    id: ctx.id,
    "aria-describedby": ctx.describedBy,
    "aria-invalid": ctx.invalid || undefined,
    required: ctx.required || undefined,
  };
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required = false, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cn(s.field, className)}>
        <span className={s.labelRow}>
          <label htmlFor={id} className={s.label}>
            {label}
            {required && (
              <span aria-hidden className={s.required}>
                *
              </span>
            )}
          </label>
          {hint && (
            <InfoTip id={hintId}>{hint}</InfoTip>
          )}
        </span>
        {children}
        {error && (
          <p id={errorId} role="alert" className={s.error}>
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
