"use client";

import { AlertTriangle, Library } from "lucide-react";
import Link from "next/link";
import { hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LEVELS, needed } from "@/features/papers/needed";
import type { Level, PaperSettings } from "@/features/papers/types";
import type { AsyncState } from "@/features/papers/use-async";
import type { Availability } from "@/features/qbank/types";
import { CountSteppers } from "./count-steppers";
import { balance, sum } from "./mix-editor";
import s from "./papers.module.scss";

const cap = (v: string) => v[0]!.toUpperCase() + v.slice(1);

/** Approved bank questions a paper can draw on per level: subjects with weight 0 are left out (backend retrieval). */
export function availableByLevel(a: Availability, subjects: PaperSettings["subjects"]): Record<Level, number> {
  if (!subjects) return a.byLevel;
  const used = Object.keys(a.subjects).filter((sub) => (subjects[sub] ?? 0) > 0);
  return Object.fromEntries(LEVELS.map((lv) => [lv, used.reduce((n, sub) => n + (a.subjects[sub]?.[lv] ?? 0), 0)])) as Record<Level, number>;
}

/** Technical questions per level the banks cannot supply (the backend fails with BANK_TOO_SMALL below this). */
export function bankShortfall(settings: PaperSettings, a: Availability): Partial<Record<Level, number>> {
  const want = needed(settings);
  const have = availableByLevel(a, settings.subjects);
  return Object.fromEntries(LEVELS.filter((lv) => have[lv] < want[lv].technical).map((lv) => [lv, want[lv].technical - have[lv]]));
}

interface Props {
  settings: PaperSettings;
  onChange: (patch: Partial<PaperSettings>) => void;
  availability: AsyncState<Availability>;
}

/** IT only: what the PDF banks hold, the subject mix of the Technical section and an optional focus. */
export function BankTechnical({ settings, onChange, availability }: Props) {
  const a = availability.data;
  if (!a) {
    if (availability.error) {
      return (
        <p role="alert" className={s.banner} data-tone="danger">
          <AlertTriangle aria-hidden size={16} />
          <span>
            Could not load the question banks: {availability.error.message}{" "}
            <Button variant="tertiary" size="sm" onClick={availability.reload}>
              Try again
            </Button>
          </span>
        </p>
      );
    }
    return <Skeleton style={{ height: 120 }} />;
  }

  const subjects = Object.keys(a.subjects).sort();
  const weights = settings.subjects;
  const short = bankShortfall(settings, a);
  const want = needed(settings);
  const have = availableByLevel(a, weights);

  return (
    <div className={h.stack}>
      {a.total === 0 ? (
        <p role="alert" className={s.banner}>
          <AlertTriangle aria-hidden size={16} />
          <span>
            No approved IT questions in the PDF banks yet. <Link href="/hr/question-banks" className={h.link}>Upload a bank or approve its questions</Link> first.
          </span>
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className={s.counts} aria-label="Technical questions: needed vs approved in the banks">
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Paper needs</th>
                <th scope="col">Approved in banks</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((lv) => (
                <tr key={lv}>
                  <th scope="row">{cap(lv)}</th>
                  <td>{want[lv].technical}</td>
                  <td className={short[lv] ? s.short : undefined}>
                    {have[lv]}
                    {short[lv] ? ` — ${short[lv]} short` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subjects.length > 0 && (
        <div className={h.stackSm}>
          <label className={h.small} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={!weights}
              onChange={(e) => onChange({ subjects: e.target.checked ? null : balance(Object.fromEntries(subjects.map((sub) => [sub, 0]))) })}
            />
            Even split across subjects
          </label>
          {weights && (
            <>
              <CountSteppers
                keys={subjects}
                labels={Object.fromEntries(subjects.map((sub) => [sub, `${sub} %`]))}
                value={Object.fromEntries(subjects.map((sub) => [sub, weights[sub] ?? 0]))}
                onChange={(v) => onChange({ subjects: v })}
              />
              <div className={h.row}>
                <span className={s.total} data-ok={sum(weights) === 100} aria-live="polite">
                  Subjects total {sum(weights)}% {sum(weights) === 100 ? "" : "— must be 100%"}
                </span>
                {sum(weights) !== 100 && (
                  <Button variant="tertiary" size="sm" onClick={() => onChange({ subjects: balance(weights) })}>
                    Balance subjects to 100
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <Field label="Focus (optional)" hint="A short topic, e.g. “process scheduling and deadlocks”. It ranks bank questions by closeness when the bank's search index is ready; otherwise it is ignored.">
        <Input value={settings.focus ?? ""} maxLength={200} onChange={(e) => onChange({ focus: e.target.value })} />
      </Field>
      <p className={h.xs}>
        <Library aria-hidden size={12} /> Aptitude and Reasoning are generated by code; Technical comes from your PDF banks; AI picks the sample paper.
      </p>
    </div>
  );
}
