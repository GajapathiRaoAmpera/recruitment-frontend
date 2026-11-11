"use client";

// shortcut: in-memory mock store (resets on full reload). Replace reads/writes with API hooks per ../docs/04-api-contracts.md.
import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from "react";
import * as seed from "./data";
import type {
  AiPrompt, AuditLog, Candidate, College, Drive, EmailLog, Interview, Question, Round, RoundResult,
  ResultStatus, Session, StaffUser, TranscriptTurn, VerificationLog, Violation,
} from "./types";

export const MAX_TAB_SWITCHES = 3;

export interface State {
  session: Session | null;
  staff: StaffUser[];
  drives: Drive[];
  rounds: Round[];
  candidates: Candidate[];
  results: RoundResult[];
  questions: Question[];
  violations: Violation[];
  interviews: Interview[];
  verificationLogs: VerificationLog[];
  emailLogs: EmailLog[];
  colleges: College[];
  auditLogs: AuditLog[];
  prompts: AiPrompt[];
}

export const initialState: State = {
  session: null,
  staff: seed.staff,
  drives: seed.drives,
  rounds: seed.rounds,
  candidates: seed.candidates,
  results: seed.results,
  questions: seed.questions,
  violations: seed.violations,
  interviews: seed.interviews,
  verificationLogs: seed.verificationLogs,
  emailLogs: seed.emailLogs,
  colleges: seed.colleges,
  auditLogs: seed.auditLogs,
  prompts: seed.prompts,
};

export type Action =
  | { type: "login"; session: Session }
  | { type: "logout" }
  | { type: "createDrive"; drive: Omit<Drive, "id" | "ownerId" | "status">; rounds: Pick<Round, "type" | "mode" | "durationMin" | "threshold">[] }
  | { type: "shortlist"; ids: string[]; value: boolean }
  | { type: "advanceRound"; roundId: string; threshold?: number }
  | { type: "skipRound"; roundId: string }
  | { type: "addTechnicalRound"; driveId: string; mode: Round["mode"] }
  | { type: "setRoundMode"; roundId: string; mode: Round["mode"] }
  | { type: "sendEmails"; roundId: string; template: string }
  | { type: "resumeAttempt"; roundId: string; candidateId: string }
  | { type: "setDecision"; roundId: string; candidateId: string; status: ResultStatus; note?: string }
  | { type: "addQuestions"; questions: Question[] }
  | { type: "updateQuestion"; question: Question }
  | { type: "logVerification"; log: Omit<VerificationLog, "at"> }
  | { type: "startAttempt"; roundId: string; candidateId: string }
  | { type: "tabSwitch"; roundId: string; candidateId: string; kind: Violation["kind"] }
  | { type: "submitAttempt"; roundId: string; candidateId: string; score: number; maxScore: number; timeTakenMin: number; passedCases?: number; totalCases?: number }
  | { type: "saveInterview"; roundId: string; candidateId: string; transcript: TranscriptTurn[] }
  | { type: "setHrNotes"; interviewId: string; notes: string }
  | { type: "updatePrompt"; key: string; body: string }
  | { type: "toggleUser"; id: string }
  | { type: "addUser"; user: Omit<StaffUser, "id" | "lastLogin" | "active"> };

const now = () => new Date().toLocaleString("en-IN", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const time = () => new Date().toLocaleTimeString("en-IN", { hour12: false });

function actorName(s: State) {
  return s.staff.find((u) => u.id === s.session?.userId)?.name ?? "System";
}

function audit(s: State, action: string, target: string): AuditLog[] {
  return [{ id: `a${s.auditLogs.length + 1}-${Date.now()}`, at: now(), actor: actorName(s), action, target }, ...s.auditLogs];
}

function patchResult(results: RoundResult[], roundId: string, candidateId: string, patch: Partial<RoundResult>) {
  return results.map((r) => (r.roundId === roundId && r.candidateId === candidateId ? { ...r, ...patch } : r));
}

/** Ranking used everywhere: score desc, then time taken asc (FR-11). */
export function rank(results: RoundResult[]) {
  return [...results].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.timeTakenMin ?? 999) - (b.timeTakenMin ?? 999));
}

function nextOpenRound(s: State, round: Round) {
  return s.rounds
    .filter((r) => r.driveId === round.driveId && r.position > round.position && r.status !== "skipped")
    .sort((a, b) => a.position - b.position)[0];
}

