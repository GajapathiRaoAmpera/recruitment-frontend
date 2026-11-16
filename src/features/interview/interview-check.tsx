"use client";

import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { InterviewStart } from "@/api/interviews";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { hire as h } from "@/components/hire/ui";
import s from "./interview.module.scss";
import { NetworkBars } from "./network-bars";
import { useNetworkQuality } from "./use-network-quality";

type Perm = "idle" | "asking" | "ok" | "denied";
type Status = "ok" | "warn" | "todo";

const icons = { ok: CheckCircle2, warn: AlertCircle, todo: Circle };

function Row({ status, title, detail, action, children }: { status: Status; title: string; detail: ReactNode; action?: ReactNode; children?: ReactNode }) {
  const Icon = icons[status];
  return (
    <li className={s.checkRow}>
      <Icon aria-hidden size={20} className={s.checkIcon} data-s={status} />
      <div className={s.checkBody}>
        <strong>{title}</strong>
        <span className={s.stateText}>{detail}</span>
        {children}
      </div>
      {action}
    </li>
  );
}

/** Before the interview: network check plus microphone and camera permission. */
export function InterviewCheck({ info, onStart }: { info: InterviewStart; onStart: (m: MediaStream) => void }) {
  const net = useNetworkQuality("check");
  const [perm, setPerm] = useState<Perm>("idle");
  const [media, setMedia] = useState<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (video.current && media) video.current.srcObject = media;
  }, [media]);

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

  const netReady = net.verdict !== "offline" && net.verdict !== "checking";
  const canStart = perm === "ok" && media !== null && netReady;
  const blocker =
    net.verdict === "checking" ? "Checking your network…" : net.verdict === "offline" ? "Connect to the internet to start." : perm !== "ok" ? "Allow microphone and camera to start." : null;

  return (
    <div className={s.center}>
      <Logo height={24} />
      <div>
        <h1 className={s.checkTitle}>
          {info.roleTitle} interview{info.company ? ` — ${info.company}` : ""}
        </h1>
        <p className={s.stateText}>
          Hello {info.candidateName}. Check your setup below, then start when you&apos;re ready.
        </p>
      </div>

      <ul className={s.facts}>
        <li>A voice conversation with an AI interviewer, about {info.durationMin} minutes.</li>
        <li>HR can watch your camera live. Nothing is recorded.</li>
      </ul>

      <ol className={`${h.card} ${s.checklist}`} aria-label="Setup check">
        <Row
          status={net.verdict === "good" ? "ok" : net.verdict === "checking" ? "todo" : "warn"}
          title="Network"
          detail={<NetworkBars verdict={net.verdict} />}
          action={
            net.verdict !== "good" && (
              <Button variant="tertiary" size="sm" onClick={net.recheck} disabled={net.verdict === "checking"}>
                Re-check
              </Button>
            )
          }
        >
          {net.verdict === "weak" && <span className={s.stateText}>Your connection is slow. Move closer to the router if you can. You can still start.</span>}
          {net.verdict === "offline" && <span role="alert">You are offline. Connect to the internet to start.</span>}
        </Row>

        <Row
          status={perm === "ok" ? "ok" : perm === "denied" ? "warn" : "todo"}
          title="Microphone and camera"
          detail={perm === "ok" ? "Ready. This is how HR will see you." : perm === "denied" ? "Access was blocked." : "Your browser will ask for permission."}
          action={
            perm !== "ok" && (
              <Button size="sm" variant={perm === "denied" ? "secondary" : "primary"} onClick={() => void ask()} loading={perm === "asking"}>
                {perm === "denied" ? "Try again" : "Allow access"}
              </Button>
            )
          }
        >
          {perm === "denied" && <span role="alert">Click the camera icon in your browser&apos;s address bar, allow access, then select Try again.</span>}
          {perm === "ok" && <video ref={video} className={s.cam} autoPlay muted playsInline aria-label="Your camera preview" />}
        </Row>
      </ol>

      <Button disabled={!canStart} onClick={() => media && onStart(media)} aria-describedby={blocker ? "start-hint" : undefined}>
        Start interview
      </Button>
      {blocker && (
        <p id="start-hint" className={s.startHint}>
          {blocker}
        </p>
      )}
    </div>
  );
}
