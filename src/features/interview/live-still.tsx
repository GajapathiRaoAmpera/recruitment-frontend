"use client";

import { CameraOff, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { interviewFrame } from "@/api/interviews";
import { Person } from "@/components/hire/ui";
import { cn } from "@/lib/cn";
import s from "./live-still.module.scss";

export const FRAME_POLL_MS = 3000; // the student's room sends a still every 3 s
export const LIVE_REFRESH_MS = 5000;

/** Quiet reload every few seconds while `on` and the tab is visible (live interviews keep changing). */
export function useAutoReload(reload: () => void, on: boolean) {
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => document.visibilityState === "visible" && reload(), LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [on, reload]);
}

/**
 * Latest camera still of a live interview, refreshed every 3 s while the tab is visible. Nothing is kept: each still
 * replaces the last. A 404 (camera paused, or the interview just ended) shows a placeholder, not an error.
 */
export function LiveStill({ id, name, className }: { id: string; name: string; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let current: string | undefined;
    let stale = false;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      interviewFrame(id).then(
        (b) => {
          if (stale) return;
          if (current) URL.revokeObjectURL(current);
          current = URL.createObjectURL(b);
          setUrl(current);
        },
        () => !stale && setUrl(undefined),
      );
    };
    load();
    const t = setInterval(load, FRAME_POLL_MS);
    return () => {
      stale = true;
      clearInterval(t);
      if (current) URL.revokeObjectURL(current);
    };
  }, [id]);
  return (
    <div className={cn(s.frame, className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL, next/image can't optimise it
        <img src={url} alt={`Live camera of ${name}`} className={s.img} />
      ) : (
        <div className={s.empty}>
          <CameraOff aria-hidden size={22} />
          <span>Waiting for camera…</span>
        </div>
      )}
      <span className={s.live} aria-hidden>
        <span className={s.dot} /> LIVE
      </span>
    </div>
  );
}

/** "Live now": one camera tile per student in an interview; each opens the full live view (transcript, scores, notes). */
export function LiveWall({ items }: { items: { id: string; name: string; meta?: string }[] }) {
  return (
    <ul className={s.wall} aria-label="Live interviews">
      {items.map((i) => (
        <li key={i.id}>
          <Link href={`/hr/interviews/${i.id}`} className={s.tile} aria-label={`Watch ${i.name}'s interview`}>
            <LiveStill id={i.id} name={i.name} />
            <span className={s.tileFoot}>
              <Person name={i.name} meta={i.meta} />
              <Eye aria-hidden size={16} className={s.watch} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
