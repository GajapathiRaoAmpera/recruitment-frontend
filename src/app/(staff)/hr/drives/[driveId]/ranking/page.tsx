"use client";

import { Check, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { hire as h, Person, ResultBadge, StatCard } from "@/components/hire/ui";
import { candidateById, driveRounds, pct, useStore } from "@/mock/store";

export default function RankingPage() {
  const { driveId } = useParams<{ driveId: string }>();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const drive = state.drives.find((d) => d.id === driveId);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: drive?.roleTitle ?? "Drive", href: `/hr/drives/${driveId}` }, { label: "Final ranking" }]);
  if (!drive) return <NotFoundState title="Drive not found" />;

  const rounds = driveRounds(state, drive.id);
  const scoredRounds = rounds.filter((r) => ["aptitude", "coding", "ai_interview", "technical"].includes(r.type) && r.status !== "skipped");
  const final = rounds.find((r) => r.type === "final")!;
  const finalists = state.results.filter((r) => r.roundId === final.id);

  const rows = finalists
    .map((f) => {
      const per = scoredRounds.map((r) => state.results.find((x) => x.roundId === r.id && x.candidateId === f.candidateId));
      const pcts = per.map((x) => (x ? pct(x) : undefined)).filter((x): x is number => x !== undefined);
      return { f, c: candidateById(state, f.candidateId)!, per, composite: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0 };
    })
    .sort((a, b) => b.composite - a.composite);

  const decide = (candidateId: string, status: "selected" | "rejected") => {
    dispatch({ type: "setDecision", roundId: final.id, candidateId, status });
    toast({ tone: status === "selected" ? "success" : "info", title: status === "selected" ? "Marked selected" : "Marked rejected" });
  };

  return (
    <div className={h.stack}>
      <PageHeader title="Final ranking" description={`${drive.roleTitle} · composite = average of round scores`} />
      <div className={h.grid4}>
        <StatCard label="Enrolled" value={state.candidates.filter((c) => c.driveId === drive.id).length} />
        <StatCard label="Finalists" value={finalists.length} />
        <StatCard label="Selected" value={finalists.filter((f) => f.status === "selected").length} />
        <StatCard label="Pending decision" value={finalists.filter((f) => f.status === "invited" || f.status === "in_progress").length} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No finalists yet" description="Candidates appear here once they reach the final round." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Candidate</Th>
              {scoredRounds.map((r) => (
                <Th key={r.id}>{r.title.split("·")[1]?.trim() ?? r.title}</Th>
              ))}
              <Th>Composite</Th>
              <Th>Decision</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ f, c, per, composite }, i) => (
              <tr key={c.id}>
                <Td>{i + 1}</Td>
                <Td>
                  <Link href={`/hr/candidates/${c.id}`}>
                    <Person name={c.name} meta={`${c.branch} · ${c.cgpa} CGPA`} />
                  </Link>
                </Td>
                {per.map((x, j) => (
                  <Td key={j}>{x && pct(x) !== undefined ? `${pct(x)}%` : "—"}</Td>
                ))}
                <Td>
                  <strong>{composite}</strong>
                </Td>
                <Td>
                  <ResultBadge status={f.status} />
                </Td>
                <Td>
                  {final.status === "active" && (
                    <span className={h.row}>
                      <Button size="sm" variant={f.status === "selected" ? "primary" : "secondary"} aria-label={`Select ${c.name}`} onClick={() => decide(c.id, "selected")}>
                        <Check aria-hidden size={14} />
                      </Button>
                      <Button size="sm" variant={f.status === "rejected" ? "danger" : "secondary"} aria-label={`Reject ${c.name}`} onClick={() => decide(c.id, "rejected")}>
                        <X aria-hidden size={14} />
                      </Button>
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
