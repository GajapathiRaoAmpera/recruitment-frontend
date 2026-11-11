import { describe, expect, it } from "vitest";
import { initialState, rank, reducer, roundResults, type State } from "./store";

const find = (s: State, roundId: string, candidateId: string) => s.results.find((r) => r.roundId === roundId && r.candidateId === candidateId)!;

describe("mock store rules", () => {
  it("locks an attempt on the 3rd tab switch and HR resume reopens it (AC-7)", () => {
    const ids = { roundId: "d1-r1", candidateId: "d1-c0" };
    let s = reducer(initialState, { type: "startAttempt", ...ids });
    s = reducer(s, { type: "tabSwitch", ...ids, kind: "tab_switch" });
    s = reducer(s, { type: "tabSwitch", ...ids, kind: "tab_switch" });
    expect(find(s, ids.roundId, ids.candidateId).locked).toBe(false);
    s = reducer(s, { type: "tabSwitch", ...ids, kind: "tab_switch" });
    expect(find(s, ids.roundId, ids.candidateId)).toMatchObject({ locked: true, tabSwitches: 3 });
    s = reducer(s, { type: "tabSwitch", ...ids, kind: "tab_switch" }); // ignored once locked
    expect(find(s, ids.roundId, ids.candidateId).tabSwitches).toBe(3);
    s = reducer(s, { type: "resumeAttempt", ...ids });
    expect(find(s, ids.roundId, ids.candidateId)).toMatchObject({ locked: false, tabSwitches: 0, status: "in_progress" });
  });

  it("advancing with a threshold invites only passers to the next round (AC-4)", () => {
    const s = reducer(initialState, { type: "advanceRound", roundId: "d1-r1", threshold: 70 });
    const r1 = roundResults(s, "d1-r1").filter((r) => r.score !== undefined);
    const passers = r1.filter((r) => (r.score! / r.maxScore!) * 100 >= 70).map((r) => r.candidateId).sort();
    expect(roundResults(s, "d1-r2").map((r) => r.candidateId).sort()).toEqual(passers);
    expect(s.rounds.find((r) => r.id === "d1-r2")!.status).toBe("active");
    expect(s.rounds.find((r) => r.id === "d1-r1")!.status).toBe("completed");
  });

  it("skipping the active round moves everyone to the next round (AC-9)", () => {
    const before = roundResults(initialState, "d1-r1").length;
    const s = reducer(initialState, { type: "skipRound", roundId: "d1-r1" });
    expect(s.rounds.find((r) => r.id === "d1-r1")!.status).toBe("skipped");
    expect(roundResults(s, "d1-r2")).toHaveLength(before);
  });

  it("ranks by score desc then time asc (FR-11)", () => {
    const base = { roundId: "x", status: "submitted" as const, maxScore: 10, tabSwitches: 0, locked: false };
    const ranked = rank([
      { ...base, candidateId: "a", score: 8, timeTakenMin: 20 },
      { ...base, candidateId: "b", score: 9, timeTakenMin: 25 },
      { ...base, candidateId: "c", score: 8, timeTakenMin: 15 },
    ]);
    expect(ranked.map((r) => r.candidateId)).toEqual(["b", "c", "a"]);
  });
});
