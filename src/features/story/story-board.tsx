"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CORRIDOR_Y, LOOP, PHASES, STUDENTS, inDrive, phaseAt, studentAt } from "./story";
import s from "./story.module.scss";

type Key = (typeof PHASES)[number]["key"];

const ROOMS: { key: Key; x: number; y: number; w: number; h: number; name: string; sub: string }[] = [
  { key: "aptitude", x: 120, y: 0, w: 300, h: 295, name: "Aptitude hall", sub: "MCQ paper · HR invigilates" },
  { key: "coding", x: 420, y: 0, w: 300, h: 295, name: "Coding lab", sub: "Editor · Judge0 runs code" },
  { key: "interview", x: 720, y: 0, w: 280, h: 295, name: "AI interview booths", sub: "Live AI interviewer" },
  { key: "resume", x: 120, y: 325, w: 240, h: 295, name: "Resume desk", sub: "HR shortlists vs JD" },
  { key: "decision", x: 360, y: 325, w: 340, h: 295, name: "HR control room", sub: "Rankings · cut-offs" },
  { key: "offer", x: 700, y: 325, w: 300, h: 295, name: "Offer lounge", sub: "Selected students" },
];

const v = (name: string, n: number, i: number) => `var(--ui-color-person-${name}-${(i % n) + 1})`;
const HAIR = ["short", "long", "short", "ponytail", "short", "bun"] as const;

/** Shared SVG defs: soft light from the top-left so bodies read as round, and a blurred floor shadow. */
function PersonDefs() {
  return (
    <defs>
      <radialGradient id="story-shade" cx="0.35" cy="0.35" r="0.75">
        <stop offset="0" className={s.lightStop} />
        <stop offset="0.55" className={s.clearStop} />
        <stop offset="1" className={s.darkStop} />
      </radialGradient>
      <filter id="story-soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>
  );
}

interface PersonProps {
  x: number;
  y: number;
  angle: number;
  walking: boolean;
  t: number;
  look: number; // picks skin, hair and clothes so no two neighbours look alike
  opacity?: number;
  staff?: boolean; // HR: dark blazer, white shirt, tie, ID badge
  chair?: boolean;
  ring?: boolean;
  shirt?: string; // overrides the clothes colour (greyed-out leavers)
}

