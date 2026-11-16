import type { LiveServerMessage } from "@google/genai";
import { describe, expect, it, vi } from "vitest";
import type { Turn } from "@/api/interviews";
import { type Connect, LiveLink, MAX_TRIES } from "./live-link";
import { decodeModelAudio, downsample, encodeMicChunk, floatToPcm16, IN_RATE, level, pcm16ToFloat } from "./pcm";
import { MAX_BATCH, saysClosing, TurnCollector, TurnUploader } from "./transcript";
import { judge } from "./use-network-quality";

// AC-8: the interview transcript reaches the server whole, and the session survives Gemini's ~10-minute reconnects.

describe("pcm", () => {
  it("downsamples 48 kHz to 16 kHz", () => {
    expect(downsample(new Float32Array(4800), 48_000, IN_RATE)).toHaveLength(1600);
  });

  it("clamps and round-trips 16-bit samples", () => {
    const pcm = floatToPcm16(new Float32Array([2, -2, 0, 0.5]));
    expect(pcm[0]).toBe(32767);
    expect(pcm[1]).toBe(-32768);
    const back = pcm16ToFloat(pcm);
    expect(back[3]).toBeCloseTo(0.5, 3);
  });

  it("encodes mic chunks the model side can decode", () => {
    const b64 = encodeMicChunk(new Float32Array(1600).fill(0.25), IN_RATE);
    const out = decodeModelAudio(b64);
    expect(out).toHaveLength(1600);
    expect(out[0]).toBeCloseTo(0.25, 3);
  });

  it("reports silence as 0 and stays within 0..1", () => {
    expect(level(new Float32Array(100))).toBe(0);
    expect(level(new Float32Array(100).fill(1))).toBeLessThanOrEqual(1);
  });
});

describe("network verdicts", () => {
  it("is good when fast and steady", () => expect(judge([100, 110, 105, 98, 102]).verdict).toBe("good"));
  it("is weak when slow", () => expect(judge([500, 520, 510, 490, 505]).verdict).toBe("weak"));
  it("is weak when jittery", () => expect(judge([50, 300, 40, 280, 60]).verdict).toBe("weak"));
  it("is weak when one request failed", () => expect(judge([100, null, 100, 100, 100]).verdict).toBe("weak"));
  it("is offline when every request failed", () => expect(judge([null, null]).verdict).toBe("offline"));
  it("is offline on the browser offline flag", () => expect(judge([100, 100], false).verdict).toBe("offline"));
});

describe("TurnCollector", () => {
  it("joins caption pieces and closes a turn when the other side speaks", () => {
    const out: Turn[] = [];
    const c = new TurnCollector((t) => out.push(t));
    c.add("ai", "Tell me ");
    c.add("ai", "about yourself.");
    c.add("candidate", " I am a student.");
    expect(out).toEqual([expect.objectContaining({ role: "ai", kind: "spoken", text: "Tell me about yourself." })]);
    expect(c.current).toEqual({ role: "candidate", text: "I am a student." });
    c.close();
    expect(out).toHaveLength(2);
  });

  it("splits a monologue so no turn breaks the 2000-char limit", () => {
    const out: Turn[] = [];
    const c = new TurnCollector((t) => out.push(t));
    for (let i = 0; i < 50; i++) c.add("candidate", "x".repeat(100));
    c.close();
    expect(out.every((t) => t.text.length <= 2000)).toBe(true);
    expect(out.map((t) => t.text).join("")).toHaveLength(5000);
  });
});

describe("TurnUploader", () => {
  it("posts in batches of at most MAX_BATCH and sends ended on finish", async () => {
    const post = vi.fn<(turns: Turn[], ended: boolean) => Promise<unknown>>().mockResolvedValue({});
    const u = new TurnUploader(post);
    const turns = Array.from({ length: MAX_BATCH + 10 }, (_, i): Turn => ({ role: "ai", text: `t${i}`, ts: "" }));
    // queue without flushing each one
    (u as unknown as { queue: Turn[] }).queue.push(...turns);
    await u.finish();
    expect(post.mock.calls.map(([t, e]) => [t.length, e])).toEqual([
      [MAX_BATCH, false],
      [10, true],
    ]);
  });

  it("keeps turns after a failed post and retries", async () => {
    vi.useFakeTimers();
    const post = vi.fn<(turns: Turn[], ended: boolean) => Promise<unknown>>().mockRejectedValueOnce(new Error("down")).mockResolvedValue({});
    const u = new TurnUploader(post);
    u.push({ role: "ai", text: "hi", ts: "" });
    await vi.advanceTimersByTimeAsync(0);
    expect(u.unsent).toBe(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(u.unsent).toBe(0);
    vi.useRealTimers();
  });
});

describe("saysClosing", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(saysClosing("Thanks! THAT concludes   our interview", "That concludes our interview.")).toBe(true);
    expect(saysClosing("That was a good answer", "That concludes our interview.")).toBe(false);
  });
});

describe("LiveLink", () => {
  const fakeSession = () => ({ sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), sendToolResponse: vi.fn(), close: vi.fn() });

  it("reconnects on goAway with the latest resumption handle", async () => {
    const calls: (string | undefined)[] = [];
    let cb: Parameters<Connect>[2] | undefined;
    const connect: Connect = async (_c, handle, callbacks) => {
      calls.push(handle);
      cb = callbacks;
      return fakeSession();
    };
    const link = new LiveLink({ token: "t", model: "m", config: {} }, { connect, freshCredentials: vi.fn(), onMessage: vi.fn(), onStatus: vi.fn(), sleep: async () => {} });
    await link.open();
    cb!.onmessage({ sessionResumptionUpdate: { resumable: true, newHandle: "h1" } } as LiveServerMessage);
    cb!.onmessage({ goAway: { timeLeft: "5s" } } as LiveServerMessage);
    await vi.waitFor(() => expect(link.status).toBe("open"));
    expect(calls).toEqual([undefined, "h1"]);
  });

  it("asks for fresh credentials after the first retry and gives up as lost", async () => {
    let n = 0;
    const connect: Connect = async () => {
      if (n++ === 0) return fakeSession();
      throw new Error("refused");
    };
    const fresh = vi.fn().mockResolvedValue({ token: "t2", model: "m", config: {} });
    const link = new LiveLink({ token: "t", model: "m", config: {} }, { connect, freshCredentials: fresh, onMessage: vi.fn(), onStatus: vi.fn(), sleep: async () => {} });
    await link.open();
    expect(await link.reconnect()).toBe(false);
    expect(link.status).toBe("lost");
    expect(fresh).toHaveBeenCalledTimes(MAX_TRIES - 1);
  });
});
