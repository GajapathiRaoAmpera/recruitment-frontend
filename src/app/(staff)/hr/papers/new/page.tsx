"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { useBreadcrumbs } from "@/components/shell/breadcrumbs";
import { PageHeader } from "@/components/shell/page-header";
import { SetupStep } from "@/features/papers/components/setup-step";
import { Stepper } from "@/features/papers/components/stepper";
import { useDriveOptions } from "@/features/papers/use-drive-options";

export default function NewPaperPage({ searchParams }: { searchParams: Promise<{ drive?: string }> }) {
  const { drive } = use(searchParams);
  useBreadcrumbs([{ label: "Paper builder", href: "/hr/papers" }, { label: "New paper" }]);
  const router = useRouter();
  const drives = useDriveOptions();

  return (
    <>
      <PageHeader title="New Round 1 paper" description="AI writes the questions, a second AI checks every answer, and you review before anything is sent." />
      <Stepper current={0} />
      <SetupStep key={drives.length} drives={drives} initialDrive={drive} onCreated={(d) => router.push(`/hr/papers/${encodeURIComponent(d.id)}`)} />
    </>
  );
}
