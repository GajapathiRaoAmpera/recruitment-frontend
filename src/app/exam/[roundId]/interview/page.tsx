"use client";

import { redirect } from "next/navigation";
import { ScriptedInterview } from "@/features/interview/scripted-interview";
import { supabase } from "@/lib/supabase";

// Real mode: the AI interview has its own sign-in at /interview. Prototype mode keeps the scripted demo.
export default function InterviewPage() {
  if (supabase) redirect("/interview");
  return <ScriptedInterview />;
}
