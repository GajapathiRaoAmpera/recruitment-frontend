import type { LiveServerMessage, Session } from "@google/genai";

// The browser <-> Gemini Live connection, kept alive for the whole interview.
// - Every `sessionResumptionUpdate.newHandle` is stored.
// - On `goAway` (the server ends each connection after ~10 min) or a dropped socket, it reconnects with the
//   stored handle, so the conversation carries on. First with the same token; if that is refused, with a fresh
//   token from our API (POST /interview/session), still resuming the same handle.
// - After MAX_TRIES failures it gives up with status "lost"; the page offers a Reconnect button.
// The SDK is injected (`connect`) so the reconnect logic is unit tested without a network.

export type LinkStatus = "connecting" | "open" | "reconnecting" | "lost" | "closed";

export interface Credentials {
  token: string;
  model: string;
  config: Record<string, unknown>;
}

export type Connect = (
  creds: Credentials,
  handle: string | undefined,
  callbacks: { onmessage: (m: LiveServerMessage) => void; onclose: (e?: { code?: number; reason?: string }) => void; onerror: (e: unknown) => void },
) => Promise<Pick<Session, "sendRealtimeInput" | "sendClientContent" | "sendToolResponse" | "close">>;

export const MAX_TRIES = 4;

export class LiveLink {
  status: LinkStatus = "connecting";
  handle: string | undefined;
  private session?: Awaited<ReturnType<Connect>>;
  private generation = 0; // ignore callbacks from connections we already replaced
  private closing = false;
  private reconnecting = false;

  constructor(
    private creds: Credentials,
    private deps: {
      connect: Connect;
      freshCredentials: () => Promise<Credentials>;
      onMessage: (m: LiveServerMessage) => void;
      onStatus: (s: LinkStatus) => void;
      sleep?: (ms: number) => Promise<void>;
    },
  ) {}

  private set(s: LinkStatus) {
    this.status = s;
    this.deps.onStatus(s);
  }

  async open(): Promise<void> {
    this.set("connecting");
    await this.connect();
    this.set("open");
  }

  private async connect(): Promise<void> {
    const gen = ++this.generation;
    this.session = await this.deps.connect(this.creds, this.handle, {
      onmessage: (m) => {
        if (gen !== this.generation) return;
        const upd = m.sessionResumptionUpdate;
        if (upd?.resumable && upd.newHandle) this.handle = upd.newHandle;
        if (m.goAway) void this.reconnect(); // planned end of this connection
        this.deps.onMessage(m);
      },
      onclose: () => {
        if (gen === this.generation && !this.closing) void this.reconnect();
      },
      onerror: () => {
        if (gen === this.generation && !this.closing) void this.reconnect();
      },
    });
  }

  /** Reopen with the stored handle. Safe to call repeatedly; only one runs at a time. */
  async reconnect(): Promise<boolean> {
    if (this.reconnecting || this.closing) return false;
    this.reconnecting = true;
    this.set("reconnecting");
    const old = this.session;
    this.generation++; // the old connection's late callbacks are ignored from here
    try {
      old?.close();
    } catch {
      /* already closed */
    }
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    try {
      for (let attempt = 1; attempt <= MAX_TRIES && !this.closing; attempt++) {
        try {
          if (attempt > 1) this.creds = await this.deps.freshCredentials(); // the token may be used up
          await this.connect();
          this.set("open");
          return true;
        } catch {
          await sleep(Math.min(8000, 500 * 2 ** attempt));
        }
      }
      if (!this.closing) this.set("lost");
      return false;
    } finally {
      this.reconnecting = false;
    }
  }

  get ready(): boolean {
    return this.status === "open" && Boolean(this.session);
  }

  sendAudio(b64: string): void {
    if (this.ready) this.session!.sendRealtimeInput({ audio: { data: b64, mimeType: "audio/pcm;rate=16000" } });
  }

  sendText(text: string): void {
    if (this.ready) this.session!.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
  }

  respondTool(id: string | undefined, name: string, response: Record<string, unknown>): void {
    if (this.ready) this.session!.sendToolResponse({ functionResponses: [{ id, name, response }] });
  }

  close(): void {
    this.closing = true;
    this.generation++;
    try {
      this.session?.close();
    } catch {
      /* already closed */
    }
    this.set("closed");
  }
}
