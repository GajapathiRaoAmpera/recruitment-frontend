"use client";

import { CheckCircle2, Pencil, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/api/client";
import { approveCodingQuestion, DIFFICULTIES, listCodingQuestions, titleOf, type Difficulty, type QuestionSummary } from "@/api/coding-questions";
import { hire as h } from "@/components/hire/ui";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useAsync } from "@/features/papers/use-async";
import { fmt } from "@/features/advance/messages";
import { codingErrorMessage } from "./messages";

export const LIST_LIMIT = 200; // the API's maximum page
export const DIFFICULTY_TONE: Record<Difficulty, BadgeTone> = { easy: "success", medium: "warning", advanced: "danger" };
export const label = (d: string) => d[0]!.toUpperCase() + d.slice(1);

interface Props {
  /** Questions already in this round's list (saved or not). */
  inRound: ReadonlySet<string>;
  /** A student has started this round's test: nothing can be added, and its questions can't be edited. */
  locked: boolean;
  onAdd: (q: QuestionSummary) => void;
  onEdit: (id: string) => void;
  onNew: () => void;
  onGenerate: () => void;
  /** A draft was approved from its row (it can be added to a round now). */
  onApproved: (q: QuestionSummary) => void;
  /** Bump to list again (after a question is created or saved). */
  reloadKey: number;
}

/** HR's coding question bank (GET /questions): filter by difficulty, search in the browser, add to the round. */
export function BankPicker({ inRound, locked, onAdd, onEdit, onNew, onGenerate, onApproved, reloadKey }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [search, setSearch] = useState("");
  const { data, error, reload } = useAsync(() => listCodingQuestions({ difficulty: difficulty || undefined, limit: LIST_LIMIT }), [difficulty, reloadKey]);

  const [approved, setApproved] = useState<ReadonlySet<string>>(() => new Set()); // approved here, before the list reloads
  const [confirm, setConfirm] = useState<QuestionSummary | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string>();

  const approve = async () => {
    if (!confirm) return;
    setApproving(true);
    setApproveError(undefined);
    try {
      const q = await approveCodingQuestion(confirm.id);
      setApproved((a) => new Set(a).add(q.id));
      setConfirm(null);
      onApproved(q);
    } catch (e) {
      setApproveError(codingErrorMessage(e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", "Couldn't reach the server. Try again.")));
    } finally {
      setApproving(false);
    }
  };

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter((q) => !term || q.body.toLowerCase().includes(term) || q.tags.some((t) => t.toLowerCase().includes(term)));

  return (
    <section aria-labelledby="bank-h">
      <div className={h.cardHead}>
        <h3 id="bank-h" className={h.cardTitle}>
          Question bank
        </h3>
        <span className={h.row}>
          <Button size="sm" variant="secondary" onClick={onGenerate}>
            <Sparkles aria-hidden size={14} style={{ marginRight: 4 }} /> Generate with AI
          </Button>
          <Button size="sm" variant="secondary" onClick={onNew}>
            <Plus aria-hidden size={14} style={{ marginRight: 4 }} /> New question
          </Button>
        </span>
      </div>
      <div className={h.toolbar} style={{ marginBottom: 12 }}>
        <Field label="Difficulty">
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}>
            <option value="">All levels</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {label(d)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Search">
          <Input type="search" value={search} placeholder="Title, statement or tag" onChange={(e) => setSearch(e.target.value)} />
        </Field>
      </div>

      {error && !data ? (
        <ErrorState message={codingErrorMessage(error)} onRetry={reload} />
      ) : !data ? (
        <>
          <LoadingLabel label="Loading question bank" />
          <Skeleton style={{ height: 120 }} />
        </>
      ) : data.length === 0 ? (
        <EmptyState
          title={difficulty ? `No ${difficulty} coding questions yet` : "No coding questions yet"}
          description="Write one with New question; it needs 3 sample and 15 hidden test cases."
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No questions match" description="Try another search or difficulty." />
      ) : (
        <>
          <Table aria-label="Question bank">
            <thead>
              <tr>
                <Th>Question</Th>
                <Th>Difficulty</Th>
                <Th>Marks</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const added = inRound.has(q.id);
                const title = titleOf(q.body);
                const isApproved = q.approved || approved.has(q.id);
                return (
                  <tr key={q.id}>
                    <Td>
                      <p style={{ fontWeight: 500 }}>{title}</p>
                      {q.tags.length > 0 && <p className={h.xs}>{q.tags.join(", ")}</p>}
                      {!isApproved && (
                        <span className={h.row}>
                          <Badge tone="info">Draft (AI)</Badge>
                          <Badge tone="warning">Not approved</Badge>
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={DIFFICULTY_TONE[q.difficulty]}>{label(q.difficulty)}</Badge>
                    </Td>
                    <Td>{fmt(q.marks)}</Td>
                    <Td>
                      <span className={h.row} style={{ justifyContent: "flex-end" }}>
                        {!(locked && added) && (
                          <Button size="sm" variant="tertiary" aria-label={`${isApproved ? "Edit" : "Review"} ${title}`} onClick={() => onEdit(q.id)}>
                            <Pencil aria-hidden size={14} style={{ marginRight: 4 }} /> {isApproved ? "Edit" : "Review"}
                          </Button>
                        )}
                        {!isApproved && (
                          <Button
                            size="sm"
                            variant="secondary"
                            aria-label={`Approve ${title}`}
                            onClick={() => {
                              setApproveError(undefined);
                              setConfirm(q);
                            }}
                          >
                            <CheckCircle2 aria-hidden size={14} style={{ marginRight: 4 }} /> Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={added ? `${title} is in this round` : `Add ${title} to round`}
                          disabled={added || !isApproved || locked}
                          title={!isApproved ? "Approve it first" : locked ? "A student has started this test" : undefined}
                          onClick={() => onAdd(q)}
                        >
                          {added ? "Added" : "Add to round"}
                        </Button>
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          {data.length === LIST_LIMIT && <p className={h.xs}>Showing the newest {LIST_LIMIT}. Filter by difficulty to see older ones.</p>}
        </>
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && !approving && setConfirm(null)}
        destructive={false}
        title={`Approve "${confirm ? titleOf(confirm.body) : ""}" without reviewing?`}
        description="Students will get its statement and all 18 test cases exactly as the AI wrote them. To check them first, use Review instead."
        confirmLabel="Approve"
        loading={approving}
        error={approveError}
        onConfirm={approve}
      />
    </section>
  );
}
