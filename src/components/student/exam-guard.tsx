"use client";

import { Lock, Maximize } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { MAX_TAB_SWITCHES, useStore } from "@/mock/store";
import type { RoundResult } from "@/mock/types";
import { hire as h } from "@/components/hire/ui";
import { exitFullscreen, useIntegrity } from "./hooks";
import { useLockdown } from "./lockdown";
import { TabSwitchBadge } from "./tab-switch-badge";
import s from "./student.module.scss";

/** Integrity layer for test runners: reports tab switches, shows warnings, the lock screen and the full-screen prompt. */
export function ExamGuard({ roundId, candidateId, result, recorded }: { roundId: string; candidateId: string; result?: RoundResult; recorded: boolean }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const locked = Boolean(result?.locked);
  const used = result?.tabSwitches ?? 0;

  const { fullscreen, enterFullscreen } = useIntegrity(!locked, () => {
    if (!recorded) return toast({ tone: "info", title: "Tab switch detected", description: "Preview mode — not counted." });
    dispatch({ type: "tabSwitch", roundId, candidateId, kind: "tab_switch" });
    const n = used + 1;
    if (n < MAX_TAB_SWITCHES) toast({ tone: "danger", title: `Warning ${n} of ${MAX_TAB_SWITCHES - 1}`, description: `Leaving the test tab ${MAX_TAB_SWITCHES} times closes the test.` });
  });

  useLockdown(!locked);
  const hud = (
    <div className={s.switchHud}>
      <TabSwitchBadge count={used} max={MAX_TAB_SWITCHES} />
    </div>
  );

  if (locked)
    return (
      <>
        {hud}
      <div className={s.overlay} role="alertdialog" aria-labelledby="lock-h" aria-describedby="lock-d">
        <div className={s.overlayCard}>
          <Lock aria-hidden size={32} />
          <h1 id="lock-h" className={h.cardTitle}>
            Your test is paused
          </h1>
          <p id="lock-d" className={h.muted}>
            You left the test tab {MAX_TAB_SWITCHES} times, so it closed. Your answers are saved. HR has been alerted and can let you resume with the time you had left.
          </p>
          <Button asChild variant="secondary" onClick={exitFullscreen}>
            <Link href="/student">Back to dashboard</Link>
          </Button>
        </div>
      </div>
      </>
    );

  if (!fullscreen)
    return (
      <>
      {hud}
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
      </>
    );

  return hud;
}
