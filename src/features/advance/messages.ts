import type { ApiError } from "@/api/client";
import type { BadgeTone } from "@/components/ui/badge";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Clear text for every refusal POST /rounds/{id}/advance can give (details are the raw wire shape). */
export function advanceErrorMessage(e: ApiError): string {
  switch (e.code) {
    case "ROUND_NOT_FOUND":
      return "This round wasn't found. It may have been removed, or it isn't one of your drives.";
    case "ROUND_ALREADY_ADVANCED":
      return "This round has already been advanced. The final results are shown below.";
    case "ROUND_NOT_ACTIVE":
      return "This round isn't active, so it can't be advanced. Only the current round of a drive can be advanced.";
    case "ROUND_HAS_NO_TEST":
      return "This round has no test, so there is no score to advance on.";
    case "ROUND_STILL_RUNNING": {
      const n = Number((e.details.counts as { still_writing?: unknown } | undefined)?.still_writing);
      const who = Number.isFinite(n) && n > 0 ? `${plural(n, "student is", "students are")} still writing` : "Some students are still writing";
      return `${who}. Advance when every attempt is submitted or out of time. Nothing was saved.`;
    }
    case "NEXT_ROUND_NOT_READY":
      return "The next round is a coding test with no questions yet. Open that round, add its coding questions, then advance. Nothing was saved.";
    case "NOT_STARTED":
      return "Some students haven't started the test yet. Tick \"Mark absent\" to advance anyway, or wait until the test window has closed.";
    case "LOCKED_ATTEMPTS": {
      const list = Array.isArray(e.details.attempts) ? (e.details.attempts as { name?: string; student_id?: string }[]) : [];
      const names = list.map((a) => a.name ?? a.student_id).filter(Boolean).join(", ");
      return `${list.length ? plural(list.length, "attempt is", "attempts are") : "Some attempts are"} locked after tab switches${names ? ` (${names})` : ""}. Tick "Finish locked attempts with their current marks" to include them. Nothing was saved.`;
    }
    default:
      return e.message;
  }
}

export const ATTEMPT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "Still writing", tone: "info" },
  submitted: { label: "Submitted", tone: "success" },
  locked: { label: "Locked", tone: "danger" },
  expired: { label: "Time up", tone: "warning" },
};

/** "12m 05s"; null → "—". */
export function formatDuration(sec: number | null): string {
  if (sec === null) return "—";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

/** Marks and percents: up to 2 decimals, no trailing zeros. */
export const fmt = (n: number | null) => (n === null ? "—" : String(Math.round(n * 100) / 100));
