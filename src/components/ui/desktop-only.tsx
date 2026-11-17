"use client";

import { Monitor } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import s from "./desktop-only.module.scss";
import { EmptyState } from "./states";

const QUERY = "(max-width: 1023.98px)"; // below the lg breakpoint in styles/_mixins.scss

const subscribe = (onChange: () => void) => {
  const mq = window.matchMedia?.(QUERY);
  mq?.addEventListener("change", onChange);
  return () => mq?.removeEventListener("change", onChange);
};
const isSmall = () => window.matchMedia?.(QUERY).matches ?? false;

/**
 * Pages that need fullscreen, a webcam and a code editor (exams, AI interview) can't be used on a phone.
 * Checked on entry only: once the page is open, resizing the window never unmounts it (that would lose answers and the camera).
 */
export function DesktopOnly({ children }: { children: ReactNode }) {
  const small = useSyncExternalStore(subscribe, isSmall, () => null); // null on the server: size unknown, mount nothing yet
  const [entered, setEntered] = useState(false);
  if (small === false && !entered) setEntered(true);
  if (entered) return children;
  if (small === null) return null;
  return (
    <main className={s.wrap}>
      <EmptyState
        icon={<Monitor aria-hidden size={32} />}
        title="Please use a desktop or laptop"
        description="This page can't be used on a phone or small screen. Open the same link on a laptop or desktop computer, or widen this window."
      />
    </main>
  );
}
