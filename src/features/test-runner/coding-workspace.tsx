"use client";

import { CheckCircle2, Play, Send, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  attemptIdOf,
  codingErrorMessage,
  getCodeDrafts,
  isAttemptClosed,
  runCode,
  saveCodeDraft,
  submitCode,
  type AttemptState,
  type CaseStatus,
  type ServerDraft,
} from "@/api/attempt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingLabel } from "@/components/ui/skeleton";
import { hire as h } from "@/components/hire/ui";
import s from "@/components/student/student.module.scss";
import { CodeEditor } from "./code-editor";
import { failText, signatureText, sqlRows, starterOf } from "./coding-shared";
import { clearAttemptDrafts, pickRestore, readLocal, writeLocal, type Restored } from "./drafts";
import { SqlDataTable, SqlRowsTable } from "./sql-tables";

export const LOCAL_SAVE_MS = 500;
export const SERVER_SAVE_MS = 10_000;

interface Props {
  token: string;
  /** GET /attempt for THIS round's attempt. Questions, languages, samples and submitted code come only from here. */
  attempt: AttemptState;
  /** False once the attempt is submitted, locked or expired: editing, Run, Submit and autosave stop. */
  live: boolean;
  /** True after the final submit succeeded: this attempt's browser drafts are deleted. */
  submitted: boolean;
  /** The API refused a call because the attempt is closed (409 ATTEMPT_LOCKED / ATTEMPT_EXPIRED). */
  onClosed: (kind: "locked" | "expired") => void;
}

type RunRow = {
  case: number;
  ok: boolean;
  status: CaseStatus;
  expected: string;
  stdout: string;
  stderr: string;
  ms: number | null;
  /** SQL only: the sample's expected rows as the API split them. */
  expectedRows?: string[][];
};

/** The SQL editor's only language: the API lists just this key for a SQL question. */
const SQL = "sql";

