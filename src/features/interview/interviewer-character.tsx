"use client";

import { useEffect, useRef, useState } from "react";
import { type CharacterState, hasWebGL, stateLabel } from "./character-state";
import s from "./interview.module.scss";

interface Props {
  state: CharacterState;
  /** Called every frame, 0..1: the AI's voice while speaking, the mic while listening. Read from refs, no re-renders. */
  getLevel: () => number;
}

/** The 3D interviewer. three.js loads only when this mounts; without WebGL a flat SVG face shows the same states. */
export function InterviewerCharacter({ state, getLevel }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<import("./character-scene").CharacterScene | null>(null);
  const stateRef = useRef(state);
  const levelRef = useRef(getLevel);
  const [flat, setFlat] = useState(false);

  useEffect(() => {
    stateRef.current = state;
    levelRef.current = getLevel;
    if (scene.current) scene.current.state = state;
  });

  useEffect(() => {
    if (!hasWebGL()) {
      setFlat(true); // eslint-disable-line react-hooks/set-state-in-effect -- feature check after mount
      return;
    }
    let dead = false;
    let ro: ResizeObserver | undefined;
    let onVis: (() => void) | undefined;
    void import("./character-scene")
      .then(({ CharacterScene, readPalette }) => {
        if (dead || !canvas.current || !box.current) return;
        const sc = new CharacterScene(canvas.current, readPalette(), () => levelRef.current());
        scene.current = sc;
        sc.state = stateRef.current;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        sc.reducedMotion = mq.matches;
        const fit = () => sc.resize(box.current!.clientWidth, box.current!.clientHeight);
        ro = new ResizeObserver(fit);
        ro.observe(box.current);
        fit();
        onVis = () => (document.hidden ? sc.stop() : sc.start());
        document.addEventListener("visibilitychange", onVis);
        sc.start();
      })
      .catch(() => !dead && setFlat(true));
    return () => {
      dead = true;
      ro?.disconnect();
      if (onVis) document.removeEventListener("visibilitychange", onVis);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  return (
    <div className={s.stage}>
      <div ref={box} className={s.canvasBox} aria-hidden>
        {flat ? <FlatFace state={state} getLevel={getLevel} /> : <canvas ref={canvas} className={s.canvas} />}
      </div>
      <p className={s.stateText} role="status">
        {stateLabel[state]}
      </p>
    </div>
  );
}

/** No-WebGL fallback: same states, flat shapes. The mouth follows `getLevel` on an animation frame. */
function FlatFace({ state, getLevel }: Props) {
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
