"use client";

import { AlertTriangle, CheckCircle2, Clock, UserX, XCircle } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { ApiError } from "@/api/client";
import { advanceRound, getRanking, type AdvanceResult, type RankingRow } from "@/api/rounds";
import { hire as h, RoundStatusBadge, StatCard } from "@/components/hire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, Td, Th } from "@/components/ui/table";
import { useAsync } from "@/features/papers/use-async";
import a from "./advance.module.scss";
import { advanceErrorMessage, ATTEMPT_STATUS, fmt, formatDuration } from "./messages";
import { useDebouncedValue } from "./use-debounced-value";

export const DEFAULT_THRESHOLD = 60; // same default as the prototype when the round has no saved cut-off
export const PREVIEW_DEBOUNCE_MS = 400;

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Refusals after which the preview is out of date and must be fetched again. */
const STALE_CODES = new Set(["ROUND_ALREADY_ADVANCED", "ROUND_NOT_ACTIVE", "ROUND_STILL_RUNNING", "LOCKED_ATTEMPTS", "NOT_STARTED"]);

const notStarted = (row: RankingRow) => row.attemptStatus === null || row.attemptStatus === "not_started";

/** `open`: the round is still running, so a student with no attempt hasn't started yet; only an advanced round makes them absent. */
function ResultCell({ row, open }: { row: RankingRow; open: boolean }) {
  if (open && notStarted(row)) return <Badge tone="neutral">Not started</Badge>;
  if (row.wouldPass === true) return <Badge tone="success">Pass</Badge>;
  if (row.wouldPass === false) return notStarted(row) ? <Badge tone="neutral">Absent</Badge> : <Badge tone="danger">Fail</Badge>;
  const st = row.attemptStatus ? ATTEMPT_STATUS[row.attemptStatus] : undefined;
  return st ? <Badge tone={st.tone}>{st.label}</Badge> : <span className={h.xs}>—</span>;
}

/**
 * Cut-off preview + Advance for one test round (aptitude / coding / technical), from GET /rounds/{id}/ranking and
 * POST /rounds/{id}/advance. Active rounds get the slider; completed rounds show the final ranking read-only.
 */
