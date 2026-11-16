"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import s from "./rocket-loader.module.scss";

type Gate = { open: boolean; add: (n: number) => void };
const GateContext = createContext<Gate | null>(null);

/**
 * One loader for a page made of panels that each fetch their own data. Every RocketLoader inside reports itself
 * instead of drawing, and the gate shows a single loader (children stay mounted but hidden, so all fetches run in
 * parallel) until none is left and `ready` is true. After that first reveal, loaders inside render normally again
 * (refreshes, expanding a row). Error, empty and 403/404 states aren't loaders, so they reveal the page.
 */
export function LoadGate({
  ready = true,
  label = "Loading",
  children,
}: {
  ready?: boolean;
  label?: string;
  children: ReactNode;
}) {
  const pending = useRef(0);
  const [tick, recheck] = useReducer((n: number) => n + 1, 0);
  const [open, setOpen] = useState(false);
  const gate = useMemo<Gate>(
    () => ({
      open,
      add: (n) => {
        pending.current += n;
        if (n < 0) recheck();
      },
    }),
    [open],
  );
  // Runs after the children's layout effects, so loaders mounted in this commit are already counted; before paint, so nothing flashes.
  useLayoutEffect(() => {
    if (!open && ready && pending.current === 0) setOpen(true);
  }, [open, ready, tick]);
  return (
    <>
      {!open && <RocketLoader label={label} />}
      <div hidden={!open}>
        <GateContext.Provider value={gate}>{children}</GateContext.Provider>
      </div>
    </>
  );
}

interface RocketLoaderProps {
  label?: string;
  /** screen: whole viewport (app boot) · page: the content area · inline: a small slot inside a form. */
  size?: "screen" | "page" | "inline";
  /** No motion at all: inside the student test screens (no animation there by rule). */
  still?: boolean;
  className?: string;
}

/**
 * The one loading state of the app: a rocket climbing past stars, above a label. Pure SVG + CSS, animating
 * transform/opacity only (GPU, no layout shift). Reduced motion gets a still frame. Appears after 150 ms so
 * fast loads don't flash.
 */
export function RocketLoader({
  label = "Loading",
  size = "page",
  still = false,
  className,
}: RocketLoaderProps) {
  const gate = useContext(GateContext);
  const gated = gate !== null && !gate.open;
  useLayoutEffect(() => {
    if (!gated) return;
    gate.add(1);
    return () => gate.add(-1);
  }, [gate, gated]);
  if (gated) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(s.loader, s[size], still && s.still, className)}
    >
      <svg viewBox="0 0 120 120" className={s.stage} aria-hidden>
        <defs>
          <clipPath id="rocket-sky">
            <circle cx="60" cy="60" r="56" />
          </clipPath>
        </defs>
        <circle cx="60" cy="60" r="56" className={s.sky} />
        <g clipPath="url(#rocket-sky)">
          {[18, 38, 82, 100].map((x, i) => (
            <line
              key={x}
              x1={x}
              y1="0"
              x2={x}
              y2={i % 2 ? 10 : 6}
              className={s.streak}
              style={{ animationDelay: `${i * -0.3}s` }}
            />
          ))}
          {[28, 92, 70].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy="0"
              r="1.6"
              className={s.star}
              style={{ animationDelay: `${i * -0.5}s` }}
            />
          ))}
        </g>
        <g className={s.rocket}>
          <path
            d="M60 92 C55 100 57 108 60 114 C63 108 65 100 60 92 Z"
            className={cn(s.flame, s.flameOuter)}
          />
          <path
            d="M60 92 C58 98 59 103 60 107 C61 103 62 98 60 92 Z"
            className={cn(s.flame, s.flameInner)}
          />
          <path
            d="M48 74 L40 90 L50 86 Z M72 74 L80 90 L70 86 Z"
            className={s.fin}
          />
          <path
            d="M60 22 C72 32 74 50 72 74 L70 90 H50 L48 74 C46 50 48 32 60 22 Z"
            className={s.body}
          />
          <path
            d="M60 22 C66 27 69 33 70.5 40 H49.5 C51 33 54 27 60 22 Z"
            className={s.nose}
          />
          <circle cx="60" cy="56" r="7" className={s.window} />
          <circle cx="57.5" cy="53.5" r="2" className={s.glint} />
          <rect x="56" y="86" width="8" height="5" rx="1.5" className={s.fin} />
        </g>
      </svg>
      <p className={s.label}>{label}…</p>
    </div>
  );
}
