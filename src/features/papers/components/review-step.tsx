"use client";

import { AlertTriangle, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { acceptDraft } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { DraftDetail, KeyItem } from "@/features/papers/types";
import { ChecksList } from "./checks-list";
import { PaperView } from "./paper-view";
import { PoolPicker } from "./pool-picker";
import s from "./papers.module.scss";
import { QuestionEditDialog } from "./question-edit-dialog";

/** Step 3: integrity checks + one editable sample paper + accept. Accepted drafts are read-only. */
export function ReviewStep({ draft, onChange }: { draft: DraftDetail; onChange: (d: DraftDetail) => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<KeyItem>();
  const [confirming, setConfirming] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string>();
  const [unsaved, setUnsaved] = useState(false);
  const editable = draft.status === "draft";
  const allOk = draft.checks.length > 0 && draft.checks.every((c) => c.ok);
  const failing = draft.checks.filter((c) => !c.ok).length;
  const hasTechnical = draft.settings.mix.technical > 0;
  const technicalLabel = draft.track === "it" ? "Technical" : "Soft skills";

  const accept = async () => {
    setAccepting(true);
    setAcceptError(undefined);
    try {
      const accepted = await acceptDraft(draft.id);
      onChange({ ...draft, ...accepted });
      setConfirming(false);
      toast({ tone: "success", title: "Paper accepted", description: "Settings and questions are now locked." });
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : "Could not accept. Try again.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className={h.stack}>
      {!editable && (
        <p className={s.banner} data-tone="info">
          <Lock aria-hidden size={16} />
          <span>This paper is accepted. Settings and questions are locked.</span>
        </p>
      )}

      {draft.pool.length > 0 && <PoolPicker draft={draft} onChange={onChange} onEdit={editable ? setEditing : undefined} onDirtyChange={setUnsaved} />}

      <section aria-labelledby="review-sample">
        <h2 id="review-sample" className={h.cardTitle} style={{ marginBottom: "0.75rem" }}>
          Sample paper
        </h2>
        <p className={h.xs} style={{ marginBottom: "0.75rem" }}>
          {draft.sample.length} questions: one example of what a student receives.{" "}
          {(draft.selectedCount ?? draft.poolSize) > draft.sample.length ? "Each student gets their own mix from the selected questions." : "Every student gets these questions."}
        </p>
        <PaperView items={draft.sample} onEdit={editable ? setEditing : undefined} />
      </section>

      <section className={h.card} aria-labelledby="review-checks">
        <div className={h.cardHead}>
          <h2 id="review-checks" className={h.cardTitle}>
            Integrity checks
          </h2>
          <p className={h.xs}>
            <ShieldCheck aria-hidden size={14} style={{ verticalAlign: "-2px" }} /> {draft.selectedCount ?? draft.poolSize} of {draft.poolSize} questions selected
            {draft.editedCount ? ` · ${draft.editedCount} edited` : ""}
          </p>
        </div>
        {hasTechnical && editable && <p className={h.xs} style={{ marginBottom: "0.75rem" }}>The AI wrote the {technicalLabel} questions: check their answers before accepting.</p>}
        <ChecksList checks={draft.checks} />
      </section>

      {editable && (
        <div className={s.acceptBar}>
          <span className={h.row}>
            {allOk && !unsaved ? <CheckCircle2 aria-hidden size={16} className={s.ok} /> : <AlertTriangle aria-hidden size={16} className={s.bad} />}
            {unsaved ? "Save or undo your question selection first." : allOk ? `All ${draft.checks.length} checks pass. Accepting locks the paper.` : `${failing} check${failing === 1 ? "" : "s"} failing: fix them before accepting.`}
          </span>
          <Button disabled={!allOk || unsaved} onClick={() => setConfirming(true)}>
            Accept paper
          </Button>
        </div>
      )}

      {editing && <QuestionEditDialog draftId={draft.id} question={editing} onClose={() => setEditing(undefined)} onSaved={onChange} />}
      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => {
          setConfirming(o);
          if (!o) setAcceptError(undefined);
        }}
        title="Accept this paper?"
        description="Settings and questions lock after accepting. You can then send it to candidates."
        confirmLabel="Accept paper"
        destructive={false}
        loading={accepting}
        error={acceptError}
        onConfirm={accept}
      />
    </div>
  );
}
