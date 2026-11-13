"use client";

import { AlertTriangle, CalendarClock, ClipboardCheck, FolderKanban, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { DrivesCards } from "@/features/hiring/drives-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { hire as h, Person, StatCard } from "@/components/hire/ui";
import { candidateById, useStore } from "@/mock/store";

export default function HrDashboard() {
  const { state } = useStore();
  const me = state.staff.find((u) => u.id === state.session?.userId);
  const drives = state.drives.filter((d) => d.status !== "closed");
  const locked = state.results.filter((r) => r.locked);
  const toReview = state.results.filter((r) => r.status === "submitted");
  const selected = state.results.filter((r) => r.status === "selected");
  const interviews = state.interviews;

  return (
    <div className={h.stack}>
      <section className={h.hero}>
        <div aria-hidden className={h.heroGlow} />
        <div className={h.heroInner}>
          <div>
            <p className={h.heroEyebrow}>Campus recruiting · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className={h.heroTitle}>Good to see you, {me?.name.split(" ")[0]}</h1>
            <p className={h.heroText}>
              {locked.length} locked test{locked.length === 1 ? "" : "s"} need your review and {toReview.length} submissions are waiting for a cut-off.
            </p>
          </div>
          <Button asChild>
            <Link href="/hr/drives/new">
              <Plus aria-hidden size={16} style={{ marginRight: 6 }} /> Create campus drive
            </Link>
          </Button>
        </div>
      </section>

      <div className={h.grid4}>
        <StatCard label="Ongoing drives" value={drives.length} hint={`${state.drives.filter((d) => d.status === "draft").length} in draft`} icon={FolderKanban} />
        <StatCard label="Awaiting cut-off" value={toReview.length} hint="Submitted, not yet advanced" icon={ClipboardCheck} />
        <StatCard label="Integrity alerts" value={locked.length} hint="Locked after 3 tab switches" icon={AlertTriangle} />
        <StatCard label="Selected" value={selected.length} hint="Final decisions made" icon={Trophy} />
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
          <DrivesCards />
        </section>

        <aside className={h.stack}>
          <section className={h.card} aria-labelledby="alerts-h">
            <div className={h.cardHead}>
              <h2 id="alerts-h" className={h.cardTitle}>
                Integrity alerts
              </h2>
              <Badge tone={locked.length ? "danger" : "success"}>{locked.length}</Badge>
            </div>
            {locked.length === 0 ? (
              <p className={h.muted}>No locked tests. Nice and quiet.</p>
            ) : (
              <ul className={h.list}>
                {locked.map((r) => {
                  const c = candidateById(state, r.candidateId)!;
                  const round = state.rounds.find((x) => x.id === r.roundId)!;
                  return (
                    <li key={r.roundId + r.candidateId} className={h.listItem}>
                      <Person name={c.name} meta={`${round.title} · ${r.tabSwitches} tab switches`} />
                      <Link className={h.link} href={`/hr/drives/${round.driveId}/rounds/${round.id}?tab=alerts`}>
                        Review
                      </Link>
                    </li>
                  );
                })}
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
            {interviews.length === 0 ? (
              <EmptyState title="No interviews yet" />
            ) : (
              <ul className={h.list}>
                {interviews.slice(0, 4).map((iv) => {
                  const c = candidateById(state, iv.candidateId)!;
                  return (
                    <li key={iv.id} className={h.listItem}>
                      <Person name={c.name} meta={`${iv.slot} · ${iv.status === "completed" ? "Transcript ready" : "Scheduled"}`} />
                      <Link className={h.link} href={`/hr/interviews/${iv.id}`}>
                        Open
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
