"use client";

import { useParams } from "next/navigation";
import { useExamRound } from "@/components/student/hooks";
import { ThankYouScreen } from "./thank-you-screen";

/** Prototype round end: the same thank-you page as the real flow, with no marks or test-case counts (AC-7). */
export function DoneScreen() {
  const { roundId } = useParams<{ roundId: string }>();
  const { round, candidate, recorded } = useExamRound(roundId);
  return <ThankYouScreen name={candidate?.name} roundType={round?.type} roundTitle={round?.title} recorded={recorded} />;
}
