import type { Level, PaperSettings, Section } from "@/features/papers/types";

export const LEVELS: readonly Level[] = ["easy", "medium", "advanced"];
export const SECTION_KEYS: readonly Section[] = ["aptitude", "reasoning", "technical"];

/** Mirrors backend builder.split_by_percent: largest remainder, ties keep key order. */
export function splitByPercent<K extends string>(total: number, weights: Record<K, number>, keys: readonly K[]): Record<K, number> {
  const sum = keys.reduce((a, k) => a + weights[k], 0);
  const out = Object.fromEntries(keys.map((k) => [k, sum ? Math.floor((total * weights[k]) / sum) : 0])) as Record<K, number>;
  if (!sum) return out;
  const left = total - keys.reduce((a, k) => a + out[k], 0);
  [...keys].sort((a, b) => ((total * weights[b]) % sum) - ((total * weights[a]) % sum)).slice(0, left).forEach((k) => (out[k] += 1));
  return out;
}

/** Questions each student's paper needs per level and section (backend builder.needed). */
export const needed = (s: PaperSettings) =>
  Object.fromEntries(LEVELS.map((l) => [l, splitByPercent(s.counts[l], s.mix, SECTION_KEYS)])) as Record<Level, Record<Section, number>>;
