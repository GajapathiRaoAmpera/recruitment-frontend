"use client";

import type { AuditEntry } from "@/api/audit-logs";
import { Badge } from "@/components/ui/badge";
import { DialogContent } from "@/components/ui/dialog";
import { actionLabel, actionTone, entityLabel, roleLabel } from "./audit-labels";
import s from "./audit-logs.module.scss";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

const fieldName = (k: string) => {
  const w = k.replace(/_/g, " ");
  return w[0].toUpperCase() + w.slice(1);
};

/** Short readable text for a recorded value; null when it needs the raw JSON view. */
function plain(v: unknown): string | null {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) return v.length ? v.join(", ") : "None";
  return null;
}

function Value({ v }: { v: unknown }) {
  const text = plain(v);
  return text !== null ? <>{text}</> : <pre className={s.json}>{JSON.stringify(v, null, 2)}</pre>;
}

/** {from: {...}, to: {...}}: what an update changed. */
function BeforeAfter({ from, to }: { from: Obj; to: Obj }) {
  const keys = [...new Set([...Object.keys(from), ...Object.keys(to)])];
  return (
    <table className={s.changes}>
      <thead>
        <tr>
          <th scope="col">Field</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => (
          <tr key={k}>
            <td>{fieldName(k)}</td>
            <td className={s.before}>
              <Value v={from[k]} />
            </td>
            <td className={s.after}>
              <Value v={to[k]} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Changes({ diff }: { diff: unknown }) {
  if (diff === null || diff === undefined) return <p className={s.code}>Nothing else was recorded for this event.</p>;
  if (isObj(diff) && isObj(diff.from) && isObj(diff.to)) return <BeforeAfter from={diff.from} to={diff.to} />;
  if (isObj(diff)) {
    return (
      <dl className={s.meta}>
        {Object.entries(diff).map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt>{fieldName(k)}</dt>
            <dd>
              <Value v={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <pre className={s.json}>{JSON.stringify(diff, null, 2)}</pre>;
}

const fullTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" });

/** Side panel body for one event; render inside a controlled <Dialog>. */
export function AuditDetails({ entry, actor }: { entry: AuditEntry; actor: string }) {
  const role = roleLabel(entry.actorRole);
  return (
    <DialogContent side title={actionLabel(entry.action)} description={`Event #${entry.id}`}>
      <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
      <dl className={s.meta} style={{ marginTop: 16 }}>
        <dt>When</dt>
        <dd>
          <time dateTime={entry.createdAt}>{fullTime(entry.createdAt)}</time>
        </dd>
        <dt>Who</dt>
        <dd>
          {actor}
          {role && <> · {role}</>}
          {entry.actorEmail && <span className={s.targetId}>{entry.actorEmail}</span>}
        </dd>
        <dt>Target</dt>
        <dd>
          {entityLabel(entry.entity)}
          {entry.entityId && <span className={s.code} style={{ display: "block" }}>{entry.entityId}</span>}
        </dd>
      </dl>
      <section className={s.section} aria-label="What changed">
        <h3 className={s.sectionTitle}>What changed</h3>
        <Changes diff={entry.diff} />
      </section>
    </DialogContent>
  );
}
