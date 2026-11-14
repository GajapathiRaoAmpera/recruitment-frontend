"use client";

import { CheckCircle2, Circle, Clock, Lock, MapPin, Maximize, TimerOff, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { entryStart, getAttempt, msLeft, reportViolation, saveAnswer, submitAttempt, type AttemptQuestion, type AttemptState } from "@/api/attempt";
import { entryStep, type StudentSession } from "@/api/entry";
import { ApiError } from "@/api/client";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, NotFoundState } from "@/components/ui/states";
import { hire as h } from "@/components/hire/ui";
import { exitFullscreen, useCountdown, useIntegrity } from "@/components/student/hooks";
import { useLocationWatch } from "@/components/student/use-location-watch";
import { safeStorage } from "@/lib/storage";
import { useLockdown } from "@/components/student/lockdown";
import s from "@/components/student/student.module.scss";
import { TabSwitchBadge } from "@/components/student/tab-switch-badge";
import { roundTitle } from "@/mock/data";
import type { Round } from "@/mock/types";
import { CodingWorkspace } from "@/features/test-runner/coding-workspace";

const RETRY_MS = 5000;

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
        if (!stale) {
          setError(undefined); // clears a "not open yet" wait once the round opens
          setAttempt({ token, state });
        }
      } catch (e) {
        if (!stale) setError(e as Error);
      }
    })();
    return () => {
      stale = true;
    };
  }, [round, checked, student.entryToken, roundId, tries]);

  if (!round) return <NotFoundState title="Round not found" description="This round isn't open for you. Go back to your dashboard." />;
  const notOpen = error instanceof ApiError && error.code === "ROUND_NOT_OPEN";
  // Exam not opened yet (papers not ready / drive not started): wait here and retry quietly until the server opens it.
  if (notOpen) return <WaitingRoom onRetry={() => setTries((n) => n + 1)} />;
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
  if (!attempt) return <RocketLoader label="Starting your test" />;
  // Keyed by attempt: a new round is a new attempt, so no timer, count or draft state carries over (AC-6).
  return <Shell key={attempt.token} student={student} roundId={roundId} type={round.type} token={attempt.token} initial={attempt.state} />;
}

const POLL_MS = 5000;

/** Shown when the server says the round can't be sat yet. Checks again every few seconds and starts by itself. */
function WaitingRoom({ onRetry }: { onRetry: () => void }) {
  useEffect(() => {
    const id = window.setInterval(onRetry, POLL_MS);
    return () => window.clearInterval(id);
  }, [onRetry]);
  return (
    <main className={s.examBody} style={{ maxWidth: "36rem", marginInline: "auto", width: "100%" }}>
      <section className={h.card} role="status" aria-live="polite">
        <h1 className={h.cardTitle}>The exam hasn&apos;t started yet</h1>
        <p className={h.muted}>Your system check is done. Please wait and follow your invigilator&apos;s instructions. Keep this page open and in full screen. You&apos;ll be taken to the exam automatically when it starts.</p>
        <RocketLoader size="inline" label="Waiting for the exam to start" />
        <Button asChild variant="secondary" style={{ marginTop: 12 }}>
          <Link href="/student">Back to dashboard</Link>
        </Button>
      </section>
    </main>
  );
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
  const item = (ok: boolean, label: string, fix: string) => (
    <li className={h.listItem} style={{ justifyContent: "flex-start", alignItems: "flex-start" }}>
      {ok ? <CheckCircle2 aria-hidden size={20} color="var(--ui-color-success)" /> : <XCircle aria-hidden size={20} color="var(--ui-color-danger)" />}
      <div>
        <p style={{ fontWeight: 500 }}>
          {label} {ok ? "on" : "off"}
        </p>
        {!ok && <p className={h.xs}>{fix}</p>}
      </div>
    </li>
  );
  return (
    <main className={s.examBody} style={{ maxWidth: "36rem", marginInline: "auto", width: "100%" }}>
      <section className={h.card}>
        <h1 className={h.cardTitle}>Before you start</h1>
        <p className={h.muted}>Location and full screen must both be on. Your timer starts only after this check passes.</p>
        {busy ? (
          <RocketLoader size="inline" still label="Checking location and full screen" />
        ) : (
          <>
            <ul className={h.list} style={{ marginBlock: 16 }}>
              {item(loc, "Location", "Click the lock or pin icon in the address bar, allow location, then check again.")}
              {item(fs, "Full screen", "The button below switches the test to full screen.")}
            </ul>
            <Button onClick={() => { setBusy(true); void run(true); }}>{fs ? "Check again" : "Enter full screen and check"}</Button>
          </>
        )}
      </section>
    </main>
  );
}

