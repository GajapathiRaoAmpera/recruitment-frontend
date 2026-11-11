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

interface Dot {
  x: number;
  lane: number; // -1..1 position across the funnel
  vx: number;
  phase: number;
  gate: number; // next gate to cross
  state: "flow" | "out" | "won";
  alpha: number;
  outY: number; // y where it was filtered out
  fall: number; // fall distance after being filtered out
}

interface Ripple {
  x: number;
  y: number;
  t: number;
  won: boolean;
}

const SPAWN_PER_SEC = 18;
const MAX_DOTS = 200;
const TRAIL = 22;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Candidates stream into a funnel, thin out at each stage gate and the few who pass the final gate turn magenta
 * and gather at the right edge, beside the sign-in card. Counts under each gate are live. Decorative canvas is
 * aria-hidden; reduced motion renders one settled frame.
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
      dot: token("--ampera-lavender-500", "#8070b4"),
      win: token("--ampera-magenta-600", "#9c369a"),
      line: token("--ampera-cream", "#fffefa"),
    };
    let w = 0;
    let h = 0;
    let dots: Dot[] = [];
    let ripples: Ripple[] = [];
    const glow = GATES.map(() => 0);
    const counts = GATES.map(() => 0);
    let arrive = 0;
    let spawnDebt = 0;

    const cy = () => h * 0.4;
    const lastX = () => GATES[GATES.length - 1]!.x * w;
    /** Funnel half-height: wide at the start, narrow at the final gate, closing to a point at the right edge. */
    const half = (x: number) => {
      if (x <= lastX()) return h * (0.34 - 0.26 * ease(Math.max(0, x / lastX())));
      return h * 0.08 * Math.max(0, 1 - (x - lastX()) / (w - lastX()));
    };
    const yOf = (d: Dot, x = d.x) => cy() + d.lane * half(x) + Math.sin(d.phase + x * 0.018) * 2.5;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const step = (dt: number) => {
      spawnDebt += dt * SPAWN_PER_SEC;
      while (spawnDebt >= 1 && dots.length < MAX_DOTS) {
        dots.push({ x: -TRAIL, lane: Math.random() * 2 - 1, vx: 50 + Math.random() * 36, phase: Math.random() * 6.28, gate: 0, state: "flow", alpha: 0.9, outY: 0, fall: 0 });
        spawnDebt -= 1;
      }
      for (const d of dots) {
        if (d.state === "out") {
          d.fall += dt * (30 + d.fall * 2.2);
          d.alpha -= dt * 1.3;
          d.x += d.vx * dt * 0.25;
          continue;
        }
        d.x += d.vx * dt;
        if (d.state === "won") {
          d.lane *= 1 - Math.min(1, dt * 1.6); // survivors pull into one lane
          if (d.x >= w) {
            arrive = Math.min(1.4, arrive + 0.22);
            d.alpha = 0;
          }
          continue;
        }
        const g = GATES[d.gate];
        if (g && d.x >= g.x * w) {
          const y = yOf(d);
          if (Math.random() < g.pass) {
            counts[d.gate]! += 1;
            glow[d.gate] = Math.min(1, glow[d.gate]! + 0.3);
            const won = d.gate === GATES.length - 1;
            ripples.push({ x: d.x, y, t: 0, won });
            d.gate += 1;
            if (won) d.state = "won";
          } else {
            d.state = "out";
            d.outY = y;
          }
        }
      }
      for (let i = 0; i < glow.length; i++) glow[i] = Math.max(0, glow[i]! - dt * 1.8);
      arrive = Math.max(0, arrive - dt * 0.5);
      ripples = ripples.filter((r) => (r.t += dt) < 0.7);
      dots = dots.filter((d) => d.alpha > 0 && d.x < w + 4);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // Funnel envelope.
      const fill = ctx.createLinearGradient(0, 0, w, 0);
      fill.addColorStop(0, C.dot);
      fill.addColorStop(1, C.win);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, cy() - half(x) - 8);
      for (let x = w; x >= 0; x -= 8) ctx.lineTo(x, cy() + half(x) + 8);
      ctx.closePath();
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Gates: brighten briefly when someone passes.
      GATES.forEach((g, i) => {
        const x = g.x * w;
        const top = cy() - half(x) - 18;
        const bottom = cy() + half(x) + 18;
        ctx.globalAlpha = 0.18 + glow[i]! * 0.55;
        ctx.strokeStyle = i === GATES.length - 1 ? C.win : C.line;
        ctx.lineWidth = 1 + glow[i]!;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
      });

      // Arrival glow where survivors gather, beside the sign-in card.
      if (arrive > 0.01) {
        const r = ctx.createRadialGradient(w, cy(), 0, w, cy(), h * 0.45);
        r.addColorStop(0, C.win);
        r.addColorStop(1, "transparent");
        ctx.globalAlpha = Math.min(0.55, arrive * 0.4);
        ctx.fillStyle = r;
        ctx.fillRect(w - h * 0.45, 0, h * 0.45, h);
      }

      // Candidates: short trails, fragments when filtered out, magenta once through the final gate.
      ctx.lineCap = "round";
      for (const d of dots) {
        const won = d.state === "won";
        if (d.state === "out") {
          ctx.globalAlpha = Math.max(0, d.alpha) * 0.7;
          ctx.fillStyle = C.dot;
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.arc(d.x + k * (2 + d.fall * 0.18), d.outY + d.fall * (1 + Math.abs(k) * 0.3), 1.3, 0, 6.28);
            ctx.fill();
          }
          continue;
        }
        const y = yOf(d);
        const tail = ctx.createLinearGradient(d.x - TRAIL, 0, d.x, 0);
        tail.addColorStop(0, "transparent");
        tail.addColorStop(1, won ? C.win : C.dot);
        ctx.globalAlpha = d.alpha * 0.6;
        ctx.strokeStyle = tail;
        ctx.lineWidth = won ? 2.4 : 1.6;
        ctx.beginPath();
        ctx.moveTo(d.x - TRAIL, yOf(d, d.x - TRAIL));
        ctx.lineTo(d.x, y);
        ctx.stroke();
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = won ? C.win : C.dot;
        ctx.shadowBlur = won ? 14 : 0;
        ctx.shadowColor = C.win;
        ctx.beginPath();
        ctx.arc(d.x, y, won ? 3.4 : 2.2, 0, 6.28);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Pass ripples.
      for (const r of ripples) {
        ctx.globalAlpha = (1 - r.t / 0.7) * (r.won ? 0.8 : 0.4);
        ctx.strokeStyle = r.won ? C.win : C.line;
        ctx.lineWidth = r.won ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3 + r.t * (r.won ? 34 : 18), 0, 6.28);
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
      for (let i = 0; i < 500; i++) step(0.05);
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
