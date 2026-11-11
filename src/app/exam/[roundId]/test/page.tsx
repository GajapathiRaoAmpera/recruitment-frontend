"use client";

import { Clock } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NotFoundState } from "@/components/ui/states";
import { hire as h } from "@/components/hire/ui";
import { ExamGuard } from "@/components/student/exam-guard";
import { exitFullscreen, minutesSince, useCountdown, useExamDraft, useExamRound } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { useStore } from "@/mock/store";

interface Answers {
  answers: Record<string, number>;
  marked: string[];
  current: number;
}

export default function AptitudeTestPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const { candidate, round } = useExamRound(roundId);
  if (!round || !candidate || round.type === "coding") return <NotFoundState title="Test not found" />;
  return <Runner roundId={roundId} />;
}

function Runner({ roundId }: { roundId: string }) {
  const router = useRouter();
  const { dispatch } = useStore();
  const { state, candidate, round, result, recorded } = useExamRound(roundId);
  // Students only ever get question text and options — answer keys stay with HR/scoring.
  const questions = state.questions.filter((q) => round!.questionIds?.includes(q.id)).map(({ id, title, body, options, tags, marks }) => ({ id, title, body, options: options!, tags, marks }));
  const { draft, update, clear, savedAt } = useExamDraft<Answers>(`${roundId}:${candidate!.id}`, round!.durationMin ?? 30, { answers: {}, marked: [], current: 0 });
  const [confirm, setConfirm] = useState(false);
  const { answers, marked, current } = draft.data;
  const q = questions[current]!;

  const submit = () => {
    if (recorded) {
      // shortcut: scored in the browser for the prototype; the API scores against keys the browser never sees.
      const score = state.questions.filter((x) => round!.questionIds?.includes(x.id)).reduce((n, x) => n + (draft.data.answers[x.id] === x.answer ? x.marks : 0), 0);
      const max = questions.reduce((n, x) => n + x.marks, 0);
      dispatch({ type: "submitAttempt", roundId, candidateId: candidate!.id, score, maxScore: max, timeTakenMin: minutesSince(draft.startedAt) });
    }
    clear();
    exitFullscreen();
    router.push(`/exam/${roundId}/done`);
  };

  const { left, label } = useCountdown(draft.deadline, submit);
  const go = (i: number) => update((d) => ({ ...d, current: Math.max(0, Math.min(questions.length - 1, i)) }));
  const stateOf = (id: string) => (marked.includes(id) ? "marked" : answers[id] !== undefined ? "answered" : "todo");
  const unanswered = questions.filter((x) => answers[x.id] === undefined).length;

  return (
    <>
      <ExamGuard roundId={roundId} candidateId={candidate!.id} result={result} recorded={recorded} />
      <header className={s.examBar}>
        <Logo height={22} />
        <div className={s.examTitle}>
          <p>{round!.title}</p>
          <p className={s.saved} aria-live="polite">
            {savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Saving…"}
          </p>
        </div>
        {!recorded && <Badge tone="warning">Preview</Badge>}
        <span className={s.timer} data-low={left < 5 * 60_000} role="timer" aria-label={`Time left ${label}`}>
          <Clock aria-hidden size={16} /> {label}
        </span>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Finish & submit
        </Button>
      </header>

      <main className={`${s.examBody} ${s.aptitude}`}>
        <aside className={h.card} aria-label="Question navigator">
          <p className={h.eyebrow} style={{ marginBottom: 12 }}>
            Questions
          </p>
          <div className={s.palette}>
            {questions.map((x, i) => (
              <button key={x.id} type="button" className={s.paletteBtn} data-state={stateOf(x.id)} aria-current={i === current} aria-label={`Question ${i + 1}, ${stateOf(x.id)}`} onClick={() => go(i)}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className={s.legend}>
            <span>■ Answered</span>
            <span>■ Marked</span>
            <span>□ Not answered</span>
          </div>
        </aside>

        <section className={h.card} aria-labelledby="q-h">
          <div className={h.between} style={{ marginBottom: 12 }}>
            <p className={h.eyebrow}>
              Question {current + 1} of {questions.length} · {q.tags.join(", ")}
            </p>
            <Badge>+{q.marks} mark</Badge>
          </div>
          <h1 id="q-h" style={{ fontSize: "1.25rem", lineHeight: 1.5 }}>
            {q.body}
          </h1>
          <fieldset className={h.stackSm} style={{ marginTop: 24 }}>
            <legend className="sr-only">Options</legend>
            {q.options.map((o, i) => (
              <label key={i} className={s.option}>
                <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => update((d) => ({ ...d, answers: { ...d.answers, [q.id]: i } }))} />
                <span>
                  <span className={s.optionKey}>{String.fromCharCode(65 + i)}.</span> {o}
                </span>
              </label>
            ))}
          </fieldset>
          <div className={h.between} style={{ marginTop: 24 }}>
            <Button variant="secondary" disabled={current === 0} onClick={() => go(current - 1)}>
              Previous
            </Button>
            <div className={h.row}>
              <Button variant="tertiary" disabled={answers[q.id] === undefined} onClick={() => update((d) => { const a = { ...d.answers }; delete a[q.id]; return { ...d, answers: a }; })}>
                Clear
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  update((d) => ({ ...d, marked: d.marked.includes(q.id) ? d.marked.filter((x) => x !== q.id) : [...d.marked, q.id] }));
                  go(current + 1);
                }}
              >
                {marked.includes(q.id) ? "Unmark" : "Mark for review"} & next
              </Button>
              <Button disabled={current === questions.length - 1} onClick={() => go(current + 1)}>
                Save & next
              </Button>
            </div>
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        destructive={false}
        title="Submit your test?"
        description={unanswered ? `${unanswered} question(s) are unanswered. You can't change answers after submitting.` : "You can't change answers after submitting."}
        confirmLabel="Submit test"
        onConfirm={() => {
          setConfirm(false);
          submit();
        }}
      />
    </>
  );
}
