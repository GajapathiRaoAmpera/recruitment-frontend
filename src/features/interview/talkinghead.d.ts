// Minimal types for the two untyped avatar packages: only the members the interviewer uses.

declare module "@met4citizen/talkinghead" {
  export class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    opt: { update: ((dt: number) => void) | null } & Record<string, unknown>;
    mtAvatar: Record<string, { newvalue?: number; needsUpdate?: boolean }>;
    showAvatar(avatar: { url: string } & Record<string, unknown>, onprogress?: ((e: ProgressEvent) => void) | null): Promise<void>;
    setMood(mood: string): void;
    playGesture(name: string, dur?: number, mirror?: boolean, ms?: number): void;
    stopGesture(ms?: number): void;
    speakWithHands(delay?: number, prob?: number): void;
    makeEyeContact(ms: number): void;
    lookAhead(ms: number): void;
    start(): void;
    stop(): void;
    dispose(): void;
  }
}

declare module "@met4citizen/headaudio/dist/headaudio.min.mjs" {
  export class HeadAudio extends AudioWorkletNode {
    constructor(ctx: BaseAudioContext, options?: Record<string, unknown>);
    onvalue: ((key: string, value: number) => void) | null;
    loadModel(url: string): Promise<void>;
    update(dt: number): void;
  }
}