/** Close `round`, open the next non-skipped round and invite `passedIds` to it. */
function moveOn(s: State, round: Round, passedIds: string[]): Pick<State, "rounds" | "results"> {
  const next = nextOpenRound(s, round);
  const rounds = s.rounds.map((r) =>
    r.id === round.id && r.status !== "skipped" ? { ...r, status: "completed" as const } : next && r.id === next.id ? { ...r, status: "active" as const } : r,
  );
  const invites: RoundResult[] = next
    ? passedIds
        .filter((cid) => !s.results.some((x) => x.roundId === next.id && x.candidateId === cid))
        .map((cid) => ({ roundId: next.id, candidateId: cid, status: "invited", tabSwitches: 0, locked: false }))
    : [];
  return { rounds, results: [...s.results, ...invites] };
}

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "login":
      return { ...s, session: a.session };
    case "logout":
      return { ...s, session: null };

    case "createDrive": {
      const id = `d${s.drives.length + 1}-${Date.now() % 10000}`;
      const drive: Drive = { ...a.drive, id, status: "active", ownerId: s.session?.userId ?? "u1" };
      const rounds: Round[] = a.rounds.map((r, i) => ({
        ...r, id: `${id}-r${i}`, driveId: id, position: i, status: i === 0 ? "active" : "pending",
        title: seed.roundTitle[r.type], questionIds: r.type === "aptitude" ? s.questions.filter((q) => q.kind === "mcq" && q.approved).map((q) => q.id) : r.type === "coding" ? s.questions.filter((q) => q.kind === "coding").map((q) => q.id) : undefined,
      }));
      return { ...s, drives: [...s.drives, drive], rounds: [...s.rounds, ...rounds], auditLogs: audit(s, "Created drive", drive.roleTitle) };
    }

    case "shortlist":
      return {
        ...s,
        candidates: s.candidates.map((c) => (a.ids.includes(c.id) ? { ...c, shortlisted: a.value } : c)),
        auditLogs: audit(s, a.value ? "Shortlisted candidates" : "Removed from shortlist", `${a.ids.length} candidate(s)`),
      };

    case "advanceRound": {
      const round = s.rounds.find((r) => r.id === a.roundId)!;
      let passedIds: string[];
      let results = s.results;
      if (round.type === "shortlist") {
        const shortlisted = s.candidates.filter((c) => c.driveId === round.driveId && c.shortlisted);
        passedIds = shortlisted.map((c) => c.id);
        results = [
          ...s.results.filter((x) => x.roundId !== round.id),
          ...s.candidates.filter((c) => c.driveId === round.driveId).map((c): RoundResult => ({ roundId: round.id, candidateId: c.id, status: c.shortlisted ? "passed" : "failed", tabSwitches: 0, locked: false })),
        ];
      } else {
        const threshold = a.threshold ?? round.threshold ?? 0;
        results = s.results.map((x) => {
          if (x.roundId !== round.id || x.status === "selected" || x.status === "rejected") return x;
          if (x.status === "passed" || x.status === "failed") return x; // manual decisions stand
          const pct = x.score !== undefined && x.maxScore ? (x.score / x.maxScore) * 100 : -1;
          return { ...x, status: pct >= threshold ? "passed" : "failed" };
        });
        passedIds = results.filter((x) => x.roundId === round.id && (x.status === "passed" || x.status === "selected")).map((x) => x.candidateId);
      }
      const moved = moveOn({ ...s, results }, { ...round, threshold: a.threshold ?? round.threshold }, passedIds);
      return {
        ...s,
        ...moved,
        rounds: moved.rounds.map((r) => (r.id === round.id ? { ...r, threshold: a.threshold ?? r.threshold } : r)),
        auditLogs: audit(s, `Advanced round${a.threshold !== undefined ? ` (threshold ${a.threshold}%)` : ""} — ${passedIds.length} moved on`, round.title),
      };
    }

    case "skipRound": {
      const round = s.rounds.find((r) => r.id === a.roundId)!;
      const skipped = { ...s, rounds: s.rounds.map((r) => (r.id === round.id ? { ...r, status: "skipped" as const } : r)) };
      if (round.status !== "active") return { ...skipped, auditLogs: audit(s, "Skipped round", round.title) };
      // Everyone currently in the skipped round moves straight to the next one.
      const ids = s.results.filter((x) => x.roundId === round.id).map((x) => x.candidateId);
      return { ...skipped, ...moveOn(skipped, round, ids), auditLogs: audit(s, "Skipped active round", round.title) };
    }

    case "addTechnicalRound": {
      const driveRounds = s.rounds.filter((r) => r.driveId === a.driveId).sort((x, y) => x.position - y.position);
      const final = driveRounds.find((r) => r.type === "final");
      const position = final ? final.position : driveRounds.length;
      const round: Round = { id: `${a.driveId}-t${Date.now() % 100000}`, driveId: a.driveId, position, type: "technical", mode: a.mode, status: "pending", title: seed.roundTitle.technical, durationMin: 45 };
      return {
        ...s,
        rounds: [...s.rounds.map((r) => (r.driveId === a.driveId && r.position >= position ? { ...r, position: r.position + 1 } : r)), round],
        auditLogs: audit(s, `Added technical round (${a.mode})`, s.drives.find((d) => d.id === a.driveId)!.roleTitle),
      };
    }

    case "setRoundMode":
      return { ...s, rounds: s.rounds.map((r) => (r.id === a.roundId ? { ...r, mode: a.mode } : r)), auditLogs: audit(s, `Set round mode to ${a.mode}`, a.roundId) };

    case "sendEmails": {
      const ids = s.results.filter((x) => x.roundId === a.roundId && x.status === "invited").map((x) => x.candidateId);
      const logs = s.candidates.filter((c) => ids.includes(c.id)).map((c, i): EmailLog => ({ id: `e${Date.now()}-${i}`, roundId: a.roundId, to: c.email, template: a.template, at: now() }));
      return { ...s, emailLogs: [...logs, ...s.emailLogs], auditLogs: audit(s, `Sent "${a.template}" to ${logs.length}`, s.rounds.find((r) => r.id === a.roundId)!.title) };
    }

    case "resumeAttempt":
      return {
        ...s,
        results: patchResult(s.results, a.roundId, a.candidateId, { locked: false, tabSwitches: 0, status: "in_progress" }),
        violations: s.violations.map((v) => (v.roundId === a.roundId && v.candidateId === a.candidateId && !v.hrAction ? { ...v, hrAction: "resumed" } : v)),
        auditLogs: audit(s, "Granted resume access", s.candidates.find((c) => c.id === a.candidateId)!.name),
      };

    case "setDecision":
      return {
        ...s,
        results: patchResult(s.results, a.roundId, a.candidateId, { status: a.status, ...(a.note !== undefined ? { hrNote: a.note } : {}) }),
        auditLogs: audit(s, `Marked ${a.status}`, s.candidates.find((c) => c.id === a.candidateId)!.name),
      };

    case "addQuestions":
      return { ...s, questions: [...a.questions, ...s.questions], auditLogs: audit(s, `Generated ${a.questions.length} AI questions`, "Question bank") };

    case "updateQuestion": {
      const old = s.questions.find((q) => q.id === a.question.id);
      const keyChanged = old?.answer !== a.question.answer;
      return {
        ...s,
        questions: s.questions.map((q) => (q.id === a.question.id ? a.question : q)),
        auditLogs: audit(s, keyChanged ? "Corrected answer key (attempts re-scored)" : a.question.approved && !old?.approved ? "Approved question" : "Edited question", a.question.title),
      };
    }

    case "logVerification":
      return { ...s, verificationLogs: [...s.verificationLogs, { ...a.log, at: time() }] };

    case "startAttempt":
      return { ...s, results: patchResult(s.results, a.roundId, a.candidateId, { status: "in_progress" }) };

    case "tabSwitch": {
      const r = s.results.find((x) => x.roundId === a.roundId && x.candidateId === a.candidateId);
      if (!r || r.locked) return s;
      const count = r.tabSwitches + 1;
      return {
        ...s,
        results: patchResult(s.results, a.roundId, a.candidateId, { tabSwitches: count, locked: count >= MAX_TAB_SWITCHES }),
        violations: [...s.violations, { id: `v${Date.now()}`, roundId: a.roundId, candidateId: a.candidateId, kind: a.kind, at: time() }],
      };
    }

    case "submitAttempt":
      return {
        ...s,
        results: patchResult(s.results, a.roundId, a.candidateId, {
          status: "submitted", score: a.score, maxScore: a.maxScore, timeTakenMin: a.timeTakenMin, passedCases: a.passedCases, totalCases: a.totalCases,
        }),
      };

    case "saveInterview": {
      const existing = s.interviews.find((i) => i.roundId === a.roundId && i.candidateId === a.candidateId);
      const iv: Interview = {
        id: existing?.id ?? `i${Date.now()}`, roundId: a.roundId, candidateId: a.candidateId, slot: existing?.slot ?? time().slice(0, 5),
        status: "completed", transcript: a.transcript, hrNotes: existing?.hrNotes ?? "",
        // Simulated evaluation: longer, more specific answers score higher.
        aiScores: mockEvaluate(a.transcript),
      };
      const score = Math.round(((iv.aiScores!.communication + iv.aiScores!.technical + iv.aiScores!.problemSolving + iv.aiScores!.culture) / 4) * 10) / 10;
      return {
        ...s,
        interviews: existing ? s.interviews.map((i) => (i.id === existing.id ? iv : i)) : [...s.interviews, iv],
        results: patchResult(s.results, a.roundId, a.candidateId, { status: "submitted", score, maxScore: 5 }),
      };
    }

    case "setHrNotes":
      return { ...s, interviews: s.interviews.map((i) => (i.id === a.interviewId ? { ...i, hrNotes: a.notes } : i)) };

    case "updatePrompt":
      return {
        ...s,
        prompts: s.prompts.map((p) => (p.key === a.key ? { ...p, body: a.body, version: p.version + 1 } : p)),
        auditLogs: audit(s, "Updated AI prompt", a.key),
      };

    case "toggleUser": {
      const u = s.staff.find((x) => x.id === a.id)!;
      return { ...s, staff: s.staff.map((x) => (x.id === a.id ? { ...x, active: !x.active } : x)), auditLogs: audit(s, u.active ? "Deactivated user" : "Activated user", u.email) };
    }

    case "addUser":
      return { ...s, staff: [...s.staff, { ...a.user, id: `u${Date.now()}`, active: true, lastLogin: "Never" }], auditLogs: audit(s, `Invited ${a.user.role === "SUPER_ADMIN" ? "Super Admin" : "HR"}`, a.user.email) };
  }
}

