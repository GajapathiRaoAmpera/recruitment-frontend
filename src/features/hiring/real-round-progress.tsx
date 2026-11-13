"use client";

import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { getRoundProgress, type ProgressRow, type StepName } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h, StatCard } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";
import { roundTitle } from "@/mock/data";
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
  // Quiet refresh while the tab is visible; the table keeps showing the last data meanwhile.
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => document.visibilityState === "visible" && reload(), AUTO_MS);
    return () => clearInterval(id);
  }, [auto, reload]);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: "Drive", href: `/hr/drives/${driveId}` }, { label: "Round progress" }]);

  if (error?.status === 404) return <NotFoundState title="Round not found" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data)
    return (
      <div className={h.stackSm}>
        <LoadingLabel label="Loading progress" />
        <Skeleton style={{ height: 80 }} />
        <Skeleton style={{ height: 200 }} />
      </div>
    );

  const rows = data.candidates;
  const count = (f: (r: ProgressRow) => boolean) => rows.filter(f).length;
  return (
    <div className={h.stack}>
      <PageHeader
        title={roundTitle[data.type as Round["type"]] ?? data.type}
        description={`Round progress · ${data.status}`}
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
      <section className={h.card}>
        <h2 className={h.cardTitle} style={{ marginBottom: 16 }}>
          Candidates
        </h2>
        {rows.length === 0 ? (
          <EmptyState title="No candidates in this round" description="Shortlist candidates to invite them." />
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = r.attemptStatus ? STATUS[r.attemptStatus] : undefined;
                return (
                  <tr key={r.candidateId}>
                    <Td>
                      {r.fullName} <span className={h.xs}>{r.studentId}</span>
                    </Td>
                    {STEPS.map((s) => (
                      <Td key={s.id} aria-label={`${s.label}: ${r.steps[s.id] === null ? "not tried" : r.steps[s.id] ? "done" : "failed"}`}>
                        {tick(r.steps[s.id])}
                      </Td>
                    ))}
                    <Td>{st ? <Badge tone={st.tone}>{st.label}</Badge> : <span className={h.xs}>Not started</span>}</Td>
                    <Td>{r.tabSwitches}</Td>
                    <Td>{r.marks ?? "—"}</Td>
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
