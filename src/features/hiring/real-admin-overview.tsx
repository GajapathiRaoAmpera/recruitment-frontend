"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProgressOverview } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { RobotLoader } from "@/components/ui/robot-loader";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";
import { roundTitle } from "@/mock/data";
import type { Round } from "@/mock/types";

const AUTO_MS = 10_000;

/** Super Admin overview from the API: every drive, every round, and where candidates are. */
export function RealAdminOverview() {
  const { data, error, loading, reload } = useAsync(getProgressOverview, []);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => document.visibilityState === "visible" && reload(), AUTO_MS);
    return () => clearInterval(id);
  }, [auto, reload]);
  useBreadcrumbs([{ label: "Admin overview" }]);

  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <RobotLoader label="Loading drives" />;

  return (
    <div className={h.stack}>
      <PageHeader
        title="Super Admin overview"
        description="Progress of every drive and round."
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
      {data.length === 0 ? (
        <EmptyState title="No drives yet" description="Drives appear here once HR creates them." />
      ) : (
        data.map((d) => (
          <section key={d.driveId} className={h.card} aria-label={d.roleTitle}>
            <h2 className={h.cardTitle} style={{ marginBottom: 4 }}>
              <Link href={`/hr/drives/${d.driveId}`}>{d.roleTitle}</Link>
            </h2>
            <p className={h.xs} style={{ marginBottom: 16 }}>
              {d.company} · {d.campus}
            </p>
            <Table>
              <thead>
                <tr>
                  <Th>Round</Th>
                  <Th>Status</Th>
                  <Th>In round</Th>
                  <Th>Not started</Th>
                  <Th>In progress</Th>
                  <Th>Submitted</Th>
                  <Th>Locked</Th>
                  <Th>Time up</Th>
                </tr>
              </thead>
              <tbody>
                {d.rounds.map((r) => (
                  <tr key={r.roundId}>
                    <Td>
                      <Link href={`/hr/drives/${d.driveId}/rounds/${r.roundId}`}>{roundTitle[r.type as Round["type"]] ?? r.type}</Link>
                    </Td>
                    <Td>{r.status}</Td>
                    <Td>{r.total}</Td>
                    <Td>{r.notStarted}</Td>
                    <Td>{r.inProgress}</Td>
                    <Td>{r.submitted}</Td>
                    <Td>{r.locked}</Td>
                    <Td>{r.expired}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        ))
      )}
    </div>
  );
}
