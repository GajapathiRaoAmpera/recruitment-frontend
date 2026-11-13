import * as THREE from "three";
import type { CharacterState } from "./character-state";

// The interviewer, built in code from basic shapes: no model or texture files. Colours come from the site's CSS
// tokens at mount, so it matches the Ampera palette. Plain three.js (no react-three-fiber).
//
// Every frame reads `getLevel()` (0..1): the AI's voice while speaking (mouth), the student's mic while listening
// (halo pulse). Movement eases toward per-state targets; with reduced motion only the mouth and colours change.

type Palette = Record<"skin" | "blush" | "hair" | "blazer" | "blazerDark" | "shirt" | "ink" | "lips" | "badge" | "speaking" | "listening" | "thinking" | "warning" | "light" | "sky", THREE.Color>;

const TOKENS: Record<keyof Palette, string> = {
  skin: "--ui-color-doll-skin",
  blush: "--ui-color-doll-blush",
  hair: "--ampera-navy-900",
  blazer: "--ui-color-primary",
  blazerDark: "--ui-color-primary-hover",
  shirt: "--ui-color-surface",
  ink: "--ui-color-doll-ink",
  lips: "--ui-color-doll-lips",
  badge: "--ampera-lavender-500",
  speaking: "--ui-color-primary",
  listening: "--ui-color-success",
  thinking: "--ampera-lavender-500",
  warning: "--ui-color-warning",
  light: "--ui-color-surface",
  sky: "--ampera-magenta-50",
};

/** Read the palette from CSS custom properties (computed, so var() chains are resolved). */
export function readPalette(el: Element = document.documentElement): Palette {
  const css = getComputedStyle(el);
  const out = {} as Palette;
  for (const [k, token] of Object.entries(TOKENS) as [keyof Palette, string][]) {
    const c = new THREE.Color(0.5, 0.5, 0.5); // neutral grey only if a token is missing
    const v = css.getPropertyValue(token).trim();
    if (v) {
      try {
        c.setStyle(v, THREE.SRGBColorSpace);
      } catch {
        /* keep grey */
      }
    }
    out[k] = c;
  }
  return out;
}

const ease = (cur: number, target: number, dt: number, speed = 8) => cur + (target - cur) * (1 - Math.exp(-dt * speed));

