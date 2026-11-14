"use client";

import { useState, type ReactNode } from "react";
import cs from "./analytics.module.scss";

// Small SVG charts for the Analytics page. Colours are design tokens only; every chart has a legend (2+ series),
// hover/focus tooltips, and an accessible label. Values are also reachable without hover (labels, tables on the page).

/** Fixed series order: emphasis (the subject) in magenta, comparison in grey or navy, a third in teal. */
export const SERIES = {
  subject: "var(--ui-color-role-1)",
  navy: "var(--ui-color-role-2)",
  lavender: "var(--ui-color-role-3)",
  teal: "var(--ui-color-role-4)",
  muted: "var(--ui-color-role-6)",
} as const;

export interface Series {
  name: string;
  color: string;
  /** One value per category; null = no data. */
  values: (number | null)[];
}

const nice = (max: number) => {
  if (max <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / pow) * pow;
};
const fmt = (n: number, unit: string) => `${Number.isInteger(n) ? n : n.toFixed(1)}${unit}`;

/** Splits a label into at most two lines of about `n` characters, so axis labels never run into each other. */
function wrap(label: string, n = 13): string[] {
  if (label.length <= n) return [label];
  const words = label.split(" ");
  const lines: string[] = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1]!;
    if ((cur + " " + w).trim().length <= n || lines.length === 2) lines[lines.length - 1] = (cur + " " + w).trim();
    else lines.push(w);
  }
  return lines.map((l) => (l.length > n + 3 ? `${l.slice(0, n)}…` : l));
}

export function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <ul className={cs.legend} aria-label="Legend">
      {items.map((i) => (
        <li key={i.name}>
          <span className={cs.swatch} style={{ background: i.color }} aria-hidden /> {i.name}
        </li>
      ))}
    </ul>
  );
}

function Tip({ left, top, children }: { left: number; top: number; children: ReactNode }) {
  return (
    <div className={cs.tip} style={{ left: `${left}%`, top: `${top}%` }} role="status">
      {children}
    </div>
  );
}

const rowTip = (s: { name: string; color: string }, value: string) => (
  <span key={s.name} className={cs.tipRow}>
    <i style={{ background: s.color }} aria-hidden />
    <strong>{value}</strong>
    <span>{s.name}</span>
  </span>
);

/* ------------------------------------------------------------------------------------------ grouped columns */

const GW = 560;
const GH = 270;
const GM = { top: 20, right: 10, bottom: 52, left: 40 };
const BAR_MAX = 24;
const BAR_GAP = 3;

/** Column with a 4px rounded top and a square foot on the baseline. */
function colPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

interface ColumnsProps {
  label: string;
  categories: string[];
  series: Series[];
  /** Top of the axis. Defaults to 100 for percent charts, or a clean ceiling of the data otherwise. */
  max?: number;
  unit?: string;
}

