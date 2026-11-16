import { decodeModelAudio, encodeMicChunk, level, OUT_RATE } from "./pcm";

// One AudioContext (created on the Start click, so the browser allows sound) for both directions:
//   mic -> AudioWorklet -> ~100 ms chunks -> onChunk(base64 PCM16 @16 kHz)
//   model PCM @24 kHz -> scheduled AudioBuffers -> analyser -> speakers
// Loudness of both sides is kept in plain fields the render loop reads every frame (no React re-renders).

const WORKLET = `
class MicTap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("mic-tap", MicTap);
`;

const CHUNK_SECONDS = 0.1;

export class AudioEngine {
  readonly ctx: AudioContext;
  micLevel = 0;
  private outAnalyser: AnalyserNode;
  private outData: Float32Array<ArrayBuffer>;
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private micNode?: AudioWorkletNode;
  private micSource?: MediaStreamAudioSourceNode;
  private pending: Float32Array[] = [];
  private pendingLen = 0;
  private muted = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.outAnalyser = ctx.createAnalyser();
    this.outAnalyser.fftSize = 512;
    this.outData = new Float32Array(this.outAnalyser.fftSize);
    this.outAnalyser.connect(ctx.destination);
  }

  /** Must be called from a click (or after one): creates the context so audio is allowed. */
  static create(): AudioEngine {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    return new AudioEngine(new Ctx({ latencyHint: "interactive" }));
  }

  async startMic(stream: MediaStream, onChunk: (b64: string) => void): Promise<void> {
    if (this.micNode) return;
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    try {
      await this.ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micNode = new AudioWorkletNode(this.ctx, "mic-tap");
    const chunkLen = Math.round(this.ctx.sampleRate * CHUNK_SECONDS);
    this.micNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      this.pending.push(e.data);
      this.pendingLen += e.data.length;
      if (this.pendingLen < chunkLen) return;
      const chunk = new Float32Array(this.pendingLen);
      let o = 0;
      for (const p of this.pending) {
        chunk.set(p, o);
        o += p.length;
      }
      this.pending = [];
      this.pendingLen = 0;
      this.micLevel = this.micLevel * 0.5 + level(chunk) * 0.5;
      if (!this.muted) onChunk(encodeMicChunk(chunk, this.ctx.sampleRate));
    };
    this.micSource.connect(this.micNode);
    // a worklet only runs while connected to the graph; a zero gain keeps the mic out of the speakers
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    this.micNode.connect(sink).connect(this.ctx.destination);
  }

  /** While muted (e.g. reconnecting) mic chunks are dropped, not queued. */
  setMuted(m: boolean) {
    this.muted = m;
    if (m) this.micLevel = 0;
  }

  play(b64: string): void {
    const samples = decodeModelAudio(b64);
    if (!samples.length) return;
    const buf = this.ctx.createBuffer(1, samples.length, OUT_RATE);
    buf.copyToChannel(samples, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.outAnalyser);
    const at = Math.max(this.ctx.currentTime + 0.02, this.nextStart);
    src.start(at);
    this.nextStart = at + buf.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** The model was interrupted (the student started talking): drop everything queued. */
  interrupt(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextStart = 0;
  }

  get playing(): boolean {
    return this.sources.size > 0 && this.nextStart > this.ctx.currentTime;
  }

  /** Seconds of model audio still queued. */
  get queued(): number {
    return Math.max(0, this.nextStart - this.ctx.currentTime);
  }

  /** The AI voice as it plays (for the avatar's lip sync). */
  get output(): AudioNode {
    return this.outAnalyser;
  }

  outLevel(): number {
    if (!this.playing) return 0;
    this.outAnalyser.getFloatTimeDomainData(this.outData);
    return level(this.outData);
  }

  async close(): Promise<void> {
    this.interrupt();
    this.micNode?.port.close();
    this.micNode?.disconnect();
    this.micSource?.disconnect();
    if (this.ctx.state !== "closed") await this.ctx.close().catch(() => {});
  }
}
