"use client";

import { FileText } from "lucide-react";
import { useState } from "react";
import { getCandidate, openResume } from "@/api/hiring";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RobotLoader } from "@/components/ui/robot-loader";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Chips, hire as h } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";

export function RealCandidate({ candidateId }: { candidateId: string }) {
  const toast = useToast();
  const { data: c, error, loading, reload } = useAsync(() => getCandidate(candidateId), [candidateId]);
  const [opening, setOpening] = useState(false);
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, ...(c ? [{ label: "Shortlist", href: `/hr/drives/${c.driveId}/candidates` }] : []), { label: c?.fullName ?? "Candidate" }]);

  if (error?.status === 404) return <NotFoundState title="Candidate not found" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (loading || !c) return <RobotLoader label="Loading candidate" />;

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
  const answers = Object.entries(c.formData).filter(([, v]) => typeof v === "string" || typeof v === "number");

  return (
    <div className={h.stack}>
      <PageHeader title={c.fullName} description={`${c.studentId} · ${c.email}${c.phone ? ` · ${c.phone}` : ""}`} />
      <div className={h.split}>
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

        <section className={h.card} aria-label="Rounds">
          <div className={h.cardHead}>
            <h2 className={h.cardTitle}>Rounds</h2>
          </div>
          {c.rounds.length === 0 ? (
            <p className={h.xs}>Not invited to any round yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Round</Th>
                  <Th>Status</Th>
                  <Th>Score</Th>
                  <Th>Rank</Th>
                </tr>
              </thead>
              <tbody>
                {c.rounds.map((r) => (
                  <tr key={r.roundId}>
                    <Td>{r.type.replace("_", " ")}</Td>
                    <Td>
                      <Badge>{r.status}</Badge>
                    </Td>
                    <Td>{r.score ?? "—"}</Td>
                    <Td>{r.rank ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>

      <section className={h.card} aria-label="Form answers">
        <div className={h.cardHead}>
          <h2 className={h.cardTitle}>Google Form answers</h2>
        </div>
        {answers.length === 0 ? (
          <p className={h.xs}>No other answers were imported.</p>
        ) : (
          <Table>
            <tbody>
              {answers.map(([k, v]) => (
                <tr key={k}>
                  <Td>{k}</Td>
                  <Td>{String(v)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
