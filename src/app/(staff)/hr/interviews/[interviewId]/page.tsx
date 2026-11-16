"use client";

import { useParams } from "next/navigation";
import { MockInterviewConsole } from "@/features/interview/mock-interviews";
import { RealInterviewDetail } from "@/features/interview/real-interviews";
import { liveApi } from "@/lib/auth";

export default function InterviewConsolePage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  return liveApi ? <RealInterviewDetail id={interviewId} /> : <MockInterviewConsole interviewId={interviewId} />;
}
