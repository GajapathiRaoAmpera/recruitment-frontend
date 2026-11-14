"use client";

import { AlertTriangle, Sparkles } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { createDraft, aiStatus } from "@/api/papers";
import { hire as h } from "@/components/hire/ui";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { RobotLoader } from "@/components/ui/robot-loader";
import type { Draft, Level, PaperSettings } from "@/features/papers/types";
import { useAsync } from "@/features/papers/use-async";
import { supabase } from "@/lib/supabase";
import { CountSteppers, NumberStepper } from "./count-steppers";
import { MixEditor, sum } from "./mix-editor";
import s from "./papers.module.scss";
import { PrototypeState } from "./prototype-state";
import { TrackToggle } from "./track-toggle";

const LEVELS: readonly Level[] = ["easy", "medium", "advanced"];
const LEVEL_LABELS: Record<Level, string> = { easy: "Easy", medium: "Medium", advanced: "Advanced" };

export const DEFAULT_SETTINGS: PaperSettings = {
  track: "it",
  counts: { easy: 20, medium: 25, advanced: 15 },
  mix: { aptitude: 40, reasoning: 30, technical: 30 },
  itSyntaxPercent: 50,
  poolFactor: 2,
  durationMin: 60,
  differentPerStudent: true,
  shuffleQuestions: true,
  shuffleOptions: true,
};

export interface DriveOption {
  id: string;
  label: string;
  /** The drive's role title: pre-fills the role the Technical questions are written for. */
  role?: string;
}

interface SetupStepProps {
  drives: DriveOption[];
  initialDrive?: string;
  onCreated: (draft: Draft) => void;
}

/** Step 1: paper settings → POST /papers/drafts. Needs the real API, so prototype mode shows a permission state. */
export function SetupStep(props: SetupStepProps) {
  return supabase ? <SetupForm {...props} /> : <PrototypeState />;
}

