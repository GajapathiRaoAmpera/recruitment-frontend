"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
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

/** Password field with a show/hide toggle; same props as Input (type is managed here). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  function PasswordInput({ className, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className={s.passwordWrap}>
        <Input ref={ref} {...rest} type={visible ? "text" : "password"} className={cn(s.passwordInput, className)} />
        <button
          type="button"
          className={s.reveal}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
        </button>
      </div>
    );
  },
);

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
