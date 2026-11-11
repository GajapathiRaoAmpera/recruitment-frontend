"use client";

import type { ReactNode } from "react";
import { ForbiddenState } from "@/components/ui/states";
import { useStore } from "@/mock/store";

// UI guard only; the API enforces Super Admin on /admin/* (AC-1).
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { state } = useStore();
  return state.session?.role === "SUPER_ADMIN" ? children : <ForbiddenState />;
}