/** Round 2 coding screen for a student signed in through the API. Hidden test cases never reach the browser (D7). */
export function CodingWorkspace({ token, attempt, live, submitted, onClosed }: Props) {
  const questions = attempt.coding;
  const [attemptId] = useState(() => attemptIdOf(token));
  // Server clock = browser clock + offset, worked out once from GET /attempt; drafts are stamped with it.
  const [offset] = useState(() => Date.parse(attempt.serverNow) - Date.now());
  const [docs, setDocs] = useState<Record<string, Restored> | null>(null);
  const [loadNote, setLoadNote] = useState<string>();
  const [current, setCurrent] = useState(0);
  const [runOut, setRunOut] = useState<RunRow[] | null>(null);
  const [submitOut, setSubmitOut] = useState<{ passed: number; total: number } | null>(null);
  const [best, setBest] = useState<Record<string, { passed: number; total: number }>>({});
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [serverSaveFailed, setServerSaveFailed] = useState(false);

  // Restore each question once: newest of this browser's draft, the server draft, or the last submitted code.
  useEffect(() => {
    let stale = false;
    getCodeDrafts(token)
      .catch((): Record<string, ServerDraft> => {
        if (!stale) setLoadNote("Couldn't load your drafts from the server; showing what this browser saved.");
        return {};
      })
      .then((server) => {
        if (stale) return;
        const out: Record<string, Restored> = {};
        for (const q of questions) {
          const allowed = q.mode === "sql" ? [SQL] : q.languages.map((l) => l.key);
          const r = pickRestore(allowed, attemptId ? readLocal(attemptId, q.id) : null, server[q.id], attempt.savedCode[q.id]);
          // Function mode: a blank saved draft counts as new, so it opens with the API's starter code.
          out[q.id] = q.mode === "function" ? { ...r, code: Object.fromEntries(Object.entries(r.code).filter(([, c]) => c.trim())) } : r;
        }
        setDocs(out);
      });
    return () => {
      stale = true;
    };
  }, [token, questions, attemptId, attempt.savedCode]);

  // Latest values for the timers below, which outlive a single render.
  const docsRef = useRef(docs);
  const liveRef = useRef(live);
  useEffect(() => {
    docsRef.current = docs;
    liveRef.current = live;
  });

  const pendingLocal = useRef(new Set<string>()); // questions changed since the last localStorage write
  const pendingServer = useRef(new Set<string>()); // questions changed since the last PUT /attempt/code-drafts
  const localTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const codeOf = (questionId: string, d: Restored) => {
    const q = questions.find((x) => x.id === questionId);
    return d.code[d.language] ?? (q ? starterOf(q, d.language) : "");
  };

  const flushServer = async (only?: string) => {
    const ids = only ? [only].filter((id) => pendingServer.current.has(id)) : [...pendingServer.current];
    for (const id of ids) {
      const d = docsRef.current?.[id];
      if (!d || !liveRef.current) return;
      pendingServer.current.delete(id);
      try {
        await saveCodeDraft(token, id, { code: codeOf(id, d), language: d.language });
        setServerSaveFailed(false);
      } catch (e) {
        pendingServer.current.add(id); // retried on the next tick
        if (isAttemptClosed(e)) {
          onClosed(e.code === "ATTEMPT_EXPIRED" ? "expired" : "locked");
          return;
        }
        setServerSaveFailed(true);
      }
    }
  };
  const flushRef = useRef(flushServer);
  useEffect(() => {
    flushRef.current = flushServer;
  });

  // Server autosave every 10 s while the attempt is open.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => void flushRef.current(), SERVER_SAVE_MS);
    return () => clearInterval(id);
  }, [live]);

  // Browser autosave, 500 ms after the last change.
  useEffect(() => {
    if (!docs || pendingLocal.current.size === 0 || !attemptId) return;
    clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => {
      if (!liveRef.current) return;
      const at = Date.now() + offset;
      for (const id of pendingLocal.current) {
        const d = docsRef.current?.[id];
        if (d) writeLocal(attemptId, id, { language: d.language, code: d.code, savedAt: at });
      }
      pendingLocal.current.clear();
      setSavedAt(new Date());
    }, LOCAL_SAVE_MS);
    return () => clearTimeout(localTimer.current);
  }, [docs, attemptId, offset]);

  // After the final submit this attempt's drafts are gone for good (another round has its own attempt id).
  useEffect(() => {
    if (!submitted) return;
    clearTimeout(localTimer.current);
    pendingLocal.current.clear();
    pendingServer.current.clear();
    if (attemptId) clearAttemptDrafts(attemptId);
  }, [submitted, attemptId]);

  if (questions.length === 0)
    return (
      <main className={s.examBody} style={{ maxWidth: "48rem", marginInline: "auto", width: "100%" }}>
        <section className={h.card}>
          <h1 className={h.cardTitle}>No problems yet</h1>
          <p className={h.muted}>HR hasn&apos;t added coding problems to this test.</p>
        </section>
      </main>
    );
  if (!docs) return <LoadingLabel label="Loading your code" />;

  const p = questions[Math.min(current, questions.length - 1)]!;
  const doc = docs[p.id]!;
  const code = codeOf(p.id, doc);
  const isFunction = p.mode === "function";
  const isSql = p.mode === "sql";
  const noStarter = isFunction && !p.starterCode?.[doc.language];

  const change = (next: Restored) => {
    setDocs((d) => (d ? { ...d, [p.id]: next } : d));
    pendingLocal.current.add(p.id);
    pendingServer.current.add(p.id);
  };

  const switchTo = (i: number) => {
    if (i === current) return;
    void flushServer(p.id); // the problem being left is saved on the server right away
    setCurrent(i);
    setRunOut(null);
    setSubmitOut(null);
    setCallError(null);
  };

  const failed = (e: unknown) => {
    if (isAttemptClosed(e)) onClosed(e.code === "ATTEMPT_EXPIRED" ? "expired" : "locked");
    else setCallError(codingErrorMessage(e));
  };

  const run = async () => {
    setBusy("run");
    setSubmitOut(null);
    setRunOut(null);
    setCallError(null);
    try {
      const results = await runCode(token, { questionId: p.id, code, language: doc.language });
      setRunOut(
        results.map((r) => ({
          case: r.case,
          ok: r.passed,
          status: r.status,
          expected: p.samples[r.case - 1]?.expected ?? "",
          ...(isSql ? { expectedRows: p.samples[r.case - 1]?.expectedRows ?? sqlRows(p.samples[r.case - 1]?.expected ?? "") } : {}),
          stdout: r.stdout,
          stderr: r.stderr,
          ms: r.timeS === null ? null : Math.round(r.timeS * 1000),
        })),
      );
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setBusy("submit");
    setRunOut(null);
    setSubmitOut(null);
    setCallError(null);
    try {
      const r = await submitCode(token, { questionId: p.id, code, language: doc.language });
      setSubmitOut(r);
      setBest((b) => ({ ...b, [p.id]: r })); // the latest submit is what counts
    } catch (e) {
      failed(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className={`${s.examBody} ${s.coding}`}>
      <section className={h.card} aria-labelledby="p-h">
        <div role="tablist" aria-label="Problems" className={s.problemTabs} style={{ marginBottom: 16 }}>
          {questions.map((x, i) => (
            <button key={x.id} role="tab" type="button" aria-selected={x.id === p.id} className={h.segmentBtn} onClick={() => switchTo(i)}>
              P{i + 1}: {x.title} {best[x.id] && `· ${best[x.id]!.passed}/${best[x.id]!.total}`}
            </button>
          ))}
        </div>
        <div className={h.row} style={{ marginBottom: 8 }}>
          <Badge>{p.marks} marks</Badge>
        </div>
        <h1 id="p-h" className={h.cardTitle}>
          {p.title}
        </h1>
        {isFunction && (
          <div style={{ marginTop: 12 }}>
            <h2 className={h.eyebrow} style={{ marginBottom: 8 }}>
              Function to write
            </h2>
            {p.signature ? (
              <pre className={h.code} aria-label="Function signature">
                {signatureText(p.signature)}
              </pre>
            ) : (
              <p className={h.muted}>The signature isn&apos;t available; follow the starter code in the editor.</p>
            )}
            <p className={h.xs} style={{ marginTop: 8 }}>
              Write only this function and return the answer. It is called once per test case; don&apos;t read input or print the result.
            </p>
          </div>
        )}
        <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{p.statement}</p>
        {isSql && (
          <>
            <p className={h.xs} style={{ marginTop: 8 }}>
              Write a SQLite query.
              {p.orderMatters === true ? " Row order matters." : p.orderMatters === false ? " Row order does not matter." : ""}
            </p>
            <h2 className={h.eyebrow} style={{ marginTop: 16, marginBottom: 8 }}>
              Schema
            </h2>
            {p.schema ? (
              <pre className={h.code} aria-label="Database schema">
                {p.schema}
              </pre>
            ) : (
              <p className={h.muted}>The schema isn&apos;t available. Tell the invigilator or HR.</p>
            )}
          </>
        )}
        {isSql && p.samples.length > 0 && (
          <>
            <h2 className={h.eyebrow} style={{ marginTop: 24, marginBottom: 8 }}>
              Sample cases
            </h2>
            <div className={h.stack}>
              {p.samples.map((c, i) => {
                const tables = Object.entries(c.tables ?? {});
                return (
                  <section key={i} className={h.stackSm} aria-label={`Sample ${i + 1}`}>
                    <p className={h.small} style={{ fontWeight: 500 }}>
                      Sample {i + 1}
                    </p>
                    {tables.length === 0 ? (
                      <p className={h.muted}>No table data came with this sample.</p>
                    ) : (
                      tables.map(([name, t]) => <SqlDataTable key={name} name={name} table={t} label={`Sample ${i + 1} table ${name}`} />)
                    )}
                    <SqlRowsTable title="Expected rows" label={`Sample ${i + 1} expected rows`} rows={c.expectedRows ?? sqlRows(c.expected)} />
                  </section>
                );
              })}
            </div>
          </>
        )}
        {!isSql && p.samples.length > 0 && (
          <>
            <h2 className={h.eyebrow} style={{ marginTop: 24, marginBottom: 8 }}>
              Sample cases
            </h2>
            <div className={h.stackSm}>
              {p.samples.map((c, i) => (
                <div key={i} className={s.caseGrid}>
                  <div>
                    <p className={h.xs}>Input {i + 1}</p>
                    <pre className={h.code}>{isFunction ? c.inputDisplay : c.input}</pre>
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
          Submit runs these plus the hidden cases. Your latest submission for each problem counts.
        </p>
      </section>

      <section className={h.stackSm} aria-label="Editor" data-allow-select>
        <div className={s.editorWrap}>
          <div className={s.editorBar}>
            <label>
              <span className="sr-only">Language</span>
              <select value={doc.language} disabled={!live || isSql} onChange={(e) => change({ ...doc, language: e.target.value })}>
                {(isSql ? [p.languages.find((l) => l.key === SQL) ?? { key: SQL, name: "SQL (SQLite 3)" }] : p.languages).map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <span style={{ opacity: 0.7 }} aria-live="polite">
              {serverSaveFailed ? "Saved in this browser only" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Drafts save per language"}
            </span>
          </div>
          <CodeEditor
            path={`${p.id}/${doc.language}`}
            value={code}
            language={doc.language}
            readOnly={!live}
            blockClipboard
            label={`Code for ${p.title}`}
            onChange={(v) => change({ ...doc, code: { ...doc.code, [doc.language]: v } })}
          />
        </div>
        {noStarter && !doc.code[doc.language] && (
          <p className={h.xs}>No starter code came for this language. Write the function{p.signature ? ` ${p.signature.functionName}` : ""} yourself.</p>
        )}
        {loadNote && <p className={h.xs}>{loadNote}</p>}

        <div className={h.between}>
          <span />
          <div className={h.row}>
            <Button variant="secondary" loading={busy === "run"} disabled={busy !== null || !live} onClick={run}>
              <Play aria-hidden size={14} style={{ marginRight: 4 }} /> Run samples
            </Button>
            <Button loading={busy === "submit"} disabled={busy !== null || !live} onClick={submit}>
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
          {!runOut && !submitOut && !callError && <p className={h.muted}>Run your code against the sample cases, then submit to run the hidden cases too.</p>}
          {runOut && (
            <ul className={h.stackSm}>
              {runOut.map((r) => (
                <li key={r.case}>
                  <div className={h.between}>
                    <span className={h.row}>
                      {r.ok ? <CheckCircle2 aria-hidden size={16} color="var(--ui-color-success)" /> : <XCircle aria-hidden size={16} color="var(--ui-color-danger)" />} Sample {r.case}
                    </span>
                    <span className={h.xs}>{r.ok
                        ? `Passed${r.ms === null ? "" : ` · ${r.ms} ms`}`
                        : r.expectedRows && r.status === "wrong_answer"
                          ? "Wrong answer — compare the rows below"
                          : failText({ expected: r.expected, status: r.status, detail: r.stderr })}</span>
                  </div>
                  {!r.ok && r.expectedRows && (
                    <div className={h.stackSm} style={{ marginTop: 8 }}>
                      {r.status === "runtime_error" ? (
                        r.stderr && (
                          <div>
                            <p className={h.xs}>Error output</p>
                            <pre className={h.code}>{r.stderr}</pre>
                          </div>
                        )
                      ) : (
                        <div className={s.caseGrid}>
                          <SqlRowsTable title="Your rows" label={`Run sample ${r.case}: your rows`} rows={sqlRows(r.stdout)} />
                          <SqlRowsTable title="Expected rows" label={`Run sample ${r.case}: expected rows`} rows={r.expectedRows} />
                          {r.stderr && (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <p className={h.xs}>Error output</p>
                              <pre className={h.code}>{r.stderr}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {!r.ok && !r.expectedRows && (
                    <div className={s.caseGrid} style={{ marginTop: 8 }}>
                      <div>
                        <p className={h.xs}>Your output</p>
                        <pre className={h.code}>{r.stdout || "(nothing)"}</pre>
                      </div>
                      <div>
                        <p className={h.xs}>Expected output</p>
                        <pre className={h.code}>{r.expected}</pre>
                      </div>
                      {r.stderr && (
                        <div style={{ gridColumn: "1 / -1" }}>
                          <p className={h.xs}>Error output</p>
                          <pre className={h.code}>{r.stderr}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {submitOut && (
            <div className={h.between}>
              <p>
                <strong className={h.scoreBig}>{submitOut.passed}</strong> / {submitOut.total} test cases passed
              </p>
              <Badge tone={submitOut.passed === submitOut.total ? "success" : submitOut.passed >= submitOut.total / 2 ? "warning" : "danger"}>
                {submitOut.passed === submitOut.total ? "All passed" : "Partially passed"}
              </Badge>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
