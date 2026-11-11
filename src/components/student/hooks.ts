"use client";

import { useEffect, useRef, useState } from "react";
import { safeStorage } from "@/lib/storage";
import { DEMO_STUDENT } from "@/mock/data";
import { useStore } from "@/mock/store";

/** Current student; a cold deep link signs in the demo student so every student URL works on its own. */
export function useStudent() {
  const { state, dispatch } = useStore();
  const session = state.session?.role === "STUDENT" ? state.session : null;
  useEffect(() => {
    if (session) return;
    const demo = state.candidates.find((c) => c.studentId === DEMO_STUDENT.studentId)!;
    dispatch({ type: "login", session: { role: "STUDENT", candidateId: demo.id } });
  }, [session, state.candidates, dispatch]);
  const candidate = state.candidates.find((c) => c.id === session?.candidateId);
  const drive = state.drives.find((d) => d.id === candidate?.driveId);
  return { candidate, drive };
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

/** Reports tab switches (page hidden) and tracks full screen. Counting/locking happens in the store (server for real). */
export function useIntegrity(enabled: boolean, onSwitch: () => void) {
  const [fullscreen, setFullscreen] = useState(true);
  const cb = useRef(onSwitch);
  useEffect(() => {
    cb.current = onSwitch;
  });
  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") cb.current();
    };
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    onFs();
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
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
