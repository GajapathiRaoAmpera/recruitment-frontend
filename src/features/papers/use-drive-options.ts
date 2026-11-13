"use client";

import { listDrives } from "@/api/hiring";
import { useAsync } from "@/features/papers/use-async";
import type { DriveOption } from "@/features/papers/components/setup-step";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/mock/store";

/** Drives to build a paper for: the real ones when signed in (a paper is keyed on the real drive id), demo ones otherwise. */
export function useDriveOptions(): DriveOption[] {
  const { state } = useStore();
  const real = useAsync(async () => (supabase ? await listDrives() : []), []);
  if (!supabase) return state.drives.map((d) => ({ id: d.id, label: `${d.roleTitle} — ${d.campus}`, role: d.roleTitle }));
  return (real.data ?? []).map((d) => ({ id: d.id, label: `${d.roleTitle} — ${d.campus}`, role: d.roleTitle }));
}
