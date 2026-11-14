"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { listDrafts } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Draft } from "@/features/papers/types";
import { useAsync } from "@/features/papers/use-async";
import { shownStatus, TONE } from "./draft-list";

// The paper the round runs on: a sent one beats an accepted one beats work in progress; newest wins a tie.
const RANK = { Sent: 0, Accepted: 1, Draft: 2, Generating: 3, Failed: 4 } as const;
const pickMain = (ds: Draft[]) =>
  [...ds].sort((a, b) => RANK[shownStatus(a)] - RANK[shownStatus(b)] || b.createdAt.localeCompare(a.createdAt))[0]!;

const NEXT: Record<keyof typeof RANK, { hint: (d: Draft) => string; cta: string }> = {
  Generating: { hint: (d) => `AI is writing questions (${d.progress.done} of ${d.progress.total}).`, cta: "View progress" },
  Failed: { hint: (d) => d.error ?? "Generation failed. Open the paper to retry.", cta: "Open paper" },
  Draft: { hint: () => "Check and edit the answers, then accept the paper.", cta: "Review paper" },
  Accepted: { hint: () => "Accepted. Send it to the students in this round.", cta: "Send paper" },
  Sent: { hint: (d) => `Sent on ${date(d.persistedAt!)}.`, cta: "View paper" },
};

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const href = (d: Draft) => `/hr/papers/${encodeURIComponent(d.id)}`;
const meta = (d: Draft) => {
  const c = d.settings.counts;
  return `${d.track === "it" ? "IT" : "Non-IT"} · ${c.easy + c.medium + c.advanced} questions · ${d.settings.durationMin} min`;
};

/** Round 1 set-up on the aptitude round page: the drive's paper, its next step, and a way to build one. */
export function RoundPaperPanel({ driveId }: { driveId: string }) {
  const { data, error, loading, reload } = useAsync(listDrafts, []);
  const newHref = `/hr/papers/new?drive=${encodeURIComponent(driveId)}`;
  const drafts = data?.filter((d) => d.driveRef === driveId) ?? [];
  const main = drafts.length ? pickMain(drafts) : undefined;
  const others = drafts.filter((d) => d !== main);

  return (
    <section className={h.card} aria-labelledby="round-paper-h">
      <div className={h.cardHead}>
        <h2 id="round-paper-h" className={h.cardTitle}>
          Round 1 paper
        </h2>
        {main && (
          <Button asChild variant="secondary" size="sm">
            <Link href={newHref}>
              <Plus aria-hidden size={14} style={{ marginRight: 4 }} /> New paper
            </Link>
          </Button>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        {loading && !data ? (
          <RocketLoader label="Loading the round's paper" />
        ) : error && !data ? (
          <ErrorState message={`Couldn't load the paper: ${error.message}`} onRetry={reload} />
        ) : !main ? (
          <EmptyState
            icon={<FileText aria-hidden size={32} />}
            title="No paper for this round yet"
            description="Pick the question mix and difficulty. AI writes the questions, and you check every answer before students see it."
            action={
              <Button asChild>
                <Link href={newHref}>
                  <FileText aria-hidden size={16} style={{ marginRight: 6 }} /> Build paper
                </Link>
              </Button>
            }
          />
        ) : (
          <div className={h.stackSm}>
            <div className={h.between} style={{ gap: 16, flexWrap: "wrap" }}>
              <div>
                <p className={h.row} style={{ fontWeight: 600 }}>
                  {main.title} <Badge tone={TONE[shownStatus(main)]}>{shownStatus(main)}</Badge>
                </p>
                <p className={h.xs}>{meta(main)}</p>
                <p className={h.small} style={{ marginTop: 4 }}>
                  {NEXT[shownStatus(main)].hint(main)}
                </p>
              </div>
              <Button asChild>
                <Link href={href(main)}>{NEXT[shownStatus(main)].cta}</Link>
              </Button>
            </div>
            {others.length > 0 && (
              <details>
                <summary className={h.small} style={{ cursor: "pointer" }}>
                  Other papers for this drive ({others.length})
                </summary>
                <ul className={h.list} style={{ marginTop: 8 }}>
                  {others.map((d) => (
                    <li key={d.id} className={h.listItem}>
                      <Link href={href(d)}>{d.title}</Link>
                      <Badge tone={TONE[shownStatus(d)]}>{shownStatus(d)}</Badge>
                      <span className={h.xs}>{meta(d)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
