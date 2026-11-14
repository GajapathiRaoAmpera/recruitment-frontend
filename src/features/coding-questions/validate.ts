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

// Function-mode signature (contract: Function-mode coding questions). The server also refuses names that are keywords or
// predeclared in any of the six languages and x / xSize / xColSize pairs; those come back as a 422 shown on the form.
const LOWER_CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const MAX_NAME = 40;

export function functionNameProblem(name: string): string | undefined {
  const n = name.trim();
  if (!LOWER_CAMEL.test(n) || !/[A-Z]/.test(n) || n.length > MAX_NAME || n.startsWith("drv"))
    return "name the function in lowerCamelCase with at least one capital letter (e.g. twoSum)";
}

export function parametersProblem(names: string[], max: number): string | undefined {
  const list = names.map((n) => n.trim());
  if (list.length < 1 || list.length > max) return `use 1 to ${max} parameters`;
  if (list.some((n) => !LOWER_CAMEL.test(n) || n.length > MAX_NAME || n.startsWith("drv"))) return "name every parameter in lowerCamelCase (letters and digits, e.g. nums)";
  if (new Set(list).size !== list.length) return "give each parameter a different name";
}
