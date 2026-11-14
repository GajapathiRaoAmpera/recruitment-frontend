"use client";

import { AlertTriangle, CheckCircle2, Clock, Hourglass, RefreshCw, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getRoundProgress, type ProgressRow, type StepName } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h, RoundStatusBadge, StatCard } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";
import { roundTitle } from "@/mock/data";
import { countOutcomes, statusLabel, statusTone } from "./round-outcome";
import type { Round } from "@/mock/types";

const AUTO_MS = 10_000;

const STEPS: { id: StepName; label: string }[] = [
  { id: "id_dob", label: "ID + DOB" },
  { id: "location", label: "Location" },
  { id: "terms", label: "Terms" },
  { id: "fullscreen", label: "Full screen" },
];
const STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "danger" | "warning" }> = {
  in_progress: { label: "In progress", tone: "info" },
  submitted: { label: "Submitted", tone: "success" },
  locked: { label: "Locked", tone: "danger" },
  expired: { label: "Time up", tone: "warning" },
};
const tick = (v: boolean | null) => (v === null ? "—" : v ? "✓" : "✗");

/** HR's live view of one round, read from the API (entry checks + attempts). Refresh to update. */
export function RealRoundProgress({ driveId, roundId }: { driveId: string; roundId: string }) {
  const { data, error, loading, reload } = useAsync(() => getRoundProgress(driveId, roundId), [driveId, roundId]);
  const [auto, setAuto] = useState(true);
  const pending = data?.status === "pending"; // not open: nothing to watch, so no refresh
  const title = data ? (roundTitle[data.type as Round["type"]] ?? data.type) : "Round";
  // Quiet refresh while the tab is visible; the table keeps showing the last data meanwhile.
  useEffect(() => {
    if (!auto || pending) return;
    const id = setInterval(() => document.visibilityState === "visible" && reload(), AUTO_MS);
    return () => clearInterval(id);
  }, [auto, pending, reload]);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: "Drive", href: `/hr/drives/${driveId}` }, { label: title }]);

  if (error?.status === 404) return <NotFoundState title="Round not found" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <RocketLoader label="Loading progress" />;

  if (pending) {
    return (
      <div className={h.stack}>
        <PageHeader title={title} description={<RoundStatusBadge status="pending" />} />
        <section className={h.card} aria-labelledby="pending-h">
          <h2 id="pending-h" className={h.row} style={{ fontWeight: 600 }}>
            <Clock aria-hidden size={18} /> This round isn&apos;t open yet
          </h2>
          <p className={h.muted} style={{ marginTop: 8 }}>
            It opens when you advance the round before it. Students who pass that round join here automatically and get an email to start.
          </p>
          <p className={h.small} style={{ marginTop: 8 }}>
            {data.type === "coding"
              ? "Set up the coding test below first: the round before can't be advanced until this test has questions."
              : "There's nothing to set up here before it opens."}
          </p>
        </section>
      </div>
    );
  }

  const rows = data.candidates;
  const count = (f: (r: ProgressRow) => boolean) => rows.filter(f).length;
  const result = countOutcomes(rows.map((r) => r.status));
  const isFinal = data.type === "final";
  const pct = (n: number) => (result.total ? `${Math.round((n / result.total) * 100)}% of the round` : undefined);
  return (
    <div className={h.stack}>
      <PageHeader
        title={title}
        description={<RoundStatusBadge status={data.status as Round["status"]} />}
        actions={
          <span className={h.row}>
            <Button variant={auto ? "primary" : "secondary"} aria-pressed={auto} onClick={() => setAuto((a) => !a)}>
              Auto-refresh: {auto ? "On" : "Off"}
            </Button>
            <Button variant="secondary" onClick={reload} loading={loading}>
              <RefreshCw aria-hidden size={14} style={{ marginRight: 4 }} /> Refresh
            </Button>
          </span>
        }
      />
      <div className={h.grid4}>
        <StatCard label="In round" value={rows.length} icon={Users} hint={`${count((r) => !r.attemptStatus)} not started`} />
        <StatCard label="In progress" value={count((r) => r.attemptStatus === "in_progress")} icon={Clock} />
        <StatCard label="Submitted" value={count((r) => r.attemptStatus === "submitted")} icon={CheckCircle2} />
        <StatCard label="Locked" value={count((r) => r.attemptStatus === "locked")} icon={AlertTriangle} />
      </div>
      <section aria-label="Round result" className={h.stackSm}>
        <h2 className={h.cardTitle}>Round result</h2>
        <div className={h.grid4}>
          <StatCard label="Selected for this round" value={result.total} icon={Users} hint="Invited from the previous round" />
          <StatCard label={isFinal ? "Selected" : "Passed"} value={result.cleared} icon={ThumbsUp} hint={pct(result.cleared)} />
          <StatCard label={isFinal ? "Rejected" : "Not passed"} value={result.notCleared} icon={ThumbsDown} hint={result.notCleared ? "Failed, rejected or absent" : pct(result.notCleared)} />
          <StatCard label="Awaiting result" value={result.open} icon={Hourglass} hint={result.open ? "Not decided yet" : "Everyone is decided"} />
        </div>
      </section>
      <section className={h.card}>
        <h2 className={h.cardTitle} style={{ marginBottom: 16 }}>
          Candidates
        </h2>
        {rows.length === 0 ? (
          <EmptyState title="No candidates in this round" description="Students join when they're shortlisted (Round 1) or pass the round before this one." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Candidate</Th>
                {STEPS.map((s) => (
                  <Th key={s.id}>{s.label}</Th>
                ))}
                <Th>Status</Th>
                <Th>Tab switches</Th>
                <Th>Marks</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = r.attemptStatus ? STATUS[r.attemptStatus] : undefined;
                return (
                  <tr key={r.candidateId}>
                    <Td>
                      <Link href={`/hr/candidates/${r.candidateId}`} className={h.link}>
                        {r.fullName}
                      </Link>{" "}
                      <span className={h.xs}>{r.studentId}</span>
                    </Td>
                    {STEPS.map((s) => (
                      <Td key={s.id} aria-label={`${s.label}: ${r.steps[s.id] === null ? "not tried" : r.steps[s.id] ? "done" : "failed"}`}>
                        {tick(r.steps[s.id])}
                      </Td>
                    ))}
                    <Td>{st ? <Badge tone={st.tone}>{st.label}</Badge> : <span className={h.xs}>Not started</span>}</Td>
                    <Td>{r.tabSwitches}</Td>
                    <Td>{r.marks ?? "—"}</Td>
                    <Td>
                      <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
