"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getEntryRounds, type EntryRound, type StudentSession } from "@/api/entry";
import { useOptionalStore } from "@/mock/store";

/** How often a paused screen asks whether HR resumed the test. */
export const RESUME_POLL_MS = 10_000;

/** Saves a fresh round list into the signed-in student's cached session, so the dashboard and the exam agree. */
function useSaveRounds() {
  const store = useOptionalStore();
  const session = store?.state.session;
  const dispatch = store?.dispatch;
  const save = useCallback(
    (rounds: EntryRound[]) => {
      if (dispatch && session?.student) dispatch({ type: "login", session: { ...session, student: { ...session.student, rounds } } });
    },
    [dispatch, session],
  );
  // A ref, so saving (which changes the session) never re-runs the callers' fetch effects.
  const ref = useRef(save);
  useEffect(() => {
    ref.current = save;
  });
  return ref;
}

export type FreshRounds = { status: "loading" | "ready" | "error"; rounds: EntryRound[]; error?: Error; retry: () => void };

/**
 * GET /entry/rounds once on mount (and on retry). Until it answers, and if it fails, `rounds` is the cached list
 * from sign-in, so callers can fall back to it.
 */
export function useFreshRounds(student: StudentSession): FreshRounds {
  const [state, setState] = useState<Omit<FreshRounds, "retry">>({ status: "loading", rounds: student.rounds });
  const [tick, setTick] = useState(0);
  const save = useSaveRounds();
  useEffect(() => {
    let stale = false;
    getEntryRounds(student.entryToken).then(
      (rounds) => {
        if (stale) return;
        setState({ status: "ready", rounds });
        save.current(rounds);
      },
      (error: Error) => {
        if (!stale) setState((s) => ({ status: "error", rounds: s.rounds, error }));
      },
    );
    return () => {
      stale = true;
    };
  }, [student.entryToken, tick, save]);
  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: "loading", error: undefined }));
    setTick((t) => t + 1);
  }, []);
  return { ...state, retry };
}

/** While `on`: asks the server every 10 s whether HR resumed this round. True once it is `in_progress` again. */
export function useResumeWatch(entryToken: string, roundId: string, on: boolean): boolean {
  const [resumed, setResumed] = useState(false);
  const save = useSaveRounds();
  useEffect(() => {
    if (!on || resumed) return;
    let stale = false;
    const id = window.setInterval(() => {
      getEntryRounds(entryToken).then(
        (rounds) => {
          if (stale || rounds.find((r) => r.roundId === roundId)?.attemptStatus !== "in_progress") return;
          setResumed(true);
          save.current(rounds);
        },
        () => {}, // a failed check just waits for the next one
      );
    }, RESUME_POLL_MS);
    return () => {
      stale = true;
      window.clearInterval(id);
    };
  }, [entryToken, roundId, on, resumed, save]);
  return resumed;
}
