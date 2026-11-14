import type { BadgeTone } from "@/components/ui/badge";

// Readable names for the action codes the backend writes (app/**/audit(...)). Codes not listed here
// still read well through the fallback, so a new backend action never shows up blank.

const ACTIONS: Record<string, string> = {
  "drive.create": "Created drive",
  "candidate.import": "Imported candidates",
  "candidate.shortlist": "Updated shortlist",
  "resume.upload": "Uploaded resumes",
  "resume.attach": "Attached resume",
  "resume.fetch": "Fetched resumes",
  "round.advance": "Advanced round",
  "round.decide": "Recorded round decisions",
  "test.configure": "Configured test",
  "test.set_questions": "Set test questions",
  "question.create": "Created question",
  "question.generate": "Generated AI question",
  "question.update": "Edited question",
  "paper_draft.create": "Started paper",
  "paper_draft.generated": "Paper generated",
  "paper_draft.generation_failed": "Paper generation failed",
  "paper_draft.question_edit": "Edited paper question",
  "paper_draft.selection": "Chose paper questions",
  "paper_draft.accept": "Accepted paper",
  "paper_draft.send": "Sent paper",
  "interview.evaluate": "Re-ran interview scoring",
  "interview.notes": "Saved interview notes",
  "user.create": "Invited user",
  "user.update": "Updated user",
  "user.delete": "Deleted user",
};

const ENTITIES: Record<string, string> = {
  drive: "Drive",
  round: "Round",
  candidate: "Candidate",
  interview: "Interview",
  paper_draft: "Paper",
  question: "Question",
  questions: "Question",
  test: "Test",
  tests: "Test",
  users: "User",
  user: "User",
};

/** Area names for grouping the Event type filter (the part of the code before the dot). */
const AREAS: Record<string, string> = {
  drive: "Drives",
  candidate: "Candidates",
  resume: "Resumes",
  round: "Rounds",
  test: "Tests",
  question: "Question bank",
  paper_draft: "Papers",
  interview: "Interviews",
  user: "Users & access",
};

const words = (s: string) => s.replace(/[_.]+/g, " ").trim();
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function actionLabel(code: string): string {
  if (ACTIONS[code]) return ACTIONS[code];
  const [area, ...rest] = code.split(".");
  return sentence(words(`${area} ${rest.join(" ")}`));
}

export function entityLabel(entity: string): string {
  return ENTITIES[entity] ?? sentence(words(entity));
}

export function areaLabel(code: string): string {
  const area = code.split(".")[0];
  return AREAS[area] ?? sentence(words(area));
}

/** Colour by what the action did: failures/deletes red, creates green, edits blue, pipeline moves brand. */
export function actionTone(code: string): BadgeTone {
  const verb = code.split(".").slice(1).join(".");
  if (/fail|delete|remove|reject/.test(verb)) return "danger";
  if (/create|generate|import|upload|attach|fetch/.test(verb)) return "success";
  if (/advance|decide|send|accept|shortlist/.test(verb)) return "primary";
  if (/update|edit|configure|set_|selection|notes|evaluate/.test(verb)) return "info";
  return "neutral";
}

/** Action codes grouped by area for <optgroup>s, areas and codes A-Z by their readable names. */
export function groupActions(codes: string[]): { area: string; codes: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const c of codes) {
    const a = areaLabel(c);
    groups.set(a, [...(groups.get(a) ?? []), c]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([area, list]) => ({ area, codes: list.sort((x, y) => actionLabel(x).localeCompare(actionLabel(y))) }));
}

export const roleLabel = (r: "hr" | "super_admin" | null) => (r === "super_admin" ? "Super Admin" : r === "hr" ? "HR" : null);
