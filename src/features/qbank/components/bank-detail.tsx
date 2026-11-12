"use client";

import { AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { editBankQuestion, getBank, listBankQuestions, setApproval } from "@/api/qbank";
import { hire as h } from "@/components/hire/ui";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, ForbiddenState, NotFoundState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import ps from "@/features/papers/components/papers.module.scss";
import { QuestionCard } from "@/features/papers/components/question-card";
import { QuestionEditDialog } from "@/features/papers/components/question-edit-dialog";
import { LEVELS } from "@/features/papers/needed";
import type { KeyItem, Level } from "@/features/papers/types";
import { useAsync } from "@/features/papers/use-async";
import type { ApprovalUpdate, BankDetail as Detail, BankQuestion } from "@/features/qbank/types";
import { DownloadButton, EMBEDDING, EmbeddingBadge } from "./bank-parts";
import s from "./qbank.module.scss";

export const PAGE_SIZE = 20;
const cap = (v: string) => v[0]!.toUpperCase() + v.slice(1);

/** A bank question in the paper card's shape (bank questions are Technical; no shuffle lock, not edited). */
export const toKeyItem = (q: BankQuestion): KeyItem => ({
  id: q.id,
  level: q.level,
  section: "technical",
  topic: [q.subject, q.topic].filter(Boolean).join(" / "),
  text: q.text,
  options: q.options,
  answer: q.answer,
  why: q.explanation || "No explanation in the PDF.",
  fixedOptions: false,
  edited: false,
});

interface Filters {
  subject: string;
  level: "" | Level;
  approved: "" | "true" | "false";
  page: number;
}

export function BankDetail({ id }: { id: string }) {
  const [version, setVersion] = useState(0);
  const bank = useAsync(() => getBank(id), [id, version]);
  const d = bank.data;

  if (!d) {
    if (bank.error?.status === 404) return <NotFoundState title="Question bank not found" />;
    if (bank.error?.status === 403) return <ForbiddenState />;
    if (bank.error) return <ErrorState message={bank.error.message} onRetry={bank.reload} />;
    return (
      <>
        <LoadingLabel label="Loading question bank" />
        <Skeleton style={{ height: 320 }} />
      </>
    );
  }
  return <Loaded d={d} refresh={() => setVersion((v) => v + 1)} />;
}

function Loaded({ d, refresh }: { d: Detail; refresh: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Filters>({ subject: "", level: "", approved: "", page: 1 });
  const [qVersion, setQVersion] = useState(0);
  const [editing, setEditing] = useState<BankQuestion>();
  const [busy, setBusy] = useState<string>();
  const questions = useAsync(
    () =>
      listBankQuestions(d.id, {
        subject: f.subject || undefined,
        level: f.level || undefined,
        approved: f.approved ? f.approved === "true" : undefined,
        page: f.page,
        pageSize: PAGE_SIZE,
      }),
    [d.id, f.subject, f.level, f.approved, f.page, qVersion],
  );
  const subjects = Object.keys(d.counts).sort();
  const filter = (patch: Partial<Filters>) => setF((v) => ({ ...v, page: 1, ...patch }));
  const reloadAll = () => {
    refresh();
    setQVersion((v) => v + 1);
  };

  const approve = async (key: string, body: ApprovalUpdate, done: string) => {
    setBusy(key);
    try {
      const r = await setApproval(d.id, body);
      toast({ tone: "success", title: done, description: `${r.changed} questions changed · ${r.approvedCount} of ${r.questionCount} approved.` });
      reloadAll();
    } catch (e) {
      toast({ tone: "danger", title: "Approval not changed", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(undefined);
    }
  };

  const total = questions.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const emb = EMBEDDING[d.embeddingStatus];

  return (
    <>
      <PageHeader title={d.name} description={`${d.filename} · ${d.track === "it" ? "IT" : "Non-IT"} · ${d.approvedCount} of ${d.questionCount} questions approved`} actions={<DownloadButton bank={d} />} />
      <div className={h.stack}>
        <span className={h.row}>
          {d.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive — not used by new papers</Badge>}
          <EmbeddingBadge status={d.embeddingStatus} />
        </span>
        {d.embeddingStatus !== "done" && (
          <p className={ps.banner} data-tone="info" role="status">
            <Info aria-hidden size={16} />
            <span>{emb.help}</span>
          </p>
        )}
        {!d.canManage && (
          <p className={ps.banner} data-tone="info">
            <Info aria-hidden size={16} />
            <span>Read only: only the uploader or a Super Admin can approve or edit this bank. Any HR can use its approved questions.</span>
          </p>
        )}

        <section className={h.card} aria-labelledby="bank-summary">
          <h2 id="bank-summary" className={h.cardTitle} style={{ marginBottom: "0.75rem" }}>
            Approved by subject and level
          </h2>
          {subjects.length ? (
            <div style={{ overflowX: "auto" }}>
              <table className={ps.counts}>
                <thead>
                  <tr>
                    <th scope="col">Subject</th>
                    {LEVELS.map((lv) => (
                      <th key={lv} scope="col">
                        {cap(lv)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((sub) => (
                    <tr key={sub}>
                      <th scope="row">{sub}</th>
                      {LEVELS.map((lv) => {
                        const c = d.counts[sub]?.[lv];
                        return <td key={lv}>{c ? `${c.approved} / ${c.total}` : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={h.small}>No questions in this bank.</p>
          )}
        </section>

        <section className={h.card} aria-labelledby="bank-report">
          <h2 id="bank-report" className={h.cardTitle} style={{ marginBottom: "0.75rem" }}>
            What was read from the PDF
          </h2>
          <p className={h.small}>
            {d.report.total} questions read{d.report.warnings.length ? ` · ${d.report.warnings.length} need a look` : ""}
            {d.report.skipped.length ? ` · ${d.report.skipped.length} skipped` : ""}.
          </p>
          {d.report.warnings.length > 0 && (
            <details style={{ marginTop: "0.5rem" }}>
              <summary>Warnings ({d.report.warnings.length}) — questions with a warning are left out of “Approve all clean”</summary>
              <ul className={s.report}>
                {d.report.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          {d.report.skipped.length > 0 && (
            <details style={{ marginTop: "0.5rem" }}>
              <summary>Skipped ({d.report.skipped.length}) — not imported</summary>
              <ul className={s.report}>
                {d.report.skipped.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <section className={h.card} aria-labelledby="bank-questions">
          <h2 id="bank-questions" className={h.cardTitle} style={{ marginBottom: "0.75rem" }}>
            Questions
          </h2>
          <div className={h.stack}>
            <div className={s.filters}>
              <Field label="Subject">
                <Select value={f.subject} onChange={(e) => filter({ subject: e.target.value })}>
                  <option value="">All subjects</option>
                  {subjects.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Level">
                <Select value={f.level} onChange={(e) => filter({ level: e.target.value as Filters["level"] })}>
                  <option value="">All levels</option>
                  {LEVELS.map((lv) => (
                    <option key={lv} value={lv}>
                      {cap(lv)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={f.approved} onChange={(e) => filter({ approved: e.target.value as Filters["approved"] })}>
                  <option value="">All</option>
                  <option value="true">Approved</option>
                  <option value="false">Not approved</option>
                </Select>
              </Field>
            </div>
            {d.canManage && (
              <div className={h.row} style={{ flexWrap: "wrap" }}>
                <Button size="sm" loading={busy === "clean"} disabled={Boolean(busy)} onClick={() => void approve("clean", { approved: true, scope: "all_clean" }, "Clean questions approved")}>
                  Approve all clean
                </Button>
                {f.subject && (
                  <>
                    <Button size="sm" variant="secondary" loading={busy === "subj"} disabled={Boolean(busy)} onClick={() => void approve("subj", { approved: true, scope: "subject", subject: f.subject }, `${f.subject} approved`)}>
                      Approve {f.subject}
                    </Button>
                    <Button size="sm" variant="secondary" loading={busy === "unsubj"} disabled={Boolean(busy)} onClick={() => void approve("unsubj", { approved: false, scope: "subject", subject: f.subject }, `${f.subject} unapproved`)}>
                      Unapprove {f.subject}
                    </Button>
                  </>
                )}
                <Button size="sm" variant="tertiary" loading={busy === "unall"} disabled={Boolean(busy)} onClick={() => void approve("unall", { approved: false, scope: "all_clean" }, "All questions unapproved")}>
                  Unapprove all
                </Button>
              </div>
            )}

            {questions.loading && !questions.data ? (
              <>
                <LoadingLabel label="Loading questions" />
                <Skeleton style={{ height: 200 }} />
              </>
            ) : questions.error && !questions.data ? (
              <ErrorState message={questions.error.message} onRetry={questions.reload} />
            ) : !questions.data?.items.length ? (
              <EmptyState title="No questions match" description="Change or clear the filters." />
            ) : (
              <>
                <ol className={ps.paper} aria-label="Bank questions" aria-busy={questions.loading || undefined}>
                  {questions.data.items.map((q, i) => (
                    <QuestionCard
                      key={q.id}
                      q={toKeyItem(q)}
                      n={(f.page - 1) * PAGE_SIZE + i + 1}
                      onEdit={d.canManage ? () => setEditing(q) : undefined}
                      tags={
                        <>
                          {q.approved ? <Badge tone="success">Approved</Badge> : <Badge>Not approved</Badge>}
                          {q.warnings.length > 0 && (
                            <span title={q.warnings.join("\n")}>
                              <Badge tone="warning">
                                <AlertTriangle aria-hidden size={12} /> {q.warnings.join("; ")}
                              </Badge>
                            </span>
                          )}
                          {d.canManage && (
                            <Button
                              size="sm"
                              variant="tertiary"
                              loading={busy === q.id}
                              disabled={Boolean(busy)}
                              onClick={() => void approve(q.id, { approved: !q.approved, scope: "ids", questionIds: [q.id] }, q.approved ? "Question unapproved" : "Question approved")}
                            >
                              {q.approved ? "Unapprove" : "Approve"}
                            </Button>
                          )}
                        </>
                      }
                    />
                  ))}
                </ol>
                <nav className={s.pager} aria-label="Question pages">
                  <Button size="sm" variant="secondary" disabled={f.page <= 1} onClick={() => setF((v) => ({ ...v, page: v.page - 1 }))}>
                    Previous
                  </Button>
                  <span>
                    Page {f.page} of {pages} · {total} questions
                  </span>
                  <Button size="sm" variant="secondary" disabled={f.page >= pages} onClick={() => setF((v) => ({ ...v, page: v.page + 1 }))}>
                    Next
                  </Button>
                </nav>
              </>
            )}
          </div>
        </section>
      </div>
      {editing && (
        <QuestionEditDialog
          question={{ ...toKeyItem(editing), why: editing.explanation ?? "" }}
          warning="Changes this bank question for papers created from now on. Papers already generated keep their own copy. Saving clears its PDF warnings."
          onClose={() => setEditing(undefined)}
          save={async (body) => {
            await editBankQuestion(d.id, editing.id, body);
            reloadAll();
          }}
        />
      )}
    </>
  );
}
