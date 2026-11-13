"use client";

import { useState } from "react";
import { listRounds } from "@/api/hiring";
import { hire as h } from "@/components/hire/ui";
import { ErrorState } from "@/components/ui/states";
import { CodingSetup } from "@/features/coding-questions/coding-setup";
import { CodingResults } from "@/features/coding-results/coding-results";
import { RealRoundProgress } from "@/features/hiring/real-round-progress";
import { useAsync } from "@/features/papers/use-async";
import { AdvancePanel } from "./advance-panel";

const TEST_ROUNDS = new Set(["aptitude", "coding", "technical"]);

/**
 * The real-mode HR round page: live progress (RealRoundProgress), the coding test setup (coding rounds), the cut-off &
 * advance panel (test rounds), then the coding results (coding rounds). Advancing remounts the progress view so it shows the new round status.
 */
export function RealRoundPage({ driveId, roundId }: { driveId: string; roundId: string }) {
  const [version, setVersion] = useState(0);
  const rounds = useAsync(() => listRounds(driveId), [driveId]);
  const round = rounds.data?.find((r) => r.id === roundId);
  return (
    <div className={h.stack}>
      <RealRoundProgress key={version} driveId={driveId} roundId={roundId} />
      {/* A missing round is already reported by the progress view above. */}
      {rounds.error && !rounds.data && <ErrorState message={`Couldn't load the round type: ${rounds.error.message}`} onRetry={rounds.reload} />}
      {round?.type === "coding" && <CodingSetup roundId={roundId} />}
      {round && TEST_ROUNDS.has(round.type) && <AdvancePanel roundId={roundId} onAdvanced={() => setVersion((v) => v + 1)} />}
      {round?.type === "coding" && <CodingResults roundId={roundId} />}
    </div>
  );
}
