// The CC0 avatar ships in a T-shirt and jeans. This repaints that one garment as a charcoal blazer with notched
// lapels over a white collared shirt, and paints long sleeves with shirt cuffs onto the arms, so the interviewer looks
// dressed for an interview.
// shortcut: textures only, so the sleeves are skin-tight and the T-shirt's sleeve hem still shows as a faint seam;
// swap avatar.glb for a model with a modelled suit to upgrade.

const OUTFIT_MATERIAL = "Human.female_casualsuit01";
const SIZE = 1024;

// Texture layout of this garment, measured with a UV grid: canvas x runs up the body (neckline at the right edge),
// canvas y runs across it with the front centre at 256.
const C = 256; // front centre
const V = 700; // bottom of the shirt opening
const O = 60; // half-width of the opening at the neck

/** Draws the blazer texture. Exported for the test. */
export function paintOutfit(x: CanvasRenderingContext2D) {
  const poly = (pts: [number, number][], fill: string, edge?: string) => {
    x.beginPath();
    pts.forEach(([a, b], i) => (i ? x.lineTo(a, C + b) : x.moveTo(a, C + b)));
    x.closePath();
    x.fillStyle = fill;
    x.fill();
    if (edge) {
      x.strokeStyle = edge;
      x.lineWidth = 2;
      x.stroke();
    }
  };
  const both = (pts: [number, number][], fill: string, edge?: string) => {
    poly(pts, fill, edge);
    poly(pts.map(([a, b]) => [a, -b]), fill, edge);
  };
  const shade = x.createLinearGradient(0, 0, 0, SIZE); // lighter at the front, darker towards the sides
  shade.addColorStop(0, "#1d2431");
  shade.addColorStop(C / SIZE, "#28303f");
  shade.addColorStop(0.5, "#1d2431");
  shade.addColorStop(1, "#1d2431");
  x.fillStyle = shade;
  x.fillRect(0, 0, SIZE, SIZE);
  poly([[SIZE, -O], [V + 40, 0], [SIZE, O]], "#f4f5f7"); // shirt
  both([[SIZE, -O - 26], [945, -O - 40], [930, -O - 16], [905, -O - 66], [V, 0], [V + 40, 0], [SIZE, -O]], "#202836", "#3a4457"); // lapels
  both([[SIZE, -O + 4], [935, -O - 6], [960, -14], [SIZE, -6]], "#ffffff", "#c7ccd4"); // shirt collar
  const dots = (xs: number[], dy: number, r: number, fill: string) => {
    x.fillStyle = fill;
    for (const at of xs) {
      x.beginPath();
      x.arc(at, C + dy, r, 0, Math.PI * 2);
      x.fill();
    }
  };
  dots([880, 800], 0, 3.5, "#b9bfc9"); // shirt buttons
  x.strokeStyle = "#141a24";
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(V, C);
  x.lineTo(0, C);
  x.stroke(); // jacket closure
  dots([640, 520], 10, 8, "#0f141c"); // jacket buttons
}

const BODY_MATERIAL = "Human.body";
const SLEEVE_BONE = /^(Left|Right)(Arm|ForeArm)$/;
const HAND_BONE = /^(Left|Right)Hand/; // hand and finger bones
const SUIT = "#232b38";
const CUFF = "#f4f5f7";
const SLEEVE_ROUGHNESS = 0.75; // skin is glossier (0.5) than the blazer cloth (0.8); this keeps the sleeves matte

interface Attr {
  count: number;
  getX(i: number): number;
  getY(i: number): number;
  getZ(i: number): number;
  getW(i: number): number;
}
interface Mesh {
  material?: { name?: string; roughness?: number; map?: { image: unknown; needsUpdate: boolean } | null };
  geometry?: { index: Attr | null; attributes: Record<string, Attr | undefined> };
  skeleton?: { bones: { name: string }[] };
}

/** Long sleeves: the arms' skin texture is painted as blazer down to a white shirt cuff at the wrist. Arm triangles
 * are found from their skin weights on the arm bones, so no texture coordinates are hard-coded. Exported for the test. */
export function paintSleeves(x: CanvasRenderingContext2D, mesh: Mesh, w: number, h: number) {
  const g = mesh.geometry;
  const uv = g?.attributes.uv;
  const ji = g?.attributes.skinIndex;
  const jw = g?.attributes.skinWeight;
  const bones = mesh.skeleton?.bones;
  if (!g || !uv || !ji || !jw || !bones) return;
  const arm = new Float32Array(uv.count);
  const hand = new Float32Array(uv.count);
  const get = [ji.getX, ji.getY, ji.getZ, ji.getW].map((f) => f.bind(ji));
  const wget = [jw.getX, jw.getY, jw.getZ, jw.getW].map((f) => f.bind(jw));
  for (let v = 0; v < uv.count; v++) {
    for (let k = 0; k < 4; k++) {
      const name = bones[get[k]!(v)]?.name ?? "";
      if (SLEEVE_BONE.test(name)) arm[v]! += wget[k]!(v);
      else if (HAND_BONE.test(name)) hand[v]! += wget[k]!(v);
    }
  }
  const tris = g.index ? g.index.count : uv.count;
  const at = (i: number) => (g.index ? g.index.getX(i) : i);
  x.lineJoin = "round";
  x.lineWidth = 2; // bleed over UV seams so no skin line shows
  for (let t = 0; t + 2 < tris; t += 3) {
    const vs = [at(t), at(t + 1), at(t + 2)];
    if (vs.some((v) => arm[v]! + hand[v]! < 0.5)) continue; // not arm (shoulder, torso)
    const handMax = Math.max(...vs.map((v) => hand[v]!));
    if (handMax > 0.5) continue; // the hand stays skin
    x.fillStyle = x.strokeStyle = handMax > 0.08 ? CUFF : SUIT;
    x.beginPath();
    vs.forEach((v, i) => (i ? x.lineTo(uv.getX(v) * w, uv.getY(v) * h) : x.moveTo(uv.getX(v) * w, uv.getY(v) * h)));
    x.closePath();
    x.fill();
    x.stroke();
  }
}

const canvas2d = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") };
};

/** Repaints the avatar's clothes in place: blazer and shirt on the top, long sleeves on the arms. Reusing the loaded
 * textures keeps their glTF colour space and flip settings. */
export function dressForInterview(root: { traverse(fn: (o: Mesh) => void): void }) {
  root.traverse((o) => {
    const map = o.material?.map;
    if (!map) return;
    if (o.material?.name === OUTFIT_MATERIAL) {
      const { c, ctx } = canvas2d(SIZE, SIZE);
      if (!ctx) return; // keep the original clothes
      paintOutfit(ctx);
      map.image = c;
      map.needsUpdate = true;
    } else if (o.material?.name === BODY_MATERIAL) {
      const img = map.image as CanvasImageSource & { width: number; height: number };
      const { c, ctx } = canvas2d(img.width, img.height);
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      paintSleeves(ctx, o, img.width, img.height);
      o.material.roughness = SLEEVE_ROUGHNESS;
      map.image = c;
      map.needsUpdate = true;
    }
  });
}
