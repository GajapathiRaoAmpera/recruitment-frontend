"use client";

import { CheckCircle2, Lock, PlayCircle, TimerOff, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { hire as h } from "@/components/hire/ui";
import { exitFullscreen } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { useResumeWatch } from "./use-entry-rounds";

/** A round the student can't write right now. Never shows marks or scores, and never leads back into the test. */
export type ClosedKind = "submitted" | "locked" | "expired";

export const CLOSED_KINDS: readonly string[] = ["submitted", "locked", "expired"] satisfies ClosedKind[];
export const isClosed = (status: string | undefined): status is ClosedKind => status !== undefined && CLOSED_KINDS.includes(status);

/** Server refusals from POST /entry/start that mean the same thing as a closed status. */
export const CLOSED_BY_CODE: Record<string, ClosedKind> = { ATTEMPT_SUBMITTED: "submitted", ATTEMPT_LOCKED: "locked", ATTEMPT_EXPIRED: "expired" };

const COPY: Record<ClosedKind | "resumed", { icon: LucideIcon; color?: string; title: string; text: string }> = {
  submitted: { icon: CheckCircle2, color: "var(--ui-color-success)", title: "Test recorded", text: "Your test has been recorded. Our team will review it and contact you soon." },
  locked: { icon: Lock, title: "Your test is paused", text: "Your test is paused. HR needs to resume it before you can continue." },
  expired: { icon: TimerOff, title: "Time is up", text: "Time is up. Your answers were submitted." },
  resumed: {
    icon: PlayCircle,
    color: "var(--ui-color-success)",
    title: "HR has resumed your test",
    text: "Continue to run the system check again. Your saved answers and the time you had left are restored.",
  },
};

interface ClosedProps {
  kind: ClosedKind;
  entryToken: string;
  roundId: string;
  /** Extra line under the text (e.g. why the test paused). */
  detail?: ReactNode;
  /** After a resume: what Continue does. Default: go to /exam/{roundId}, so the system check runs again. */
  onContinue?: () => void;
}

/** Icon, title, text and the one action. A paused test checks every 10 s whether HR resumed it. */
function ClosedContent({ kind, entryToken, roundId, detail, onContinue, headingId }: ClosedProps & { headingId: string }) {
  const resumed = useResumeWatch(entryToken, roundId, kind === "locked");
  const c = COPY[resumed ? "resumed" : kind];
  const Icon = c.icon;
  // The one action takes focus on open and again after a resume (autoFocus doesn't reach a link).
  const action = useRef<HTMLButtonElement>(null);
  useEffect(() => action.current?.focus(), [resumed]);
  return (
    <>
      <Icon aria-hidden size={32} color={c.color} />
      <h1 id={headingId} className={h.cardTitle}>
        {c.title}
      </h1>
      <div aria-live="polite" className={h.stackSm}>
        <p className={h.muted}>{c.text}</p>
        {!resumed && detail && <p className={h.xs}>{detail}</p>}
      </div>
      {resumed ? (
        onContinue ? (
          <Button ref={action} onClick={onContinue}>
            Continue
          </Button>
        ) : (
          <Button ref={action} asChild>
            <Link href={`/exam/${roundId}`}>Continue</Link>
          </Button>
        )
      ) : (
        <Button ref={action} asChild variant="secondary">
          <Link href="/student">Back to dashboard</Link>
        </Button>
      )}
    </>
  );
}

/** Over the test screen (after submit, or when the attempt locks). The page behind is inert. */
export function AttemptClosedOverlay(props: ClosedProps) {
  const id = `closed-${props.kind}-h`;
  return (
    <div className={s.overlay} role="alertdialog" aria-modal="true" aria-labelledby={id}>
      <div className={s.overlayCard}>
        <ClosedContent {...props} headingId={id} />
      </div>
    </div>
  );
}

/** A page of its own, for re-entry into a closed round: no camera, location, terms or full-screen steps. */
export function AttemptClosedScreen({ title, ...props }: ClosedProps & { title: string }) {
  useEffect(() => exitFullscreen(), []);
  return (
    <>
      <header className={s.examBar}>
        <Logo height={22} />
        <div className={s.examTitle}>
          <p>{title}</p>
        </div>
      </header>
      <main className={`${s.examBody} ${s.examGate}`}>
        <section className={s.overlayCard} style={{ marginInline: "auto" }} aria-labelledby={`closed-${props.kind}-h`}>
          <ClosedContent {...props} headingId={`closed-${props.kind}-h`} />
        </section>
      </main>
    </>
  );
}
