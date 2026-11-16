"use client";

import { Check, Info, RotateCcw, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getDraft } from "@/api/papers";
import { Progress, hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { cn } from "@/lib/cn";
import type { DraftDetail } from "@/features/papers/types";
import s from "./papers.module.scss";

export const POLL_MS = 2000;

// The headline is the RocketLoader label, which adds the trailing "…".
const STAGES: {
  label: string;
  headline: string;
  hint: (done: number, total: number) => string;
}[] = [
  {
    label: "Prepare the AI models",
    headline: "Getting ready for launch",
    hint: () => "Reading the round set-up and the question mix",
  },
  {
    label: "Write questions",
    headline: "Writing questions",
    hint: (d, t) => (t ? `${d} of ${t} written so far` : "Starts in a moment"),
  },
  {
    label: "Pick the best mix",
    headline: "Picking the best mix for the paper",
    hint: () => "Balancing topics and difficulty",
  },
  {
    label: "Ready for your review",
    headline: "",
    hint: () => "You check every answer in the next step",
  },
];
const activeStage = (done: number, total: number) =>
  done === 0 ? 0 : done < total ? 1 : 2;

/**
 * Step 2: shows generation progress and polls GET /papers/drafts/{id} every 2 s while status is `generating`.
 * Every fresh draft is passed to `onUpdate`; the parent switches views once the status changes.
 */
export function GenerationProgress({
  draft,
  onUpdate,
}: {
  draft: DraftDetail;
  onUpdate: (d: DraftDetail) => void;
}) {
  const [retry, setRetry] = useState(0);
  const [lost, setLost] = useState(false);
  const generating = draft.status === "generating";

  useEffect(() => {
    if (!generating) return;
    let stale = false;
    const timer = setTimeout(() => {
      getDraft(draft.id).then(
        (d) => {
          if (stale) return;
          setLost(false);
          onUpdate(d);
        },
        () => {
          if (stale) return;
          setLost(true);
          setRetry((n) => n + 1); // keep polling: a blip must not freeze the view
        },
      );
    }, POLL_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [draft, generating, retry, onUpdate]);

  if (draft.status === "failed") {
    return (
      <Notice
        role="alert"
        tone="danger"
        title="Generation failed"
        actions={
          <Button asChild>
            <Link href={`/hr/papers/new?drive=${encodeURIComponent(draft.driveRef)}`}>
              <RotateCcw aria-hidden size={16} style={{ marginRight: 6 }} /> Start over
            </Link>
          </Button>
        }
      >
        {draft.error ?? "The AI models could not finish this paper."} Your drive and its settings are unchanged.
      </Notice>
    );
  }

  const { done, total } = draft.progress;
  const pct = total ? (done / total) * 100 : 0;
  const active = activeStage(done, total);
  return (
    <section className={cn(h.card, s.launch)} aria-label="Generating the paper">
      <div className={s.launchMain}>
        <RocketLoader
          size="inline"
          label={STAGES[active]!.headline}
          className={s.launchRocket}
        />
        <p className={s.counter}>
          {total ? (
            <>
              {done} / {total}{" "}
              <span className={h.small}>questions written</span>
            </>
          ) : (
            <span className={h.small}>Preparing…</span>
          )}
          <span className={s.pct}>{Math.round(pct)}%</span>
        </p>
        <div className={s.launchBar}>
          <Progress value={pct} label="Generation progress" />
        </div>
        {lost && (
          <p className={s.launchLost} role="status">
            <WifiOff aria-hidden size={14} /> Lost connection to the server.
            Retrying…
          </p>
        )}
      </div>

      <ol className={s.stages} aria-label="Generation stages">
        {STAGES.map((st, i) => {
          const state = i < active ? "done" : i === active ? "active" : "todo";
          return (
            <li
              key={st.label}
              className={s.stage}
              data-state={state}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span className={s.stageDot} aria-hidden>
                {state === "done" ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span>
                <span className={s.stageLabel}>
                  {st.label}
                  <span className="sr-only">
                    {state === "done"
                      ? ", done"
                      : state === "active"
                        ? ", in progress"
                        : ", next"}
                  </span>
                </span>
                <span className={s.stageHint}>{st.hint(done, total)}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className={s.launchNote}>
        <Info aria-hidden size={14} /> You can leave this page. Generation keeps
        running, and the paper waits on the aptitude round&apos;s Round 1 card.
      </p>
    </section>
  );
}
