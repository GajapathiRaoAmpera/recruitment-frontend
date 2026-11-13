// FR-17 coding drafts: which copy of the code a refresh restores, and that keys stay inside one attempt.
import { afterEach, describe, expect, it } from "vitest";
import { clearAttemptDrafts, draftKey, pickRestore, readLocal, writeLocal, type LocalDraft } from "./drafts";

afterEach(() => window.localStorage.clear());

const allowed = ["python", "cpp", "java"];
const local = (over: Partial<LocalDraft> = {}): LocalDraft => ({ language: "python", code: { python: "local py" }, savedAt: 2_000, ...over });

describe("pickRestore", () => {
  it("takes the newer of the local and server drafts", () => {
    expect(pickRestore(allowed, local({ savedAt: 3_000 }), { code: "server", language: "python", savedAt: 2_000 }, undefined)).toMatchObject({ source: "local", code: { python: "local py" } });
    expect(pickRestore(allowed, local({ savedAt: 1_000 }), { code: "server", language: "python", savedAt: 2_000 }, undefined)).toMatchObject({ source: "server", code: { python: "server" } });
  });

  it("a newer server draft keeps this browser's code in the other languages", () => {
    const r = pickRestore(allowed, local({ savedAt: 1_000, code: { python: "old py", cpp: "my cpp" } }), { code: "new java", language: "java", savedAt: 2_000 }, undefined);
    expect(r).toEqual({ language: "java", code: { python: "old py", cpp: "my cpp", java: "new java" }, source: "server" });
  });

  it("uses the last submitted code only when there is no draft at all", () => {
    expect(pickRestore(allowed, null, undefined, { code: "submitted", language: "cpp" })).toEqual({ language: "cpp", code: { cpp: "submitted" }, source: "submitted" });
    expect(pickRestore(allowed, local(), undefined, { code: "submitted", language: "cpp" })).toMatchObject({ source: "local" });
    expect(pickRestore(allowed, null, { code: "server", language: "python", savedAt: 1 }, { code: "submitted", language: "python" })).toMatchObject({ source: "server" });
  });

  it("starts fresh in the first allowed language, and never restores a language the question doesn't allow", () => {
    expect(pickRestore(allowed, null, undefined, undefined)).toEqual({ language: "python", code: {}, source: "new" });
    expect(pickRestore(["java"], local({ language: "python" }), { code: "s", language: "go", savedAt: 9_000 }, { code: "x", language: null })).toEqual({ language: "java", code: {}, source: "new" });
  });
});

describe("browser drafts", () => {
  it("round-trips under attempt:<attempt_id>:q:<question_id>", () => {
    writeLocal("a1", "q1", local());
    expect(window.localStorage.getItem("attempt:a1:q:q1")).not.toBeNull();
    expect(draftKey("a1", "q1")).toBe("attempt:a1:q:q1");
    expect(readLocal("a1", "q1")).toEqual(local());
  });

  it("ignores corrupt drafts", () => {
    window.localStorage.setItem("attempt:a1:q:q1", "{not json");
    expect(readLocal("a1", "q1")).toBeNull();
    window.localStorage.setItem("attempt:a1:q:q2", JSON.stringify({ language: 5 }));
    expect(readLocal("a1", "q2")).toBeNull();
  });

  it("clearing one attempt leaves other attempts (other rounds) and unrelated keys alone", () => {
    writeLocal("a1", "q1", local());
    writeLocal("a1", "q2", local());
    writeLocal("a2", "q1", local());
    window.localStorage.setItem("ampera.sidebar", "1");
    clearAttemptDrafts("a1");
    expect(readLocal("a1", "q1")).toBeNull();
    expect(readLocal("a1", "q2")).toBeNull();
    expect(readLocal("a2", "q1")).not.toBeNull();
    expect(window.localStorage.getItem("ampera.sidebar")).toBe("1");
  });
});
