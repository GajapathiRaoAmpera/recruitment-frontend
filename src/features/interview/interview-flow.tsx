"use client";

import dynamic from "next/dynamic";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { InterviewStart } from "@/api/interviews";
import { Logo } from "@/components/brand/logo";
import { hire as h } from "@/components/hire/ui";
import { InterviewCheck } from "./interview-check";
import s from "./interview.module.scss";
import { InterviewLogin } from "./interview-login";

// Client-only: the room pulls in three.js and the Gemini SDK, which only this page needs.
const InterviewRoom = dynamic(() => import("./interview-room").then((m) => m.InterviewRoom), { ssr: false });

type Step = { name: "login" } | { name: "check"; info: InterviewStart } | { name: "live"; info: InterviewStart; media: MediaStream } | { name: "done" };

/** The student's AI interview: sign in -> network + mic/camera check -> live room -> thank-you. */
export function InterviewFlow() {
  const [step, setStep] = useState<Step>({ name: "login" });
  return step.name === "login" ? (
    <InterviewLogin onNext={(info) => setStep({ name: "check", info })} />
  ) : step.name === "check" ? (
    <InterviewCheck info={step.info} onStart={(media) => setStep({ name: "live", info: step.info, media })} />
  ) : step.name === "live" ? (
    <InterviewRoom token={step.info.interviewToken} roleTitle={step.info.roleTitle} media={step.media} onDone={() => setStep({ name: "done" })} />
  ) : (
    <div className={s.center}>
      <Logo height={24} />
      <div className={`${h.card} ${s.notice}`}>
        <CheckCircle2 aria-hidden size={40} className={s.noticeIcon} />
        <h1 className={s.checkTitle}>Thank you</h1>
        <p className={s.stateText}>Your interview is complete and saved. HR will be in touch with next steps. You can close this tab.</p>
      </div>
    </div>
  );
}
