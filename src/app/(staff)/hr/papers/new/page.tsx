"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { SetupStep } from "@/features/papers/components/setup-step";
import { Stepper } from "@/features/papers/components/stepper";
import { useStore } from "@/mock/store";

export default function NewPaperPage({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  const { drive } = use(searchParams);
  useBreadcrumbs([{ label: "Paper builder", href: "/hr/papers" }, { label: "New paper" }]);
  const router = useRouter();
  // shortcut: drives still come from the mock store; swap when the drives API lands.
  const { state } = useStore();
  const drives = state.drives.map((d) => ({ id: d.id, label: `${d.roleTitle} — ${d.campus}` }));

  return (
    <>
      <PageHeader title="New Round 1 paper" description="AI writes the questions, a second AI checks every answer, and you review before anything is sent." />
      <Stepper current={0} />
      <SetupStep drives={drives} initialDrive={drive} onCreated={(d) => router.push(`/hr/papers/${encodeURIComponent(d.id)}`)} />
    </>
  );
}
