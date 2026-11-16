"use client";

import type { LiveServerMessage } from "@google/genai";
import { AlertCircle, Clock, Mic, PenLine, Send, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type InterviewSession, interviewSession, postFrame, postTranscript, type Turn } from "@/api/interviews";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { hire as h } from "@/components/hire/ui";
import st from "@/components/student/student.module.scss";
import { AudioEngine } from "./audio-engine";
import type { CharacterState } from "./character-state";
import { geminiConnect } from "./gemini-connect";
import { InterviewerCharacter } from "./interviewer-character";
import s from "./interview.module.scss";
import { LiveLink, type LinkStatus } from "./live-link";
import { saysClosing, TurnCollector, TurnUploader } from "./transcript";
import { NetworkBars } from "./network-bars";
import { useNetworkQuality, type Verdict } from "./use-network-quality";

const FRAME_EVERY_MS = 3000;
const WRAP_UP_AT_S = 180;

interface Box {
  question: string;
  mode: "code" | "text";
  language?: string;
}

interface Line {
  role: Turn["role"];
  text: string;
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/**
 * The live interview. Mic and AI voice go straight between the browser and Gemini (one-use token); this page
 * only collects the transcript, sends a camera still every 3 s, and runs the timer. Mount it after the student
 * has clicked Start and granted mic + camera (`media`), so audio is allowed.
 */
export function InterviewRoom({ token, roleTitle, media, onDone }: { token: string; roleTitle: string; media: MediaStream; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (error) toast({ tone: "danger", title: error });
  }, [error, toast]);
  const [link, setLink] = useState<LinkStatus>("connecting");
  const [char, setChar] = useState<CharacterState>("idle");
  const [left, setLeft] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [live_, setLive] = useState<Line | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [draft, setDraft] = useState("");
  const [boxHidden, setBoxHidden] = useState(false); // closed with X/Esc: the question stays open and can be reopened
  const [finishing, setFinishing] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [voice, setVoice] = useState<AudioNode | null>(null); // AI voice playback, for the avatar's lips
  const net = useNetworkQuality("watch");

  const session = useRef<InterviewSession | null>(null);
  const audio = useRef<AudioEngine | null>(null);
  const live = useRef<LiveLink | null>(null);
  const collector = useRef<TurnCollector | null>(null);
  const uploader = useRef<TurnUploader | null>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const meterEl = useRef<HTMLDivElement>(null);
  const chatEl = useRef<HTMLDivElement>(null);
  const deadline = useRef(0);
  const closingSeen = useRef(false);
  const done = useRef(false);
  const wrapSent = useRef(false);

  const getLevel = useCallback(() => {
    const a = audio.current;
    if (!a) return 0;
    const out = a.outLevel();
    return out > 0.02 ? out : a.micLevel;
  }, []);

  const finish = useCallback(async () => {
    if (done.current) return;
    done.current = true;
    setFinishing(true);
    collector.current?.close();
    live.current?.close();
    try {
      await uploader.current?.finish();
    } catch {
      done.current = false; // let the student press End again
      setFinishing(false);
      setError("Couldn't save your interview. Check your connection and press End again.");
      return;
    }
    await audio.current?.close();
    media.getTracks().forEach((t) => t.stop());
    onDone();
  }, [media, onDone]);

