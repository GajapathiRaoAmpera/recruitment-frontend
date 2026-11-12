"use client";

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoNote, hire as h, ResultBadge, RoundStatusBadge } from "@/components/hire/ui";
import { useStudent } from "@/components/student/hooks";
import { RealStudentHome } from "@/features/student/real-student-home";
import { driveRounds, useStore } from "@/mock/store";
import type { Round } from "@/mock/types";

const examPath = (r: Round) => `/exam/${r.id}`;

function MockDashboard() {
  const { state } = useStore();
  const { candidate, drive } = useStudent();
  if (!candidate || !drive) return null;
  const rounds = driveRounds(state, drive.id).filter((r) => r.type !== "shortlist" && r.status !== "skipped");
  const mine = (r: Round) => state.results.find((x) => x.roundId === r.id && x.candidateId === candidate.id);
  const current = rounds.find((r) => r.status === "active" && mine(r) && ["invited", "in_progress"].includes(mine(r)!.status));
  const currentResult = current && mine(current);
  const previewable = rounds.filter((r) => (r.type === "coding" || r.type === "ai_interview" || r.type === "aptitude") && !mine(r));

  return (
    <div className={h.stack}>
      <section className={h.hero}>
        <div aria-hidden className={h.heroGlow} />
        <div className={h.heroInner}>
          <div>
            <p className={h.heroEyebrow}>{drive.campus} · {drive.window}</p>
            <h1 className={h.heroTitle}>Welcome, {candidate.name.split(" ")[0]}</h1>
            <p className={h.heroText}>{drive.roleTitle}</p>
          </div>
          {current && currentResult && !currentResult.locked && (
            <Button asChild>
              <Link href={examPath(current)}>
                {currentResult.status === "in_progress" ? "Resume" : "Start"} {current.title.split("·")[0]} <ArrowRight aria-hidden size={16} style={{ marginLeft: 6 }} />
              </Link>
            </Button>
          )}
        </div>
      </section>

      {currentResult?.locked && (
        <div className={h.card} role="status">
          <div className={h.row}>
            <Lock aria-hidden size={18} />
            <strong>Your test is paused.</strong>
          </div>
          <p className={h.muted} style={{ marginTop: 6 }}>
            It closed after {currentResult.tabSwitches} tab switches. HR has been alerted and can let you resume where you stopped.
          </p>
        </div>
      )}

      <section className={h.card} aria-labelledby="journey-h">
        <h2 id="journey-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
          Your application
        </h2>
        <ol className={h.list}>
          <li className={h.listItem}>
            <span>Resume shortlist</span>
            {candidate.shortlisted ? <Badge tone="success">Shortlisted</Badge> : candidate.shortlisted === false ? <Badge tone="danger">Not shortlisted</Badge> : <Badge>Under review</Badge>}
          </li>
          {rounds.map((r) => {
            const res = mine(r);
            return (
              <li key={r.id} className={h.listItem}>
                <div>
                  <p>{r.title}</p>
                  <p className={h.xs}>
                    {r.durationMin ? `${r.durationMin} min · ` : ""}
                    {r.mode === "ai" ? "AI-led" : r.mode === "manual" ? "With the panel" : "Online test"}
                  </p>
                </div>
                {res ? <ResultBadge status={res.status === "submitted" ? "submitted" : res.status} locked={res.locked} /> : <RoundStatusBadge status={r.status === "active" ? "pending" : r.status} />}
              </li>
            );
          })}
        </ol>
      </section>

      {previewable.length > 0 && (
        <section className={h.stackSm}>
          <DemoNote>Demo: preview later rounds before HR invites you. Previews are not recorded.</DemoNote>
          <div className={h.row}>
            {previewable.map((r) => (
              <Button key={r.id} asChild variant="secondary" size="sm">
                <Link href={examPath(r)}>Preview {r.title.split("·")[1]?.trim() ?? r.title}</Link>
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function StudentDashboard() {
  const { real } = useStudent();
  return real ? <RealStudentHome student={real} /> : <MockDashboard />;
}
