import { afterEach, expect, it, vi } from "vitest";
import { entryStep, entryVerify } from "./entry";

afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

it("verifies Student ID + DOB and maps the session", async () => {
  const f = vi.fn().mockResolvedValue(reply({ entry_token: "T", candidate: { full_name: "Asha Rao" }, rounds: [{ round_id: "r1", type: "aptitude", test_id: null }] }));
  vi.stubGlobal("fetch", f);
  const s = await entryVerify(" S101 ", "2003-05-01");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ student_id: "S101", dob: "2003-05-01" });
  expect(new Headers(f.mock.calls[0]![1].headers).has("Authorization")).toBe(false);
  expect(s).toEqual({ entryToken: "T", studentId: "S101", fullName: "Asha Rao", rounds: [{ roundId: "r1", type: "aptitude", testId: null }] });
});

it("shows the API's mismatch message and a network failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ error: { code: "ENTRY_MISMATCH", message: "Student ID or date of birth does not match", details: {} } }, 401)));
  await expect(entryVerify("S1", "2000-01-01")).rejects.toMatchObject({ status: 401, code: "ENTRY_MISMATCH", message: "Student ID or date of birth does not match" });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
  await expect(entryVerify("S1", "2000-01-01")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
});

it("records a step with the entry token as bearer", async () => {
  const f = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", f);
  await entryStep("T", "r1", "location", true, { lat: 1 });
  expect(new Headers(f.mock.calls[0]![1].headers).get("Authorization")).toBe("Bearer T");
  expect(JSON.parse(f.mock.calls[0]![1].body)).toEqual({ round_id: "r1", step: "location", ok: true, meta: { lat: 1 } });
});
