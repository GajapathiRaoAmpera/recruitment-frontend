import { api } from "@/api/client";
import { fromWire, json } from "@/api/wire";
import type { AiStatus, Draft, DraftDetail, PaperSettings, QuestionEdit, SendResult } from "@/features/papers/types";

const draftPath = (id: string) => `/papers/drafts/${encodeURIComponent(id)}`;

export const aiStatus = async () => fromWire<AiStatus>(await api<unknown>("/papers/ai-status"));

export const createDraft = async (body: { driveRef: string; title: string; settings: PaperSettings }) =>
  fromWire<Draft>(await api<unknown>("/papers/drafts", json("POST", body)));

export const listDrafts = async () => fromWire<Draft[]>(await api<unknown>("/papers/drafts"));

export const getDraft = async (id: string) => fromWire<DraftDetail>(await api<unknown>(draftPath(id)));

export const editQuestion = async (id: string, questionId: string, body: QuestionEdit) =>
  fromWire<DraftDetail>(await api<unknown>(`${draftPath(id)}/questions/${encodeURIComponent(questionId)}`, json("PATCH", body)));

export const setSelection = async (id: string, selectedIds: string[]) =>
  fromWire<DraftDetail>(await api<unknown>(`${draftPath(id)}/selection`, json("PUT", { selectedIds })));

export const acceptDraft = async (id: string) => fromWire<Draft>(await api<unknown>(`${draftPath(id)}/accept`, { method: "POST" }));

export const sendPapers = async (id: string, candidateRefs: string[]) =>
  fromWire<SendResult>(await api<unknown>(`${draftPath(id)}/send`, json("POST", { candidateRefs })));
