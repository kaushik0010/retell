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
  private speechRecognition: SpeechRecognitionLike | null = null;
  private isMockRelay = false;

  constructor(callbacks: TranscribeClientCallbacks) {
    this.callbacks = callbacks;
  }

  public async start(): Promise<string> {
    this.isFinishing = false;
    this.isClosed = false;
    this.accumulatedFinalTranscript = "";
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

      if (!this.sessionId) {
        throw new Error("Missing session ID from server");
      }

      // 2. Open Server-Sent Events stream
      this.eventSource = new EventSource(
        `/api/transcribe/stream?sessionId=${encodeURIComponent(this.sessionId)}`
      );

      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "transcript") {
            if (payload.final) {
              this.accumulatedFinalTranscript = payload.transcript || "";
              this.callbacks.onTranscriptDelta(
                this.accumulatedFinalTranscript,
                true
              );
            } else {
              this.callbacks.onTranscriptDelta(payload.transcript || "", false);
            }
          } else if (payload.type === "audioProgress") {
            this.callbacks.onAudioProgress?.(payload.audioProcessedMs || 0);
          } else if (payload.type === "error") {
            this.callbacks.onError?.(payload.message || "Transcription error");
          } else if (payload.type === "closed") {
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

  private initBrowserSpeechFallback() {
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

          this.accumulatedFinalTranscript = finalText;

          if (interimText) {
            this.callbacks.onTranscriptDelta(
              (finalText ? `${finalText} ` : "") + interimText,
              false
            );
          } else if (finalText) {
            this.callbacks.onTranscriptDelta(finalText, true);
          }
        };

        recognition.onerror = (err) => {
          console.warn("Browser SpeechRecognition fallback notice:", err);
        };

        recognition.start();
        this.speechRecognition = recognition;
      }
    } catch (err) {
      console.warn("Could not start browser speech recognition fallback:", err);
    }
  }

  public async sendAudioChunk(chunk: Uint8Array): Promise<void> {
    if (!this.sessionId || this.isClosed || this.isFinishing) return;

    try {
      await fetch(
        `/api/transcribe/audio?sessionId=${encodeURIComponent(this.sessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: chunk as unknown as BodyInit,
        }
      );
    } catch (err) {
      console.error("Audio chunk upload error:", err);
    }
  }

  public async finish(): Promise<string> {
    if (this.isClosed) return this.accumulatedFinalTranscript;
    this.isFinishing = true;
    this.callbacks.onStateChange?.("finishing");

    // Stop browser speech recognition if active
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {}
      this.speechRecognition = null;
    }

    if (!this.sessionId) {
      this.close();
      return this.accumulatedFinalTranscript;
    }

    try {
      const res = await fetch(
        `/api/transcribe/finish?sessionId=${encodeURIComponent(this.sessionId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.finalTranscript && data.finalTranscript.trim().length > 0) {
          this.accumulatedFinalTranscript = data.finalTranscript.trim();
        }
      }
    } catch (err) {
      console.warn("Error finalizing transcribe session on server:", err);
    }

    this.close();
    return this.accumulatedFinalTranscript;
  }

  public close(): void {
    this.isClosed = true;
    this.isFinishing = false;

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
