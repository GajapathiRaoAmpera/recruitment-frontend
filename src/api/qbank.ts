import { api, apiBlob } from "@/api/client";
import { fromWire as from, json } from "@/api/wire";
import type { Track } from "@/features/papers/types";
import type {
  ApprovalResult,
  ApprovalUpdate,
  Availability,
  Bank,
  BankDetail,
  BankPatch,
  BankQuestion,
  Page,
  QuestionFilters,
} from "@/features/qbank/types";
import type { QuestionEdit } from "@/features/papers/types";

// Data-keyed maps (subject names) stay as they are on the wire.
const RAW = new Set(["subjects", "counts", "by_subject", "by_level"]);
const fromWire = <T>(v: unknown) => from<T>(v, RAW);
const bankPath = (id: string) => `/question-banks/${encodeURIComponent(id)}`;

const query = (params: Record<string, string | number | boolean | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export interface UploadBody {
  file: File;
  name: string;
  track: Track;
  notes?: string;
}

/** Multipart upload: no Content-Type header, the browser sets it with the boundary. */
export async function uploadBank({ file, name, track, notes }: UploadBody) {
  const form = new FormData();
  form.set("file", file);
  form.set("name", name);
  form.set("track", track);
  if (notes?.trim()) form.set("notes", notes.trim());
  return fromWire<Bank>(await api<unknown>("/question-banks", { method: "POST", body: form }));
}

export const listBanks = async (p: { track?: Track; isActive?: boolean; page?: number; pageSize?: number } = {}) =>
  fromWire<Page<Bank>>(
    await api<unknown>(`/question-banks${query({ track: p.track, is_active: p.isActive, page: p.page, page_size: p.pageSize ?? 100 })}`),
  );

export const getAvailability = async (track: Track) =>
  fromWire<Availability>(await api<unknown>(`/question-banks/availability${query({ track })}`));

export const getBank = async (id: string) => fromWire<BankDetail>(await api<unknown>(bankPath(id)));

export const listBankQuestions = async (id: string, f: QuestionFilters = {}) =>
  fromWire<Page<BankQuestion>>(
    await api<unknown>(`${bankPath(id)}/questions${query({ subject: f.subject, level: f.level, approved: f.approved, page: f.page, page_size: f.pageSize })}`),
  );

export const updateBank = async (id: string, patch: BankPatch) => fromWire<BankDetail>(await api<unknown>(bankPath(id), json("PATCH", patch)));

export async function replaceBankFile(id: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  return fromWire<BankDetail>(await api<unknown>(`${bankPath(id)}/file`, { method: "PUT", body: form }));
}

export const deleteBank = async (id: string) => {
  await api<unknown>(bankPath(id), { method: "DELETE" });
};

export const downloadBankFile = (id: string) => apiBlob(`${bankPath(id)}/file`);

export const editBankQuestion = async (id: string, questionId: string, body: QuestionEdit) =>
  fromWire<BankQuestion>(await api<unknown>(`${bankPath(id)}/questions/${encodeURIComponent(questionId)}`, json("PATCH", body)));

export const setApproval = async (id: string, body: ApprovalUpdate) =>
  fromWire<ApprovalResult>(await api<unknown>(`${bankPath(id)}/approval`, json("PUT", body)));
