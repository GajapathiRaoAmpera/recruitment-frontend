"use client";

import { useState } from "react";
import type { StudentSession } from "@/api/entry";
import { RocketLoader } from "@/components/ui/rocket-loader";
import { roundTitle } from "@/mock/data";
import type { Round } from "@/mock/types";
import { AttemptClosedScreen, isClosed } from "./attempt-closed";
import { RealSystemCheck } from "./real-system-check";
import { useFreshRounds } from "./use-entry-rounds";

/**
 * Before the system check: where does this round's attempt stand? The cached status answers at once, then
 * GET /entry/rounds confirms it. A submitted, paused or timed-out round gets its own screen with no camera,
 * location, terms or full-screen steps. A live round runs the full check, on every re-entry, by design.
 */
export function RealRoundGate({ student, roundId }: { student: StudentSession; roundId: string }) {
  const fresh = useFreshRounds(student);
  const [resumed, setResumed] = useState(false); // HR resumed it while the paused screen was open
  const round = fresh.rounds.find((r) => r.roundId === roundId);
  const status = resumed ? "in_progress" : round?.attemptStatus;

  if (round && isClosed(status))
    return (
      <AttemptClosedScreen
        key={status}
        kind={status}
        entryToken={student.entryToken}
        roundId={roundId}
        title={roundTitle[round.type as Round["type"]] ?? round.type}
        onContinue={() => setResumed(true)}
      />
    );
  // A live (or unknown) cached status waits for the server before opening the camera. If the check fails, the
  // cached list stands and POST /entry/start has the final word.
  if (fresh.status === "loading") return <RocketLoader label="Checking your test" />;
  return <RealSystemCheck student={{ ...student, rounds: fresh.rounds }} roundId={roundId} />;
}
