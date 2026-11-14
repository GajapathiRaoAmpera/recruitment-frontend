"use client";

import { Select } from "@/components/ui/input";
import { CheckCircle2, Clock, Play, Send, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, NotFoundState } from "@/components/ui/states";
import { DemoNote, hire as h } from "@/components/hire/ui";
import { ExamGuard } from "@/components/student/exam-guard";
import { exitFullscreen, minutesSince, useCountdown, useExamDraft, useExamRound, useStudent } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { CodeEditor } from "@/features/test-runner/code-editor";
import { failText, LANGS, type Lang } from "@/features/test-runner/coding-shared";
import { useStore } from "@/mock/store";

// Prototype only: a student signed in through the API sits the coding round in RealExamShell
// (/exam/<id>/test) with the real Judge0 runner (features/test-runner/coding-workspace.tsx).
const TOTAL_CASES = 18;

interface CodeDraft {
  current: number;
  lang: Record<string, Lang>;
  code: Record<string, string>; // key: `${questionId}:${lang}`
  passed: Record<string, number>; // best submit result per question
}

// shortcut: simulated Judge0 — "real" effort (code beyond the starter) passes samples; hidden passes vary by a stable hash.
function judge(code: string, starter: string) {
  const effort = code.replace(/\s+/g, "").length - starter.replace(/\s+/g, "").length;
  const hash = [...code].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 9973, 7);
  const samplesOk = effort > 25;
  return { samplesOk, hidden: samplesOk ? 15 - (hash % 5) : Math.min(3, Math.max(0, Math.floor(effort / 10))) };
}

export default function CodingTestPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const router = useRouter();
  const { real } = useStudent();
  const { state, candidate, round } = useExamRound(roundId);
  useEffect(() => {
    if (real) router.replace(`/exam/${roundId}/test`); // real students: the server-driven test screen
  }, [real, roundId, router]);
  if (real) return null;
  if (!round || !candidate || round.type !== "coding") return <NotFoundState title="Coding test not found" />;
  if (!state.questions.some((q) => round.questionIds?.includes(q.id))) return <EmptyState title="No coding questions added for this round yet" />;
  return <Runner roundId={roundId} />;
}

