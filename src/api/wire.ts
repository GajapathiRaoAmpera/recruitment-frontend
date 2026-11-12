// The single place wire snake_case <-> app camelCase is mapped. Wire keys are lower snake_case identifiers
// (enum values such as "non_it" are values, never keys), so a structural key map is safe.
// Exception: maps keyed by data (subject names) must not be mapped; callers pass those through `raw`.
const toCamelKey = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toSnakeKey = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function mapKeys(value: unknown, fn: (k: string) => string, raw: ReadonlySet<string> = new Set()): unknown {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, fn, raw));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), raw.has(k) ? v : mapKeys(v, fn, raw)]));
  }
  return value;
}

/** `raw` = wire keys whose values are kept as they are (data-keyed maps such as subject → counts). */
export const fromWire = <T>(v: unknown, raw?: ReadonlySet<string>) => mapKeys(v, toCamelKey, raw) as T;
export const toWire = (v: unknown, raw?: ReadonlySet<string>) => mapKeys(v, toSnakeKey, raw);
export const json = (method: string, body: unknown, raw?: ReadonlySet<string>): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(toWire(body, raw)),
});
