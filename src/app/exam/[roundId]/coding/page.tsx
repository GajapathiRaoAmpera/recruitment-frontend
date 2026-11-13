"use client";

import { CheckCircle2, Clock, Lock, Play, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { isAttemptClosed, runCode, submitCode, type CaseStatus } from "@/api/attempt";
import { attemptToken } from "@/api/attempt-token";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NotFoundState } from "@/components/ui/states";
import { DemoNote, hire as h } from "@/components/hire/ui";
import { ExamGuard } from "@/components/student/exam-guard";
import { exitFullscreen, minutesSince, useCountdown, useExamDraft, useExamRound } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { useStore } from "@/mock/store";

const LANGS = {
  python: { label: "Python 3", starter: "import sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    # write your solution here\n\nsolve()\n" },
  javascript: { label: "JavaScript (Node)", starter: "const data = require(\"fs\").readFileSync(0, \"utf8\").split(/\\s+/);\n\nfunction solve() {\n  // write your solution here\n}\n\nsolve();\n" },
  c: { label: "C", starter: "#include <stdio.h>\n\nint main(void) {\n    // write your solution here\n    return 0;\n}\n" },
  cpp: { label: "C++17", starter: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution here\n    return 0;\n}\n" },
  java: { label: "Java 17", starter: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        // write your solution here\n    }\n}\n" },
  go: { label: "Go", starter: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t// write your solution here\n\tfmt.Println()\n}\n" },
  sql: { label: "SQL (SQLite)", starter: "-- write your query here\nSELECT\n" },
} as const;
type Lang = keyof typeof LANGS;
const TOTAL_CASES = 18; // mock fallback; the API's `total` wins once a submission returns
const STATUS_LABEL: Record<CaseStatus, string> = {
  passed: "Passed",
  wrong_answer: "Wrong answer",
  compile_error: "Compile error",
  runtime_error: "Runtime error",
  time_limit: "Time limit exceeded",
};

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
  const { candidate, round } = useExamRound(roundId);
  if (!round || !candidate || round.type !== "coding") return <NotFoundState title="Coding test not found" />;
  return <Runner roundId={roundId} />;
}

function Runner({ roundId }: { roundId: string }) {
  const router = useRouter();
  const { dispatch } = useStore();
  const { state, candidate, round, result, recorded } = useExamRound(roundId);
  // Only sample cases reach the browser; hidden cases stay on the server (D7).
  const problems = state.questions.filter((q) => round!.questionIds?.includes(q.id)).map(({ id, title, body, samples, difficulty, marks, tags }) => ({ id, title, body, samples: samples!, difficulty, marks, tags }));
  const { draft, update, clear, savedAt } = useExamDraft<CodeDraft>(`${roundId}:${candidate!.id}`, round!.durationMin ?? 60, { current: 0, lang: {}, code: {}, passed: {} });
  const [runOut, setRunOut] = useState<{ case: number; ok: boolean; expected: string; actual: string; ms: number | null; status?: CaseStatus; detail?: string }[] | null>(null);
  const [submitOut, setSubmitOut] = useState<{ passed: number; total: number } | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [confirm, setConfirm] = useState(false);
  // Attempt token from /entry/start: present → real Judge0 via the API; absent → prototype simulation.
  const [token] = useState(() => attemptToken(roundId));
  const [callError, setCallError] = useState<string | null>(null);
  const [locked, setLocked] = useState<"locked" | "expired" | null>(null); // the API said 409 ATTEMPT_LOCKED / ATTEMPT_EXPIRED
  const [totals, setTotals] = useState<Record<string, number>>({}); // API `total` per question

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

  const failed = (e: unknown) => {
    if (isAttemptClosed(e)) setLocked(e.code === "ATTEMPT_EXPIRED" ? "expired" : "locked");
    else setCallError((e as Error).message);
  };

  const run = async () => {
    setBusy("run");
    setSubmitOut(null);
    setCallError(null);
    if (token) {
      try {
        const results = await runCode(token, { questionId: p.id, code, language: lang });
        setRunOut(results.map((r) => ({ case: r.case, ok: r.passed, expected: p.samples[r.case - 1]?.expected ?? "", actual: r.stdout, ms: r.timeS === null ? null : Math.round(r.timeS * 1000), status: r.status, detail: r.stderr })));
      } catch (e) {
        setRunOut(null);
        failed(e);
      } finally {
        setBusy(null);
      }
      return;
    }
    setTimeout(() => {
      const { samplesOk } = judge(code, LANGS[lang].starter);
      setRunOut(p.samples.map((c, i) => ({ case: i + 1, ok: samplesOk, expected: c.expected, actual: samplesOk ? c.expected : "", ms: 2 + i })));
      setBusy(null);
    }, 600);
  };
  const submit = async () => {
    setBusy("submit");
    setRunOut(null);
    setCallError(null);
    if (token) {
      try {
        const { passed, total } = await submitCode(token, { questionId: p.id, code, language: lang });
        setSubmitOut({ passed, total });
        setTotals((t) => ({ ...t, [p.id]: total }));
        update((d) => ({ ...d, passed: { ...d.passed, [p.id]: Math.max(d.passed[p.id] ?? 0, passed) } }));
      } catch (e) {
        setSubmitOut(null);
        failed(e);
      } finally {
        setBusy(null);
      }
      return;
    }
    setTimeout(() => {
      const { samplesOk, hidden } = judge(code, LANGS[lang].starter);
      const passed = (samplesOk ? 3 : 0) + hidden;
      setSubmitOut({ passed, total: TOTAL_CASES });
      update((d) => ({ ...d, passed: { ...d.passed, [p.id]: Math.max(d.passed[p.id] ?? 0, passed) } }));
      setBusy(null);
    }, 900);
  };

  return (
    <>
      {locked ? <AttemptClosed kind={locked} /> : <ExamGuard roundId={roundId} candidateId={candidate!.id} result={result} recorded={recorded} />}
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
                setCallError(null);
              }}
            >
              P{i + 1}: {x.title} {draft.data.passed[x.id] !== undefined && `· ${draft.data.passed[x.id]}/${totals[x.id] ?? TOTAL_CASES}`}
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
            {token ? "Submit runs these plus the hidden cases." : "Submit runs these 3 plus 15 hidden cases."}
          </p>
        </section>

        <section className={h.stackSm} aria-label="Editor" data-allow-clipboard>
          <div className={s.editorWrap}>
            <div className={s.editorBar}>
              <label>
                <span className="sr-only">Language</span>
                <select value={lang} onChange={(e) => update((d) => ({ ...d, lang: { ...d.lang, [p.id]: e.target.value as Lang } }))}>
                  {(Object.keys(LANGS) as Lang[]).map((l) => (
                    <option key={l} value={l}>
                      {LANGS[l].label}
                    </option>
                  ))}
                </select>
              </label>
              <span style={{ opacity: 0.7 }}>Drafts save per language</span>
            </div>
            <textarea
              className={s.editor}
              aria-label={`Code for ${p.title}`}
              spellCheck={false}
              value={code}
              onChange={(e) => update((d) => ({ ...d, code: { ...d.code, [key]: e.target.value } }))}
              onKeyDown={(e) => {
                if (e.key !== "Tab") return;
                e.preventDefault();
                const t = e.currentTarget;
                const { selectionStart: a, selectionEnd: b } = t;
                const next = `${code.slice(0, a)}    ${code.slice(b)}`;
                update((d) => ({ ...d, code: { ...d.code, [key]: next } }));
                requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4));
              }}
            />
          </div>

          <div className={h.between}>
            {token ? <span /> : <DemoNote>Simulated Judge0 for the prototype.</DemoNote>}
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
            {callError && (
              <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
                {callError}
              </p>
            )}
            {!runOut && !submitOut && !callError && <p className={h.muted}>{token ? "Run your code against the sample cases, then submit to run the hidden cases too." : "Run your code against the sample cases, then submit for the full 18."}</p>}
            {runOut && (
              <ul className={h.stackSm}>
                {runOut.map((r) => (
                  <li key={r.case} className={h.between}>
                    <span className={h.row}>
                      {r.ok ? <CheckCircle2 aria-hidden size={16} color="var(--ui-color-success)" /> : <XCircle aria-hidden size={16} color="var(--ui-color-danger)" />} Sample {r.case}
                    </span>
                    <span className={h.xs}>{r.ok ? `Passed${r.ms === null ? "" : ` · ${r.ms} ms`}` : failText(r)}</span>
                  </li>
                ))}
              </ul>
            )}
            {submitOut && (
              <div className={h.between}>
                <p>
                  <strong className={h.scoreBig}>{submitOut.passed}</strong> / {submitOut.total} test cases passed
                </p>
                <Badge tone={submitOut.passed === submitOut.total ? "success" : submitOut.passed >= submitOut.total / 2 ? "warning" : "danger"}>{submitOut.passed === submitOut.total ? "All passed" : "Partially passed"}</Badge>
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

function failText(r: { expected: string; status?: CaseStatus; detail?: string }) {
  if (!r.status || r.status === "wrong_answer") return `Wrong answer — expected ${r.expected.split("\n")[0]}`;
  const first = r.detail?.split("\n").find((l) => l.trim());
  return first ? `${STATUS_LABEL[r.status]} — ${first}` : STATUS_LABEL[r.status];
}

/** Same lock screen as ExamGuard, shown when the API refuses Run/Submit because the attempt is closed. */
function AttemptClosed({ kind }: { kind: "locked" | "expired" }) {
  return (
    <div className={s.overlay} role="alertdialog" aria-labelledby="closed-h" aria-describedby="closed-d">
      <div className={s.overlayCard}>
        <Lock aria-hidden size={32} />
        <h1 id="closed-h" className={h.cardTitle}>
          {kind === "expired" ? "Time is up" : "Your test is paused"}
        </h1>
        <p id="closed-d" className={h.muted}>
          {kind === "expired"
            ? "The time for this test has ended. Your submissions so far are saved."
            : "This test is closed for answers. Your submissions so far are saved. If you didn't finish, HR can let you resume with the time you had left."}
        </p>
        <Button asChild variant="secondary" onClick={exitFullscreen}>
          <Link href="/student">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