function SetupForm({ drives, initialDrive, onCreated }: SetupStepProps) {
  const trackLabel = useId();
  const providers = useAsync(aiStatus, []);
  const roleOf = (id: string) => drives.find((d) => d.id === id)?.role ?? "";
  const [driveRef, setDriveRef] = useState(drives.some((d) => d.id === initialDrive) ? initialDrive! : (drives[0]?.id ?? ""));
  const [title, setTitle] = useState("Round 1 — Aptitude paper");
  const [settings, setSettings] = useState<PaperSettings>(() => ({ ...DEFAULT_SETTINGS, role: roleOf(driveRef) }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const set = (patch: Partial<PaperSettings>) => setSettings((v) => ({ ...v, ...patch }));

  const total = sum(settings.counts);
  const isIt = settings.track === "it";
  const role = settings.role?.trim() ?? "";
  // one NVIDIA key: its model writes the Technical questions and picks the sample paper
  const keyMissing = providers.data ? !providers.data.nvidia : false;
  const blocker =
    !driveRef ? "Pick a drive." :
    !title.trim() ? "Enter a title." :
    !role ? "Enter the role the Technical questions are for." :
    total < 1 ? "Add at least one question." :
    sum(settings.mix) !== 100 ? "The section mix must total 100%." :
    providers.loading ? "Checking AI providers…" :
    providers.error ? "Could not check the AI providers." :
    keyMissing ? "The AI provider key is missing." : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (blocker) return;
    setSubmitting(true);
    setError(undefined);
    try {
      onCreated(await createDraft({ driveRef, title: title.trim(), settings: { ...settings, role } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the paper. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className={h.stack}>
        {providers.loading && !providers.data ? (
          <RobotLoader size="inline" label="Checking the AI providers" />
        ) : providers.error ? (
          <p role="alert" className={s.banner} data-tone="danger">
            <AlertTriangle aria-hidden size={16} />
            <span>
              Could not check the AI providers: {providers.error.message}{" "}
              <Button variant="tertiary" size="sm" onClick={providers.reload}>
                Try again
              </Button>
            </span>
          </p>
        ) : keyMissing ? (
          <p role="alert" className={s.banner}>
            <AlertTriangle aria-hidden size={16} />
            <span>
              Missing NVIDIA API key. Ask a Super Admin to add <code>NVIDIA_API_KEY</code> to the backend <code>.env</code> and restart the API.
            </span>
          </p>
        ) : null}

        <section className={h.card} aria-labelledby="paper-basics">
          <h2 id="paper-basics" className={h.cardTitle} style={{ marginBottom: "1rem" }}>
            Paper
          </h2>
          <div className={h.grid2}>
            <Field label="Drive" required>
              <Select
                value={driveRef}
                onChange={(e) => {
                  setDriveRef(e.target.value);
                  set({ role: roleOf(e.target.value) });
                }}
              >
                {drives.length === 0 && <option value="">No drives yet</option>}
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" required>
              <Input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label="Role" required hint="The Technical questions are written for this job, for example “Java Backend Developer”.">
              <Input value={settings.role ?? ""} maxLength={120} onChange={(e) => set({ role: e.target.value })} />
            </Field>
          </div>
          <div style={{ marginTop: "1rem" }}>
            <p id={trackLabel} className={h.small} style={{ fontWeight: 500, marginBottom: 6 }}>
              Track
            </p>
            <TrackToggle labelledBy={trackLabel} value={settings.track} onChange={(track) => set({ track })} />
            <p className={h.xs} style={{ marginTop: 6 }}>
              {isIt ? "Technical questions (code and concepts) are written for the role by AI. You check the answers in review." : "Technical section covers the role’s job knowledge and workplace soft skills, written by AI. You check the answers in review."}
            </p>
          </div>
        </section>

        <section className={h.card} aria-labelledby="paper-questions">
          <h2 id="paper-questions" className={h.cardTitle} style={{ marginBottom: "1rem" }}>
            Questions per student
          </h2>
          <div className={h.stack}>
            <CountSteppers keys={LEVELS} labels={LEVEL_LABELS} value={settings.counts} max={100} onChange={(counts) => set({ counts })} />
            <MixEditor value={settings.mix} technicalLabel={settings.track === "it" ? "Technical %" : "Soft skills %"} onChange={(mix) => set({ mix })} />
          </div>
        </section>

        <section className={h.card} aria-labelledby="paper-rules">
          <h2 id="paper-rules" className={h.cardTitle} style={{ marginBottom: "1rem" }}>
            Variety and timing
          </h2>
          <div className={h.stack}>
            <div className={s.numbers}>
              <NumberStepper
                label="Pool factor"
                min={1}
                max={3}
                value={settings.poolFactor}
                onChange={(poolFactor) => set({ poolFactor })}
                hint={settings.poolFactor === 1 ? "Every student gets the same questions." : `Generates ${settings.poolFactor}× the paper so students get different question sets.`}
              />
              <NumberStepper label="Duration (minutes)" min={5} max={240} value={settings.durationMin} onChange={(durationMin) => set({ durationMin })} />
            </div>
            <div className={s.toggles}>
              <label>
                <input type="checkbox" checked={settings.differentPerStudent} onChange={(e) => set({ differentPerStudent: e.target.checked })} />
                Different questions per student
              </label>
              <label>
                <input type="checkbox" checked={settings.shuffleQuestions} onChange={(e) => set({ shuffleQuestions: e.target.checked })} />
                Shuffle question order
              </label>
              <label>
                <input type="checkbox" checked={settings.shuffleOptions} onChange={(e) => set({ shuffleOptions: e.target.checked })} />
                Shuffle options
              </label>
            </div>
          </div>
        </section>
      </div>

      <div className={s.summary}>
        <div>
          <p className={s.summaryText}>
            <strong>{total} questions</strong> · will generate ~{total * settings.poolFactor} · {settings.durationMin} min
          </p>
          {(error || blocker) && (
            <p role={error ? "alert" : undefined} className={h.xs} style={error ? { color: "var(--ui-color-danger)" } : undefined}>
              {error ?? blocker}
            </p>
          )}
        </div>
        <Button type="submit" disabled={Boolean(blocker)} loading={submitting}>
          <Sparkles aria-hidden size={16} style={{ marginRight: 6 }} /> Create and generate
        </Button>
      </div>
    </form>
  );
}
