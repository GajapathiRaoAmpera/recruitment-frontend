"use client";

import { Code2 } from "lucide-react";
import { useState } from "react";
import { getAttemptResult, getTestResults, type ResultAnswer, type ResultCandidate, type ResultQuestion } from "@/api/results";
import { getRoundTest } from "@/api/rounds";
import { hire as h, Person, Tabs } from "@/components/hire/ui";
import student from "@/components/student/student.module.scss";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { ATTEMPT_STATUS, fmt } from "@/features/advance/messages";
import { useAsync } from "@/features/papers/use-async";
// A next/dynamic wrapper: the Monaco bundle is fetched only when the code panel first renders an editor.
import { CodeEditor } from "@/features/test-runner/code-editor";
import s from "./coding-results.module.scss";

const cases = (a: ResultAnswer | undefined) => (a?.submitted && a.total !== null ? `${a.passed ?? 0}/${a.total}` : "—");
const noop = () => {};

function StatusBadge({ status }: { status: string }) {
  const st = ATTEMPT_STATUS[status];
  return st ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge>{status}</Badge>;
}

/** Round 2 (coding) results for HR, read-only: one row per attempt; a row opens that student's submitted code. */
export function CodingResults({ roundId }: { roundId: string }) {
  const { data, error, reload } = useAsync(async () => getTestResults((await getRoundTest(roundId)).id), [roundId]);
  const [selected, setSelected] = useState<ResultCandidate | null>(null);

  const body = (() => {
    if (error?.code === "TEST_NOT_FOUND") return <EmptyState title="No results yet" description="The coding test hasn't been set up for this round." />;
    if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;
    if (!data)
      return (
        <>
          <LoadingLabel label="Loading coding results" />
          <Skeleton style={{ height: 160 }} />
        </>
      );
    if (data.candidates.length === 0) return <EmptyState title="No results yet" description="Results appear once students start the coding test." />;
    return (
      <Table aria-label="Coding results">
        <thead>
          <tr>
            <Th>Student</Th>
            <Th>Status</Th>
            <Th>Score</Th>
            {data.questions.map((q) => (
              <Th key={q.questionId} title={`Question ${q.position}: test cases passed / total`}>
                Q{q.position}
              </Th>
            ))}
            <Th>
              <span className="sr-only">Code</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {data.candidates.map((c) => (
            <tr key={c.attemptId} className={s.row} onClick={() => setSelected(c)}>
              <Td>
                <Person name={c.fullName} meta={c.studentId} />
              </Td>
              <Td>
                <StatusBadge status={c.status} />
              </Td>
              <Td>
                {fmt(c.score)} / {fmt(data.maxScore)}
              </Td>
              {data.questions.map((q) => (
                <Td key={q.questionId} className={h.mono}>
                  {cases(c.answers.find((a) => a.questionId === q.questionId))}
                </Td>
              ))}
              <Td>
                <Button
                  size="sm"
                  variant="tertiary"
                  aria-label={`View code for ${c.fullName}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(c);
                  }}
                >
                  <Code2 aria-hidden size={14} style={{ marginRight: 4 }} /> Code
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    );
  })();

  return (
    <section className={h.card}>
      <div className={h.cardHead}>
        <h2 className={h.cardTitle}>Coding results</h2>
        {data && <span className={h.xs}>Q columns: test cases passed / total</span>}
      </div>
      {body}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && data && (
          <DialogContent side className={s.panel} title={`${selected.fullName}: submitted code`} description={`${selected.studentId} · score ${fmt(selected.score)} / ${fmt(data.maxScore)}`}>
            <SubmittedCode testId={data.testId} attemptId={selected.attemptId} questions={data.questions} />
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}

/** The last submitted code per question (drafts are never shown), one question at a time. */
function SubmittedCode({ testId, attemptId, questions }: { testId: string; attemptId: string; questions: ResultQuestion[] }) {
  const { data, error, reload } = useAsync(() => getAttemptResult(testId, attemptId), [testId, attemptId]);
  const [tab, setTab] = useState(questions[0]?.questionId ?? "");

  if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data)
    return (
      <>
        <LoadingLabel label="Loading submitted code" />
        <Skeleton style={{ height: 240 }} />
      </>
    );
  if (questions.length === 0) return <EmptyState title="No coding questions in this test" />;

  const q = questions.find((x) => x.questionId === tab) ?? questions[0]!;
  const sub = data.submissions.find((x) => x.questionId === q.questionId);
  return (
    <div>
      <Tabs label="Questions" tabs={questions.map((x) => ({ id: x.questionId, label: `Q${x.position}` }))} value={q.questionId} onChange={setTab} />
      <div className={s.meta}>
        <StatusBadge status={data.status} />
        {sub?.submitted ? (
          <>
            <span className={h.small}>{sub.language ?? "Unknown language"}</span>
            <span className={h.small}>
              Test cases {sub.passed ?? 0}/{sub.total ?? 0}
            </span>
            <span className={h.small}>
              Marks {fmt(sub.marksEarned)} / {fmt(q.marks)}
            </span>
            {sub.updatedAt && <span className={h.xs}>Submitted {new Date(sub.updatedAt).toLocaleString()}</span>}
          </>
        ) : null}
      </div>
      {sub?.submitted && sub.code !== null ? (
        <div className={student.editorWrap}>
          <CodeEditor value={sub.code} language={sub.language ?? "python"} onChange={noop} readOnly label={`Submitted code for question ${q.position}`} path={`results/${attemptId}/${q.questionId}`} />
        </div>
      ) : (
        <EmptyState title="Not submitted" description="This student didn't submit code for this question." />
      )}
    </div>
  );
}
