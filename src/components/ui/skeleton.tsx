import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import s from "./skeleton.module.scss";

/** Placeholder block; size it with `style` (height/width) or a caller's class. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn(s.skeleton, className)} style={style} />;
}

/** Screen-reader announcement for a loading region, paired with visual skeletons. */
export function LoadingLabel({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="sr-only">
      {label}…
    </p>
  );
}
