"use client";

import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DemoNote, hire as h } from "@/components/hire/ui";
import { createDrive } from "@/api/hiring";
import { ImportPanel } from "@/features/hiring/import-panel";
import { safeStorage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { roundTitle } from "@/mock/data";
import { useStore } from "@/mock/store";
import type { Round } from "@/mock/types";
import w from "./wizard.module.scss";

type Draft = Pick<Round, "type" | "mode" | "durationMin" | "threshold">;
type Details = { company: string; campus: string; roleTitle: string; jd: string; startDate: string; endDate: string };
type StepKey = "details" | "rounds" | "candidates" | "review";

// Real mode imports candidates right after the drive exists, so that step only exists in the prototype.
const STEPS: { key: StepKey; label: string }[] = supabase
  ? [
      { key: "details", label: "Drive details" },
      { key: "rounds", label: "Rounds & rules" },
      { key: "review", label: "Review & create" },
    ]
  : [
      { key: "details", label: "Drive details" },
      { key: "rounds", label: "Rounds & rules" },
      { key: "candidates", label: "Candidates" },
      { key: "review", label: "Review & launch" },
    ];

const DEFAULT_ROUNDS: Draft[] = [
  { type: "shortlist", mode: "auto" },
  { type: "aptitude", mode: "auto", durationMin: 30, threshold: 60 },
  { type: "coding", mode: "auto", durationMin: 60, threshold: 50 },
  { type: "ai_interview", mode: "ai", durationMin: 20 },
  { type: "final", mode: "manual" },
];
const EMPTY: Details = { company: "Ampera Technologies", campus: "", roleTitle: "", jd: "", startDate: "", endDate: "" };
const DRAFT_KEY = "ampera.drive-draft";
const isAssessment = (t: Round["type"]) => t !== "shortlist" && t !== "final";

/** Number box that can be emptied while typing (empty = NaN, caught by validation) instead of snapping to 0. */
const num = (v: string) => (v === "" ? Number.NaN : Number(v));
const shown = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? "" : v);

function loadDraft(): { step: number; details: Details; rounds: Draft[] } | null {
  try {
    const d = JSON.parse(safeStorage.get(DRAFT_KEY) ?? "null");
    return d && d.details && Array.isArray(d.rounds) ? { ...d, details: { ...EMPTY, ...d.details }, step: Math.min(d.step ?? 0, STEPS.length - 1) } : null;
  } catch {
    return null;
  }
}

function validateDetails(d: Details) {
  const e: Record<string, string> = {};
  if (!d.company.trim()) e.company = "Enter the company name.";
  if (!d.campus.trim()) e.campus = "Enter the campus name.";
  if (!d.roleTitle.trim()) e.roleTitle = "Enter the role title.";
  if (d.jd.trim().length < 20) e.jd = "Paste the job description (at least 20 characters).";
  if (!supabase && d.startDate && d.endDate && d.endDate < d.startDate) e.endDate = "The last day can't be before the first day.";
  return e;
}

function validateRounds(rounds: Draft[]) {
  const e: Record<string, string> = {};
  rounds.forEach((r, i) => {
    if (r.durationMin !== undefined && !(r.durationMin >= 5 && r.durationMin <= 600)) e[`d${i}`] = "5–600 minutes.";
    if (r.threshold !== undefined && !(r.threshold >= 0 && r.threshold <= 100)) e[`t${i}`] = "0–100%.";
  });
  if (!rounds.some((r) => isAssessment(r.type))) e.rounds = "Keep at least one test or interview round between the shortlist and the final decision.";
  return e;
}

const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
const windowLabel = (d: Details) => (d.startDate ? `${fmt(d.startDate)}${d.endDate ? ` – ${fmt(d.endDate)}` : ""}` : "");

