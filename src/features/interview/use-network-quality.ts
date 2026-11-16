"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ping } from "@/api/interviews";

// Network check, before and during the interview. Times tiny requests to our API: median round trip + jitter.
// It measures delay to OUR server, not bandwidth or the path to Google, so it catches "no network" and
// "very slow Wi-Fi" and nothing subtler (docs/09).

export const GOOD_MEDIAN_MS = 300;
export const GOOD_JITTER_MS = 100;
export const CHECK_SAMPLES = 5;
export const WATCH_EVERY_MS = 10_000;

export type Verdict = "good" | "weak" | "offline" | "checking";

export interface Quality {
  verdict: Verdict;
  medianMs: number | null;
  jitterMs: number | null;
}

/** `samples`: round trips in ms, or null for a failed request. */
export function judge(samples: (number | null)[], online = true): Quality {
  if (!online) return { verdict: "offline", medianMs: null, jitterMs: null };
  const ok = samples.filter((s): s is number => s !== null);
  if (!ok.length) return { verdict: samples.length ? "offline" : "checking", medianMs: null, jitterMs: null };
  const sorted = [...ok].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  // jitter: mean change between consecutive round trips
  let jitter = 0;
  for (let i = 1; i < ok.length; i++) jitter += Math.abs(ok[i]! - ok[i - 1]!);
  jitter = ok.length > 1 ? jitter / (ok.length - 1) : 0;
  const failed = ok.length < samples.length;
  const verdict = !failed && median < GOOD_MEDIAN_MS && jitter < GOOD_JITTER_MS ? "good" : "weak";
  return { verdict, medianMs: Math.round(median), jitterMs: Math.round(jitter) };
}

export const verdictLabel: Record<Verdict, string> = { good: "Good", weak: "Weak", offline: "Offline", checking: "Checking" };

async function sample(): Promise<number | null> {
  try {
    return await ping();
  } catch {
    return null;
  }
}

/**
 * mode "check": CHECK_SAMPLES requests now, again on `recheck()`.
 * mode "watch": one request every WATCH_EVERY_MS, judged over the last CHECK_SAMPLES.
 * Browser offline/online events override at once.
 */
export function useNetworkQuality(mode: "check" | "watch", enabled = true) {
  const [quality, setQuality] = useState<Quality>({ verdict: "checking", medianMs: null, jitterMs: null });
  const window_ = useRef<(number | null)[]>([]);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    const online = () => (typeof navigator === "undefined" ? true : navigator.onLine);
    const update = () => !stale && setQuality(judge(window_.current, online()));
    const onOffline = () => !stale && setQuality({ verdict: "offline", medianMs: null, jitterMs: null });
    const onOnline = () => {
      window_.current = [];
      if (!stale) setQuality((q) => ({ ...q, verdict: "checking" }));
      void sample().then((s) => {
        window_.current = [s];
        update();
      });
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    let timer: ReturnType<typeof setInterval> | undefined;
    if (mode === "check") {
      window_.current = [];
      setQuality({ verdict: "checking", medianMs: null, jitterMs: null }); // eslint-disable-line react-hooks/set-state-in-effect -- reset before a fresh check
      void (async () => {
        for (let i = 0; i < CHECK_SAMPLES && !stale; i++) window_.current.push(await sample());
        update();
      })();
    } else {
      const tick = async () => {
        if (document.visibilityState === "hidden") return;
        window_.current = [...window_.current, await sample()].slice(-CHECK_SAMPLES);
        update();
      };
      void tick();
      timer = setInterval(() => void tick(), WATCH_EVERY_MS);
    }
    return () => {
      stale = true;
      clearInterval(timer);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [mode, enabled, run]);

  const recheck = useCallback(() => setRun((n) => n + 1), []);
  return { ...quality, recheck };
}
