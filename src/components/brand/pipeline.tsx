"use client";

import { useEffect, useRef } from "react";
import s from "./pipeline.module.scss";

/** The five stages a candidate passes; x is a fraction of the canvas width, pass is the chance to get through. */
const GATES = [
  { label: "Shortlist", x: 0.14, pass: 0.62 },
  { label: "Aptitude", x: 0.32, pass: 0.6 },
  { label: "Coding", x: 0.5, pass: 0.55 },
  { label: "Interview", x: 0.68, pass: 0.65 },
  { label: "Final", x: 0.86, pass: 0.7 },
];

/** Depth rows on the ground plane: far rows are higher and smaller. Drawn back to front. */
const ROWS = [
  { ground: 0.5, scale: 0.68 },
  { ground: 0.66, scale: 0.84 },
  { ground: 0.82, scale: 1 },
];

/** Varied, everyday looks so the crowd reads as real people, not silhouettes. */
const SKIN = ["#ffdbac", "#f1c27d", "#e0ac69", "#c68642", "#a0663d", "#8d5524"];
const HAIR = ["#1b1b1b", "#2b1d14", "#3b2a1e", "#5a3825", "#8a6a4a"];
const SHIRT = ["#ffffff", "#4a6fa5", "#8fb4d9", "#d9d4c7", "#6b8e6b", "#c97b63", "#8070b4", "#e8e2f0"];
const PANTS = ["#2b2f3a", "#1f2a44", "#4a4a4a", "#6b5b45", "#3a3f4b"];
// Girls: a knee-length kurta over leggings. No magenta here: magenta is reserved for hired candidates.
const KURTA = ["#e07a5f", "#f2cc8f", "#81b29a", "#4a6fa5", "#f4a261", "#ffffff", "#b5838d", "#8fb4d9"];
const LEGGINGS = ["#2b2f3a", "#f5f0e6", "#1f2a44", "#d9d4c7", "#6b5b45"];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)]!;

/** A random everyday look; about half the crowd are girls. */
const lookFor = (girl: boolean): Look => ({
  skin: pick(SKIN),
  hair: pick(HAIR),
  shirt: pick(girl ? KURTA : SHIRT),
  pants: pick(girl ? LEGGINGS : PANTS),
  girl,
  hairStyle: girl ? (Math.random() < 0.5 ? "ponytail" : "long") : "short",
});

/** Darken a #rrggbb colour; used for far-side limbs so depth reads without transparency. */
const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * f);
  return `rgb(${c(n >> 16)} ${c((n >> 8) & 255)} ${c(n & 255)})`;
};

interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  girl: boolean;
  hairStyle: "short" | "long" | "ponytail";
}

interface Walker {
  row: number;
  x: number; // feet position
  speed: number; // px/s at this row's scale
  phase: number; // walk-cycle angle
  gate: number; // next gate to cross
  state: "walk" | "out" | "won";
  alpha: number;
  look: Look;
}

interface Ripple {
  x: number;
  y: number;
  t: number;
  r: number;
  won: boolean;
}

const SPAWN_PER_SEC = 2.4;
const MAX_WALKERS = 36;

/**
 * Candidates walk through the hiring stages as people. At each gate some are turned back (they turn around and fade);
 * those who pass the final gate turn magenta and walk on toward the sign-in card. Counts under each gate are live.
 * The canvas is decorative (aria-hidden); reduced motion renders one settled frame.
 */
