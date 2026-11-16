"use client";

import { Bot, MessageSquare, User, UsersRound } from "lucide-react";
import type { Turn } from "@/api/interviews";
import { hire as h } from "@/components/hire/ui";
import { cn } from "@/lib/cn";
import s from "./transcript-list.module.scss";
import { InlineEmpty, Notice } from "@/components/ui/notice";

const FLAG_TITLE: Record<string, string> = { multiple_voices: "Possible second voice" };
// A flag turn's text is "<kind>: <note>" (written by the interview room from the flag_concern tool call).
const flagTitle = (text: string) => FLAG_TITLE[text.split(":")[0]] ?? "Interviewer flag";
const flagNote = (text: string) => {
  const note = text.includes(":") ? text.slice(text.indexOf(":") + 1).trim() : text;
  return /[.!?]$/.test(note) ? note : `${note}.`;
};

/**
 * The interview transcript as a chat log. `scroll` caps its height so long transcripts scroll inside the box
 * instead of stretching the page; leave it off where the container already scrolls (the side panel).
 */
export function TranscriptList({ turns, candidateName, scroll = false }: { turns: Pick<Turn, "role" | "kind" | "text" | "language">[]; candidateName: string; scroll?: boolean }) {
  if (turns.length === 0) return <InlineEmpty icon={MessageSquare}>Nothing said yet.</InlineEmpty>;
  return (
    <ol className={cn(s.list, scroll && s.scroll)} tabIndex={scroll ? 0 : undefined} aria-label="Transcript">
      {turns.map((t, i) =>
        t.kind === "flag" ? (
          <li key={i} className={s.flag}>
            <Notice compact tone="warning" icon={UsersRound} title={flagTitle(t.text)}>
              {flagNote(t.text)} AI-detected and unverified: check the recording context before acting on it.
            </Notice>
          </li>
        ) : (
        <li key={i} className={cn(s.turn, t.role === "candidate" && s.candidate)}>
          <span className={h.avatar} aria-hidden>
            {t.role === "ai" ? <Bot size={16} /> : <User size={16} />}
          </span>
          <div className={s.bubble}>
            <p className={h.xs}>
              {t.role === "ai" ? "AI interviewer" : candidateName}
              {t.kind === "typed" ? ` · typed answer${t.language ? ` (${t.language})` : ""}` : t.kind === "question" ? " · written question" : ""}
            </p>
            {t.kind === "typed" ? <pre className={h.code}>{t.text}</pre> : <p>{t.text}</p>}
          </div>
        </li>
        ),
      )}
    </ol>
  );
}
