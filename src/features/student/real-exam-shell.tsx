"use client";

import { CheckCircle2, Clock, Lock, MapPin, Maximize, TimerOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { entryStart, getAttempt, msLeft, reportViolation, saveAnswer, submitAttempt, type AttemptState } from "@/api/attempt";
import { entryStep, type StudentSession } from "@/api/entry";
import { ApiError } from "@/api/client";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingLabel } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, NotFoundState } from "@/components/ui/states";
import { hire as h } from "@/components/hire/ui";
import { exitFullscreen, useCountdown, useIntegrity } from "@/components/student/hooks";
import { useLocationWatch } from "@/components/student/use-location-watch";
import { safeStorage } from "@/lib/storage";
import { useLockdown } from "@/components/student/lockdown";
import s from "@/components/student/student.module.scss";
import { TabSwitchBadge } from "@/components/student/tab-switch-badge";
import { CodingWorkspace } from "@/features/test-runner/coding-workspace";
import { roundTitle } from "@/mock/data";
import type { Round } from "@/mock/types";

/** The test screen for a student signed in through the API. Timer, tab-switch count and lock come from the server. */
export function RealExamShell({ student, roundId }: { student: StudentSession; roundId: string }) {
  const round = student.rounds.find((r) => r.roundId === roundId);
  const [attempt, setAttempt] = useState<{ token: string; state: AttemptState }>();
  const [error, setError] = useState<ApiError | Error>();
  const [tries, setTries] = useState(0);
  const [checked, setChecked] = useState(false); // location + full screen re-checked; the timer starts only after this

  useEffect(() => {
    if (!round || !checked) return;
    let stale = false;
    (async () => {
      try {
        const token = await entryStart(student.entryToken, roundId); // repeating it keeps the same deadline
        const state = await getAttempt(token);
        if (!stale) setAttempt({ token, state });
      } catch (e) {
        if (!stale) setError(e as Error);
      }
    })();
    return () => {
      stale = true;
    };
  }, [round, checked, student.entryToken, roundId, tries]);

  if (!round) return <NotFoundState title="Round not found" description="This round isn't open for you. Go back to your dashboard." />;
  if (error) {
    const stepsMissing = error instanceof ApiError && error.code === "STEPS_MISSING";
    return (
      <main className={s.examBody} style={{ maxWidth: "36rem", marginInline: "auto" }}>
        <ErrorState message={stepsMissing ? "Finish the system check (location and rules) before you start." : error.message} onRetry={stepsMissing ? undefined : () => { setError(undefined); setTries((n) => n + 1); }} />
        <div className={h.row} style={{ marginTop: 12 }}>
          <Button asChild variant="secondary">
            <Link href={stepsMissing ? `/exam/${roundId}` : "/student"}>{stepsMissing ? "Go to system check" : "Back to dashboard"}</Link>
          </Button>
        </div>
      </main>
    );
  }
  if (!checked) return <StartCheck student={student} roundId={roundId} onPass={() => setChecked(true)} />;
  if (!attempt) return <LoadingLabel label="Starting your test" />;
  return <Shell student={student} roundId={roundId} type={round.type} token={attempt.token} initial={attempt.state} />;
}

