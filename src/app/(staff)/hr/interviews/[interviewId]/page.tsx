"use client";

import { useParams } from "next/navigation";
import { MockInterviewConsole } from "@/features/interview/mock-interviews";
import { RealInterviewDetail } from "@/features/interview/real-interviews";
import { supabase } from "@/lib/supabase";

export default function InterviewConsolePage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  return supabase ? <RealInterviewDetail id={interviewId} /> : <MockInterviewConsole interviewId={interviewId} />;
}
