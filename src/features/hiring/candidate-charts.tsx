"use client";

import { useState } from "react";
import { hire as h } from "@/components/hire/ui";
import cs from "./candidate.module.scss";
import type { Outcome } from "./round-outcome";

export interface RoundPoint {
  id: string;
  /** Short name for the axis, e.g. "Aptitude test". */
  name: string;
  /** 0-100, or null when the student has no score in this round. */
  percent: number | null;
  /** The score as the student sees it ("62%", "3.8 / 5"). */
  scoreLabel: string | null;
  /** Result label ("Passed"), or null when the student never reached the round. */
  resultLabel: string | null;
  outcome: Outcome | null;
  rank: number | null;
}

const tone = (o: Outcome | null) => (o === "cleared" ? cs.cleared : o === "not_cleared" ? cs.notCleared : o === "open" ? cs.pending : cs.unreached);

// Column chart geometry (viewBox units; the SVG scales to its card).
const W = 520;
const H = 250;
const M = { top: 22, right: 8, bottom: 46, left: 40 };
const BAR = 24;
const TICKS = [0, 25, 50, 75, 100];

/** Column with a 4px rounded top and a square foot on the baseline. */
function colPath(x: number, y: number, w: number, hgt: number) {
  const r = Math.min(4, hgt, w / 2);
  return `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
}

/** Score per round as columns (0-100%), coloured by whether the student cleared the round. */
export function ScoreByRoundChart({ rounds }: { rounds: RoundPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const band = plotW / Math.max(rounds.length, 1);
  const yOf = (pct: number) => M.top + plotH * (1 - pct / 100);
  const a = active === null ? null : rounds[active];

  return (
    <div className={cs.chartBox}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Score by round" className={cs.svg}>
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={yOf(t)} y2={yOf(t)} className={t === 0 ? cs.axis : cs.grid} />
            <text x={M.left - 8} y={yOf(t)} textAnchor="end" dominantBaseline="middle" className={cs.tick}>
              {t}
            </text>
          </g>
        ))}
        {rounds.map((r, i) => {
          const cx = M.left + band * i + band / 2;
          const bh = r.percent === null ? 0 : (plotH * r.percent) / 100;
          return (
            <g key={r.id}>
              {r.percent !== null && (
                <>
                  <path d={colPath(cx - BAR / 2, yOf(r.percent), BAR, bh)} className={`${cs.bar} ${tone(r.outcome)} ${active === i ? cs.barOn : ""}`} />
                  <text x={cx} y={yOf(r.percent) - 7} textAnchor="middle" className={cs.value}>
                    {r.scoreLabel}
                  </text>
                </>
              )}
              {r.percent === null && (
                <text x={cx} y={yOf(0) - 8} textAnchor="middle" className={cs.tick}>
                  {r.outcome ? "No score" : "Not reached"}
                </text>
              )}
              <text x={cx} y={H - M.bottom + 20} textAnchor="middle" className={cs.axisLabel}>
                {i + 1}. {r.name}
              </text>
              {/* Hit area is the whole band, far bigger than the bar. */}
              <rect
                x={M.left + band * i}
                y={M.top}
                width={band}
                height={plotH + M.bottom}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${r.name}: ${r.scoreLabel ?? "no score"}${r.resultLabel ? `, ${r.resultLabel}` : ", not reached"}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {a && active !== null && (
        <div className={cs.tip} style={{ left: `${((M.left + band * active + band / 2) / W) * 100}%` }} role="status">
          <strong>{a.scoreLabel ?? "No score"}</strong>
          <span>{a.name}</span>
          <span>
            {a.resultLabel ?? "Not reached"}
            {a.rank != null ? ` · rank #${a.rank}` : ""}
          </span>
        </div>
      )}
      <p className={h.xs}>Score out of 100% (AI interview: average out of 5, shown on the same scale).</p>
    </div>
  );
}

/** One segment per round, in order: where the student is on the pipeline and where they stopped. */
export function JourneyBar({ rounds }: { rounds: RoundPoint[] }) {
  const label = (r: RoundPoint) => (r.outcome === "cleared" ? "Cleared" : r.outcome === "not_cleared" ? "Did not clear" : r.outcome === "open" ? "In progress" : "Not reached");
  return (
    <div className={cs.chartBox}>
      <ol className={cs.journey} aria-label="Progress through the rounds">
        {rounds.map((r, i) => (
          <li key={r.id} className={cs.step}>
            <span className={`${cs.seg} ${tone(r.outcome)}`} aria-hidden />
            <span className={cs.stepName}>
              {i + 1}. {r.name}
            </span>
            <span className={cs.stepState}>{label(r)}</span>
          </li>
        ))}
      </ol>
      <p className={cs.legend}>
        <span>
          <span className={`${cs.swatch} ${cs.cleared}`} aria-hidden /> Cleared
        </span>
        <span>
          <span className={`${cs.swatch} ${cs.notCleared}`} aria-hidden /> Did not clear
        </span>
        <span>
          <span className={`${cs.swatch} ${cs.pending}`} aria-hidden /> In progress
        </span>
        <span>
          <span className={`${cs.swatch} ${cs.unreached}`} aria-hidden /> Not reached
        </span>
      </p>
    </div>
  );
}
