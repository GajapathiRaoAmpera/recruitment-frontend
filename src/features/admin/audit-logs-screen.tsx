"use client";

import { ChevronRight, Clock, Download, RefreshCw, ScrollText, Search, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "@/api/client";
import { type AuditEntry, type AuditFilters, getAuditSummary, listAllAuditLogs, listAuditActions, listAuditLogs } from "@/api/audit-logs";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState, ForbiddenState } from "@/components/ui/states";
import { Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { hire as h, Person, Segment, StatCard } from "@/components/hire/ui";
import { useAsync } from "@/features/papers/use-async";
import { liveApi } from "@/lib/auth";
import { AuditDetails } from "./audit-details";
import { actionLabel, actionTone, entityLabel, groupActions, roleLabel } from "./audit-labels";
import s from "./audit-logs.module.scss";

type StaffOption = { id: string; full_name: string; email: string };
type Range = "all" | "24h" | "7d" | "30d" | "custom";

const RANGES: { id: Range; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "custom", label: "Custom" },
];
const HOURS: Partial<Record<Range, number>> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const timeText = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const num = (n: number) => n.toLocaleString("en-IN");

/** yyyy-mm-dd from a date input → ISO of that local midnight; `plusDays` = 1 gives the exclusive end of the day. */
const dayStart = (d: string, plusDays = 0) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day + plusDays).toISOString();
};

const actorLabel = (a: AuditEntry) => a.actorName ?? a.actorEmail ?? (a.actorId ? "Deleted user" : "System");

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function AuditLogsScreen() {
  useBreadcrumbs([{ label: "Audit logs" }]);
  // Audit logs only exist in the backend; prototype mode (no live API) has no API session to read them with.
  if (!liveApi) {
    return (
      <div className={h.stack}>
        <PageHeader title="Audit logs" description="Every HR and Super Admin action, recorded by the server." />
        <EmptyState icon={<ScrollText aria-hidden size={32} />} title="Audit logs need the backend" description="Sign in with a Super Admin account with the live API enabled to see the real log." />
      </div>
    );
  }
  return <RealAuditLogs />;
}