/** Full-screen blocker shown over the test. The page behind it is inert, so focus can't wander there. */
function Overlay({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className={s.overlay} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-h`}>
      <div className={s.overlayCard}>
        {icon}
        <h1 id={`${id}-h`} className={h.cardTitle}>
          {title}
        </h1>
        {children}
      </div>
    </div>
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
  const [answers, setAnswers] = useState(initial.savedAnswers); // multiple choice only; coding saves itself
  const [current, setCurrent] = useState(0);
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
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (unsent.current > 0) {
        const r = await reportViolation(token, "tab_switch");
        unsent.current -= 1;
        setPending(unsent.current);
        setConfirmed(r.tabSwitches);
        if (r.locked) setLocked(true);
      }
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      flushing.current = false;
    }
  }, [token]);

  // Answers go through one queue: the latest choice per question is sent, in order, and kept until the server has it.
  const queue = useRef(new Map<string, number>());
  const saving = useRef(false);
  const [unsaved, setUnsaved] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const flushSaves = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      while (queue.current.size > 0) {
        const [qid, value] = queue.current.entries().next().value!;
        await saveAnswer(token, qid, value);
        if (queue.current.get(qid) === value) queue.current.delete(qid);
        setUnsaved(queue.current.size);
      }
      setSaveError(false);
    } catch {
      setSaveError(true);
    } finally {
      saving.current = false;
      setUnsaved(queue.current.size);
    }
  }, [token]);

  const { fullscreen, enterFullscreen } = useIntegrity(live, () => {
    unsent.current += 1;
    setPending(unsent.current); // shown at once; confirmed + pending never goes backwards
    void flush();
  }, () => {
    void reportViolation(token, "fullscreen_exit").catch(() => {}); // logged for HR; only tab/window trips count toward the lock
  });
  const retry = useCallback(() => {
    void flush();
    void flushSaves();
  }, [flush, flushSaves]);
  useEffect(() => {
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [retry]);
  // Keep retrying while something is unsent, so the student is never stuck waiting for an "online" event.
  useEffect(() => {
    if (!live || (!offline && !saveError)) return;
    const id = setInterval(retry, RETRY_MS);
    return () => clearInterval(id);
  }, [live, offline, saveError, retry]);

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

  const mcqs = initial.questions;
  const isCoding = type === "coding";

  const choose = (qid: string, i: number) => {
    setAnswers((a) => ({ ...a, [qid]: i }));
    queue.current.set(qid, i);
    setUnsaved(queue.current.size);
    void flushSaves();
  };

  // Submit makes the answers final. Unsaved answers are sent first. The same call runs by itself when time
  // runs out. A locked attempt can't submit (HR has to let the student resume).
  const submit = async (auto = false) => {
    setSubmitting(true);
    setSubmitError(undefined);
    await flushSaves();
    if (queue.current.size > 0 && !auto) {
      setSubmitting(false);
      setSubmitError("Some answers aren't saved yet. Check your connection and try again.");
      return;
    }
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
      void submit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired, locked, submitted]);

  const answeredCount = mcqs.filter((x) => answers[x.id] !== undefined).length;
  const unanswered = isCoding ? 0 : mcqs.length - answeredCount;
  const markedCount = mcqs.filter((x) => marked.includes(x.id)).length;
  const closed = locked || expired || submitted;
  // Anything covering the test; dialogs underneath close and the page behind goes inert.
  const blocked = closed || (live && (!locationOn || !fullscreen));

  const status = offline
    ? "Offline: reconnecting…"
    : unsaved > 0
      ? saveError
        ? `${unsaved} answer${unsaved === 1 ? "" : "s"} not saved yet, retrying…`
        : "Saving…"
      : isCoding
        ? `${initial.coding.length} coding problem${initial.coding.length === 1 ? "" : "s"}`
        : `${answeredCount} of ${mcqs.length} answered · ${markedCount} marked for review`;

  return (
    <>
      <div className={isCoding ? undefined : s.mcqRoot}>
      <header className={s.examBar} inert={blocked}>
        <Logo height={22} />
        <div className={s.examTitle}>
          <p>{isCoding ? (roundTitle[type as Round["type"]] ?? type) : "Online Assessment – Round 1"}</p>
          <p className={h.xs} aria-live="polite" style={saveError || offline ? { color: "var(--ui-color-danger)" } : undefined}>
            {status}
          </p>
        </div>
        <Badge tone={locationOn ? "success" : "danger"}>
          <MapPin aria-hidden size={12} style={{ marginRight: 4 }} />
          Location {locationOn ? "on" : "off"}
        </Badge>
        <TabSwitchBadge count={switches} max={max} />
        {isCoding && (
          <span className={s.timer} data-low={left < 5 * 60_000} role="timer" aria-label={`Time left ${label}`}>
            <Clock aria-hidden size={16} /> {label}
          </span>
        )}
        <Button variant="secondary" disabled={submitting} onClick={() => (closed ? router.push("/student") : setConfirm("leave"))}>
          Leave
        </Button>
        {isCoding && (
        <Button variant="danger" disabled={closed || offline} title={offline ? "Reconnecting: submit unlocks when you're back online" : undefined} loading={submitting} onClick={() => setConfirm("submit")}>
          Submit test
        </Button>
        )}
      </header>

      {isCoding ? (
        // The workspace renders its own <main>; the wrapper makes it inert under an overlay.
        <div inert={blocked} style={{ width: "100%" }}>
          <CodingWorkspace token={token} attempt={initial} live={live} submitted={submitted} onClosed={(k) => (k === "expired" ? setExpired(true) : setLocked(true))} />
        </div>
      ) : (
        <main inert={blocked} className={s.mcqMain}>
          <McqBody
            questions={mcqs}
            answers={answers}
            marked={marked}
            current={current}
            live={live}
            onGo={(i) => setCurrent(Math.max(0, Math.min(mcqs.length - 1, i)))}
            onChoose={choose}
            onToggleMark={toggleMark}
            counts={{ answered: answeredCount, marked: markedCount, unanswered }}
            left={left}
            canSubmit={!closed && !offline}
            submitting={submitting}
            onSubmit={() => setConfirm("submit")}
          />
        </main>
      )}
      </div>

      <ConfirmDialog
        open={confirm === "submit" && !blocked}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        destructive={false}
        title="Submit your test?"
        description={`${unanswered ? `${unanswered} question(s) are unanswered. ` : ""}${markedCount ? `${markedCount} marked for review. ` : ""}${isCoding ? "Only code you submitted counts, not code you only ran. " : ""}Your answers become final and you can't change them after submitting.`}
        confirmLabel="Submit test"
        loading={submitting}
        error={submitError}
        onConfirm={() => submit()}
      />
      <ConfirmDialog
        open={confirm === "leave" && !blocked}
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

      {submitted && (
        <Overlay id="done" icon={<CheckCircle2 aria-hidden size={32} color="var(--ui-color-success)" />} title="Test submitted">
          <p className={h.muted}>
            Your answers are final.{timeTaken !== null && ` Time taken: ${Math.max(1, Math.round(timeTaken / 60))} min.`} HR will share the result after review.
          </p>
          <Button asChild variant="secondary" autoFocus>
            <Link href="/student">Back to dashboard</Link>
          </Button>
        </Overlay>
      )}

      {locked && !submitted && (
        <Overlay id="lock" icon={<Lock aria-hidden size={32} />} title="Your test is paused">
          <p className={h.muted}>You left the test tab {max} times, so it closed. Your answers are saved. HR can let you resume with the time you had left.</p>
          <Button asChild variant="secondary" autoFocus>
            <Link href="/student">Back to dashboard</Link>
          </Button>
        </Overlay>
      )}

      {expired && !locked && !submitted && (
        <Overlay id="end" icon={<TimerOff aria-hidden size={32} />} title="Time is up">
          {submitError ? (
            <>
              <p className={h.muted}>Your answers are saved, but they couldn&apos;t be submitted yet: {submitError}</p>
              <Button loading={submitting} autoFocus onClick={() => void submit(true)}>
                Try submitting again
              </Button>
            </>
          ) : (
            <RocketLoader size="inline" still label="Submitting your answers" />
          )}
        </Overlay>
      )}

      {live && !locationOn && (
        <Overlay id="loc" icon={<MapPin aria-hidden size={32} />} title="Turn location back on">
          <p className={h.muted}>The test needs your location for the whole test. Allow it from the address bar, then check again. Your timer is still running.</p>
          <Button autoFocus onClick={checkLocation}>
            Check again
          </Button>
        </Overlay>
      )}

      {live && locationOn && !fullscreen && (
        <Overlay id="fs" icon={<Maximize aria-hidden size={32} />} title="Return to full screen">
          <p className={h.muted}>The test must stay in full screen. Your timer is still running.</p>
          <Button autoFocus onClick={enterFullscreen}>
            Enter full screen
          </Button>
        </Overlay>
      )}
    </>
  );
}

