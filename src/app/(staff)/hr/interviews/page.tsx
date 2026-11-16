"use client";

import { MockInterviews } from "@/features/interview/mock-interviews";
import { RealInterviews } from "@/features/interview/real-interviews";
import { liveApi } from "@/lib/auth";

export default function InterviewsPage() {
  return liveApi ? <RealInterviews /> : <MockInterviews />;
}
