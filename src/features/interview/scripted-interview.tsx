"use client";

import { Bot, Mic, Send } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { NotFoundState } from "@/components/ui/states";
import { DemoNote, hire as h } from "@/components/hire/ui";
import { exitFullscreen, useExamRound } from "@/components/student/hooks";
import s from "@/components/student/student.module.scss";
import { useStore } from "@/mock/store";
import type { TranscriptTurn } from "@/mock/types";

const END = "Thank you, that's the end of the interview. HR will be in touch with next steps.";

/**
 * shortcut: scripted interviewer. The real flow streams audio with Gemini Live using an ephemeral token
 * from POST /interview/session; the transcript is posted back and scored server-side.
 */
function script(role: string, skills: string[]) {
  return [
    `Hi, I'm the Ampera interviewer for the ${role} role. Could you introduce yourself and a project you're proud of?`,
    `Your resume mentions ${skills[0] ?? "programming"}. What's something tricky you solved with it?`,
    "How would you design the database for a simple event-registration app?",
    "What would you change if that app's traffic grew ten times?",
  ];
}

/** Prototype mode: the scripted text interview on the mock store (the real one is /interview). */
export function ScriptedInterview() {
  const { roundId } = useParams<{ roundId: string }>();
  const router = useRouter();
  const { dispatch } = useStore();
  const { candidate, drive, round, recorded } = useExamRound(roundId);
  const questions = candidate && drive ? script(drive.roleTitle, candidate.skills) : [];
  const [turns, setTurns] = useState<TranscriptTurn[]>(() => (questions[0] ? [{ role: "ai", text: questions[0] }] : []));
  const [answer, setAnswer] = useState("");
  const [thinking, setThinking] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const asked = turns.filter((t) => t.role === "ai").length;
  const ended = turns.at(-1)?.text === END;

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  if (!round || !candidate || round.type !== "ai_interview") return <NotFoundState title="Interview not found" />;

  const send = () => {
    if (!answer.trim()) return;
    const next: TranscriptTurn[] = [...turns, { role: "candidate", text: answer.trim() }];
    setTurns(next);
    setAnswer("");
    setThinking(true);
    setTimeout(() => {
      setTurns((t) => [...t, { role: "ai", text: asked < questions.length ? questions[asked]! : END }]);
      setThinking(false);
    }, 800);
  };

  const finish = () => {
    if (recorded) dispatch({ type: "saveInterview", roundId, candidateId: candidate.id, transcript: turns });
    exitFullscreen();
    router.push(`/exam/${roundId}/done`);
  };

  return (
    <>
      <header className={s.examBar}>
        <Logo height={22} />
        <div className={s.examTitle}>
          <p>{round.title}</p>
          <p className={h.xs}>
            Question {Math.min(asked, questions.length)} of {questions.length}
          </p>
        </div>
        {!recorded && <Badge tone="warning">Preview</Badge>}
        {!ended && <span className={s.live}>Live</span>}
      </header>
      <main className={s.examBody} style={{ maxWidth: "48rem", marginInline: "auto", width: "100%" }}>
        <section className={h.card} aria-label="Interview">
          <div ref={chatRef} className={s.chat} aria-live="polite">
            {turns.map((t, i) => (
              <div key={i} className={s.bubble} data-role={t.role}>
                {t.role === "ai" && (
                  <p className={h.xs} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Bot aria-hidden size={14} /> AI interviewer
                  </p>
                )}
                <p>{t.text}</p>
              </div>
            ))}
            {thinking && <p className={h.xs}>Interviewer is responding…</p>}
          </div>
        </section>

        {ended ? (
          <div className={h.card}>
            <p style={{ fontWeight: 500 }}>Interview complete.</p>
            <p className={h.muted}>Your transcript is saved for HR review.</p>
            <Button style={{ marginTop: 12 }} onClick={finish}>
              Finish
            </Button>
          </div>
        ) : (
          <div className={h.card}>
            <Field label="Your answer" hint="In the real interview you speak; here you can type.">
              <Textarea
                rows={3}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
                }}
              />
            </Field>
            <div className={h.between} style={{ marginTop: 12 }}>
              <Button variant="secondary" disabled title="Voice runs on Gemini Live in the real build">
                <Mic aria-hidden size={16} style={{ marginRight: 4 }} /> Speak
              </Button>
              <Button onClick={send} disabled={!answer.trim() || thinking}>
                <Send aria-hidden size={16} style={{ marginRight: 4 }} /> Send answer
              </Button>
            </div>
          </div>
        )}
        <DemoNote>Simulated interviewer. The real one is Gemini Live (voice), with prompts managed by the Super Admin.</DemoNote>
      </main>
    </>
  );
}
