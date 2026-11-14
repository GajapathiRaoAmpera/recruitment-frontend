"use client";

import { AlertTriangle, CalendarClock, ClipboardCheck, FolderKanban, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { listDrives, listRounds, getRoundProgress, type ProgressRow } from "@/api/hiring";
import { listInterviews, type InterviewRow } from "@/api/interviews";
import { RealDrivesCards } from "@/features/hiring/drives-table";
import { useAsync } from "@/features/papers/use-async";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { hire as h, Person, StatCard } from "@/components/hire/ui";
import { useStore } from "@/mock/store";

const REFRESH_MS = 60_000;
const DECIDED = ["passed", "failed", "selected", "rejected"];

interface Alert {
  row: ProgressRow;
  driveId: string;
  roundId: string;
  roundType: string;
}

interface DashboardData {
  ongoing: number;
  inDraft: number;
  awaiting: number;
  selected: number;
  alerts: Alert[];
  interviews: InterviewRow[];
}

/** Everything the dashboard shows, read from the API (HR gets their own drives, Super Admin gets all of them). */
async function loadDashboard(): Promise<DashboardData> {
  const [drives, interviews] = await Promise.all([listDrives(), listInterviews().catch(() => [] as InterviewRow[])]);

  const perDrive = await Promise.all(
    drives.map(async (d) => {
      const rounds = (await listRounds(d.id).catch(() => [])).filter((r) => r.type !== "shortlist");
      const progress = await Promise.all(rounds.map((r) => getRoundProgress(d.id, r.id).catch(() => null)));
      return progress.flatMap((p) => (p ? [{ driveId: d.id, progress: p }] : []));
    }),
  );

  let awaiting = 0;
  let selected = 0;
  const alerts: Alert[] = [];
  for (const { driveId, progress } of perDrive.flat()) {
    for (const row of progress.candidates) {
      if (row.attemptStatus === "locked") alerts.push({ row, driveId, roundId: progress.roundId, roundType: progress.type });
      if (row.attemptStatus === "submitted" && !DECIDED.includes(row.status)) awaiting += 1;
      if (progress.type === "final" && row.status === "selected") selected += 1;
    }
  }

  return {
    ongoing: drives.filter((d) => d.status !== "closed").length,
    inDraft: drives.filter((d) => d.status === "draft").length,
    awaiting,
    selected,
    alerts,
    interviews,
  };
}

const roundName: Record<string, string> = { aptitude: "Aptitude & technical", coding: "Coding", ai_interview: "AI interview", technical: "Technical", final: "Final" };
const interviewState: Record<InterviewRow["status"], string> = { scheduled: "Scheduled", live: "Live now", completed: "Transcript ready", failed: "Failed" };

export default function HrDashboard() {
  const { state } = useStore(); // only for the signed-in user's name
  const me = state.staff.find((u) => u.id === state.session?.userId);
  const { data, error, loading, reload } = useAsync(loadDashboard, []);

  // Quiet refresh while the tab is visible; the page keeps showing the last data meanwhile.
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === "visible" && reload(), REFRESH_MS);
    return () => clearInterval(id);
  }, [reload]);

  const ready = Boolean(data);
  const num = (n: number | undefined) => (ready ? n : "—");

  return (
    <div className={h.stack}>
      <section className={h.hero}>
        <div aria-hidden className={h.heroGlow} />
        <div className={h.heroInner}>
          <div>
            <p className={h.heroEyebrow}>Campus recruiting · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className={h.heroTitle}>Good to see you, {me?.name.split(" ")[0]}</h1>
            <p className={h.heroText}>
              {data
                ? `${data.alerts.length} locked test${data.alerts.length === 1 ? "" : "s"} need your review and ${data.awaiting} submission${data.awaiting === 1 ? " is" : "s are"} waiting for a cut-off.`
                : loading
                  ? "Loading your latest numbers…"
                  : "We couldn't load your latest numbers."}
            </p>
          </div>
          <Button asChild>
            <Link href="/hr/drives/new">
              <Plus aria-hidden size={16} style={{ marginRight: 6 }} /> Create campus drive
            </Link>
          </Button>
        </div>
      </section>

      {error && !data ? <ErrorState message={error.message} onRetry={reload} /> : null}

      <div className={h.grid4}>
        <StatCard label="Ongoing drives" value={num(data?.ongoing)} hint={ready ? `${data!.inDraft} in draft` : undefined} icon={FolderKanban} />
        <StatCard label="Awaiting cut-off" value={num(data?.awaiting)} hint="Submitted, not yet advanced" icon={ClipboardCheck} />
        <StatCard label="Integrity alerts" value={num(data?.alerts.length)} hint="Locked after 3 tab switches" icon={AlertTriangle} />
        <StatCard label="Selected" value={num(data?.selected)} hint="Final decisions made" icon={Trophy} />
      </div>

      <div className={h.split}>
        <section className={h.stackSm} aria-labelledby="drives-h">
          <div className={h.between}>
            <h2 id="drives-h" className={h.cardTitle}>
              Campus drives
            </h2>
            <Link href="/hr/drives" className={h.link}>
              View all drives
            </Link>
          </div>
          <RealDrivesCards />
        </section>

        <aside className={h.stack}>
          <section className={h.card} aria-labelledby="alerts-h">
            <div className={h.cardHead}>
              <h2 id="alerts-h" className={h.cardTitle}>
                Integrity alerts
              </h2>
              {data ? <Badge tone={data.alerts.length ? "danger" : "success"}>{data.alerts.length}</Badge> : null}
            </div>
            {!data ? (
              <p className={h.muted}>{loading ? "Loading…" : "Unavailable."}</p>
            ) : data.alerts.length === 0 ? (
              <p className={h.muted}>No locked tests. Nice and quiet.</p>
            ) : (
              <ul className={h.list}>
                {data.alerts.map((a) => (
                  <li key={a.roundId + a.row.candidateId} className={h.listItem}>
                    <Person name={a.row.fullName} meta={`${roundName[a.roundType] ?? a.roundType} · ${a.row.tabSwitches} tab switches`} />
                    <Link className={h.link} href={`/hr/drives/${a.driveId}/rounds/${a.roundId}?tab=alerts`}>
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={h.card} aria-labelledby="iv-h">
            <div className={h.cardHead}>
              <h2 id="iv-h" className={h.cardTitle}>
                AI interviews
              </h2>
              <CalendarClock aria-hidden size={18} />
            </div>
            {!data ? (
              <p className={h.muted}>{loading ? "Loading…" : "Unavailable."}</p>
            ) : data.interviews.length === 0 ? (
              <EmptyState title="No interviews yet" />
            ) : (
              <ul className={h.list}>
                {data.interviews.slice(0, 4).map((iv) => (
                  <li key={iv.id} className={h.listItem}>
                    <Person name={iv.fullName} meta={`${iv.roleTitle} · ${interviewState[iv.status]}`} />
                    <Link className={h.link} href={`/hr/interviews/${iv.id}`}>
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
