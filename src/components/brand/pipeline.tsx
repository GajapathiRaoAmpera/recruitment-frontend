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

/** Depth rows on the ground plane: far rows are higher, smaller and fainter. Drawn back to front. */
const ROWS = [
  { ground: 0.5, scale: 0.68, alpha: 0.5 },
  { ground: 0.66, scale: 0.84, alpha: 0.75 },
  { ground: 0.82, scale: 1, alpha: 1 },
];

interface Walker {
  row: number;
  x: number; // feet position
  speed: number; // px/s at this row's scale
  phase: number; // walk-cycle angle
  gate: number; // next gate to cross
  state: "walk" | "out" | "won";
  alpha: number;
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
      body: token("--ampera-lavender-500", "#8070b4"),
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
      walkers.push({ row, x: -H * 0.4, speed: H * (0.85 + Math.random() * 0.15), phase: Math.random() * 6.28, gate: 0, state: "walk", alpha: 1 });
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

    /** One limb as two segments (upper + lower) with a bend; angles are from vertical, positive = facing direction. */
    const limb = (x: number, y: number, a1: number, len1: number, a2: number, len2: number, face: number) => {
      const kx = x + Math.sin(a1) * len1 * face;
      const ky = y + Math.cos(a1) * len1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(kx, ky);
      ctx.lineTo(kx + Math.sin(a2) * len2 * face, ky + Math.cos(a2) * len2);
      ctx.stroke();
    };

    /** A walking person with feet at (x, ground), height H. face = 1 walks right, -1 walks left. */
    const person = (x: number, ground: number, H: number, phase: number, color: string, alpha: number, face: number, halo: boolean) => {
      const bob = Math.abs(Math.sin(phase)) * H * 0.018;
      const hip = ground - H * 0.47 - bob;
      const shoulder = ground - H * 0.77 - bob;
      const legSwing = (q: number) => 0.42 * Math.sin(q);
      const kneeBend = (q: number) => 0.75 * Math.max(0, Math.sin(q + 1.3)); // knee folds as the leg swings forward
      const armSwing = (q: number) => -0.38 * Math.sin(q);

      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = color;
      ctx.shadowBlur = halo ? 14 : 0;

      // Far side limbs first, a touch dimmer for depth.
      ctx.globalAlpha = alpha * 0.6;
      ctx.lineWidth = H * 0.075;
      limb(x, hip, legSwing(phase + Math.PI), H * 0.25, legSwing(phase + Math.PI) - kneeBend(phase + Math.PI), H * 0.24, face);
      ctx.lineWidth = H * 0.06;
      limb(x, shoulder + H * 0.02, armSwing(phase + Math.PI), H * 0.17, armSwing(phase + Math.PI) + 0.35, H * 0.16, face);

      // Torso and head.
      ctx.globalAlpha = alpha;
      ctx.lineWidth = H * 0.15;
      ctx.beginPath();
      ctx.moveTo(x + H * 0.01 * face, shoulder);
      ctx.lineTo(x, hip);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + H * 0.015 * face, ground - H * 0.9 - bob, H * 0.075, 0, 6.28);
      ctx.fill();

      // Near side limbs.
      ctx.lineWidth = H * 0.075;
      limb(x, hip, legSwing(phase), H * 0.25, legSwing(phase) - kneeBend(phase), H * 0.24, face);
      ctx.lineWidth = H * 0.06;
      limb(x, shoulder + H * 0.02, armSwing(phase), H * 0.17, armSwing(phase) + 0.35, H * 0.16, face);
      ctx.shadowBlur = 0;
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
          person(p.x, ground, H, p.phase, won ? C.win : C.body, ROWS[row]!.alpha * Math.max(0, p.alpha) * (out ? 0.6 : 1), out ? -1 : 1, won);
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

    resize();
    const ro = new ResizeObserver(() => {
      resize();
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
