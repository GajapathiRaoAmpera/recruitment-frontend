import { cn } from "@/lib/cn";
import { RocketLoader } from "./rocket-loader";
import s from "./skeleton.module.scss";

/** The rocket with its label (a role="status" announcement), for whole-page or whole-panel loads. */
export function LoadingLabel({ label = "Loading" }: { label?: string }) {
  return <RocketLoader label={label} />;
}

/**
 * A shimmering placeholder block for a value that is being recomputed in place (e.g. counts while a new cut-off
 * is previewed), so stale numbers never show as if they were current. Size it with `style`/`className`.
 * Decorative: announce the wait on the surrounding region (aria-busy) or with a status text.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden className={cn(s.skeleton, className)} style={style} />;
}