export function mockEvaluate(transcript: TranscriptTurn[]) {
  const answers = transcript.filter((t) => t.role === "candidate");
  const avg = answers.reduce((n, t) => n + t.text.split(/\s+/).length, 0) / Math.max(answers.length, 1);
  const base = avg > 25 ? 5 : avg > 12 ? 4 : avg > 5 ? 3 : 2;
  return {
    communication: base,
    technical: Math.max(1, base - (answers.length < 3 ? 1 : 0)),
    problemSolving: base,
    culture: Math.min(5, base + 0),
    summary: avg > 12 ? "Gave structured, specific answers with clear reasoning." : "Answers were short; probe further in the next round.",
  };
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void; ready: boolean } | null>(null);
const SESSION_KEY = "ampera.session";

export function MockStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);

  // Restore the session once on mount (sessionStorage is browser-only), then keep it in sync.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SESSION_KEY);
      if (raw) dispatch({ type: "login", session: JSON.parse(raw) as Session });
    } catch {
      /* no storage: user signs in again */
    }
    setReady(true); // eslint-disable-line react-hooks/set-state-in-effect -- one-time mount flag
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      if (state.session) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
      else window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, [state.session, ready]);

  return <Ctx.Provider value={{ state, dispatch, ready }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside MockStoreProvider");
  return ctx;
}

// Selectors
export const driveRounds = (s: State, driveId: string) => s.rounds.filter((r) => r.driveId === driveId).sort((a, b) => a.position - b.position);
export const roundResults = (s: State, roundId: string) => s.results.filter((r) => r.roundId === roundId);
export const candidateById = (s: State, id: string) => s.candidates.find((c) => c.id === id);
export const activeRound = (s: State, driveId: string) => driveRounds(s, driveId).find((r) => r.status === "active");
export const pct = (r: RoundResult) => (r.score !== undefined && r.maxScore ? Math.round((r.score / r.maxScore) * 100) : undefined);
