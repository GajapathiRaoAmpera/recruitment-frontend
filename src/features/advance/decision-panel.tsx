"use client";

import { AlertTriangle, CheckCircle2, FileDown } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { ApiError } from "@/api/client";
import { downloadDriveReport } from "@/api/hiring";
import { decideRound, getDecisions, type DecideResult, type Decision, type DecisionRow } from "@/api/rounds";
import { hire as h, RoundStatusBadge } from "@/components/hire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useAsync } from "@/features/papers/use-async";
import a from "./advance.module.scss";
import { fmt } from "./messages";

const INTERVIEW: Record<string, { label: string; tone: "neutral" | "info" | "success" | "danger" }> = {
  scheduled: { label: "Signed in", tone: "neutral" },
  live: { label: "In interview", tone: "info" },
  completed: { label: "Done", tone: "success" },
  failed: { label: "Closed", tone: "danger" },
};
const OUTCOME: Record<string, string> = { passed: "Passed", failed: "Failed", selected: "Selected", rejected: "Rejected" };

/** The AI's 1-5 average, labelled as advice. */
function AiCell({ row }: { row: DecisionRow }) {
  if (row.scoring === "done") return <span>{fmt(row.aiAverage)} / 5</span>;
  if (row.scoring === "pending") return <span className={h.xs}>Scoring…</span>;
  if (row.scoring === "error") return <span className={h.xs}>Scoring failed</span>;
  return <span className={h.xs}>—</span>;
}

export function decideErrorMessage(e: ApiError): string {
  switch (e.code) {
    case "INTERVIEW_LIVE":
      return "Some students are still in their interview. Decide once they finish. Nothing was saved.";
    case "DECISIONS_INCOMPLETE":
      return "The student list changed. Reload and decide every student. Nothing was saved.";
    case "ROUND_ALREADY_DECIDED":
      return "This round was already decided. The final results are shown below.";
    case "ROUND_NOT_ACTIVE":
      return "This round isn't open, so it can't be decided yet.";
    default:
      return e.message;
  }
}

/**
 * HR decision for an AI interview or final round (GET /rounds/{id}/decisions, POST /rounds/{id}/decide).
 * The AI score is shown as a recommendation; HR picks Pass/Fail (Select/Reject on the final round) for every student.
 */
