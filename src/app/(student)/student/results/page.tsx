"use client";

import { PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { hire as h, ResultBadge } from "@/components/hire/ui";
import { useStudent } from "@/components/student/hooks";
import { driveRounds, useStore } from "@/mock/store";

export default function ResultsPage() {
  const { state } = useStore();
  const { candidate, drive } = useStudent();
  if (!candidate || !drive) return null;
  const rounds = driveRounds(state, drive.id);
  const final = rounds.find((r) => r.type === "final");
  const finalRes = state.results.find((r) => r.roundId === final?.id && r.candidateId === candidate.id);
  const history = rounds.map((r) => ({ r, res: state.results.find((x) => x.roundId === r.id && x.candidateId === candidate.id) })).filter((x) => x.res);

  return (
    <div className={h.stack}>
      <PageHeader title="Status & result" description={drive.roleTitle} />
      {finalRes?.status === "selected" ? (
        <section className={h.hero}>
          <div aria-hidden className={h.heroGlow} />
          <div className={h.heroInner}>
            <div>
              <PartyPopper aria-hidden size={28} />
              <h2 className={h.heroTitle}>Congratulations — you&apos;ve been selected!</h2>
              <p className={h.heroText}>HR will email you about next steps. Offer letters are handled outside this portal.</p>
            </div>
          </div>
        </section>
      ) : finalRes?.status === "rejected" ? (
        <section className={h.card}>
          <h2 className={h.cardTitle}>Thank you for taking part</h2>
          <p className={h.muted} style={{ marginTop: 6 }}>
            You weren&apos;t selected this time. We appreciate the effort you put into every round.
          </p>
        </section>
      ) : (
        <section className={h.card}>
          <h2 className={h.cardTitle}>Your application is in progress</h2>
          <p className={h.muted} style={{ marginTop: 6 }}>
            Results are published after HR reviews each round. You&apos;ll get an email at every stage.
          </p>
        </section>
      )}
      <section className={h.card}>
        <h2 className={h.cardTitle} style={{ marginBottom: 12 }}>
          Round history
        </h2>
        <ol className={h.list}>
          {history.map(({ r, res }) => (
            <li key={r.id} className={h.listItem}>
              <span>{r.title}</span>
              <ResultBadge status={res!.status} locked={res!.locked} />
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
