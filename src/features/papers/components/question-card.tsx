import { CheckCircle2, Pencil } from "lucide-react";
import { hire as h } from "@/components/hire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KeyItem } from "@/features/papers/types";
import s from "./papers.module.scss";

export const letter = (i: number) => String.fromCharCode(65 + i);
const cap = (v: string) => v[0]!.toUpperCase() + v.slice(1);

/** Plain text with ``` fenced blocks rendered as monospace code. Model output is shown as text, never as HTML. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/```[^\n]*\n?/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <pre key={i} className={s.codeBlock}>
            <code>{p.replace(/\n$/, "")}</code>
          </pre>
        ) : (
          p.trim() && (
            <p key={i} className={s.questionText}>
              {p.trim()}
            </p>
          )
        ),
      )}
    </>
  );
}

export function QuestionCard({ q, n, onEdit }: { q: KeyItem; n: number; onEdit?: () => void }) {
  return (
    <li className={s.question} aria-labelledby={`q-${q.id}`}>
      <div className={s.questionHead}>
        <span className={h.row}>
          <strong id={`q-${q.id}`}>Q{n}</strong>
          <span className={h.chip}>{cap(q.level)}</span>
          <span className={h.chip}>{cap(q.section)}</span>
          {q.topic && <span className={h.xs}>{q.topic}</span>}
        </span>
        <span className={h.row}>
          <Badge tone="success">Verified</Badge>
          {q.edited && <Badge tone="info">Edited</Badge>}
          {onEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit} aria-label={`Edit question ${n}`}>
              <Pencil aria-hidden size={14} style={{ marginRight: 4 }} /> Edit
            </Button>
          )}
        </span>
      </div>
      <RichText text={q.text} />
      <ol className={s.options} aria-label={`Options for question ${n}`}>
        {q.options.map((o, i) => (
          <li key={i} data-correct={i === q.answer}>
            <span className={s.letter}>{letter(i)}.</span>
            <span style={{ flex: 1 }}>{o}</span>
            {i === q.answer && (
              <>
                <CheckCircle2 aria-hidden size={16} className={s.ok} />
                <span className="sr-only">(correct answer)</span>
              </>
            )}
          </li>
        ))}
      </ol>
      <details className={s.why}>
        <summary>Why</summary>
        <p>{q.why}</p>
      </details>
    </li>
  );
}
