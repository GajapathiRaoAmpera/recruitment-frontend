"use client";

import { CheckCircle2, Circle, Maximize, MapPin, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { entryConfirm, entryStep, entrySteps, type EntryStep, type StudentSession } from "@/api/entry";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  const [idBusy, setIdBusy] = useState(false);
  const [idError, setIdError] = useState<string>();
  const [studentId, setStudentId] = useState(student.studentId);
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string>();
  const idKey = `confirmed:${roundId}`;

  // A refresh must not lose progress: location + terms come back from the server, the ID confirm from this tab.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(idKey)) setId("ok"); // eslint-disable-line react-hooks/set-state-in-effect -- read once after mount (not in the initial state: that would not match the server render)
    } catch {
      /* private mode: they just confirm again */
    }
    let stale = false;
    entrySteps(student.entryToken, roundId)
      .then((st) => {
        if (stale) return;
        if (st.location) setLoc("ok");
        if (st.terms) setTerms(true);
      })
      .catch(() => {}); // best effort: the student can simply redo the steps
    return () => {
      stale = true;
    };
  }, [student.entryToken, roundId, idKey]);

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

  const confirmId = async () => {
    setIdBusy(true);
    setIdError(undefined);
    try {
      await entryConfirm(student.entryToken, roundId, studentId, dob);
      setId("ok");
      try {
        window.sessionStorage.setItem(idKey, "1");
      } catch {
        /* optional */
      }
    } catch (e) {
      setId("error");
      setIdError((e as Error).message);
    } finally {
      setIdBusy(false);
    }
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

  const done = id === "ok" && loc === "ok" && terms && fsOn;
  return (
    <>
      <header className={s.examBar}>
        <Logo height={22} />
        <div className={s.examTitle}>
          <p>{roundTitle[round.type as Round["type"]] ?? round.type}</p>
          <p className={h.xs}>System check</p>
        </div>
      </header>
      <main className={s.examBody} style={{ maxWidth: "44rem", marginInline: "auto", width: "100%" }}>
        <div className={s.checkList}>
          <section className={s.checkItem} aria-labelledby="id-h">
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 id="id-h" className={h.row} style={{ fontWeight: 500 }}>
                <Icon st={id} /> 1. Confirm it&apos;s you
              </h2>
              {id !== "ok" ? (
                <div className={h.grid2} style={{ marginTop: 12 }}>
                  <Field label="Student ID" error={idError}>
                    <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} />
                  </Field>
                  <Field label="Date of birth">
                    <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </Field>
                </div>
              ) : (
                <p className={h.xs}>Verified as {student.fullName}</p>
              )}
            </div>
            {id !== "ok" && (
              <Button size="sm" onClick={confirmId} loading={idBusy} disabled={!studentId.trim() || !dob}>
                {!idBusy && <ShieldCheck aria-hidden size={14} style={{ marginRight: 4 }} />} {idBusy ? "Checking…" : "Verify"}
              </Button>
            )}
          </section>

          <section className={s.checkItem}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 className={h.row} style={{ fontWeight: 500 }}>
                <Icon st={loc} /> 2. Share your location
              </h2>
              <p className={h.xs} role={loc === "error" ? "alert" : undefined}>
                {loc === "error" ? "Location was blocked or couldn't be saved. Allow it from the address bar, then try again." : loc === "ok" ? "Location shared" : "Recorded once at the start, for test integrity."}
              </p>
            </div>
            {loc !== "ok" && (
              <Button size="sm" onClick={askLocation} loading={locBusy} disabled={id !== "ok"}>
                {!locBusy && <MapPin aria-hidden size={14} style={{ marginRight: 4 }} />} {locBusy ? "Checking…" : "Allow location"}
              </Button>
            )}
          </section>

          <section className={s.checkItem}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 className={h.row} style={{ fontWeight: 500 }}>
                <Icon st={terms ? "ok" : "todo"} /> 3. Accept the test rules
              </h2>
              <ul className={h.xs} style={{ marginTop: 6, listStyle: "disc", paddingLeft: 18 }}>
                <li>The test runs in full screen.</li>
                <li>Leaving the tab {MAX_TAB_SWITCHES} times closes the test; HR can let you resume.</li>
                <li>Your answers save automatically.</li>
              </ul>
              <label className={h.row} style={{ marginTop: 10 }}>
                <input type="checkbox" className={h.check} checked={terms} disabled={loc !== "ok"} onChange={(e) => acceptTerms(e.target.checked)} /> I accept the terms and conditions
              </label>
            </div>
          </section>

          <section className={s.checkItem}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 className={h.row} style={{ fontWeight: 500 }}>
                <Maximize aria-hidden size={18} /> 4. Enter full screen
              </h2>
              <p className={h.xs} role={fsFailed ? "alert" : undefined}>
                {fsFailed ? "Full screen didn't start. Try again." : fsOn ? "Full screen on" : "Required for the test. It must stay on until you start."}
              </p>
            </div>
            {!fsOn && (
              <Button size="sm" disabled={!terms} onClick={goFullscreen}>
                Enter full screen
              </Button>
            )}
          </section>

          {error && (
            <p role="alert" className={h.xs} style={{ color: "var(--ui-color-danger)" }}>
              {error}
            </p>
          )}
          {done && (
            <section className={s.checkItem} role="status">
              <div>
                <p style={{ fontWeight: 500 }}>Verification complete</p>
                <p className={h.xs}>Your ID, location, terms and full screen are recorded. The timer starts when you click Start.</p>
              </div>
              <Button onClick={() => router.push(`/exam/${roundId}/test`)}>Start test</Button>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

function Icon({ st }: { st: Status }) {
  return st === "ok" ? <CheckCircle2 aria-hidden size={20} color="var(--ui-color-success)" /> : <Circle aria-hidden size={20} color="var(--ui-color-border-strong)" />;
}
