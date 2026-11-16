import { outcomeOf } from "@/features/hiring/round-outcome";

// Pure scoring for the Analytics page: turns each student's raw round results into skill scores (0-100)
// and one performance index. No API calls here, so every number can be unit-tested.

export type SkillKey = "aptitude" | "problemSolving" | "technical" | "communication" | "timeManagement" | "integrity";

export interface SkillInfo {
  key: SkillKey;
  label: string;
  /** Share of the performance index (renormalised over the skills a student actually has). */
  weight: number;
  source: string;
  formula: string;
}

export const SKILLS: SkillInfo[] = [
  { key: "aptitude", label: "Aptitude", weight: 0.2, source: "Aptitude round", formula: "Average percent score across aptitude rounds." },
  {
    key: "problemSolving",
    label: "Problem solving",
    weight: 0.3,
    source: "Coding round + AI interview",
    formula: "Average of the share of coding test cases passed and the AI interview's problem-solving rating (x20).",
  },
  { key: "technical", label: "Technical depth", weight: 0.2, source: "AI interview + technical round", formula: "Average of the AI technical-depth rating (x20) and technical-round percent." },
  { key: "communication", label: "Communication", weight: 0.1, source: "AI interview", formula: "AI communication rating out of 5, scaled to 100." },
  {
    key: "timeManagement",
    label: "Time management",
    weight: 0.1,
    source: "Time taken in timed rounds",
    formula: "100 minus 0.6 x the share of the allotted time used, averaged over timed rounds the student scored in.",
  },
  { key: "integrity", label: "Integrity", weight: 0.1, source: "Tab switches in timed rounds", formula: "100 minus 25 per tab switch (3 switches lock the test)." },
];

export type SkillScores = Record<SkillKey, number | null>;

export interface RoundMeta {
  id: string;
  type: string;
  position: number;
  status: string;
  /** Allotted minutes x 60, for timed rounds. */
  durationSec: number | null;
  testId: string | null;
}

export interface StudentRound {
  roundId: string;
  type: string;
  /** round_candidates.status: invited, passed, failed, absent, selected, rejected ... */
  status: string;
  percent: number | null;
  /** Share of coding test cases passed (0-100) when the round is a coding test. */
  codingPercent: number | null;
  timeSec: number | null;
  /** timeSec as a share of the allotted time, 0-100. */
  timeUsedPct: number | null;
  tabSwitches: number;
  rank: number | null;
  attempted: boolean;
}

/** AI interview ratings, each 1-5. */
export interface AiRatings {
  communication: number;
  technicalDepth: number;
  problemSolving: number;
  culture: number;
}

export interface StudentRaw {
  id: string;
  studentId: string;
  name: string;
  rounds: StudentRound[];
  ai: AiRatings | null;
}

export interface Student extends StudentRaw {
  skills: SkillScores;
  /** Weighted skill average, 0-100; null when nothing has been scored yet. */
  index: number | null;
  /** Rounds cleared (passed / selected). */
  cleared: number;
  /** Rounds the student was invited to. */
  reached: number;
}

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

