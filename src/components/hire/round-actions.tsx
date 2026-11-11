"use client";

import { Mail, SkipForward, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { pct, roundResults, useStore } from "@/mock/store";
import type { Round } from "@/mock/types";
import { hire as h } from "./ui";

const scored = (r: Round) => r.type === "aptitude" || r.type === "coding" || r.type === "ai_interview";

/** Advance (with cut-off preview), send emails, skip — the HR controls for one round. */
export function RoundActions({ round }: { round: Round }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [threshold, setThreshold] = useState(round.threshold ?? (round.type === "ai_interview" ? 70 : 60));
  const [template, setTemplate] = useState("Round invite");

  const results = roundResults(state, round.id);
  const shortlisted = state.candidates.filter((c) => c.driveId === round.driveId && c.shortlisted).length;
  const wouldPass =
    round.type === "shortlist"
      ? shortlisted
      : scored(round)
        ? results.filter((r) => r.status === "passed" || (pct(r) ?? -1) >= threshold).length
        : results.filter((r) => r.status === "passed" || r.status === "selected").length;
  const unfinished = results.filter((r) => r.status === "invited" || r.status === "in_progress").length;
  const invited = results.filter((r) => r.status === "invited").length;

  if (round.status === "completed" || round.status === "skipped") return null;

  return (
    <div className={h.row}>
      {round.status === "active" && (
        <>
          <Button size="sm" onClick={() => setAdvanceOpen(true)}>
            <TrendingUp aria-hidden size={14} style={{ marginRight: 4 }} /> {round.type === "final" ? "Close drive" : "Advance"}
          </Button>
          <Button size="sm" variant="secondary" disabled={invited === 0} onClick={() => setEmailOpen(true)}>
            <Mail aria-hidden size={14} style={{ marginRight: 4 }} /> Email invites
          </Button>
        </>
      )}
      {round.type !== "shortlist" && round.type !== "final" && (
        <Button size="sm" variant="tertiary" onClick={() => setSkipOpen(true)}>
          <SkipForward aria-hidden size={14} style={{ marginRight: 4 }} /> Skip
        </Button>
      )}

      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent
          title={`Advance from ${round.title}`}
          description={round.type === "shortlist" ? "Shortlisted candidates are invited to the next round." : scored(round) ? "Candidates at or above the cut-off move to the next round and get an email." : "Candidates you marked passed/selected move on."}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAdvanceOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  dispatch({ type: "advanceRound", roundId: round.id, threshold: scored(round) ? threshold : undefined });
                  setAdvanceOpen(false);
                  toast({ tone: "success", title: `${wouldPass} candidate(s) advanced`, description: "Invite emails queued for the next round." });
                }}
              >
                Advance {wouldPass}
              </Button>
            </>
          }
        >
          <div className={h.stackSm}>
            {scored(round) && (
              <Field label="Cut-off (% of max score)">
                <Input type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
              </Field>
            )}
            <p>
              <strong>{wouldPass}</strong> of {round.type === "shortlist" ? state.candidates.filter((c) => c.driveId === round.driveId).length : results.length} will advance.
            </p>
            {unfinished > 0 && <p className={h.xs}>{unfinished} candidate(s) haven&apos;t finished — they will be marked not advanced.</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent
          title="Email invites"
          description={`Sends the round link to ${invited} invited candidate(s) who haven't started.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEmailOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  dispatch({ type: "sendEmails", roundId: round.id, template });
                  setEmailOpen(false);
                  toast({ tone: "success", title: `Sent to ${invited} candidate(s)` });
                }}
              >
                Send {invited} emails
              </Button>
            </>
          }
        >
          <Field label="Template">
            <Select value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option>Round invite</option>
              <option>Reminder: test closes soon</option>
              <option>Interview slot</option>
            </Select>
          </Field>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={skipOpen}
        onOpenChange={setSkipOpen}
        title={`Skip ${round.title}?`}
        description={round.status === "active" ? "Everyone currently in this round moves straight to the next round." : "This round will be left out of the drive."}
        confirmLabel="Skip round"
        onConfirm={() => {
          dispatch({ type: "skipRound", roundId: round.id });
          setSkipOpen(false);
          toast({ tone: "info", title: "Round skipped" });
        }}
      />
    </div>
  );
}