/** Runs right when the test opens, before the timer starts: location and full screen must both be on. */
function StartCheck({ student, roundId, onPass }: { student: StudentSession; roundId: string; onPass: () => void }) {
  const [busy, setBusy] = useState(true);
  const [loc, setLoc] = useState(false);
  const [fs, setFs] = useState(false);
  const run = useCallback(
    async (enterFs: boolean) => {
      if (enterFs && !document.fullscreenElement) await document.documentElement.requestFullscreen?.().catch(() => {}); // needs the click that called us
      const fsOk = Boolean(document.fullscreenElement);
      const pos = await new Promise<GeolocationPosition | undefined>((res) =>
        navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, () => res(undefined), { timeout: 8000, maximumAge: 300000 }) : res(undefined),
      );
      const locOk = Boolean(pos);
      // the server's latest "location" log decides whether the test may start, so log this fresh result
      await entryStep(student.entryToken, roundId, "location", locOk, pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } : { reason: "start_check" }).catch(() => {});
      await entryStep(student.entryToken, roundId, "fullscreen", fsOk).catch(() => {}); // the server requires it to start
      setLoc(locOk);
      setFs(fsOk);
      setBusy(false);
      if (locOk && fsOk) onPass();
    },
    [student.entryToken, roundId, onPass],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after the async check, not synchronously
    void run(false);
  }, [run]);
  return (
    <main className={s.examBody} style={{ maxWidth: "36rem", marginInline: "auto" }}>
      <section className={h.card}>
        <h1 className={h.cardTitle}>Checking before you start</h1>
        <p className={h.muted}>Location and full screen must be on. The timer starts after this check.</p>
        {busy ? (
          <LoadingLabel label="Checking…" />
        ) : (
          <>
            <ul className={h.list}>
              <li className={h.listItem}>{loc ? "✓" : "✗"} Location</li>
              <li className={h.listItem}>{fs ? "✓" : "✗"} Full screen</li>
            </ul>
            <Button onClick={() => { setBusy(true); void run(true); }}>Check again</Button>
          </>
        )}
      </section>
    </main>
  );
}

