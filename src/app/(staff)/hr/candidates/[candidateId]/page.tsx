"use client";

import { FileText, Mail, MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Chips, hire as h, ResultBadge, StatCard, Tabs } from "@/components/hire/ui";
import { driveRounds, pct, useStore } from "@/mock/store";

type Tab = "rounds" | "integrity" | "interview";

export default function CandidatePage() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const c = state.candidates.find((x) => x.id === candidateId);
  const drive = state.drives.find((d) => d.id === c?.driveId);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive?.roleTitle ?? "Drive", href: `/hr/drives/${drive?.id}` }, { label: c?.name ?? "Candidate" }]);
  const [tab, setTab] = useState<Tab>("rounds");
  if (!c || !drive) return <NotFoundState title="Candidate not found" />;

  const rounds = driveRounds(state, drive.id);
  const results = rounds.map((r) => ({ r, res: state.results.find((x) => x.roundId === r.id && x.candidateId === c.id) })).filter((x) => x.res);
  const current = [...results].reverse().find((x) => x.r.status === "active");
  const violations = state.violations.filter((v) => v.candidateId === c.id);
  const verif = state.verificationLogs.filter((v) => v.candidateId === c.id);
  const interview = state.interviews.find((i) => i.candidateId === c.id);
  const manual = current && (current.r.mode === "manual" || current.r.type === "final");

  return (
    <div className={h.stack}>
      <PageHeader
        title={c.name}
        description={`${c.studentId} · ${c.branch} · ${drive.campus}`}
        actions={
          manual && current ? (
            <>
              <Button size="sm" onClick={() => { dispatch({ type: "setDecision", roundId: current.r.id, candidateId: c.id, status: current.r.type === "final" ? "selected" : "passed" }); toast({ tone: "success", title: "Decision saved" }); }}>
                {current.r.type === "final" ? "Select" : "Move forward"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { dispatch({ type: "setDecision", roundId: current.r.id, candidateId: c.id, status: current.r.type === "final" ? "rejected" : "failed" }); toast({ tone: "info", title: "Decision saved" }); }}>
                Reject
              </Button>
            </>
          ) : undefined
        }
      />

      <div className={h.split}>
        <section className={h.card} aria-label="Resume">
          <div className={h.cardHead}>
            <h2 className={h.cardTitle}>Resume analysis</h2>
            <Badge tone={c.parseStatus === "ok" ? "success" : "warning"}>{c.parseStatus === "ok" ? "Parsed locally" : "Parse failed"}</Badge>
          </div>
          <div className={h.grid3}>
            <StatCard label="CGPA" value={c.cgpa} />
            <StatCard label="JD match" value={`${c.jdMatch}%`} />
            <StatCard label="Shortlisted" value={c.shortlisted ? "Yes" : c.shortlisted === false ? "No" : "—"} />
          </div>
          <p className={h.eyebrow} style={{ marginTop: 20, marginBottom: 8 }}>
            Extracted skills
          </p>
          <Chips items={c.skills} />
        </section>
        <section className={h.card} aria-label="Contact">
          <ul className={h.stackSm}>
            <li className={h.row}>
              <Mail aria-hidden size={16} /> {c.email}
            </li>
            <li className={h.row}>
              <FileText aria-hidden size={16} /> resume_{c.studentId}.pdf
            </li>
            <li className={h.row}>
              <MapPin aria-hidden size={16} /> {drive.campus}
            </li>
          </ul>
        </section>
      </div>

      <div>
        <Tabs label="Candidate sections" value={tab} onChange={setTab} tabs={[{ id: "rounds", label: "Rounds" }, { id: "integrity", label: `Integrity (${violations.length})` }, { id: "interview", label: "AI interview" }]} />

        {tab === "rounds" && (
          <Table>
            <thead>
              <tr>
                <Th>Round</Th>
                <Th>Score</Th>
                <Th>Time</Th>
                <Th>Details</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {results.map(({ r, res }) => (
                <tr key={r.id}>
                  <Td>
                    <Link className={h.link} href={r.type === "shortlist" ? `/hr/drives/${drive.id}/candidates` : `/hr/drives/${drive.id}/rounds/${r.id}`}>
                      {r.title}
                    </Link>
                  </Td>
                  <Td>{res!.score !== undefined ? `${res!.score} / ${res!.maxScore} (${pct(res!)}%)` : "—"}</Td>
                  <Td>{res!.timeTakenMin ? `${res!.timeTakenMin} min` : "—"}</Td>
                  <Td>{res!.passedCases !== undefined ? `${res!.passedCases}/${res!.totalCases} test cases` : res!.hrNote ?? ""}</Td>
                  <Td>
                    <ResultBadge status={res!.status} locked={res!.locked} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {tab === "integrity" && (
          <div className={h.grid2}>
            <section className={h.card}>
              <h3 className={h.cardTitle} style={{ marginBottom: 12 }}>
                Entry checks
              </h3>
              {verif.length === 0 ? (
                <p className={h.muted}>No round entered yet.</p>
              ) : (
                <ul className={h.list}>
                  {verif.map((v, i) => (
                    <li key={i} className={h.listItem}>
                      <span className={h.small}>{{ id_dob: "Student ID + DOB", location: "Location", terms: "Terms accepted", fullscreen: "Full screen" }[v.step]}</span>
                      <span className={h.row}>
                        <span className={h.mono}>{v.at}</span>
                        <Badge tone={v.ok ? "success" : "danger"}>{v.ok ? "OK" : "Failed"}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={h.card}>
              <h3 className={h.cardTitle} style={{ marginBottom: 12 }}>
                Violations
              </h3>
              {violations.length === 0 ? (
                <p className={h.muted}>No tab switches or full-screen exits.</p>
              ) : (
                <ul className={h.list}>
                  {violations.map((v) => (
                    <li key={v.id} className={h.listItem}>
                      <span className={h.small}>{v.kind === "tab_switch" ? "Left the test tab" : "Exited full screen"}</span>
                      <span className={h.row}>
                        <span className={h.mono}>{v.at}</span>
                        {v.hrAction && <Badge tone="info">{v.hrAction}</Badge>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === "interview" &&
          (interview ? (
            <div className={h.stackSm}>
              <p>
                AI score <strong>{interview.aiScores ? ((interview.aiScores.communication + interview.aiScores.technical + interview.aiScores.problemSolving + interview.aiScores.culture) / 4).toFixed(1) : "—"}</strong> / 5 —{" "}
                <Link className={h.link} href={`/hr/interviews/${interview.id}`}>
                  Open transcript and notes
                </Link>
              </p>
              <p className={h.muted}>{interview.aiScores?.summary}</p>
            </div>
          ) : (
            <EmptyState title="No interview yet" description="The AI interview appears after the candidate completes it." />
          ))}
      </div>
    </div>
  );
}
