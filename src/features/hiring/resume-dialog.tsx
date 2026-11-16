"use client";

import { useState } from "react";
import { ApiError } from "@/api/client";
import { resumeAttempt, type ProgressRow } from "@/api/hiring";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const MIN = 3;
const MAX = 500;

/** Plain text for every refusal of POST /attempts/{id}/resume. */
export function resumeErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Try again.";
  if (e.status === 403) return "You don't have permission to resume attempts in this drive.";
  switch (e.code) {
    case "ATTEMPT_NOT_FOUND":
      return "This attempt wasn't found. It may have been removed, or it isn't in one of your drives.";
    case "NOT_LOCKED":
      return "This attempt was already changed (resumed or finished), so there is nothing to resume. The list is refreshed.";
    case "ROUND_NOT_ACTIVE":
      return "This round isn't active any more, so its attempts can't be resumed.";
    case "REMAINING_TIME_UNKNOWN":
      return "This attempt has no saved time to restore, so it can't be resumed. Close it from Advance with 'finalize locked' instead.";
    default:
      return e.message;
  }
}

/** HR reopens a tab-switch-locked attempt (AC-7). A reason is required and audited. */
export function ResumeDialog({ row, onClose, onDone }: { row: ProgressRow | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const toast = useToast();
  const short = reason.trim().length < MIN;

  const close = () => {
    setReason("");
    setTouched(false);
    setError(undefined);
    onClose();
  };

  const submit = async () => {
    setTouched(true);
    if (!row?.attemptId || short || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await resumeAttempt(row.attemptId, reason);
      toast({ tone: "success", title: `${row.fullName}'s test is resumed`, description: "They can sign in again and continue." });
      close();
      onDone();
    } catch (e) {
      const msg = resumeErrorMessage(e);
      if (e instanceof ApiError && (e.code === "NOT_LOCKED" || e.code === "ATTEMPT_NOT_FOUND")) {
        // Someone else changed it: the row is out of date, so refresh the list and say why.
        toast({ tone: "info", title: msg });
        close();
        onDone();
      } else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={row !== null} onOpenChange={(o) => !o && !busy && close()}>
      {row && (
        <DialogContent
          title={`Resume ${row.fullName}'s test?`}
          description="The student continues with the time they had left and the tab-switch count restarts at 0."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="secondary" disabled={busy}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" form="resume-form" loading={busy}>
                Resume test
              </Button>
            </>
          }
        >
          <form
            id="resume-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field label="Reason" required hint="Saved in the audit log." error={touched && short ? `Enter a reason of at least ${MIN} characters.` : undefined}>
              <Textarea value={reason} maxLength={MAX} rows={3} onChange={(e) => setReason(e.target.value)} onBlur={() => setTouched(true)} />
            </Field>
            {error && (
              <p role="alert" style={{ marginTop: 12, color: "var(--ui-color-danger)" }}>
                {error}
              </p>
            )}
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
