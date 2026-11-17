"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { InterviewStart } from "@/api/interviews";
import { ThankYouScreen } from "@/features/student/thank-you-screen";
import { InterviewCheck } from "./interview-check";
import { InterviewLogin } from "./interview-login";

// Client-only: the room pulls in three.js and the Gemini SDK, which only this page needs.
const InterviewRoom = dynamic(() => import("./interview-room").then((m) => m.InterviewRoom), { ssr: false });

type Step = { name: "login" } | { name: "check"; info: InterviewStart } | { name: "live"; info: InterviewStart; media: MediaStream } | { name: "done"; info: InterviewStart };

/** The student's AI interview: sign in -> network + mic/camera check -> live room -> thank-you. */
export function InterviewFlow() {
  const [step, setStep] = useState<Step>({ name: "login" });
  return step.name === "login" ? (
    <InterviewLogin onNext={(info) => setStep({ name: "check", info })} />
  ) : step.name === "check" ? (
    <InterviewCheck info={step.info} onStart={(media) => setStep({ name: "live", info: step.info, media })} />
  ) : step.name === "live" ? (
    <InterviewRoom token={step.info.interviewToken} roleTitle={step.info.roleTitle} media={step.media} onDone={() => setStep({ name: "done", info: step.info })} />
  ) : (
    // The interview has its own sign-in, not the student portal, so there's no dashboard to go back to.
    <ThankYouScreen name={step.info.candidateName} roundType="ai_interview" roundTitle={`${step.info.roleTitle} interview`} dashboard={false} />
  );
}
