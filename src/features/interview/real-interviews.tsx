"use client";

import { Bot, RefreshCw, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import { evaluateInterview, getInterview, interviewFrame, isScored, listInterviews, saveInterviewNotes, type InterviewRow } from "@/api/interviews";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState, NotFoundState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { Chips, hire as h, Person, Progress } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";

const REFRESH_MS = 5000;
const STATUS: Record<InterviewRow["status"], { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  scheduled: { label: "Signed in", tone: "neutral" },
  live: { label: "Live", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Closed", tone: "danger" },
};

/** Quiet reload every few seconds while the tab is visible (live interviews keep changing). */
function useAutoReload(reload: () => void, on: boolean) {
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => document.visibilityState === "visible" && reload(), REFRESH_MS);
    return () => clearInterval(id);
  }, [on, reload]);
}

/** Latest camera still for a live interview; refreshed every 3 s, nothing kept. */
function LiveStill({ id, name }: { id: string; name: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let current: string | undefined;
    let stale = false;
    const load = () =>
      interviewFrame(id).then(
        (b) => {
          if (stale) return;
          if (current) URL.revokeObjectURL(current);
          current = URL.createObjectURL(b);
          setUrl(current);
        },
        () => !stale && setUrl(undefined), // 404 NO_FRAME: camera paused or interview ended
      );
    void load();
    const t = setInterval(load, 3000);
    return () => {
      stale = true;
      clearInterval(t);
      if (current) URL.revokeObjectURL(current);
    };
  }, [id]);
  // eslint-disable-next-line @next/next/no-img-element -- blob URL, next/image can't optimise it
  return url ? <img src={url} alt={`Live camera of ${name}`} style={{ width: 160, borderRadius: 8, display: "block" }} /> : <span className={h.muted}>No camera image</span>;
}

const score = (r: InterviewRow) => (r.scoring === "done" && r.average !== null ? `${r.average.toFixed(1)} / 5` : r.scoring === "pending" ? "Scoring…" : r.scoring === "error" ? "Failed" : "—");