/** Side-by-side columns per category: compare a student with the cohort, or "entered" with "cleared", round by round. */
export function GroupedColumns({ label, categories, series, max, unit = "%" }: ColumnsProps) {
  const [active, setActive] = useState<number | null>(null);
  const top = max ?? (unit === "%" ? 100 : nice(Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)))));
  const plotW = GW - GM.left - GM.right;
  const plotH = GH - GM.top - GM.bottom;
  const band = plotW / Math.max(categories.length, 1);
  const barW = Math.min(BAR_MAX, (band * 0.7) / series.length - BAR_GAP);
  const groupW = series.length * barW + (series.length - 1) * BAR_GAP;
  const y = (v: number) => GM.top + plotH * (1 - v / top);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);
  const labelled = categories.length * series.length <= 10;

  return (
    <div className={cs.chartBox}>
      <div className={cs.plot}>
        <svg viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label={label} className={cs.svg}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={GM.left} x2={GW - GM.right} y1={y(t)} y2={y(t)} className={t === 0 ? cs.axis : cs.grid} />
              <text x={GM.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className={cs.tick}>
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}
          {categories.map((c, i) => {
            const cx = GM.left + band * i + band / 2;
            const x0 = cx - groupW / 2;
            return (
              <g key={c}>
                {series.map((s, j) => {
                  const v = s.values[i];
                  if (v === null || v === undefined) return null;
                  const x = x0 + j * (barW + BAR_GAP);
                  const h = (plotH * Math.min(v, top)) / top;
                  return (
                    <g key={s.name}>
                      <path d={colPath(x, y(Math.min(v, top)), barW, h)} style={{ fill: s.color }} className={`${cs.bar} ${active === i ? cs.barOn : ""}`} />
                      {labelled && (
                        <text x={x + barW / 2} y={y(Math.min(v, top)) - 6} textAnchor="middle" className={cs.value}>
                          {fmt(v, unit)}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text textAnchor="middle" className={cs.axisLabel}>
                  {wrap(c).map((l, k) => (
                    <tspan key={k} x={cx} y={GH - GM.bottom + 18 + k * 13}>
                      {l}
                    </tspan>
                  ))}
                </text>
                <rect
                  x={GM.left + band * i}
                  y={GM.top}
                  width={band}
                  height={plotH + GM.bottom}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${c}: ${series.map((s) => `${s.name} ${s.values[i] == null ? "no data" : fmt(s.values[i] as number, unit)}`).join(", ")}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <Tip left={((GM.left + band * active + band / 2) / GW) * 100} top={2}>
            <span className={cs.tipHead}>{categories[active]}</span>
            {series.map((s) => rowTip(s, s.values[active] == null ? "No data" : fmt(s.values[active] as number, unit)))}
          </Tip>
        )}
      </div>
      {series.length > 1 && <Legend items={series} />}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ stacked columns */

export interface Stack {
  name: string;
  color: string;
  values: number[];
}

/** Counts per category split into stacks (score bands), with a 2px surface gap between segments. */
export function StackedColumns({ label, categories, stacks }: { label: string; categories: string[]; stacks: Stack[] }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = categories.map((_, i) => stacks.reduce((n, s) => n + (s.values[i] ?? 0), 0));
  const top = nice(Math.max(1, ...totals));
  const plotW = GW - GM.left - GM.right;
  const plotH = GH - GM.top - GM.bottom;
  const band = plotW / Math.max(categories.length, 1);
  const barW = Math.min(BAR_MAX + 12, band * 0.5);
  const y = (v: number) => GM.top + plotH * (1 - v / top);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * top);

  return (
    <div className={cs.chartBox}>
      <div className={cs.plot}>
        <svg viewBox={`0 0 ${GW} ${GH}`} role="img" aria-label={label} className={cs.svg}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={GM.left} x2={GW - GM.right} y1={y(t)} y2={y(t)} className={t === 0 ? cs.axis : cs.grid} />
              <text x={GM.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className={cs.tick}>
                {Math.round(t * 10) / 10}
              </text>
            </g>
          ))}
          {categories.map((c, i) => {
            const cx = GM.left + band * i + band / 2;
            let acc = 0;
            const segs = stacks.flatMap((s) => {
              const v = s.values[i] ?? 0;
              if (!v) return [];
              const y1 = y(acc + v);
              const h = Math.max(0, y(acc) - y1 - 2); // 2px surface gap
              acc += v;
              return [{ s, y1, h, last: false }];
            });
            if (segs.length) segs[segs.length - 1]!.last = true;
            return (
              <g key={c}>
                {segs.map(({ s, y1, h, last }) =>
                  last ? <path key={s.name} d={colPath(cx - barW / 2, y1, barW, h)} style={{ fill: s.color }} /> : <rect key={s.name} x={cx - barW / 2} y={y1} width={barW} height={h} style={{ fill: s.color }} />,
                )}
                {totals[i]! > 0 && (
                  <text x={cx} y={y(totals[i]!) - 6} textAnchor="middle" className={cs.value}>
                    {totals[i]}
                  </text>
                )}
                <text textAnchor="middle" className={cs.axisLabel}>
                  {wrap(c).map((l, k) => (
                    <tspan key={k} x={cx} y={GH - GM.bottom + 18 + k * 13}>
                      {l}
                    </tspan>
                  ))}
                </text>
                <rect
                  x={GM.left + band * i}
                  y={GM.top}
                  width={band}
                  height={plotH + GM.bottom}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={`${c}: ${stacks.map((s) => `${s.values[i] ?? 0} students ${s.name}`).join(", ")}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <Tip left={((GM.left + band * active + band / 2) / GW) * 100} top={2}>
            <span className={cs.tipHead}>{categories[active]}</span>
            {[...stacks].reverse().map((s) => rowTip(s, `${s.values[active] ?? 0}`))}
          </Tip>
        )}
      </div>
      <Legend items={[...stacks].reverse()} />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------- radar */

const RW = 420;
const RH = 330;
const RC = { x: RW / 2, y: RH / 2 };
const RR = 112;

/** Skill profile: one polygon per series over a shared 0-100 scale. A skill with no data is drawn at 0 and read as "No data". */
export function Radar({ label, axes, series }: { label: string; axes: string[]; series: Series[] }) {
  const [active, setActive] = useState<number | null>(null);
  const n = axes.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, v: number) => ({ x: RC.x + Math.cos(ang(i)) * RR * (v / 100), y: RC.y + Math.sin(ang(i)) * RR * (v / 100) });
  const ring = (v: number) => axes.map((_, i) => pt(i, v)).map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className={cs.chartBox}>
      <div className={cs.plot}>
        <svg viewBox={`0 0 ${RW} ${RH}`} role="img" aria-label={label} className={cs.svg}>
          {[25, 50, 75, 100].map((v) => (
            <polygon key={v} points={ring(v)} className={cs.grid} fill="none" />
          ))}
          {axes.map((a, i) => {
            const e = pt(i, 100);
            const l = pt(i, 100 + 16 / (RR / 100));
            const anchor = Math.abs(l.x - RC.x) < 6 ? "middle" : l.x > RC.x ? "start" : "end";
            return (
              <g key={a}>
                <line x1={RC.x} y1={RC.y} x2={e.x} y2={e.y} className={cs.grid} />
                <text x={l.x} y={l.y} textAnchor={anchor} dominantBaseline="middle" className={cs.axisLabel}>
                  {a}
                </text>
              </g>
            );
          })}
          {[25, 50, 75, 100].map((v) => (
            <text key={v} x={RC.x + 4} y={pt(0, v).y} dominantBaseline="middle" className={cs.tick}>
              {v}
            </text>
          ))}
          {series.map((s) => (
            <polygon key={s.name} points={s.values.map((v, i) => pt(i, v ?? 0)).map((p) => `${p.x},${p.y}`).join(" ")} style={{ fill: s.color, stroke: s.color }} className={cs.area} />
          ))}
          {series.map((s) =>
            s.values.map((v, i) => {
              const p = pt(i, v ?? 0);
              return <circle key={`${s.name}-${i}`} cx={p.x} cy={p.y} r={4} style={{ fill: v === null ? "var(--ui-color-surface)" : s.color }} className={cs.dot} />;
            }),
          )}
          {axes.map((a, i) => {
            const p = pt(i, 100);
            return (
              <circle
                key={a}
                cx={p.x}
                cy={p.y}
                r={RR * 0.32}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${a}: ${series.map((s) => `${s.name} ${s.values[i] == null ? "no data" : Math.round(s.values[i] as number)}`).join(", ")}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            );
          })}
        </svg>
        {active !== null && (
          <Tip left={(pt(active, 100).x / RW) * 100} top={(pt(active, 100).y / RH) * 100}>
            <span className={cs.tipHead}>{axes[active]}</span>
            {series.map((s) => rowTip(s, s.values[active] == null ? "No data" : `${Math.round(s.values[active] as number)}`))}
          </Tip>
        )}
      </div>
      <Legend items={series} />
    </div>
  );
}

/* ----------------------------------------------------------------------------------------------- scatter */

export interface Dot {
  id: string;
  label: string;
  x: number;
  y: number;
}

const SW = 560;
const SH = 300;
const SM = { top: 16, right: 16, bottom: 44, left: 48 };

/** Every student as a dot: time used (x) against score (y). Top-left = fast and accurate. */
export function Scatter({ label, dots, xLabel, yLabel, selectedId, onSelect }: { label: string; dots: Dot[]; xLabel: string; yLabel: string; selectedId?: string; onSelect?: (id: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const plotW = SW - SM.left - SM.right;
  const plotH = SH - SM.top - SM.bottom;
  const px = (v: number) => SM.left + (plotW * v) / 100;
  const py = (v: number) => SM.top + plotH * (1 - v / 100);
  const a = dots.find((d) => d.id === active);

  return (
    <div className={cs.chartBox}>
      <div className={cs.plot}>
        <svg viewBox={`0 0 ${SW} ${SH}`} role="group" aria-label={label} className={cs.svg}>
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={SM.left} x2={SW - SM.right} y1={py(t)} y2={py(t)} className={t === 0 ? cs.axis : cs.grid} />
              <line x1={px(t)} x2={px(t)} y1={SM.top} y2={SH - SM.bottom} className={t === 0 ? cs.axis : cs.grid} />
              <text x={SM.left - 8} y={py(t)} textAnchor="end" dominantBaseline="middle" className={cs.tick}>
                {t}
              </text>
              <text x={px(t)} y={SH - SM.bottom + 16} textAnchor="middle" className={cs.tick}>
                {t}
              </text>
            </g>
          ))}
          <text x={SM.left + plotW / 2} y={SH - 6} textAnchor="middle" className={cs.axisLabel}>
            {xLabel}
          </text>
          <text transform={`translate(12 ${SM.top + plotH / 2}) rotate(-90)`} textAnchor="middle" className={cs.axisLabel}>
            {yLabel}
          </text>
          {dots.map((d) => {
            const sel = d.id === selectedId;
            return (
              <g key={d.id}>
                <circle cx={px(d.x)} cy={py(d.y)} r={sel ? 7 : 5} style={{ fill: sel ? SERIES.subject : SERIES.navy }} className={cs.dot} fillOpacity={sel || !selectedId ? 1 : 0.55} />
                {/* 24px+ hit area, bigger than the mark. */}
                <circle
                  cx={px(d.x)}
                  cy={py(d.y)}
                  r={13}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.label}: score ${Math.round(d.y)} percent, ${Math.round(d.x)} percent of the time used`}
                  style={{ cursor: onSelect ? "pointer" : undefined }}
                  onPointerEnter={() => setActive(d.id)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(d.id)}
                  onBlur={() => setActive(null)}
                  onClick={() => onSelect?.(d.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(d.id)}
                />
              </g>
            );
          })}
        </svg>
        {a && (
          <Tip left={(px(a.x) / SW) * 100} top={(py(a.y) / SH) * 100 - 4}>
            <span className={cs.tipHead}>{a.label}</span>
            <span className={cs.tipRow}>
              <strong>{Math.round(a.y)}%</strong>
              <span>average score</span>
            </span>
            <span className={cs.tipRow}>
              <strong>{Math.round(a.x)}%</strong>
              <span>of the time used</span>
            </span>
          </Tip>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ ranked bars */

export interface BarItem {
  id: string;
  label: string;
  sub?: string;
  value: number;
  display: string;
}

/** Horizontal ranked bars on one 0-100 baseline: names left, figure right. Optionally clickable. */
export function HBars({ label, items, color = SERIES.subject, selectedId, onSelect }: { label: string; items: BarItem[]; color?: string; selectedId?: string; onSelect?: (id: string) => void }) {
  return (
    <ol className={cs.hbars} aria-label={label}>
      {items.map((it) => {
        const body = (
          <>
            <span className={cs.hbName}>
              {it.label}
              {it.sub && <small>{it.sub}</small>}
            </span>
            <span className={cs.hbTrack} aria-hidden>
              <span className={cs.hbFill} style={{ width: `${Math.max(0, Math.min(100, it.value))}%`, background: it.id === selectedId || !selectedId ? color : "var(--ui-color-border-strong)" }} />
            </span>
            <span className={cs.hbValue}>{it.display}</span>
          </>
        );
        return (
          <li key={it.id}>
            {onSelect ? (
              <button type="button" className={`${cs.hbRow} ${cs.hbBtn} ${it.id === selectedId ? cs.hbOn : ""}`} onClick={() => onSelect(it.id)}>
                {body}
              </button>
            ) : (
              <div className={cs.hbRow}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
