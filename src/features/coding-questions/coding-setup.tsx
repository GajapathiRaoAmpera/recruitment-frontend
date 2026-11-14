"use client";

import { ArrowDown, ArrowUp, Lock, Pencil, X } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/api/client";
import { getCodingQuestion, isSqlQuestion, listCodingQuestions, saveTestQuestions, saveTestSettings, titleOf, type QuestionSummary } from "@/api/coding-questions";
import { getRoundTest } from "@/api/rounds";
import { hire as h } from "@/components/hire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { fmt } from "@/features/advance/messages";
import { useAsync } from "@/features/papers/use-async";
import { BankPicker, DIFFICULTY_TONE, label, LIST_LIMIT, SqlBadge } from "./bank-picker";
import s from "./coding-questions.module.scss";
import { GenerateDialog } from "./generate-dialog";
import { codingErrorMessage, FLAG_LABEL } from "./messages";
import { QuestionForm } from "./question-form";

export const MAX_QUESTIONS = 50;
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const asApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", "Couldn't reach the server. Nothing was saved; try again."));

/** Titles for the round's question ids: the bank list, plus a direct read for any older than its newest 200. */
async function resolveQuestions(ids: string[]): Promise<Map<string, QuestionSummary>> {
  if (ids.length === 0) return new Map();
  const map = new Map((await listCodingQuestions({ limit: LIST_LIMIT })).map((q) => [q.id, q]));
  const missing = ids.filter((id) => !map.has(id));
  const found = await Promise.all(missing.map((id) => getCodingQuestion(id).catch(() => null)));
  found.forEach((q) => q && map.set(q.id, q));
  return map;
}