  // Start: token -> audio -> Gemini
  useEffect(() => {
    let dead = false;

    const showCaption = () => setLive(collector.current?.current ?? null);

    const handle = (m: LiveServerMessage) => {
      const sc = m.serverContent;
      const col = collector.current;
      const eng = audio.current;
      if (!col || !eng) return;
      for (const p of sc?.modelTurn?.parts ?? []) {
        if (p.inlineData?.data) {
          eng.play(p.inlineData.data);
          setChar("speaking");
        }
      }
      if (sc?.inputTranscription?.text) {
        col.add("candidate", sc.inputTranscription.text);
        setChar("listening");
      }
      if (sc?.outputTranscription?.text) {
        col.add("ai", sc.outputTranscription.text);
        if (saysClosing(col.current?.text ?? "", session.current?.protocol.closingPhrase ?? "")) closingSeen.current = true;
      }
      if (sc?.interrupted) {
        eng.interrupt();
        col.close();
        setChar("listening");
      }
      if (sc?.turnComplete) {
        col.close();
        if (closingSeen.current) {
          // let the last words finish playing, then end
          setTimeout(() => void finish(), Math.max(1500, eng.queued * 1000 + 800));
        } else {
          setChar(eng.playing ? "speaking" : "thinking");
        }
      }
      for (const fc of m.toolCall?.functionCalls ?? []) {
        if (fc.name !== "show_answer_box") continue;
        const a = (fc.args ?? {}) as Partial<Box>;
        const b: Box = { question: String(a.question ?? ""), mode: a.mode === "code" ? "code" : "text", language: a.language };
        col.close();
        uploader.current?.push({ role: "ai", kind: "question", text: b.question, language: b.language ?? null, ts: new Date().toISOString() });
        live.current?.respondTool(fc.id, fc.name, { result: "The answer box is open on the candidate's screen." });
        setBox(b);
        setDraft("");
        setBoxHidden(false);
      }
      showCaption();
    };

    (async () => {
      try {
        const sess = await interviewSession(token);
        if (dead) return;
        session.current = sess;
        deadline.current = Date.now() + sess.secondsLeft * 1000;
        setLeft(sess.secondsLeft);

        const eng = AudioEngine.create();
        await eng.ctx.resume();
        audio.current = eng;
        setVoice(eng.output);
        uploader.current = new TurnUploader((turns, ended) => postTranscript(token, turns, ended));
        collector.current = new TurnCollector((t) => {
          uploader.current?.push(t);
          setLines((l) => [...l, { role: t.role, text: t.text }]);
        });

        const creds = (x: InterviewSession) => ({ token: x.ephemeralToken, model: x.model, config: x.clientConfig });
        const lk = new LiveLink(creds(sess), {
          connect: geminiConnect,
          freshCredentials: async () => creds(await interviewSession(token)),
          onStatus: (st) => {
            setLink(st);
            eng.setMuted(st !== "open");
            if (st === "reconnecting") setChar("reconnecting");
            if (st === "open") setChar("listening");
          },
          onMessage: handle,
        });
        live.current = lk;
        await lk.open();
        await eng.startMic(media, (b64) => lk.sendAudio(b64));
        lk.sendText(`${sess.protocol.systemTag} The candidate is ready. Begin the interview now.`);
        setChar("thinking");
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "Couldn't start the interview.");
      }
    })();

    return () => {
      dead = true;
      uploader.current?.stop();
      live.current?.close();
      void audio.current?.close();
    };
  }, [token, media, finish]);

  // camera: preview + a still every 3 s
  useEffect(() => {
    const v = videoEl.current;
    if (v) {
      v.srcObject = media;
      void v.play().catch(() => {});
    }
    const c = document.createElement("canvas");
    const timer = setInterval(() => {
      const el = videoEl.current;
      if (!el || !el.videoWidth || done.current) return;
      c.width = 320;
      c.height = Math.round((320 * el.videoHeight) / el.videoWidth);
      c.getContext("2d")?.drawImage(el, 0, 0, c.width, c.height);
      c.toBlob((b) => b && void postFrame(token, b).catch(() => {}), "image/jpeg", 0.6);
    }, FRAME_EVERY_MS);
    return () => clearInterval(timer);
  }, [media, token]);

  // timer + mic meter
  useEffect(() => {
    const t = setInterval(() => {
      if (!deadline.current) return;
      const sec = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setLeft(sec);
      if (sec <= WRAP_UP_AT_S && !wrapSent.current && live.current?.ready) {
        wrapSent.current = true;
        live.current.sendText(`${session.current?.protocol.systemTag} About 3 minutes are left. Wrap up and finish with your closing.`);
      }
      if (sec === 0) void finish();
    }, 1000);
    let raf = 0;
    const tick = () => {
      if (meterEl.current) meterEl.current.style.width = `${Math.round(Math.min(1, (audio.current?.micLevel ?? 0) * 4) * 100)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      clearInterval(t);
      cancelAnimationFrame(raf);
    };
  }, [finish]);

  useEffect(() => {
    const el = chatEl.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, live_]);

  const submitBox = () => {
    const sess = session.current;
    if (!box || !draft.trim() || !sess) return;
    const text = draft.trim();
    uploader.current?.push({ role: "candidate", kind: "typed", text, language: box.language ?? null, ts: new Date().toISOString() });
    live.current?.sendText(`${sess.protocol.typedPrefix}${box.language ? ` (${box.language})` : ""}:\n${text}`);
    setLines((l) => [...l, { role: "candidate", text: "(typed answer submitted)" }]);
    setBox(null);
    setChar("thinking");
  };

  if (error)
    return (
      <div className={s.center}>
        <div className={`${h.card} ${s.notice}`}>
          <AlertCircle aria-hidden size={32} className={s.noticeIcon} data-tone="danger" />
          <h1 className={s.checkTitle}>The interview stopped</h1>
          <p className={s.stateText}>{error}</p>
          {lines.length === 0 && !finishing ? (
            // nothing recorded yet: rejoining resumes the same interview, so never show "complete"
            <Button onClick={() => window.location.reload()}>Try again</Button>
          ) : (
            <Button variant="secondary" onClick={() => void finish()}>
              Save and end interview
            </Button>
          )}
        </div>
      </div>
    );

  const verdict: Verdict = link === "reconnecting" && net.verdict === "good" ? "weak" : net.verdict;
  const shown = live_ ? [...lines, live_] : lines;
  return (
    <>
      <header className={st.examBar}>
        <Logo height={22} />
        <div className={st.examTitle}>
          <p>{roleTitle} interview</p>
          <p className={h.xs}>AI interviewer · speak naturally, it hears you</p>
        </div>
        {link === "open" && <span className={st.live}>Live</span>}
        <NetworkBars verdict={verdict} />
        <span className={st.timer} data-low={left !== null && left <= WRAP_UP_AT_S} role="timer" aria-label="Time left">
          <Clock aria-hidden size={14} />
          {left === null ? "—" : clock(left)}
        </span>
        <Button variant="secondary" onClick={() => setConfirmEnd(true)} disabled={finishing} loading={finishing}>
          {finishing ? "Saving…" : "End interview"}
        </Button>
      </header>
      <div className={s.room}>
        <main className={s.main}>
          <section className={h.card} aria-label="Interviewer">
            <InterviewerCharacter state={link === "lost" ? "idle" : char} getLevel={getLevel} voice={voice} />
            {(link === "reconnecting" || net.verdict === "offline") && (
              <p role="status" className={s.banner}>
                <WifiOff aria-hidden size={16} /> Connection lost. Reconnecting… your answers so far are safe.
              </p>
            )}
            {link === "lost" && (
              <div className={s.banner} role="alert">
                <WifiOff aria-hidden size={16} /> Couldn&apos;t reconnect.
                <Button size="sm" onClick={() => void live.current?.reconnect()}>
                  Reconnect
                </Button>
              </div>
            )}
          </section>
          {box && boxHidden && (
            <div className={s.banner} data-tone="info">
              <PenLine aria-hidden size={16} /> The interviewer is waiting for a typed answer.
              <Button size="sm" onClick={() => setBoxHidden(false)}>
                Open answer box
              </Button>
            </div>
          )}
          <section className={h.card} aria-label="Conversation">
            <p className={h.eyebrow}>Live captions</p>
            <div ref={chatEl} className={`${st.chat} ${s.captions}`} aria-live="polite">
              {shown.length === 0 ? (
                <p className={s.stateText}>The interviewer will greet you in a moment.</p>
              ) : (
                shown.map((l, i) => (
                  <div key={i} className={st.bubble} data-role={l.role}>
                    <p className={h.xs}>{l.role === "ai" ? "AI interviewer" : "You"}</p>
                    <p className={s.line}>{l.text}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
        <aside className={s.side}>
          <section className={h.card} aria-label="You">
            <div className={s.camBox}>
              <video ref={videoEl} className={s.cam} muted playsInline aria-label="Your camera preview" />
              <span className={s.camTag}>You</span>
            </div>
            <p className={`${h.xs} ${s.meterLabel}`}>
              <Mic aria-hidden size={14} /> Mic level
            </p>
            <div className={s.meter}>
              <div ref={meterEl} style={{ width: 0 }} />
            </div>
          </section>
          <section className={h.card} aria-label="Tips">
            <p className={h.eyebrow}>Tips</p>
            <ul className={s.tips}>
              <li>Wait for the interviewer to finish, then answer out loud.</li>
              <li>Ask it to repeat if you missed a question.</li>
              <li>Coding questions open a box to type into.</li>
              <li>HR may watch your camera live. Nothing is recorded.</li>
            </ul>
          </section>
        </aside>
      </div>
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        title="End the interview?"
        description="Your answers so far are saved and sent to HR. You can't continue the interview after ending it."
        confirmLabel="End interview"
        onConfirm={() => {
          setConfirmEnd(false);
          void finish();
        }}
      />
      <Dialog open={Boolean(box) && !boxHidden} onOpenChange={(o) => !o && setBoxHidden(true)}>
        {box && (
          <DialogContent
            title={box.mode === "code" ? `Write your code${box.language ? ` (${box.language})` : ""}` : "Type your answer"}
            className={s.answerDialog}
            footer={
              <Button onClick={submitBox} disabled={!draft.trim()}>
                <Send aria-hidden size={16} style={{ marginRight: 4 }} /> Submit answer
              </Button>
            }
          >
            <div className={s.answer}>
              <p className={s.question}>{box.question}</p>
              <Textarea aria-label="Your answer" rows={10} maxLength={8000} value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={box.mode === "text"} autoFocus />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

