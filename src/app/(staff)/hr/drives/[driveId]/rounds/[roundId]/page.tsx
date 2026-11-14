"use client";

import { AlertTriangle, CheckCircle2, Clock, Mail, Play, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { hire as h, Person, Progress, ResultBadge, RoundStatusBadge, StatCard, Tabs } from "@/components/hire/ui";
import { RoundActions } from "@/components/hire/round-actions";
import { BuildPaperLink } from "@/features/papers/components/build-paper-link";
import { RealRoundPage } from "@/features/advance/real-round-page";
import { liveApi } from "@/lib/auth";
import { candidateById, pct, rank, roundResults, useStore } from "@/mock/store";

type Tab = "overview" | "ranking" | "alerts" | "questions" | "emails";

export default function RoundPage() {
  const { driveId, roundId } = useParams<{ driveId: string; roundId: string }>();
  return <Suspense>{liveApi ? <RealRoundPage driveId={driveId} roundId={roundId} /> : <RoundDashboard />}</Suspense>;
}

function RoundDashboard() {
  const { driveId, roundId } = useParams<{ driveId: string; roundId: string }>();
  const params = useSearchParams();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const drive = state.drives.find((d) => d.id === driveId);
  const round = state.rounds.find((r) => r.id === roundId);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive?.roleTitle ?? "Drive", href: `/hr/drives/${driveId}` }, { label: round?.title ?? "Round" }]);
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) ?? "overview");
  const [resumeFor, setResumeFor] = useState<string | null>(null);
  const [cutoff, setCutoff] = useState(round?.threshold ?? 60);

  if (!drive || !round) return <NotFoundState title="Round not found" />;

  const results = roundResults(state, round.id);
  const scored = results.filter((r) => r.score !== undefined);
  const ranked = rank(scored);
  const locked = results.filter((r) => r.locked);
  const violations = state.violations.filter((v) => v.roundId === round.id);
  const verif = state.verificationLogs.filter((v) => v.roundId === round.id);
  const steps = ["id_dob", "location", "terms", "fullscreen"] as const;
  const emails = state.emailLogs.filter((e) => e.roundId === round.id);
  const qs = state.questions.filter((q) => round.questionIds?.includes(q.id));
  const avg = scored.length ? Math.round(scored.reduce((n, r) => n + (pct(r) ?? 0), 0) / scored.length) : 0;
  const isInterview = round.type === "ai_interview";

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "ranking", label: `Ranking (${scored.length})` },
    { id: "alerts", label: `Alerts (${locked.length})` },
    ...(qs.length ? [{ id: "questions" as const, label: `Questions (${qs.length})` }] : []),
    { id: "emails", label: `Emails (${emails.length})` },
  ];

  return (
    <div className={h.stack}>
      <PageHeader
        title={round.title}
        description={
          <span className={h.row}>
            <RoundStatusBadge status={round.status} /> {drive.roleTitle} · {round.durationMin ? `${round.durationMin} min` : ""} {round.threshold !== undefined && `· cut-off ${round.threshold}%`}
          </span>
        }
        actions={
          <span className={h.row}>
            <BuildPaperLink round={round} />
            <RoundActions round={round} />
          </span>
        }
      />

      <div className={h.grid4}>
        <StatCard label="In round" value={results.length} icon={Users} hint={`${results.filter((r) => r.status === "invited").length} not started`} />
        <StatCard label="In progress" value={results.filter((r) => r.status === "in_progress" && !r.locked).length} icon={Clock} />
        <StatCard label="Submitted" value={scored.length} icon={CheckCircle2} hint={scored.length ? `Average ${avg}%` : undefined} />
        <StatCard label="Locked" value={locked.length} icon={AlertTriangle} hint={`${violations.length} violations logged`} />
      </div>

      <div>
        <Tabs label="Round sections" tabs={tabs} value={tab} onChange={setTab} />

        {tab === "overview" && (
          <div className={h.grid2}>
            <section className={h.card}>
              <h2 className={h.cardTitle} style={{ marginBottom: 16 }}>
                Entry verification
              </h2>
              <ul className={h.stackSm}>
                {steps.map((s) => {
                  const ok = new Set(verif.filter((v) => v.step === s && v.ok).map((v) => v.candidateId)).size;
                  const label = { id_dob: "Student ID + DOB", location: "Location granted", terms: "Terms accepted", fullscreen: "Entered full screen" }[s];
                  return (
                    <li key={s}>
                      <div className={h.between} style={{ marginBottom: 6 }}>
                        <span className={h.small}>{label}</span>
                        <span className={h.xs}>
                          {ok} / {results.length}
                        </span>
                      </div>
                      <Progress value={results.length ? (ok / results.length) * 100 : 0} label={label} />
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className={h.card}>
              <h2 className={h.cardTitle} style={{ marginBottom: 16 }}>
                Score distribution
              </h2>
              {scored.length === 0 ? (
                <p className={h.muted}>No submissions yet.</p>
              ) : (
                <ul className={h.stackSm}>
                  {[80, 60, 40, 0].map((lo, i, arr) => {
                    const hi = i === 0 ? 101 : arr[i - 1]!;
                    const n = scored.filter((r) => (pct(r) ?? 0) >= lo && (pct(r) ?? 0) < hi).length;
                    return (
                      <li key={lo}>
                        <div className={h.between} style={{ marginBottom: 6 }}>
                          <span className={h.small}>
                            {lo}–{hi === 101 ? 100 : hi - 1}%
                          </span>
                          <span className={h.xs}>{n} candidates</span>
                        </div>
                        <Progress value={(n / scored.length) * 100} label={`${lo}% band`} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === "ranking" && (
          <div className={h.stackSm}>
            {!isInterview && round.status === "active" && (
              <div className={h.toolbar}>
                <label className={h.small} style={{ minWidth: 260 }}>
                  Preview cut-off: <strong>{cutoff}%</strong> → {scored.filter((r) => (pct(r) ?? 0) >= cutoff).length} would pass
                  <input className={h.range} type="range" min={0} max={100} step={5} value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))} />
                </label>
              </div>
            )}
            {ranked.length === 0 ? (
              <EmptyState title="No submissions yet" description="Ranking appears as candidates submit." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Rank</Th>
                    <Th>Candidate</Th>
                    <Th>{isInterview ? "AI score" : "Score"}</Th>
                    {!isInterview && <Th>Time</Th>}
                    {round.type === "coding" && <Th>Test cases</Th>}
                    <Th>Tab switches</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r, i) => {
                    const c = candidateById(state, r.candidateId)!;
                    const below = !isInterview && round.status === "active" && (pct(r) ?? 0) < cutoff;
                    const iv = state.interviews.find((x) => x.roundId === round.id && x.candidateId === c.id);
                    return (
                      <tr key={r.candidateId} style={below ? { opacity: 0.55 } : undefined}>
                        <Td>#{i + 1}</Td>
                        <Td>
                          <Link href={iv ? `/hr/interviews/${iv.id}` : `/hr/candidates/${c.id}`}>
                            <Person name={c.name} meta={c.studentId} />
                          </Link>
                        </Td>
                        <Td>{isInterview ? `${r.score} / 5` : `${r.score} / ${r.maxScore} (${pct(r)}%)`}</Td>
                        {!isInterview && <Td>{r.timeTakenMin} min</Td>}
                        {round.type === "coding" && <Td>{r.passedCases !== undefined ? `${r.passedCases} / ${r.totalCases}` : "—"}</Td>}
                        <Td>{r.tabSwitches ? <Badge tone="warning">{r.tabSwitches}</Badge> : 0}</Td>
                        <Td>
                          <ResultBadge status={r.status} locked={r.locked} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </div>
        )}

        {tab === "alerts" && (
          <div className={h.stackSm}>
            {locked.length === 0 ? (
              <EmptyState icon={<CheckCircle2 aria-hidden size={32} />} title="No locked tests" description="Tests close automatically after 3 tab switches and show up here." />
            ) : (
              locked.map((r) => {
                const c = candidateById(state, r.candidateId)!;
                const vs = violations.filter((v) => v.candidateId === c.id);
                return (
                  <article key={c.id} className={h.card}>
                    <div className={h.cardHead}>
                      <Person name={c.name} meta={`${c.studentId} · locked after ${r.tabSwitches} tab switches`} />
                      <Button size="sm" onClick={() => setResumeFor(c.id)}>
                        <Play aria-hidden size={14} style={{ marginRight: 4 }} /> Allow resume
                      </Button>
                    </div>
                    <ol className={h.list}>
                      {vs.map((v) => (
                        <li key={v.id} className={h.listItem}>
                          <span className={h.mono}>{v.at}</span>
                          <span className={h.small}>{v.kind === "tab_switch" ? "Left the test tab" : "Exited full screen"}</span>
                        </li>
                      ))}
                    </ol>
                    <p className={h.xs} style={{ marginTop: 8 }}>
                      A network drop can look like a tab switch — check with the candidate before deciding.
                    </p>
                  </article>
                );
              })
            )}
            {violations.filter((v) => v.hrAction).length > 0 && (
              <p className={h.xs}>{violations.filter((v) => v.hrAction === "resumed").length} earlier violation(s) were resolved with a resume.</p>
            )}
          </div>
        )}

        {tab === "questions" && (
          <Table>
            <thead>
              <tr>
                <Th>Question</Th>
                <Th>Difficulty</Th>
                <Th>Tags</Th>
                <Th>{round.type === "coding" ? "Test cases" : "Answer key"}</Th>
              </tr>
            </thead>
            <tbody>
              {qs.map((q) => (
                <tr key={q.id}>
                  <Td>
                    <p style={{ fontWeight: 500 }}>{q.title}</p>
                    <p className={h.xs}>{q.body.slice(0, 90)}…</p>
                  </Td>
                  <Td>{q.difficulty}</Td>
                  <Td>{q.tags.join(", ")}</Td>
                  <Td>{q.kind === "coding" ? `${q.samples?.length} sample + ${q.hiddenCount} hidden` : q.options?.[q.answer ?? 0]}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {tab === "emails" &&
          (emails.length === 0 ? (
            <EmptyState icon={<Mail aria-hidden size={32} />} title="No emails sent for this round" description="Use Email invites to send the round link." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>To</Th>
                  <Th>Template</Th>
                  <Th>Sent</Th>
                </tr>
              </thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.id}>
                    <Td>{e.to}</Td>
                    <Td>{e.template}</Td>
                    <Td>{e.at}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}
      </div>

      <ConfirmDialog
        open={resumeFor !== null}
        onOpenChange={(o) => !o && setResumeFor(null)}
        destructive={false}
        title={`Let ${resumeFor ? candidateById(state, resumeFor)?.name : ""} resume?`}
        description="The test reopens with the time they had left and the tab-switch count reset to 0. This is logged."
        confirmLabel="Allow resume"
        onConfirm={() => {
          dispatch({ type: "resumeAttempt", roundId: round.id, candidateId: resumeFor! });
          setResumeFor(null);
          toast({ tone: "success", title: "Resume access granted" });
        }}
      />
    </div>
  );
}
