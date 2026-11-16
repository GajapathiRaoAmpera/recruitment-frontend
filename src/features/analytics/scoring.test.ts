import { describe, expect, it } from "vitest";
import { buildStudents, computeSkills, insights, mean, percentile, performanceIndex, rankByIndex, roundStats, stdev, type StudentRaw, type StudentRound } from "./scoring";

const round = (patch: Partial<StudentRound>): StudentRound => ({
  roundId: "r1",
  type: "aptitude",
  status: "passed",
  percent: null,
  codingPercent: null,
  timeSec: null,
  timeUsedPct: null,
  tabSwitches: 0,
  rank: null,
  attempted: true,
  ...patch,
});
const raw = (id: string, rounds: StudentRound[], ai: StudentRaw["ai"] = null): StudentRaw => ({ id, studentId: id.toUpperCase(), name: `Student ${id}`, rounds, ai });

describe("computeSkills", () => {
  it("scores aptitude from the aptitude round and leaves skills with no source empty", () => {
    const s = computeSkills(raw("a", [round({ percent: 80, timeUsedPct: 50 })]));
    expect(s.aptitude).toBe(80);
    expect(s.problemSolving).toBeNull();
    expect(s.communication).toBeNull();
    expect(s.technical).toBeNull();
  });

  it("problem solving averages coding test cases passed with the AI rating", () => {
    const s = computeSkills(raw("a", [round({ roundId: "c", type: "coding", percent: 50, codingPercent: 70 })], { communication: 4, technicalDepth: 3, problemSolving: 4, culture: 5 }));
    expect(s.problemSolving).toBe(75); // (70 + 80) / 2
    expect(s.communication).toBe(80);
    expect(s.technical).toBe(60);
  });

  it("time management rewards finishing with time to spare and ignores rounds scored zero", () => {
    const fast = computeSkills(raw("a", [round({ percent: 90, timeUsedPct: 25 })]));
    const slow = computeSkills(raw("b", [round({ percent: 90, timeUsedPct: 100 })]));
    const blank = computeSkills(raw("c", [round({ percent: 0, timeUsedPct: 1 })]));
    expect(fast.timeManagement).toBe(85);
    expect(slow.timeManagement).toBe(40);
    expect(blank.timeManagement).toBeNull();
  });

  it("integrity drops 25 points per tab switch and is empty before any test", () => {
    expect(computeSkills(raw("a", [round({ tabSwitches: 2 })])).integrity).toBe(50);
    expect(computeSkills(raw("b", [round({ tabSwitches: 5 })])).integrity).toBe(0);
    expect(computeSkills(raw("c", [round({ attempted: false })])).integrity).toBeNull();
  });
});

describe("performanceIndex", () => {
  it("renormalises the weights over the skills that exist", () => {
    // aptitude 80 (weight .2) and communication 60 (weight .1): (16 + 6) / .3
    expect(performanceIndex({ aptitude: 80, problemSolving: null, technical: null, communication: 60, timeManagement: null, integrity: null })).toBeCloseTo(73.33, 1);
  });
  it("is null when nothing is scored", () => {
    expect(performanceIndex({ aptitude: null, problemSolving: null, technical: null, communication: null, timeManagement: null, integrity: null })).toBeNull();
  });
});

describe("cohort helpers", () => {
  const students = buildStudents([
    raw("a", [round({ roundId: "r1", percent: 90 }), round({ roundId: "r2", type: "coding", status: "failed", percent: 30, codingPercent: 30 })]),
    raw("b", [round({ roundId: "r1", percent: 70, status: "failed" })]),
    raw("c", [round({ roundId: "r1", percent: 55 })]),
  ]);

  it("counts how many entered, cleared and fell in each score band", () => {
    const r1 = roundStats(students, "r1");
    expect(r1).toMatchObject({ entered: 3, cleared: 2, scored: 3, best: 90 });
    expect(r1.avg).toBeCloseTo(71.67, 1);
    expect(r1.bands).toEqual([0, 1, 1, 1]);
  });

  it("counts cleared rounds per student", () => {
    expect(students.find((s) => s.id === "a")).toMatchObject({ cleared: 1, reached: 2 });
  });

  it("ranks by index, best first", () => {
    const ranks = rankByIndex(students);
    expect(ranks.get("c")).toBeGreaterThan(0);
    expect(new Set(ranks.values()).size).toBe(ranks.size);
  });

  it("percentile counts half of any ties", () => {
    expect(percentile(80, [50, 60, 80, 80, 90])).toBe(60); // (2 below + 2 ties / 2) of 5
    expect(percentile(90, [50, 60, 80, 90])).toBe(87.5);
  });
});

describe("maths helpers", () => {
  it("mean skips missing values", () => expect(mean([10, null, 30, undefined])).toBe(20));
  it("stdev needs two values", () => {
    expect(stdev([5])).toBeNull();
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
});

describe("insights", () => {
  it("flags skills 8+ points above or below the comparison", () => {
    const a = { aptitude: 90, problemSolving: 40, technical: 60, communication: null, timeManagement: 70, integrity: 100 };
    const b = { aptitude: 70, problemSolving: 60, technical: 62, communication: 50, timeManagement: 70, integrity: 90 };
    expect(insights(a, b)).toEqual({ strengths: ["aptitude", "integrity"], gaps: ["problemSolving"] });
  });
});
