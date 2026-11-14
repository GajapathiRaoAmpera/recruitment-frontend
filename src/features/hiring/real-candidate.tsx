"use client";

import { Award, FileText, Flag, Percent, Target } from "lucide-react";
import { useState } from "react";
import { getCandidate, listRounds, openResume } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Chips, hire as h, StatCard } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";
import { JourneyBar, ScoreByRoundChart, type RoundPoint } from "./candidate-charts";
import cs from "./candidate.module.scss";
import { outcomeOf, statusLabel, statusTone } from "./round-outcome";

const ROUND_NAME: Record<string, string> = { aptitude: "Aptitude test", coding: "Coding test", ai_interview: "AI interview", technical: "Technical round", final: "Final decision" };
const roundName = (type: string) => ROUND_NAME[type] ?? type.replaceAll("_", " ");

// Form answers worth showing in the details box. Links (resume upload etc.) and fields already shown elsewhere are left out.
const HIDDEN_KEY = /resume|\bcv\b|upload|link|url|drive|timestamp|photo|signature|agree|consent|proctoring/i;
const SHOWN_ELSEWHERE_KEY = /^(full\s*)?name$|^(student\s*)?id$|e-?mail|phone|mobile|contact/i;
/** Where a detail sits in the list: who they are, then education in the order they studied (10th, inter/diploma, graduation), then skills. Unknown fields keep the sheet's order at the end. */
const DETAIL_ORDER: [RegExp, number][] = [
  [/^student\s*id$/i, 0],
  [/^email$/i, 1],
  [/^phone$/i, 2],
  [/10th|tenth|\bssc\b/i, 10],
  [/12th|inter|diploma|\bpuc\b|\bhsc\b/i, 20],
  [/degree|b\.?\s?tech|course/i, 30],
  [/branch|department|stream/i, 31],
  [/college|university|institute/i, 32],
  [/graduation|passing|passout/i, 33],
  [/cgpa|percentage|\bgpa\b/i, 34],
  [/backlog/i, 35],
  [/skill/i, 40],
];
const detailRank = (label: string) => DETAIL_ORDER.find(([re]) => re.test(label.trim()))?.[1] ?? 99;
const isLink =(v: string) => /^(https?:)?\/\//i.test(v.trim()) || /drive\.google\.com|docs\.google\.com/i.test(v);

/** AI interview scores are an average out of 5; test rounds store a percent. Both are drawn on a 0-100 bar. */
const toPercent = (type: string, score: number | null) => (score === null ? null : Math.max(0, Math.min(100, type === "ai_interview" ? score * 20 : score)));
const scoreText = (type: string, score: number) => (type === "ai_interview" ? `${score.toFixed(1)} / 5` : `${Math.round(score)}%`);

