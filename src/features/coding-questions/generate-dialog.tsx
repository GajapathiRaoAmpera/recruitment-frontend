"use client";

import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { DIFFICULTIES, generateCodingQuestions, isSqlQuestion, MODE_LABEL, titleOf, type CodingMode, type Difficulty, type GenerateResult } from "@/api/coding-questions";
import { hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { label, SqlBadge } from "./bank-picker";
import s from "./coding-questions.module.scss";
import { codingErrorMessage, failureReasons, fieldErrors } from "./messages";
import { marksProblem, MAX_TOPIC_CHARS, parseTags, tagsProblem } from "./validate";

export const LOADING_TEXT = "Writing and checking questions… this can take up to a minute or two.";
const MODE_HINT: Record<CodingMode, string> = {
  stdin: "Students write a whole program that reads stdin and prints to stdout.",
  function: "Students write one function; a fixed driver calls it for each case.",
  sql: "Students write a SQLite query. The AI writes the tables and data; expected rows come from running its reference query.",
};
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

interface Props {
  onClose: () => void;
  /** Called after every finished request (success, failure with drafts possibly saved, or timeout): reload the bank. */
  onGenerated: () => void;
  /** Open one created draft in the review form. */
  onReview: (id: string) => void;
}

/** "Generate with AI": asks POST /questions/generate for 1-3 drafts and shows what was created and what failed. */
export function GenerateDialog({ onClose, onGenerated, onReview }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [topic, setTopic] = useState("");
  const [tags, setTags] = useState("");
  const [marks, setMarks] = useState("10");
  const [count, setCount] = useState(1);
  const [mode, setMode] = useState<CodingMode>("stdin");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false); // a double click must not send two requests

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const topicError = topic.trim().length > MAX_TOPIC_CHARS ? `keep the topic to ${MAX_TOPIC_CHARS} characters` : undefined;
  const problems = [topicError, tagsProblem(tags), marksProblem(marks)].filter((p): p is string => Boolean(p));

  const generate = async () => {
    if (inFlight.current || problems.length) return;
    inFlight.current = true;
    setBusy(true);
    setElapsed(0);
    setError(undefined);
    setResult(null);
    try {
      // "stdin" is the API default and is left out, so a Standard request is exactly as before.
      const typed = mode === "stdin" ? {} : { mode };
      setResult(await generateCodingQuestions({ difficulty, topic: topic.trim() || undefined, tags: parseTags(tags), marks: Number(marks), count, ...typed }));
      onGenerated();
    } catch (e) {
      if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) {
        setError(codingErrorMessage(new ApiError(0, "GENERATE_TIMEOUT", "")));
        onGenerated(); // the server may still have saved some drafts
      } else {
        const err = e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", "Couldn't reach the server. Check the question bank before trying again.");
        const other = err.code === "VALIDATION_ERROR" ? fieldErrors(err) : {};
        const detail = Object.values(other).filter((v) => typeof v === "string").join("; ");
        setError(codingErrorMessage(err) + (detail ? ` (${detail})` : ""));
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent
        title="Generate with AI"
        description="The AI writes the statement, a reference solution and 3 + 15 test inputs; the solution is run to get each expected output. Drafts need your review and approval."
        footer={
          result ? (
            <>
              <Button variant="secondary" onClick={() => setResult(null)}>
                Generate more
              </Button>
              <Button onClick={onClose}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={problems.length > 0} loading={busy} onClick={() => void generate()}>
                <Sparkles aria-hidden size={14} style={{ marginRight: 4 }} /> {busy ? "Generating…" : "Generate"}
              </Button>
            </>
          )
        }
      >
        {result ? (
          <div role="status" className={h.stackSm}>
            <p className={h.cardTitle}>
              {result.created.length} created, {result.failed.length} failed
            </p>
            {result.created.length > 0 && (
              <ul className={h.list} aria-label="Created drafts">
                {result.created.map((q) => (
                  <li key={q.id} className={h.listItem}>
                    <span className={h.row}>
                      <CheckCircle2 aria-hidden size={16} /> {titleOf(q.body)} {isSqlQuestion(q) && <SqlBadge />}
                    </span>
                    <Button size="sm" variant="secondary" aria-label={`Review ${titleOf(q.body)}`} onClick={() => onReview(q.id)}>
                      Review
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {result.failed.length > 0 && (
              <ul className={h.list} aria-label="Failed questions">
                {result.failed.map((f) => (
                  <li key={f.index} className={h.listItem}>
                    <span className={h.row}>
                      <XCircle aria-hidden size={16} /> {failureReasons([f])}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {result.created.length > 0 && <p className={h.xs}>Drafts are saved as not approved. Review each one, then approve it to add it to a round.</p>}
          </div>
        ) : (
          <div className={h.stack}>
            <div className={s.formGrid}>
              <Field label="Difficulty">
                <Select value={difficulty} disabled={busy} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {label(d)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="How many">
                <Select value={count} disabled={busy} onChange={(e) => setCount(Number(e.target.value))}>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Marks each">
                <Input type="number" min={0.01} max={999} step={0.5} value={marks} disabled={busy} onChange={(e) => setMarks(e.target.value)} />
              </Field>
            </div>
            <Field label="Question type" hint={MODE_HINT[mode]}>
              <Select value={mode} disabled={busy} onChange={(e) => setMode(e.target.value as CodingMode)}>
                {(["stdin", "function", "sql"] as const).map((m) => (
                  <option key={m} value={m}>
                    {MODE_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Topic (optional)" hint={`Up to ${MAX_TOPIC_CHARS} characters, e.g. "string manipulation".`}>
              <Input value={topic} disabled={busy} maxLength={MAX_TOPIC_CHARS + 50} onChange={(e) => setTopic(e.target.value)} />
            </Field>
            <Field label="Tags (optional)" hint="Comma separated, up to 10.">
              <Input value={tags} disabled={busy} placeholder="arrays, strings" onChange={(e) => setTags(e.target.value)} />
            </Field>
            {problems.length > 0 && <p className={h.xs}>To generate: {problems.join(" · ")}.</p>}
            {busy && (
              <div className={h.cardTight} role="status" aria-live="polite">
                <p className={h.small} style={{ fontWeight: 500 }}>
                  {LOADING_TEXT}
                </p>
                <p className={h.xs}>
                  Elapsed {clock(elapsed)}. About 11 seconds per question; keep this open. Drafts are saved even if you leave the page.
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className={s.error}>
                {error}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
