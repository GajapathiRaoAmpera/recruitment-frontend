"use client";

import { useEffect, useRef, useState } from "react";
import { type CharacterState, hasWebGL, stateLabel } from "./character-state";
import s from "./interview.module.scss";

type Head = import("@met4citizen/talkinghead").TalkingHead;

// Static files in public/interview/: the CC0 MakeHuman (MPFB) avatar from the TalkingHead repo (textures
// re-encoded to JPEG), and HeadAudio's worklet + lip-sync model copied from @met4citizen/headaudio/dist.
// Upgrading @met4citizen/headaudio means copying those two files again.
const AVATAR_URL = "/interview/avatar.glb";
const WORKLET_URL = "/interview/headworklet.min.mjs";
const LIPSYNC_MODEL_URL = "/interview/model-en-mixed.bin";
const GESTURES = ["index", "handup", "side"] as const; // open-hand moves an interviewer makes while explaining
const HANDS_EVERY_MS = 2500;

interface Props {
  state: CharacterState;
  /** 0..1 every frame (AI voice while speaking, mic while listening). Only the no-WebGL fallback uses it. */
  getLevel: () => number;
  /** The AI voice playback node; its audio drives the lips. Null until the audio engine exists. */
  voice?: AudioNode | null;
}

/** The interviewer as a 3D human (TalkingHead): blinks, breathes, keeps eye contact, moves its head and hands,
 * and lip-syncs to the AI's voice. Without WebGL, or if the avatar fails to load, a flat SVG face shows the same states. */
export function InterviewerCharacter({ state, getLevel, voice = null }: Props) {
  const box = useRef<HTMLDivElement>(null);
  // The avatar is mutated every frame (lip sync), so it lives in a ref; `ready` re-runs the effects below.
  const headRef = useRef<Head | null>(null);
  const [ready, setReady] = useState(false);
  const [flat, setFlat] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Load the avatar once.
  useEffect(() => {
    if (!hasWebGL()) {
      setFlat(true); // eslint-disable-line react-hooks/set-state-in-effect -- feature check after mount
      return;
    }
    const lessMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduced(lessMotion);
    let dead = false;
    let h: Head | undefined;
    const onVis = () => (document.hidden ? h?.stop() : h?.start());
    (async () => {
      const { TalkingHead } = await import("@met4citizen/talkinghead");
      if (dead || !box.current) return;
      h = new TalkingHead(box.current, {
        cameraView: "upper",
        cameraRotateEnable: false,
        lipsyncModules: [], // lips follow the audio (HeadAudio), not text; its language modules can't be bundled anyway
        modelPixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        modelFPS: 30,
        modelMovementFactor: lessMotion ? 0.2 : 1,
        avatarSpeakingEyeContact: 0.8,
        avatarIdleEyeContact: 0.6,
      });
      await h.showAvatar({ url: AVATAR_URL, body: "F", avatarMood: "neutral", lipsyncLang: "en" });
      if (dead) return h.dispose();
      document.addEventListener("visibilitychange", onVis);
      headRef.current = h;
      setReady(true);
    })().catch(() => !dead && setFlat(true));
    return () => {
      dead = true;
      document.removeEventListener("visibilitychange", onVis);
      headRef.current = null;
      h?.dispose();
    };
  }, []);

  // Lip sync: HeadAudio listens to the AI voice and sets the mouth (viseme) shapes every frame.
  useEffect(() => {
    const head = headRef.current;
    if (!ready || !head || !voice) return;
    let dead = false;
    let node: import("@met4citizen/headaudio/dist/headaudio.min.mjs").HeadAudio | undefined;
    (async () => {
      const { HeadAudio } = await import("@met4citizen/headaudio/dist/headaudio.min.mjs");
      const ctx = voice.context;
      await ctx.audioWorklet.addModule(WORKLET_URL);
      if (dead) return;
      node = new HeadAudio(ctx, { visemeMinMs: 120, parameterData: { vadGateActiveDb: -40, vadGateInactiveDb: -60 } });
      await node.loadModel(LIPSYNC_MODEL_URL);
      if (dead) return;
      node.onvalue = (key, value) => {
        const mt = head.mtAvatar[key];
        if (mt) Object.assign(mt, { newvalue: value, needsUpdate: true });
      };
      voice.connect(node); // HeadAudio has no outputs: it only listens (connecting its output throws)
      head.opt.update = node.update.bind(node);
    })().catch((e) => console.warn("Interviewer lip sync unavailable", e)); // not fatal: head and hands still move
    return () => {
      dead = true;
      head.opt.update = null;
      try {
        if (node) voice.disconnect(node);
      } catch {
        /* already gone */
      }
      node?.disconnect();
    };
  }, [ready, voice]);

  // Body language per conversation state.
  useEffect(() => {
    const head = headRef.current;
    if (!ready || !head) return;
    if (state === "speaking") {
      head.makeEyeContact(1500);
      if (reduced) return;
      if (Math.random() < 0.35) head.playGesture(GESTURES[Math.floor(Math.random() * GESTURES.length)]!, 2);
      const t = setInterval(() => head.speakWithHands(0, 0.6), HANDS_EVERY_MS);
      return () => clearInterval(t);
    }
    if (state === "listening") {
      head.stopGesture(800);
      head.makeEyeContact(4000); // attentive while the candidate talks
    } else if (state === "thinking") {
      head.lookAhead(1200); // a short glance away, like someone thinking
    }
  }, [ready, state, reduced]);

  return (
    <div className={s.stage}>
      <div ref={box} className={s.canvasBox} aria-hidden>
        {flat && <FlatFace state={state} getLevel={getLevel} />}
      </div>
      <p className={s.stateText} role="status">
        {stateLabel[state]}
      </p>
    </div>
  );
}

/** No-WebGL fallback: same states, flat shapes. The mouth follows `getLevel` on an animation frame. */
function FlatFace({ state, getLevel }: Omit<Props, "voice">) {
  const mouth = useRef<SVGEllipseElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const open = state === "speaking" ? Math.max(0, Math.min(1, getLevel())) : 0;
      mouth.current?.setAttribute("ry", String(2 + open * 14));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [state, getLevel]);
  return (
    <svg viewBox="0 0 200 200" className={s.flat} data-state={state}>
      <circle cx="100" cy="100" r="92" className={s.flatRing} />
      <rect x="40" y="150" width="120" height="50" rx="24" className={s.flatBody} />
      <circle cx="100" cy="92" r="52" className={s.flatHead} />
      <circle cx="80" cy="86" r="5" className={s.flatInk} />
      <circle cx="120" cy="86" r="5" className={s.flatInk} />
      <ellipse ref={mouth} cx="100" cy="116" rx="13" ry="2" className={s.flatInk} />
    </svg>
  );
}
