import { cn } from "@/lib/cn";
import s from "./bot-character.module.scss";

/**
 * The HR assistant's mascot: a small robot with a headset, drawn in brand tokens. Pure SVG + CSS (blinks, antenna
 * glow; `lively` adds a gentle bob for the launcher). Decorative only, so it is hidden from screen readers.
 */
export function BotCharacter({
  lively = false,
  className,
}: {
  lively?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn(s.bot, lively && s.lively, className)}
      aria-hidden
      focusable="false"
    >
      <line x1="32" y1="6" x2="32" y2="14" className={s.stroke} />
      <circle cx="32" cy="6" r="3.5" className={s.bulb} />
      <path d="M12 34 a20 20 0 0 1 40 0" className={s.band} />
      <rect x="9" y="28" width="7" height="13" rx="3.5" className={s.ear} />
      <rect x="48" y="28" width="7" height="13" rx="3.5" className={s.ear} />
      <rect x="14" y="14" width="36" height="36" rx="12" className={s.head} />
      <rect x="19" y="21" width="26" height="20" rx="8" className={s.screen} />
      <g className={s.eyes}>
        <ellipse cx="26.5" cy="29.5" rx="2.6" ry="3.2" className={s.eye} />
        <ellipse cx="37.5" cy="29.5" rx="2.6" ry="3.2" className={s.eye} />
      </g>
      <path d="M27 35.5 q5 4 10 0" className={s.smile} />
      <circle cx="21.5" cy="44.5" r="2" className={s.cheek} />
      <circle cx="42.5" cy="44.5" r="2" className={s.cheek} />
      <path d="M52 39 q2 10 -10 11" className={s.mic} />
      <circle cx="41" cy="50" r="2.2" className={s.bulb} />
    </svg>
  );
}
