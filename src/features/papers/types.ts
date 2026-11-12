/** Camel-cased DTOs for the Round 1 paper builder. The wire is snake_case; api/papers.ts maps in one place. */
export type Track = "it" | "non_it";
export type Level = "easy" | "medium" | "advanced";
export type Section = "aptitude" | "reasoning" | "technical";
export type DraftStatus = "generating" | "draft" | "accepted" | "failed";

export interface PaperSettings {
  track: Track;
  counts: Record<Level, number>;
  mix: Record<Section, number>;
  itSyntaxPercent: number;
  poolFactor: number;
  durationMin: number;
  differentPerStudent: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  /** IT Technical from the PDF banks: subject name → weight (sum 100); null/absent = even split. */
  subjects?: Record<string, number> | null;
  /** Steers bank retrieval when embeddings exist (≤ 200 chars). */
  focus?: string | null;
}

export interface Progress {
  done: number;
  total: number;
}

export interface Draft {
  id: string;
  driveRef: string;
  ownerId: string;
  title: string;
  track: Track;
  status: DraftStatus;
  settings: PaperSettings;
  progress: Progress;
  error: string | null;
  poolSize: number;
  createdAt: string;
  acceptedAt: string | null;
  persistedAt: string | null;
}

export interface KeyItem {
  id: string;
  level: Level;
  section: Section;
  topic: string;
  text: string;
  options: string[];
  answer: number;
  why: string;
  fixedOptions: boolean;
  edited: boolean;
}

/** A generated pool question with HR's pick; options are in their original order. */
export interface PoolItem extends KeyItem {
  selected: boolean;
}

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface Overlap {
  shared: number;
  samePosition: number;
  total: number;
}

export interface Issue {
  candidateRef: string;
  issuedAt: string;
}

export interface DraftDetail extends Draft {
  checks: Check[];
  sample: KeyItem[];
  overlap: Overlap | null;
  issues: Issue[];
  editedCount: number;
  pool: PoolItem[];
  selectedCount: number;
}

export interface QuestionEdit {
  text: string;
  options: string[];
  answer: number;
  why: string;
}

export interface SendResult {
  sent: number;
  alreadySent: number;
}

export interface AiStatus {
  gemini: boolean;
  groq: boolean;
}
