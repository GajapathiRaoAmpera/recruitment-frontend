// PCM helpers for Gemini Live: mic in as 16-bit PCM at 16 kHz, model audio out as 16-bit PCM at 24 kHz.
// Pure functions (no Web Audio), so they are unit tested.

export const IN_RATE = 16_000;
export const OUT_RATE = 24_000;

/** Average-downsample `input` (at `from` Hz) to `to` Hz. Averaging is a cheap low-pass, enough for speech. */
export function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return input.slice();
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j]!;
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export function floatToPcm16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function pcm16ToFloat(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i]! / (input[i]! < 0 ? 0x8000 : 0x7fff);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const step = 0x8000; // stay under the argument limit of String.fromCharCode
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Mic chunk -> base64 little-endian PCM16 at 16 kHz, ready for sendRealtimeInput. */
export function encodeMicChunk(input: Float32Array, sampleRate: number): string {
  const pcm = floatToPcm16(downsample(input, sampleRate, IN_RATE));
  return bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}

/** Model audio (base64 PCM16 LE) -> float samples for an AudioBuffer at OUT_RATE. */
export function decodeModelAudio(b64: string): Float32Array {
  const bytes = base64ToBytes(b64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pcm = new Int16Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < pcm.length; i++) pcm[i] = view.getInt16(i * 2, true);
  return pcm16ToFloat(pcm);
}

/** Loudness 0..1 (RMS scaled so normal speech sits around 0.3-0.8). */
export function level(samples: Float32Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}
