"use client";

import { Activity, BarChart3, Clock, Gauge, Medal, Target, Trophy, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { listDrives } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { hire as h, StatCard, Tabs } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";
import { outcomeOf, statusLabel, statusTone } from "@/features/hiring/round-outcome";
import { liveApi } from "@/lib/auth";
import { GroupedColumns, HBars, Radar, Scatter, SERIES, StackedColumns, type Series } from "./charts";
import cs from "./analytics.module.scss";
import { loadDriveAnalytics, type DriveAnalytics } from "./load";
import { BANDS, SKILLS, cohortSkills, insights, mean, percentile, rankByIndex, roundScore, roundStats, type RoundMeta, type SkillScores, type Student } from "./scoring";

type Tab = "cohort" | "student" | "method";

const ROUND_NAME: Record<string, string> = { aptitude: "Aptitude", coding: "Coding", ai_interview: "AI interview", technical: "Technical", final: "Final decision" };
const roundName = (r: RoundMeta) => ROUND_NAME[r.type] ?? r.type.replaceAll("_", " ");
const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);
const BAND_COLORS = [30, 50, 75, 100].map((p) => `color-mix(in srgb, var(--ui-color-primary) ${p}%, var(--ui-color-surface))`);
const skillLabel = (k: string) => SKILLS.find((s) => s.key === k)?.label ?? k;
const avgTimeUsed = (s: Student) => mean(s.rounds.map((r) => r.timeUsedPct));
const avgScore = (s: Student) => mean(s.rounds.filter((r) => r.type !== "ai_interview").map((r) => r.percent));

export function AnalyticsScreen() {
  useBreadcrumbs([{ label: "Analytics" }]);
  const drives = useAsync(listDrives, []);
  const [driveId, setDriveId] = useState("");
  const [tab, setTab] = useState<Tab>("cohort");
  const [studentId, setStudentId] = useState("");
  const [compareId, setCompareId] = useState("cohort");
  const data = useAsync(() => (driveId ? loadDriveAnalytics(driveId) : Promise.resolve(null)), [driveId]);

  if (!liveApi) {
    return (
      <div className={h.stack}>
        <PageHeader title="Analytics" description="How students performed in every round, and how each compares with the rest." />
        <EmptyState icon={<BarChart3 aria-hidden size={32} />} title="Analytics needs the live API" description="Turn on NEXT_PUBLIC_LIVE_API and sign in to see real results." />
      </div>
    );
  }

  const pick = (id: string) => {
    setDriveId(id);
    setStudentId("");
    setCompareId("cohort");
  };
  const openStudent = (id: string) => {
    setStudentId(id);
    setCompareId("cohort");
    setTab("student");
  };

  return (
    <div className={h.stack}>
      <PageHeader title="Analytics" description="How students performed in every round, and how each compares with the rest." />

      <section className={h.card} aria-label="Choose a drive">
        <Field label="Campus drive" hint="Pick a drive to analyse all of its rounds.">
          <Select value={driveId} onChange={(e) => pick(e.target.value)} disabled={drives.loading && !drives.data}>
            <option value="" disabled>
              {drives.loading && !drives.data ? "Loading drives…" : "Select a drive"}
            </option>
            {(drives.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.roleTitle} · {d.campus} ({d.company})
              </option>
            ))}
          </Select>
        </Field>
        {drives.error && <ErrorState message={drives.error.message} onRetry={drives.reload} />}
      </section>

      {!driveId ? (
        <EmptyState icon={<BarChart3 aria-hidden size={32} />} title="Select a drive" description="Round-by-round results, skill profiles and student comparisons appear here." />
      ) : data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <RocketLoader label="Crunching the numbers" />
      ) : data.data.students.length === 0 ? (
        <EmptyState icon={<Users aria-hidden size={32} />} title="No students in any round yet" description="Shortlist candidates and start a round, then come back." />
      ) : (
        <>
          <Tabs
            label="Analytics sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "cohort", label: "Cohort overview" },
              { id: "student", label: "Student profile" },
              { id: "method", label: "How scores are calculated" },
            ]}
          />
          {data.data.warnings.length > 0 && <p className={cs.note}>Some data couldn&apos;t be loaded ({data.data.warnings.join(", ")}). Charts show what is available.</p>}
          {tab === "cohort" && <CohortView a={data.data} onOpen={openStudent} />}
          {tab === "student" && <StudentView a={data.data} studentId={studentId} onStudent={setStudentId} compareId={compareId} onCompare={setCompareId} />}
          {tab === "method" && <Methodology />}
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- cohort overview */

