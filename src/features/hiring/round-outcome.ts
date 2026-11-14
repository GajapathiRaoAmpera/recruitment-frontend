import type { BadgeTone } from "@/components/ui/badge";

// What a student's status in a round means (backend: round_candidates.status).
// passed / selected = cleared the round; failed / rejected / absent = did not; everything else is still open.
const CLEARED = new Set(["passed", "selected"]);
const NOT_CLEARED = new Set(["failed", "rejected", "absent"]);

export type Outcome = "cleared" | "not_cleared" | "open";

export const outcomeOf = (status: string): Outcome => (CLEARED.has(status) ? "cleared" : NOT_CLEARED.has(status) ? "not_cleared" : "open");

export interface OutcomeCounts {
  total: number;
  cleared: number;
  notCleared: number;
  open: number;
}

export function countOutcomes(statuses: string[]): OutcomeCounts {
  const c: OutcomeCounts = { total: statuses.length, cleared: 0, notCleared: 0, open: 0 };
  for (const s of statuses) {
    const o = outcomeOf(s);
    if (o === "cleared") c.cleared += 1;
    else if (o === "not_cleared") c.notCleared += 1;
    else c.open += 1;
  }
  return c;
}

const LABELS: Record<string, string> = {
  invited: "Invited",
  in_progress: "In progress",
  submitted: "Submitted",
  passed: "Passed",
  failed: "Failed",
  absent: "Absent",
  selected: "Selected",
  rejected: "Rejected",
};
export const statusLabel = (status: string) => LABELS[status] ?? status.replaceAll("_", " ");

export const statusTone = (status: string): BadgeTone => {
  const o = outcomeOf(status);
  return o === "cleared" ? "success" : o === "not_cleared" ? "danger" : "neutral";
};
