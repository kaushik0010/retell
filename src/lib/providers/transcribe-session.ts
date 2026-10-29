import "server-only";

import { MetaTranscriptionProvider } from "./meta";
import type { MetaServerEvent } from "./types";

export interface TranscribeEventData {
  type: "connected" | "audioProgress" | "transcript" | "error" | "closed";
  sessionId?: string;
  transcript?: string;
  final?: boolean;
  audioProcessedMs?: number;
  message?: string;
}

export type TranscribeEventListener = (event: TranscribeEventData) => void;

export interface TranscribeSession {
  id: string;
  metaSessionId: string | null;
  ws: WebSocket | null;
  isMock: boolean;
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

// Global active sessions map (retained in server process memory)
const activeSessions = new Map<string, TranscribeSession>();

// Periodically clean up expired sessions (> 15 minutes of inactivity)
if (typeof setInterval !== "undefined") {
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
  const apiKey = process.env.META_MODEL_API_KEY?.trim();
  const hasValidApiKey = Boolean(apiKey && apiKey.length > 0);

  // If no API key or explicitly mockFallback without API key, run graceful fallback session
  if (!hasValidApiKey || options?.mockFallback) {
    const session: TranscribeSession = {
      id: sessionId,
      metaSessionId: `mock_meta_${sessionId}`,
      ws: null,
      isMock: true,
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
        const byteLength = chunk.byteLength;
        // In 24kHz 16-bit mono PCM: 2 bytes per sample, 24,000 samples per sec = 48,000 bytes/sec
        // Each 3,840 bytes = 80ms
        const chunkMs = Math.round((byteLength / 48000) * 1000);
        session.audioProcessedMs += chunkMs;

        broadcast({
          type: "audioProgress",
          audioProcessedMs: session.audioProcessedMs,
        });
      },
      finish: async () => {
        session.isClosed = true;
        session.lastActivityAt = Date.now();
        broadcast({
          type: "transcript",
          transcript: session.finalTranscript,
          final: true,
        });
        broadcast({ type: "closed" });
        return session.finalTranscript;
      },
      close: () => {
        session.isClosed = true;
        broadcast({ type: "closed" });
        activeSessions.delete(sessionId);
      },
    };

    activeSessions.set(sessionId, session);
    return session;
  }

  // Live Meta WebSocket connection
  return new Promise<TranscribeSession>((resolve) => {
    let resolved = false;
    let ws: WebSocket;

    try {
      ws = new WebSocket(provider.endpoint);
    } catch (err) {
      console.warn("Could not instantiate Meta WebSocket:", err);
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

    const connectionTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(
          "Meta WebSocket connection timed out; using local fallback"
        );
        const fallbackSession = createMockFallbackSession(
          sessionId,
          listeners,
          broadcast,
          subscribe
        );
        activeSessions.set(sessionId, fallbackSession);
        resolve(fallbackSession);
      }
    }, 4000);

    const session: TranscribeSession = {
      id: sessionId,
      metaSessionId: null,
      ws,
      isMock: false,
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
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(chunk);
          } catch (err) {
            console.error("Failed to send audio chunk to Meta WS:", err);
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
              broadcast({ type: "closed" });
              try {
                ws.close();
              } catch {}
              res(session.finalTranscript);
            }, 3000);

            const origBroadcast = session.broadcast;
            session.broadcast = (evt) => {
              origBroadcast(evt);
              if (evt.type === "transcript" && evt.final) {
                clearTimeout(finishTimeout);
                session.isClosed = true;
                res(session.finalTranscript);
              }
            };
          } else {
            session.isClosed = true;
            broadcast({ type: "closed" });
            res(session.finalTranscript);
          }
        });
      },
      close: () => {
        session.isClosed = true;
        try {
          if (
            ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING
          ) {
            ws.close();
          }
        } catch {}
        broadcast({ type: "closed" });
        activeSessions.delete(sessionId);
      },
    };

    ws.onopen = () => {
      const handshake = provider.createHandshakePayload(apiKey!, {
        sampleRate: options?.sampleRate || 24000,
        languageBias: options?.languageBias,
        mode: "PUSH_TO_TALK",
      });
      try {
        ws.send(JSON.stringify(handshake));
      } catch (err) {
        console.error("Failed to send Meta handshake:", err);
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
        if (!resolved) {
          resolved = true;
          clearTimeout(connectionTimer);
          activeSessions.set(sessionId, session);
          resolve(session);
        }
        broadcast({
          type: "connected",
          sessionId,
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
            session.finalTranscript =
              transcriptEvt.transcript || session.finalTranscript;
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
          broadcast({
            type: "error",
            message: errEvt.message || "Meta transcription error",
          });
        }
      }
    };

    ws.onerror = (err) => {
      console.warn("Meta WebSocket error:", err);
      if (!resolved) {
        resolved = true;
        clearTimeout(connectionTimer);
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

    ws.onclose = () => {
      session.isClosed = true;
      broadcast({ type: "closed" });
      activeSessions.delete(sessionId);
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
      broadcast({
        type: "transcript",
        transcript: session.finalTranscript,
        final: true,
      });
      broadcast({ type: "closed" });
      return session.finalTranscript;
    },
    close: () => {
      session.isClosed = true;
      broadcast({ type: "closed" });
      activeSessions.delete(sessionId);
    },
  };

  return session;
}
