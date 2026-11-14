"use client";

import { listCandidates } from "@/api/hiring";
import { useAsync } from "@/features/papers/use-async";
import { liveApi } from "@/lib/auth";
import { useStore } from "@/mock/store";
import type { Candidate } from "@/mock/types";

/**
 * Candidates of a drive: the shortlisted ones from the API when signed in, the demo store otherwise.
 * Their real ids are what a sent paper is keyed on, so a student's test can find it.
 */
export function useDriveCandidates(driveId: string): Candidate[] {
  const { state } = useStore();
  const real = useAsync(async () => (liveApi ? await listCandidates(driveId, { shortlisted: true }) : []), [driveId]);
  if (!liveApi) return state.candidates.filter((c) => c.driveId === driveId);
  return (real.data ?? []).map((c) => ({
    id: c.id,
    driveId,
    studentId: c.studentId,
    dob: "",
    name: c.fullName,
    email: c.email,
    branch: "",
    cgpa: c.cgpa ?? 0,
    skills: c.skills,
    jdMatch: c.jdMatch ?? 0,
    parseStatus: c.parseStatus === "ok" ? "ok" : "failed",
    shortlisted: c.shortlisted,
  }));
}
