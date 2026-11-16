import { HIDDEN_CASES, SAMPLE_CASES, type TestCase } from "@/api/coding-questions";

// The 3 sample + 15 hidden test cases of a coding question, as the form edits them.

export interface CaseRow {
  input: string;
  expected: string;
}
export interface CaseSet {
  sample: CaseRow[]; // always SAMPLE_CASES rows
  hidden: CaseRow[]; // always HIDDEN_CASES rows
}

const blank = (): CaseRow => ({ input: "", expected: "" });
const fit = (rows: CaseRow[], n: number) => [...rows.slice(0, n), ...Array.from({ length: Math.max(0, n - rows.length) }, blank)];

export const emptyCaseSet = (): CaseSet => ({ sample: fit([], SAMPLE_CASES), hidden: fit([], HIDDEN_CASES) });

/** A case counts once its expected output isn't blank (the input may be empty: no stdin). */
export const isFilled = (r: CaseRow) => r.expected.trim() !== "";

export function caseCounts(set: CaseSet) {
  const sample = set.sample.filter(isFilled).length;
  const hidden = set.hidden.filter(isFilled).length;
  return { sample, hidden, complete: sample === SAMPLE_CASES && hidden === HIDDEN_CASES };
}

/** Wire order: samples first, then hidden (the server keeps this order as `position`). */
export const toTestCases = (set: CaseSet): TestCase[] => [
  ...set.sample.map((r) => ({ input: r.input, expected: r.expected, isSample: true })),
  ...set.hidden.map((r) => ({ input: r.input, expected: r.expected, isSample: false })),
];

/** From the API (already in position order). `overflow` = cases that didn't fit the 3 + 15 rows. */
export function fromTestCases(cases: TestCase[]): CaseSet & { overflow: number } {
  const pick = (sample: boolean) => cases.filter((c) => c.isSample === sample).map((c) => ({ input: c.input, expected: c.expected }));
  const sample = pick(true);
  const hidden = pick(false);
  return {
    sample: fit(sample, SAMPLE_CASES),
    hidden: fit(hidden, HIDDEN_CASES),
    overflow: Math.max(0, sample.length - SAMPLE_CASES) + Math.max(0, hidden.length - HIDDEN_CASES),
  };
}

export const PASTE_EXAMPLE = `[
  {"input": "1 2", "expected": "3", "sample": true},
  {"input": "5 7", "expected": "12", "sample": false}
]`;

/**
 * The paste box: a JSON array of {"input", "expected", "sample"} with exactly 3 sample + 15 hidden cases.
 * `input` may be omitted (empty stdin); `sample` omitted = hidden.
 */
export function parseCasesJson(text: string): { set: CaseSet } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { error: `That isn't valid JSON (${(e as Error).message}). Paste an array like [{"input": "1 2", "expected": "3", "sample": true}, …].` };
  }
  if (!Array.isArray(data)) return { error: 'Paste a JSON array of cases: [{"input": "1 2", "expected": "3", "sample": true}, …].' };
  const sample: CaseRow[] = [];
  const hidden: CaseRow[] = [];
  for (const [i, item] of data.entries()) {
    const n = i + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) return { error: `Case ${n} must be an object with "input", "expected" and "sample".` };
    const c = item as Record<string, unknown>;
    if (c.input !== undefined && typeof c.input !== "string") return { error: `Case ${n}: "input" must be text (a JSON string).` };
    if (typeof c.expected !== "string" || !c.expected.trim()) return { error: `Case ${n}: "expected" must be non-empty text (a JSON string).` };
    if (c.sample !== undefined && typeof c.sample !== "boolean") return { error: `Case ${n}: "sample" must be true or false.` };
    (c.sample ? sample : hidden).push({ input: (c.input as string | undefined) ?? "", expected: c.expected });
  }
  if (sample.length !== SAMPLE_CASES || hidden.length !== HIDDEN_CASES)
    return { error: `Found ${sample.length} sample and ${hidden.length} hidden cases; a question needs exactly ${SAMPLE_CASES} sample and ${HIDDEN_CASES} hidden.` };
  return { set: { sample, hidden } };
}
