import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }), signOut: async () => ({ error: null }) } },
}));

import { fetchResumes, importCandidates, listCandidates, shortlist } from "./hiring";

afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stub = (...replies: Response[]) => {
  const f = vi.fn();
  replies.forEach((r) => f.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", f);
  return f;
};

it("imports the sheet as multipart with the bearer token", async () => {
  const f = stub(reply({ created: 2, updated: 0, errors: [{ row: 3, message: "Email is not valid" }] }));
  const res = await importCandidates("d1", new File(["x"], "form.xlsx"));
  const [url, init] = f.mock.calls[0]!;
  expect(url).toBe("/api/v1/drives/d1/candidates/import");
  expect((init.body as FormData).get("sheet")).toBeInstanceOf(File);
  expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
  expect(new Headers(init.headers).has("Content-Type")).toBe(false); // the browser must set the multipart boundary
  expect(res.errors[0]).toEqual({ row: 3, message: "Email is not valid" });
});

it("surfaces the API's error message", async () => {
  stub(reply({ error: { code: "MISSING_COLUMNS", message: "Sheet has no column for: dob", details: {} } }, 422));
  await expect(importCandidates("d1", new File(["x"], "f.csv"))).rejects.toMatchObject({ status: 422, code: "MISSING_COLUMNS", message: "Sheet has no column for: dob" });
});

it("lists candidates with filters, follows the cursor and maps names", async () => {
  const row = (id: string) => ({ id, student_id: "S" + id, full_name: "N" + id, email: "e", cgpa: 8.5, skills: ["java"], jd_match: 50, parse_status: "ok", shortlisted: null });
  const f = stub(reply({ items: [row("1")], next_cursor: "200" }), reply({ items: [row("2")], next_cursor: null }));
  const rows = await listCandidates("d1", { skills: "java, sql", minCgpa: 7, minMatch: 60, shortlisted: false });
  expect(rows.map((r) => [r.studentId, r.fullName, r.jdMatch])).toEqual([["S1", "N1", 50], ["S2", "N2", 50]]);
  const first = new URL(f.mock.calls[0]![0], "http://x").searchParams;
  expect([first.get("skills"), first.get("min_cgpa"), first.get("min_match"), first.get("shortlisted")]).toEqual(["java, sql", "7", "60", "false"]);
  expect(new URL(f.mock.calls[1]![0], "http://x").searchParams.get("cursor")).toBe("200");
});

it("shortlist returns how many were updated; fetchResumes maps the statuses", async () => {
  const f = stub(reply({ updated: 1, moved: 1 }), reply({ results: [{ candidate_id: "c1", student_id: "S1", status: "not_accessible" }] }));
  expect(await shortlist("d1", ["c1", "c2"], true)).toEqual({ updated: 1, moved: 1 });
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ candidate_ids: ["c1", "c2"], shortlisted: true });
  expect(await fetchResumes("d1")).toEqual([{ candidateId: "c1", studentId: "S1", status: "not_accessible" }]);
  expect(f.mock.calls[1]![0]).toBe("/api/v1/drives/d1/resumes/fetch?refetch=false");
});

it("sends the chosen rounds when creating a drive", async () => {
  const { createDrive } = await import("./hiring");
  const f = stub(reply({ id: "d1", company: "C", campus: "K", role_title: "R", jd_text: "J", status: "draft", candidates: 0 }));
  await createDrive({ company: "C", campus: "K", roleTitle: "R", jdText: "J", rounds: [{ type: "shortlist", mode: "auto" }, { type: "aptitude", mode: "auto", threshold: 60 }] });
  expect(JSON.parse(f.mock.calls[0]![1].body).rounds).toEqual([{ type: "shortlist", mode: "auto" }, { type: "aptitude", mode: "auto", threshold: 60 }]);
});

it("sends the chosen owner only when given, maps who runs a drive, and reassigns with PATCH", async () => {
  const { createDrive, reassignDrive } = await import("./hiring");
  const row = { id: "d1", company: "C", campus: "K", role_title: "R", jd_text: "J", status: "draft", candidates: 0, owner_id: "hr-1", owner_name: "Priya" };
  let f = stub(reply(row));
  const d = await createDrive({ company: "C", campus: "K", roleTitle: "R", jdText: "J", rounds: [], ownerId: "hr-1" });
  expect(JSON.parse(f.mock.calls[0]![1].body).owner_id).toBe("hr-1");
  expect(d).toMatchObject({ ownerId: "hr-1", ownerName: "Priya" });
  f = stub(reply(row));
  await createDrive({ company: "C", campus: "K", roleTitle: "R", jdText: "J", rounds: [] });
  expect(JSON.parse(f.mock.calls[0]![1].body)).not.toHaveProperty("owner_id");
  f = stub(reply({ ...row, owner_id: "hr-2", owner_name: "Sneha" }));
  expect(await reassignDrive("d1", "hr-2")).toMatchObject({ ownerName: "Sneha" });
  expect(f.mock.calls[0]![0]).toBe("/api/v1/drives/d1/owner");
  expect(f.mock.calls[0]![1].method).toBe("PATCH");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ owner_id: "hr-2" });
});
