"use client";

import { Activity, FolderKanban, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { hire as h, StatCard } from "@/components/hire/ui";
import { useStore } from "@/mock/store";
import { MockDrivesCards } from "@/features/hiring/drives-table";
import { RealAdminOverview } from "@/features/hiring/real-admin-overview";
import { liveApi } from "@/lib/auth";

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
        <section className={h.stackSm} aria-labelledby="drives-h">
          <div className={h.between}>
            <h2 id="drives-h" className={h.cardTitle}>
              Campus drives
            </h2>
            <Link href="/hr/drives" className={h.link}>
              View all drives
            </Link>
          </div>
          <MockDrivesCards />
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

export default function AdminDashboard() {
  return liveApi ? <RealAdminOverview /> : <MockAdminDashboard />;
}
