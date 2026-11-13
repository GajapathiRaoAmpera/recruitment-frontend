"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getDraft } from "@/api/papers";
import { Progress, hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import type { DraftDetail } from "@/features/papers/types";
import s from "./papers.module.scss";

export const POLL_MS = 2000;

function stage(done: number, total: number) {
  if (done === 0) return "Starting the AI models…";
  if (done < total) return "The AI is writing the Technical questions for the role. You check the answers in the next step.";
  return "Building the sample paper…";
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
    <div className={h.card}>
      <div className={h.stackSm} aria-live="polite">
        <p className={s.counter}>
          {done} / {total} <span className={h.small}>questions generated and checked</span>
        </p>
        <Progress value={pct} label="Generation progress" />
        <p className={s.stage}>{stage(done, total)}</p>
        {lost && <p className={h.xs}>Lost connection to the server — retrying…</p>}
        <p className={h.xs}>You can leave this page; generation keeps running and the draft will be waiting under Paper builder.</p>
      </div>
    </div>
  );
}
