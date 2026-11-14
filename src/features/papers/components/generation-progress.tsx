"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getDraft } from "@/api/papers";
import { Progress, hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { cn } from "@/lib/cn";
import type { DraftDetail } from "@/features/papers/types";
import s from "./papers.module.scss";

export const POLL_MS = 2000;

// RocketLoader adds the trailing "…".
function stage(done: number, total: number) {
  if (done === 0) return "Getting ready for launch";
  if (done < total) return "Writing questions. You check every answer in the next step";
  return "Picking the best mix for the paper";
}

/**
 * Step 2: shows generation progress and polls GET /papers/drafts/{id} every 2 s while status is `generating`.
 * Every fresh draft is passed to `onUpdate`; the parent switches views once the status changes.
 */
export function GenerationProgress({ draft, onUpdate }: { draft: DraftDetail; onUpdate: (d: DraftDetail) => void }) {
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
      <div role="alert" className={h.card}>
        <div className={h.stackSm}>
          <p className={h.row} style={{ fontWeight: 500, color: "var(--ui-color-danger)" }}>
            <AlertTriangle aria-hidden size={18} /> Generation failed
          </p>
          <p>{draft.error ?? "The AI models could not finish this paper."}</p>
          <div>
            <Button asChild variant="secondary">
              <Link href={`/hr/papers/new?drive=${encodeURIComponent(draft.driveRef)}`}>
                <RotateCcw aria-hidden size={16} style={{ marginRight: 6 }} /> Start over
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { done, total } = draft.progress;
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className={cn(h.card, s.launch)}>
      <RocketLoader size="inline" label={stage(done, total)} className={s.launchRocket} />
      <div className={s.launchBody}>
        <p className={s.counter}>
          {total ? (
            <>
              {done} / {total} <span className={h.small}>questions written</span>
            </>
          ) : (
            <span className={h.small}>Preparing…</span>
          )}
          <span className={s.pct}>{Math.round(pct)}%</span>
        </p>
        <Progress value={pct} label="Generation progress" />
        {lost && <p className={h.xs}>Lost connection to the server. Retrying…</p>}
        <p className={h.xs}>You can leave this page. Generation keeps running, and the paper waits on the aptitude round&apos;s Round 1 card.</p>
      </div>
    </div>
  );
}
