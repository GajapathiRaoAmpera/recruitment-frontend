"use client";

import { FileText, Plus } from "lucide-react";
import Link from "next/link";
import { listDrafts } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RobotLoader } from "@/components/ui/robot-loader";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/ui/states";
import type { Draft } from "@/features/papers/types";
import { useAsync } from "@/features/papers/use-async";
import s from "./papers.module.scss";

type Shown = "Generating" | "Draft" | "Accepted" | "Sent" | "Failed";
const TONE: Record<Shown, BadgeTone> = { Generating: "info", Draft: "neutral", Accepted: "primary", Sent: "success", Failed: "danger" };

/** Sent is derived: the server stamps persisted_at when the paper is first sent. */
export function shownStatus(d: Draft): Shown {
  if (d.persistedAt) return "Sent";
  return ({ generating: "Generating", draft: "Draft", accepted: "Accepted", failed: "Failed" } as const)[d.status];
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export function DraftList({ showOwner, ownerName }: { showOwner: boolean; ownerName: (id: string) => string }) {
  const { data, error, loading, reload } = useAsync(listDrafts, []);

  if (loading && !data) return <RobotLoader label="Loading papers" />;
  if (error && !data) return error.status === 403 ? <ForbiddenState /> : <ErrorState message={error.message} onRetry={reload} />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={<FileText aria-hidden size={32} />}
        title="No papers yet"
        description="Create a Round 1 paper: AI writes the Technical questions for the role, and you check them before sending."
        action={
          <Button asChild>
            <Link href="/hr/papers/new">
              <Plus aria-hidden size={16} style={{ marginRight: 6 }} /> New paper
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className={s.drafts} aria-label="Papers">
      {data.map((d) => {
        const st = shownStatus(d);
        const total = d.settings.counts.easy + d.settings.counts.medium + d.settings.counts.advanced;
        const { aptitude, reasoning, technical } = d.settings.mix;
        return (
          <li key={d.id}>
            <Link href={`/hr/papers/${encodeURIComponent(d.id)}`} className={s.draftCard}>
              <span className={h.between}>
                <span className={s.draftTitle}>{d.title}</span>
                <Badge tone={TONE[st]}>{st}</Badge>
              </span>
              <span className={h.xs}>
                {d.track === "it" ? "IT" : "Non-IT"} · {total} questions · {d.settings.durationMin} min
              </span>
              <span className={h.xs}>
                Aptitude {aptitude}% · Reasoning {reasoning}% · {d.track === "it" ? "Technical" : "Soft skills"} {technical}%
              </span>
              <span className={h.xs}>
                Created {date(d.createdAt)}
                {showOwner && <> · Owner {ownerName(d.ownerId)}</>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
