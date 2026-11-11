"use client";

import { Check, FileSpreadsheet, FileText, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { DemoNote, hire as h } from "@/components/hire/ui";
import { roundTitle } from "@/mock/data";
import { useStore } from "@/mock/store";
import type { Round } from "@/mock/types";

type Draft = Pick<Round, "type" | "mode" | "durationMin" | "threshold">;
const STEPS = ["Drive details", "Rounds & rules", "Candidates", "Review & launch"];

const DEFAULT_ROUNDS: Draft[] = [
  { type: "shortlist", mode: "auto" },
  { type: "aptitude", mode: "auto", durationMin: 30, threshold: 60 },
  { type: "coding", mode: "auto", durationMin: 60, threshold: 50 },
  { type: "ai_interview", mode: "ai", durationMin: 20 },
  { type: "final", mode: "manual" },
];

export default function NewDrivePage() {
  useBreadcrumbs([{ label: "Drives", href: "/hr/drives" }, { label: "New drive" }]);
  const router = useRouter();
  const toast = useToast();
  const { dispatch } = useStore();
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState({ company: "Ampera Technologies", campus: "", roleTitle: "", jd: "", window: "" });
  const [rounds, setRounds] = useState<Draft[]>(DEFAULT_ROUNDS);
  const [files, setFiles] = useState<{ sheet?: string; resumes?: number }>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (!details.campus.trim()) e.campus = "Enter the campus name.";
    if (!details.roleTitle.trim()) e.roleTitle = "Enter the role title.";
    if (details.jd.trim().length < 20) e.jd = "Paste the job description (at least 20 characters).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateDetails()) return;
    setStep((n) => Math.min(n + 1, STEPS.length - 1));
  };

  const update = (i: number, patch: Partial<Draft>) => setRounds((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const hasTechnical = rounds.some((r) => r.type === "technical");

  const launch = () => {
    dispatch({ type: "createDrive", drive: { ...details, window: details.window || "TBD" }, rounds });
    toast({ tone: "success", title: "Drive launched", description: `${details.roleTitle} at ${details.campus} is live.` });
    router.push("/hr/drives");
  };

  return (
    <>
      <PageHeader title="Create campus drive" description="Set up the drive, its rounds and import candidates." />
      <ol className={h.steps} style={{ "--n": STEPS.length, marginBottom: "2rem" } as React.CSSProperties} aria-label="Wizard steps">
        {STEPS.map((label, i) => (
          <li key={label} className={h.step} data-status={i < step ? "completed" : i === step ? "active" : "pending"} aria-current={i === step ? "step" : undefined}>
            <span className={h.stepBar} />
            <span className={h.stepLabel}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      <div className={h.card}>
        {step === 0 && (
          <div className={h.stackSm}>
            <div className={h.grid2}>
              <Field label="Company" required>
                <Input value={details.company} onChange={(e) => setDetails({ ...details, company: e.target.value })} />
              </Field>
              <Field label="Campus" required error={errors.campus}>
                <Input value={details.campus} placeholder="e.g. ABC Engineering College" onChange={(e) => setDetails({ ...details, campus: e.target.value })} />
              </Field>
              <Field label="Role title" required error={errors.roleTitle}>
                <Input value={details.roleTitle} onChange={(e) => setDetails({ ...details, roleTitle: e.target.value })} />
              </Field>
              <Field label="Drive window" hint="Shown to students, e.g. Apr 08 – Apr 18.">
                <Input value={details.window} onChange={(e) => setDetails({ ...details, window: e.target.value })} />
              </Field>
            </div>
            <Field label="Job description" required error={errors.jd} hint="Used for JD-match scoring of resumes (keyword overlap, no AI).">
              <Textarea rows={6} value={details.jd} onChange={(e) => setDetails({ ...details, jd: e.target.value })} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className={h.stackSm}>
            <ul className={h.list}>
              {rounds.map((r, i) => (
                <li key={`${r.type}-${i}`} className={h.listItem}>
                  <div style={{ minWidth: 200 }}>
                    <p style={{ fontWeight: 500 }}>{roundTitle[r.type]}</p>
                    <p className={h.xs}>{r.type === "shortlist" ? "Resume analyser (local OCR/PDF) + HR filters" : r.type === "final" ? "HR confirms the final decision" : "Candidates enter with Student ID + DOB, location, terms, full screen"}</p>
                  </div>
                  <div className={h.row}>
                    {(r.type === "technical" || r.type === "final" || r.type === "ai_interview") && (
                      <Field label="Mode">
                        <Select value={r.mode} onChange={(e) => update(i, { mode: e.target.value as Round["mode"] })}>
                          <option value="ai">AI-led</option>
                          <option value="manual">Manual</option>
                        </Select>
                      </Field>
                    )}
                    {r.durationMin !== undefined && (
                      <Field label="Minutes">
                        <Input type="number" min={5} style={{ width: 90 }} value={r.durationMin} onChange={(e) => update(i, { durationMin: Number(e.target.value) })} />
                      </Field>
                    )}
                    {r.threshold !== undefined && (
                      <Field label="Cut-off %">
                        <Input type="number" min={0} max={100} style={{ width: 90 }} value={r.threshold} onChange={(e) => update(i, { threshold: Number(e.target.value) })} />
                      </Field>
                    )}
                    {r.type !== "shortlist" && r.type !== "final" && (
                      <Button variant="tertiary" size="sm" aria-label={`Remove ${roundTitle[r.type]}`} onClick={() => setRounds((rs) => rs.filter((_, j) => j !== i))}>
                        <Trash2 aria-hidden size={16} />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <Button
                variant="secondary"
                size="sm"
                disabled={hasTechnical}
                onClick={() => setRounds((rs) => [...rs.slice(0, -1), { type: "technical", mode: "manual", durationMin: 45 }, rs[rs.length - 1]!])}
              >
                <Plus aria-hidden size={14} style={{ marginRight: 4 }} /> Add extra technical round
              </Button>
              {hasTechnical && <p className={h.xs} style={{ marginTop: 6 }}>One extra technical round is allowed per drive.</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className={h.stackSm}>
            <div className={h.grid2}>
              <label className={h.cardTight} style={{ cursor: "pointer" }}>
                <FileSpreadsheet aria-hidden size={24} />
                <p style={{ fontWeight: 500, marginTop: 8 }}>Google Form export (.xlsx / .csv)</p>
                <p className={h.xs}>{files.sheet ?? "Student ID, name, email, DOB, branch, CGPA"}</p>
                <input className="sr-only" type="file" accept=".xlsx,.csv" onChange={(e) => setFiles((f) => ({ ...f, sheet: e.target.files?.[0]?.name }))} />
              </label>
              <label className={h.cardTight} style={{ cursor: "pointer" }}>
                <FileText aria-hidden size={24} />
                <p style={{ fontWeight: 500, marginTop: 8 }}>Resumes (PDF or .zip)</p>
                <p className={h.xs}>{files.resumes ? `${files.resumes} file(s) selected` : "File names should contain the Student ID"}</p>
                <input className="sr-only" type="file" multiple accept=".pdf,.zip" onChange={(e) => setFiles((f) => ({ ...f, resumes: e.target.files?.length }))} />
              </label>
            </div>
            <DemoNote>Prototype: files are not uploaded. The real flow parses the sheet and runs the local resume analyser.</DemoNote>
          </div>
        )}

        {step === 3 && (
          <div className={h.stackSm}>
            <p>
              <strong>{details.roleTitle}</strong> at <strong>{details.campus}</strong> · {details.window || "dates TBD"}
            </p>
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
          </div>
        )}

        <div className={h.between} style={{ marginTop: "1.5rem" }}>
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((n) => n - 1)}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Continue</Button>
          ) : (
            <Button onClick={launch}>
              <Check aria-hidden size={16} style={{ marginRight: 6 }} /> Launch drive
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
