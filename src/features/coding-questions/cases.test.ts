// FR-14, AC-5: a coding question has exactly 3 sample + 15 hidden cases; the JSON paste box fills them.
import { describe, expect, it } from "vitest";
import { caseCounts, emptyCaseSet, fromTestCases, parseCasesJson, toTestCases } from "./cases";

const cases = (sample: number, hidden: number) => [
  ...Array.from({ length: sample }, (_, i) => ({ input: `s${i}`, expected: `S${i}`, sample: true })),
  ...Array.from({ length: hidden }, (_, i) => ({ input: `h${i}`, expected: `H${i}`, sample: false })),
];

describe("case counts", () => {
  it("counts a row once its expected output isn't blank (empty input is fine)", () => {
    const set = emptyCaseSet();
    expect(set.sample).toHaveLength(3);
    expect(set.hidden).toHaveLength(15);
    expect(caseCounts(set)).toEqual({ sample: 0, hidden: 0, complete: false });
    set.sample[0] = { input: "", expected: "3" };
    set.hidden[0] = { input: "1", expected: "   " };
    expect(caseCounts(set)).toEqual({ sample: 1, hidden: 0, complete: false });
  });

  it("sends samples first, then hidden; reads them back from the API", () => {
    const parsed = parseCasesJson(JSON.stringify(cases(3, 15)));
    if (!("set" in parsed)) throw new Error(parsed.error);
    expect(caseCounts(parsed.set).complete).toBe(true);
    const wire = toTestCases(parsed.set);
    expect(wire).toHaveLength(18);
    expect(wire.slice(0, 3).every((c) => c.isSample)).toBe(true);
    expect(wire.slice(3).every((c) => !c.isSample)).toBe(true);
    const back = fromTestCases(wire);
    expect([back.sample[2]!.expected, back.hidden[14]!.expected, back.overflow]).toEqual(["S2", "H14", 0]);
  });

  it("pads a short set with blank rows and reports cases that don't fit", () => {
    const back = fromTestCases([...toTestCases(emptyCaseSet()), { input: "", expected: "x", isSample: true }]);
    expect([back.sample.length, back.hidden.length, back.overflow]).toEqual([3, 15, 1]);
  });
});

describe("JSON paste", () => {
  it("accepts exactly 3 sample + 15 hidden; input and sample may be omitted", () => {
    const list = cases(3, 15).map((c, i) => (i === 5 ? { expected: c.expected } : c)); // no input, no sample → hidden, empty stdin
    const r = parseCasesJson(JSON.stringify(list));
    expect("set" in r && r.set.hidden[2]).toEqual({ input: "", expected: "H2" });
  });

  it.each([
    ["not JSON", "[{input: 1}", /^That isn't valid JSON/],
    ["not an array", '{"input": "1"}', /^Paste a JSON array/],
    ["a non-object item", "[1]", /^Case 1 must be an object/],
    ["blank expected", JSON.stringify([{ input: "1", expected: "  ", sample: true }]), /^Case 1: "expected" must be non-empty text/],
    ["numeric input", JSON.stringify([{ input: 5, expected: "5" }]), /^Case 1: "input" must be text/],
    ["a non-boolean sample", JSON.stringify([{ expected: "5", sample: "yes" }]), /^Case 1: "sample" must be true or false/],
    ["too few hidden", JSON.stringify(cases(3, 14)), /^Found 3 sample and 14 hidden cases; a question needs exactly 3 sample and 15 hidden\./],
    ["too many samples", JSON.stringify(cases(4, 15)), /^Found 4 sample and 15 hidden/],
  ])("rejects %s with a clear error", (_, text, msg) => {
    const r = parseCasesJson(text);
    expect("error" in r && r.error).toMatch(msg);
  });
});