/** Round 2 set-up for HR: test duration, the ordered question list, the bank picker and the question form. */
export function CodingSetup({ roundId }: { roundId: string }) {
  const test = useAsync(() => getRoundTest(roundId), [roundId]);
  const noTest = test.error?.code === "TEST_NOT_FOUND";
  const t = noTest ? undefined : test.data;
  const locked = t?.locked ?? false;
  const serverIds = t?.questionIds ?? [];

  const [bankKey, setBankKey] = useState(0);
  const names = useAsync(() => resolveQuestions(serverIds), [serverIds.join(","), bankKey]);
  const [picked, setPicked] = useState<Map<string, QuestionSummary>>(() => new Map()); // added from the bank or just edited
  const known = (id: string) => picked.get(id) ?? names.data?.get(id);

  // Settings
  const [minutes, setMinutes] = useState<string | null>(null); // null = show the saved value
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string }>();

  // Question list
  const [order, setOrder] = useState<string[] | null>(null); // null = the saved order
  const [lastSaved, setLastSaved] = useState<string[] | null>(null);
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [listBusy, setListBusy] = useState(false);
  const [listMsg, setListMsg] = useState<{ ok: boolean; text: string }>();
  const [form, setForm] = useState<{ id?: string } | null>(null);
  const [generating, setGenerating] = useState(false);

  if (test.error && !noTest && !test.data) {
    if (test.error.code === "ROUND_HAS_NO_TEST") return null;
    return <ErrorState message={codingErrorMessage(test.error)} onRetry={test.reload} />;
  }
  // One loader until the test and its question titles are both in (no "Loading…" rows).
  if ((!t && !noTest) || (serverIds.length > 0 && names.loading && !names.data)) return <RocketLoader label="Loading coding test set-up" />;

  const ids = order ?? serverIds;
  const dirty = order !== null && !same(order, serverIds) && !(lastSaved && same(order, lastSaved));
  const minutesValue = minutes ?? (t ? String(Math.round(t.durationSec / 60)) : "60");
  const m = Number(minutesValue);
  const minutesError = Number.isInteger(m) && m >= 1 && m <= 600 ? undefined : "Enter whole minutes from 1 to 600.";
  const totalMarks = ids.reduce((n, id) => n + (known(id)?.marks ?? 0), 0);

  const edit = (next: string[]) => {
    setOrder(next);
    setListMsg(undefined);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...ids];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    edit(next);
  };

  const saveSettings = async () => {
    setSettingsBusy(true);
    setSettingsMsg(undefined);
    try {
      await saveTestSettings(roundId, { durationSec: m * 60 });
      setSettingsMsg({ ok: true, text: `Saved: ${m} minutes.${noTest ? " The test is created; now add questions." : ""}` });
      setMinutes(null);
      test.reload();
    } catch (e) {
      setSettingsMsg({ ok: false, text: codingErrorMessage(asApiError(e)) });
    } finally {
      setSettingsBusy(false);
    }
  };

  const saveQuestions = async () => {
    if (!t) return;
    setListBusy(true);
    setListMsg(undefined);
    setFlags({});
    try {
      const r = await saveTestQuestions(t.id, ids);
      const lv = Object.entries(r.levels)
        .filter(([, n]) => n)
        .map(([d, n]) => `${n} ${d}`)
        .join(", ");
      setListMsg({ ok: true, text: `Saved ${r.questionCount} question(s)${lv ? ` (${lv})` : ""}. Students see them in this order.` });
      setLastSaved(ids);
      test.reload();
    } catch (e) {
      const err = asApiError(e);
      setListMsg({ ok: false, text: codingErrorMessage(err) });
      const bad = err.details.question_ids;
      if (FLAG_LABEL[err.code] && Array.isArray(bad)) setFlags(Object.fromEntries(bad.map((id) => [String(id), FLAG_LABEL[err.code]!])));
      if (err.code === "TEST_IN_USE" || err.code === "TEST_NOT_FOUND") test.reload();
    } finally {
      setListBusy(false);
    }
  };

  const onSaved = (q: QuestionSummary) => {
    setPicked((p) => (p.has(q.id) || ids.includes(q.id) ? new Map(p).set(q.id, q) : p));
    setBankKey((k) => k + 1);
  };

  const message = (msg?: { ok: boolean; text: string }) =>
    msg && (
      <p role={msg.ok ? "status" : "alert"} className={msg.ok ? h.small : s.error}>
        {msg.text}
      </p>
    );

  return (
    <section className={h.card} aria-labelledby="coding-setup-h">
      <div className={h.cardHead}>
        <h2 id="coding-setup-h" className={h.cardTitle}>
          Coding test setup
        </h2>
        {locked ? (
          <Badge tone="warning">
            <Lock aria-hidden size={12} style={{ marginRight: 4 }} /> Locked
          </Badge>
        ) : (
          <Badge tone={noTest ? "neutral" : serverIds.length ? "success" : "warning"}>
            {noTest ? "Not set up" : serverIds.length ? `Ready · ${serverIds.length} question${serverIds.length === 1 ? "" : "s"}` : "Needs questions"}
          </Badge>
        )}
      </div>
      {locked && <p className={h.muted}>A student has started this test, so its settings and questions are read-only.</p>}
      {noTest && <p className={h.muted}>No test set up yet. Save the settings to create it, then add questions.</p>}

      <div className={h.stack} style={{ marginTop: 16 }}>
        <section aria-labelledby="settings-h">
          <h3 id="settings-h" className={s.subTitle}>
            Test settings
          </h3>
          <div className={s.settings}>
            <Field label="Duration (minutes)" error={minutes !== null ? minutesError : undefined}>
              <Input type="number" min={1} max={600} step={1} inputMode="numeric" value={minutesValue} disabled={locked} onChange={(e) => setMinutes(e.target.value)} />
            </Field>
            {!locked && (
              <Button variant="secondary" disabled={!!minutesError || (minutes === null && !noTest)} loading={settingsBusy} onClick={() => void saveSettings()}>
                {noTest ? "Create test" : "Save settings"}
              </Button>
            )}
          </div>
          {message(settingsMsg)}
        </section>

        <section aria-labelledby="round-q-h">
          <div className={h.between}>
            <h3 id="round-q-h" className={s.subTitle}>
              Questions in this round ({ids.length})
            </h3>
            {ids.length > 0 && <span className={h.xs}>Total {fmt(totalMarks)} marks</span>}
          </div>
          {ids.length === 0 ? (
            <EmptyState title="No questions in this round yet" description={locked ? undefined : "Add questions from the bank below."} />
          ) : (
            <ol className={s.order} aria-label="Questions in this round">
              {ids.map((id, i) => {
                const q = known(id);
                const title = q ? titleOf(q.body) : "Unknown question";
                return (
                  <li key={id} className={s.orderItem}>
                    <span className={s.pos}>{i + 1}.</span>
                    <span className={s.orderTitle}>{title}</span>
                    {q && isSqlQuestion(q) && <SqlBadge />}
                    {q && <Badge tone={DIFFICULTY_TONE[q.difficulty]}>{label(q.difficulty)}</Badge>}
                    {q && <span className={h.small}>{fmt(q.marks)} marks</span>}
                    {flags[id] && <Badge tone="danger">{flags[id]}</Badge>}
                    {!locked && (
                      <span className={h.row}>
                        <Button size="sm" variant="tertiary" aria-label={`Move ${title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp aria-hidden size={14} />
                        </Button>
                        <Button size="sm" variant="tertiary" aria-label={`Move ${title} down`} disabled={i === ids.length - 1} onClick={() => move(i, 1)}>
                          <ArrowDown aria-hidden size={14} />
                        </Button>
                        <Button size="sm" variant="tertiary" aria-label={`Edit ${title}`} onClick={() => setForm({ id })}>
                          <Pencil aria-hidden size={14} />
                        </Button>
                        <Button size="sm" variant="tertiary" aria-label={`Remove ${title}`} onClick={() => edit(ids.filter((x) => x !== id))}>
                          <X aria-hidden size={14} />
                        </Button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {!locked && (
            <div className={h.row} style={{ marginTop: 12 }}>
              <Button disabled={!dirty || !t} loading={listBusy} onClick={() => void saveQuestions()}>
                Save questions
              </Button>
              {dirty && <span className={h.xs}>Unsaved changes</span>}
              {!t && <span className={h.xs}>Create the test first (Test settings above).</span>}
            </div>
          )}
          {message(listMsg)}
        </section>

        <BankPicker
          inRound={new Set(ids)}
          locked={locked}
          reloadKey={bankKey}
          onNew={() => setForm({})}
          onGenerate={() => setGenerating(true)}
          onApproved={onSaved}
          onEdit={(id) => setForm({ id })}
          onAdd={(q) => {
            if (ids.length >= MAX_QUESTIONS) return setListMsg({ ok: false, text: `A test can have at most ${MAX_QUESTIONS} questions.` });
            setPicked((p) => new Map(p).set(q.id, q));
            edit([...ids, q.id]);
          }}
        />
      </div>

      {generating && (
        <GenerateDialog
          onClose={() => setGenerating(false)}
          onGenerated={() => setBankKey((k) => k + 1)}
          onReview={(id) => {
            setGenerating(false);
            setForm({ id });
          }}
        />
      )}
      {form && <QuestionForm key={form.id ?? "new"} questionId={form.id} onClose={() => setForm(null)} onSaved={onSaved} />}
    </section>
  );
}
