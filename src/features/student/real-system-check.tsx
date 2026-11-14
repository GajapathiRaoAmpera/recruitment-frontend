"use client";

import { Check, CheckCircle2, Circle, Maximize, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { entryStep, type EntryStep, type StudentSession } from "@/api/entry";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { CameraHeader, FaceCheck } from "@/features/student/face-check";
import { NotFoundState } from "@/components/ui/states";
import { hire as h } from "@/components/hire/ui";
import s from "@/components/student/student.module.scss";
import { roundTitle } from "@/mock/data";
import { MAX_TAB_SWITCHES } from "@/mock/store";
import type { Round } from "@/mock/types";

type Status = "todo" | "ok" | "error";

/**
 * System check for a student signed in through the API. ID + DOB were already verified at sign-in;
 * location, terms and full screen are each recorded on the server (/entry/steps).
 * shortcut: Start opens a test screen with the timer and checks but no questions yet (POST /entry/start and the attempt endpoints are not built).
 */
export function RealSystemCheck({ student, roundId }: { student: StudentSession; roundId: string }) {
  const router = useRouter();
  const round = student.rounds.find((r) => r.roundId === roundId);
  const [loc, setLoc] = useState<Status>("todo");
  const [locBusy, setLocBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [fsOn, setFsOn] = useState(false); // live: leaving full screen un-ticks this and hides Start
  const [fsFailed, setFsFailed] = useState(false);
  const [id, setId] = useState<Status>("todo");
  const [photo, setPhoto] = useState<string>(); // kept in this tab only, shown small so the invigilator can see it
  const [error, setError] = useState<string>();

  // Every visit walks the steps in order (photo, location, terms, full screen). Nothing is restored from the server, so no step can be skipped.

  // Full screen is read live and logged on every change, so the server and the screen agree.
  useEffect(() => {
    setFsOn(Boolean(document.fullscreenElement)); // eslint-disable-line react-hooks/set-state-in-effect -- one read on mount
    const onChange = () => {
      const on = Boolean(document.fullscreenElement);
      setFsOn(on);
      void entryStep(student.entryToken, roundId, "fullscreen", on).catch(() => {});
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [student.entryToken, roundId]);

  if (!round) return <NotFoundState title="Round not found" description="This round isn't open for you. Go back to your dashboard." />;

  const record = async (step: EntryStep, ok: boolean, meta: Record<string, unknown> = {}) => {
    try {
      await entryStep(student.entryToken, roundId, step, ok, meta);
      setError(undefined);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const askLocation = () => {
    if (!navigator.geolocation) {
      setLoc("error");
      return void record("location", false, { reason: "unsupported" });
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        setLoc((await record("location", true, { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })) ? "ok" : "error");
        setLocBusy(false);
      },
      async (e) => {
        setLoc("error");
        setLocBusy(false);
        await record("location", false, { reason: e.code === 1 ? "denied" : e.code === 2 ? "unavailable" : "timeout" });
      },
      { timeout: 8000, maximumAge: 300000 }, // accept a position up to 5 min old so it is instant when the browser has one
    );
  };

  const markPhoto = (dataUrl: string) => {
    setPhoto(dataUrl);
    setId("ok");
  };

  // Unticking is recorded too, so the server never keeps an old OK the screen no longer shows.
  const acceptTerms = async (checked: boolean) => {
    setTerms(checked);
    if (!(await record("terms", checked))) setTerms(!checked);
  };

  const goFullscreen = async () => {
    setFsFailed(false);
    try {
      await document.documentElement.requestFullscreen(); // the fullscreenchange listener records it
    } catch {
      setFsFailed(true);
      await record("fullscreen", false);
    }
  };

  const stage1Done = id === "ok" && loc === "ok" && fsOn; // Stage 1: photo, location, full screen. Stage 2: terms and start.
  const stage = stage1Done ? 1 : 0;
  const ready = stage1Done && terms;
  const current = id !== "ok" ? 1 : loc !== "ok" ? 2 : 3; // the step to do next; later ones stay locked
  const rowState = (n: number, done: boolean) => (done ? "done" : n === current ? "current" : "locked");
  const thumb = photo && (
    // eslint-disable-next-line @next/next/no-img-element -- a local data: URL
    <img src={photo} alt="Your verification photo" className={s.checkThumb} />
  );
  return (
    <>
      <header className={s.examBar}>
        <Logo height={22} />
        <div className={s.examTitle}>
          <p>{roundTitle[round.type as Round["type"]] ?? round.type}</p>
          <p className={h.xs}>System check</p>
        </div>
        {stage === 1 && thumb}
      </header>
      <main className={`${s.examBody} ${s.checkPage} ${stage === 0 ? s.checkPageCompact : ""}`}>
        <ol className={s.stepper} aria-label="System check progress" style={{ maxWidth: 480, marginInline: "auto", width: "100%" }}>
          {["Photo, location & full screen", "Terms & start"].map((name, i) => (
            <li key={name} className={s.stepperItem} data-state={i < stage ? "done" : i === stage ? "active" : "todo"} aria-current={i === stage ? "step" : undefined}>
              <span className={s.stepperDot}>{i < stage ? <Check aria-hidden size={16} /> : i + 1}</span>
              <span className={s.stepperLabel}>{name}</span>
            </li>
          ))}
        </ol>
        {stage === 0 && (
          <div className={s.checkGrid}>
            <section className={s.camPanel} aria-labelledby="cam-h">
              {id !== "ok" ? (
                <FaceCheck onVerified={markPhoto} />
              ) : (
                <>
                  <CameraHeader on={false} />
                  <div className={s.camVerified}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL */}
                    <img src={photo} alt="Your verification photo" className={s.camVerifiedPhoto} />
                    <p>Photo verified · camera off</p>
                  </div>
                </>
              )}
            </section>

            <section className={s.checkCard} aria-labelledby="sys-h">
              <h2 id="sys-h" className={s.checkCardTitle}>
                System check
              </h2>
              <ol className={s.checkSteps}>
                <li className={s.checkStep} data-state={rowState(1, id === "ok")}>
                  <Icon st={id} />
                  <div className={s.checkStepBody}>
                    <h3 id="id-h" className={s.checkStepTitle}>
                      1. Verify your identity
                    </h3>
                    <p className={s.checkStepText}>{id === "ok" ? "Photo verified. The camera is off." : "Take a clear photo with only you in view."}</p>
                  </div>
                </li>

                <li className={s.checkStep} data-state={rowState(2, loc === "ok")}>
                  <Icon st={loc} />
                  <div className={s.checkStepBody}>
                    <h3 className={s.checkStepTitle}>2. Share your location</h3>
                    <p className={s.checkStepText} role={loc === "error" ? "alert" : undefined}>
                      {loc === "error" ? "Location was blocked or couldn't be saved. Allow it from the address bar, then try again." : loc === "ok" ? "Location shared" : id !== "ok" ? "Unlocks after your photo is verified." : "Recorded once at the start, for test integrity."}
                    </p>
                  </div>
                  {loc !== "ok" && (
                    <Button size="sm" className={s.checkStepAction} onClick={askLocation} loading={locBusy} disabled={id !== "ok"}>
                      {!locBusy && <MapPin aria-hidden size={14} style={{ marginRight: 4 }} />} {locBusy ? "Checking…" : "Allow location"}
                    </Button>
                  )}
                </li>

                <li className={s.checkStep} data-state={rowState(3, fsOn)}>
                  {fsOn ? <Icon st="ok" /> : <Maximize aria-hidden size={20} />}
                  <div className={s.checkStepBody}>
                    <h3 className={s.checkStepTitle}>3. Enter full screen</h3>
                    <p className={s.checkStepText} role={fsFailed ? "alert" : undefined}>
                      {fsFailed ? "Full screen didn't start. Try again." : fsOn ? "Full screen on" : loc === "ok" ? "Required for the test. It must stay on until you finish." : "Unlocks after your location is shared."}
                    </p>
                  </div>
                  {!fsOn && (
                    <Button size="sm" className={s.checkStepAction} disabled={loc !== "ok"} onClick={goFullscreen}>
                      Enter full screen
                    </Button>
                  )}
                </li>
              </ol>
            </section>
          </div>
        )}

        {stage === 1 && (
          <div className={s.checkList}>
            <section className={s.checkItem}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h2 className={`${h.row} ${s.checkTitle}`}>
                  <Icon st={terms ? "ok" : "todo"} /> 4. Accept the test rules
                </h2>
                <ul className={s.checkText} style={{ marginTop: 6, listStyle: "disc", paddingLeft: 18 }}>
                  <li>The test runs in full screen.</li>
                  <li>Leaving the tab {MAX_TAB_SWITCHES} times closes the test; HR can let you resume.</li>
                  <li>Your answers save automatically.</li>
                  <li>Only you may take the test. No one else can be in the room helping, and you must not share questions or answers.</li>
                  <li>Don&apos;t use phones, notes, other websites, AI tools or any other help during the test.</li>
                  <li>Leaving full screen or switching tabs or windows is recorded and counts against you.</li>
                  <li>Your camera photo is used only to check that one person is taking the test, and your location is recorded once at the start.</li>
                  <li>The timer keeps running once you start, even if you lose connection, and the test submits by itself when time is up.</li>
                  <li>Once you submit, your answers are final and can&apos;t be changed.</li>
                </ul>
                <label className={h.row} style={{ marginTop: 10 }}>
                  <input type="checkbox" className={h.check} checked={terms} onChange={(e) => acceptTerms(e.target.checked)} /> I accept the terms and conditions
                </label>
              </div>
            </section>

            {error && (
              <p role="alert" className={s.checkText} style={{ color: "var(--ui-color-danger)" }}>
                {error}
              </p>
            )}
            <section className={s.checkItem}>
              <div>
                <p className={s.checkTitle}>{ready ? "Ready to start" : "Start test"}</p>
                <p className={s.checkText}>{ready ? "If the exam hasn't opened yet, you'll wait on the next screen and move in automatically when it starts." : "Accept the rules to enable this."}</p>
              </div>
              <Button disabled={!ready} onClick={() => router.push(`/exam/${roundId}/test`)}>
                Start test
              </Button>
            </section>
          </div>
        )}
      </main>
    </>
  );
}

function Icon({ st }: { st: Status }) {
  return st === "ok" ? <CheckCircle2 aria-hidden size={20} color="var(--ui-color-success)" /> : <Circle aria-hidden size={20} color="var(--ui-color-border-strong)" />;
}