export function AdvancePanel({ roundId, driveId, onAdvanced }: { roundId: string; driveId?: string; onAdvanced: () => void }) {
  const [threshold, setThreshold] = useState<number | null>(null); // null until the saved cut-off is known
  const [typed, setTyped] = useState<string | null>(null); // the number box while it is being edited
  const query = useDebouncedValue(threshold, PREVIEW_DEBOUNCE_MS);
  const { data, error, loading, reload } = useAsync(() => getRanking(roundId, query ?? undefined), [roundId, query]);
  const [result, setResult] = useState<AdvanceResult | null>(null);
  const [open, setOpen] = useState(false);
  const [finalize, setFinalize] = useState(false);
  const [markAbsent, setMarkAbsent] = useState(false); // students who never started block Advance until ticked
  const [busy, setBusy] = useState(false);
  const [advanceError, setAdvanceError] = useState<string>();
  const [setupRound, setSetupRound] = useState<string>(); // NEXT_ROUND_NOT_READY: the coding round to set up
  const reasonId = useId();

  // First answer (sent without a threshold) carries the saved cut-off: start the slider there, else at 60%.
  if (threshold === null && data?.roundStatus === "active" && !result) setThreshold(clamp(data.threshold ?? DEFAULT_THRESHOLD));

  if (!data) {
    if (error?.code === "ROUND_HAS_NO_TEST") return null;
    if (error) return <ErrorState message={error.message} onRetry={reload} />;
    return <RocketLoader label="Loading ranking" />;
  }

  const title = (
    <div className={h.cardHead}>
      <h2 className={h.cardTitle}>Cut-off &amp; advance</h2>
      <RoundStatusBadge status={data.roundStatus} />
    </div>
  );

  if (data.roundStatus === "pending" || data.roundStatus === "skipped") {
    return (
      <section className={h.card}>
        {title}
        <p className={h.muted}>
          Round not active yet.{" "}
          {data.roundStatus === "skipped" ? "This round was skipped." : "The cut-off and Advance appear once the earlier rounds are advanced."}
        </p>
      </section>
    );
  }

  const editable = data.roundStatus === "active" && !result;
  const value = threshold ?? DEFAULT_THRESHOLD;
  const { counts } = data;
  const lockedRows = data.candidates.filter((c) => c.attemptStatus === "locked");
  const synced = !loading && !error && query === threshold && data.threshold === threshold;
  const blockReason =
    counts.stillWriting > 0
      ? `${plural(counts.stillWriting, "student is", "students are")} still writing. Advance unlocks when every attempt is submitted or out of time.`
      : error
        ? "The preview couldn't be refreshed, so Advance is off until it loads."
        : !synced
          ? "Updating the preview…"
          : null;
  const canConfirm = editable && !blockReason && (lockedRows.length === 0 || finalize) && (counts.absent === 0 || markAbsent) && !busy;

  const setFrom = (n: number) => setThreshold(clamp(n));
  const openConfirm = () => {
    setAdvanceError(undefined);
    setFinalize(false);
    setMarkAbsent(false);
    setOpen(true);
  };
  const confirm = async () => {
    setBusy(true);
    setAdvanceError(undefined);
    try {
      const r = await advanceRound(roundId, value, finalize, markAbsent);
      setResult(r);
      setOpen(false);
      onAdvanced();
      reload();
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", "Couldn't reach the server. Nothing was saved; try again.");
      setAdvanceError(advanceErrorMessage(err));
      setSetupRound(err.code === "NEXT_ROUND_NOT_READY" && typeof err.details.next_round_id === "string" ? err.details.next_round_id : undefined);
      if (STALE_CODES.has(err.code)) reload();
      if (err.code === "ROUND_ALREADY_ADVANCED") onAdvanced();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={h.card} aria-labelledby={`${reasonId}-title`}>
      <div className={h.stack}>
        <div>
          <div className={h.cardHead}>
            <h2 id={`${reasonId}-title`} className={h.cardTitle}>
              Cut-off &amp; advance
            </h2>
            <RoundStatusBadge status={data.roundStatus} />
          </div>
          {!editable && <p className={h.muted}>{data.threshold === null ? "Final ranking. Read-only." : `Final ranking at a ${fmt(data.threshold)}% cut-off. Read-only.`}</p>}
        </div>

        {result && (
          <div role="status" className={h.cardTight}>
            <p className={h.cardTitle}>
              <CheckCircle2 aria-hidden size={18} style={{ marginRight: 6, verticalAlign: "-3px" }} />
              Round advanced
            </p>
            <p className={h.small}>
              At a {fmt(result.threshold)}% cut-off: {result.passed} passed, {result.failed} failed, {result.absent} absent.
            </p>
            <p className={h.small}>
              {result.nextRoundId === null
                ? "This was the last round, so nobody was invited to another round."
                : `${plural(result.invited.length, "student")} invited to the next round.`}
            </p>
            <p className={h.xs}>Invited students get an email with the sign-in link.</p>
          </div>
        )}

        {editable && (
          <div className={h.stackSm}>
            <div className={a.controls}>
              <label className={h.small}>
                Cut-off: <strong>{value}%</strong>
                <input className={h.range} type="range" min={0} max={100} step={1} value={value} onChange={(e) => setFrom(Number(e.target.value))} />
              </label>
              <Field label="Cut-off (%)">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  value={typed ?? String(value)}
                  onChange={(e) => {
                    setTyped(e.target.value);
                    if (e.target.value.trim() !== "" && Number.isFinite(e.target.valueAsNumber)) setFrom(e.target.valueAsNumber);
                  }}
                  onBlur={() => setTyped(null)}
                />
              </Field>
              <Button onClick={openConfirm} disabled={blockReason !== null} aria-describedby={blockReason ? reasonId : undefined}>
                Advance
              </Button>
            </div>
            {blockReason && (
              <p id={reasonId} className={h.xs}>
                {blockReason}
              </p>
            )}
            {error && <ErrorState message={error.message} onRetry={reload} />}
          </div>
        )}

        <div className={a.counts} role="group" aria-label="Counts at this cut-off">
          <StatCard label="Pass" value={counts.pass ?? "—"} icon={CheckCircle2} />
          <StatCard label="Fail" value={counts.fail ?? "—"} icon={XCircle} />
          <StatCard label={editable ? "Not started" : "Absent"} value={counts.absent} icon={UserX} />
          <StatCard label="Still writing" value={counts.stillWriting} icon={Clock} />
          <StatCard label="Locked" value={counts.locked} icon={AlertTriangle} />
        </div>

        {data.candidates.length === 0 ? (
          <EmptyState title="No candidates in this round" description="Students invited to this round show up here." />
        ) : (
          <Table aria-label="Ranking">
            <thead>
              <tr>
                <Th>Rank</Th>
                <Th>Student ID</Th>
                <Th>Name</Th>
                <Th>Marks</Th>
                <Th>Percent</Th>
                <Th>Time taken</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {data.candidates.map((c) => (
                <tr key={c.candidateId} className={c.wouldPass === false ? a.below : undefined}>
                  <Td>{c.rank === null ? "—" : `#${c.rank}`}</Td>
                  <Td className={h.mono}>{c.studentId}</Td>
                  <Td>{c.name}</Td>
                  <Td>{c.marks === null ? "—" : `${fmt(c.marks)} / ${fmt(c.maxMarks)}`}</Td>
                  <Td>{c.percent === null ? "—" : `${fmt(c.percent)}%`}</Td>
                  <Td>{formatDuration(c.timeTakenSec)}</Td>
                  <Td>
                    <ResultCell row={c} open={editable} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent
          title="Advance this round?"
          description={`Cut-off ${value}%.`}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={() => void confirm()} disabled={!canConfirm} loading={busy}>
                Advance round
              </Button>
            </>
          }
        >
          <div className={h.stackSm}>
            <p>
              {counts.pass ?? 0} pass, {counts.fail ?? 0} fail. Pass students go to the next round. This can&apos;t be undone.
            </p>
            {counts.absent > 0 && (
              <div className={a.locked}>
                <p className={h.small}>
                  <strong>{plural(counts.absent, "student hasn't", "students haven't")} started the test.</strong> Advancing now marks them absent, and
                  they can&apos;t sit it any more. Only do this once the test window has closed.
                </p>
                <label className={a.checkRow}>
                  <input type="checkbox" className={h.check} checked={markAbsent} onChange={(e) => setMarkAbsent(e.target.checked)} />
                  <span className={h.small}>Mark {plural(counts.absent, "student")} absent</span>
                </label>
              </div>
            )}
            {lockedRows.length > 0 && (
              <div className={a.locked}>
                <p className={h.small}>
                  <strong>{plural(lockedRows.length, "locked attempt")}</strong> (closed after tab switches):
                </p>
                <ul className={h.small}>
                  {lockedRows.map((r) => (
                    <li key={r.candidateId}>
                      {r.name} <span className={h.xs}>{r.studentId}</span>
                    </li>
                  ))}
                </ul>
                <label className={a.checkRow}>
                  <input type="checkbox" className={h.check} checked={finalize} onChange={(e) => setFinalize(e.target.checked)} />
                  <span className={h.small}>Finish locked attempts with their current marks</span>
                </label>
                <p className={h.xs}>
                  {finalize
                    ? "They are submitted as they are and marked pass or fail on those marks, on top of the counts above."
                    : "Advance stays off until you tick this: the round can't close while attempts are locked."}
                </p>
              </div>
            )}
            {editable && blockReason && <p className={h.xs}>{blockReason}</p>}
            {advanceError && (
              <p role="alert" className={a.error}>
                {advanceError}{" "}
                {driveId && setupRound && <Link href={`/hr/drives/${encodeURIComponent(driveId)}/rounds/${encodeURIComponent(setupRound)}`}>Set up the coding round</Link>}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
