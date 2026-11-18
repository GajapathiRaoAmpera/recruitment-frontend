"use client";

import { useState } from "react";
import { regenerateQuestion } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import type { DraftDetail, KeyItem } from "@/features/papers/types";
import { RichText } from "./question-card";

interface Props {
  draftId: string;
  question: KeyItem;
  onClose: () => void;
  onSaved: (d: DraftDetail) => void;
}

/** Replaces one question with a new one (new options, answer and explanation). Technical ones take an optional reason for the AI. */
export function QuestionRegenerateDialog({ draftId, question, onClose, onSaved }: Props) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const technical = question.section === "technical";

  const regenerate = async () => {
    setBusy(true);
    try {
      onSaved(await regenerateQuestion(draftId, question.id, technical ? reason.trim() || undefined : undefined));
      toast({ tone: "success", title: "Question regenerated", description: "Check the new question and its explanation." });
      onClose();
    } catch (e) {
      toast({ tone: "danger", title: e instanceof Error ? e.message : "Could not regenerate. Try again." });
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        title="Regenerate question"
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void regenerate()}>
              Regenerate question
            </Button>
          </>
        }
      >
        <div className={h.stackSm}>
          <Notice compact tone="warning">
            This question is replaced with a new one at the same level, with its own answer and explanation, for every candidate whose paper includes it.
          </Notice>
          <RichText text={question.text} />
          {technical && (
            <Field label="What's wrong with it?" hint="Optional. The AI uses this to write a better question.">
              <Textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. too easy, answer is ambiguous" />
            </Field>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