export function RealCandidate({ candidateId }: { candidateId: string }) {
  const toast = useToast();
  const { data: c, error, loading, reload } = useAsync(() => getCandidate(candidateId), [candidateId]);
  const driveId = c?.driveId;
  // The drive's whole pipeline, so rounds the student hasn't reached yet still show up as "Not reached".
  const driveRounds = useAsync(() => (driveId ? listRounds(driveId) : Promise.resolve([])), [driveId]);
  const [opening, setOpening] = useState(false);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, ...(c ? [{ label: "Shortlist", href: `/hr/drives/${c.driveId}/candidates` }] : []), { label: c?.fullName ?? "Candidate" }]);

  if (error?.status === 404) return <NotFoundState title="Candidate not found" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !c) return <RocketLoader label="Loading candidate" />;

  const open = async () => {
    setOpening(true);
    try {
      await openResume(c.id);
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't open the resume", description: (e as Error).message });
    } finally {
      setOpening(false);
    }
  };

  // Student details box: who they are, plus the form answers that are not links.
  const details: { label: string; value: string }[] = [
    { label: "Student ID", value: c.studentId },
    { label: "Email", value: c.email },
    ...(c.phone ? [{ label: "Phone", value: c.phone }] : []),
    ...(c.resume?.cgpa != null ? [{ label: "CGPA", value: String(c.resume.cgpa) }] : []),
    ...Object.entries(c.formData).flatMap(([k, v]): { label: string; value: string }[] => {
      if (typeof v !== "string" && typeof v !== "number") return [];
      const value = String(v).trim();
      if (!value || HIDDEN_KEY.test(k) || SHOWN_ELSEWHERE_KEY.test(k.trim()) || isLink(value)) return [];
      return [{ label: k, value }];
    }),
  ].sort((a, b) => detailRank(a.label) - detailRank(b.label)); // stable: equal ranks keep their order

  // One row per round of the drive (skipped and the resume shortlist excluded), joined with this student's result in it.
  const mine = new Map(c.rounds.map((r) => [r.roundId, r]));
  const pipeline = (driveRounds.data ?? []).filter((r) => r.type !== "shortlist" && r.status !== "skipped");
  const rows = (pipeline.length
    ? pipeline.map((r) => ({ roundId: r.id, position: r.position, type: r.type, entry: mine.get(r.id) }))
    : c.rounds.map((r) => ({ roundId: r.roundId, position: r.position, type: r.type, entry: r }))
  ).map((r) => ({ ...r, percent: toPercent(r.type, r.entry?.score ?? null), outcome: r.entry ? outcomeOf(r.entry.status) : null }));
  const cleared = rows.filter((r) => r.outcome === "cleared").length;
  const lost = rows.find((r) => r.outcome === "not_cleared");
  const current = rows.find((r) => r.outcome === "open");
  const shortlisted = c.resume?.shortlisted ?? null;
  const scored = rows.flatMap((r) => (r.percent === null ? [] : [r.percent]));
  const average = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  const ranks = rows.flatMap((r) => (r.entry?.rank != null ? [r.entry.rank] : []));
  const points: RoundPoint[] = rows.map((r) => ({
    id: r.roundId,
    name: roundName(r.type),
    percent: r.percent,
    scoreLabel: r.entry?.score != null ? scoreText(r.type, r.entry.score) : null,
    resultLabel: r.entry ? statusLabel(r.entry.status) : null,
    outcome: r.outcome,
    rank: r.entry?.rank ?? null,
  }));
  const stage = lost ? `Out at ${roundName(lost.type)}` : rows.length && cleared === rows.length ? "Cleared every round" : current ? `In ${roundName(current.type)}` : "Not started";

  return (
    <div className={h.stack}>
      <PageHeader title={c.fullName} description="Student profile and performance across the drive" />

      <section className={h.card} aria-labelledby="details-h">
        <div className={h.cardHead}>
          <h2 id="details-h" className={h.cardTitle}>
            Student details
          </h2>
        </div>
        <dl className={cs.details}>
          {details.map((d) => (
            <div key={d.label} className={cs.detailRow}>
              <dt className={cs.detailLabel}>{d.label}</dt>
              <dd className={cs.detailValue}>{d.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={h.card} aria-labelledby="perf-h">
        <div className={h.cardHead}>
          <div>
            <h2 id="perf-h" className={h.cardTitle}>
              Performance
            </h2>
            <p className={h.xs}>
              {rows.length ? `Cleared ${cleared} of ${rows.length} round${rows.length === 1 ? "" : "s"}` : "Not invited to any round yet."}
              {shortlisted === true ? " · shortlisted from resume" : shortlisted === false ? " · not shortlisted" : ""}
            </p>
          </div>
          {rows.length > 0 && <Badge tone={cleared === rows.length ? "success" : lost ? "danger" : "neutral"}>{`${cleared} / ${rows.length} cleared`}</Badge>}
        </div>

        {rows.length > 0 && (
          <div className={h.stack}>
            <div className={h.grid4}>
              <StatCard label="Rounds cleared" value={`${cleared} / ${rows.length}`} icon={Target} />
              <StatCard label="Average score" value={average === null ? "—" : `${average}%`} icon={Percent} hint={scored.length ? `Across ${scored.length} scored round${scored.length === 1 ? "" : "s"}` : "No scores yet"} />
              <StatCard label="Best rank" value={ranks.length ? `#${Math.min(...ranks)}` : "—"} icon={Award} />
              <StatCard label="Stage" value={<span style={{ fontSize: "1.1rem" }}>{stage}</span>} icon={Flag} />
            </div>

            <div className={h.grid2}>
              <section aria-labelledby="chart-score-h" className={h.stackSm}>
                <h3 id="chart-score-h" className={h.cardTitle}>
                  Score by round
                </h3>
                <ScoreByRoundChart rounds={points} />
              </section>
              <section aria-labelledby="chart-journey-h" className={h.stackSm}>
                <h3 id="chart-journey-h" className={h.cardTitle}>
                  Progress through the drive
                </h3>
                <JourneyBar rounds={points} />
              </section>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Round</Th>
                  <Th>Result</Th>
                  <Th>Score</Th>
                  <Th>Rank</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.roundId}>
                    <Td>
                      {r.position}. {roundName(r.type)}
                    </Td>
                    <Td>{r.entry ? <Badge tone={statusTone(r.entry.status)}>{statusLabel(r.entry.status)}</Badge> : <span className={h.xs}>Not reached</span>}</Td>
                    <Td>{r.entry?.score != null ? scoreText(r.type, r.entry.score) : "—"}</Td>
                    <Td>{r.entry?.rank ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>

      <section className={h.card} aria-label="Resume">
        <div className={h.cardHead}>
          <h2 className={h.cardTitle}>Resume analysis</h2>
          {c.resume && <Badge tone={c.resume.parseStatus === "ok" ? "success" : "warning"}>{c.resume.parseStatus === "ok" ? "Parsed locally" : c.resume.parseStatus === "failed" ? "Parse failed" : c.resume.parseStatus}</Badge>}
        </div>
        {c.resume ? (
          <div className={h.stackSm}>
            <p>
              CGPA <strong>{c.resume.cgpa ?? "not found"}</strong> · JD match <strong>{c.resume.jdMatch === null ? "—" : `${c.resume.jdMatch}%`}</strong> ·{" "}
              {c.resume.shortlisted === null ? "Undecided" : c.resume.shortlisted ? "Shortlisted" : "Not shortlisted"}
            </p>
            {c.resume.skills.length > 0 ? <Chips items={c.resume.skills} /> : <p className={h.xs}>No known skills found in the resume.</p>}
            <div>
              <Button variant="secondary" size="sm" loading={opening} onClick={open}>
                <FileText aria-hidden size={14} style={{ marginRight: 6 }} /> Open resume PDF
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState title="No resume yet" description="Fetch the resumes from the shortlist page." />
        )}
      </section>
    </div>
  );
}
