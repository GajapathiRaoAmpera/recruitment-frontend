import { api } from "@/api/client";
import type { AiStatus, Draft, DraftDetail, PaperSettings, QuestionEdit, SendResult } from "@/features/papers/types";

// The single place wire snake_case <-> app camelCase is mapped. Wire keys are all lower snake_case
// identifiers (enum values such as "non_it" are values, never keys), so a structural key map is safe.
const toCamelKey = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toSnakeKey = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function mapKeys(value: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(value)) return value.map((v) => mapKeys(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), mapKeys(v, fn)]));
  }
  return value;
}

const fromWire = <T>(v: unknown) => mapKeys(v, toCamelKey) as T;
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(mapKeys(body, toSnakeKey)),
});
const draftPath = (id: string) => `/papers/drafts/${encodeURIComponent(id)}`;

export const aiStatus = async () => fromWire<AiStatus>(await api<unknown>("/papers/ai-status"));

export const createDraft = async (body: { driveRef: string; title: string; settings: PaperSettings }) =>
  fromWire<Draft>(await api<unknown>("/papers/drafts", json("POST", body)));

export const listDrafts = async () => fromWire<Draft[]>(await api<unknown>("/papers/drafts"));

export const getDraft = async (id: string) => fromWire<DraftDetail>(await api<unknown>(draftPath(id)));

export const editQuestion = async (id: string, questionId: string, body: QuestionEdit) =>
  fromWire<DraftDetail>(await api<unknown>(`${draftPath(id)}/questions/${encodeURIComponent(questionId)}`, json("PATCH", body)));

export const acceptDraft = async (id: string) => fromWire<Draft>(await api<unknown>(`${draftPath(id)}/accept`, { method: "POST" }));

export const sendPapers = async (id: string, candidateRefs: string[]) =>
  fromWire<SendResult>(await api<unknown>(`${draftPath(id)}/send`, json("POST", { candidateRefs })));
