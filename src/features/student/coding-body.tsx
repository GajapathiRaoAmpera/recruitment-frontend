"use client";

import { CheckCircle2, Play, Send, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCodeDrafts, runCode, saveCodeDraft, submitCode, type CaseResult, type CodingQuestion, type SavedCode } from "@/api/attempt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RobotLoader } from "@/components/ui/robot-loader";
import { hire as h } from "@/components/hire/ui";
import s from "@/components/student/student.module.scss";

const STATUS: Record<string, string> = {
  passed: "Passed",
  wrong_answer: "Wrong answer",
  compile_error: "Compile error",
  runtime_error: "Runtime error",
  time_limit: "Time limit exceeded",
};

interface Props {
  token: string;
  questions: CodingQuestion[];
  saved: Record<string, number | SavedCode>;
  live: boolean;
  /** A problem got a submission; the shell counts it as answered. */
  onSubmitted: (questionId: string) => void;
}

/** Coding round: problem + sample cases on the left, editor and sample results on the right. */
export function CodingBody({ token, questions, saved, live, onSubmitted }: Props) {
  const [current, setCurrent] = useState(0);
  // Editor text per `${questionId}:${language}`; the language chosen per question.
  const [code, setCode] = useState<Record<string, string>>();
  const [lang, setLang] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"run" | "submit">();
  const [result, setResult] = useState<{ qid: string; run?: CaseResult[]; submit?: { passed: number; total: number }; error?: string }>();
  const [draftState, setDraftState] = useState<"saved" | "saving" | "failed">();

  // Newest text wins: a draft saved after the last submission, else the last submitted code.
  useEffect(() => {
    let stale = false;
    const fromSaved = () => {
      const c: Record<string, string> = {};
      const l: Record<string, string> = {};
      for (const q of questions) {
        const v = saved[q.id];
        if (v && typeof v === "object" && v.language) {
          c[`${q.id}:${v.language}`] = v.code;
          l[q.id] = v.language;
        }
      }
      return { c, l };
    };
    getCodeDrafts(token)
      .catch(() => ({}) as Awaited<ReturnType<typeof getCodeDrafts>>)
      .then((drafts) => {
        if (stale) return;
        const { c, l } = fromSaved();
        for (const [qid, d] of Object.entries(drafts)) {
          if (!d.language) continue;
          c[`${qid}:${d.language}`] = d.code;
          l[qid] = d.language;
        }
        setCode(c);
        setLang(l);
      });
    return () => {
      stale = true;
    };
  }, [token, questions, saved]);

  const q = questions[current];
  const language = q ? (lang[q.id] ?? q.languages[0]?.key ?? "") : "";
  const key = q ? `${q.id}:${language}` : "";
  const text = code?.[key] ?? "";

  // Autosave the open editor 1.5 s after typing stops.
  const dirty = useRef(false);
  useEffect(() => {
    if (!q || !code || !dirty.current || !live) return;
    const id = setTimeout(() => {
      setDraftState("saving");
      saveCodeDraft(token, q.id, text, language).then(
        () => setDraftState("saved"),
        () => setDraftState("failed"),
      );
      dirty.current = false;
    }, 1500);
    return () => clearTimeout(id);
  }, [text, language, q, code, token, live]);

  if (!code) return <RobotLoader label="Loading your code" />;
  if (!q)
    return (
      <section className={h.card}>
        <h1 className={h.cardTitle}>No problems yet</h1>
        <p className={h.muted}>HR hasn&apos;t added problems to this test.</p>
      </section>
    );

  const edit = (value: string) => {
    dirty.current = true;
    setCode((c) => ({ ...c, [key]: value }));
  };

  const go = async (kind: "run" | "submit") => {
    setBusy(kind);
    setResult(undefined);
    try {
      if (kind === "run") setResult({ qid: q.id, run: await runCode(token, q.id, text, language) });
      else {
        const r = await submitCode(token, q.id, text, language);
        setResult({ qid: q.id, submit: r });
        onSubmitted(q.id);
      }
    } catch (e) {
      setResult({ qid: q.id, error: (e as Error).message });
    } finally {
      setBusy(undefined);
    }
  };
  const shown = result?.qid === q.id ? result : undefined;

  return (
    <div className={`${s.examBody} ${s.coding}`}>
      <section className={h.card} aria-labelledby="p-h">
        {questions.length > 1 && (
          <div role="tablist" aria-label="Problems" className={s.problemTabs} style={{ marginBottom: 16 }}>
            {questions.map((x, i) => (
              <button key={x.id} role="tab" type="button" aria-selected={i === current} className={h.segmentBtn} onClick={() => setCurrent(i)}>
                P{i + 1}: {x.title}
              </button>
            ))}
          </div>
        )}
        <Badge>
          {q.marks} mark{q.marks === 1 ? "" : "s"}
        </Badge>
        <h1 id="p-h" className={h.cardTitle} style={{ marginTop: 8 }}>
          {q.title}
        </h1>
        <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{q.statement}</p>
        {q.samples.length > 0 && (
          <>
            <h2 className={h.eyebrow} style={{ marginTop: 24, marginBottom: 8 }}>
              Sample cases
            </h2>
            <div className={h.stackSm}>
              {q.samples.map((c, i) => (
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
          </>
        )}
        <p className={h.xs} style={{ marginTop: 12 }}>
          Run checks the sample cases. Submit also runs hidden cases and is what counts.
        </p>
      </section>

      <section className={h.stackSm} aria-label="Editor" data-allow-clipboard>
        <div className={s.editorWrap}>
          <div className={s.editorBar}>
            <label>
              <span className="sr-only">Language</span>
              <select value={language} disabled={!live} onChange={(e) => setLang((l) => ({ ...l, [q.id]: e.target.value }))}>
                {q.languages.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <span aria-live="polite" style={{ opacity: 0.75 }}>
              {draftState === "saving" ? "Saving draft…" : draftState === "failed" ? "Draft not saved, keep this tab open" : draftState === "saved" ? "Draft saved" : "Drafts save as you type"}
            </span>
          </div>
          <textarea
            className={s.editor}
            aria-label={`Code for ${q.title}`}
            spellCheck={false}
            readOnly={!live}
            value={text}
            onChange={(e) => edit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Tab" || e.shiftKey) return; // Shift+Tab still leaves the editor
              e.preventDefault();
              const t = e.currentTarget;
              const { selectionStart: a, selectionEnd: b } = t;
              edit(`${text.slice(0, a)}    ${text.slice(b)}`);
              requestAnimationFrame(() => t.setSelectionRange(a + 4, a + 4));
            }}
          />
        </div>

        <div className={h.row} style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" loading={busy === "run"} disabled={!live || busy !== undefined || !text.trim()} onClick={() => go("run")}>
            <Play aria-hidden size={14} style={{ marginRight: 4 }} /> Run samples
          </Button>
          <Button loading={busy === "submit"} disabled={!live || busy !== undefined || !text.trim()} onClick={() => go("submit")}>
            <Send aria-hidden size={14} style={{ marginRight: 4 }} /> Submit code
          </Button>
        </div>

        <div className={h.card} aria-live="polite">
          {busy ? (
            <RobotLoader size="inline" label={busy === "run" ? "Running the sample cases" : "Running all test cases"} />
          ) : shown?.error ? (
            <p role="alert" style={{ color: "var(--ui-color-danger)" }}>
              {shown.error}
            </p>
          ) : shown?.run ? (
            <ul className={h.stackSm}>
              {shown.run.map((r) => (
                <li key={r.case} className={h.stackSm}>
                  <div className={h.between}>
                    <span className={h.row}>
                      {r.passed ? <CheckCircle2 aria-hidden size={16} color="var(--ui-color-success)" /> : <XCircle aria-hidden size={16} color="var(--ui-color-danger)" />} Sample {r.case}
                    </span>
                    <span className={h.xs}>
                      {STATUS[r.status] ?? r.status}
                      {r.time !== null ? ` · ${Math.round(r.time * 1000)} ms` : ""}
                    </span>
                  </div>
                  {!r.passed && (r.stderr || r.stdout) && <pre className={h.code}>{r.stderr || `Your output:\n${r.stdout}`}</pre>}
                </li>
              ))}
            </ul>
          ) : shown?.submit ? (
            <div className={h.between}>
              <p>
                <strong className={h.scoreBig}>{shown.submit.passed}</strong> / {shown.submit.total} test cases passed
              </p>
              <Badge tone={shown.submit.passed === shown.submit.total ? "success" : "warning"}>{shown.submit.passed === shown.submit.total ? "All passed" : "Partly passed"}</Badge>
            </div>
          ) : (
            <p className={h.muted}>Run your code against the sample cases, then submit it.</p>
          )}
        </div>
      </section>
    </div>
  );
}
