"use client";

import { useState } from "react";
import type { InterviewStart } from "@/api/interviews";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { hire as h } from "@/components/hire/ui";
import s from "./interview.module.scss";
import { NetworkBars } from "./network-bars";
import { useNetworkQuality } from "./use-network-quality";

type Perm = "idle" | "asking" | "ok" | "denied";

/** Before the interview: network check plus microphone and camera permission. */
export function InterviewCheck({ info, onStart }: { info: InterviewStart; onStart: (m: MediaStream) => void }) {
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
