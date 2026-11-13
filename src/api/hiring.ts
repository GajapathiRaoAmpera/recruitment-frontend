import { api, ApiError } from "@/api/client";
import { supabase } from "@/lib/supabase";

// Drives, candidate import, resumes and shortlisting (backend app/drives + app/candidates).
// Wire snake_case is mapped by hand here: candidate form_data keys are spreadsheet headers and must stay untouched.

export interface Drive {
  id: string;
  company: string;
  campus: string;
  roleTitle: string;
  jdText: string;
  status: string;
  candidates: number;
}

export interface CandidateRow {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  cgpa: number | null;
  skills: string[];
  jdMatch: number | null;
  parseStatus: "ok" | "failed" | "pending" | "missing"; // missing = no resume yet
  shortlisted: boolean | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

export type FetchStatus = "parsed" | "parse_failed" | "no_link" | "not_accessible" | "not_pdf" | "too_large" | "storage_failed";
export interface FetchItem {
  candidateId: string;
  studentId: string;
  status: FetchStatus;
}

export interface CandidateProfile {
  id: string;
  driveId: string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string | null;
  formData: Record<string, unknown>;
  resume: { cgpa: number | null; skills: string[]; jdMatch: number | null; parseStatus: string; shortlisted: boolean | null } | null;
  rounds: { roundId: string; position: number; type: string; status: string; score: number | null; rank: number | null; hrNote: string | null }[];
}

export interface CandidateFilters {
  skills?: string;
  minCgpa?: number;
  minMatch?: number;
  shortlisted?: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- wire shapes are mapped field by field below */
const toDrive = (d: any): Drive => ({ id: d.id, company: d.company, campus: d.campus, roleTitle: d.role_title, jdText: d.jd_text, status: d.status, candidates: d.candidates });
const toRow = (c: any): CandidateRow => ({ id: c.id, studentId: c.student_id, fullName: c.full_name, email: c.email, cgpa: c.cgpa, skills: c.skills, jdMatch: c.jd_match, parseStatus: c.parse_status, shortlisted: c.shortlisted });
/* eslint-enable @typescript-eslint/no-explicit-any */

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const listDrives = async () => (await api<unknown[]>("/drives")).map(toDrive);
export const getDrive = async (id: string) => toDrive(await api<unknown>(`/drives/${id}`));

export interface RoundSetup {
  type: "shortlist" | "aptitude" | "coding" | "ai_interview" | "technical" | "final";
  mode: "ai" | "manual" | "auto";
  threshold?: number; // cut-off %
  durationMin?: number; // minutes the test runs
}

/** `rounds` is the pipeline in order; the server saves it with the drive. */
export const createDrive = async (b: { company: string; campus: string; roleTitle: string; jdText: string; rounds: RoundSetup[] }) =>
  toDrive(await api<unknown>("/drives", json("POST", { company: b.company, campus: b.campus, role_title: b.roleTitle, jd_text: b.jdText, rounds: b.rounds.map((r) => ({ type: r.type, mode: r.mode, threshold: r.threshold, duration_min: r.durationMin })) })));

/** Google Form export (.xlsx / .csv). Bad rows come back in `errors`; good rows are imported. */
export const importCandidates = (driveId: string, sheet: File) => {
  const body = new FormData();
  body.append("sheet", sheet);
  return api<ImportResult>(`/drives/${driveId}/candidates/import`, { method: "POST", body });
};

/** Downloads each candidate's resume from the Drive link in their form answers, then parses it. Can take a minute. */
export const fetchResumes = async (driveId: string, refetch = false) =>
  (await api<{ results: { candidate_id: string; student_id: string; status: FetchStatus }[] }>(`/drives/${driveId}/resumes/fetch?refetch=${refetch}`, { method: "POST" })).results.map(
    (r): FetchItem => ({ candidateId: r.candidate_id, studentId: r.student_id, status: r.status }),
  );

/** All candidates of a drive matching the filters (follows the API's cursor until the end). */
export async function listCandidates(driveId: string, f: CandidateFilters = {}): Promise<CandidateRow[]> {
  const q = new URLSearchParams({ limit: "200" });
  if (f.skills?.trim()) q.set("skills", f.skills);
  if (f.minCgpa) q.set("min_cgpa", String(f.minCgpa));
  if (f.minMatch) q.set("min_match", String(f.minMatch));
  if (f.shortlisted !== undefined) q.set("shortlisted", String(f.shortlisted));
  const rows: CandidateRow[] = [];
  for (let cursor: string | null = ""; cursor !== null; ) {
    if (cursor) q.set("cursor", cursor);
    const page: { items: unknown[]; next_cursor: string | null } = await api(`/drives/${driveId}/candidates?${q}`);
    rows.push(...page.items.map(toRow));
    cursor = page.next_cursor;
  }
  return rows;
}

/**
 * `updated`: candidates saved (those without a resume are skipped). `moved`: invited to Round 1 when shortlisting,
 * or taken out of it again when un-shortlisting (only those who haven't started).
 */
export const shortlist = async (driveId: string, candidateIds: string[], shortlisted: boolean) => {
  const r = await api<{ updated: number; moved: number }>(`/drives/${driveId}/shortlist`, json("POST", { candidate_ids: candidateIds, shortlisted }));
  return { updated: r.updated, moved: r.moved };
};

export async function getCandidate(id: string): Promise<CandidateProfile> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = await api<unknown>(`/candidates/${id}`);
  return {
    id: c.id,
    driveId: c.drive_id,
    studentId: c.student_id,
    fullName: c.full_name,
    email: c.email,
    phone: c.phone,
    formData: c.form_data,
    resume: c.resume && { cgpa: c.resume.cgpa, skills: c.resume.skills, jdMatch: c.resume.jd_match, parseStatus: c.resume.parse_status, shortlisted: c.resume.shortlisted },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rounds: c.rounds.map((r: any) => ({ roundId: r.round_id, position: r.position, type: r.type, status: r.status, score: r.score, rank: r.rank, hrNote: r.hr_note })),
  };
}

/** The resume PDF sits behind the HR login, so a plain link would be rejected: fetch it with the token and open the blob. */
export async function openResume(candidateId: string): Promise<void> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const res = await fetch(`/api/v1/candidates/${candidateId}/resume`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.code ?? `HTTP_${res.status}`, body?.error?.message ?? "Couldn't open the resume.");
  }
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export type StepName = "id_dob" | "location" | "terms" | "fullscreen";
export interface ProgressRow {
  candidateId: string;
  studentId: string;
  fullName: string;
  status: string;
  steps: Record<StepName, boolean | null>; // null = never tried
  attemptStatus: "in_progress" | "submitted" | "locked" | "expired" | null; // null = not started
  startedAt: string | null;
  submittedAt: string | null;
  marks: number | null;
  tabSwitches: number;
}
export interface RoundProgress {
  roundId: string;
  type: string;
  status: string;
  candidates: ProgressRow[];
}

