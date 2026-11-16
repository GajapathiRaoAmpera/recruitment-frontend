"use client";

import { Download, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Range, Select } from "@/components/ui/input";
import { NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Chips, hire as h, Person, ResultBadge, RoundStatusBadge, Segment, StatCard, roundLabel } from "@/components/hire/ui";
import { RoundActions } from "@/components/hire/round-actions";
import { driveRounds, pct, useStore } from "@/mock/store";
import type { Candidate, Round, RoundResult } from "@/mock/types";
import { RealDriveHome } from "@/features/hiring/real-drive-home";
import { liveApi } from "@/lib/auth";

function MockPipeline() {
  const { driveId } = useParams<{ driveId: string }>();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const drive = state.drives.find((d) => d.id === driveId);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive?.roleTitle ?? "Drive" }]);
  const [view, setView] = useState<"board" | "table">("board");
  const [q, setQ] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [hideOut, setHideOut] = useState(true);

  const rounds = drive ? driveRounds(state, drive.id) : [];

  // Each candidate sits in the column of the furthest round they have a result in.
  const pos = new Map(rounds.map((r) => [r.id, r.position]));
  const placed = state.candidates
    .filter((c) => c.driveId === driveId)
    .map((c) => {
      const rs = state.results.filter((r) => r.candidateId === c.id && pos.has(r.roundId));
      const last = rs.sort((a, b) => pos.get(b.roundId)! - pos.get(a.roundId)!)[0];
      return { c, last, round: rounds.find((r) => r.id === last?.roundId) ?? rounds[0]! };
    });

  if (!drive) return <NotFoundState title="Drive not found" />;

  const filtered = placed.filter(
    ({ c, last }) =>
      (!q || `${c.name} ${c.studentId} ${c.skills.join(" ")}`.toLowerCase().includes(q.toLowerCase())) &&
      c.jdMatch >= minMatch &&
      (!hideOut || (last?.status !== "failed" && last?.status !== "rejected")),
  );
  const count = (fn: (r: RoundResult) => boolean, type: Round["type"]) => {
    const r = rounds.find((x) => x.type === type);
    return r ? state.results.filter((x) => x.roundId === r.id && fn(x)).length : 0;
  };
  const shortlist = rounds.find((r) => r.type === "shortlist")!;

  const exportCsv = () => {
    const rows = [["Student ID", "Name", "Branch", "CGPA", "JD match", "Stage", "Status"], ...filtered.map(({ c, last, round }) => [c.studentId, c.name, c.branch, c.cgpa, c.jdMatch, round.title, last?.status ?? "imported"])];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${drive.id}-candidates.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className={h.stack}>
      <PageHeader
        title={drive.roleTitle}
        description={`${drive.campus} · ${drive.window}`}
        actions={
          <>
            <Segment label="View" value={view} onChange={setView} options={[{ id: "board", label: "Board" }, { id: "table", label: "Table" }]} />
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download aria-hidden size={14} style={{ marginRight: 4 }} /> Export CSV
            </Button>
            <Button asChild size="sm">
              <Link href={`/hr/drives/${drive.id}/ranking`}>Final ranking</Link>
            </Button>
          </>
        }
      />

      <div className={h.grid4}>
        <StatCard label="Enrolled" value={placed.length} hint={`${state.candidates.filter((c) => c.driveId === driveId && c.shortlisted).length} shortlisted`} icon={Users} />
        <StatCard label="Aptitude passed" value={count((r) => r.status === "passed", "aptitude")} hint={`${count((r) => r.score !== undefined, "aptitude")} submitted`} />
        <StatCard label="Coding passed" value={count((r) => r.status === "passed", "coding")} hint={`${count((r) => r.score !== undefined, "coding")} submitted`} />
        <StatCard label="Selected" value={count((r) => r.status === "selected", "final")} hint="Final decisions" />
      </div>

      <section className={h.card} aria-labelledby="rounds-h">
        <div className={h.cardHead}>
          <h2 id="rounds-h" className={h.cardTitle}>
            Rounds
          </h2>
          <Button
            size="sm"
            variant="secondary"
            disabled={rounds.some((r) => r.type === "technical")}
            onClick={() => {
              dispatch({ type: "addTechnicalRound", driveId: drive.id, mode: "manual" });
              toast({ tone: "success", title: "Technical round added before the final interview" });
            }}
          >
            <Plus aria-hidden size={14} style={{ marginRight: 4 }} /> Add technical round
          </Button>
        </div>
        <ol className={h.list}>
          {rounds.map((r) => {
            const rs = state.results.filter((x) => x.roundId === r.id);
            return (
              <li key={r.id} className={h.listItem}>
                <div style={{ minWidth: 220 }}>
                  <div className={h.row}>
                    <span style={{ fontWeight: 500 }}>{r.title}</span>
                    <RoundStatusBadge status={r.status} />
                  </div>
                  <p className={h.xs}>
                    {r.type === "shortlist"
                      ? `${state.candidates.filter((c) => c.driveId === driveId && c.shortlisted).length} shortlisted of ${placed.length}`
                      : `${rs.length} in round · ${rs.filter((x) => x.score !== undefined).length} scored · ${rs.filter((x) => x.locked).length} locked`}
                    {r.threshold !== undefined && ` · cut-off ${r.threshold}%`}
                  </p>
                </div>
                <div className={h.row}>
                  {(r.type === "ai_interview" || r.type === "technical" || r.type === "final") && r.status === "pending" && (
                    <Select aria-label={`${r.title} mode`} value={r.mode} onChange={(e) => dispatch({ type: "setRoundMode", roundId: r.id, mode: e.target.value as Round["mode"] })} style={{ width: 120 }}>
                      <option value="ai">AI-led</option>
                      <option value="manual">Manual</option>
                    </Select>
                  )}
                  {r.status !== "pending" && r.status !== "skipped" && (
                    <Link className={h.link} href={r.type === "shortlist" ? `/hr/drives/${drive.id}/candidates` : `/hr/drives/${drive.id}/rounds/${r.id}`}>
                      {r.type === "shortlist" ? "Shortlist" : "Dashboard"}
                    </Link>
                  )}
                  <RoundActions round={r} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={h.toolbar}>
        <Field label="Search">
          <Input placeholder="Name, ID or skill" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field label={`Min JD match: ${minMatch}%`}>
          <Range className={h.range} min={0} max={100} step={5} value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} />
        </Field>
        <label className={h.row} style={{ paddingBottom: 8 }}>
          <input type="checkbox" className={h.check} checked={hideOut} onChange={(e) => setHideOut(e.target.checked)} /> Hide not advanced
        </label>
        <p className={h.xs} style={{ paddingBottom: 10 }}>
          Showing {filtered.length} of {placed.length}
        </p>
      </div>

      {shortlist.status === "active" ? (
        <p className={h.muted}>
          Shortlisting is in progress.{" "}
          <Link href={`/hr/drives/${drive.id}/candidates`} className={h.link}>
            Review resumes and shortlist
          </Link>
        </p>
      ) : view === "board" ? (
        <div className={h.board}>
          {rounds
            .filter((r) => r.status !== "skipped")
            .map((r) => {
              const cards = filtered.filter((x) => x.round.id === r.id);
              return (
                <section key={r.id} className={h.column} aria-label={r.title}>
                  <div className={h.columnHead}>
                    <span>{roundLabel(r)}</span>
                    <Badge>{cards.length}</Badge>
                  </div>
                  {cards.slice(0, 12).map(({ c, last }) => (
                    <CandidateCard key={c.id} c={c} last={last} />
                  ))}
                  {cards.length > 12 && <p className={h.xs}>+{cards.length - 12} more — use Table view</p>}
                </section>
              );
            })}
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Candidate</Th>
              <Th>CGPA</Th>
              <Th>JD match</Th>
              <Th>Stage</Th>
              <Th>Score</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ c, last, round }) => (
              <tr key={c.id}>
                <Td>
                  <Link href={`/hr/candidates/${c.id}`}>
                    <Person name={c.name} meta={`${c.studentId} · ${c.branch}`} />
                  </Link>
                </Td>
                <Td>{c.cgpa}</Td>
                <Td>{c.jdMatch}%</Td>
                <Td>{roundLabel(round)}</Td>
                <Td>{last && pct(last) !== undefined ? `${pct(last)}%` : "—"}</Td>
                <Td>{last ? <ResultBadge status={last.status} locked={last.locked} /> : <Badge>Imported</Badge>}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

function CandidateCard({ c, last }: { c: Candidate; last?: RoundResult }) {
  return (
    <Link href={`/hr/candidates/${c.id}`} className={h.boardCard}>
      <Person name={c.name} meta={c.studentId} />
      <p className={h.xs}>
        {c.cgpa} CGPA · {c.branch}
      </p>
      <div className={h.row}>
        <Badge tone={c.jdMatch >= 75 ? "success" : "neutral"}>{c.jdMatch}% JD match</Badge>
        {last && (last.tabSwitches > 0 || last.locked) ? <Badge tone="danger">{last.tabSwitches} switch{last.tabSwitches === 1 ? "" : "es"}</Badge> : null}
      </div>
      {last && pct(last) !== undefined && (
        <p className={h.small}>
          Score <strong>{pct(last)}%</strong>
        </p>
      )}
      <div className={h.between}>
        <Chips items={c.skills.slice(0, 3)} />
        {last && <ResultBadge status={last.status} locked={last.locked} />}
      </div>
    </Link>
  );
}

export function DrivePipelineScreen() {
  return liveApi ? <RealDriveHome /> : <MockPipeline />;
}