export function DecisionPanel({ roundId, driveId, onDecided }: { roundId: string; driveId: string; onDecided: () => void }) {
  const { data, error, reload } = useAsync(() => getDecisions(roundId), [roundId]);
  const [picks, setPicks] = useState<Record<string, Decision>>({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DecideResult | null>(null);
  const [decideError, setDecideError] = useState<string>();
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string>();
  const titleId = useId();

  if (!data) {
    if (error?.code === "ROUND_NOT_HR_DECIDED") return null;
    if (error) return <ErrorState message={error.message} onRetry={reload} />;
    return (
      <div className={h.stackSm}>
        <LoadingLabel label="Loading students" />
        <Skeleton style={{ height: 160 }} />
      </div>
    );
  }

  const final = data.roundType === "final";
  const [yes, no] = final ? ["Select", "Reject"] : ["Pass", "Fail"];
  const editable = data.roundStatus === "active" && !result;
  const live = data.candidates.filter((c) => c.interviewStatus === "live").length;
  const undecided = data.candidates.filter((c) => !picks[c.candidateId]).length;
  const passCount = data.candidates.filter((c) => picks[c.candidateId] === "pass").length;
  const blockReason = live
    ? `${live} still in their interview. Decide once they finish.`
    : undecided
      ? `Pick ${yes} or ${no} for every student (${undecided} left).`
      : null;

  const getReport = async () => {
    setReportBusy(true);
    setReportError(undefined);
    try {
      await downloadDriveReport(driveId);
    } catch (e) {
      setReportError(e instanceof ApiError ? e.message : "Couldn't create the report. Try again.");
    } finally {
      setReportBusy(false);
    }
  };
  const pick = (id: string, d: Decision) => setPicks((p) => ({ ...p, [id]: d }));
  const confirm = async () => {
    setBusy(true);
    setDecideError(undefined);
    try {
      setResult(await decideRound(roundId, picks));
      setOpen(false);
      onDecided();
      reload();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", "Couldn't reach the server. Nothing was saved; try again.");
      setDecideError(decideErrorMessage(err));
      reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={h.card} aria-labelledby={titleId}>
      <div className={h.stack}>
        <div>
          <div className={h.cardHead}>
            <h2 id={titleId} className={h.cardTitle}>
              {final ? "Final decision" : "Interview decision"}
            </h2>
            <RoundStatusBadge status={data.roundStatus} />
          </div>
          <p className={h.muted}>
            {data.roundStatus === "pending"
              ? "Round not active yet. Decisions open once the earlier rounds are finished."
              : editable
                ? "The AI score is a recommendation. You make the final call for each student."
                : "Decided. Read-only."}
          </p>
        </div>

        {result && (
          <div role="status" className={a.result}>
            <p className={h.cardTitle}>
              <CheckCircle2 aria-hidden size={18} className={a.resultIcon} />
              {result.driveClosed ? "Drive finished" : "Round decided"}
            </p>
            <p className={h.small}>
              {result.passed} {final ? "selected" : "passed"}, {result.failed} {final ? "rejected" : "failed"}.{" "}
              {result.driveClosed
                ? "The drive is closed and its report is ready to share."
                : result.invited.length
                  ? `${result.invited.length} invited to the next round and emailed a sign-in link.`
                  : "Nobody moved on to the next round."}
            </p>
            {result.driveClosed && (
              <>
                <p className={a.resultNote}>
                  <AlertTriangle aria-hidden size={16} />
                  Selected students are not emailed automatically. Tell them the result yourself.
                </p>
                <div className={h.row}>
                  <Button onClick={() => void getReport()} loading={reportBusy}>
                    <FileDown aria-hidden size={16} style={{ marginRight: 6 }} /> Download report
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/hr/drives/${driveId}`}>Back to drive</Link>
                  </Button>
                </div>
                {reportError && <p role="alert" className={h.small}>{reportError}</p>}
              </>
            )}
          </div>
        )}

        {data.candidates.length === 0 ? (
          <EmptyState title="No students in this round" description="Students who pass the previous round show up here." />
        ) : (
          <Table aria-label="Students">
            <thead>
              <tr>
                <Th>Student ID</Th>
                <Th>Name</Th>
                <Th>Interview</Th>
                <Th>AI score (advice)</Th>
                <Th>Decision</Th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map((c) => {
                const st = c.interviewStatus ? INTERVIEW[c.interviewStatus] : undefined;
                return (
                  <tr key={c.candidateId}>
                    <Td className={h.mono}>{c.studentId}</Td>
                    <Td>{c.name}</Td>
                    <Td>
                      {st ? <Badge tone={st.tone}>{st.label}</Badge> : <span className={h.xs}>Not started</span>}{" "}
                      {c.interviewId && (
                        <Link className={h.link} href={`/hr/interviews/${c.interviewId}`}>
                          Transcript
                        </Link>
                      )}
                    </Td>
                    <Td>
                      <AiCell row={c} />
                    </Td>
                    <Td>
                      {editable ? (
                        <div className={h.row} role="group" aria-label={`Decision for ${c.name}`}>
                          <Button size="sm" variant={picks[c.candidateId] === "pass" ? "primary" : "secondary"} aria-pressed={picks[c.candidateId] === "pass"} onClick={() => pick(c.candidateId, "pass")}>
                            {yes}
                          </Button>
                          <Button size="sm" variant={picks[c.candidateId] === "fail" ? "danger" : "secondary"} aria-pressed={picks[c.candidateId] === "fail"} onClick={() => pick(c.candidateId, "fail")}>
                            {no}
                          </Button>
                        </div>
                      ) : OUTCOME[c.status] ? (
                        <Badge tone={c.status === "passed" || c.status === "selected" ? "success" : "danger"}>{OUTCOME[c.status]}</Badge>
                      ) : (
                        <span className={h.xs}>—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        {editable && (
          <div className={h.stackSm}>
            <div className={h.row}>
              <Button onClick={() => (setDecideError(undefined), setOpen(true))} disabled={blockReason !== null}>
                {final ? "Finish drive" : "Confirm decisions"}
              </Button>
            </div>
            {blockReason && <p className={h.xs}>{blockReason}</p>}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent
          title={final ? "Finish this drive?" : "Confirm interview decisions?"}
          description={`${passCount} ${final ? "selected" : "pass"}, ${data.candidates.length - passCount} ${final ? "rejected" : "fail"}.`}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={() => void confirm()} disabled={busy} loading={busy}>
                {final ? "Finish drive" : "Confirm decisions"}
              </Button>
            </>
          }
        >
          <div className={h.stackSm}>
            <p>{final ? "This closes the drive." : "Passed students go to the next round."} This can&apos;t be undone.</p>
            {decideError && (
              <p role="alert" className={a.error}>
                {decideError}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