function Runner({ roundId }: { roundId: string }) {
  const router = useRouter();
  const { dispatch } = useStore();
  const { state, candidate, round, result, recorded } = useExamRound(roundId);
  // Only sample cases reach the browser; hidden cases stay on the server (D7).
  const problems = state.questions.filter((q) => round!.questionIds?.includes(q.id)).map(({ id, title, body, samples, difficulty, marks, tags }) => ({ id, title, body, samples: samples!, difficulty, marks, tags }));
  const { draft, update, clear, savedAt } = useExamDraft<CodeDraft>(`${roundId}:${candidate!.id}`, round!.durationMin ?? 60, { current: 0, lang: {}, code: {}, passed: {} });
  const [runOut, setRunOut] = useState<{ case: number; ok: boolean; expected: string; actual: string; ms: number }[] | null>(null);
  const [submitOut, setSubmitOut] = useState<{ passed: number } | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [confirm, setConfirm] = useState(false);

  const p = problems[draft.data.current]!;
  const lang: Lang = draft.data.lang[p.id] ?? (p.tags.includes("sql") ? "sql" : "python");
  const key = `${p.id}:${lang}`;
  const code = draft.data.code[key] ?? LANGS[lang].starter;

  const finish = () => {
    if (recorded) {
      const passed = problems.reduce((n, x) => n + (draft.data.passed[x.id] ?? 0), 0);
      const score = Math.round(problems.reduce((n, x) => n + ((draft.data.passed[x.id] ?? 0) / TOTAL_CASES) * x.marks, 0));
      dispatch({
        type: "submitAttempt", roundId, candidateId: candidate!.id, score, maxScore: problems.reduce((n, x) => n + x.marks, 0),
        timeTakenMin: minutesSince(draft.startedAt), passedCases: passed, totalCases: problems.length * TOTAL_CASES,
      });
    }
    try {
      window.sessionStorage.setItem(`done:${roundId}`, JSON.stringify(problems.map((x) => ({ title: x.title, passed: draft.data.passed[x.id] ?? 0 }))));
    } catch {
      /* summary is optional */
    }
    clear();
    exitFullscreen();
    router.push(`/exam/${roundId}/done`);
  };

  const { left, label } = useCountdown(draft.deadline, finish);

  const run = () => {
    setBusy("run");
    setSubmitOut(null);
    setTimeout(() => {
      const { samplesOk } = judge(code, LANGS[lang].starter);
      setRunOut(p.samples.map((c, i) => ({ case: i + 1, ok: samplesOk, expected: c.expected, actual: samplesOk ? c.expected : "", ms: 2 + i })));
      setBusy(null);
    }, 600);
  };
  const submit = () => {
    setBusy("submit");
    setRunOut(null);
    setTimeout(() => {
      const { samplesOk, hidden } = judge(code, LANGS[lang].starter);
      const passed = (samplesOk ? 3 : 0) + hidden;
      setSubmitOut({ passed });
      update((d) => ({ ...d, passed: { ...d.passed, [p.id]: Math.max(d.passed[p.id] ?? 0, passed) } }));
      setBusy(null);
    }, 900);
  };

  return (
    <>
      <ExamGuard roundId={roundId} candidateId={candidate!.id} result={result} recorded={recorded} />
      <header className={s.examBar}>
        <Logo height={22} />
        <div role="tablist" aria-label="Problems" className={s.problemTabs}>
          {problems.map((x, i) => (
            <button
              key={x.id}
              role="tab"
              type="button"
              aria-selected={i === draft.data.current}
              className={h.segmentBtn}
              onClick={() => {
                update((d) => ({ ...d, current: i }));
                setRunOut(null);
                setSubmitOut(null);
              }}
            >
              P{i + 1}: {x.title} {draft.data.passed[x.id] !== undefined && `· ${draft.data.passed[x.id]}/${TOTAL_CASES}`}
            </button>
          ))}
        </div>
        <span className={s.spacer} style={{ flex: 1 }} />
        <span className={s.saved} aria-live="polite">
          {savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Saving…"}
        </span>
        {!recorded && <Badge tone="warning">Preview</Badge>}
        <span className={s.timer} data-low={left < 5 * 60_000} role="timer" aria-label={`Time left ${label}`}>
          <Clock aria-hidden size={16} /> {label}
        </span>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Finish test
        </Button>
      </header>

      <main className={`${s.examBody} ${s.coding}`}>
        <section className={h.card} aria-labelledby="p-h">
          <div className={h.row} style={{ marginBottom: 8 }}>
            <Badge tone={p.difficulty === "advanced" ? "danger" : p.difficulty === "medium" ? "warning" : "success"}>{p.difficulty}</Badge>
            <Badge>{p.marks} marks</Badge>
          </div>
          <h1 id="p-h" className={h.cardTitle}>
            {p.title}
          </h1>
          <p style={{ marginTop: 12 }}>{p.body}</p>
          <h2 className={h.eyebrow} style={{ marginTop: 24, marginBottom: 8 }}>
            Sample cases
          </h2>
          <div className={h.stackSm}>
            {p.samples.map((c, i) => (
              <div key={i} className={s.caseGrid}>
                <div>
                  <p className={h.xs}>Input {i + 1}</p>
                  <pre className={h.code}>{c.input}</pre>
                </div>
                <div>
                  <p className={h.xs}>Expected output</p>
                  <pre className={h.code}>{c.expected}</pre>
                </div>
              </div>
            ))}
          </div>
          <p className={h.xs} style={{ marginTop: 12 }}>
            Submit runs these 3 plus 15 hidden cases.
          </p>
        </section>

        <section className={h.stackSm} aria-label="Editor" data-allow-select>
          <div className={s.editorWrap}>
            <div className={s.editorBar}>
              <label>
                <span className="sr-only">Language</span>
                <Select className={s.editorSelect} value={lang} onChange={(e) => update((d) => ({ ...d, lang: { ...d.lang, [p.id]: e.target.value as Lang } }))}>
                  {(Object.keys(LANGS) as Lang[]).map((l) => (
                    <option key={l} value={l}>
                      {LANGS[l].label}
                    </option>
                  ))}
                </Select>
              </label>
              <span style={{ opacity: 0.7 }}>Drafts save per language</span>
            </div>
            <CodeEditor path={key} value={code} language={lang} blockClipboard label={`Code for ${p.title}`} onChange={(v) => update((d) => ({ ...d, code: { ...d.code, [key]: v } }))} />
          </div>

          <div className={h.between}>
            <DemoNote>Simulated Judge0 for the prototype.</DemoNote>
            <div className={h.row}>
              <Button variant="secondary" loading={busy === "run"} disabled={busy !== null} onClick={run}>
                <Play aria-hidden size={14} style={{ marginRight: 4 }} /> Run samples
              </Button>
              <Button loading={busy === "submit"} disabled={busy !== null} onClick={submit}>
                <Send aria-hidden size={14} style={{ marginRight: 4 }} /> Submit
              </Button>
            </div>
          </div>

          <div className={h.card} aria-live="polite">
            {!runOut && !submitOut && <p className={h.muted}>Run your code against the sample cases, then submit for the full 18.</p>}
            {runOut && (
              <ul className={h.stackSm}>
                {runOut.map((r) => (
                  <li key={r.case} className={h.between}>
                    <span className={h.row}>
                      {r.ok ? <CheckCircle2 aria-hidden size={16} color="var(--ui-color-success)" /> : <XCircle aria-hidden size={16} color="var(--ui-color-danger)" />} Sample {r.case}
                    </span>
                    <span className={h.xs}>{r.ok ? `Passed · ${r.ms} ms` : failText(r)}</span>
                  </li>
                ))}
              </ul>
            )}
            {submitOut && (
              <div className={h.between}>
                <p>
                  <strong className={h.scoreBig}>{submitOut.passed}</strong> / {TOTAL_CASES} test cases passed
                </p>
                <Badge tone={submitOut.passed === TOTAL_CASES ? "success" : submitOut.passed >= 9 ? "warning" : "danger"}>{submitOut.passed === TOTAL_CASES ? "All passed" : "Partially passed"}</Badge>
              </div>
            )}
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive={false}
        title="Finish the coding test?"
        description={`Your best submission for each problem counts. ${problems.filter((x) => draft.data.passed[x.id] === undefined).length} problem(s) have no submission yet.`}
        confirmLabel="Finish test"
        onConfirm={() => {
          setConfirm(false);
          finish();
        }}
      />
    </>
  );
}