function RealAuditLogs() {
  const toast = useToast();
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<Range>("all");
  const [rangeSince, setRangeSince] = useState<string>(); // fixed when a preset is picked, so it doesn't drift
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<AuditEntry>();
  const q = useDebounced(search);

  const pickRange = (r: Range) => {
    setRange(r);
    const hours = HOURS[r];
    setRangeSince(hours ? new Date(Date.now() - hours * 3_600_000).toISOString() : undefined);
  };

  const filters = useMemo<AuditFilters>(() => {
    const custom = range === "custom";
    return {
      actorId: actorId || undefined,
      action: action || undefined,
      q: q || undefined,
      since: custom ? (from ? dayStart(from) : undefined) : rangeSince,
      until: custom && to ? dayStart(to, 1) : undefined,
    };
  }, [actorId, action, q, range, rangeSince, from, to]);

  // Filter options and the cards come from the server too: staff accounts and the codes actually in the log.
  const staff = useAsync(() => api<{ items: StaffOption[] }>("/admin/users").then((r) => r.items), []);
  const actions = useAsync(listAuditActions, []);
  const summary = useAsync(getAuditSummary, []);

  const first = useAsync(() => listAuditLogs(filters), [filters]);
  const [more, setMore] = useState<{ key: AuditFilters; items: AuditEntry[]; cursor: string | null }>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Extra pages belong to the filters they were loaded for; a new first page drops them.
  const extra = more && more.key === filters && first.data ? more : undefined;
  const rows = first.data ? [...first.data.items, ...(extra?.items ?? [])] : [];
  const cursor = extra ? extra.cursor : (first.data?.nextCursor ?? null);
  const total = first.data?.total ?? 0;
  const groups = useMemo(() => groupActions(actions.data ?? []), [actions.data]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await listAuditLogs(filters, cursor);
      setMore({ key: filters, items: [...(extra?.items ?? []), ...page.items], cursor: page.nextCursor });
    } catch (e) {
      toast({ tone: "danger", title: "Couldn't load more", description: (e as Error).message });
    } finally {
      setLoadingMore(false);
    }
  };

  const reload = () => {
    setMore(undefined);
    first.reload();
    actions.reload();
    summary.reload();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { items, truncated } = await listAllAuditLogs(filters);
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const header = ["Time", "Actor", "Actor email", "Role", "Event", "Action code", "Target", "Target ID", "Details"];
      const lines = items.map((a) => [
        a.createdAt,
        actorLabel(a),
        a.actorEmail ?? "",
        roleLabel(a.actorRole) ?? "",
        actionLabel(a.action),
        a.action,
        entityLabel(a.entity),
        a.entityId ?? "",
        a.diff == null ? "" : JSON.stringify(a.diff),
      ]);
      const csv = [header, ...lines].map((r) => r.map(esc).join(",")).join("\n");
      const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: "audit-logs.csv" });
      link.click();
      URL.revokeObjectURL(link.href);
      if (truncated) toast({ tone: "info", title: "Export limited to the newest 10,000 events", description: "Narrow the filters to export older events." });
    } catch (e) {
      toast({ tone: "danger", title: "Export failed", description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const forbidden = [first.error, staff.error, actions.error, summary.error].some((e) => e instanceof ApiError && e.status === 403);
  if (forbidden) return <ForbiddenState />;

  const filtered = Boolean(actorId || action || q || range !== "all");
  const clear = () => {
    setActorId("");
    setAction("");
    setSearch("");
    pickRange("all");
    setFrom("");
    setTo("");
  };
  const stat = (n: number | undefined) => (n === undefined ? "—" : num(n));

  return (
    <div className={h.stack}>
      <PageHeader
        title="Audit logs"
        description="Every HR and Super Admin action, recorded by the server as it happens."
        actions={
          <span className={h.row}>
            <Button variant="secondary" onClick={reload} loading={first.loading && Boolean(first.data)} aria-label="Refresh audit logs">
              <RefreshCw aria-hidden size={14} style={{ marginRight: 4 }} /> Refresh
            </Button>
            <Button onClick={exportCsv} loading={exporting} disabled={rows.length === 0}>
              <Download aria-hidden size={16} style={{ marginRight: 4 }} /> Export CSV
            </Button>
          </span>
        }
      />

      <div className={h.grid4}>
        <StatCard label="Total events" value={stat(summary.data?.total)} hint="Since the log began" icon={ScrollText} />
        <StatCard label="Last 24 hours" value={stat(summary.data?.last24h)} hint="Events today and overnight" icon={Clock} />
        <StatCard label="People" value={stat(summary.data?.actors)} hint="Staff with recorded actions" icon={Users} />
        <StatCard label="Access changes" value={stat(summary.data?.accessChanges)} hint="Invites, role and status changes" icon={ShieldCheck} />
      </div>

      <section className={s.filters} aria-label="Filters">
        <div className={s.filterTop}>
          <Segment options={RANGES} value={range} onChange={pickRange} label="Time range" />
          {filtered && (
            <Button variant="tertiary" size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}
        </div>
        {range === "custom" && (
          <div className={s.dates}>
            <Field label="From">
              <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To">
              <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
        <div className={s.filterGrid}>
          <Field label="Actor">
            <Select value={actorId} onChange={(e) => setActorId(e.target.value)}>
              <option value="">Everyone</option>
              {staff.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Event type">
            <Select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All events</option>
              {groups.map((g) => (
                <optgroup key={g.area} label={g.area}>
                  {g.codes.map((c) => (
                    <option key={c} value={c}>
                      {actionLabel(c)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <div className={s.search}>
            <Field label="Search">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Person, action or target ID" maxLength={200} />
            </Field>
            <Search aria-hidden size={16} className={s.searchIcon} />
          </div>
        </div>
      </section>

      {first.error && !first.data ? (
        <ErrorState message={first.error.message} onRetry={first.reload} />
      ) : (
        <section className={s.stream} aria-labelledby="stream-h">
          <div className={s.streamHead}>
            <h2 id="stream-h" className={s.streamTitle}>
              <span aria-hidden className={s.live} /> Event stream
            </h2>
            {first.data && (
              <span className={h.xs} aria-live="polite">
                Showing {num(rows.length)} of {num(total)} {filtered ? "matching " : ""}event{total === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {!first.data || (first.loading && rows.length === 0) ? (
            <RocketLoader label="Loading audit logs" />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ScrollText aria-hidden size={32} />}
              title={filtered ? "No matching events" : "No events yet"}
              description={filtered ? "Try a wider time range or other filters." : "Actions such as creating a drive or advancing a round appear here."}
              action={
                filtered ? (
                  <Button variant="secondary" onClick={clear}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className={s.scroll}>
                <table className={s.table} aria-busy={first.loading}>
                  <thead>
                    <tr>
                      <Th>When</Th>
                      <Th>Who</Th>
                      <Th>Event</Th>
                      <Th>Target</Th>
                      <Th>
                        <span className="sr-only">Details</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const who = actorLabel(a);
                      const role = roleLabel(a.actorRole);
                      return (
                        <tr key={a.id} className={s.row}>
                          <Td className={s.when}>
                            <time dateTime={a.createdAt}>
                              <span className={s.whenDate}>{dateText(a.createdAt)}</span>
                              <span className={s.whenTime}>{timeText(a.createdAt)}</span>
                            </time>
                          </Td>
                          <Td>
                            <Person name={who} meta={role ?? a.actorEmail ?? undefined} />
                          </Td>
                          <Td>
                            <span className={s.event}>
                              <Badge tone={actionTone(a.action)}>{actionLabel(a.action)}</Badge>
                              <span className={s.code}>{a.action}</span>
                            </span>
                          </Td>
                          <Td>
                            <span className={s.target}>{entityLabel(a.entity)}</span>
                            {a.entityId && (
                              <span className={s.targetId} title={a.entityId}>
                                {a.entityId}
                              </span>
                            )}
                          </Td>
                          <Td className={s.actions}>
                            <Button variant="tertiary" size="sm" onClick={() => setOpen(a)} aria-label={`Details: ${actionLabel(a.action)} by ${who}`}>
                              Details <ChevronRight aria-hidden size={14} />
                            </Button>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={s.footer}>
                <span>
                  {num(rows.length)} of {num(total)} loaded
                </span>
                {cursor && (
                  <Button variant="secondary" size="sm" onClick={loadMore} loading={loadingMore}>
                    Load more
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <Dialog open={open !== undefined} onOpenChange={(v) => !v && setOpen(undefined)}>
        {open && <AuditDetails entry={open} actor={actorLabel(open)} />}
      </Dialog>
    </div>
  );
}
