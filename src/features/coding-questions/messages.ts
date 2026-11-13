import type { ApiError } from "@/api/client";

/** Clear text for every error the coding question and test set-up endpoints can give. */
export function codingErrorMessage(e: ApiError): string {
  switch (e.code) {
    case "QUESTION_IN_USE":
      return "Students have already answered this question, so its test cases can't change. You can still edit the statement, difficulty, tags and marks.";
    case "QUESTION_NOT_FOUND":
      return "This question wasn't found. It may have been removed, or it isn't yours.";
    case "QUESTIONS_NOT_FOUND":
      return "Some questions in this list don't exist any more, aren't coding questions, or aren't yours. Remove the flagged ones and save again.";
    case "QUESTIONS_NOT_APPROVED":
      return "Some questions aren't approved yet. Remove the flagged ones and save again.";
    case "QUESTIONS_INCOMPLETE":
      return "Some questions don't have exactly 3 sample and 15 hidden test cases. Fix them in the question bank, or remove the flagged ones.";
    case "TEST_IN_USE":
      return "A student has already started this test, so its questions can't change any more.";
    case "ROUND_NOT_FOUND":
      return "This round wasn't found. It may have been removed, or it isn't one of your drives.";
    case "ROUND_HAS_NO_TEST":
      return "This type of round has no test to set up.";
    case "TEST_NOT_FOUND":
      return "This round's test isn't set up yet. Save the test settings first; that creates it.";
    case "VALIDATION_ERROR":
      return "Some fields need fixing; see the highlighted fields.";
    default:
      return e.message;
  }
}

/** Why each flagged question was refused, for the badge next to it. */
export const FLAG_LABEL: Record<string, string> = {
  QUESTIONS_NOT_FOUND: "Not found",
  QUESTIONS_NOT_APPROVED: "Not approved",
  QUESTIONS_INCOMPLETE: "Needs 3 + 15 cases",
};

export interface FieldErrors {
  body?: string;
  difficulty?: string;
  marks?: string;
  tags?: string;
  cases?: string; // the set as a whole (e.g. not 3 + 15)
  caseAt?: Record<number, string>; // index into the test_cases array sent (samples first, then hidden)
  other?: string;
}

const clean = (msg: string) => msg.replace(/^Value error, /, "");

/** Maps a 422 VALIDATION_ERROR's details.errors [{loc, msg}] onto the form's fields. */
export function fieldErrors(e: ApiError): FieldErrors {
  const list = Array.isArray(e.details.errors) ? (e.details.errors as { loc?: unknown[]; msg?: string }[]) : [];
  const out: FieldErrors = {};
  for (const { loc = [], msg = "Invalid value" } of list) {
    const path = loc[0] === "body" ? loc.slice(1) : loc; // FastAPI prefixes body fields with "body"
    const [field, index] = path;
    const text = clean(msg);
    if (field === "test_cases" && typeof index === "number") out.caseAt = { ...out.caseAt, [index]: text };
    else if (field === "test_cases") out.cases ??= text;
    else if (field === "body" || field === "difficulty" || field === "marks" || field === "tags") out[field] ??= text;
    else out.other ??= text;
  }
  return out;
}
