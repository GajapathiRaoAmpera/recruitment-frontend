// Bird's-eye storyboard of one campus drive. Pure timeline maths so the board can be tested without rendering.

export interface Pt {
  x: number;
  y: number;
}
export interface Pose extends Pt {
  angle: number; // degrees; 0 = facing right
  walking: boolean;
  opacity: number;
  leaving?: boolean; // did not clear the last round, on the way out
}

export const PHASES = [
  { key: "arrive", start: 0, title: "Students arrive", who: "Students", what: "Shortlisted-to-be students reach the campus gate and wait outside the office. HR has already created the drive, the job description and the round plan." },
  { key: "resume", start: 3.5, title: "Resume shortlist", who: "HR + system", what: "HR uploads the resume sheet. The system extracts CGPA and skills and scores each resume against the JD; HR reviews the ranking and sets the cut-off." },
  { key: "aptitude", start: 8, title: "Aptitude test", who: "Students, HR invigilates", what: "Shortlisted students take a timed MCQ paper HR generated and published. Answers auto-save; three tab switches lock the attempt for HR review." },
  { key: "coding", start: 12.5, title: "Coding test", who: "Students, judged by Judge0", what: "Students solve coding and SQL problems in the browser editor. Code runs only on Judge0 through the API, against hidden test cases students never see." },
  { key: "interview", start: 17, title: "AI interview", who: "Students + AI interviewer", what: "Each student talks to the live AI interviewer in their own booth. The transcript and scores land on HR's desk." },
  { key: "decision", start: 21.5, title: "HR decision", who: "HR", what: "HR compares every round's scores in the ranking view, previews the cut-off and advances or rejects. Nothing moves forward without HR." },
  { key: "offer", start: 25, title: "Offers", who: "HR + selected students", what: "Selected students receive their offers. Everyone else was notified as they left each round." },
] as const;
export const LOOP = 30;

export const CORRIDOR_Y = 310;
const EXIT: Pt = { x: -40, y: CORRIDOR_Y };
const WALK = 2.2; // seconds to walk between rooms
const STAGGER = 0.08; // seconds between students setting off, so they don't move as one blob
const EXIT_WALK = 3;

// Last phase each of the 12 students takes part in (12 → 9 → 7 → 5 → 3 selected).
export const LAST = [6, 1, 3, 5, 2, 6, 1, 3, 5, 2, 6, 1];
export const STUDENTS = LAST.length;

/** Students still in the drive during a phase. */
export const inDrive = (p: number) => LAST.filter((last) => last >= p).length;

const present = PHASES.map((_, p) => LAST.flatMap((last, i) => (last >= p ? [i] : [])));

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export function phaseAt(t: number): number {
  let p = 0;
  PHASES.forEach((ph, i) => t >= ph.start && (p = i));
  return p;
}

/** Where a student sits during a phase (rank = place among the students still in the drive). */
export function slot(p: number, i: number): Pt {
  const r = present[p].indexOf(i);
  switch (PHASES[p].key) {
    case "arrive":
      return { x: 60, y: 345 + r * 22 };
    case "resume":
      return { x: 150 + (r % 4) * 40, y: 450 + Math.floor(r / 4) * 50 };
    case "aptitude":
      return { x: 180 + (r % 3) * 90, y: 85 + Math.floor(r / 3) * 70 };
    case "coding":
      return { x: 470 + (r % 4) * 65, y: 105 + Math.floor(r / 4) * 100 };
    case "interview":
    case "decision": // students wait in their booths while HR decides
      return { x: 750 + r * 52, y: 160 };
    default:
      return { x: 780 + r * 60, y: 500 };
  }
}

/** Rooms join only through the corridor: walk out to it, along it, then in. */
function route(a: Pt, b: Pt): Pt[] {
  return [a, { x: a.x, y: CORRIDOR_Y }, { x: b.x, y: CORRIDOR_Y }, b];
}

function along(path: Pt[], k: number): Pt & { angle: number; length: number } {
  const segs = path.slice(1).map((b, j) => ({ a: path[j], b, len: Math.hypot(b.x - path[j].x, b.y - path[j].y) }));
  const length = segs.reduce((s, g) => s + g.len, 0);
  let d = k * length;
  for (const g of segs) {
    if (g.len === 0) continue;
    if (d <= g.len) {
      const f = d / g.len;
      return { x: g.a.x + (g.b.x - g.a.x) * f, y: g.a.y + (g.b.y - g.a.y) * f, angle: (Math.atan2(g.b.y - g.a.y, g.b.x - g.a.x) * 180) / Math.PI, length };
    }
    d -= g.len;
  }
  const end = path[path.length - 1];
  return { ...end, angle: -90, length };
}

/** A student's pose at time t, or null once they have left the campus. */
export function studentAt(i: number, t: number): Pose | null {
  const p = phaseAt(t);
  const local = t - PHASES[p].start;
  const last = LAST[i];
  if (p > last + 1) return null;

  if (p === last + 1) {
    if (local >= EXIT_WALK) return null;
    const pt = along(route(slot(last, i), EXIT), clamp(local / EXIT_WALK));
    return { x: pt.x, y: pt.y, angle: pt.angle, walking: true, leaving: true, opacity: 1 - clamp((local - (EXIT_WALK - 1.5)) / 1.5) };
  }

  const rank = present[p].indexOf(i);
  const to = slot(p, i);
  const path = p === 0 ? [{ x: 60, y: 660 + rank * 24 }, to] : route(slot(p - 1, i), to);
  const k = clamp((local - rank * STAGGER) / WALK);
  const pt = along(path, k);
  const walking = k < 1 && pt.length > 0;
  return { x: pt.x, y: pt.y, angle: walking ? pt.angle : -90, walking, opacity: 1 };
}