function Shell({ student, roundId, type, token, initial }: { student: StudentSession; roundId: string; type: string; token: string; initial: AttemptState }) {
  const [confirmed, setConfirmed] = useState(initial.tabSwitches); // the server's count
  const [pending, setPending] = useState(0); // switches not confirmed by the server yet
  const [locked, setLocked] = useState(initial.status === "locked");
  const [expired, setExpired] = useState(initial.status === "expired");
  const router = useRouter();
  const [submitted, setSubmitted] = useState(initial.status === "submitted");
  const [timeTaken, setTimeTaken] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [confirm, setConfirm] = useState<"submit" | "leave">();
  const [answers, setAnswers] = useState(initial.savedAnswers);
  const [current, setCurrent] = useState(0);
  const [saveError, setSaveError] = useState<string>();
  // shortcut: "marked for review" is this browser's note to itself (the API has no field for it); it is not sent to HR.
  const markKey = `exam-marked:${roundId}`;
  const [marked, setMarked] = useState<string[]>(() => {
    try {
      return JSON.parse(safeStorage.get(markKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const toggleMark = (id: string) => {
    const next = marked.includes(id) ? marked.filter((x) => x !== id) : [...marked, id];
    setMarked(next);
    safeStorage.set(markKey, JSON.stringify(next));
  };
  const [offline, setOffline] = useState(false);
  const max = initial.maxTabSwitches;
  const switches = Math.min(max, confirmed + pending);
  // Deadline from the server's clock, computed once: a wrong laptop clock changes nothing.
  const [deadline] = useState(() => Date.now() + msLeft(initial));
  const live = !locked && !expired && !submitted;

  useLockdown(live);

  // A dropped network can look like a tab switch, so unsent ones are kept and re-sent; it only ever locks.
  const unsent = useRef(0);
  const flushing = useRef(false);
  const flush = async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (unsent.current > 0) {
        const r = await reportViolation(token, "tab_switch");
        unsent.current -= 1;
        setPending(unsent.current);
        setConfirmed(r.tabSwitches);
        if (r.locked) setLocked(true);
        setOffline(false);
      }
    } catch {
      setOffline(true);
    } finally {
      flushing.current = false;
    }
  };
  const { fullscreen, enterFullscreen } = useIntegrity(live, () => {
    unsent.current += 1;
    setPending(unsent.current); // shown at once; confirmed + pending never goes backwards
    void flush();
  }, () => {
    void reportViolation(token, "fullscreen_exit").catch(() => {}); // logged for HR; only tab/window trips count toward the lock
  });
  useEffect(() => {
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  });

  const { left, label } = useCountdown(deadline, () => setExpired(true));
  // Location must stay on for the whole test. Each change is logged on the server; a lost log never blocks the student.
  const { on: locationOn, retry: checkLocation } = useLocationWatch(live, (ok, meta) => {
    void entryStep(student.entryToken, roundId, "location", ok, meta).catch(() => {});
  });

  // Once the test is over (submitted, expired or locked) leave full screen, and keep leaving if it comes back.
  useEffect(() => {
    if (live) return;
    exitFullscreen();
    document.addEventListener("fullscreenchange", exitFullscreen);
    return () => document.removeEventListener("fullscreenchange", exitFullscreen);
  }, [live]);

  const questions = initial.questions;
  const q = questions[current];
  const choose = async (i: number) => {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: i }));
    try {
      await saveAnswer(token, q.id, i);
      setSaveError(undefined);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  // Submit makes the answers final. Until then they are saved but can still change. The same call runs
  // by itself when time runs out. A locked attempt can't submit (HR has to let the student resume).
  const submit = async () => {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const r = await submitAttempt(token);
      setTimeTaken(r.timeTakenSec);
      setSubmitted(true);
      safeStorage.set(markKey, "[]");
      setConfirm(undefined);
      exitFullscreen();
    } catch (e) {
      setSubmitError((e as Error).message); // the dialog stays open and shows why
    } finally {
      setSubmitting(false);
    }
  };
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (expired && !locked && !submitted && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, locked, submitted]);
  const unanswered = questions.length - Object.keys(answers).length;
  const markedCount = questions.filter((x) => marked.includes(x.id)).length;
  const closed = locked || expired || submitted;

  return (
    <>
      <header className={s.examBar}>
        <Logo height={22} />
        <div className={s.examTitle}>
          <p>{roundTitle[type as Round["type"]] ?? type}</p>
          <p className={h.xs} aria-live="polite">
            {offline ? "Offline: reconnecting…" : saveError ?? (type === "coding" ? `${initial.coding.length} coding problem(s)` : `${Object.keys(answers).length} of ${questions.length} answered`)}
            {offline ? "Offline: reconnecting…" : saveError ?? `${Object.keys(answers).length} of ${questions.length} answered · ${markedCount} marked for review`}
          </p>
        </div>
        <Badge tone={locationOn ? "success" : "danger"}>
          <MapPin aria-hidden size={12} style={{ marginRight: 4 }} />
          Location {locationOn ? "on" : "off"}
        </Badge>
        <TabSwitchBadge count={switches} max={max} />
        <span className={s.timer} data-low={left < 5 * 60_000} role="timer" aria-label={`Time left ${label}`}>
          <Clock aria-hidden size={16} /> {label}
        </span>
        <Button variant="secondary" disabled={submitting} onClick={() => (closed ? router.push("/student") : setConfirm("leave"))}>
          Leave
        </Button>
        <Button variant="danger" disabled={closed || !!offline} loading={submitting} onClick={() => setConfirm("submit")}>
          Submit test
        </Button>
      </header>

      {type === "coding" ? (
        <CodingWorkspace token={token} attempt={initial} live={live} submitted={submitted} onClosed={(k) => (k === "expired" ? setExpired(true) : setLocked(true))} />
      ) : (
      <main className={s.examBody} style={{ maxWidth: "48rem", marginInline: "auto", width: "100%" }}>
        {!q ? (
          <section className={h.card}>
            <h1 className={h.cardTitle}>No questions yet</h1>
            <p className={h.muted}>HR hasn&apos;t added questions to this test.</p>
          </section>
        ) : (
          <section className={h.card} aria-labelledby="q-h">
            <p className={h.eyebrow} style={{ marginBottom: 8 }}>
              Question {current + 1} of {questions.length} · +{q.marks} mark
            </p>
            <h1 id="q-h" style={{ fontSize: "1.25rem", lineHeight: 1.5 }}>
              {q.body}
            </h1>
            <fieldset className={h.stackSm} style={{ marginTop: 24 }} disabled={!live}>
              <legend className="sr-only">Options</legend>
              {q.options.map((o, i) => (
                <label key={i} className={s.option}>
                  <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => void choose(i)} />
                  <span>
                    <span className={s.optionKey}>{String.fromCharCode(65 + i)}.</span> {o}
                  </span>
                </label>
              ))}
            </fieldset>
            <div className={h.between} style={{ marginTop: 24 }}>
              <Button variant="secondary" disabled={current === 0} onClick={() => setCurrent(current - 1)}>
                Previous
              </Button>
              <div className={h.row}>
                <Button variant="secondary" disabled={!live} aria-pressed={marked.includes(q.id)} onClick={() => toggleMark(q.id)}>
                  {marked.includes(q.id) ? "Unmark" : "Mark for review"}
                </Button>
                <Button disabled={current === questions.length - 1} onClick={() => setCurrent(current + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>
      )}

      {submitted && (
        <div className={s.overlay} role="alertdialog" aria-labelledby="done-h">
          <div className={s.overlayCard}>
            <CheckCircle2 aria-hidden size={32} color="var(--ui-color-success)" />
            <h1 id="done-h" className={h.cardTitle}>
              Test submitted
            </h1>
            <p className={h.muted}>
              Your answers are final.{timeTaken !== null && ` Time taken: ${Math.max(1, Math.round(timeTaken / 60))} min.`} HR will share the result after review.
            </p>
            <Button asChild variant="secondary">
              <Link href="/student">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      )}

      {expired && !locked && !submitted && submitError && (
        <div className={s.overlay} role="alertdialog" aria-labelledby="sub-h">
          <div className={s.overlayCard}>
            <TimerOff aria-hidden size={32} />
            <h1 id="sub-h" className={h.cardTitle}>
              Time is up
            </h1>
            <p className={h.muted}>Your answers are saved, but they couldn&apos;t be submitted yet: {submitError}</p>
            <Button loading={submitting} onClick={() => void submit()}>
              Try submitting again
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "submit"}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        destructive={false}
        title="Submit your test?"
        description={`${unanswered ? `${unanswered} question(s) are unanswered. ` : ""}${markedCount ? `${markedCount} marked for review. ` : ""}Your answers become final and you can't change them after submitting.`}
        confirmLabel="Submit test"
        loading={submitting}
        error={submitError}
        onConfirm={submit}
      />
      <ConfirmDialog
        open={confirm === "leave"}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        destructive={false}
        title="Leave the test?"
        description="Your answers are saved but not final until you press Submit. The timer keeps running while you are away, and leaving the page counts as a tab switch."
        confirmLabel="Leave"
        onConfirm={() => {
          exitFullscreen();
          router.push("/student");
        }}
      />

      {locked && (
        <div className={s.overlay} role="alertdialog" aria-labelledby="lock-h" aria-describedby="lock-d">
          <div className={s.overlayCard}>
            <Lock aria-hidden size={32} />
            <h1 id="lock-h" className={h.cardTitle}>
              Your test is paused
            </h1>
            <p id="lock-d" className={h.muted}>
              You left the test tab {max} times, so it closed. Your answers are saved. HR can let you resume with the time you had left.
            </p>
            <Button asChild variant="secondary">
              <Link href="/student">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      )}

      {expired && !locked && !submitted && !submitError && (
        <div className={s.overlay} role="alertdialog" aria-labelledby="end-h">
          <div className={s.overlayCard}>
            <TimerOff aria-hidden size={32} />
            <h1 id="end-h" className={h.cardTitle}>
              Time is up
            </h1>
            <p className={h.muted}>Submitting your answers…</p>
          </div>
        </div>
      )}

      {live && !locationOn && (
        <div className={s.overlay} role="alertdialog" aria-labelledby="loc-h">
          <div className={s.overlayCard}>
            <MapPin aria-hidden size={32} />
            <h1 id="loc-h" className={h.cardTitle}>
              Turn location back on
            </h1>
            <p className={h.muted}>The test needs your location for the whole test. Allow it from the address bar, then check again. Your timer is still running.</p>
            <Button onClick={checkLocation}>Check again</Button>
          </div>
        </div>
      )}

      {live && locationOn && !fullscreen && (
        <div className={s.overlay} role="alertdialog" aria-labelledby="fs-h">
          <div className={s.overlayCard}>
            <Maximize aria-hidden size={32} />
            <h1 id="fs-h" className={h.cardTitle}>
              Return to full screen
            </h1>
            <p className={h.muted}>The test must stay in full screen. Your timer is still running.</p>
            <Button onClick={enterFullscreen}>Enter full screen</Button>
          </div>
        </div>
      )}
    </>
  );
}
