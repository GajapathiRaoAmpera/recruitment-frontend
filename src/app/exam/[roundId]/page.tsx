"use client";

import { CheckCircle2, Circle, Maximize, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NotFoundState } from "@/components/ui/states";
import { DemoNote, hire as h } from "@/components/hire/ui";
import { RealExamShell } from "@/features/student/real-exam-shell";
import { RealSystemCheck } from "@/features/student/real-system-check";
import { useExamRound, useStudent } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { MAX_TAB_SWITCHES, useStore } from "@/mock/store";

type Status = "todo" | "ok" | "error";

/** System check before every round: ID + DOB, location, terms, then full screen (FR-5..7). */
function MockSystemCheck() {
  const { roundId } = useParams<{ roundId: string }>();
  const router = useRouter();
  const { dispatch } = useStore();
  const { candidate, round, result, recorded } = useExamRound(roundId);
  const [studentId, setStudentId] = useState("");
  const [dob, setDob] = useState("");
  const [idStatus, setIdStatus] = useState<Status>("todo");
  const [loc, setLoc] = useState<Status>("todo");
  const [locMsg, setLocMsg] = useState("");
  const [terms, setTerms] = useState(false);

  if (!round || !candidate) return <NotFoundState title="Round not found" description="Open the link from your invite email." />;
  if (result?.locked)
    return (
      <div className={s.overlay}>
        <div className={s.overlayCard}>
          <h1 className={h.cardTitle}>This test is paused</h1>
          <p className={h.muted}>It closed after {MAX_TAB_SWITCHES} tab switches. HR has been alerted and can let you resume.</p>
          <Button asChild variant="secondary">
            <Link href="/student">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    );

  const log = (step: "id_dob" | "location" | "terms" | "fullscreen", ok: boolean) => recorded && dispatch({ type: "logVerification", log: { roundId, candidateId: candidate.id, step, ok } });

  const verifyId = () => {
    const ok = studentId.trim().toLowerCase() === candidate.studentId.toLowerCase() && dob === candidate.dob;
    setIdStatus(ok ? "ok" : "error");
    log("id_dob", ok);
  };

  const askLocation = () => {
    if (!navigator.geolocation) {
      setLoc("error");
      setLocMsg("This browser can't share location. Try Chrome or Firefox.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setLoc("ok");
        log("location", true);
      },
      () => {
        setLoc("error");
        setLocMsg("Location was blocked. Allow it from the address bar, then try again.");
        log("location", false);
      },
      { timeout: 10000 },
    );
  };

  const ready = idStatus === "ok" && loc === "ok" && terms;
  const next = round.type === "coding" ? "coding" : round.type === "ai_interview" ? "interview" : "test";

  const start = async () => {
    log("terms", true);
    try {
      await document.documentElement.requestFullscreen?.();
      log("fullscreen", true);
    } catch {
      log("fullscreen", false);
    }
    if (recorded && result?.status === "invited") dispatch({ type: "startAttempt", roundId, candidateId: candidate.id });
    router.push(`/exam/${roundId}/${next}`);
  };

  return (
    <>
      <header className={s.examBar}>
        <Logo height={22} />
        <div className={s.examTitle}>
          <p>{round.title}</p>
          <p className={h.xs}>System check · step {[idStatus === "ok", loc === "ok", terms].filter(Boolean).length + 1} of 4</p>
        </div>
        {!recorded && <Badge tone="warning">Preview</Badge>}
      </header>
      <main className={s.examBody} style={{ maxWidth: "44rem", marginInline: "auto", width: "100%" }}>
        <div className={s.checkList}>
          <section className={s.checkItem} aria-labelledby="id-h">
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 id="id-h" className={h.row} style={{ fontWeight: 500 }}>
                <StepIcon st={idStatus} /> 1. Confirm it&apos;s you
              </h2>
              {idStatus !== "ok" ? (
                <div className={h.grid2} style={{ marginTop: 12 }}>
                  <Field label="Student ID" error={idStatus === "error" ? "These details don't match your registration." : undefined}>
                    <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} />
                  </Field>
                  <Field label="Date of birth">
                    <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </Field>
                </div>
              ) : (
                <p className={h.xs}>Verified as {candidate.name}</p>
              )}
            </div>
            {idStatus !== "ok" && (
              <div className={h.stackSm}>
                <Button size="sm" onClick={verifyId}>
                  <ShieldCheck aria-hidden size={14} style={{ marginRight: 4 }} /> Verify
                </Button>
                <Button size="sm" variant="tertiary" onClick={() => { setStudentId(candidate.studentId); setDob(candidate.dob); }}>
                  Demo: fill
                </Button>
              </div>
            )}
          </section>

          <section className={s.checkItem} aria-labelledby="loc-h">
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 id="loc-h" className={h.row} style={{ fontWeight: 500 }}>
                <StepIcon st={loc} /> 2. Share your location
              </h2>
              <p className={h.xs} role={loc === "error" ? "alert" : undefined}>
                {loc === "error" ? locMsg : loc === "ok" ? "Location shared" : "Recorded once at the start, for test integrity."}
              </p>
            </div>
            {loc !== "ok" && (
              <div className={h.row}>
                <Button size="sm" disabled={idStatus !== "ok"} onClick={askLocation}>
                  <MapPin aria-hidden size={14} style={{ marginRight: 4 }} /> Allow location
                </Button>
                {loc === "error" && (
                  <Button size="sm" variant="tertiary" onClick={() => { setLoc("ok"); log("location", true); }}>
                    Demo: skip
                  </Button>
                )}
              </div>
            )}
          </section>

          <section className={s.checkItem} aria-labelledby="terms-h">
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 id="terms-h" className={h.row} style={{ fontWeight: 500 }}>
                <StepIcon st={terms ? "ok" : "todo"} /> 3. Accept the test rules
              </h2>
              <ul className={h.xs} style={{ marginTop: 6, listStyle: "disc", paddingLeft: 18 }}>
                <li>The test runs in full screen.</li>
                <li>Leaving the tab {MAX_TAB_SWITCHES} times closes the test; HR can let you resume.</li>
                <li>Your answers save automatically. The timer keeps running if you refresh.</li>
              </ul>
              <label className={h.row} style={{ marginTop: 10 }}>
                <input type="checkbox" className={h.check} checked={terms} disabled={loc !== "ok"} onChange={(e) => setTerms(e.target.checked)} /> I accept the terms and conditions
              </label>
            </div>
          </section>

          <section className={s.checkItem}>
            <div>
              <p style={{ fontWeight: 500 }} className={h.row}>
                <Maximize aria-hidden size={18} /> 4. Enter full screen and start
              </p>
              <p className={h.xs}>{round.durationMin} minutes · the timer starts when you click Start.</p>
            </div>
            <Button disabled={!ready} onClick={start}>
              Start {next === "interview" ? "interview" : "test"}
            </Button>
          </section>
          {!recorded && <DemoNote>Preview mode: you haven&apos;t been invited to this round, so nothing is recorded.</DemoNote>}
        </div>
      </main>
    </>
  );
}

function StepIcon({ st }: { st: Status }) {
  return st === "ok" ? <CheckCircle2 aria-hidden size={20} color="var(--ui-color-success)" /> : <Circle aria-hidden size={20} color="var(--ui-color-border-strong)" />;
}

export default function SystemCheckPage() {
  const { roundId } = useParams<{ roundId: string }>();
  const { real } = useStudent();
  if (!real) return <MockSystemCheck />;
  // No system check for a round that can't start here yet; the shell explains instead.
  if (real.rounds.find((r) => r.roundId === roundId)?.type === "ai_interview") return <RealExamShell student={real} roundId={roundId} />;
  return <RealSystemCheck student={real} roundId={roundId} />;
}