export class CharacterScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private disposables: { dispose: () => void }[] = [];

  private torso!: THREE.Group;
  private headPivot!: THREE.Group;
  private eyes: THREE.Group[] = [];
  private brows: THREE.Mesh[] = [];
  private mouth!: THREE.Mesh;
  private smile!: THREE.Mesh;
  private halo!: THREE.Mesh;
  private glow!: THREE.Mesh;
  private dots: THREE.Mesh[] = [];

  // eased values
  private s = { open: 0, tiltZ: 0, nodX: 0, turnY: 0, brow: 0, gazeX: 0, gazeY: 0, lid: 1, halo: 0, dots: 0, squint: 0 };
  private nextBlink = 2;
  private blinkT = -1;
  private haloColor = new THREE.Color();

  state: CharacterState = "idle";
  reducedMotion = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private palette: Palette,
    private getLevel: () => number,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.build();
  }

  private mat(color: THREE.Color, opts: THREE.MeshStandardMaterialParameters = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...opts });
    this.disposables.push(m);
    return m;
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material) {
    this.disposables.push(geo);
    return new THREE.Mesh(geo, mat);
  }

  private build() {
    const p = this.palette;
    const hemi = new THREE.HemisphereLight(p.light, p.sky, 1.5);
    const key = new THREE.DirectionalLight(p.light, 1.6);
    key.position.set(2.5, 4, 5);
    const rim = new THREE.DirectionalLight(p.blazer, 1.4);
    rim.position.set(-3, 2.5, -3);
    const fill = new THREE.PointLight(p.badge, 0.6, 12);
    fill.position.set(-2.5, 1.2, 3);
    this.scene.add(hemi, key, rim, fill);

    const skin = this.mat(p.skin, { roughness: 0.75 });
    const hair = this.mat(p.hair, { roughness: 0.45 });
    const blazer = this.mat(p.blazer, { roughness: 0.55 });
    const blazerDark = this.mat(p.blazerDark, { roughness: 0.55 });
    const shirt = this.mat(p.shirt, { roughness: 0.8 });
    const ink = this.mat(p.ink, { roughness: 0.3 });
    const shine = new THREE.MeshBasicMaterial({ color: p.light });
    const lips = this.mat(p.lips, { roughness: 0.5 });
    const blush = new THREE.MeshBasicMaterial({ color: p.blush, transparent: true, opacity: 0.35, depthWrite: false });
    const badge = this.mat(p.badge, { emissive: p.badge, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.2 });
    this.disposables.push(shine, blush);

    // --- body
    this.torso = new THREE.Group();
    const body = this.mesh(new THREE.CapsuleGeometry(0.82, 0.8, 10, 32), blazer);
    body.scale.set(1.3, 1, 0.72);
    body.position.y = -0.05;
    const collar = this.mesh(new THREE.CylinderGeometry(0.26, 0.4, 0.3, 32), shirt);
    collar.position.set(0, 0.88, 0.05);
    const lapelGeo = new THREE.BoxGeometry(0.16, 0.75, 0.06);
    const lapelL = this.mesh(lapelGeo, blazerDark);
    lapelL.position.set(-0.2, 0.52, 0.55);
    lapelL.rotation.set(-0.25, 0, -0.42);
    const lapelR = new THREE.Mesh(lapelGeo, blazerDark);
    lapelR.position.set(0.2, 0.52, 0.55);
    lapelR.rotation.set(-0.25, 0, 0.42);
    const pin = this.mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 32), badge);
    pin.rotation.x = Math.PI / 2 - 0.25;
    pin.position.set(-0.46, 0.42, 0.56);
    this.torso.add(body, collar, lapelL, lapelR, pin);
    this.scene.add(this.torso);

    // --- head (pivot at the neck, so tilts look natural)
    this.headPivot = new THREE.Group();
    this.headPivot.position.set(0, 0.95, 0);
    const neck = this.mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.4, 24), skin);
    neck.position.y = 0.12;
    const head = new THREE.Group();
    head.position.y = 0.72;
    const skull = this.mesh(new THREE.SphereGeometry(0.6, 48, 48), skin);
    skull.scale.set(0.96, 1.06, 0.94);
    const cap = this.mesh(new THREE.SphereGeometry(0.64, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.52), hair);
    cap.scale.set(1, 1.05, 1);
    cap.rotation.x = -0.32;
    cap.position.set(0, 0.04, -0.03);
    const fringe = this.mesh(new THREE.TorusGeometry(0.42, 0.11, 16, 40, Math.PI * 0.9), hair);
    fringe.rotation.set(-0.15, 0, Math.PI * 0.05);
    fringe.position.set(0, 0.24, 0.32);
    fringe.scale.set(1.05, 0.75, 1);
    const earGeo = new THREE.SphereGeometry(0.11, 20, 20);
    const earL = this.mesh(earGeo, skin);
    earL.position.set(-0.58, -0.02, 0);
    earL.scale.set(0.6, 1, 0.8);
    const earR = new THREE.Mesh(earGeo, skin);
    earR.position.set(0.58, -0.02, 0);
    earR.scale.set(0.6, 1, 0.8);
    head.add(skull, cap, fringe, earL, earR);

    // eyes: a dark oval + a highlight, grouped so they blink (scale y) and look around (position)
    const eyeGeo = new THREE.SphereGeometry(0.075, 24, 24);
    const shineGeo = new THREE.SphereGeometry(0.022, 12, 12);
    this.disposables.push(shineGeo);
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 0.2, 0.06, 0.53);
      const eye = this.mesh(eyeGeo, ink);
      eye.scale.set(1, 1.3, 0.55);
      const hl = new THREE.Mesh(shineGeo, shine);
      hl.position.set(0.025, 0.04, 0.04);
      g.add(eye, hl);
      head.add(g);
      this.eyes.push(g);
      const brow = this.mesh(new THREE.CapsuleGeometry(0.02, 0.13, 6, 12), hair);
      brow.rotation.z = Math.PI / 2 + side * 0.12;
      brow.position.set(side * 0.2, 0.23, 0.53);
      head.add(brow);
      this.brows.push(brow);
      const cheek = this.mesh(new THREE.CircleGeometry(0.085, 24), blush);
      cheek.position.set(side * 0.33, -0.1, 0.49);
      cheek.rotation.y = side * 0.55;
      head.add(cheek);
    }

    // mouth: an oval that opens with the voice, and a smile arc that shows when it is closed
    this.mouth = this.mesh(new THREE.SphereGeometry(0.1, 24, 16), lips);
    this.mouth.position.set(0, -0.2, 0.53);
    this.mouth.scale.set(1.1, 0.12, 0.4);
    const smileMat = new THREE.MeshStandardMaterial({ color: p.lips, roughness: 0.5, transparent: true });
    this.disposables.push(smileMat);
    this.smile = this.mesh(new THREE.TorusGeometry(0.085, 0.016, 10, 32, Math.PI), smileMat);
    this.smile.rotation.z = Math.PI;
    this.smile.position.set(0, -0.17, 0.545);
    head.add(this.mouth, this.smile);

    this.headPivot.add(neck, head);
    this.scene.add(this.headPivot);

    // halo behind the head: state colour, pulses with whoever is talking
    const haloMat = new THREE.MeshBasicMaterial({ color: p.speaking, transparent: true, opacity: 0.5, depthWrite: false });
    const glowMat = new THREE.MeshBasicMaterial({ color: p.speaking, transparent: true, opacity: 0.12, depthWrite: false });
    this.disposables.push(haloMat, glowMat);
    this.halo = this.mesh(new THREE.TorusGeometry(1.0, 0.018, 12, 160), haloMat);
    this.glow = this.mesh(new THREE.CircleGeometry(1.0, 96), glowMat);
    this.halo.position.set(0, 1.62, -0.6);
    this.glow.position.set(0, 1.62, -0.62);
    this.scene.add(this.glow, this.halo);

    // "thinking" dots
    const dotMat = new THREE.MeshBasicMaterial({ color: p.thinking, transparent: true, opacity: 0 });
    const dotGeo = new THREE.SphereGeometry(0.055, 16, 16);
    this.disposables.push(dotMat, dotGeo);
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(dotGeo, dotMat);
      d.position.set(0.72 + i * 0.17, 2.32 + i * 0.07, 0.2);
      this.scene.add(d);
      this.dots.push(d);
    }

    this.camera.position.set(0, 1.45, 6.4);
    this.camera.lookAt(0, 1.3, 0);
  }

  resize(w: number, h: number) {
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // narrow containers: step back so the shoulders still fit
    this.camera.position.z = aspect < 1 ? 6.4 / Math.max(aspect, 0.55) : 6.4;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.frame(0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    const loop = () => {
      if (!this.running) return;
      this.frame(Math.min(this.clock.getDelta(), 0.1));
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame(dt: number) {
    const t = this.clock.elapsedTime;
    const st = this.state;
    const motion = !this.reducedMotion;
    const lvl = Math.max(0, Math.min(1, this.getLevel()));
    const s = this.s;
    const p = this.palette;

    // targets per state
    const tgt = { open: 0, tiltZ: 0, nodX: 0, turnY: 0, brow: 0, gazeX: 0, gazeY: 0, lid: 1, halo: 0.25, dots: 0, squint: 0 };
    let ring = p.speaking;
    switch (st) {
      case "speaking":
        tgt.open = lvl;
        tgt.halo = 0.35 + lvl * 0.6;
        if (motion) {
          tgt.nodX = Math.sin(t * 2.6) * 0.035 + lvl * 0.05;
          tgt.turnY = Math.sin(t * 0.9) * 0.08;
        }
        break;
      case "listening":
        ring = p.listening;
        tgt.halo = 0.3 + lvl * 0.7;
        tgt.brow = 0.025;
        if (motion) {
          tgt.tiltZ = 0.11;
          tgt.nodX = -0.03 + Math.sin(t * 1.4) * 0.01;
        }
        break;
      case "thinking":
        ring = p.thinking;
        tgt.halo = 0.3 + Math.sin(t * 3) * 0.1;
        tgt.dots = 1;
        tgt.gazeX = 0.022;
        tgt.gazeY = 0.03;
        tgt.brow = 0.015;
        if (motion) tgt.tiltZ = -0.06;
        break;
      case "reconnecting":
        ring = p.warning;
        tgt.halo = 0.25 + (motion ? (Math.sin(t * 2) + 1) * 0.15 : 0.15);
        tgt.lid = 0.55;
        break;
      case "ended":
        ring = p.listening;
        tgt.squint = 1;
        tgt.halo = 0.3;
        break;
      default:
        if (motion) tgt.turnY = Math.sin(t * 0.5) * 0.05;
    }

    for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] = ease(s[k], tgt[k], dt, k === "open" ? 18 : 6);

    // body + head
    this.torso.scale.y = motion ? 1 + Math.sin(t * 1.6) * 0.012 : 1;
    this.torso.position.y = motion ? Math.sin(t * 1.6) * 0.01 : 0;
    this.headPivot.rotation.set(s.nodX, s.turnY, s.tiltZ);

    // blink (not with reduced motion)
    let lid = s.lid * (1 - s.squint * 0.45);
    if (motion && st !== "reconnecting") {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0 && this.blinkT < 0) this.blinkT = 0;
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        lid *= Math.max(0.08, Math.abs(1 - this.blinkT / 0.07));
        if (this.blinkT > 0.14) {
          this.blinkT = -1;
          this.nextBlink = 2.2 + Math.random() * 3.5;
        }
      }
    }
    this.eyes.forEach((e, i) => {
      e.scale.y = lid;
      e.position.x = (i ? 0.2 : -0.2) + s.gazeX;
      e.position.y = 0.06 + s.gazeY;
    });
    this.brows.forEach((b) => (b.position.y = 0.23 + s.brow));

    // mouth
    this.mouth.scale.set(1.1 - s.open * 0.25, 0.12 + s.open * 1.05, 0.4);
    (this.smile.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - s.open * 3);

    // halo
    this.haloColor.lerp(ring, 1 - Math.exp(-dt * 6));
    if (dt === 0) this.haloColor.copy(ring);
    const haloMat = this.halo.material as THREE.MeshBasicMaterial;
    const glowMat = this.glow.material as THREE.MeshBasicMaterial;
    haloMat.color.copy(this.haloColor);
    glowMat.color.copy(this.haloColor);
    haloMat.opacity = Math.min(1, s.halo);
    glowMat.opacity = 0.06 + s.halo * 0.12;
    const scale = 1 + (motion ? s.halo * 0.06 : 0);
    this.halo.scale.setScalar(scale);
    this.glow.scale.setScalar(scale);

    // thinking dots
    this.dots.forEach((d, i) => {
      (d.material as THREE.MeshBasicMaterial).opacity = s.dots * 0.9;
      d.position.y = 2.32 + i * 0.07 + (motion ? Math.max(0, Math.sin(t * 5 - i * 0.7)) * 0.06 * s.dots : 0);
    });

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
