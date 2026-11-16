import { describe, expect, it } from "vitest";
import { driveIdFrom, resolveLink, suggestionsFor, topics } from "./knowledge";
import { reply } from "./match";

describe("reply", () => {
  it.each([
    ["how do I create a new drive?", "create-drive"],
    ["upload the google form sheet", "import-candidates"],
    ["how to shortlist by CGPA", "shortlist"],
    ["build aptitude paper", "build-paper"],
    ["where can I see the interview transcript", "interviews"],
    ["download pdf report", "report"],
    ["I am new HR, what is the process end to end", "getting-started"],
    ["set the cut-off and advance to next round", "advance"],
    ["student switched tabs, integrity alert", "integrity-alerts"],
    ["how to add new hr", "team-access"],
    ["how to send test link to students", "invites"],
    ["how to select final candidates", "decisions"],
    ["help", "getting-started"],
  ])("%s -> %s", (q, id) => {
    expect(reply(q, "HR", "/hr").topicId).toBe(id);
  });

  it("fills the drive id from the current page", () => {
    const r = reply("shortlist candidates", "HR", "/hr/drives/d-42/rounds/r1");
    expect(r.links).toContainEqual({ label: "This drive's candidates", href: "/hr/drives/d-42/candidates" });
  });

  it("falls back to the drive list outside a drive", () => {
    const r = reply("shortlist candidates", "HR", "/hr");
    expect(r.links).toContainEqual({ label: "Pick a drive", href: "/hr/drives" });
  });

  it("navigation requests return one direct link", () => {
    expect(reply("take me to analytics", "HR", "/hr").links).toEqual([{ label: "Analytics", href: "/hr/analytics" }]);
    expect(reply("open the candidates", "HR", "/hr/drives/abc").links).toEqual([{ label: "Candidates", href: "/hr/drives/abc/candidates" }]);
  });

  it("hides admin topics and destinations from HR", () => {
    expect(reply("audit logs", "HR", "/hr").topicId).not.toBe("admin");
    expect(reply("audit logs", "SUPER_ADMIN", "/hr").topicId).toBe("admin");
    expect(reply("go to audit logs", "HR", "/hr").links.some((l) => l.href.startsWith("/admin"))).toBe(false);
  });

  it("greets and handles unknown questions", () => {
    expect(reply("hii", "HR", "/hr").followUps).toContain("getting-started");
    const r = reply("what's the weather in Paris", "HR", "/hr");
    expect(r.topicId).toBeUndefined();
    expect(r.followUps.length).toBeGreaterThan(0);
  });

  it("follow-ups never repeat the answered topic", () => {
    const r = reply("create drive", "HR", "/hr");
    expect(r.followUps).not.toContain("create-drive");
  });
});

describe("knowledge", () => {
  it("topic ids are unique and related ids exist", () => {
    const ids = topics.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of topics) for (const r of t.related ?? []) expect(ids).toContain(r);
  });

  it("every link points inside the app", () => {
    for (const t of topics) for (const l of t.links) expect(l.href.startsWith("/")).toBe(true);
  });

  it("reads the drive id but not /hr/drives/new", () => {
    expect(driveIdFrom("/hr/drives/abc/ranking")).toBe("abc");
    expect(driveIdFrom("/hr/drives/new")).toBeNull();
    expect(driveIdFrom("/hr/drives")).toBeNull();
    expect(resolveLink({ label: "X", href: "/hr/drives/{driveId}" }, null)).toBeNull();
  });

  it("suggests per page", () => {
    expect(suggestionsFor("/hr/drives/abc/rounds/r1", "HR").topics.map((t) => t.id)).toContain("advance");
    expect(suggestionsFor("/hr/papers/new", "HR").label).toBe("papers");
    expect(suggestionsFor("/hr", "HR").topics.length).toBeGreaterThan(0);
  });
});
