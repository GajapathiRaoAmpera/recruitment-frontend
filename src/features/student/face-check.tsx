"use client";

import { Camera, CameraOff, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import s from "@/components/student/student.module.scss";
import { countFaces } from "@/lib/face-detect";

type Phase = "starting" | "live" | "denied" | "nocamera" | "checking" | "captured" | "failed";

export const FACE_MESSAGES = {
  none: "No face detected. Please position your face properly.",
  many: "Multiple people detected. Only one person is allowed in the snapshot.",
  partial: "Your whole face must be inside the frame, with forehead and chin visible. Please move back and retake.",
  angled: "Please look straight at the camera and retake the photo.",
} as const;

/**
 * Step 1: webcam snapshot. Exactly one face must be in the photo before "Verify & Continue" is enabled.
 * This counts faces only; it does not match the face to anyone. The photo stays in this tab's memory:
 * shortcut: there is no endpoint to store it yet (see the API contract), so nothing is uploaded.
 */
export function FaceCheck({ onVerified }: { onVerified: (photo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [message, setMessage] = useState<string>();
  const [shot, setShot] = useState<string>();
  const [okFace, setOkFace] = useState(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const start = useCallback(async () => {
    setPhase("starting");
    setMessage(undefined);
    setShot(undefined);
    setOkFace(false);
    if (!navigator.mediaDevices?.getUserMedia) return setPhase("nocamera");
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      stream.current = st;
      setPhase("live");
    } catch (e) {
      const name = (e as DOMException).name;
      setPhase(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "nocamera");
    }
  }, []);

  useEffect(() => {
    void start(); // eslint-disable-line react-hooks/set-state-in-effect -- open the camera once on mount
    return stop;
  }, [start, stop]);

  // Attach the stream once the <video> exists.
  useEffect(() => {
    if (phase === "live" && video.current && stream.current) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => {});
    }
  }, [phase]);

  const capture = async () => {
    const v = video.current;
    const c = canvas.current;
    if (!v || !c || !v.videoWidth) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    setShot(c.toDataURL("image/jpeg", 0.85));
    setPhase("checking");
    setMessage(undefined);
    try {
      const { count: n, problem } = await countFaces(c);
      if (n === 1 && problem) {
        setMessage(FACE_MESSAGES[problem]);
        setPhase("captured");
      } else if (n === 1) {
        setOkFace(true);
        setPhase("captured");
      } else {
        setMessage(n === 0 ? FACE_MESSAGES.none : FACE_MESSAGES.many);
        setPhase("captured");
      }
    } catch {
      setMessage("Face check couldn't run. Check your connection, then retake the photo.");
      setPhase("failed");
    }
  };

  const retake = () => {
    setShot(undefined);
    setOkFace(false);
    setMessage(undefined);
    setPhase("live");
  };

  const verify = () => {
    stop(); // camera light goes off as soon as the photo is accepted
    onVerified(shot!);
  };

  if (phase === "denied" || phase === "nocamera")
    return (
      <>
        <CameraHeader on={false} />
        <div role="alert" className={s.camBlocked}>
          <CameraOff aria-hidden size={28} />
          {phase === "denied" ? (
            <>
              <p className={s.camBlockedTitle}>Camera access was blocked, so we can&apos;t take your photo.</p>
              <p>Click the camera or lock icon in the address bar, set Camera to Allow, then try again.</p>
            </>
          ) : (
            <p className={s.camBlockedTitle}>No camera was found, or it is in use by another app.</p>
          )}
          <Button size="sm" variant="secondary" onClick={() => void start()}>
            Try again
          </Button>
        </div>
      </>
    );

  const showShot = shot && (phase === "checking" || phase === "captured" || phase === "failed");
  return (
    <>
      <CameraHeader on={phase !== "starting"} />
      <p className={s.camIntro}>Used only to check that one person is taking the test. Allow the camera, face it clearly, and make sure nobody else is in view.</p>
      <div className={s.camStage}>
        {showShot ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data: URL
          <img src={shot} alt="Your captured photo" className={s.camMedia} />
        ) : (
          <>
            <video ref={video} muted playsInline aria-label="Live camera preview" className={s.camMedia} />
            <div className={s.camOval} aria-hidden="true" data-testid="face-oval" />
          </>
        )}
      </div>
      <canvas ref={canvas} hidden />
      <div className={s.camFooter}>
        {!showShot && <p className={s.camHint}>Keep your face inside the oval</p>}
        <p className={s.camStatus} role={message ? "alert" : "status"} style={{ color: message ? "var(--ui-color-danger)" : okFace ? "var(--ui-color-success)" : undefined }}>
          {phase === "starting" ? "Waiting for camera permission…" : phase === "checking" ? "Checking the photo…" : okFace ? "One face detected." : (message ?? "")}
        </p>
        <div className={s.camActions}>
          {phase === "live" || phase === "starting" ? (
            <Button size="sm" onClick={() => void capture()} disabled={phase !== "live"}>
              <Camera aria-hidden size={14} style={{ marginRight: 4 }} /> Capture photo
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={retake} disabled={phase === "checking"}>
                <RefreshCw aria-hidden size={14} style={{ marginRight: 4 }} /> Retake photo
              </Button>
              <Button size="sm" onClick={verify} disabled={!okFace}>
                <ShieldCheck aria-hidden size={14} style={{ marginRight: 4 }} /> Verify &amp; continue
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Camera panel header: title + on/off pill. The parent <section> uses id "cam-h" as its label. */
export function CameraHeader({ on }: { on: boolean }) {
  return (
    <div className={s.camHead}>
      <h2 id="cam-h" className={s.camTitle}>
        Identity photo
      </h2>
      <Badge tone={on ? "success" : "neutral"} className={s.camPill}>
        {on ? "Camera on" : "Camera off"}
      </Badge>
    </div>
  );
}
