import { describe, expect, it } from "vitest";
import { LOOP, PHASES, STUDENTS, phaseAt, slot, studentAt } from "./story";

const visible = (t: number) => Array.from({ length: STUDENTS }, (_, i) => studentAt(i, t)).filter(Boolean);
const settled = (key: string) => PHASES.find((p) => p.key === key)!.start + 4.4; // every walk in a phase is over by then

describe("campus drive storyboard", () => {
  it("runs the funnel 12 → 9 → 7 → 5 → 3", () => {
    expect(visible(settled("resume"))).toHaveLength(12);
    expect(visible(settled("aptitude"))).toHaveLength(9);
    expect(visible(settled("coding"))).toHaveLength(7);
    expect(visible(settled("interview"))).toHaveLength(5);
    expect(visible(LOOP - 0.01)).toHaveLength(3);
  });

  it("seats everyone in their room once the walk is over", () => {
    const t = settled("aptitude");
    for (let i = 0; i < STUDENTS; i++) {
      const pose = studentAt(i, t);
      if (pose) expect(pose).toMatchObject({ ...slot(phaseAt(t), i), walking: false });
    }
  });

  it("walks students along the corridor between rooms", () => {
    const mid = studentAt(0, PHASES[3].start + 1)!;
    expect(mid.walking).toBe(true);
  });
});
