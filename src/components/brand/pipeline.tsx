"use client";

import { useEffect, useRef } from "react";
import s from "./pipeline.module.scss";

/** The five stages a candidate passes; gate x positions are fractions of the canvas width. */
const GATES = [
  { label: "Shortlist", x: 0.16, pass: 0.62 },
  { label: "Aptitude", x: 0.34, pass: 0.6 },
  { label: "Coding", x: 0.52, pass: 0.55 },
  { label: "Interview", x: 0.7, pass: 0.65 },
  { label: "Final", x: 0.88, pass: 0.7 },
];

interface Dot {
  x: number;
  baseY: number;
  vx: number;
  phase: number;
  gate: number; // index of the next gate to cross
  alive: boolean;
  alpha: number;
  drop: number; // vertical drift once filtered out
}

const SPAWN_PER_SEC = 16;
const MAX_DOTS = 180;

/**
 * Candidates stream through the hiring stages and thin out at each gate; the few who pass the final
 * gate turn magenta. Decorative (aria-hidden). Reduced motion renders one settled frame.
 */
export function Pipeline({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const color = {
      dot: css.getPropertyValue("--ampera-lavender-500").trim() || "#8070b4",
      win: css.getPropertyValue("--ampera-magenta-600").trim() || "#9c369a",
      line: css.getPropertyValue("--ampera-cream").trim() || "#fffefa",
    };
    let w = 0;
    let h = 0;
    let dots: Dot[] = [];
    let spawnDebt = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = () => {
      dots.push({ x: -6, baseY: h * (0.2 + Math.random() * 0.6), vx: 46 + Math.random() * 34, phase: Math.random() * Math.PI * 2, gate: 0, alive: true, alpha: 0.85, drop: 0 });
    };

    const step = (dt: number) => {
      spawnDebt += dt * SPAWN_PER_SEC;
      while (spawnDebt >= 1 && dots.length < MAX_DOTS) {
        spawn();
        spawnDebt -= 1;
      }
      for (const d of dots) {
        d.x += d.vx * dt;
        const g = GATES[d.gate];
        if (d.alive && g && d.x >= g.x * w) {
          if (Math.random() < g.pass) d.gate += 1;
          else d.alive = false;
        }
        if (!d.alive) {
          d.alpha -= dt * 1.1;
          d.drop += dt * 26;
          d.vx *= 0.97;
        }
      }
      dots = dots.filter((d) => d.alpha > 0 && d.x < w + 12);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color.line;
      ctx.globalAlpha = 0.14;
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1;
      for (const g of GATES) {
        ctx.beginPath();
        ctx.moveTo(g.x * w, h * 0.12);
        ctx.lineTo(g.x * w, h * 0.88);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const d of dots) {
        const won = d.gate >= GATES.length;
        const y = d.baseY + Math.sin(d.phase + d.x * 0.012) * 7 + d.drop;
        ctx.globalAlpha = Math.max(0, d.alpha) * (d.alive ? 1 : 0.6);
        ctx.fillStyle = won ? color.win : color.dot;
        ctx.shadowBlur = won ? 12 : 0;
        ctx.shadowColor = color.win;
        ctx.beginPath();
        ctx.arc(d.x, y, won ? 3.6 : 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // Settle the simulation offscreen, then show a single still frame.
      for (let i = 0; i < 400; i++) step(0.05);
      draw();
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
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className={`${s.wrap} ${className ?? ""}`}>
      <canvas ref={canvasRef} className={s.canvas} aria-hidden />
      <ol className={s.gates} aria-label="Hiring stages">
        {GATES.map((g) => (
          <li key={g.label} className={s.gate} style={{ left: `${g.x * 100}%` }}>
            {g.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
