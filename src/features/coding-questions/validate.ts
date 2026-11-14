// Field checks shared by the question form and the AI generate dialog; they mirror the backend validators.

export const MAX_TAGS = 10;
export const MAX_TAG_CHARS = 40;
export const MAX_TOPIC_CHARS = 200;

/** Comma separated → trimmed, no blanks, no repeats (order kept), as the API cleans them. */
export const parseTags = (t: string) => [...new Set(t.split(",").map((x) => x.trim()).filter(Boolean))];

export function tagsProblem(t: string): string | undefined {
  const tags = parseTags(t);
  if (tags.length > MAX_TAGS || tags.some((x) => x.length > MAX_TAG_CHARS)) return `use at most ${MAX_TAGS} tags of up to ${MAX_TAG_CHARS} characters`;
}

export function marksProblem(m: string): string | undefined {
  const n = Number(m);
  if (!m.trim() || !(n > 0 && n <= 999)) return "set marks above 0 and at most 999";
  if (Math.round(n * 100) !== n * 100) return "use at most 2 decimals in marks";
}
