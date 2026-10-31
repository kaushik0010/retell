import "server-only";

import { MetaTranscriptionProvider, sanitizeApiToken } from "./meta";
import type { MetaServerEvent } from "./types";

export interface TranscribeEventData {
  type: "connected" | "audioProgress" | "transcript" | "error" | "closed";
  sessionId?: string;
  transcript?: string;
  final?: boolean;
  audioProcessedMs?: number;
  message?: string;
  provider?: "meta_voice" | "browser_fallback";
  closeCode?: number;
  closeReason?: string;
}

export type TranscribeEventListener = (event: TranscribeEventData) => void;

export interface TranscribeSession {
  id: string;
  metaSessionId: string | null;
  ws: WebSocket | null;
  isMock: boolean;
  provider: "meta_voice" | "browser_fallback";
  isClosed: boolean;
  finalTranscript: string;
  interimTranscript: string;
  audioProcessedMs: number;
  createdAt: number;
  lastActivityAt: number;
  listeners: Set<TranscribeEventListener>;
  subscribe: (listener: TranscribeEventListener) => () => void;
  broadcast: (event: TranscribeEventData) => void;
  sendAudio: (chunk: Uint8Array | ArrayBuffer) => void;
  finish: () => Promise<string>;
  close: () => void;
}

// Global active sessions map attached to globalThis to ensure a single shared registry
// across all Next.js App Router route handlers (/api/transcribe/session, stream, audio, finish)
const globalTranscribe = globalThis as unknown as {
  __retellActiveSessions?: Map<string, TranscribeSession>;
  __retellCleanupIntervalStarted?: boolean;
};

if (!globalTranscribe.__retellActiveSessions) {
  globalTranscribe.__retellActiveSessions = new Map<
    string,
    TranscribeSession
  >();
}

const activeSessions: Map<string, TranscribeSession> =
  globalTranscribe.__retellActiveSessions;

// Periodically clean up expired sessions (> 15 minutes of inactivity)
if (
  !globalTranscribe.__retellCleanupIntervalStarted &&
  typeof setInterval !== "undefined"
) {
  globalTranscribe.__retellCleanupIntervalStarted = true;
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of activeSessions.entries()) {
      if (now - session.lastActivityAt > 15 * 60 * 1000) {
        session.close();
        activeSessions.delete(id);
      }
    }
  }, 60 * 1000).unref?.();
}

export function getTranscribeSession(
  id: string | null
): TranscribeSession | null {
  if (!id) return null;
  return activeSessions.get(id) || null;
}

