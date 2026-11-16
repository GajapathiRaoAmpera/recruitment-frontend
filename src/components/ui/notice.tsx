import { AlertTriangle, CheckCircle2, Info, Inbox, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import s from "./notice.module.scss";

export type NoticeTone = "info" | "success" | "warning" | "danger" | "neutral";

const ICON: Record<NoticeTone, LucideIcon> = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle, neutral: Info };

interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  /** Buttons or links for the next step, shown under the text. */
  actions?: ReactNode;
  icon?: LucideIcon;
  /** `status` for results and progress, `alert` for problems the user must act on. */
  role?: "status" | "alert";
  /** Smaller padding for notices inside cards, dialogs and forms. */
  compact?: boolean;
  className?: string;
}

/** A tinted message card: icon, title, text and next step. Use it instead of bare paragraphs for any result, warning or waiting state. */
export function Notice({ tone = "info", title, children, actions, icon, role, compact, className }: NoticeProps) {
  const Icon = icon ?? ICON[tone];
  return (
    <div role={role} aria-live={role === "status" ? "polite" : undefined} className={cn(s.notice, s[tone], compact && s.compact, className)}>
      <span className={s.icon} aria-hidden>
        <Icon size={compact ? 16 : 20} />
      </span>
      <div className={s.body}>
        {title && <p className={s.title}>{title}</p>}
        {children && <div className={s.text}>{children}</div>}
        {actions && <div className={s.actions}>{actions}</div>}
      </div>
    </div>
  );
}

/** "Nothing here yet" inside a card: a soft icon and one line, centred. Full-page empties use EmptyState. */
export function InlineEmpty({ children, icon: Icon = Inbox, className }: { children: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn(s.inlineEmpty, className)}>
      <span className={s.inlineEmptyIcon} aria-hidden>
        <Icon size={18} />
      </span>
      <p>{children}</p>
    </div>
  );
}

/** A helper line under a control: why a button is off, what happens next. */
export function Hint({ children, tone = "neutral", id, role, className }: { children: ReactNode; tone?: "neutral" | "warning" | "danger"; id?: string; role?: "alert"; className?: string }) {
  const Icon = tone === "neutral" ? Info : AlertTriangle;
  return (
    <p id={id} role={role} className={cn(s.hint, s[`hint-${tone}`], className)}>
      <Icon aria-hidden size={14} />
      <span>{children}</span>
    </p>
  );
}