export function Pipeline({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const C = {
      win: token("--ampera-magenta-600", "#9c369a"),
      line: token("--ampera-cream", "#fffefa"),
    };
    let w = 0;
    let h = 0;
    let walkers: Walker[] = [];
    let ripples: Ripple[] = [];
    const glow = GATES.map(() => 0);
    const counts = GATES.map(() => 0);
    let spawnDebt = 0;

    /** Figure height for a row: readable as a person on any screen, never huge. */
    const heightOf = (row: number) => Math.min(70, Math.max(34, h * 0.24)) * ROWS[row]!.scale;
    const groundOf = (row: number) => h * ROWS[row]!.ground;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Keep everyone at the same spot relative to the gates when the width changes (layout settling, window resize).
      if (w && canvas.clientWidth) for (const p of walkers) p.x *= canvas.clientWidth / w;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = () => {
      const row = Math.floor(Math.random() * ROWS.length);
      const H = heightOf(row);
      // Keep personal space: don't spawn on top of the last person entering this row.
      const crowded = walkers.some((p) => p.row === row && p.state !== "out" && p.x < H * 0.9);
      if (crowded) return;
      walkers.push({ row, x: -H * 0.4, speed: H * (0.85 + Math.random() * 0.15), phase: Math.random() * 6.28, gate: 0, state: "walk", alpha: 1,
        look: lookFor(Math.random() < 0.5) });
    };

    const step = (dt: number) => {
      spawnDebt += dt * SPAWN_PER_SEC;
      while (spawnDebt >= 1) {
        if (walkers.length < MAX_WALKERS) spawn();
        spawnDebt -= 1;
      }
      for (const p of walkers) {
        const H = heightOf(p.row);
        const v = p.state === "out" ? -p.speed * 0.45 : p.speed;
        p.x += v * dt;
        p.phase += (Math.abs(v) / (H * 0.42)) * dt; // stride matches speed so feet don't slide
        if (p.state === "out") {
          p.alpha -= dt * 0.7;
          continue;
        }
        if (p.state === "won") continue;
        const g = GATES[p.gate];
        if (g && p.x >= g.x * w) {
          if (Math.random() < g.pass) {
            counts[p.gate]! += 1;
            glow[p.gate] = Math.min(1, glow[p.gate]! + 0.35);
            const won = p.gate === GATES.length - 1;
            ripples.push({ x: p.x, y: groundOf(p.row) - H * 0.55, t: 0, r: H * 0.6, won });
            p.gate += 1;
            if (won) p.state = "won";
          } else {
            p.state = "out";
          }
        }
      }
      for (let i = 0; i < glow.length; i++) glow[i] = Math.max(0, glow[i]! - dt * 1.8);
      ripples = ripples.filter((r) => (r.t += dt) < 0.8);
      walkers = walkers.filter((p) => p.alpha > 0 && p.x < w + 40 && p.x > -60);
    };

    /** One limb as two segments (upper + lower) with a bend; angles are from vertical, positive = facing direction. Returns the end point. */
    const limb = (x: number, y: number, a1: number, len1: number, a2: number, len2: number, face: number, c1: string, c2: string) => {
      const kx = x + Math.sin(a1) * len1 * face;
      const ky = y + Math.cos(a1) * len1;
      const ex = kx + Math.sin(a2) * len2 * face;
      const ey = ky + Math.cos(a2) * len2;
      ctx.strokeStyle = c1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(kx, ky);
      ctx.stroke();
      ctx.strokeStyle = c2;
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      return [ex, ey] as const;
    };

    /** A walking person with feet at (x, ground), height H. face = 1 walks right, -1 walks left. */
    const person = (x: number, ground: number, H: number, phase: number, look: Look, alpha: number, face: number) => {
      const bob = Math.abs(Math.sin(phase)) * H * 0.018;
      const hip = ground - H * 0.47 - bob;
      const shoulder = ground - H * 0.78 - bob;
      const legSwing = (q: number) => 0.42 * Math.sin(q);
      const kneeBend = (q: number) => 0.75 * Math.max(0, Math.sin(q + 1.3)); // knee folds as the leg swings forward
      const armSwing = (q: number) => -0.38 * Math.sin(q);

      ctx.globalAlpha = alpha;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Soft contact shadow grounds the figure.
      ctx.fillStyle = "rgb(0 0 0 / 0.28)";
      ctx.beginPath();
      ctx.ellipse(x, ground + H * 0.01, H * 0.14, H * 0.025, 0, 0, 6.28);
      ctx.fill();

      const leg = (q: number, f: number) => {
        ctx.lineWidth = H * 0.085;
        const pants = shade(look.pants, f);
        const [fx, fy] = limb(x, hip, legSwing(q), H * 0.25, legSwing(q) - kneeBend(q), H * 0.23, face, pants, pants);
        ctx.fillStyle = shade("#1a1a1a", f);
        ctx.beginPath();
        ctx.ellipse(fx + H * 0.03 * face, fy, H * 0.055, H * 0.028, 0, 0, 6.28);
        ctx.fill();
      };
      const arm = (q: number, f: number) => {
        ctx.lineWidth = H * 0.06;
        const [hx, hy] = limb(x, shoulder + H * 0.03, armSwing(q), H * 0.16, armSwing(q) + 0.35, H * 0.15, face, shade(look.shirt, f), shade(look.skin, f));
        ctx.fillStyle = shade(look.skin, f);
        ctx.beginPath();
        ctx.arc(hx, hy, H * 0.032, 0, 6.28);
        ctx.fill();
      };

      // Far side limbs first, darker for depth.
      leg(phase + Math.PI, 0.72);
      arm(phase + Math.PI, 0.72);

      // A kurta covers the top of both legs, so the near leg goes under it.
      if (look.girl) leg(phase, 1);

      ctx.fillStyle = look.shirt;
      ctx.beginPath();
      if (look.girl) {
        // Kurta: narrower shoulders, in at the waist, flaring to just above the knee.
        ctx.moveTo(x - H * 0.075, shoulder);
        ctx.lineTo(x + H * 0.075, shoulder);
        ctx.lineTo(x + H * 0.058, hip - H * 0.06);
        ctx.lineTo(x + H * 0.1, hip + H * 0.19);
        ctx.lineTo(x - H * 0.1, hip + H * 0.19);
        ctx.lineTo(x - H * 0.058, hip - H * 0.06);
      } else {
        // Shirt: broader at the shoulders, tucked in at the hips.
        ctx.moveTo(x - H * 0.085, shoulder);
        ctx.lineTo(x + H * 0.085, shoulder);
        ctx.lineTo(x + H * 0.065, hip + H * 0.02);
        ctx.lineTo(x - H * 0.065, hip + H * 0.02);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = H * 0.03;
      ctx.strokeStyle = look.shirt;
      ctx.stroke(); // rounds the shoulders
      if (!look.girl) {
        // Belt line.
        ctx.fillStyle = shade(look.pants, 0.8);
        ctx.fillRect(x - H * 0.068, hip - H * 0.005, H * 0.136, H * 0.025);
      }

      // Neck, head, hair.
      const hx = x + H * 0.015 * face;
      const hy = ground - H * 0.9 - bob;
      const r = H * 0.068;
      ctx.strokeStyle = look.skin;
      ctx.lineWidth = H * 0.045;
      ctx.beginPath();
      ctx.moveTo(x, shoulder);
      ctx.lineTo(hx, hy + r * 0.8);
      ctx.stroke();
      ctx.fillStyle = look.hair;
      if (look.hairStyle === "long") {
        // Hangs down the back only; any further forward and it reads as a beard under the chin.
        ctx.beginPath();
        ctx.ellipse(hx - r * 0.62 * face, hy + r * 0.6, r * 0.6, r * 1.15, 0.12 * face, 0, 6.28);
        ctx.fill();
      } else if (look.hairStyle === "ponytail") {
        // Tied at the back of the head, swinging a little with each step.
        const swing = Math.sin(phase * 2) * 0.18;
        ctx.beginPath();
        ctx.ellipse(hx - r * 1.05 * face, hy + r * 0.45, r * 0.38, r * 0.9, (0.45 + swing) * face, 0, 6.28);
        ctx.fill();
      }
      ctx.fillStyle = look.skin;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.arc(hx - r * 0.12 * face, hy - r * 0.1, r * 1.04, Math.PI * 0.95, Math.PI * 2.05); // hair cap over the top
      ctx.fill();

      // Near side limbs.
      if (!look.girl) leg(phase, 1);
      arm(phase, 1);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Gate posts from above the far row to the near row's ground; they brighten when someone passes.
      const top = groundOf(0) - heightOf(0) * 1.25;
      const bottom = groundOf(ROWS.length - 1) + 4;
      GATES.forEach((g, i) => {
        ctx.globalAlpha = 0.16 + glow[i]! * 0.55;
        ctx.strokeStyle = i === GATES.length - 1 ? C.win : C.line;
        ctx.lineWidth = 1 + glow[i]!;
        ctx.beginPath();
        ctx.moveTo(g.x * w, top);
        ctx.lineTo(g.x * w, bottom);
        ctx.stroke();
      });

      // People, back row first so nearer people overlap farther ones.
      for (let row = 0; row < ROWS.length; row++) {
        const H = heightOf(row);
        const ground = groundOf(row);
        for (const p of walkers) {
          if (p.row !== row) continue;
          const won = p.state === "won";
          const out = p.state === "out";
          // Hired candidates wear the brand magenta so they stand out without glowing.
          person(p.x, ground, H, p.phase, won ? { ...p.look, shirt: C.win } : p.look, Math.max(0, p.alpha), out ? -1 : 1);
        }
      }

      // Pass ripples at chest height.
      for (const r of ripples) {
        ctx.globalAlpha = (1 - r.t / 0.8) * (r.won ? 0.75 : 0.35);
        ctx.strokeStyle = r.won ? C.win : C.line;
        ctx.lineWidth = r.won ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 4 + (r.t / 0.8) * r.r, 0, 6.28);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const paintCounts = () => counts.forEach((n, i) => countRefs.current[i] && (countRefs.current[i]!.textContent = String(n)));

    // Warm up offscreen once the canvas has a real width, so the first frame shows people mid-walk, not an empty stage.
    let warm = false;
    const warmUp = () => {
      if (warm || !w) return;
      warm = true;
      for (let i = 0; i < 400; i++) step(0.05); // ~20s: long enough for people to reach the final gate
      paintCounts();
    };

    resize();
    warmUp();
    const ro = new ResizeObserver(() => {
      resize();
      warmUp();
      draw();
    });
    ro.observe(canvas);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Settle offscreen, then show one still frame.
      for (let i = 0; i < 600; i++) step(0.05);
      draw();
      paintCounts();
      return () => ro.disconnect();
    }

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      step(Math.min(0.05, (t - last) / 1000)); // clamp so a background tab doesn't burst on return
      last = t;
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const counter = setInterval(paintCounts, 300); // DOM text, not React state: no re-render per frame
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(counter);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`${s.wrap} ${className ?? ""}`}>
      <canvas ref={canvasRef} className={s.canvas} aria-hidden />
      <ol className={s.gates} aria-label="Hiring stages">
        {GATES.map((g, i) => (
          <li key={g.label} className={s.gate} style={{ left: `${g.x * 100}%` }}>
            <span>{g.label}</span>
            <span aria-hidden className={s.count} ref={(el) => void (countRefs.current[i] = el)}>
              0
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