export function RealInterviews() {
  useBreadcrumbs([{ label: "Interviews" }]);
  const { data, error, reload } = useAsync(() => listInterviews(), []);
  useAutoReload(reload, true);
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <RocketLoader label="Loading interviews" />;
  const live = data.filter((r) => r.status === "live");
  return (
    <div className={h.stack}>
      <PageHeader title="AI interviews" description="Watch live interviews, then read each transcript and the AI's scores. The scores are advice; the decision is yours." />
      {live.length > 0 && (
        <section className={h.card} aria-labelledby="live-h">
          <h2 id="live-h" className={h.cardTitle} style={{ marginBottom: 12 }}>
            Live now ({live.length})
          </h2>
          <div className={h.row} style={{ flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            {live.map((r) => (
              <Link key={r.id} href={`/hr/interviews/${r.id}`} className={h.stackSm}>
                <LiveStill id={r.id} name={r.fullName} />
                <Person name={r.fullName} meta={r.studentId} />
              </Link>
            ))}
          </div>
        </section>
      )}
      {data.length === 0 ? (
        <EmptyState title="No interviews yet" description="Students appear here once they sign in to the AI interview." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Candidate</Th>
              <Th>Role</Th>
              <Th>Turns</Th>
              <Th>AI score</Th>
              <Th>HR notes</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <Td>
                  <Link href={`/hr/interviews/${r.id}`}>
                    <Person name={r.fullName} meta={r.studentId} />
                  </Link>
                </Td>
                <Td>{r.roleTitle}</Td>
                <Td>{r.turns}</Td>
                <Td>{score(r)}</Td>
                <Td>{r.hasNotes ? "Added" : <span className={h.muted}>None</span>}</Td>
                <Td>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

export function RealInterviewDetail({ id }: { id: string }) {
  const toast = useToast();
  const { data: iv, error, reload } = useAsync(() => getInterview(id), [id]);
  const [notes, setNotes] = useState<string>();
  const [busy, setBusy] = useState<"notes" | "score">();
  useBreadcrumbs([{ label: "Interviews", href: "/hr/interviews" }, { label: iv?.fullName ?? "Interview" }]);
  useAutoReload(reload, iv?.status === "live" || iv?.scoring === "pending");

  if (error?.status === 404) return <NotFoundState title="Interview not found" />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!iv) return <RocketLoader label="Loading interview" />;

  const run = async (kind: "notes" | "score") => {
    setBusy(kind);
    try {
      if (kind === "notes") await saveInterviewNotes(id, notes ?? iv.hrNotes ?? "");
      else await evaluateInterview(id);
      toast({ tone: "success", title: kind === "notes" ? "Notes saved" : "Scoring started" });
      reload();
    } catch (e) {
      toast({ tone: "danger", title: e instanceof ApiError ? e.message : "Couldn't reach the server. Try again." });
    } finally {
      setBusy(undefined);
    }
  };

  const s = iv.aiScores;
  const rubric = isScored(s)
    ? ([["Communication", s.communication], ["Technical depth", s.technicalDepth], ["Problem solving", s.problemSolving], ["Culture fit", s.culture]] as const)
    : [];
  return (
    <div className={h.stack}>
      <PageHeader
        title={`${iv.fullName} · AI interview`}
        description={`${iv.roleTitle} · ${iv.company} · ${iv.studentId}`}
        actions={<Badge tone={STATUS[iv.status].tone}>{STATUS[iv.status].label}</Badge>}
      />
      <div className={h.split}>
        <section className={h.card} aria-labelledby="tr-h">
          <h2 id="tr-h" className={h.cardTitle} style={{ marginBottom: 16 }}>
            Transcript {iv.status === "live" && <span className={h.muted}>(updating live)</span>}
          </h2>
          {iv.transcript.length === 0 ? (
            <p className={h.muted}>Nothing said yet.</p>
          ) : (
            <ol className={h.stackSm}>
              {iv.transcript.map((t, i) => (
                <li key={i} className={h.row} style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <span className={h.avatar} aria-hidden>
                    {t.role === "ai" ? <Bot size={16} /> : <User size={16} />}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className={h.xs}>
                      {t.role === "ai" ? "AI interviewer" : iv.fullName}
                      {t.kind === "typed" ? ` · typed answer${t.language ? ` (${t.language})` : ""}` : t.kind === "question" ? " · written question" : ""}
                    </p>
                    {t.kind === "typed" ? <pre className={h.code}>{t.text}</pre> : <p>{t.text}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className={h.stack}>
          {iv.status === "live" && (
            <section className={h.card} aria-labelledby="cam-h">
              <h2 id="cam-h" className={h.cardTitle} style={{ marginBottom: 12 }}>
                Live camera
              </h2>
              <LiveStill id={iv.id} name={iv.fullName} />
            </section>
          )}
          <section className={h.card} aria-labelledby="rub-h">
            <div className={h.between} style={{ marginBottom: 16 }}>
              <h2 id="rub-h" className={h.cardTitle}>
                AI scores
              </h2>
              {iv.turns > 0 && iv.status !== "live" && (
                <Button size="sm" variant="secondary" onClick={() => void run("score")} loading={busy === "score"} disabled={iv.scoring === "pending"}>
                  <RefreshCw aria-hidden size={14} style={{ marginRight: 4 }} /> Re-run scoring
                </Button>
              )}
            </div>
            {isScored(s) ? (
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
                  <strong>Sentiment:</strong> {s.sentiment.overall} ({s.sentiment.confidence} confidence). {s.sentiment.note}
                </p>
                <p className={h.small} style={{ marginTop: 8 }}>
                  {s.summary}
                </p>
              </>
            ) : (
              <p className={h.muted}>
                {iv.scoring === "pending" ? "Scoring in progress…" : iv.scoring === "error" ? "Scoring failed. Re-run it." : "Scores appear once the interview is complete."}
              </p>
            )}
          </section>

          {iv.skills.length > 0 && (
            <section className={h.card} aria-labelledby="cand-h">
              <h2 id="cand-h" className={h.cardTitle} style={{ marginBottom: 12 }}>
                Resume skills
              </h2>
              <Chips items={iv.skills} />
              <Link className={h.link} href={`/hr/candidates/${iv.candidateId}`} style={{ display: "inline-block", marginTop: 12 }}>
                Full evaluation
              </Link>
            </section>
          )}

          <section className={h.card}>
            <Field label="HR notes" hint="Considered alongside the AI scores. Visible to HR only.">
              <Textarea rows={4} maxLength={5000} value={notes ?? iv.hrNotes ?? ""} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button size="sm" style={{ marginTop: 12 }} onClick={() => void run("notes")} loading={busy === "notes"} disabled={notes === undefined}>
              Save notes
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