/** Live progress of one round: entry checks, attempt status, tab switches and marks per candidate. */
export async function getRoundProgress(driveId: string, roundId: string): Promise<RoundProgress> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = await api<unknown>(`/drives/${driveId}/rounds/${roundId}/progress`);
  return {
    roundId: p.round_id,
    type: p.type,
    status: p.status,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    candidates: p.candidates.map((c: any): ProgressRow => ({
      candidateId: c.candidate_id, studentId: c.student_id, fullName: c.full_name, status: c.status, steps: c.steps,
      attemptStatus: c.attempt_status, startedAt: c.started_at, submittedAt: c.submitted_at, marks: c.marks, tabSwitches: c.tab_switches,
    })),
  };
}

export const listRounds = async (driveId: string) =>
  (await api<{ id: string; position: number; type: string; status: string }[]>(`/drives/${driveId}/rounds`)).map((r) => ({ id: r.id, position: r.position, type: r.type, status: r.status }));

export interface RoundCounts {
  roundId: string;
  position: number;
  type: string;
  status: string;
  total: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
  locked: number;
  expired: number;
}
export interface DriveProgress {
  driveId: string;
  company: string;
  campus: string;
  roleTitle: string;
  rounds: RoundCounts[];
}

/** Super Admin only: every drive with per-round counts of who is where. */
export async function getProgressOverview(): Promise<DriveProgress[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await api<any[]>("/admin/progress")).map((d): DriveProgress => ({
    driveId: d.drive_id, company: d.company, campus: d.campus, roleTitle: d.role_title,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rounds: d.rounds.map((r: any): RoundCounts => ({
      roundId: r.round_id, position: r.position, type: r.type, status: r.status, total: r.total,
      notStarted: r.not_started, inProgress: r.in_progress, submitted: r.submitted, locked: r.locked, expired: r.expired,
    })),
  }));
}
