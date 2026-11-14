import { describe, expect, it } from "vitest";
import { actionLabel, actionTone, entityLabel, groupActions, roleLabel } from "./audit-labels";

describe("audit labels", () => {
  it("names known codes and still reads well for unknown ones", () => {
    expect(actionLabel("round.advance")).toBe("Advanced round");
    expect(actionLabel("offer.send_batch")).toBe("Offer send batch");
    expect(entityLabel("paper_draft")).toBe("Paper");
    expect(entityLabel("college_partner")).toBe("College partner");
  });

  it("colours by what the action did", () => {
    expect(actionTone("paper_draft.generation_failed")).toBe("danger");
    expect(actionTone("user.delete")).toBe("danger");
    expect(actionTone("drive.create")).toBe("success");
    expect(actionTone("round.advance")).toBe("primary");
    expect(actionTone("user.update")).toBe("info");
    expect(actionTone("something.else")).toBe("neutral");
  });

  it("groups codes by area, areas and labels A-Z", () => {
    expect(groupActions(["user.update", "round.advance", "user.create"])).toEqual([
      { area: "Rounds", codes: ["round.advance"] },
      { area: "Users & access", codes: ["user.create", "user.update"] },
    ]);
  });

  it("role names", () => {
    expect(roleLabel("super_admin")).toBe("Super Admin");
    expect(roleLabel("hr")).toBe("HR");
    expect(roleLabel(null)).toBeNull();
  });
});
