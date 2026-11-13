"use client";

import { MockInterviews } from "@/features/interview/mock-interviews";
import { RealInterviews } from "@/features/interview/real-interviews";
import { supabase } from "@/lib/supabase";

export default function InterviewsPage() {
  return supabase ? <RealInterviews /> : <MockInterviews />;
}
