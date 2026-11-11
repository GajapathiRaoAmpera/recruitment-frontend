"use client";

import { Check, Pencil, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Chips, DemoNote, hire as h, StatCard } from "@/components/hire/ui";
import { useStore } from "@/mock/store";
import type { Difficulty, Question } from "@/mock/types";

const TOPICS = ["quant", "reasoning", "technical", "dsa", "sql", "os", "web"];

export default function QuestionBankPage() {
  useBreadcrumbs([{ label: "Question bank" }]);
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<"all" | Question["kind"]>("all");
  const [tag, setTag] = useState("");
  const [difficulty, setDifficulty] = useState<"" | Difficulty>("");
  const [onlyDrafts, setOnlyDrafts] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [gen, setGen] = useState({ tag: "quant", difficulty: "medium" as Difficulty, count: 3 });
  const [generating, setGenerating] = useState(false);

  const all = state.questions;
  const tags = [...new Set(all.flatMap((q) => q.tags))].sort();
  const rows = all.filter((q) => (kind === "all" || q.kind === kind) && (!tag || q.tags.includes(tag)) && (!difficulty || q.difficulty === difficulty) && (!onlyDrafts || !q.approved));

  const generate = () => {
    setGenerating(true);
    // Simulated Gemini call: the real API validates the JSON against a schema before saving drafts.
    setTimeout(() => {
      const made: Question[] = Array.from({ length: gen.count }, (_, i) => ({
        id: `g${Date.now()}-${i}`,
        kind: "mcq",
        title: `${gen.tag[0]!.toUpperCase()}${gen.tag.slice(1)} draft ${i + 1}`,
        body: `AI-generated ${gen.difficulty} ${gen.tag} question #${i + 1}. Review the wording and options before approving.`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        answer: 0,
        tags: [gen.tag],
        difficulty: gen.difficulty,
        marks: 1,
        aiGenerated: true,
        approved: false,
      }));
      dispatch({ type: "addQuestions", questions: made });
      setGenerating(false);
      setGenOpen(false);
      setOnlyDrafts(true);
      toast({ tone: "success", title: `${made.length} draft questions generated`, description: "Approve them before they can be used in a test." });
    }, 900);
  };

  return (
    <div className={h.stack}>
      <PageHeader
        title="Question bank"
        description="AI-generated and manual questions, tagged for Round 1 and Round 2. Drafts need HR approval."
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing({ id: `m${Date.now()}`, kind: "mcq", title: "", body: "", options: ["", "", "", ""], answer: 0, tags: [], difficulty: "easy", marks: 1, aiGenerated: false, approved: true })}>
              <Plus aria-hidden size={16} style={{ marginRight: 4 }} /> Add manually
            </Button>
            <Button onClick={() => setGenOpen(true)}>
              <Sparkles aria-hidden size={16} style={{ marginRight: 6 }} /> Generate with AI
            </Button>
          </>
        }
      />

      <div className={h.grid4}>
        <StatCard label="Total" value={all.length} />
        <StatCard label="Aptitude & MCQ" value={all.filter((q) => q.kind === "mcq").length} />
        <StatCard label="Coding" value={all.filter((q) => q.kind === "coding").length} hint="3 sample + 15 hidden cases each" />
        <StatCard label="Drafts to review" value={all.filter((q) => !q.approved).length} />
      </div>

      <div className={h.toolbar}>
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="all">All types</option>
            <option value="mcq">MCQ</option>
            <option value="coding">Coding</option>
          </Select>
        </Field>
        <Field label="Tag">
          <Select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">All tags</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Difficulty">
          <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
            <option value="">All levels</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="advanced">Advanced</option>
          </Select>
        </Field>
        <label className={h.row} style={{ paddingBottom: 8 }}>
          <input type="checkbox" className={h.check} checked={onlyDrafts} onChange={(e) => setOnlyDrafts(e.target.checked)} /> Drafts only
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No questions match" description="Clear a filter or generate new questions." />
      ) : (
        <div className={h.grid2}>
          {rows.map((q) => (
            <article key={q.id} className={h.card}>
              <div className={h.cardHead}>
                <div className={h.row}>
                  <Badge tone={q.kind === "coding" ? "info" : "neutral"}>{q.kind === "coding" ? "Coding" : "MCQ"}</Badge>
                  <Badge tone={q.difficulty === "advanced" ? "danger" : q.difficulty === "medium" ? "warning" : "success"}>{q.difficulty}</Badge>
                  {q.aiGenerated && <Badge tone="primary">AI</Badge>}
                  {!q.approved && <Badge tone="warning">Draft</Badge>}
                </div>
                <Button variant="tertiary" size="sm" aria-label={`Edit ${q.title}`} onClick={() => setEditing(q)}>
                  <Pencil aria-hidden size={14} />
                </Button>
              </div>
              <h3 style={{ fontWeight: 500 }}>{q.title}</h3>
              <p className={h.small} style={{ marginTop: 6 }}>
                {q.body}
              </p>
              {q.kind === "mcq" ? (
                <p className={h.xs} style={{ marginTop: 10 }}>
                  Answer: <strong>{q.options?.[q.answer ?? 0]}</strong>
                </p>
              ) : (
                <p className={h.xs} style={{ marginTop: 10 }}>
                  {q.samples?.length} sample + {q.hiddenCount} hidden test cases
                </p>
              )}
              <div className={h.between} style={{ marginTop: 12 }}>
                <Chips items={q.tags} />
                {!q.approved && (
                  <Button size="sm" onClick={() => dispatch({ type: "updateQuestion", question: { ...q, approved: true } })}>
                    <Check aria-hidden size={14} style={{ marginRight: 4 }} /> Approve
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent
          title="Generate questions with AI"
          description="Drafts are saved unapproved. You review each one before it's used."
          footer={
            <>
              <Button variant="secondary" onClick={() => setGenOpen(false)}>
                Cancel
              </Button>
              <Button loading={generating} onClick={generate}>
                Generate {gen.count}
              </Button>
            </>
          }
        >
          <div className={h.stackSm}>
            <Field label="Topic tag">
              <Select value={gen.tag} onChange={(e) => setGen({ ...gen, tag: e.target.value })}>
                {TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={gen.difficulty} onChange={(e) => setGen({ ...gen, difficulty: e.target.value as Difficulty })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="advanced">Advanced</option>
              </Select>
            </Field>
            <Field label="How many">
              <Input type="number" min={1} max={20} value={gen.count} onChange={(e) => setGen({ ...gen, count: Math.max(1, Math.min(20, Number(e.target.value))) })} />
            </Field>
            <DemoNote>Simulated — the backend calls Gemini with the “MCQ generation” prompt from AI settings.</DemoNote>
          </div>
        </DialogContent>
      </Dialog>

      {editing && <EditDialog question={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditDialog({ question, onClose }: { question: Question; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [q, setQ] = useState(question);
  const isNew = !state.questions.some((x) => x.id === question.id);
  const [error, setError] = useState<string>();

  const save = () => {
    if (!q.title.trim() || !q.body.trim()) return setError("Add a title and the question text.");
    if (q.kind === "mcq" && q.options!.some((o) => !o.trim())) return setError("Fill in all four options.");
    if (isNew) dispatch({ type: "addQuestions", questions: [q] });
    else dispatch({ type: "updateQuestion", question: q });
    toast({ tone: "success", title: isNew ? "Question added" : question.answer !== q.answer ? "Answer key corrected — affected attempts re-scored" : "Question saved" });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        side
        title={isNew ? "Add question" : "Edit question"}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Save question</Button>
          </>
        }
      >
        <div className={h.stackSm}>
          {error && (
            <p role="alert" className={h.small} style={{ color: "var(--ui-color-danger)" }}>
              {error}
            </p>
          )}
          <Field label="Title" required>
            <Input value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} />
          </Field>
          <Field label="Question" required>
            <Textarea rows={4} value={q.body} onChange={(e) => setQ({ ...q, body: e.target.value })} />
          </Field>
          {q.kind === "mcq" &&
            q.options!.map((o, i) => (
              <Field key={i} label={`Option ${String.fromCharCode(65 + i)}`}>
                <Input value={o} onChange={(e) => setQ({ ...q, options: q.options!.map((x, j) => (j === i ? e.target.value : x)) })} />
              </Field>
            ))}
          {q.kind === "mcq" && (
            <Field label="Correct answer" hint="Changing this re-scores every attempt that used the question.">
              <Select value={q.answer} onChange={(e) => setQ({ ...q, answer: Number(e.target.value) })}>
                {q.options!.map((o, i) => (
                  <option key={i} value={i}>
                    {String.fromCharCode(65 + i)}. {o || "(empty)"}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className={h.grid2}>
            <Field label="Difficulty">
              <Select value={q.difficulty} onChange={(e) => setQ({ ...q, difficulty: e.target.value as Difficulty })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="advanced">Advanced</option>
              </Select>
            </Field>
            <Field label="Tags" hint="Comma separated">
              <Input value={q.tags.join(", ")} onChange={(e) => setQ({ ...q, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
            </Field>
          </div>
          <label className={h.row}>
            <input type="checkbox" className={h.check} checked={q.approved} onChange={(e) => setQ({ ...q, approved: e.target.checked })} /> Approved for use in tests
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
