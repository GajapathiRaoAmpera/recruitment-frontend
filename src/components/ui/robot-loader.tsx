"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import s from "./robot-loader.module.scss";

interface RobotLoaderProps {
  label?: string;
  /** screen: whole viewport (app boot) · page: the content area · inline: a small slot inside a form. */
  size?: "screen" | "page" | "inline";
  className?: string;
}

/**
 * The one loading state of the app: a walking robot (three.js, loaded on demand) above a label.
 * It replaces the content while it loads, so no half-built UI shows first. Reduced motion gets one still
 * frame; no WebGL (old devices, tests) gets a static robot. Appears after 150 ms so fast loads don't flash.
 */
export function RobotLoader({ label = "Loading", size = "page", className }: RobotLoaderProps) {
  const host = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    import("./robot-scene")
      .then(({ mountRobot }) => {
        if (cancelled || !host.current) return;
        cleanup = mountRobot(host.current, { animate: !still });
      })
      .catch(() => !cancelled && setFallback(true));
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className={cn(s.loader, s[size], className)}>
      <div ref={host} aria-hidden className={s.stage}>
        {fallback && <StaticRobot />}
      </div>
      <p className={s.label}>{label}…</p>
    </div>
  );
}

function StaticRobot() {
  return (
    <svg viewBox="0 0 64 80" className={s.static} aria-hidden>
      <line x1="32" y1="4" x2="32" y2="12" className={s.joint} strokeWidth="2" />
      <circle cx="32" cy="4" r="3" className={s.glow} />
      <rect x="16" y="12" width="32" height="22" rx="7" className={s.shell} />
      <rect x="21" y="18" width="22" height="10" rx="4" className={s.visor} />
      <rect x="26" y="21" width="3" height="4" rx="1.5" className={s.eye} />
      <rect x="35" y="21" width="3" height="4" rx="1.5" className={s.eye} />
      <rect x="14" y="37" width="36" height="26" rx="7" className={s.shell} />
      <circle cx="32" cy="48" r="3.5" className={s.glow} />
      <rect x="7" y="38" width="6" height="18" rx="3" className={s.shell} />
      <rect x="51" y="38" width="6" height="18" rx="3" className={s.shell} />
      <rect x="20" y="64" width="7" height="12" rx="3" className={s.shell} />
      <rect x="37" y="64" width="7" height="12" rx="3" className={s.shell} />
    </svg>
  );
}
