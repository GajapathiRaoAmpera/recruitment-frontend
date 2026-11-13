"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { safeStorage } from "@/lib/storage";
import { useStore } from "@/mock/store";

/** Current student. Anyone without a student session is sent to sign in. */
export function useStudent() {
  const { state, ready } = useStore();
  const router = useRouter();
  const session = state.session?.role === "STUDENT" ? state.session : null;
  useEffect(() => {
    if (ready && !session) router.replace("/student/login");
  }, [ready, session, router]);
  const candidate = state.candidates.find((c) => c.id === session?.candidateId);
  const drive = state.drives.find((d) => d.id === candidate?.driveId);
  return { candidate, drive, real: session?.student };
}

export interface ExamDraft<T> {
  deadline: number; // epoch ms
  startedAt: number;
  data: T;
}

/**
 * Local draft of an attempt (answers/code + deadline), keyed per attempt.
 * shortcut: deadline lives in localStorage for the prototype; the API owns it for real (D5) and the client only displays it.
 */
export function useExamDraft<T>(key: string, durationMin: number, initial: T) {
  const storageKey = `exam:${key}`;
  const [draft, setDraft] = useState<ExamDraft<T>>(() => {
    const raw = safeStorage.get(storageKey);
    if (raw) {
      try {
        return JSON.parse(raw) as ExamDraft<T>;
      } catch {
        /* corrupt draft: start fresh */
      }
    }
    const now = Date.now();
    return { deadline: now + durationMin * 60_000, startedAt: now, data: initial };
  });
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Debounced write so typing doesn't hit storage on every keystroke.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      safeStorage.set(storageKey, JSON.stringify(draft));
      setSavedAt(new Date());
    }, 400);
    return () => clearTimeout(timer.current);
  }, [draft, storageKey]);

  const update = (fn: (d: T) => T) => setDraft((x) => ({ ...x, data: fn(x.data) }));
  const clear = () => {
    clearTimeout(timer.current);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  };
  return { draft, update, clear, savedAt };
}

export function useCountdown(deadline: number, onExpire: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, deadline - now);
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true;
      expire.current();
    }
  }, [left]);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { left, label: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

/**
 * Reports every time the student goes away from the test, and tracks full screen.
 * "Away" = the tab is hidden OR the window lost focus (another window, alt-tab, a window beside this
 * one), so changing window counts, not only changing tab. One trip away counts once, however many events
 * it fires; it counts again only after the student has come back. A 1 s focus check catches trips the
 * browser doesn't announce. Counting/locking happens in the store (the server for real).
 * Best effort: a browser cannot see a second device or a phone.
 */
export function useIntegrity(enabled: boolean, onSwitch: () => void, onFullscreenExit?: () => void) {
  const [fullscreen, setFullscreen] = useState(true);
  const cb = useRef(onSwitch);
  const fsCb = useRef(onFullscreenExit);
  useEffect(() => {
    cb.current = onSwitch;
    fsCb.current = onFullscreenExit;
  });
  useEffect(() => {
    if (!enabled) return;
    const focused = () => document.visibilityState === "visible" && document.hasFocus();
    let away = !focused(); // already away when the test opens: not counted, they must come back first
    const leave = () => {
      if (away) return;
      away = true;
      cb.current();
    };
    const back = () => {
      if (focused()) away = false;
    };
    const check = () => (focused() ? back() : leave());
    let wasFullscreen = Boolean(document.fullscreenElement);
    const onFs = () => {
      const on = Boolean(document.fullscreenElement);
      if (wasFullscreen && !on) fsCb.current?.();
      wasFullscreen = on;
      setFullscreen(on);
    };
    onFs(); // pick up the current state once (same pattern as before)
    document.addEventListener("visibilitychange", check);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    document.addEventListener("fullscreenchange", onFs);
    const poll = setInterval(check, 1000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      document.removeEventListener("fullscreenchange", onFs);
      clearInterval(poll);
    };
  }, [enabled]);
  return { fullscreen, enterFullscreen: () => document.documentElement.requestFullscreen?.().catch(() => {}) };
}

export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

/** Round + this student's result. No result = preview mode (demo only, nothing recorded). */
export function useExamRound(roundId: string) {
  const { state } = useStore();
  const { candidate, drive } = useStudent();
  const round = state.rounds.find((r) => r.id === roundId && r.driveId === candidate?.driveId);
  const result = state.results.find((r) => r.roundId === roundId && r.candidateId === candidate?.id);
  return { state, candidate, drive, round, result, recorded: Boolean(result) };
}

export const minutesSince = (t: number) => Math.max(1, Math.round((Date.now() - t) / 60000));
