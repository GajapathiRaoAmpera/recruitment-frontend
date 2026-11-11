"use client";

import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { initials } from "@/components/shell/profile-menu";
import type { ResultStatus, Round } from "@/mock/types";
import s from "./hire.module.scss";

export { s as hire };

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className={s.stat}>
      <div className={s.statHead}>
        <span>{label}</span>
        {Icon && (
          <span className={s.statIcon}>
            <Icon aria-hidden size={16} />
          </span>
        )}
      </div>
      <p className={s.statValue}>{value}</p>
      {hint && <p className={s.statHint}>{hint}</p>}
    </div>
  );
}

const shortLabel: Record<Round["type"], string> = {
  shortlist: "Shortlist",
  aptitude: "Aptitude",
  coding: "Coding",
  ai_interview: "AI interview",
  technical: "Technical",
  final: "Final",
};

export function roundLabel(r: Round) {
  return shortLabel[r.type];
}

export function PipelineSteps({ rounds }: { rounds: Round[] }) {
  return (
    <ol className={s.steps} style={{ "--n": rounds.length } as React.CSSProperties} aria-label="Drive progress">
      {rounds.map((r) => (
        <li key={r.id} className={s.step} data-status={r.status}>
          <span className={s.stepBar} />
          <span className={s.stepLabel}>
            {shortLabel[r.type]}
            <span className="sr-only"> — {r.status}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className={s.bar} role="progressbar" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={s.barFill} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className={s.tabs}>
      {tabs.map((t) => (
        <button key={t.id} role="tab" type="button" aria-selected={t.id === value} className={s.tab} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Segment<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className={s.segment}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} className={s.segmentBtn} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Person({ name, meta }: { name: string; meta?: ReactNode }) {
  return (
    <span className={s.person}>
      <span aria-hidden className={s.avatar}>
        {initials(name)}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className={s.personName} style={{ display: "block" }}>
          {name}
        </span>
        {meta && <span className={s.personMeta} style={{ display: "block" }}>{meta}</span>}
      </span>
    </span>
  );
}

const resultTone: Record<ResultStatus, BadgeTone> = {
  invited: "info",
  in_progress: "warning",
  submitted: "neutral",
  passed: "success",
  failed: "danger",
  selected: "success",
  rejected: "danger",
};

const resultText: Record<ResultStatus, string> = {
  invited: "Invited",
  in_progress: "In progress",
  submitted: "Submitted",
  passed: "Passed",
  failed: "Not advanced",
  selected: "Selected",
  rejected: "Rejected",
};

export function ResultBadge({ status, locked }: { status: ResultStatus; locked?: boolean }) {
  if (locked) return <Badge tone="danger">Locked</Badge>;
  return <Badge tone={resultTone[status]}>{resultText[status]}</Badge>;
}

const roundTone: Record<Round["status"], BadgeTone> = { pending: "neutral", active: "primary", completed: "success", skipped: "warning" };

export function RoundStatusBadge({ status }: { status: Round["status"] }) {
  return <Badge tone={roundTone[status]}>{status[0]!.toUpperCase() + status.slice(1)}</Badge>;
}

export function Chips({ items }: { items: string[] }) {
  return (
    <span className={s.row}>
      {items.map((i) => (
        <span key={i} className={s.chip}>
          {i}
        </span>
      ))}
    </span>
  );
}

/** Marks simulated integrations so the prototype never passes for the real thing. */
export function DemoNote({ children }: { children: ReactNode }) {
  return (
    <p className={s.demoNote}>
      <Info aria-hidden size={14} /> {children}
    </p>
  );
}
