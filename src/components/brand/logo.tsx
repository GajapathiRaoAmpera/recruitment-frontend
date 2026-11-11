import Image from "next/image";
import { cn } from "@/lib/cn";
import s from "./logo.module.scss";

/**
 * Official Ampera logo (810×226, transparent PNG). Fixed height, natural aspect ratio, never recolored.
 * Shown directly on dark surfaces too: a logo is exempt from text-contrast rules, and a light chip read as a pasted banner.
 */
export function Logo({ height = 28, className }: { height?: number; onDark?: boolean; className?: string }) {
  // Intrinsic size + explicit CSS height/auto width: keeps the exact aspect ratio (no distortion warnings).
  return (
    <span className={cn(s.logo, className)}>
      <Image src="/brand/ampera-logo.png" alt="Ampera" width={810} height={226} priority style={{ height, width: "auto" }} />
    </span>
  );
}

/** The "A" mark (50×51) for collapsed navigation. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span className={cn(s.logo, className)}>
      <Image src="/brand/ampera-mark.png" alt="Ampera" width={50} height={51} style={{ width: size, height: "auto" }} />
    </span>
  );
}
