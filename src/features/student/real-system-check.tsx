"use client";

import { CheckCircle2, Circle, Maximize, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { entryStep, type EntryStep, type StudentSession } from "@/api/entry";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
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
  const [terms, setTerms] = useState(false);
  const [fs, setFs] = useState<Status>("todo");
  const [error, setError] = useState<string>();

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
    navigator.geolocation.getCurrentPosition(
      async (p) => setLoc((await record("location", true, { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })) ? "ok" : "error"),
      async () => {
        setLoc("error");
        await record("location", false, { reason: "denied" });
      },
      { timeout: 10000 },
    );
  };

  const acceptTerms = async (checked: boolean) => {
    setTerms(checked);
    if (checked && !(await record("terms", true))) setTerms(false);
  };

  const goFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFs((await record("fullscreen", true)) ? "ok" : "error");
    } catch {
      setFs("error");
      await record("fullscreen", false);
    }
  };

  const done = loc === "ok" && terms && fs === "ok";
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
          <section className={s.checkItem}>
            <div>
              <h2 className={h.row} style={{ fontWeight: 500 }}>
                <Icon st="ok" /> 1. Confirm it&apos;s you
              </h2>
              <p className={h.xs}>Verified as {student.fullName}</p>
            </div>
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
              <Button size="sm" onClick={askLocation}>
                <MapPin aria-hidden size={14} style={{ marginRight: 4 }} /> Allow location
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
              <p className={h.xs} role={fs === "error" ? "alert" : undefined}>
                {fs === "error" ? "Full screen didn't start. Try again." : fs === "ok" ? "Full screen on" : "Required for the test."}
              </p>
            </div>
            {fs !== "ok" && (
              <Button size="sm" disabled={!terms} onClick={goFullscreen}>
                Enter full screen
              </Button>
            )}
          </section>

          {error && (
            <p role="alert" className={h.xs} style={{ color: "var(--ui-color-danger, #b3261e)" }}>
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
