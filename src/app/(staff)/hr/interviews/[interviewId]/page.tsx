"use client";

import { Bot, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { NotFoundState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Chips, hire as h, Progress, ResultBadge } from "@/components/hire/ui";
import { RealInterviewDetail } from "@/features/interview/real-interviews";
import { supabase } from "@/lib/supabase";
import { candidateById, useStore } from "@/mock/store";

export default function InterviewConsolePage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  return supabase ? <RealInterviewDetail id={interviewId} /> : <MockInterviewConsole />;
}

function MockInterviewConsole() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const iv = state.interviews.find((i) => i.id === interviewId);
  const c = iv && candidateById(state, iv.candidateId);
  useBreadcrumbs([{ label: "Interviews", href: "/hr/interviews" }, { label: c?.name ?? "Interview" }]);
  const [notes, setNotes] = useState(iv?.hrNotes ?? "");
  if (!iv || !c) return <NotFoundState title="Interview not found" />;

  const round = state.rounds.find((r) => r.id === iv.roundId)!;
  const result = state.results.find((r) => r.roundId === round.id && r.candidateId === c.id);
  const s = iv.aiScores;
  const rubric = s ? ([["Communication", s.communication], ["Technical depth", s.technical], ["Problem solving", s.problemSolving], ["Culture fit", s.culture]] as const) : [];

  return (
    <div className={h.stack}>
      <PageHeader
        title={`${c.name} · AI interview`}
        description={`${round.title} · ${iv.slot}`}
        actions={
          round.status === "active" && result ? (
            <>
              <Button size="sm" onClick={() => { dispatch({ type: "setDecision", roundId: round.id, candidateId: c.id, status: "passed" }); toast({ tone: "success", title: "Moved forward" }); }}>
                Move forward
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { dispatch({ type: "setDecision", roundId: round.id, candidateId: c.id, status: "failed" }); toast({ tone: "info", title: "Not advanced" }); }}>
                Reject
              </Button>
            </>
          ) : result ? (
            <ResultBadge status={result.status} />
          ) : undefined
        }
      />

      <div className={h.split}>
        <section className={h.card} aria-labelledby="tr-h">
          <h2 id="tr-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
            Transcript
          </h2>
          <ol className={h.stackSm}>
            {iv.transcript.map((t, i) => (
              <li key={i} className={h.row} style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                <span className={h.avatar} aria-hidden>
                  {t.role === "ai" ? <Bot size={16} /> : <User size={16} />}
                </span>
                <div>
                  <p className={h.xs}>{t.role === "ai" ? "AI interviewer" : c.name}</p>
                  <p>{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className={h.stack}>
          <section className={h.card} aria-labelledby="rub-h">
            <h2 id="rub-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
              AI rubric
            </h2>
            {s ? (
              <>
                <ul className={h.stackSm}>
                  {rubric.map(([label, v]) => (
                    <li key={label}>
                      <div className={h.between} style={{ marginBottom: 6 }}>
                        <span className={h.small}>{label}</span>
                        <strong>{v} / 5</strong>
                      </div>
                      <Progress value={(v / 5) * 100} label={label} />
                    </li>
                  ))}
                </ul>
                <p className={h.small} style={{ marginTop: 16 }}>
                  {s.summary}
                </p>
              </>
            ) : (
              <p className={h.muted}>Scores appear once the interview is complete.</p>
            )}
          </section>

          <section className={h.card} aria-labelledby="cand-h">
            <h2 id="cand-h" className={h.cardTitle} style={{ marginBottom: 12 }}>
              Candidate
            </h2>
            <p className={h.small}>
              {c.branch} · {c.cgpa} CGPA · {c.jdMatch}% JD match
            </p>
            <div style={{ marginTop: 8 }}>
              <Chips items={c.skills} />
            </div>
            <Link className={h.link} href={`/hr/candidates/${c.id}`} style={{ display: "inline-block", marginTop: 12 }}>
              Full evaluation
            </Link>
          </section>

          <section className={h.card}>
            <Field label="HR notes" hint="Considered alongside the AI scores. Visible to HR only.">
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button
              size="sm"
              style={{ marginTop: 12 }}
              onClick={() => {
                dispatch({ type: "setHrNotes", interviewId: iv.id, notes });
                toast({ tone: "success", title: "Notes saved" });
              }}
            >
              Save notes
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