/** A person seen from above, facing +x: feet and swinging arms while walking, hands on the desk while seated. */
function Person({ x, y, angle, walking, t, look, opacity = 1, staff, chair, ring, shirt }: PersonProps) {
  const stride = walking ? Math.sin(t * 16 + look) * 5 : 0;
  const skin = v("skin", 4, look);
  const hair = v("hair", 3, look + 1);
  const cloth = shirt ?? (staff ? "var(--ui-color-interviewer-suit)" : v("shirt", 6, look));
  const style = staff ? (look % 2 ? "short" : "bun") : HAIR[look % HAIR.length];
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(1.25)`} opacity={opacity}>
      {ring && <circle r={17} className={s.ring} />}
      <ellipse cx={1.5} cy={1.5} rx={9} ry={13} className={s.shadow} filter="url(#story-soft)" />
      {chair && <rect x={-13} y={-11} width={11} height={22} rx={4} className={s.chair} />}
      {walking && (
        <>
          <ellipse cx={stride} cy={-4} rx={4} ry={2.2} className={s.shoe} />
          <ellipse cx={-stride} cy={4} rx={4} ry={2.2} className={s.shoe} />
        </>
      )}
      {[-1, 1].map((side) => {
        // walking: arms swing against the opposite foot; seated: hands forward on the desk
        const hx = walking ? 2 + side * stride * 0.8 : chair ? 8 : 2;
        const hy = side * (walking || !chair ? 11 : 6.5);
        return (
          <g key={side}>
            <line x1={0} y1={side * 9.5} x2={hx} y2={hy} stroke={cloth} strokeWidth={4.2} strokeLinecap="round" />
            <circle cx={hx + (chair && !walking ? 1.5 : 0.6)} cy={hy} r={1.9} fill={skin} />
          </g>
        );
      })}
      <ellipse rx={5.6} ry={11.5} fill={cloth} />
      <ellipse rx={5.6} ry={11.5} fill="url(#story-shade)" />
      {staff && (
        <>
          <path d="M 5.4 -2.4 L 1.5 0 L 5.4 2.4 Z" className={s.collar} />
          <line x1={2.5} y1={0} x2={5.3} y2={0} className={s.tie} />
          <rect x={-1} y={-6} width={2.4} height={3} rx={0.5} className={s.badge} />
        </>
      )}
      {style === "long" && <ellipse cx={-3.8} rx={3.8} ry={5.6} fill={hair} />}
      <circle cx={0.5} cy={-4.8} r={1.2} fill={skin} />
      <circle cx={0.5} cy={4.8} r={1.2} fill={skin} />
      <circle cx={0.5} r={4.7} fill={skin} />
      <ellipse cx={5.2} rx={1} ry={0.85} fill={skin} />
      <path d="M 3.7 -3.8 A 5 5 0 1 0 3.7 3.8 Q 2 0 3.7 -3.8 Z" fill={hair} />
      <ellipse cx={-1} cy={-1.6} rx={2.2} ry={1.3} className={s.shine} />
      {style === "ponytail" && <ellipse cx={-6.4} rx={2.8} ry={2} fill={hair} />}
      {style === "bun" && <circle cx={-2.8} r={2.4} fill={hair} className={s.bun} />}
      <circle cx={0.5} r={5} fill="url(#story-shade)" />
    </g>
  );
}

export function StoryBoard() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Autoplay unless the viewer asked for reduced motion; they can still step or press play.
  useEffect(() => {
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      setT((prev) => (prev + (Math.min(now - last, 100) / 1000) * speed) % LOOP);
      last = now;
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [playing, speed]);

  const p = phaseAt(t);

  // Space plays/pauses, arrows jump between stages. Only when no control has focus, so buttons keep their own keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== document.body) return;
      if (e.key === " ") setPlaying((v) => !v);
      else if (e.key === "ArrowRight") setT(PHASES[(p + 1) % PHASES.length].start);
      else if (e.key === "ArrowLeft") setT(PHASES[Math.max(0, p - 1)].start);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p]);

  const left = STUDENTS - inDrive(p);
  const active = PHASES[p].key;
  const invigilatorX = 270 + 120 * Math.sin(t * 0.5);
  const invigilatorAngle = Math.cos(t * 0.5) >= 0 ? 0 : 180;

  return (
    <main className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Ampera Campus Hire · how a drive runs</p>
          <h1 className={s.title}>A campus drive, from the gate to the offer</h1>
        </div>
        <Badge tone="info">Demo animation · illustrative data</Badge>
      </header>

      <div className={s.layout}>
        <div className={s.stage}>
          <svg viewBox="0 0 1000 620" className={s.svg} role="img" aria-label={`Top-down view of the office. Current stage: ${PHASES[p].title}. ${PHASES[p].what}`}>
            <PersonDefs />
            {/* Outside: grass, trees and the campus gate */}
            <rect width={120} height={620} className={s.grass} />
            {[60, 180, 600].map((ty) => (
              <circle key={ty} cx={30} cy={ty} r={18} className={s.tree} />
            ))}
            <text x={60} y={330} className={s.outsideLabel} textAnchor="middle">
              Waiting
            </text>

            <rect x={120} y={0} width={880} height={620} className={s.floor} />
            <rect x={120} y={CORRIDOR_Y - 15} width={880} height={30} className={s.corridor} />

            {ROOMS.map((r) => (
              <g key={r.key} className={cn(s.room, r.key === active && s.active)}>
                <rect x={r.x + 4} y={r.y + 4} width={r.w - 8} height={r.h - 8} rx={6} />
                <text x={r.x + 14} y={r.y + (r.y ? 24 : 22)} className={s.roomName}>
                  {r.name}
                </text>
                <text x={r.x + 14} y={r.y + (r.y ? 40 : 38)} className={s.roomSub}>
                  {r.sub}
                </text>
              </g>
            ))}

            {/* Aptitude desks with papers */}
            {Array.from({ length: 9 }, (_, d) => (
              <g key={d} transform={`translate(${180 + (d % 3) * 90} ${85 + Math.floor(d / 3) * 70})`}>
                <rect x={-18} y={-26} width={36} height={14} rx={2} className={s.desk} />
                <rect x={-6} y={-24} width={12} height={9} className={cn(s.paper, active === "aptitude" && s.working)} />
              </g>
            ))}

            {/* Coding desks with monitors */}
            {Array.from({ length: 8 }, (_, d) => (
              <g key={d} transform={`translate(${470 + (d % 4) * 65} ${105 + Math.floor(d / 4) * 100})`}>
                <rect x={-22} y={-30} width={44} height={16} rx={2} className={s.desk} />
                <rect x={-12} y={-28} width={24} height={6} rx={1} className={cn(s.screen, active === "coding" && s.glow)} />
              </g>
            ))}

            {/* Interview booths: a screen with the AI interviewer in each */}
            {Array.from({ length: 5 }, (_, b) => (
              <g key={b} transform={`translate(${750 + b * 52} 160)`}>
                {b > 0 && <line x1={-26} y1={-90} x2={-26} y2={40} className={s.partition} />}
                <rect x={-18} y={-50} width={36} height={22} rx={3} className={s.screen} />
                <circle cy={-39} r={6} className={cn(s.ai, (active === "interview" || active === "decision") && s.speaking)} />
              </g>
            ))}

            {/* Resume desk: HR with piles of resumes */}
            <rect x={270} y={365} width={40} height={60} rx={3} className={s.desk} />
            <rect x={276} y={372} width={14} height={18} className={s.paper} />
            <rect x={276} y={400} width={14} height={18} className={cn(s.paper, active === "resume" && s.flip)} />
            <Person x={330} y={395} angle={180} walking={false} t={t} look={0} staff chair />

            {/* HR control room: table, team, and the ranking screen with the cut-off */}
            <rect x={470} y={430} width={120} height={70} rx={8} className={s.desk} />
            <Person x={450} y={465} angle={0} walking={false} t={t} look={1} staff chair />
            <Person x={610} y={465} angle={180} walking={false} t={t} look={2} staff chair />
            <Person x={530} y={520} angle={-90} walking={false} t={t} look={3} staff chair />
            <g transform="translate(470 560)" className={cn(s.ranking, active === "decision" && s.active)}>
              <rect width={120} height={44} rx={3} className={s.screen} />
              {[100, 86, 74, 60, 48].map((w, k) => (
                <rect key={k} x={6} y={5 + k * 7} width={w} height={4} className={k < 3 ? s.barPass : s.barFail} />
              ))}
              <line x1={4} y1={26} x2={116} y2={26} className={s.cutoff} />
            </g>

            {/* Offer lounge: HR hands out offers */}
            <rect x={760} y={430} width={180} height={20} rx={3} className={s.desk} />
            <Person x={850} y={405} angle={90} walking={false} t={t} look={4} staff />

            {/* Coding lab tech lead and aptitude invigilator */}
            <Person x={695} y={240} angle={-90} walking={false} t={t} look={5} staff />
            <Person x={invigilatorX} y={270} angle={invigilatorAngle} walking t={t} look={7} staff />

            {Array.from({ length: STUDENTS }, (_, i) => {
              const pose = studentAt(i, t);
              return pose && <Person key={i} {...pose} t={t} look={i} chair={!pose.walking} shirt={pose.leaving ? "var(--ui-color-edge)" : undefined} ring={active === "offer" && !pose.walking} />;
            })}
          </svg>
          <div className={s.legend} aria-hidden>
            <span><i className={s.dotStaff} /> HR staff</span>
            <span><i className={s.dotStudent} /> Students</span>
            <span><i className={s.dotLeaving} /> Not selected, leaving</span>
            <span className={s.hint}>Space: play/pause · ← →: stages</span>
          </div>
        </div>

        <aside className={s.panel}>
          <div className={s.now}>
            <p className={s.step}>
              Stage {p + 1} of {PHASES.length} · {PHASES[p].who}
            </p>
            <h2 className={s.nowTitle}>{PHASES[p].title}</h2>
            <p className={s.nowText}>{PHASES[p].what}</p>
          </div>

          <dl className={s.stats}>
            <div>
              <dt>In the drive</dt>
              <dd>{inDrive(p)}</dd>
            </div>
            <div>
              <dt>Gone home</dt>
              <dd>{left}</dd>
            </div>
            <div>
              <dt>Offers</dt>
              <dd className={active === "offer" ? s.win : undefined}>{active === "offer" ? inDrive(p) : 0}</dd>
            </div>
          </dl>

          <div className={s.controls}>
            <Button variant="secondary" size="sm" onClick={() => setPlaying((v) => !v)}>
              {playing ? <Pause aria-hidden size={16} /> : <Play aria-hidden size={16} />}
              {playing ? "Pause" : "Play"}
            </Button>
            <div className={s.speed} role="group" aria-label="Playback speed">
              {[1, 2, 3].map((x) => (
                <button key={x} type="button" aria-pressed={speed === x} className={cn(s.speedBtn, speed === x && s.current)} onClick={() => setSpeed(x)}>
                  {x}×
                </button>
              ))}
            </div>
          </div>
          <input type="range" className={s.scrub} aria-label="Timeline" min={0} max={LOOP} step={0.1} value={t} onChange={(e) => setT(Number(e.target.value))} aria-valuetext={`${PHASES[p].title}, ${Math.round((t / LOOP) * 100)}%`} />
          <ol className={s.steps}>
            {PHASES.map((ph, k) => (
              <li key={ph.key}>
                <button type="button" className={cn(s.stepBtn, k === p && s.current)} aria-current={k === p ? "step" : undefined} onClick={() => setT(ph.start)}>
                  <span className={s.num}>{k + 1}</span>
                  {ph.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
