"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { createPortal } from "react-dom";
import {
  Children,
  Fragment,
  forwardRef,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
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

interface Choice {
  value: string;
  label: string;
  disabled: boolean;
  group?: string;
}

/** Flattens <option>/<optgroup>/fragments into a list the themed popup can draw. */
function readChoices(children: ReactNode, group?: string, out: Choice[] = []): Choice[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode; label?: string; disabled?: boolean };
    if (child.type === "optgroup") readChoices(props.children, props.label, out);
    else if (child.type === "option") {
      const label = Children.toArray(props.children).join("");
      out.push({ value: String(props.value ?? label), label, disabled: Boolean(props.disabled), group });
    } else if (props.children) readChoices(props.children, group, out);
  });
  return out;
}

/**
 * Select with a themed popup. The native <select> stays the real control (label, form value, keyboard, tests,
 * screen readers); a click or Space/Enter/Alt+Down opens our listbox instead of the browser's, and picking
 * fires a normal `change` event, so `onChange={(e) => e.target.value}` works unchanged.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, onKeyDown, onMouseDown, onBlur, ...rest },
  ref,
) {
  const field = useFieldControl();
  const listId = useId();
  const native = useRef<HTMLSelectElement | null>(null);
  const [open, setOpen] = useState(false);
  const popup = useRef<HTMLUListElement | null>(null);
  // Where the list sits on screen (fixed, so no scroll box or dialog can clip it).
  const [spot, setSpot] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number }>();
  const [active, setActive] = useState(0);
  const choices = readChoices(children).filter((c) => !(c.disabled && c.value === ""));
  const typed = useRef({ text: "", at: 0 });

  const setRefs = (el: HTMLSelectElement | null) => {
    native.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const openList = () => {
    const el = native.current;
    if (!el || el.disabled || choices.length === 0) return;
    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 16;
    const above = rect.top - 16;
    const flip = below < 240 && above > below;
    const maxHeight = Math.min(256, Math.max(120, flip ? above : below));
    setSpot(
      flip
        ? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 4, maxHeight }
        : { left: rect.left, width: rect.width, top: rect.bottom + 4, maxHeight },
    );
    const at = choices.findIndex((c) => c.value === el.value && !c.disabled);
    setActive(at >= 0 ? at : Math.max(0, choices.findIndex((c) => !c.disabled)));
    setOpen(true);
  };

  const pick = (c: Choice | undefined) => {
    const el = native.current;
    setOpen(false);
    if (!c || c.disabled || !el || el.value === c.value) return;
    el.value = c.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  // Click outside, scrolling the page or resizing closes the list (like the native one).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!native.current?.contains(t) && !popup.current?.contains(t)) setOpen(false);
    };
    const close = (e: Event) => {
      if (!popup.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listId]);

  const move = (from: number, step: 1 | -1) => {
    for (let i = from + step; i >= 0 && i < choices.length; i += step) if (!choices[i]!.disabled) return i;
    return from;
  };

  const keys = (e: KeyboardEvent<HTMLSelectElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || native.current?.disabled) return;
    if (!open) {
      if (e.key === " " || e.key === "Enter" || (e.altKey && e.key === "ArrowDown")) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") setActive((a) => move(a, 1));
    else if (e.key === "ArrowUp") setActive((a) => move(a, -1));
    else if (e.key === "Home") setActive(move(-1, 1));
    else if (e.key === "End") setActive(move(choices.length, -1));
    else if (e.key === "Enter" || e.key === " ") pick(choices[active]);
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Tab") {
      setOpen(false);
      return;
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at > 700 ? "" : typed.current.text) + e.key.toLowerCase(), at: now };
      const hit = choices.findIndex((c) => !c.disabled && c.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    } else return;
    e.preventDefault();
  };

  let lastGroup: string | undefined;
  return (
    <div className={s.selectWrap} data-open={open || undefined}>
      <select
        ref={setRefs}
        {...field}
        {...rest}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className={cn(s.control, s.select, className)}
        onMouseDown={(e) => {
          onMouseDown?.(e);
          if (e.defaultPrevented || e.button !== 0) return;
          e.preventDefault(); // no browser popup; ours replaces it
          e.currentTarget.focus();
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={keys}
        onBlur={(e) => {
          setOpen(false);
          onBlur?.(e);
        }}
      >
        {children}
      </select>
      {open && spot && typeof document !== "undefined" &&
        createPortal(
        <ul
          ref={popup}
          id={listId}
          role="listbox"
          className={s.popup}
          style={{ left: spot.left, minWidth: spot.width, top: spot.top, bottom: spot.bottom, maxHeight: spot.maxHeight }}
          // Keeps focus on the select, and stops an open dialog from treating a pick as an outside click.
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {choices.map((c, i) => {
            const header = c.group && c.group !== lastGroup ? c.group : undefined;
            lastGroup = c.group;
            const selected = c.value === native.current?.value;
            return (
              <Fragment key={`${c.group ?? ""}:${c.value}:${i}`}>
                {header && (
                  <li role="presentation" className={s.popupGroup}>
                    {header}
                  </li>
                )}
                <li
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={c.disabled || undefined}
                  className={cn(s.option, i === active && s.optionActive, selected && s.optionSelected, c.disabled && s.optionDisabled)}
                  onMouseEnter={() => !c.disabled && setActive(i)}
                  onClick={() => pick(c)}
                >
                  <span className={s.optionLabel}>{c.label}</span>
                  {selected && <Check aria-hidden size={16} />}
                </li>
              </Fragment>
            );
          })}
        </ul>,
        document.body,
      )}
    </div>
  );
});

/** Range slider wired to the surrounding <Field> label (raw inputs aren't). */
export const Range = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(function Range(props, ref) {
  const field = useFieldControl();
  return <input ref={ref} {...field} {...props} type="range" />;
});
