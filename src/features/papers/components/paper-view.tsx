import type { KeyItem } from "@/features/papers/types";
import s from "./papers.module.scss";
import { QuestionCard } from "./question-card";

/** One sample paper, in the order a student would see it. `onEdit` is omitted once the paper is locked. */
export function PaperView({ items, onEdit }: { items: KeyItem[]; onEdit?: (q: KeyItem) => void }) {
  return (
    <ol className={s.paper} aria-label="Sample paper">
      {items.map((q, i) => (
        <QuestionCard key={q.id} q={q} n={i + 1} onEdit={onEdit && (() => onEdit(q))} />
      ))}
    </ol>
  );
}
