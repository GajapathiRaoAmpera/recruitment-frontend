"use client";

import { type DependencyList, useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";

export interface AsyncState<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
  reload: () => void;
}

const sameDeps = (a: DependencyList, b: DependencyList) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/** Runs `fn` on mount and whenever `deps` change or `reload()` is called; responses from superseded calls are ignored. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: ApiError; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const [seenDeps, setSeenDeps] = useState(deps);
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  // Deps changed: show loading right away (adjusting state during render, not in an effect).
  if (!sameDeps(seenDeps, deps)) {
    setSeenDeps(deps);
    setState((s) => ({ ...s, loading: true }));
  }

  useEffect(() => {
    let stale = false;
    fnRef.current().then(
      (data) => {
        if (!stale) setState({ data, loading: false });
      },
      (e: unknown) => {
        if (stale) return;
        const error = e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", e instanceof Error ? e.message : "Something went wrong. Try again.");
        setState((s) => ({ data: s.data, error, loading: false }));
      },
    );
    return () => {
      stale = true; // a superseded call (deps changed, reload, unmount) must not write state
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    setTick((t) => t + 1);
  }, []);
  return { ...state, reload };
}
