"use client";

import { useStore } from "@/mock/store";
import type { Candidate } from "@/mock/types";

/** Candidates of a drive. The single swap point to the real candidates API once it exists. */
export function useDriveCandidates(driveId: string): Candidate[] {
  const { state } = useStore();
  return state.candidates.filter((c) => c.driveId === driveId);
}
