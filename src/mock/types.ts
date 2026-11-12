// Shapes mirror ../docs/03-database-schema.md so swapping mock → API keeps components unchanged.

export type StaffRole = "HR" | "SUPER_ADMIN";
export type Role = StaffRole | "STUDENT";

export type RoundType = "shortlist" | "aptitude" | "coding" | "ai_interview" | "technical" | "final";
export type RoundMode = "ai" | "manual" | "auto";
export type RoundStatus = "pending" | "active" | "skipped" | "completed";
export type ResultStatus = "invited" | "in_progress" | "submitted" | "passed" | "failed" | "selected" | "rejected";
export type Difficulty = "easy" | "medium" | "advanced";

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  title: string;
  role: StaffRole;
  active: boolean;
  lastLogin: string;
}

export interface Drive {
  id: string;
  company: string;
  campus: string;
  roleTitle: string;
  jd: string;
  status: "draft" | "active" | "closed";
  window: string;
  ownerId: string;
}

export interface Round {
  id: string;
  driveId: string;
  position: number;
  type: RoundType;
  mode: RoundMode;
  status: RoundStatus;
  title: string;
  threshold?: number;
  durationMin?: number;
  questionIds?: string[];
}

export interface Candidate {
  id: string;
  driveId: string;
  studentId: string;
  dob: string; // yyyy-mm-dd
  name: string;
  email: string;
  branch: string;
  cgpa: number;
  skills: string[];
  jdMatch: number;
  parseStatus: "ok" | "failed";
  shortlisted: boolean | null;
}

export interface RoundResult {
  roundId: string;
  candidateId: string;
  status: ResultStatus;
  score?: number;
  maxScore?: number;
  timeTakenMin?: number;
  tabSwitches: number;
  locked: boolean;
  hrNote?: string;
  passedCases?: number; // coding: of 18 per question, summed
  totalCases?: number;
}

export interface Question {
  id: string;
  kind: "mcq" | "coding";
  title: string;
  body: string;
  options?: string[];
  answer?: number;
  tags: string[];
  difficulty: Difficulty;
  marks: number;
  aiGenerated: boolean;
  approved: boolean;
  samples?: { input: string; expected: string }[];
  hiddenCount?: number;
}

export interface Violation {
  id: string;
  roundId: string;
  candidateId: string;
  kind: "tab_switch" | "fullscreen_exit";
  at: string;
  hrAction?: "resumed" | "dismissed";
}

export interface TranscriptTurn {
  role: "ai" | "candidate";
  text: string;
}

export interface AiScores {
  communication: number;
  technical: number;
  problemSolving: number;
  culture: number;
  summary: string;
}

export interface Interview {
  id: string;
  roundId: string;
  candidateId: string;
  slot: string;
  status: "scheduled" | "completed";
  transcript: TranscriptTurn[];
  aiScores?: AiScores;
  hrNotes: string;
}

export interface VerificationLog {
  roundId: string;
  candidateId: string;
  step: "id_dob" | "location" | "terms" | "fullscreen";
  ok: boolean;
  at: string;
}

export interface EmailLog {
  id: string;
  roundId: string;
  to: string;
  template: string;
  at: string;
}

export interface College {
  id: string;
  name: string;
  city: string;
  tpo: string;
  tpoEmail: string;
  registered: number;
  hired: number;
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}

export interface AiPrompt {
  key: string;
  label: string;
  body: string;
  version: number;
}

import type { StudentSession } from "@/api/entry";

export interface Session {
  role: Role;
  userId?: string; // staff
  staff?: StaffUser; // real Supabase sign-in: the /me user, kept in the session so a refresh still knows them
  candidateId?: string; // student (prototype)
  student?: StudentSession; // student signed in through the API
}
