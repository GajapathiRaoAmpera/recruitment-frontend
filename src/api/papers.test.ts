import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }), signOut: async () => ({ error: null }) } },
}));

import { ApiError } from "./client";
import { acceptDraft, aiStatus, createDraft, editQuestion, getDraft, listDrafts, sendPapers } from "./papers";

afterEach(() => vi.unstubAllGlobals());

const settings = {
  track: "it" as const,
  counts: { easy: 5, medium: 3, advanced: 2 },
  mix: { aptitude: 40, reasoning: 30, technical: 30 },
  itSyntaxPercent: 50,
  poolFactor: 2,
  durationMin: 60,
  differentPerStudent: true,
  shuffleQuestions: true,
  shuffleOptions: true,
};
const wireDraft = {
  id: "d-1", drive_ref: "d1", owner_id: "u-1", title: "T", track: "it", status: "generating",
  settings: { track: "it", counts: settings.counts, mix: settings.mix, it_syntax_percent: 50, pool_factor: 2, duration_min: 60, different_per_student: true, shuffle_questions: true, shuffle_options: true },
  progress: { done: 1, total: 4 }, error: null, pool_size: 0, created_at: "2026-01-01T00:00:00Z", accepted_at: null, persisted_at: null,
};

type Call = [string, RequestInit];
function stub(body: unknown, status = 200) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const call = (fn: ReturnType<typeof stub>) => fn.mock.calls[0] as unknown as Call;

it("maps snake_case and surfaces ApiError code/message", async () => {
  const fetchMock = stub(wireDraft, 201);
  const d = await createDraft({ driveRef: "d1", title: "T", settings });
  const [url, init] = call(fetchMock);
  expect(url).toBe("/api/v1/papers/drafts");
  expect(init.method).toBe("POST");
  const sent = JSON.parse(init.body as string);
  expect(sent.drive_ref).toBe("d1");
  expect(sent.settings).toMatchObject({ it_syntax_percent: 50, pool_factor: 2, different_per_student: true, track: "it" });
  expect(d).toMatchObject({ driveRef: "d1", ownerId: "u-1", poolSize: 0, progress: { done: 1, total: 4 }, settings: { itSyntaxPercent: 50, durationMin: 60 } });

  stub({ error: { code: "AI_PROVIDER_NOT_CONFIGURED", message: "Gemini key missing", details: { providers: ["gemini"] } } }, 503);
  const err = await createDraft({ driveRef: "d1", title: "T", settings }).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 503, code: "AI_PROVIDER_NOT_CONFIGURED", message: "Gemini key missing" });
});

it("maps detail, edits, accept, send and the simple calls", async () => {
  stub({ gemini: true, groq: false });
  expect(await aiStatus()).toEqual({ gemini: true, groq: false });

  stub([wireDraft]);
  expect((await listDrafts())[0].driveRef).toBe("d1");

  stub({
    ...wireDraft, status: "draft", checks: [], overlap: { shared: 3, same_position: 1, total: 10 },
    issues: [{ candidate_ref: "c1", issued_at: "x" }], edited_count: 2,
    sample: [{ id: "q1", level: "easy", section: "aptitude", topic: "t", text: "?", options: ["a", "b", "c", "d"], answer: 1, why: "w", fixed_options: false, edited: true }],
  });
  const detail = await getDraft("d-1");
  expect(detail.overlap).toEqual({ shared: 3, samePosition: 1, total: 10 });
  expect(detail.issues[0].candidateRef).toBe("c1");
  expect(detail.editedCount).toBe(2);
  expect(detail.sample[0]).toMatchObject({ fixedOptions: false, edited: true });

  const patch = stub({ ...wireDraft, status: "draft", checks: [], sample: [], overlap: null, issues: [], edited_count: 0 });
  await editQuestion("d-1", "q1", { text: "t", options: ["a", "b", "c", "d"], answer: 0, why: "w" });
  expect(call(patch)[0]).toBe("/api/v1/papers/drafts/d-1/questions/q1");
  expect(call(patch)[1].method).toBe("PATCH");

  const acc = stub({ ...wireDraft, status: "accepted", accepted_at: "y" });
  expect((await acceptDraft("d-1")).acceptedAt).toBe("y");
  expect(call(acc)[0]).toBe("/api/v1/papers/drafts/d-1/accept");

  const send = stub({ sent: 2, already_sent: 1 });
  expect(await sendPapers("d-1", ["a", "b", "c"])).toEqual({ sent: 2, alreadySent: 1 });
  expect(JSON.parse(call(send)[1].body as string)).toEqual({ candidate_refs: ["a", "b", "c"] });
});
