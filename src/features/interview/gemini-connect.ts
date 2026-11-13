import { GoogleGenAI } from "@google/genai";
import type { Connect } from "./live-link";

/**
 * Opens a Gemini Live session with the server-minted ephemeral token (passed as the API key, v1beta).
 * `config` comes from our API (POST /interview/session -> client_config): transcription, compression,
 * resumption and the answer-box tool. It never contains the interviewer prompt; that is locked in the token.
 */
export const geminiConnect: Connect = async (creds, handle, callbacks) => {
  const ai = new GoogleGenAI({ apiKey: creds.token, httpOptions: { apiVersion: "v1beta" } });
  const config = { ...creds.config, sessionResumption: handle ? { handle } : {} };
  return ai.live.connect({
    model: creds.model,
    config,
    callbacks: {
      onmessage: callbacks.onmessage,
      onclose: (e: CloseEvent) => callbacks.onclose({ code: e.code, reason: e.reason }),
      onerror: (e: ErrorEvent) => callbacks.onerror(e),
    },
  });
};