export function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function stdev(values: number[]): number | null {
  const m = mean(values);
  return m === null || values.length < 2 ? null : Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

const TIMED = new Set(["aptitude", "coding", "technical"]);

export function computeSkills(s: StudentRaw): SkillScores {
  const of = (type: string) => s.rounds.filter((r) => r.type === type);
  const timed = s.rounds.filter((r) => TIMED.has(r.type));
  const ai = s.ai;

  const aptitude = mean(of("aptitude").map((r) => r.percent));
  const problemSolving = mean([...of("coding").map((r) => r.codingPercent ?? r.percent), ai ? ai.problemSolving * 20 : null]);
  const technical = mean([ai ? ai.technicalDepth * 20 : null, ...of("technical").map((r) => r.percent)]);
  const communication = ai ? ai.communication * 20 : null;
  // Only rounds the student actually scored in: a blank paper handed in early is not "good time management".
  const timeManagement = mean(timed.filter((r) => r.timeUsedPct !== null && (r.percent ?? 0) > 0).map((r) => clamp(100 - 0.6 * (r.timeUsedPct as number))));
  const integrity = timed.some((r) => r.attempted) ? clamp(100 - 25 * timed.reduce((n, r) => n + r.tabSwitches, 0)) : null;

  return { aptitude, problemSolving, technical, communication, timeManagement, integrity };
}

/** Weighted average over the skills that have a score; the weights are renormalised so a missing skill doesn't count as zero. */
export function performanceIndex(skills: SkillScores): number | null {
  let sum = 0;
  let weight = 0;
  for (const k of SKILLS) {
    const v = skills[k.key];
    if (v !== null) {
      sum += v * k.weight;
      weight += k.weight;
    }
  }
  return weight ? sum / weight : null;
}

export function buildStudents(raws: StudentRaw[]): Student[] {
  return raws.map((r) => {
    const skills = computeSkills(r);
    return {
      ...r,
      skills,
      index: performanceIndex(skills),
      cleared: r.rounds.filter((x) => outcomeOf(x.status) === "cleared").length,
      reached: r.rounds.length,
    };
  });
}

/** Share of students (0-100) scoring below `value`, counting half of any ties. */
export function percentile(value: number, all: number[]): number {
  if (!all.length) return 0;
  const below = all.filter((x) => x < value).length;
  const same = all.filter((x) => x === value).length;
  return ((below + same / 2) / all.length) * 100;
}

export function cohortSkills(students: Student[]): SkillScores {
  const out = {} as SkillScores;
  for (const k of SKILLS) out[k.key] = mean(students.map((s) => s.skills[k.key]));
  return out;
}

/** Score bands used by the distribution chart: [label, from, to) with the top band closed at 100. */
export const BANDS: { label: string; from: number; to: number }[] = [
  { label: "Below 40%", from: 0, to: 40 },
  { label: "40-59%", from: 40, to: 60 },
  { label: "60-79%", from: 60, to: 80 },
  { label: "80-100%", from: 80, to: 101 },
];

export interface RoundStats {
  roundId: string;
  /** Students invited to the round. */
  entered: number;
  /** Students who cleared it (passed / selected). */
  cleared: number;
  /** Students who took it and have a percent score. */
  scored: number;
  avg: number | null;
  best: number | null;
  avgTimeUsedPct: number | null;
  /** Student counts per BANDS entry. */
  bands: number[];
}

/** A student's score in one round on a 0-100 scale: the percent for test rounds, the average AI rating (x20) for the AI interview. */
export function roundScore(s: Student, roundId: string): number | null {
  const r = s.rounds.find((x) => x.roundId === roundId);
  if (!r) return null;
  if (r.type === "ai_interview") return s.ai ? (mean([s.ai.communication, s.ai.technicalDepth, s.ai.problemSolving, s.ai.culture]) as number) * 20 : null;
  return r.percent;
}

export function roundStats(students: Student[], roundId: string): RoundStats {
  const rows = students.flatMap((s) => s.rounds.filter((r) => r.roundId === roundId));
  const pcts = students.flatMap((s) => {
    const v = roundScore(s, roundId);
    return v === null ? [] : [v];
  });
  return {
    roundId,
    entered: rows.length,
    cleared: rows.filter((r) => outcomeOf(r.status) === "cleared").length,
    scored: pcts.length,
    avg: mean(pcts),
    best: pcts.length ? Math.max(...pcts) : null,
    avgTimeUsedPct: mean(rows.map((r) => r.timeUsedPct)),
    bands: BANDS.map((b) => pcts.filter((p) => p >= b.from && p < b.to).length),
  };
}

/** Rank (1 = best) of each student by performance index; students without an index are left out. */
export function rankByIndex(students: Student[]): Map<string, number> {
  const ranked = students.filter((s) => s.index !== null).sort((a, b) => (b.index as number) - (a.index as number));
  return new Map(ranked.map((s, i) => [s.id, i + 1]));
}

/** Plain-language strengths and gaps: skills at least `gap` points above / below the comparison. */
export function insights(skills: SkillScores, against: SkillScores, gap = 8): { strengths: SkillKey[]; gaps: SkillKey[] } {
  const strengths: SkillKey[] = [];
  const gaps: SkillKey[] = [];
  for (const k of SKILLS) {
    const a = skills[k.key];
    const b = against[k.key];
    if (a === null || b === null) continue;
    if (a - b >= gap) strengths.push(k.key);
    else if (b - a >= gap) gaps.push(k.key);
  }
  return { strengths, gaps };
}
