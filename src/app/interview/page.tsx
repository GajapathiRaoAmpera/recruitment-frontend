"use client";

import { DesktopOnly } from "@/components/ui/desktop-only";
import { InterviewFlow } from "@/features/interview/interview-flow";

export default function InterviewPage() {
  return (
    <DesktopOnly>
      <InterviewFlow />
    </DesktopOnly>
  );
}
