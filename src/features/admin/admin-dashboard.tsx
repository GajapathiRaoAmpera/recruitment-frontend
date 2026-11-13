"use client";

import { Activity, FolderKanban, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { hire as h, Progress, StatCard } from "@/components/hire/ui";
import { driveRounds, useStore } from "@/mock/store";
import { RealAdminOverview } from "@/features/hiring/real-admin-overview";
import { supabase } from "@/lib/supabase";

function MockAdminDashboard() {
  useBreadcrumbs([{ label: "Admin overview" }]);
  const { state } = useStore();
  const selected = state.results.filter((r) => r.status === "selected").length;
  const total = state.candidates.length;

  return (
    <div className={h.stack}>
      <PageHeader
        title="Super Admin overview"
        description="All drives, users and system settings."
        actions={
          <Button asChild>
            <Link href="/hr/drives/new">New campus drive</Link>
          </Button>
        }
      />
      <div className={h.grid4}>
        <StatCard label="Drives" value={state.drives.length} hint={`${state.drives.filter((d) => d.status === "active").length} active`} icon={FolderKanban} />
        <StatCard label="Candidates" value={total} hint={`${state.candidates.filter((c) => c.shortlisted).length} shortlisted`} icon={Users} />
        <StatCard label="Selected" value={selected} icon={Trophy} />
        <StatCard label="Audit events" value={state.auditLogs.length} icon={Activity} />
      </div>

      <div className={h.grid2}>
        <section className={h.card} aria-labelledby="funnel-h">
          <h2 id="funnel-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
            Round-wise funnel
          </h2>
          <ul className={h.stack}>
            {state.drives.map((d) => {
              const enrolled = state.candidates.filter((c) => c.driveId === d.id).length || 1;
              return (
                <li key={d.id}>
                  <p style={{ fontWeight: 500, marginBottom: 8 }}>{d.roleTitle}</p>
                  <ul className={h.stackSm}>
                    {driveRounds(state, d.id)
                      .filter((r) => r.status !== "skipped")
                      .map((r) => {
                        const n = r.type === "shortlist" ? enrolled : state.results.filter((x) => x.roundId === r.id).length;
                        return (
                          <li key={r.id}>
                            <div className={h.between} style={{ marginBottom: 4 }}>
                              <span className={h.xs}>{r.title}</span>
                              <span className={h.xs}>{n}</span>
                            </div>
                            <Progress value={(n / enrolled) * 100} label={r.title} />
                          </li>
                        );
                      })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={h.card} aria-labelledby="audit-h">
          <div className={h.cardHead}>
            <h2 id="audit-h" className={h.cardTitle}>
              Recent activity
            </h2>
            <Link href="/admin/audit-logs" className={h.link}>
              All logs
            </Link>
          </div>
          <ul className={h.list}>
            {state.auditLogs.slice(0, 8).map((a) => (
              <li key={a.id} className={h.listItem}>
                <div>
                  <p className={h.small}>
                    <strong>{a.actor}</strong> · {a.action}
                  </p>
                  <p className={h.xs}>{a.target}</p>
                </div>
                <span className={h.xs}>{a.at}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  return supabase ? <RealAdminOverview /> : <MockAdminDashboard />;
}
