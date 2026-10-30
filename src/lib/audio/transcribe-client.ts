/**
 * Client-Side Transcription Manager
 *
 * Coordinates between browser microphone PCM audio chunks,
 * Server-Sent Events (SSE) streaming from the server relay,
 * and browser SpeechRecognition fallback.
 */

export interface TranscribeClientCallbacks {
  onTranscriptDelta: (text: string, isFinal: boolean) => void;
  onAudioProgress?: (audioProcessedMs: number) => void;
  onProviderChange?: (
    provider: "meta_voice" | "browser_fallback",
    details?: { reason?: string }
  ) => void;
  onError?: (error: string) => void;
  onStateChange?: (
    state: "idle" | "connecting" | "listening" | "finishing" | "closed"
  ) => void;
}

// Browser SpeechRecognition typing interface
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
}

export class TranscribeClient {
  private sessionId: string | null = null;
  private eventSource: EventSource | null = null;
  private callbacks: TranscribeClientCallbacks;
  private isFinishing = false;
  private isClosed = false;
  private accumulatedFinalTranscript = "";
  private latestInterimTranscript = "";
  private speechRecognition: SpeechRecognitionLike | null = null;
  private isMockRelay = false;
  private activeProvider: "meta_voice" | "browser_fallback" | null = null;
  private audioQueue: Uint8Array[] = [];
  private isSendingAudio = false;
  private isRecognitionRunning = false;

  constructor(callbacks: TranscribeClientCallbacks) {
    this.callbacks = callbacks;
  }

  public get provider(): "meta_voice" | "browser_fallback" | null {
    return this.activeProvider;
  }

