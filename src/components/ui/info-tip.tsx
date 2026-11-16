"use client";

import { Info } from "lucide-react";
import { useId, type ReactNode } from "react";
import s from "./info-tip.module.scss";

/** Small ⓘ that shows help text in a tooltip on hover, keyboard focus or tap; Escape closes it. */
export function InfoTip({ children, id, label = "More info" }: { children: ReactNode; id?: string; label?: string }) {
  const own = useId();
  const tipId = id ?? own;
  return (
    <span className={s.tipWrap}>
      <button type="button" aria-label={label} aria-describedby={tipId} className={s.tipBtn} onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}>
        <Info aria-hidden size={14} />
      </button>
      <span id={tipId} role="tooltip" className={s.tip}>
        {children}
      </span>
    </span>   
  );
}
