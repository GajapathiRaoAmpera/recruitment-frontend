import { afterEach, describe, expect, it, vi } from "vitest";
import { dressForInterview, paintSleeves } from "./outfit";

// AC-8 (AI interview screen): the interviewer appears in professional dress.

const fakeCtx = () =>
  new Proxy({} as Record<string | symbol, unknown>, {
    get: (t, k) => (k in t ? t[k] : k === "createLinearGradient" ? () => ({ addColorStop() {} }) : () => {}),
    set: (t, k, v) => ((t[k] = v), true),
  });

const scene = () => {
  const suit = { material: { name: "Human.female_casualsuit01", map: { image: "tshirt", needsUpdate: false } } };
  const skin = { material: { name: "Human.ponytail01", map: { image: "skin", needsUpdate: false } } };
  return { suit, skin, root: { traverse: (fn: (o: never) => void) => [suit, skin, {}].forEach((o) => fn(o as never)) } };
};

afterEach(() => vi.restoreAllMocks());

describe("dressForInterview", () => {
  it("repaints the outfit texture and leaves other materials alone", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(fakeCtx() as never);
    const { suit, skin, root } = scene();
    dressForInterview(root);
    expect(suit.material.map.image).toBeInstanceOf(HTMLCanvasElement);
    expect(suit.material.map.needsUpdate).toBe(true);
    expect(skin.material.map).toEqual({ image: "skin", needsUpdate: false });
  });

  it("keeps the original clothes when 2D canvas is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { suit, root } = scene();
    dressForInterview(root);
    expect(suit.material.map.image).toBe("tshirt");
  });
});

describe("paintSleeves", () => {
  // three vertices per triangle: arm (blazer), wrist (cuff), hand (skin), torso (untouched)
  const weights = { arm: [0, 1, 0], wrist: [0, 0.8, 0.2], hand: [0, 0, 1], torso: [1, 0, 0] };
  const bones = [{ name: "Spine2" }, { name: "LeftForeArm" }, { name: "LeftHand" }];
  const order = ["arm", "wrist", "hand", "torso"] as const;
  const per = order.flatMap((k) => [weights[k], weights[k], weights[k]]);
  const attr = (rows: number[][]) => ({
    count: rows.length,
    getX: (i: number) => rows[i]![0] ?? 0,
    getY: (i: number) => rows[i]![1] ?? 0,
    getZ: (i: number) => rows[i]![2] ?? 0,
    getW: (i: number) => rows[i]![3] ?? 0,
  });
  const mesh = {
    skeleton: { bones },
    geometry: {
      index: null,
      attributes: {
        uv: attr(per.map((_, i) => [i / 12, i / 12])),
        skinIndex: attr(per.map(() => [0, 1, 2, 0])),
        skinWeight: attr(per.map(([a, b, c]) => [a!, b!, c!, 0])),
      },
    },
  };

  it("paints the arm as blazer, the wrist as a shirt cuff, and leaves hands and torso as they are", () => {
    const fills: string[] = [];
    const ctx = fakeCtx() as unknown as CanvasRenderingContext2D & Record<string, unknown>;
    ctx.fill = () => fills.push(ctx.fillStyle as string);
    paintSleeves(ctx, mesh, 1024, 1024);
    expect(fills).toEqual(["#232b38", "#f4f5f7"]);
  });
});
