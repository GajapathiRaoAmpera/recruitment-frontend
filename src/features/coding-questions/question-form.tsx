"use client";

import { ClipboardPaste, Code2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/api/client";
import {
  approveCodingQuestion,
  createCodingQuestion,
  DIFFICULTIES,
  getCodingQuestion,
  HIDDEN_CASES,
  MAX_PARAMS,
  PARAM_TYPES,
  SAMPLE_CASES,
  updateCodingQuestion,
  type CodingMode,
  type CodingQuestion,
  type Difficulty,
  type ParamType,
  type QuestionInput,
  type QuestionSummary,
} from "@/api/coding-questions";
import { hire as h } from "@/components/hire/ui";
import student from "@/components/student/student.module.scss";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { ErrorState, ForbiddenState } from "@/components/ui/states";
import { useAsync } from "@/features/papers/use-async";
// A next/dynamic wrapper: Monaco is fetched only when the reference solution is first shown.
import { CodeEditor } from "@/features/test-runner/code-editor";
import { caseCounts, emptyCaseSet, fromTestCases, parseCasesJson, PASTE_EXAMPLE, toTestCases, type CaseRow, type CaseSet } from "./cases";
import s from "./coding-questions.module.scss";
import { codingErrorMessage, fieldErrors, type FieldErrors } from "./messages";
import { functionNameProblem, marksProblem, parametersProblem, parseTags, tagsProblem } from "./validate";

interface FormState {
  body: string;
  difficulty: Difficulty;
  marks: string;
  tags: string; // comma separated
  cases: CaseSet;
  mode: CodingMode;
  // Function mode only (kept while HR flips the mode, sent only for "function").
  functionName: string;
  params: { name: string; type: ParamType }[];
  returnType: ParamType;
}

const blankSignature = { functionName: "", params: [{ name: "", type: "int" as ParamType }], returnType: "int" as ParamType };
const blankForm = (): FormState => ({ body: "", difficulty: "easy", marks: "10", tags: "", cases: emptyCaseSet(), mode: "stdin", ...blankSignature });
const noop = () => {};
export const DRAFT_NOTE = "Expected outputs came from running the reference solution. If you change an input, update its expected output yourself.";
const toForm = (q: CodingQuestion): FormState => ({
  body: q.body,
  difficulty: q.difficulty,
  marks: String(q.marks),
  tags: q.tags.join(", "),
  cases: fromTestCases(q.testCases),
  mode: q.mode,
  ...(q.signature ? { functionName: q.signature.functionName, params: q.signature.parameters.map((p) => ({ ...p })), returnType: q.signature.returnType } : blankSignature),
});
/** Mirrors the backend validators so Save is only offered for a question the API will accept. */
export function formProblems(f: FormState): string[] {
  const out: string[] = [];
  if (!f.body.trim()) out.push("write the statement");
  const marks = marksProblem(f.marks);
  if (marks) out.push(marks);
  const tags = tagsProblem(f.tags);
  if (tags) out.push(tags);
  if (f.mode === "function") {
    const fn = functionNameProblem(f.functionName);
    if (fn) out.push(fn);
    const params = parametersProblem(f.params.map((p) => p.name), MAX_PARAMS);
    if (params) out.push(params);
  }
  const c = caseCounts(f.cases);
  if (!c.complete) out.push(`fill every expected output (${SAMPLE_CASES - c.sample + HIDDEN_CASES - c.hidden} left)`);
  return out;
}

/** stdin questions send no mode/signature at all (the API default), so their requests are as before. */
const toInput = (f: FormState): QuestionInput => ({
  body: f.body.trim(),
  difficulty: f.difficulty,
  marks: Number(f.marks),
  tags: parseTags(f.tags),
  testCases: toTestCases(f.cases),
  ...(f.mode === "function"
    ? { mode: "function" as const, signature: { functionName: f.functionName.trim(), parameters: f.params.map((p) => ({ name: p.name.trim(), type: p.type })), returnType: f.returnType } }
    : {}),
});

/** Only the fields that changed: a question students answered refuses new test cases, but not a statement fix. */
function changes(now: QuestionInput, was: QuestionInput): Partial<QuestionInput> {
  const patch: Partial<QuestionInput> = {};
  if (now.body !== was.body) patch.body = now.body;
  if (now.difficulty !== was.difficulty) patch.difficulty = now.difficulty;
  if (now.marks !== was.marks) patch.marks = now.marks;
  if (JSON.stringify(now.tags) !== JSON.stringify(was.tags)) patch.tags = now.tags;
  if (JSON.stringify(now.testCases) !== JSON.stringify(was.testCases)) patch.testCases = now.testCases;
  // "stdin" clears the stored signature; "function" needs one, so it is sent whenever the mode switches to it.
  const nowMode = now.mode ?? "stdin";
  const modeChanged = nowMode !== (was.mode ?? "stdin");
  if (modeChanged) patch.mode = nowMode;
  if (nowMode === "function" && (modeChanged || JSON.stringify(now.signature) !== JSON.stringify(was.signature))) patch.signature = now.signature;
  return patch;
}

interface Props {
  /** Edit this question; omitted = create a new one. */
  questionId?: string;
  onClose: () => void;
  onSaved: (q: QuestionSummary, created: boolean) => void;
}

/** Create / edit one coding question: statement, difficulty, marks, tags and exactly 3 sample + 15 hidden cases. */
export function QuestionForm({ questionId, onClose, onSaved }: Props) {
  const existing = useAsync(() => (questionId ? getCodingQuestion(questionId) : Promise.resolve(null)), [questionId]);
  const [form, setForm] = useState<FormState | null>(questionId ? null : blankForm);
  const [original, setOriginal] = useState<FormState | null>(null);
  const [overflow, setOverflow] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string>();
  const [approving, setApproving] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const loaded = questionId ? existing.data : null;
  const isDraft = loaded?.approved === false; // an AI draft: review, then approve

  // The loaded question fills the form once (adjusted during render, not in an effect).
  if (questionId && existing.data && form === null) {
    const f = toForm(existing.data);
    setForm(f);
    setOriginal(f);
    setOverflow(fromTestCases(existing.data.testCases).overflow);
  }

  const set = (patch: Partial<FormState>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const setParam = (i: number, patch: Partial<FormState["params"][number]>) => setForm((f) => (f ? { ...f, params: f.params.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : f));
  const setCase = (kind: keyof CaseSet, i: number, patch: Partial<CaseRow>) =>
    setForm((f) => (f ? { ...f, cases: { ...f.cases, [kind]: f.cases[kind].map((r, j) => (j === i ? { ...r, ...patch } : r)) } } : f));

  const applyPaste = () => {
    const r = parseCasesJson(pasteText);
    if ("error" in r) return setPasteError(r.error);
    set({ cases: r.set });
    setPasteError(undefined);
    setPasteOpen(false);
    setPasteText("");
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setErrors({});
    setFormError(undefined);
    try {
      const body = toInput(form);
      if (questionId && original) {
        const patch = changes(body, toInput(original));
        if (Object.keys(patch).length === 0) return onClose();
        onSaved(await updateCodingQuestion(questionId, patch), false);
      } else {
        onSaved(await createCodingQuestion(body), true);
      }
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  /** Approve, saving any edits in the same PATCH. Only approved questions can be added to a round. */
  const approve = async () => {
    if (!form || !questionId || !original) return;
    setApproving(true);
    setErrors({});
    setFormError(undefined);
    try {
      onSaved(await approveCodingQuestion(questionId, changes(toInput(form), toInput(original))), false);
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      setApproving(false);
    }
  };

  const fail = (e: unknown) => {
    const err = e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", "Couldn't reach the server. Nothing was saved; try again.");
    if (err.code === "VALIDATION_ERROR") setErrors(fieldErrors(err));
    setFormError(err.status === 403 ? "You don't have permission to change this question. Nothing was saved." : codingErrorMessage(err));
  };

  const problems = form ? formProblems(form) : [];
  const dirty = Boolean(form && original && Object.keys(changes(toInput(form), toInput(original))).length);
  const busy = saving || approving;
  const counts = form ? caseCounts(form.cases) : null;
  const isFunction = form?.mode === "function";

  const caseRows = (kind: keyof CaseSet) => {
    const label = kind === "sample" ? "Sample" : "Hidden";
    const offset = kind === "sample" ? 0 : SAMPLE_CASES; // index in the array sent to the API
    return form!.cases[kind].map((r, i) => {
      const err = errors.caseAt?.[offset + i];
      return (
        <div key={i} className={s.caseRow}>
          <span className={s.caseLabel}>
            {label} {i + 1}
          </span>
          <Textarea
            rows={2}
            aria-label={`${label} ${i + 1} input`}
            placeholder={isFunction ? "One JSON value per line, one line per parameter" : "Input (stdin)"}
            value={r.input}
            onChange={(e) => setCase(kind, i, { input: e.target.value })}
          />
          <div>
            <Textarea
              rows={2}
              aria-label={`${label} ${i + 1} expected output`}
              placeholder={isFunction ? "Return value (JSON)" : "Expected output"}
              value={r.expected}
              aria-invalid={err ? true : undefined}
              onChange={(e) => setCase(kind, i, { expected: e.target.value })}
            />
            {err && (
              <p role="alert" className={s.error}>
                {err}
              </p>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        side
        className={s.panel}
        title={isDraft ? "Review AI draft" : questionId ? "Edit coding question" : "New coding question"}
        description="The first line of the statement is shown to students as the title."
        footer={
          form && (
            <>
              <Button variant="secondary" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button variant={isDraft ? "secondary" : "primary"} disabled={problems.length > 0 || approving} loading={saving} onClick={() => void save()}>
                {questionId ? "Save changes" : "Create question"}
              </Button>
              {isDraft && (
                <Button disabled={problems.length > 0 || saving} loading={approving} onClick={() => void approve()}>
                  {dirty ? "Save & approve" : "Approve"}
                </Button>
              )}
            </>
          )
        }
      >
        {!form ? (
          existing.error ? (
            existing.error.status === 403 ? (
              <ForbiddenState />
            ) : (
              <ErrorState message={codingErrorMessage(existing.error)} onRetry={existing.reload} />
            )
          ) : (
            <>
              <LoadingLabel label="Loading question" />
              <Skeleton style={{ height: 320 }} />
            </>
          )
        ) : (
          <div className={h.stack}>
            {isDraft && (
              <div className={h.row}>
                <Badge tone="info">Draft (AI)</Badge>
                <Badge tone="warning">Not approved</Badge>
                <span className={h.xs}>Check the statement and cases, then approve it to use it in a round.</span>
              </div>
            )}
            {loaded?.referenceSolution && (
              <section aria-labelledby="ref-h">
                <div className={h.between}>
                  <h3 id="ref-h" className={s.subTitle} style={{ marginBottom: 0 }}>
                    Reference solution ({loaded.referenceLanguage ?? "python"})
                  </h3>
                  <Button size="sm" variant="secondary" aria-expanded={showRef} onClick={() => setShowRef((v) => !v)}>
                    <Code2 aria-hidden size={14} style={{ marginRight: 4 }} /> {showRef ? "Hide reference solution" : "Show reference solution"}
                  </Button>
                </div>
                <p className={h.xs}>{DRAFT_NOTE} The solution itself can&apos;t be edited.</p>
                {showRef && (
                  <div className={student.editorWrap} style={{ marginTop: 8 }}>
                    <CodeEditor
                      value={loaded.referenceSolution}
                      language={loaded.referenceLanguage ?? "python"}
                      onChange={noop}
                      readOnly
                      label="Reference solution"
                      path={`reference/${loaded.id}`}
                    />
                  </div>
                )}
              </section>
            )}
            <Field
              label="Statement"
              hint={isFunction ? "First line = title. Describe what the function gets and must return." : "First line = title. Describe the input and output format."}
              error={errors.body}
            >
              <Textarea rows={8} value={form.body} onChange={(e) => set({ body: e.target.value })} />
            </Field>
            <div className={s.formGrid}>
              <Field label="Difficulty" error={errors.difficulty}>
                <Select value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value as Difficulty })}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d[0]!.toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Marks" error={errors.marks}>
                <Input type="number" min={0.01} max={999} step={0.5} value={form.marks} onChange={(e) => set({ marks: e.target.value })} />
              </Field>
              <Field label="Tags" hint="Comma separated, up to 10." error={errors.tags}>
                <Input value={form.tags} placeholder="arrays, strings" onChange={(e) => set({ tags: e.target.value })} />
              </Field>
            </div>

            <Field
              label="Mode"
              hint={isFunction ? "Students write one function; a fixed driver calls it for each case." : "Students write a whole program that reads stdin and prints to stdout."}
              error={errors.mode}
            >
              <Select value={form.mode} onChange={(e) => set({ mode: e.target.value as CodingMode })}>
                <option value="stdin">Full program (stdin / stdout)</option>
                <option value="function">Function (LeetCode style)</option>
              </Select>
            </Field>

            {isFunction && (
              <section aria-labelledby="sig-h" className={h.cardTight}>
                <h3 id="sig-h" className={s.subTitle}>
                  Function signature
                </h3>
                <p className={h.xs} style={{ marginBottom: 12 }}>
                  Starter code for all six languages is generated from this. Each case input is one JSON value per line, one line per parameter in this order; the
                  expected output is the return value.
                </p>
                <div className={s.formGrid}>
                  <Field label="Function name" hint="lowerCamelCase, e.g. twoSum">
                    <Input value={form.functionName} className={h.mono} onChange={(e) => set({ functionName: e.target.value })} />
                  </Field>
                  <Field label="Return type">
                    <Select value={form.returnType} onChange={(e) => set({ returnType: e.target.value as ParamType })}>
                      {PARAM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <h4 className={h.small} style={{ marginTop: 16, marginBottom: 8, fontWeight: 500 }}>
                  Parameters ({form.params.length}/{MAX_PARAMS}, in call order)
                </h4>
                {form.params.map((p, i) => (
                  <div key={i} className={s.paramRow}>
                    <Input aria-label={`Parameter ${i + 1} name`} className={h.mono} placeholder="nums" value={p.name} onChange={(e) => setParam(i, { name: e.target.value })} />
                    <Select aria-label={`Parameter ${i + 1} type`} value={p.type} onChange={(e) => setParam(i, { type: e.target.value as ParamType })}>
                      {PARAM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-label={`Remove parameter ${i + 1}`}
                      disabled={form.params.length === 1}
                      onClick={() => set({ params: form.params.filter((_, j) => j !== i) })}
                    >
                      <Trash2 aria-hidden size={14} />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="secondary" disabled={form.params.length >= MAX_PARAMS} onClick={() => set({ params: [...form.params, { name: "", type: "int" }] })}>
                  <Plus aria-hidden size={14} style={{ marginRight: 4 }} /> Add parameter
                </Button>
                {errors.signature && (
                  <p role="alert" className={s.error}>
                    {errors.signature}
                  </p>
                )}
              </section>
            )}

            <section aria-labelledby="cases-h">
              <div className={h.between}>
                <h3 id="cases-h" className={s.subTitle} style={{ marginBottom: 0 }}>
                  Test cases
                </h3>
                <span className={h.row}>
                  <Badge tone={counts!.complete ? "success" : "warning"}>
                    <span aria-live="polite">
                      {counts!.sample}/{SAMPLE_CASES} sample, {counts!.hidden}/{HIDDEN_CASES} hidden
                    </span>
                  </Badge>
                  <Button size="sm" variant="secondary" aria-expanded={pasteOpen} onClick={() => setPasteOpen((o) => !o)}>
                    <ClipboardPaste aria-hidden size={14} style={{ marginRight: 4 }} /> Paste cases as JSON
                  </Button>
                </span>
              </div>
              {overflow > 0 && <p className={h.xs}>This question had {overflow} more case(s) than 3 + 15; only the first ones are shown and saving keeps just these.</p>}
              {errors.cases && (
                <p role="alert" className={s.error}>
                  {errors.cases}
                </p>
              )}
              {pasteOpen && (
                <div className={h.cardTight} style={{ marginTop: 12 }}>
                  <Field label="Cases JSON" hint={`Exactly ${SAMPLE_CASES} with "sample": true and ${HIDDEN_CASES} with "sample": false. This replaces all 18 rows.`}>
                    <Textarea rows={6} className={h.mono} placeholder={PASTE_EXAMPLE} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
                  </Field>
                  {pasteError && (
                    <p role="alert" className={s.error}>
                      {pasteError}
                    </p>
                  )}
                  <div className={h.row} style={{ marginTop: 8 }}>
                    <Button size="sm" disabled={!pasteText.trim()} onClick={applyPaste}>
                      Fill the 18 rows
                    </Button>
                  </div>
                </div>
              )}
              <h4 className={h.small} style={{ marginTop: 16, fontWeight: 500 }}>
                Sample cases: students see these and Run uses them
              </h4>
              {caseRows("sample")}
              <h4 className={h.small} style={{ marginTop: 16, fontWeight: 500 }}>
                Hidden cases: used for scoring, never shown to students
              </h4>
              {caseRows("hidden")}
            </section>

            {problems.length > 0 && <p className={h.xs}>To save: {problems.join(" · ")}.</p>}
            {formError && (
              <p role="alert" className={s.error}>
                {formError}
                {errors.other ? ` (${errors.other})` : ""}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