function CohortView({ a, onOpen }: { a: DriveAnalytics; onOpen: (id: string) => void }) {
  const { students, rounds } = a;
  const stats = useMemo(() => rounds.map((r) => roundStats(students, r.id)), [rounds, students]);
  const skills = useMemo(() => cohortSkills(students), [students]);
  const indexes = students.flatMap((s) => (s.index === null ? [] : [s.index]));
  const finished = students.filter((s) => s.reached > 0 && s.cleared === rounds.length).length;
  const scoredRounds = rounds.filter((_, i) => stats[i]!.scored > 0);
  const timedRounds = rounds.filter((_, i) => stats[i]!.avgTimeUsedPct !== null);
  const board = [...students].filter((s) => s.index !== null).sort((x, y) => (y.index as number) - (x.index as number)).slice(0, 10);
  const dots = students.flatMap((s) => {
    const x = avgTimeUsed(s);
    const y = avgScore(s);
    return x === null || y === null ? [] : [{ id: s.id, label: `${s.name} (${s.studentId})`, x, y }];
  });

  return (
    <div className={h.stack}>
      <div className={h.grid3}>
        <StatCard label="Students" value={students.length} icon={Users} hint={`${indexes.length} with scores`} />
        <StatCard label="Average performance index" value={indexes.length ? Math.round(mean(indexes) as number) : "—"} icon={Gauge} hint="Mean of each student's weighted skill score, out of 100" />
        <StatCard label="Cleared every round" value={finished} icon={Trophy} hint={students.length ? `${Math.round((finished / students.length) * 100)}% of students` : undefined} />
      </div>

      <div className={h.grid2}>
        <ChartCard title="Round funnel" note="How many students entered each round and how many cleared it.">
          <GroupedColumns
            label="Students entered and cleared per round"
            unit=""
            categories={rounds.map(roundName)}
            series={[
              { name: "Entered", color: SERIES.navy, values: stats.map((s) => s.entered) },
              { name: "Cleared", color: SERIES.subject, values: stats.map((s) => s.cleared) },
            ]}
          />
        </ChartCard>
        <ChartCard title="Average vs best score" note="Percent score per round (AI interview: average rating).">
          {scoredRounds.length ? (
            <GroupedColumns
              label="Average and best score per round"
              categories={scoredRounds.map(roundName)}
              series={[
                { name: "Average", color: SERIES.subject, values: scoredRounds.map((r) => stats[rounds.indexOf(r)]!.avg) },
                { name: "Best", color: SERIES.navy, values: scoredRounds.map((r) => stats[rounds.indexOf(r)]!.best) },
              ]}
            />
          ) : (
            <p className={h.muted}>No scores yet.</p>
          )}
        </ChartCard>
      </div>

      <div className={h.grid2}>
        <ChartCard title="Score distribution" note="Students per score band in each round.">
          {scoredRounds.length ? (
            <StackedColumns
              label="Students per score band by round"
              categories={scoredRounds.map(roundName)}
              stacks={BANDS.map((b, i) => ({ name: b.label, color: BAND_COLORS[i]!, values: scoredRounds.map((r) => stats[rounds.indexOf(r)]!.bands[i]!) }))}
            />
          ) : (
            <p className={h.muted}>No scores yet.</p>
          )}
        </ChartCard>
        <ChartCard title="Time used per round" note="Average share of the allotted time students used.">
          {timedRounds.length ? (
            <GroupedColumns
              label="Average time used per round"
              categories={timedRounds.map(roundName)}
              series={[{ name: "Time used", color: SERIES.teal, values: timedRounds.map((r) => stats[rounds.indexOf(r)]!.avgTimeUsedPct) }]}
            />
          ) : (
            <p className={h.muted}>No timing data yet.</p>
          )}
        </ChartCard>
      </div>

      <div className={h.grid2}>
        <ChartCard title="Cohort skill profile" note="Average skill score across all students (see how they are calculated).">
          <HBars label="Average skill scores" items={SKILLS.map((s) => ({ id: s.key, label: s.label, value: skills[s.key] ?? 0, display: pct(skills[s.key]) }))} />
        </ChartCard>
        <ChartCard title="Accuracy vs speed" note="Each dot is a student. Top-left means accurate and quick. Click a dot to open the student.">
          {dots.length ? <Scatter label="Average score against share of time used, per student" dots={dots} xLabel="Time used (%)" yLabel="Average score (%)" onSelect={onOpen} /> : <p className={h.muted}>No scored test rounds yet.</p>}
        </ChartCard>
      </div>

      <ChartCard title="Top performers" note="Ranked by performance index. Click a student for their full profile.">
        {board.length ? (
          <HBars label="Top students by performance index" items={board.map((s) => ({ id: s.id, label: s.name, sub: s.studentId, value: s.index as number, display: pct(s.index) }))} onSelect={onOpen} />
        ) : (
          <p className={h.muted}>No student has a score yet.</p>
        )}
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className={h.card} aria-label={title}>
      <div className={h.cardHead} style={{ marginBottom: 12 }}>
        <div>
          <h2 className={h.cardTitle}>{title}</h2>
          {note && <p className={h.xs}>{note}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ student profile */

function StudentView({ a, studentId, onStudent, compareId, onCompare }: { a: DriveAnalytics; studentId: string; onStudent: (id: string) => void; compareId: string; onCompare: (id: string) => void }) {
  const { students, rounds } = a;
  const sorted = useMemo(() => [...students].sort((x, y) => x.name.localeCompare(y.name)), [students]);
  const ranks = useMemo(() => rankByIndex(students), [students]);
  const cohort = useMemo(() => cohortSkills(students), [students]);
  const stats = useMemo(() => rounds.map((r) => roundStats(students, r.id)), [rounds, students]);
  const s = students.find((x) => x.id === studentId);
  const other = compareId === "cohort" ? undefined : students.find((x) => x.id === compareId);

  const controls = (
    <section className={`${h.card} ${cs.controls}`} aria-label="Choose students">
      <Field label="Student">
        <Select value={studentId} onChange={(e) => onStudent(e.target.value)}>
          <option value="" disabled>
            Select a student
          </option>
          {sorted.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} ({x.studentId})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Compare with">
        <Select value={compareId} onChange={(e) => onCompare(e.target.value)} disabled={!s}>
          <option value="cohort">Cohort average</option>
          {sorted
            .filter((x) => x.id !== studentId)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.studentId})
              </option>
            ))}
        </Select>
      </Field>
    </section>
  );

  if (!s) {
    return (
      <div className={h.stack}>
        {controls}
        <EmptyState icon={<Users aria-hidden size={32} />} title="Select a student" description="Their rounds, skills and how they compare with the others will appear here." />
      </div>
    );
  }

  // The comparison: the cohort average by default, or one other student.
  const cmpName = other ? other.name : "Cohort average";
  const cmpColor = other ? SERIES.navy : SERIES.muted;
  const cmpSkills: SkillScores = other ? other.skills : cohort;
  const cmpRound = (i: number) => (other ? roundScore(other, rounds[i]!.id) : stats[i]!.avg);
  const cmpTime = (i: number) => (other ? (other.rounds.find((r) => r.roundId === rounds[i]!.id)?.timeUsedPct ?? null) : stats[i]!.avgTimeUsedPct);

  const idx = students.flatMap((x) => (x.index === null ? [] : [x.index]));
  const rank = ranks.get(s.id);
  const ahead = s.index === null ? null : percentile(s.index, idx);
  const delta = s.index !== null && cohort ? s.index - (mean(idx) as number) : null;
  const note = insights(s.skills, cmpSkills);
  const scoreRounds = rounds.filter((r, i) => roundScore(s, r.id) !== null || cmpRound(rounds.indexOf(r)) !== null || stats[i]!.scored > 0);
  const timeRounds = rounds.filter((r) => s.rounds.find((x) => x.roundId === r.id)?.timeUsedPct != null);
  const subject: Series = { name: s.name, color: SERIES.subject, values: SKILLS.map((k) => s.skills[k.key]) };
  const comparison: Series = { name: cmpName, color: cmpColor, values: SKILLS.map((k) => cmpSkills[k.key]) };

  return (
    <div className={h.stack}>
      {controls}

      <div className={h.grid4}>
        <StatCard
          label="Performance index"
          value={s.index === null ? "—" : Math.round(s.index)}
          icon={Gauge}
          hint={delta === null ? "Not scored yet" : `${delta >= 0 ? "+" : ""}${Math.round(delta)} vs cohort average`}
        />
        <StatCard label="Rank in drive" value={rank ? `#${rank}` : "—"} icon={Medal} hint={rank ? `of ${ranks.size} scored students${ahead !== null ? ` · ahead of ${Math.round(ahead)}%` : ""}` : "Not scored yet"} />
        <StatCard label="Rounds cleared" value={`${s.cleared} / ${rounds.length}`} icon={Target} hint={`${s.reached} reached`} />
        <StatCard label="Average time used" value={pct(avgTimeUsed(s))} icon={Clock} hint="Of the allotted time in timed rounds" />
      </div>

      <div className={h.grid2}>
        <ChartCard title="Skill profile" note={`${s.name} compared with ${cmpName.toLowerCase()}.`}>
          <Radar label={`Skill profile of ${s.name}`} axes={SKILLS.map((k) => k.label)} series={[subject, comparison]} />
        </ChartCard>
        <ChartCard title="Score in each round" note="Percent score (AI interview: average rating).">
          {scoreRounds.length ? (
            <GroupedColumns
              label={`Score per round, ${s.name} and ${cmpName}`}
              categories={scoreRounds.map(roundName)}
              series={[
                { name: s.name, color: SERIES.subject, values: scoreRounds.map((r) => roundScore(s, r.id)) },
                { name: cmpName, color: cmpColor, values: scoreRounds.map((r) => cmpRound(rounds.indexOf(r))) },
              ]}
            />
          ) : (
            <p className={h.muted}>No round scores yet.</p>
          )}
        </ChartCard>
      </div>

      <div className={h.grid2}>
        <ChartCard title="Time management" note="Share of the allotted time used in each timed round. Lower means more time to spare.">
          {timeRounds.length ? (
            <GroupedColumns
              label={`Time used per round, ${s.name} and ${cmpName}`}
              categories={timeRounds.map(roundName)}
              series={[
                { name: s.name, color: SERIES.subject, values: timeRounds.map((r) => s.rounds.find((x) => x.roundId === r.id)?.timeUsedPct ?? null) },
                { name: cmpName, color: cmpColor, values: timeRounds.map((r) => cmpTime(rounds.indexOf(r))) },
              ]}
            />
          ) : (
            <p className={h.muted}>No timing data for this student yet.</p>
          )}
        </ChartCard>
        <ChartCard title="Strengths and gaps" note={`Skills at least 8 points above or below ${cmpName.toLowerCase()}.`}>
          <div className={cs.insights}>
            <div>
              <h3 className={h.small} style={{ fontWeight: 600, marginBottom: 8 }}>
                Strengths
              </h3>
              <ul className={cs.insightList}>
                {note.strengths.length ? note.strengths.map((k) => <li key={k}><Badge tone="success">{skillLabel(k)}</Badge> <span className={h.xs}>{Math.round(s.skills[k] as number)} vs {Math.round(cmpSkills[k] as number)}</span></li>) : <li className={h.muted}>None stand out.</li>}
              </ul>
            </div>
            <div>
              <h3 className={h.small} style={{ fontWeight: 600, marginBottom: 8 }}>
                Needs attention
              </h3>
              <ul className={cs.insightList}>
                {note.gaps.length ? note.gaps.map((k) => <li key={k}><Badge tone="danger">{skillLabel(k)}</Badge> <span className={h.xs}>{Math.round(s.skills[k] as number)} vs {Math.round(cmpSkills[k] as number)}</span></li>) : <li className={h.muted}>No clear gaps.</li>}
              </ul>
            </div>
          </div>
        </ChartCard>
      </div>

      <section className={h.card} aria-label="Round by round">
        <div className={h.cardHead}>
          <h2 className={h.cardTitle}>Round by round</h2>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Round</Th>
              <Th>Result</Th>
              <Th>Score</Th>
              <Th>Cohort average</Th>
              <Th>Rank</Th>
              <Th>Time used</Th>
              <Th>Tab switches</Th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r, i) => {
              const e = s.rounds.find((x) => x.roundId === r.id);
              return (
                <tr key={r.id}>
                  <Td>
                    {r.position}. {roundName(r)}
                  </Td>
                  <Td>{e ? <Badge tone={statusTone(e.status)}>{statusLabel(e.status)}</Badge> : <span className={h.xs}>Not reached</span>}</Td>
                  <Td>{pct(roundScore(s, r.id))}</Td>
                  <Td>{pct(stats[i]!.avg)}</Td>
                  <Td>{e?.rank != null ? `#${e.rank}` : "—"}</Td>
                  <Td>{pct(e?.timeUsedPct)}</Td>
                  <Td>{e ? e.tabSwitches : "—"}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        {s.rounds.some((r) => outcomeOf(r.status) === "not_cleared") && (
          <p className={cs.note} style={{ marginTop: 12 }}>
            <Activity aria-hidden size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            Stopped at {roundName(rounds.find((r) => outcomeOf(s.rounds.find((x) => x.roundId === r.id)?.status ?? "") === "not_cleared") as RoundMeta)}.
          </p>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- methodology */

function Methodology() {
  return (
    <section className={h.card} aria-label="How scores are calculated">
      <div className={h.cardHead}>
        <div>
          <h2 className={h.cardTitle}>How scores are calculated</h2>
          <p className={h.xs}>Every skill is scored 0-100 from real round results. The performance index is their weighted average.</p>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className={cs.method}>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Comes from</th>
              <th>How it is worked out</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {SKILLS.map((k) => (
              <tr key={k.key}>
                <td>
                  <strong>{k.label}</strong>
                </td>
                <td>{k.source}</td>
                <td>{k.formula}</td>
                <td>{Math.round(k.weight * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={cs.insightList} style={{ marginTop: 16 }}>
        <li className={cs.note}>The index only uses skills a student has a score for; weights are rescaled, so a missing skill is never counted as zero.</li>
        <li className={cs.note}>Time management ignores rounds scored 0%, so handing in a blank paper early does not look like good pacing.</li>
        <li className={cs.note}>AI interview ratings are advice for HR. Hiring decisions stay with HR.</li>
        <li className={cs.note}>Rank and percentile compare students within this drive only.</li>
      </ul>
    </section>
  );
}
