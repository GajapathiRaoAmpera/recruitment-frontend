"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ApiError } from "@/api/client";
import { type InterviewStart, interviewStart } from "@/api/interviews";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { hire as h } from "@/components/hire/ui";
import s from "@/features/interview/interview.module.scss";
import { NetworkBars } from "@/features/interview/network-bars";
import { useNetworkQuality } from "@/features/interview/use-network-quality";

// Client-only: the room pulls in three.js and the Gemini SDK, which only this page needs.
const InterviewRoom = dynamic(() => import("@/features/interview/interview-room").then((m) => m.InterviewRoom), { ssr: false });

type Step = { name: "login" } | { name: "check"; info: InterviewStart } | { name: "live"; info: InterviewStart; media: MediaStream } | { name: "done" };

export default function InterviewPage() {
  const [step, setStep] = useState<Step>({ name: "login" });
  return step.name === "login" ? (
    <Login onNext={(info) => setStep({ name: "check", info })} />
  ) : step.name === "check" ? (
    <Check info={step.info} onStart={(media) => setStep({ name: "live", info: step.info, media })} />
  ) : step.name === "live" ? (
    <InterviewRoom token={step.info.interviewToken} roleTitle={step.info.roleTitle} media={step.media} onDone={() => setStep({ name: "done" })} />
  ) : (
    <div className={s.center}>
      <Logo height={24} />
      <h1>Thank you</h1>
      <p>Your interview is complete and saved. HR will be in touch with next steps. You can close this tab.</p>
    </div>
  );
}

function Login({ onNext }: { onNext: (i: InterviewStart) => void }) {
  const [id, setId] = useState("");
  const [dob, setDob] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const info = await interviewStart(id, dob);
      if (info.status === "completed") setErr("You have already completed this interview.");
      else onNext(info);
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className={s.center} onSubmit={submit}>
      <Logo height={24} />
      <h1>AI interview</h1>
      <Field label="Student ID" required>
        <Input value={id} onChange={(e) => setId(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Date of birth" required>
        <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </Field>
      {err && <p role="alert">{err}</p>}
      <Button type="submit" disabled={busy || !id.trim() || !dob}>
        {busy ? "Checking…" : "Continue"}
      </Button>
    </form>
  );
}

type Perm = "idle" | "asking" | "ok" | "denied";

function Check({ info, onStart }: { info: InterviewStart; onStart: (m: MediaStream) => void }) {
  const net = useNetworkQuality("check");
  const [perm, setPerm] = useState<Perm>("idle");
  const [media, setMedia] = useState<MediaStream | null>(null);

  const ask = async () => {
    setPerm("asking");
    try {
      const m = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: { width: 640, height: 480, facingMode: "user" },
      });
      setMedia(m);
      setPerm("ok");
    } catch {
      setPerm("denied");
    }
  };
  const canStart = perm === "ok" && media !== null && net.verdict !== "offline" && net.verdict !== "checking";
  return (
    <div className={s.center}>
      <Logo height={24} />
      <h1>
        {info.roleTitle} interview{info.company ? ` — ${info.company}` : ""}
      </h1>
      <p>
        Hello {info.candidateName}. You will talk with an AI interviewer by voice for about {info.durationMin} minutes. Your camera is viewed live by HR and is not recorded.
      </p>
      <div className={h.card}>
        <p>
          <strong>Network:</strong> <NetworkBars verdict={net.verdict} />{" "}
          <Button variant="secondary" onClick={net.recheck}>
            Re-check
          </Button>
        </p>
        {net.verdict === "weak" && <p>Your connection is slow. Move closer to the router or switch network if you can. You can still start.</p>}
        {net.verdict === "offline" && <p role="alert">You are offline. Connect to the internet to start.</p>}
      </div>
      <div className={h.card}>
        <p>
          <strong>Microphone and camera:</strong> {perm === "ok" ? "Ready" : perm === "denied" ? "Blocked" : "Not checked"}
        </p>
        {perm === "denied" && <p role="alert">Allow microphone and camera access in your browser&apos;s address bar, then try again.</p>}
        {perm !== "ok" && (
          <Button onClick={() => void ask()} disabled={perm === "asking"}>
            Allow microphone and camera
          </Button>
        )}
      </div>
      <Button disabled={!canStart} onClick={() => media && onStart(media)}>
        Start interview
      </Button>
    </div>
  );
}