export default function NewDrivePage() {
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: "New drive" }]);
  const router = useRouter();
  const toast = useToast();
  const { dispatch } = useStore();
  // The staff shell renders this page only on the client, so reading storage here can't mismatch the server.
  const [restored] = useState(loadDraft);
  const [step, setStep] = useState(restored?.step ?? 0);
  const [details, setDetailsState] = useState<Details>(restored?.details ?? EMPTY);
  const [rounds, setRounds] = useState<Draft[]>(restored?.rounds ?? DEFAULT_ROUNDS);
  const [showRestored, setShowRestored] = useState(Boolean(restored));
  const [files, setFiles] = useState<{ sheet?: string; resumes?: number }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<string>(); // id of the real drive, once saved on the server
  const [launching, setLaunching] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const current = STEPS[step]!.key;
  const dirty = JSON.stringify({ details, rounds }) !== JSON.stringify({ details: EMPTY, rounds: DEFAULT_ROUNDS });

  // Keep a draft so a refresh or a stray click on the sidebar doesn't lose the form.
  useEffect(() => {
    if (created) return;
    if (dirty) safeStorage.set(DRAFT_KEY, JSON.stringify({ step, details, rounds }));
  }, [step, details, rounds, dirty, created]);
  useEffect(() => {
    if (!dirty || created) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, created]);

  /** Editing a field clears its error at once. */
  const clearError = (...keys: string[]) =>
    setErrors((e) => (keys.some((k) => k in e) ? Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))) : e));
  const setDetail = (key: keyof Details, value: string) => {
    setDetailsState((d) => ({ ...d, [key]: value }));
    clearError(key);
  };
  const update = (i: number, patch: Partial<Draft>) => {
    setRounds((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    clearError(...("durationMin" in patch ? [`d${i}`] : []), ...("threshold" in patch ? [`t${i}`] : []));
  };
  const hasTechnical = rounds.some((r) => r.type === "technical");
  const assessments = rounds.filter((r) => isAssessment(r.type)).length;

  const focusFirstError = () => requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  /** Validates every step up to `target`; stops on the first step with errors. */
  const goTo = (target: number) => {
    for (let i = 0; i < target; i++) {
      const key = STEPS[i]!.key;
      const e = key === "details" ? validateDetails(details) : key === "rounds" ? validateRounds(rounds) : {};
      if (Object.keys(e).length) {
        setErrors(e);
        setStep(i);
        focusFirstError();
        return;
      }
    }
    setErrors({});
    setStep(target);
  };

  const startOver = () => {
    safeStorage.set(DRAFT_KEY, "null");
    setDetailsState(EMPTY);
    setRounds(DEFAULT_ROUNDS);
    setErrors({});
    setStep(0);
    setShowRestored(false);
  };

  const launch = async () => {
    if (supabase) {
      setLaunching(true);
      try {
        const d = await createDrive({
          company: details.company.trim(),
          campus: details.campus.trim(),
          roleTitle: details.roleTitle.trim(),
          jdText: details.jd.trim(),
          rounds: rounds.map((r) => ({ type: r.type, mode: r.mode, threshold: r.threshold, durationMin: r.durationMin })),
        });
        safeStorage.set(DRAFT_KEY, "null");
        setCreated(d.id);
      } catch (e) {
        toast({ tone: "danger", title: "Couldn't create the drive", description: `${(e as Error).message} Your answers are kept; try again.` });
      } finally {
        setLaunching(false);
      }
      return;
    }
    const { company, campus, roleTitle, jd } = details;
    dispatch({ type: "createDrive", drive: { company, campus, roleTitle, jd, window: windowLabel(details) || "TBD" }, rounds });
    safeStorage.set(DRAFT_KEY, "null");
    toast({ tone: "success", title: "Drive launched", description: `${details.roleTitle} at ${details.campus} is live.` });
    router.push("/hr/drives");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) goTo(step + 1);
    else {
      goTo(step); // re-validate everything before creating
      const ok = !Object.keys(validateDetails(details)).length && !Object.keys(validateRounds(rounds)).length;
      if (ok) void launch();
    }
  };

  if (created)
    return (
      <>
        <PageHeader title="Drive created" description={`${details.roleTitle} at ${details.campus}. Next, import the candidates.`} />
        <div className={h.stack}>
          <ImportPanel driveId={created} />
          <div>
            <Button asChild>
              <Link href={`/hr/drives/${created}/candidates`}>
                Go to shortlist <ArrowRight aria-hidden size={16} style={{ marginLeft: 6 }} />
              </Link>
            </Button>
          </div>
        </div>
      </>
    );

  return (
    <>
      <PageHeader title="Create campus drive" description="Set up the drive and its rounds. You can change round settings later from the drive." />

      {showRestored && (
        <div className={w.restored} role="status">
          <span>We restored the drive you were setting up.</span>
          <Button variant="tertiary" size="sm" onClick={startOver}>
            Start over
          </Button>
        </div>
      )}

      <ol className={w.stepper} aria-label="Steps">
        {STEPS.map((s, i) => {
          const status = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li key={s.key} className={w.stepItem} data-status={status}>
              <button type="button" className={w.stepBtn} disabled={i >= step} aria-current={i === step ? "step" : undefined} onClick={() => goTo(i)}>
                <span className={w.dot} aria-hidden>
                  {status === "done" ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span className={w.stepText}>
                  <span className={w.stepLabel}>{s.label}</span>
                  <span className={w.stepState}>{status === "done" ? "Completed" : status === "active" ? "In progress" : "Not started"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <form ref={formRef} className={h.card} onSubmit={submit} noValidate>
        <p className={h.eyebrow} style={{ marginBottom: 16 }}>
          Step {step + 1} of {STEPS.length} · {STEPS[step]!.label}
        </p>

        {current === "details" && (
          <div className={h.stack}>
            <div className={h.grid2}>
              <Field label="Company" required error={errors.company}>
                <Input value={details.company} autoComplete="organization" onChange={(e) => setDetail("company", e.target.value)} />
              </Field>
              <Field label="Campus" required error={errors.campus}>
                <Input value={details.campus} placeholder="e.g. ABC Engineering College" onChange={(e) => setDetail("campus", e.target.value)} />
              </Field>
              <Field label="Role title" required error={errors.roleTitle}>
                <Input value={details.roleTitle} placeholder="e.g. Software Engineer" onChange={(e) => setDetail("roleTitle", e.target.value)} />
              </Field>
              {!supabase && (
                <div className={w.dates}>
                  <Field label="First day">
                    <Input type="date" value={details.startDate} onChange={(e) => setDetail("startDate", e.target.value)} />
                  </Field>
                  <Field label="Last day" error={errors.endDate}>
                    <Input type="date" value={details.endDate} min={details.startDate || undefined} onChange={(e) => setDetail("endDate", e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
            <Field label="Job description" required error={errors.jd} hint={`Used to score how well each resume matches (keyword overlap, no AI). ${details.jd.trim().length < 20 ? `${details.jd.trim().length}/20 characters minimum.` : ""}`}>
              <Textarea rows={8} value={details.jd} onChange={(e) => setDetail("jd", e.target.value)} />
            </Field>
          </div>
        )}

        {current === "rounds" && (
          <div className={h.stack}>
            <p className={h.muted}>
              Candidates go through these rounds in order. <strong>Cut-off</strong> is the minimum share of a round&apos;s total marks needed to move on; HR still confirms who advances.
            </p>
            {errors.rounds && (
              <p role="alert" className={w.formError}>
                {errors.rounds}
              </p>
            )}
            <ol className={w.rounds}>
              {rounds.map((r, i) => (
                <li key={`${r.type}-${i}`} className={w.round}>
                  <span className={w.roundNo} aria-hidden>
                    {i + 1}
                  </span>
                  <div className={w.roundInfo}>
                    <p className={w.roundTitle}>{roundTitle[r.type]}</p>
                    <p className={h.xs}>
                      {r.type === "shortlist"
                        ? "Resume analyser and HR filters pick who gets invited."
                        : r.type === "final"
                          ? "HR confirms the final decision."
                          : "Students sign in with Student ID + date of birth, then pass location, rules and full-screen checks."}
                    </p>
                  </div>
                  <div className={w.roundFields}>
                    {(r.type === "technical" || r.type === "final" || r.type === "ai_interview") && (
                      <Field label="Mode">
                        <Select value={r.mode} onChange={(e) => update(i, { mode: e.target.value as Round["mode"] })}>
                          <option value="ai">AI-led</option>
                          <option value="manual">Manual</option>
                        </Select>
                      </Field>
                    )}
                    {r.durationMin !== undefined && (
                      <Field label="Minutes" error={errors[`d${i}`]}>
                        <Input type="number" inputMode="numeric" min={5} max={600} className={w.numberInput} value={shown(r.durationMin)} onChange={(e) => update(i, { durationMin: num(e.target.value) })} />
                      </Field>
                    )}
                    {r.threshold !== undefined && (
                      <Field label="Cut-off %" error={errors[`t${i}`]}>
                        <Input type="number" inputMode="numeric" min={0} max={100} className={w.numberInput} value={shown(r.threshold)} onChange={(e) => update(i, { threshold: num(e.target.value) })} />
                      </Field>
                    )}
                    {isAssessment(r.type) && (
                      <Button
                        variant="tertiary"
                        size="sm"
                        className={w.remove}
                        aria-label={`Remove ${roundTitle[r.type]}`}
                        title={assessments <= 1 ? "A drive needs at least one test or interview round" : `Remove ${roundTitle[r.type]}`}
                        disabled={assessments <= 1}
                        onClick={() => {
                          setRounds((rs) => rs.filter((_, j) => j !== i));
                          setErrors({});
                        }}
                      >
                        <Trash2 aria-hidden size={16} />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div>
              <Button
                variant="secondary"
                size="sm"
                disabled={hasTechnical}
                onClick={() => setRounds((rs) => [...rs.slice(0, -1), { type: "technical", mode: "manual", durationMin: 45 }, rs[rs.length - 1]!])}
              >
                <Plus aria-hidden size={14} style={{ marginRight: 4 }} /> Add a technical round
              </Button>
              {hasTechnical && <p className={h.xs} style={{ marginTop: 6 }}>One extra technical round is allowed per drive.</p>}
            </div>
          </div>
        )}

        {current === "candidates" && (
          <div className={h.stackSm}>
            <div className={h.grid2}>
              <label className={`${h.cardTight} ${w.fileCard}`}>
                <FileSpreadsheet aria-hidden size={24} />
                <p style={{ fontWeight: 500, marginTop: 8 }}>Google Form export (.xlsx / .csv)</p>
                <p className={h.xs}>{files.sheet ?? "Student ID, name, email, DOB, branch, CGPA"}</p>
                <input className="sr-only" type="file" accept=".xlsx,.csv" onChange={(e) => setFiles((f) => ({ ...f, sheet: e.target.files?.[0]?.name }))} />
              </label>
              <label className={`${h.cardTight} ${w.fileCard}`}>
                <FileText aria-hidden size={24} />
                <p style={{ fontWeight: 500, marginTop: 8 }}>Resumes (PDF or .zip)</p>
                <p className={h.xs}>{files.resumes ? `${files.resumes} file(s) selected` : "File names should contain the Student ID"}</p>
                <input className="sr-only" type="file" multiple accept=".pdf,.zip" onChange={(e) => setFiles((f) => ({ ...f, resumes: e.target.files?.length }))} />
              </label>
            </div>
            <DemoNote>Prototype: files are not uploaded. The real flow parses the sheet and runs the local resume analyser.</DemoNote>
          </div>
        )}

        {current === "review" && (
          <div className={h.stack}>
            <section className={w.review} aria-labelledby="rv-details">
              <div className={h.between}>
                <h2 id="rv-details" className={w.reviewTitle}>
                  Drive details
                </h2>
                <Button variant="tertiary" size="sm" onClick={() => goTo(0)}>
                  <Pencil aria-hidden size={14} style={{ marginRight: 4 }} /> Edit
                </Button>
              </div>
              <dl className={w.facts}>
                <dt>Company</dt>
                <dd>{details.company}</dd>
                <dt>Campus</dt>
                <dd>{details.campus}</dd>
                <dt>Role</dt>
                <dd>{details.roleTitle}</dd>
                {!supabase && (
                  <>
                    <dt>Dates</dt>
                    <dd>{windowLabel(details) || "Not set"}</dd>
                  </>
                )}
                <dt>Job description</dt>
                <dd className={w.clamp}>{details.jd}</dd>
              </dl>
            </section>
            <section className={w.review} aria-labelledby="rv-rounds">
              <div className={h.between}>
                <h2 id="rv-rounds" className={w.reviewTitle}>
                  Rounds
                </h2>
                <Button variant="tertiary" size="sm" onClick={() => goTo(1)}>
                  <Pencil aria-hidden size={14} style={{ marginRight: 4 }} /> Edit
                </Button>
              </div>
              <ol className={h.list}>
                {rounds.map((r, i) => (
                  <li key={i} className={h.listItem}>
                    <span>
                      {i + 1}. {roundTitle[r.type]}
                    </span>
                    <span className={h.xs}>
                      {r.mode === "ai" ? "AI-led" : r.mode === "manual" ? "Manual" : "Automatic"}
                      {r.durationMin ? ` · ${r.durationMin} min` : ""}
                      {r.threshold !== undefined ? ` · cut-off ${r.threshold}%` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            {supabase && <p className={h.muted}>After the drive is created you&apos;ll import the Google Form export and fetch the resumes.</p>}
          </div>
        )}

        <div className={w.actions}>
          <Button variant="secondary" disabled={step === 0 || launching} onClick={() => setStep((n) => n - 1)}>
            <ArrowLeft aria-hidden size={16} style={{ marginRight: 6 }} /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="submit">
              Continue <ArrowRight aria-hidden size={16} style={{ marginLeft: 6 }} />
            </Button>
          ) : (
            <Button type="submit" loading={launching}>
              <Check aria-hidden size={16} style={{ marginRight: 6 }} /> {supabase ? "Create drive" : "Launch drive"}
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
