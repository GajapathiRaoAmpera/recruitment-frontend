import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./badge.module.scss";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn(s.badge, s[tone], className)}>{children}</span>;
}