export async function createTranscribeSession(options?: {
  sampleRate?: number;
  languageBias?: string[];
  mockFallback?: boolean;
}): Promise<TranscribeSession> {
  const sessionId = `trans_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const listeners = new Set<TranscribeEventListener>();

  const broadcast = (event: TranscribeEventData) => {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("Transcribe listener broadcast error:", err);
      }
    }
  };

  const subscribe = (listener: TranscribeEventListener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const provider = new MetaTranscriptionProvider();
  const apiKey = sanitizeApiToken(process.env.META_MODEL_API_KEY);
  const hasValidApiKey = Boolean(apiKey && apiKey.length > 0);

  // If no API key or explicitly mockFallback without API key, run graceful fallback session
  if (!hasValidApiKey || options?.mockFallback) {
    console.info(
      `[TranscribeSession] Initializing fallback session for ${sessionId} (hasValidApiKey=${hasValidApiKey}, mockFallback=${Boolean(options?.mockFallback)})`
    );
    const session = createMockFallbackSession(
      sessionId,
      listeners,
      broadcast,
      subscribe
    );
    activeSessions.set(sessionId, session);
    return session;
  }

  // Live Meta WebSocket connection
  return new Promise<TranscribeSession>((resolve) => {
    let resolved = false;
    let ws: WebSocket;
    let audioBytesReceived = 0;
    let audioBytesForwarded = 0;
    let audioFramesForwarded = 0;
    const sessionStartTime = Date.now();
    const FRAME_SIZE = 3840; // 80ms frame at 24kHz 16-bit mono PCM (24000 samples/s * 2 bytes/sample * 0.08s)

    try {
      ws = new WebSocket(provider.endpoint);
    } catch (err) {
      console.warn(
        "[TranscribeSession] Could not instantiate Meta WebSocket:",
        err
      );
      // Gracefully fall back to local session so the student can still practice
      const fallbackSession = createMockFallbackSession(
        sessionId,
        listeners,
        broadcast,
        subscribe
      );
      activeSessions.set(sessionId, fallbackSession);
      resolve(fallbackSession);
      return;
    }

    // 9-second timeout matching Meta's 10-second initial handshake allowance
    const connectionTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(
          `[TranscribeSession] Meta WebSocket handshake timed out after 9000ms for session ${sessionId}. Activating browser speech fallback.`
        );
        // Safely detach all listeners and close the timed out websocket so its
        // onclose never interferes with the fallback session or deletes it
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {}

        const fallbackSession = createMockFallbackSession(
          sessionId,
          listeners,
          broadcast,
          subscribe
        );
        activeSessions.set(sessionId, fallbackSession);
        resolve(fallbackSession);
      }
    }, 9000);

    const session: TranscribeSession = {
      id: sessionId,
      metaSessionId: null,
      ws,
      isMock: false,
      provider: "meta_voice",
      isClosed: false,
      finalTranscript: "",
      interimTranscript: "",
      audioProcessedMs: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      listeners,
      subscribe,
      broadcast,
      sendAudio: (chunk) => {
        session.lastActivityAt = Date.now();
        const bytes =
          chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
        audioBytesReceived += bytes.byteLength;

        if (ws.readyState === WebSocket.OPEN) {
          try {
            if (bytes.byteLength <= FRAME_SIZE) {
              ws.send(bytes);
              audioBytesForwarded += bytes.byteLength;
              audioFramesForwarded += 1;
            } else {
              let offset = 0;
              while (offset < bytes.byteLength) {
                const end = Math.min(offset + FRAME_SIZE, bytes.byteLength);
                const slice = bytes.subarray(offset, end);
                ws.send(slice);
                audioBytesForwarded += slice.byteLength;
                audioFramesForwarded += 1;
                offset = end;
              }
            }
          } catch (err) {
            console.error(
              "[TranscribeSession] Failed to send audio chunk to Meta WS:",
              err
            );
          }
        }
      },
      finish: async () => {
        session.lastActivityAt = Date.now();
        return new Promise<string>((res) => {
          if (ws.readyState === WebSocket.OPEN) {
            const endStreamMsg = provider.createEndStreamMessage();
            try {
              ws.send(endStreamMsg);
            } catch {}

            // Wait up to 3s for final transcript, then resolve with whatever we have
            const finishTimeout = setTimeout(() => {
              session.isClosed = true;
              broadcast({ type: "closed", closeCode: 1000 });
              try {
                ws.close(1000, "End of practice attempt");
              } catch {}
              const output =
                session.finalTranscript.trim() ||
                session.interimTranscript.trim();
              session.finalTranscript = output;
              res(output);
            }, 3000);

            const origBroadcast = session.broadcast;
            session.broadcast = (evt) => {
              origBroadcast(evt);
              if (evt.type === "transcript" && evt.final) {
                clearTimeout(finishTimeout);
                session.isClosed = true;
                const output =
                  session.finalTranscript.trim() ||
                  session.interimTranscript.trim();
                session.finalTranscript = output;
                res(output);
              }
            };
          } else {
            session.isClosed = true;
            broadcast({ type: "closed", closeCode: 1000 });
            const output =
              session.finalTranscript.trim() ||
              session.interimTranscript.trim();
            session.finalTranscript = output;
            res(output);
          }
        });
      },
      close: () => {
        session.isClosed = true;
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          if (
            ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING
          ) {
            ws.close(1000, "Client closed");
          }
        } catch {}
        broadcast({ type: "closed", closeCode: 1000 });
        if (activeSessions.get(sessionId) === session) {
          activeSessions.delete(sessionId);
        }
      },
    };

    ws.onopen = () => {
      console.info(
        `[TranscribeSession] WebSocket connected to Meta endpoint (${provider.endpoint}) for session ${sessionId}. Sending initial handshake...`
      );
      const handshake = provider.createHandshakePayload(apiKey, {
        sampleRate: options?.sampleRate || 24000,
        languageBias: options?.languageBias,
        mode: "PUSH_TO_TALK",
      });
      try {
        ws.send(JSON.stringify(handshake));
      } catch (err) {
        console.error(
          "[TranscribeSession] Failed to send Meta handshake:",
          err
        );
      }
    };

    ws.onmessage = (event) => {
      session.lastActivityAt = Date.now();
      const raw = String(event.data);
      const parsed = provider.parseServerMessage(raw) as MetaServerEvent | null;
      if (!parsed) return;

      // Initial Handshake Ack
      if ("sessionId" in parsed && typeof parsed.sessionId === "string") {
        session.metaSessionId = parsed.sessionId;
        console.info(
          `[TranscribeSession] Meta handshake acknowledged. metaSessionId=${parsed.sessionId} for session ${sessionId}`
        );
        if (!resolved) {
          resolved = true;
          clearTimeout(connectionTimer);
          activeSessions.set(sessionId, session);
          resolve(session);
        }
        broadcast({
          type: "connected",
          sessionId,
          provider: "meta_voice",
        });
        return;
      }

      if ("type" in parsed && typeof parsed.type === "string") {
        // Audio Progress
        if (parsed.type === "audioProgress") {
          const audioProgress = parsed as { audioProcessedMs: number };
          session.audioProcessedMs = audioProgress.audioProcessedMs;
          broadcast({
            type: "audioProgress",
            audioProcessedMs: audioProgress.audioProcessedMs,
          });
          return;
        }

        // Transcript Delta
        if (parsed.type === "transcript") {
          const transcriptEvt = parsed as {
            transcript: string;
            final: boolean;
          };
          if (transcriptEvt.final) {
            const trimmed = (transcriptEvt.transcript || "").trim();
            if (trimmed) {
              if (!session.finalTranscript) {
                session.finalTranscript = trimmed;
              } else if (trimmed.startsWith(session.finalTranscript)) {
                session.finalTranscript = trimmed;
              } else if (!session.finalTranscript.includes(trimmed)) {
                session.finalTranscript =
                  `${session.finalTranscript} ${trimmed}`.trim();
              }
            }
            session.interimTranscript = "";
            broadcast({
              type: "transcript",
              transcript: session.finalTranscript,
              final: true,
            });
          } else {
            session.interimTranscript = transcriptEvt.transcript;
            broadcast({
              type: "transcript",
              transcript: transcriptEvt.transcript,
              final: false,
            });
          }
          return;
        }

        // Error Event
        if (parsed.type === "error") {
          const errEvt = parsed as { message?: string };
          console.warn(
            `[TranscribeSession] Meta server emitted error for session ${sessionId}:`,
            errEvt.message
          );
          broadcast({
            type: "error",
            message: errEvt.message || "Meta transcription error",
          });
        }
      }
    };

    ws.onerror = (err) => {
      console.warn(
        `[TranscribeSession] Meta WebSocket error for session ${sessionId}:`,
        err
      );
      if (!resolved) {
        resolved = true;
        clearTimeout(connectionTimer);
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {}
        console.info(
          `[TranscribeSession] Meta WebSocket failed before handshake completed. Falling back to browser speech session.`
        );
        const fallbackSession = createMockFallbackSession(
          sessionId,
          listeners,
          broadcast,
          subscribe
        );
        activeSessions.set(sessionId, fallbackSession);
        resolve(fallbackSession);
      } else {
        broadcast({
          type: "error",
          message: "Voice transcription connection interrupted.",
        });
      }
    };

    ws.onclose = (event: CloseEvent) => {
      session.isClosed = true;
      // Retain session in activeSessions for 60s grace period so late audio uploads
      // and client /api/transcribe/finish requests receive clean responses instead of 404
      setTimeout(() => {
        if (activeSessions.get(sessionId) === session) {
          activeSessions.delete(sessionId);
        }
      }, 60000).unref?.();

      const closeCode = event?.code ?? 1000;
      const closeReason = event?.reason ?? "";
      const elapsedSeconds = Math.max(
        1,
        (Date.now() - sessionStartTime) / 1000
      );
      const ingressRatio = audioBytesForwarded / (48000 * elapsedSeconds);

      console.info(
        `[TranscribeSession] Meta WebSocket closed for session ${sessionId}: code=${closeCode}, reason="${closeReason}", wasClean=${Boolean(event?.wasClean)}, bytesReceived=${audioBytesReceived}, bytesForwarded=${audioBytesForwarded}, frames=${audioFramesForwarded}, elapsed=${elapsedSeconds.toFixed(1)}s, ingressRatio=${ingressRatio.toFixed(2)}x`
      );

      let userMessage = "Voice transcription connection closed.";
      if (closeCode === 1008) {
        // Policy Violation: token invalid, model not authorized, or format issue
        const reasonDetail = closeReason ? `: ${closeReason}` : "";
        userMessage = `Meta API policy or authentication rejected (code 1008${reasonDetail}). Please verify META_MODEL_API_KEY and model permissions.`;
        console.warn(
          `[TranscribeSession] Meta returned Policy Violation (code 1008${reasonDetail}). Key configured: ${hasValidApiKey ? "YES" : "NO"}`
        );
      } else if (closeCode === 1006) {
        userMessage =
          "Meta transcription connection dropped abnormally (network or TLS reset). Switched to fallback.";
        console.warn(
          `[TranscribeSession] Meta abnormal closure (code 1006). Switched to browser speech fallback.`
        );
      } else if (closeCode === 1013) {
        userMessage =
          "Meta API rate limit reached or server busy (code 1013). Switched to fallback.";
      } else if (closeCode === 1011) {
        const reasonDetail = closeReason ? `: ${closeReason}` : "";
        userMessage = `Meta Voice server error (code 1011${reasonDetail}). Switched to fallback.`;
      }

      broadcast({
        type: "closed",
        closeCode,
        closeReason,
        message: userMessage,
      });
    };
  });
}

function createMockFallbackSession(
  sessionId: string,
  listeners: Set<TranscribeEventListener>,
  broadcast: (event: TranscribeEventData) => void,
  subscribe: (listener: TranscribeEventListener) => () => void
): TranscribeSession {
  const session: TranscribeSession = {
    id: sessionId,
    metaSessionId: `local_relay_${sessionId}`,
    ws: null,
    isMock: true,
    provider: "browser_fallback",
    isClosed: false,
    finalTranscript: "",
    interimTranscript: "",
    audioProcessedMs: 0,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    listeners,
    subscribe,
    broadcast,
    sendAudio: (chunk) => {
      session.lastActivityAt = Date.now();
      const chunkMs = Math.round((chunk.byteLength / 48000) * 1000);
      session.audioProcessedMs += chunkMs;

      broadcast({
        type: "audioProgress",
        audioProcessedMs: session.audioProcessedMs,
      });
    },
    finish: async () => {
      session.isClosed = true;
      const output =
        session.finalTranscript.trim() || session.interimTranscript.trim();
      session.finalTranscript = output;
      broadcast({
        type: "transcript",
        transcript: output,
        final: true,
      });
      broadcast({ type: "closed", closeCode: 1000 });
      return output;
    },
    close: () => {
      session.isClosed = true;
      broadcast({ type: "closed", closeCode: 1000 });
      if (activeSessions.get(sessionId) === session) {
        activeSessions.delete(sessionId);
      }
    },
  };

  return session;
}
