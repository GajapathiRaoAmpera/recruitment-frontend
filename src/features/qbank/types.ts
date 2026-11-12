/** Camel-cased DTOs for the PDF question banks (/question-banks). api/qbank.ts maps the wire in one place. */
import type { Level, Track } from "@/features/papers/types";

export type EmbeddingStatus = "pending" | "done" | "failed" | "skipped";

export interface Bank {
  id: string;
  name: string;
  filename: string;
  sha256: string;
  track: Track;
  notes: string | null;
  status: "ready" | "failed";
  isActive: boolean;
  uploadedBy: string;
  embeddingStatus: EmbeddingStatus;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  approvedCount: number;
  /** The caller may edit, approve, replace or delete it (uploader or Super Admin). */
  canManage: boolean;
}

export interface ParseReport {
  total: number;
  bySubject: Record<string, number>;
  byLevel: Record<string, number>;
  warnings: string[];
  skipped: string[];
}

export interface BankDetail extends Bank {
  report: ParseReport;
  /** subject → level → counts */
  counts: Record<string, Partial<Record<Level, { total: number; approved: number }>>>;
}

export interface BankQuestion {
  id: string;
  sourceId: string;
  subject: string | null;
  topic: string | null;
  level: Level;
  text: string;
  options: string[];
  answer: number;
  explanation: string | null;
  approved: boolean;
  warnings: string[];
  sourceNumber: number | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BankPatch {
  name?: string;
  track?: Track;
  notes?: string | null;
  isActive?: boolean;
}

export type ApprovalUpdate =
  | { approved: boolean; scope: "all_clean" }
  | { approved: boolean; scope: "subject"; subject: string }
  | { approved: boolean; scope: "ids"; questionIds: string[] };

export interface ApprovalResult {
  changed: number;
  questionCount: number;
  approvedCount: number;
}

/** Approved questions in active banks of a track (what a paper can draw on). */
export interface Availability {
  track: Track;
  subjects: Record<string, Record<Level, number>>;
  byLevel: Record<Level, number>;
  total: number;
}

export interface QuestionFilters {
  subject?: string;
  level?: Level;
  approved?: boolean;
  page?: number;
  pageSize?: number;
}
