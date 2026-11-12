"use client";

import { AlertTriangle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { editQuestion } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { DraftDetail, KeyItem, QuestionEdit } from "@/features/papers/types";
import s from "./papers.module.scss";
import { letter } from "./question-card";

/** Mirrors the backend QuestionEdit validator so most mistakes are caught before the round trip. */
export function validateEdit(q: QuestionEdit): string | undefined {
  const opts = q.options.map((o) => o.trim());
  if (!q.text.trim()) return "Enter the question text.";
  if (opts.some((o) => !o)) return "Fill in all four options.";
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return "Each option must be different.";
  if (!(q.answer >= 0 && q.answer < opts.length)) return "Pick the correct answer.";
  if (!q.why.trim()) return "Explain why the answer is correct.";
}

interface Props {
  question: KeyItem;
  onClose: () => void;
  /** Paper drafts: saved through PATCH /papers/drafts/{draftId}/questions/{id}. */
  draftId?: string;
  onSaved?: (d: DraftDetail) => void;
  /** Any other owner of the question (e.g. a question bank) saves through this instead. */
  save?: (body: QuestionEdit) => Promise<void>;
  warning?: ReactNode;
}

const PAPER_WARNING = "This changes the question for every candidate whose paper includes it.";

export function QuestionEditDialog({ draftId, question, onClose, onSaved, save: saveTo, warning = PAPER_WARNING }: Props) {
  const toast = useToast();
  const [q, setQ] = useState<QuestionEdit>({ text: question.text, options: [...question.options], answer: question.answer, why: question.why });
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const invalid = validateEdit(q);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(undefined);
    try {
      const body = { ...q, text: q.text.trim(), why: q.why.trim(), options: q.options.map((o) => o.trim()) };
      if (saveTo) await saveTo(body);
      else onSaved?.(await editQuestion(draftId!, question.id, body));
      toast({ tone: "success", title: "Question saved", description: saveTo ? undefined : "Checks refreshed." });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Try again.");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        side
        title="Edit question"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              Save question
            </Button>
          </>
        }
      >
        <div className={h.stackSm}>
          <p className={s.banner}>
            <AlertTriangle aria-hidden size={16} />
            <span>{warning}</span>
          </p>
          {error && (
            <p role="alert" className={h.small} style={{ color: "var(--ui-color-danger)" }}>
              {error}
            </p>
          )}
          <Field label="Question" required hint="Wrap code in ``` fences to show it as a code block.">
            <Textarea rows={5} value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />
          </Field>
          {q.options.map((o, i) => (
            <Field key={i} label={`Option ${letter(i)}`} required>
              <Input value={o} onChange={(e) => setQ({ ...q, options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />
            </Field>
          ))}
          <Field label="Correct answer">
            <Select value={q.answer} onChange={(e) => setQ({ ...q, answer: Number(e.target.value) })}>
              {q.options.map((o, i) => (
                <option key={i} value={i}>
                  {letter(i)}. {o || "(empty)"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Why this is correct" required>
            <Textarea rows={4} value={q.why} onChange={(e) => setQ({ ...q, why: e.target.value })} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
