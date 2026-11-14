import { api } from "@/api/client";
import { fromWire } from "@/api/wire";

// Super Admin audit log (backend GET /admin/audit-logs). Read only.

export interface AuditEntry {
  id: number;
  createdAt: string; // ISO
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: "hr" | "super_admin" | null;
  action: string; // e.g. round.advance, user.update
  entity: string;
  entityId: string | null;
  diff: unknown; // recorded as-is: keys are data, never camelCased
}

export interface AuditPage {
  items: AuditEntry[];
  nextCursor: string | null;
  total: number; // rows matching the filters, all pages
}

export interface AuditSummary {
  total: number;
  last24h: number;
  actors: number;
  accessChanges: number; // user.* events
}

export interface AuditFilters {
  actorId?: string;
  action?: string;
  q?: string;
  since?: string; // ISO datetime, inclusive
  until?: string; // ISO datetime, exclusive
}

const RAW = new Set(["diff"]);

export async function listAuditLogs(f: AuditFilters, cursor?: string | null, limit = 50): Promise<AuditPage> {
  const p = new URLSearchParams({ limit: String(limit) });
  if (f.actorId) p.set("actor_id", f.actorId);
  if (f.action) p.set("action", f.action);
  if (f.q?.trim()) p.set("q", f.q.trim());
  if (f.since) p.set("since", f.since);
  if (f.until) p.set("until", f.until);
  if (cursor) p.set("cursor", cursor);
  return fromWire<AuditPage>(await api<unknown>(`/admin/audit-logs?${p}`), RAW);
}

export const listAuditActions = () => api<string[]>("/admin/audit-logs/actions");

export const getAuditSummary = async () => fromWire<AuditSummary>(await api<unknown>("/admin/audit-logs/summary"));

/** Every row matching `f`, page by page, stopping at `max` rows (CSV export). */
export async function listAllAuditLogs(f: AuditFilters, max = 10_000): Promise<{ items: AuditEntry[]; truncated: boolean }> {
  const items: AuditEntry[] = [];
  let cursor: string | null = null;
  do {
    const page = await listAuditLogs(f, cursor, 200);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < max);
  return { items: items.slice(0, max), truncated: cursor !== null || items.length > max };
}
