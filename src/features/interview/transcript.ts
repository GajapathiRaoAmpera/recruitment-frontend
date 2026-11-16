import type { Turn } from "@/api/interviews";

// Live captions arrive as small text pieces from two streams (the student's speech and the interviewer's).
// TurnCollector joins them into whole turns: a turn closes when the other side starts, when the model says its
// turn is complete, or when it is interrupted. Closed turns go to `onTurn` and are posted in small batches.

export const MAX_BATCH = 50; // backend limit per call
export const MAX_SPOKEN_CHARS = 2000;

const joinPiece = (a: string, b: string) => (a ? a + b : b.trimStart());

export class TurnCollector {
  private open: { role: Turn["role"]; text: string; ts: string } | null = null;

  constructor(
    private onTurn: (t: Turn) => void,
    private now: () => Date = () => new Date(),
  ) {}

  /** The open turn's text so far (for the live caption). */
  get current(): { role: Turn["role"]; text: string } | null {
    return this.open && this.open.text.trim() ? { role: this.open.role, text: this.open.text.trim() } : null;
  }

  add(role: Turn["role"], piece: string): void {
    if (!piece) return;
    if (this.open && this.open.role !== role) this.close();
    if (!this.open) this.open = { role, text: "", ts: this.now().toISOString() };
    this.open.text = joinPiece(this.open.text, piece);
    // a very long monologue is split so no turn breaks the per-turn limit
    if (this.open.text.length > MAX_SPOKEN_CHARS - 100) this.close();
  }

  /** Close the open turn (model turn complete, interrupted, or a typed answer comes next). */
  close(): void {
    const t = this.open;
    this.open = null;
    const text = t?.text.trim();
    if (t && text) this.onTurn({ role: t.role, kind: "spoken", text: text.slice(0, MAX_SPOKEN_CHARS), ts: t.ts });
  }
}

/** Posts turns in order, at most MAX_BATCH per call, retrying with backoff. Never drops a turn. */
export class TurnUploader {
  private queue: Turn[] = [];
  private busy = false;
  private failures = 0;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private post: (turns: Turn[], ended: boolean) => Promise<unknown>,
    private onState: (s: { unsent: number; failing: boolean }) => void = () => {},
  ) {}

  push(t: Turn): void {
    this.queue.push(t);
    this.onState({ unsent: this.queue.length, failing: this.failures > 0 });
    void this.flush();
  }

  get unsent(): number {
    return this.queue.length;
  }

  async flush(): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    clearTimeout(this.timer);
    try {
      while (this.queue.length) {
        const batch = this.queue.slice(0, MAX_BATCH);
        await this.post(batch, false);
        this.queue.splice(0, batch.length);
        this.failures = 0;
        this.onState({ unsent: this.queue.length, failing: false });
      }
      return true;
    } catch {
      this.failures += 1;
      this.onState({ unsent: this.queue.length, failing: true });
      this.timer = setTimeout(() => void this.flush(), Math.min(30_000, 1000 * 2 ** this.failures));
      return false;
    } finally {
      this.busy = false;
    }
  }

  /** Send whatever is left plus `ended: true`. Throws if the server can't be reached. */
  async finish(): Promise<void> {
    clearTimeout(this.timer);
    while (this.busy) await new Promise((r) => setTimeout(r, 50));
    do {
      const batch = this.queue.slice(0, MAX_BATCH);
      const last = batch.length === this.queue.length;
      await this.post(batch, last);
      this.queue.splice(0, batch.length);
    } while (this.queue.length);
    this.onState({ unsent: 0, failing: false });
  }

  stop(): void {
    clearTimeout(this.timer);
  }
}

/** True when the interviewer's words contain the closing phrase (spacing, case and punctuation ignored). */
export function saysClosing(text: string, phrase: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const p = norm(phrase);
  return p.length > 0 && norm(text).includes(p);
}

// Devanagari through Malayalam (Hindi, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam) and Urdu/Arabic.
const NON_ENGLISH_SCRIPT = /[\u0600-\u06FF\u0900-\u0DFF]/;

/** True when captions contain an Indian-language (or Urdu) script, i.e. the speaker left English. */
export function leftEnglish(text: string): boolean {
  return NON_ENGLISH_SCRIPT.test(text);
}

export interface AnswerBox {
  question: string;
  mode: "code" | "text";
  language?: string;
}

/** What the room does with one interviewer tool call, and the tool response to send back. */
export type ToolDecision =
  | { action: "open"; box: AnswerBox; response: Record<string, string> }
  | { action: "refuse"; response: Record<string, string> }
  | { action: "flag"; text: string; response: Record<string, string> }
  | { action: "ignore" };

/**
 * One written question at a time: a second show_answer_box while one is open is refused, so the interviewer waits
 * for the typed answer. flag_concern becomes an advisory "<kind>: <note>" line for HR.
 */
export function decideTool(name: string | undefined, args: Record<string, unknown> | undefined, boxOpen: boolean): ToolDecision {
  const a = args ?? {};
  if (name === "flag_concern") {
    const text = `${String(a.kind ?? "concern")}: ${String(a.note ?? "").trim() || "no detail"}`.slice(0, MAX_SPOKEN_CHARS);
    return { action: "flag", text, response: { result: "Noted for HR. Continue the interview." } };
  }
  if (name !== "show_answer_box") return { action: "ignore" };
  if (boxOpen) return { action: "refuse", response: { error: "A written question is still open. Wait for the candidate's typed answer before asking anything new." } };
  const box: AnswerBox = { question: String(a.question ?? ""), mode: a.mode === "code" ? "code" : "text", language: typeof a.language === "string" ? a.language : undefined };
  return { action: "open", box, response: { result: "The answer box is open on the candidate's screen. Wait for their typed answer before asking anything new." } };
}
