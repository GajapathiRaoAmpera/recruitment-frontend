import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }), signOut: async () => ({ error: null }) } },
}));

import { ApiError } from "./client";
import { createDraft } from "./papers";
import { deleteBank, downloadBankFile, getAvailability, getBank, listBankQuestions, setApproval, uploadBank } from "./qbank";

afterEach(() => vi.unstubAllGlobals());

type Call = [string, RequestInit];
function stub(body: unknown, status = 200) {
  const fn = vi.fn(async () => (status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status })));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const call = (fn: ReturnType<typeof stub>) => fn.mock.calls[0] as unknown as Call;

const wireBank = {
  id: "b1", name: "Core CS", filename: "core.pdf", sha256: "x", track: "it", notes: null, status: "ready", is_active: true,
  uploaded_by: "u1", embedding_status: "done", created_at: "c", updated_at: "u", question_count: 10, approved_count: 4, can_manage: true,
};

it("maps snake_case but keeps subject names as they are", async () => {
  stub({
    ...wireBank,
    report: { total: 10, by_subject: { "Operating Systems": 6, Computer_Networks: 4 }, by_level: { easy: 10 }, warnings: [], skipped: [] },
    counts: { "Operating Systems": { easy: { total: 6, approved: 2 } } },
  });
  const b = await getBank("b1");
  expect(b).toMatchObject({ isActive: true, embeddingStatus: "done", canManage: true, approvedCount: 4 });
  expect(b.report.bySubject).toEqual({ "Operating Systems": 6, Computer_Networks: 4 });
  expect(b.counts["Operating Systems"]!.easy).toEqual({ total: 6, approved: 2 });

  stub({ track: "it", subjects: { "Database Management Systems": { easy: 3, medium: 0, advanced: 1 } }, by_level: { easy: 3, medium: 0, advanced: 1 }, total: 4 });
  const a = await getAvailability("it");
  expect(Object.keys(a.subjects)).toEqual(["Database Management Systems"]);
  expect(a.byLevel.easy).toBe(3);
});

it("paper settings send subject weights unmapped", async () => {
  const fetchMock = stub({}, 201);
  const settings = {
    track: "it" as const, counts: { easy: 1, medium: 0, advanced: 0 }, mix: { aptitude: 40, reasoning: 30, technical: 30 },
    itSyntaxPercent: 50, poolFactor: 2, durationMin: 60, differentPerStudent: true, shuffleQuestions: true, shuffleOptions: true,
    subjects: { "Operating Systems": 60, "Computer Networks": 40 }, focus: "scheduling",
  };
  await createDraft({ driveRef: "d1", title: "T", settings });
  const sent = JSON.parse(call(fetchMock)[1].body as string);
  expect(sent.settings.subjects).toEqual({ "Operating Systems": 60, "Computer Networks": 40 });
  expect(sent.settings.pool_factor).toBe(2);
});

it("upload sends FormData without a JSON content-type, with the bearer token", async () => {
  const fetchMock = stub(wireBank, 201);
  const file = new File(["%PDF-1.7"], "core.pdf", { type: "application/pdf" });
  const b = await uploadBank({ file, name: "Core CS", track: "it", notes: "  " });
  const [url, init] = call(fetchMock);
  expect(url).toBe("/api/v1/question-banks");
  expect(init.method).toBe("POST");
  expect(init.body).toBeInstanceOf(FormData);
  const form = init.body as FormData;
  expect(form.get("name")).toBe("Core CS");
  expect(form.get("track")).toBe("it");
  expect(form.has("notes")).toBe(false); // blank notes not sent
  const headers = new Headers(init.headers);
  expect(headers.get("Content-Type")).toBeNull();
  expect(headers.get("Authorization")).toBe("Bearer tok");
  expect(b.canManage).toBe(true);
});

it("surfaces ApiError code, message and details", async () => {
  stub({ error: { code: "DUPLICATE_FILE", message: "Already uploaded as 'Core CS'.", details: { existing_id: "b1", existing_name: "Core CS" } } }, 409);
  const err = await uploadBank({ file: new File(["x"], "a.pdf"), name: "n", track: "it" }).catch((e) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({ status: 409, code: "DUPLICATE_FILE", details: { existing_id: "b1" } });
});

it("builds query strings, approval bodies, delete and download", async () => {
  const q = stub({ items: [], total: 0, page: 2, page_size: 25 });
  await listBankQuestions("b1", { subject: "Operating Systems", level: "easy", approved: false, page: 2, pageSize: 25 });
  expect(call(q)[0]).toBe("/api/v1/question-banks/b1/questions?subject=Operating+Systems&level=easy&approved=false&page=2&page_size=25");

  const ap = stub({ changed: 2, question_count: 10, approved_count: 6 });
  expect(await setApproval("b1", { approved: true, scope: "ids", questionIds: ["q1", "q2"] })).toEqual({ changed: 2, questionCount: 10, approvedCount: 6 });
  expect(JSON.parse(call(ap)[1].body as string)).toEqual({ approved: true, scope: "ids", question_ids: ["q1", "q2"] });

  const del = stub(null, 204);
  await expect(deleteBank("b1")).resolves.toBeUndefined();
  expect(call(del)[1].method).toBe("DELETE");

  vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF", { status: 200 })));
  expect((await downloadBankFile("b1")).size).toBe(4);
});
