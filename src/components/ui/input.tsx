"use client";

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { useFieldControl } from "./field";
import s from "./input.module.scss";

/** Base look of every text control; exported for controls built outside this file. */
export const controlClasses = s.control;

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  const field = useFieldControl();
  return <input ref={ref} {...field} {...rest} className={cn(s.control, s.input, className)} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    const field = useFieldControl();
    return <textarea ref={ref} rows={rows} {...field} {...rest} className={cn(s.control, s.textarea, className)} />;
  },
);

/** Native select: best keyboard, screen-reader and mobile behaviour for simple choices. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  const field = useFieldControl();
  return (
    <select ref={ref} {...field} {...rest} className={cn(s.control, s.select, className)}>
      {children}
    </select>
  );
});
