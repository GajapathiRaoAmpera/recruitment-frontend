"use client";

import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { setSelection } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { LEVELS, needed, SECTION_KEYS } from "@/features/papers/needed";
import type { DraftDetail, Level, PoolItem, Section } from "@/features/papers/types";
import s from "./papers.module.scss";

const cap = (v: string) => v[0]!.toUpperCase() + v.slice(1);

/** HR chooses which generated questions may reach students, with live selected-vs-needed counts. */
interface Props {
  draft: DraftDetail;
  onChange: (d: DraftDetail) => void;
  onEdit?: (q: PoolItem) => void;
  /** Told whether there are unsaved picks, so the parent can hold Accept until they are saved. */
  onDirtyChange?: (dirty: boolean) => void;
}

export function PoolPicker({ draft, onChange, onEdit, onDirtyChange }: Props) {
  const toast = useToast();
  const editable = draft.status === "draft";
  const saved = useMemo(() => new Set(draft.pool.filter((q) => q.selected).map((q) => q.id)), [draft.pool]);
  const [picked, setPicked] = useState(saved);
  const [seen, setSeen] = useState(saved);
  const [level, setLevel] = useState<Level | "">("");
  const [section, setSection] = useState<Section | "">("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  // The server copy changed (save, edit, reload): start again from it.
  if (seen !== saved) {
    setSeen(saved);
    setPicked(saved);
  }

  const want = needed(draft.settings);
  const technical = draft.track === "it" ? "Technical" : "Soft skills";
  const sectionLabel = (sec: Section) => (sec === "technical" ? technical : cap(sec));
  const count = (l: Level, sec: Section) => draft.pool.filter((q) => q.level === l && q.section === sec && picked.has(q.id)).length;
  const short = LEVELS.some((l) => SECTION_KEYS.some((sec) => count(l, sec) < want[l][sec]));
  const dirty = picked.size !== saved.size || [...picked].some((id) => !saved.has(id));
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const paperSize = LEVELS.reduce((a, l) => a + draft.settings.counts[l], 0);
  // Only what this paper uses: a 100% Aptitude paper shows one column, not rows of "0 / 0".
  const inPool = (l: Level | null, sec: Section | null) => draft.pool.some((p) => (!l || p.level === l) && (!sec || p.section === sec));
  const sections = SECTION_KEYS.filter((sec) => LEVELS.some((l) => want[l][sec] > 0) || inPool(null, sec));
  const levels = LEVELS.filter((l) => sections.some((sec) => want[l][sec] > 0) || inPool(l, null));

  const q = query.trim().toLowerCase();
  const rows = draft.pool.filter((p) => (!level || p.level === level) && (!section || p.section === section) && (!q || p.text.toLowerCase().includes(q) || p.topic.toLowerCase().includes(q)));
  const allRows = rows.length > 0 && rows.every((p) => picked.has(p.id));

  const update = (ids: string[], on: boolean) =>
    setPicked((cur) => {
      const next = new Set(cur);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      onChange(await setSelection(draft.id, [...picked]));
      toast({ tone: "success", title: "Selection saved", description: `${picked.size} of ${draft.pool.length} questions selected. Checks refreshed.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the selection. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={h.card} aria-labelledby="pool-title">
      <div className={h.cardHead}>
        <h2 id="pool-title" className={h.cardTitle}>
          Choose questions
        </h2>
        <span className={h.xs} aria-live="polite">
          {picked.size} of {draft.pool.length} selected · each paper needs {paperSize}
        </span>
      </div>
      <p className={h.xs} style={{ marginBottom: "0.75rem" }}>
        Tick the questions students may get. Select exactly {paperSize} and every student gets the same paper; select more and each student gets their own mix.
      </p>

      <table className={s.counts} aria-label="Selected questions against what each paper needs">
        <thead>
          <tr>
            <th scope="col">Level</th>
            {sections.map((sec) => (
              <th key={sec} scope="col">
                {sectionLabel(sec)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {levels.map((l) => (
            <tr key={l}>
              <th scope="row">{cap(l)}</th>
              {sections.map((sec) => {
                const n = count(l, sec);
                const need = want[l][sec];
                return (
                  <td key={sec} className={n < need ? s.short : undefined}>
                    {n} selected / {need} needed{n < need && <span className="sr-only"> (too few)</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <p className={h.row} style={{ margin: "0.75rem 0" }} role="status">
        {short ? (
          <>
            <AlertTriangle aria-hidden size={16} className={s.bad} /> Select more questions in the red cells before accepting.
          </>
        ) : (
          <>
            <CheckCircle2 aria-hidden size={16} className={s.ok} /> Enough questions selected for every section.
          </>
        )}
      </p>

      <div className={h.toolbar} style={{ marginBottom: "0.75rem" }}>
        <Field label="Level">
          <Select value={level} onChange={(e) => setLevel(e.target.value as Level | "")}>
            <option value="">All levels</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                {cap(l)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Section">
          <Select value={section} onChange={(e) => setSection(e.target.value as Section | "")}>
            <option value="">All sections</option>
            {sections.map((sec) => (
              <option key={sec} value={sec}>
                {sectionLabel(sec)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Search questions">
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
      </div>

      {editable && (
        <div className={h.row} style={{ marginBottom: "0.75rem" }}>
          <Button variant="secondary" size="sm" disabled={!rows.length || allRows} onClick={() => update(rows.map((p) => p.id), true)}>
            Select all shown ({rows.length})
          </Button>
          <Button variant="secondary" size="sm" disabled={!rows.some((p) => picked.has(p.id))} onClick={() => update(rows.map((p) => p.id), false)}>
            Clear shown
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className={h.xs}>No questions match these filters.</p>
      ) : (
        <ul className={s.poolList} aria-label="Generated questions">
          {rows.map((p) => (
            <li key={p.id} className={s.poolRow}>
              <label>
                <input type="checkbox" className={h.check} checked={picked.has(p.id)} disabled={!editable} onChange={(e) => update([p.id], e.target.checked)} aria-label={`Select: ${p.text.slice(0, 80)}`} />
                <span style={{ minWidth: 0 }}>
                  <span className={s.poolText}>{p.text}</span>
                  <span className={h.row} style={{ marginTop: 4 }}>
                    <span className={h.chip}>{cap(p.level)}</span>
                    <span className={h.chip}>{sectionLabel(p.section)}</span>
                    {p.topic && <span className={h.xs}>{p.topic}</span>}
                    {p.edited && <Badge tone="info">Edited</Badge>}
                  </span>
                </span>
              </label>
              {editable && onEdit && (
                <Button variant="tertiary" size="sm" aria-label={`Edit: ${p.text.slice(0, 80)}`} onClick={() => onEdit(p)}>
                  <Pencil aria-hidden size={14} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className={h.between} style={{ marginTop: "1rem" }}>
          <p className={h.xs} role={error ? "alert" : undefined} style={error ? { color: "var(--ui-color-danger)" } : undefined}>
            {error ?? (dirty ? "You have unsaved changes." : "Selection saved.")}
          </p>
          <span className={h.row}>
            <Button variant="secondary" disabled={!dirty || saving} onClick={() => setPicked(saved)}>
              Undo changes
            </Button>
            <Button disabled={!dirty} loading={saving} onClick={() => void save()}>
              Save selection
            </Button>
          </span>
        </div>
      )}
    </section>
  );
}