  public async start(): Promise<string> {
    this.isFinishing = false;
    this.isClosed = false;
    this.accumulatedFinalTranscript = "";
    this.latestInterimTranscript = "";
    this.audioQueue = [];
    this.callbacks.onStateChange?.("connecting");

    try {
      // 1. Initialize session with server relay
      const res = await fetch("/api/transcribe/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleRate: 24000 }),
      });

      if (!res.ok) {
        throw new Error(`Failed to start session (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.sessionId) {
        throw new Error(data.error || "Missing session ID from server");
      }

      this.sessionId = data.sessionId;
      this.isMockRelay = Boolean(data.isMock);
      this.activeProvider = this.isMockRelay
        ? "browser_fallback"
        : "meta_voice";

      this.callbacks.onProviderChange?.(
        this.activeProvider,
        this.isMockRelay
          ? {
              reason:
                "Meta WebSocket unavailable; running browser speech engine",
            }
          : undefined
      );

      if (!this.sessionId) {
        throw new Error("Missing session ID from server");
      }

      // 2. Open Server-Sent Events stream
      this.eventSource = new EventSource(
        `/api/transcribe/stream?sessionId=${encodeURIComponent(this.sessionId)}`
      );

      this.eventSource.onmessage = (event) => {
        if (this.isClosed || this.isFinishing) return;

        try {
          const payload = JSON.parse(event.data);
          if (
            (payload.provider === "meta_voice" ||
              payload.provider === "browser_fallback") &&
            payload.provider !== this.activeProvider
          ) {
            const nextProvider = payload.provider as
              "meta_voice" | "browser_fallback";
            this.activeProvider = nextProvider;
            this.callbacks.onProviderChange?.(nextProvider);
          }

          if (payload.type === "transcript") {
            if (payload.final) {
              this.accumulatedFinalTranscript = payload.transcript || "";
              this.latestInterimTranscript = "";
              this.callbacks.onTranscriptDelta(
                this.accumulatedFinalTranscript,
                true
              );
            } else {
              this.latestInterimTranscript = payload.transcript || "";
              this.callbacks.onTranscriptDelta(
                this.latestInterimTranscript,
                false
              );
            }
          } else if (payload.type === "audioProgress") {
            this.callbacks.onAudioProgress?.(payload.audioProcessedMs || 0);
          } else if (payload.type === "error") {
            console.warn("Server transcribe SSE error event:", payload.message);
            // If live Meta session encountered an error, switch to browser fallback seamlessly
            this.switchToFallback(
              payload.message || "Meta transcription service error"
            );
          } else if (payload.type === "closed") {
            if (payload.closeCode && payload.closeCode !== 1000) {
              this.switchToFallback(
                payload.message ||
                  `Meta connection closed (${payload.closeCode})`
              );
            }
            this.eventSource?.close();
          }
        } catch (err) {
          console.error("SSE parse error:", err);
        }
      };

      this.eventSource.onerror = () => {
        // SSE error or closure
        if (!this.isFinishing && !this.isClosed) {
          console.warn("Transcribe SSE connection dropped");
          // If using Meta relay and SSE dropped, switch smoothly to browser speech fallback
          if (!this.isMockRelay) {
            this.switchToFallback("Server connection dropped");
          }
        }
      };

      // 3. Fallback browser SpeechRecognition if relay is mock or offline
      if (this.isMockRelay && typeof window !== "undefined") {
        this.initBrowserSpeechFallback();
      }

      this.callbacks.onStateChange?.("listening");
      return this.sessionId;
    } catch (err: unknown) {
      this.callbacks.onStateChange?.("closed");
      const message =
        err instanceof Error
          ? err.message
          : "Failed to connect to transcription";
      this.callbacks.onError?.(message);
      throw err;
    }
  }

  /**
   * Switches from live Meta relay to local browser SpeechRecognition seamlessly
   * preserving existing transcripts without data loss.
   */
  private switchToFallback(reason: string) {
    if (this.isMockRelay || this.isClosed || this.isFinishing) return;
    this.isMockRelay = true;
    this.activeProvider = "browser_fallback";
    console.warn(
      `[TranscribeClient] Switching to browser SpeechRecognition: ${reason}`
    );
    this.callbacks.onProviderChange?.("browser_fallback", { reason });
    this.initBrowserSpeechFallback();
  }

  private initBrowserSpeechFallback() {
    if (this.speechRecognition || typeof window === "undefined") return;

    try {
      const windowWithSpeech = window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        SpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const SpeechRecognitionCtor =
        windowWithSpeech.SpeechRecognition ||
        windowWithSpeech.webkitSpeechRecognition;

      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          if (this.isClosed || this.isFinishing) return;

          let interimText = "";
          let finalText = this.accumulatedFinalTranscript;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const item = event.results[i]!;
            const text = item[0]?.transcript || "";
            if (item.isFinal) {
              finalText = (finalText ? `${finalText} ` : "") + text.trim();
            } else {
              interimText += text;
            }
          }

          this.accumulatedFinalTranscript = finalText.trim();
          this.latestInterimTranscript = interimText.trim();

          if (interimText) {
            const combined = (finalText ? `${finalText} ` : "") + interimText;
            this.callbacks.onTranscriptDelta(combined, false);
          } else if (finalText) {
            this.callbacks.onTranscriptDelta(finalText, true);
          }
        };

        recognition.onerror = (err: unknown) => {
          const errObj = err as { error?: string; message?: string };
          const errorType = errObj?.error || "unknown";

          // "no-speech" is normal when student pauses to think; do not treat as fatal error
          if (errorType === "no-speech" || errorType === "aborted") {
            return;
          }

          console.warn("Browser SpeechRecognition notice:", {
            error: errorType,
            message: errObj?.message || "",
            session: this.sessionId,
            activeProvider: this.activeProvider,
          });
        };

        // Auto-restart recognition when browser stops during a conversational pause or silence
        recognition.onend = () => {
          this.isRecognitionRunning = false;
          if (!this.isClosed && !this.isFinishing && this.isMockRelay) {
            try {
              recognition.start();
              this.isRecognitionRunning = true;
            } catch {
              setTimeout(() => {
                if (
                  !this.isClosed &&
                  !this.isFinishing &&
                  this.isMockRelay &&
                  !this.isRecognitionRunning
                ) {
                  try {
                    recognition.start();
                    this.isRecognitionRunning = true;
                  } catch {}
                }
              }, 150);
            }
          }
        };

        try {
          recognition.start();
          this.isRecognitionRunning = true;
        } catch (startErr) {
          console.warn("SpeechRecognition start exception:", startErr);
        }
        this.speechRecognition = recognition;
      }
    } catch (err) {
      console.warn("Could not start browser speech recognition fallback:", err);
    }
  }

  public sendAudioChunk(chunk: Uint8Array): void {
    if (!this.sessionId || this.isClosed || this.isFinishing) return;
    // Skip uploading audio chunks if in browser speech fallback mode
    if (this.isMockRelay) return;

    this.audioQueue.push(chunk);
    this.flushAudioQueue();
  }

  private async flushAudioQueue(): Promise<void> {
    if (
      this.isSendingAudio ||
      this.audioQueue.length === 0 ||
      !this.sessionId ||
      this.isClosed ||
      this.isMockRelay
    ) {
      return;
    }

    this.isSendingAudio = true;
    try {
      const chunksToSend = this.audioQueue.splice(0, this.audioQueue.length);
      const totalLength = chunksToSend.reduce(
        (acc, c) => acc + c.byteLength,
        0
      );
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const c of chunksToSend) {
        merged.set(c, offset);
        offset += c.byteLength;
      }

      const res = await fetch(
        `/api/transcribe/audio?sessionId=${encodeURIComponent(this.sessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: merged as unknown as BodyInit,
        }
      );

      if (!res.ok && res.status === 404) {
        this.switchToFallback("Server audio session expired");
      }
    } catch (err) {
      console.warn("Audio chunk upload error:", err);
    } finally {
      this.isSendingAudio = false;
      if (this.audioQueue.length > 0 && !this.isClosed && !this.isMockRelay) {
        this.flushAudioQueue();
      }
    }
  }

  public async finish(): Promise<string> {
    if (this.isClosed) return this.accumulatedFinalTranscript;
    this.isFinishing = true;
    this.callbacks.onStateChange?.("finishing");

    // Promote any unfinalized in-flight speech before closing
    const inFlight = this.latestInterimTranscript.trim();
    if (inFlight) {
      if (!this.accumulatedFinalTranscript) {
        this.accumulatedFinalTranscript = inFlight;
      } else if (!this.accumulatedFinalTranscript.includes(inFlight)) {
        this.accumulatedFinalTranscript =
          `${this.accumulatedFinalTranscript} ${inFlight}`.trim();
      }
    }

    // Stop browser speech recognition if active
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {}
      this.speechRecognition = null;
      this.isRecognitionRunning = false;
    }

    if (!this.sessionId) {
      this.close();
      return this.accumulatedFinalTranscript;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(
        `/api/transcribe/finish?sessionId=${encodeURIComponent(this.sessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.finalTranscript && data.finalTranscript.trim().length > 0) {
          const serverTrimmed = data.finalTranscript.trim();
          if (serverTrimmed.length >= this.accumulatedFinalTranscript.length) {
            this.accumulatedFinalTranscript = serverTrimmed;
          } else if (!this.accumulatedFinalTranscript.includes(serverTrimmed)) {
            this.accumulatedFinalTranscript =
              `${this.accumulatedFinalTranscript} ${serverTrimmed}`.trim();
          }
        }
      }
    } catch (err) {
      console.warn("Notice finalizing transcribe session on server:", err);
    }

    this.close();
    return this.accumulatedFinalTranscript;
  }

  public close(): void {
    this.isClosed = true;
    this.isFinishing = false;
    this.isRecognitionRunning = false;
    this.audioQueue = [];

    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {}
      this.speechRecognition = null;
    }

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    this.sessionId = null;
    this.callbacks.onStateChange?.("closed");
  }
}
