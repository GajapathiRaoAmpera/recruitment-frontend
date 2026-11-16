"use client";

import { ArrowRight, Bot, RotateCcw, SendHorizontal, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/cn";
import type { Role } from "@/mock/types";
import { suggestionsFor, topicById } from "./knowledge";
import { reply, topicReply, type BotReply } from "./match";
import s from "./hr-bot.module.scss";

type Message = { id: number; from: "user"; text: string } | ({ id: number; from: "bot" } & BotReply);

const PANEL_ID = "hr-bot-panel";

/**
 * Floating HR assistant: a help desk and navigator for the staff portal.
 * Answers come from built-in guides (./knowledge) only, with no API or database calls.
 */
export function HrBot({ role }: { role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const context = suggestionsFor(pathname, role);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, open]);

  const close = () => {
    setOpen(false);
    launcherRef.current?.focus();
  };

  const push = (...items: Omit<Message, "id">[]) =>
    setMessages((m) => [...m, ...items.map((it) => ({ ...it, id: nextId.current++ }) as Message)]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    push({ from: "user", text: q }, { from: "bot", ...reply(q, role, pathname) });
    setDraft("");
  };

  const askTopic = (id: string) => {
    const t = topicById(id, role);
    if (t) push({ from: "user", text: t.title }, { from: "bot", ...topicReply(t, pathname) });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(draft);
  };

  // Small screens: the panel covers the page, so get it out of the way after a jump.
  const onNavigate = () => {
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 639.98px)").matches) setOpen(false);
  };

  const last = messages[messages.length - 1];
  const chips = last?.from === "bot" && last.followUps.length ? last.followUps : messages.length === 0 ? context.topics.map((t) => t.id) : [];

  return (
    <div className={s.root}>
      {open && (
        <section
          id={PANEL_ID}
          role="dialog"
          aria-label="HR assistant"
          className={s.panel}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          <header className={s.head}>
            <span className={s.avatar} aria-hidden>
              <Bot size={18} />
            </span>
            <div className={s.headText}>
              <p className={s.title}>HR assistant</p>
              <p className={s.subtitle}>Guides & shortcuts around the portal</p>
            </div>
            {messages.length > 0 && (
              <button type="button" className={s.iconBtn} onClick={() => setMessages([])} aria-label="Start over" title="Start over">
                <RotateCcw size={16} aria-hidden />
              </button>
            )}
            <button type="button" className={s.iconBtn} onClick={close} aria-label="Close assistant" title="Close">
              <X size={18} aria-hidden />
            </button>
          </header>

          <div className={s.body} aria-live="polite">
            {messages.length === 0 && (
              <div className={cn(s.msg, s.bot)}>
                <p>
                  Hi! I can explain any part of the portal and take you there.
                  {context.label ? ` You're on ${context.label}. Here's what people usually need here:` : " Popular questions:"}
                </p>
              </div>
            )}
            {messages.map((m) =>
              m.from === "user" ? (
                <div key={m.id} className={cn(s.msg, s.user)}>
                  <p>{m.text}</p>
                </div>
              ) : (
                <div key={m.id} className={cn(s.msg, s.bot)}>
                  <p>{m.text}</p>
                  {m.steps && (
                    <ol className={s.steps}>
                      {m.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  )}
                  {m.links.length > 0 && (
                    <div className={s.links}>
                      {m.links.map((l) => (
                        <Link key={l.href + l.label} href={l.href} className={s.link} onClick={onNavigate}>
                          {l.label} <ArrowRight size={14} aria-hidden />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {chips.length > 0 && (
              <div className={s.chips} role="group" aria-label="Suggested questions">
                {chips.map((id) => {
                  const t = topicById(id, role);
                  return t ? (
                    <button key={id} type="button" className={s.chip} onClick={() => askTopic(id)}>
                      {t.title}
                    </button>
                  ) : null;
                })}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className={s.form} onSubmit={submit}>
            <input
              ref={inputRef}
              className={s.input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask how to do something…"
              aria-label="Ask the HR assistant"
              maxLength={300}
            />
            <button type="submit" className={s.send} aria-label="Send" disabled={!draft.trim()}>
              <SendHorizontal size={18} aria-hidden />
            </button>
          </form>
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        className={cn(s.launcher, open && s.launcherOpen)}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? PANEL_ID : undefined}
        aria-label={open ? "Close HR assistant" : "Open HR assistant"}
        title="HR assistant"
      >
        {open ? <X size={22} aria-hidden /> : <Bot size={24} aria-hidden />}
      </button>
    </div>
  );
}