interface McqBodyProps {
  questions: AttemptQuestion[];
  answers: AttemptState["savedAnswers"];
  marked: string[];
  current: number;
  live: boolean;
  onGo: (i: number) => void;
  onChoose: (qid: string, option: number) => void;
  onToggleMark: (qid: string) => void;
  counts: { answered: number; marked: number; unanswered: number };
  left: number;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
function hms(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { h: pad(Math.floor(total / 3600)), m: pad(Math.floor((total % 3600) / 60)), s: pad(total % 60) };
}

/** Multiple choice: a question navigator beside the current question. */
function McqBody({ questions, answers, marked, current, live, onGo, onChoose, onToggleMark, counts, left, canSubmit, submitting, onSubmit }: McqBodyProps) {
  const q = questions[current];
  const [rough, setRough] = useState(""); // one shared scratchpad for every question; stays in this tab and is never sent to the server
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  if (q && !visited.has(q.id)) setVisited(new Set(visited).add(q.id)); // mark visited while rendering
  if (!q)
    return (
      <div className={s.examBody} style={{ maxWidth: "48rem", marginInline: "auto" }}>
        <section className={h.card}>
          <h1 className={h.cardTitle}>No questions yet</h1>
          <p className={h.muted}>HR hasn&apos;t added questions to this test.</p>
        </section>
      </div>
    );
  const stateOf = (id: string) => (marked.includes(id) ? "marked" : typeof answers[id] === "number" ? "answered" : visited.has(id) || id === q.id ? "visited" : "todo");
  const stateLabel = { marked: "marked for review", answered: "answered", visited: "visited, not answered", todo: "not visited" } as const;
  const isMarked = marked.includes(q.id);

  const t = hms(left);
  const isLast = current === questions.length - 1;

  return (
    <div className={s.mcq}>
      <section className={s.mcqLeft} aria-labelledby="q-h">
        <div className={s.mcqScroll} tabIndex={0}>
          <p className={h.eyebrow} style={{ marginBottom: 8 }}>
            Question {current + 1} of {questions.length} · {q.marks} mark{q.marks === 1 ? "" : "s"}
          </p>
          <h1 id="q-h" style={{ fontSize: "1.125rem", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {q.body}
          </h1>
          <fieldset className={h.stackSm} style={{ marginTop: 24 }} disabled={!live}>
            <legend className="sr-only">Options</legend>
            {q.options.map((o, i) => (
              <label key={i} className={s.option}>
                <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => onChoose(q.id, i)} />
                <span style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                  <span className={s.optionKey}>{String.fromCharCode(65 + i)}.</span> {o}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <div className={s.mcqActions}>
          <Button variant="secondary" disabled={!live} aria-pressed={isMarked} onClick={() => onToggleMark(q.id)}>
            {isMarked ? <CheckCircle2 aria-hidden size={16} style={{ marginRight: 4 }} /> : <Circle aria-hidden size={16} style={{ marginRight: 4 }} />}
            {isMarked ? "Marked for review" : "Mark for review"}
          </Button>
          <span className={s.mcqSpacer} />
          <Button variant="secondary" disabled={current === 0} onClick={() => onGo(current - 1)}>
            Previous
          </Button>
          {isLast ? (
            <Button variant="danger" disabled={!canSubmit} loading={submitting} onClick={onSubmit}>
              Submit test
            </Button>
          ) : (
            <Button onClick={() => onGo(current + 1)}>Next</Button>
          )}
        </div>
      </section>

      <aside className={s.mcqSide} aria-label="Question navigator">
        <div className={s.mcqTimer}>
          <p className={h.eyebrow}>Time left</p>
          <div role="timer" aria-label={`Time left ${t.h}:${t.m}:${t.s}`} data-low={left < 5 * 60_000} className={s.mcqClock}>
            <span><b>{t.h}</b><small>Hours</small></span>
            <span><b>{t.m}</b><small>Minutes</small></span>
            <span><b>{t.s}</b><small>Seconds</small></span>
          </div>
        </div>
        <div className={s.mcqNav}>
          <p className={h.eyebrow} style={{ marginBottom: 12 }}>
            Questions
          </p>
          <div className={s.palette}>
            {questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                className={s.paletteBtn}
                data-state={i === current ? "current" : stateOf(x.id)}
                aria-current={i === current ? "step" : undefined}
                aria-label={`Question ${i + 1}, ${stateLabel[stateOf(x.id)]}`}
                onClick={() => onGo(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
        <div className={s.mcqRough}>
          <label htmlFor="rough-work" className={h.eyebrow}>
            Rough work <span style={{ textTransform: "none", letterSpacing: 0 }}>(not saved or marked)</span>
          </label>
          <textarea id="rough-work" className={s.mcqRoughArea} value={rough} onChange={(e) => setRough(e.target.value)} placeholder="Use this space for your rough work…" spellCheck={false} />
        </div>
        <div className={s.legend} aria-hidden>
          <span className={s.legendItem} data-state="current">Current</span>
          <span className={s.legendItem} data-state="answered">Answered ({counts.answered})</span>
          <span className={s.legendItem} data-state="visited">Not answered</span>
          <span className={s.legendItem} data-state="marked">Marked ({counts.marked})</span>
          <span className={s.legendItem} data-state="todo">Not visited</span>
        </div>
      </aside>
    </div>
  );
}
