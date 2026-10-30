import { describe, expect, it, beforeEach } from "vitest";
import {
  createTranscribeSession,
  getTranscribeSession,
  type TranscribeEventData,
} from "../../src/lib/providers/transcribe-session";
import { TranscriptAccumulator } from "../../src/lib/audio/transcript-accumulator";

describe("Transcription Reliability & Session Lifecycle Regression Suite", () => {
  beforeEach(() => {
    // Clear global active sessions map before each test
    const globalTranscribe = globalThis as unknown as {
      __retellActiveSessions?: Map<string, unknown>;
    };
    globalTranscribe.__retellActiveSessions?.clear();
  });

  it("registers and retrieves session via globalThis singleton across routes", async () => {
    const session = await createTranscribeSession({
      sampleRate: 24000,
      mockFallback: true,
    });

    expect(session.id).toBeDefined();
    expect(session.isMock).toBe(true);
    expect(session.provider).toBe("browser_fallback");

    // Must be retrievable via getTranscribeSession
    const retrieved = getTranscribeSession(session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(session.id);
    expect(retrieved?.provider).toBe("browser_fallback");

    session.close();
  });

  it("handles missing or expired sessions with null response", () => {
    const nonExistent = getTranscribeSession("trans_non_existent_id");
    expect(nonExistent).toBeNull();

    const empty = getTranscribeSession("");
    expect(empty).toBeNull();

    const nullId = getTranscribeSession(null);
    expect(nullId).toBeNull();
  });

  it("ensures session close removes the session from the global registry", async () => {
    const session = await createTranscribeSession({
      sampleRate: 24000,
      mockFallback: true,
    });

    expect(getTranscribeSession(session.id)).not.toBeNull();

    session.close();
    expect(getTranscribeSession(session.id)).toBeNull();
  });

  it("broadcasts structured close events with closeCode and message", async () => {
    const session = await createTranscribeSession({
      sampleRate: 24000,
      mockFallback: true,
    });

    const receivedEvents: TranscribeEventData[] = [];
    session.subscribe((evt) => {
      receivedEvents.push(evt);
    });

    session.broadcast({
      type: "closed",
      closeCode: 1008,
      closeReason: "Unauthorized",
      message:
        "Meta API authentication failed. Please verify your META_MODEL_API_KEY.",
    });

    const closedEvt = receivedEvents.find((e) => e.type === "closed");
    expect(closedEvt).toBeDefined();
    expect(closedEvt?.closeCode).toBe(1008);
    expect(closedEvt?.closeReason).toBe("Unauthorized");
    expect(closedEvt?.message).toContain("Meta API authentication failed");

    session.close();
  });

  it("processes audio chunks and computes audioProcessedMs accurately", async () => {
    const session = await createTranscribeSession({
      sampleRate: 24000,
      mockFallback: true,
    });

    expect(session.audioProcessedMs).toBe(0);

    // 80ms at 24kHz 16-bit mono = 3,840 bytes
    const chunk80ms = new Uint8Array(3840);
    session.sendAudio(chunk80ms);
    expect(session.audioProcessedMs).toBe(80);

    // Second chunk
    session.sendAudio(chunk80ms);
    expect(session.audioProcessedMs).toBe(160);

    session.close();
  });

  it("preserves transcript during mid-stream provider transitions", () => {
    const accumulator = new TranscriptAccumulator();

    // 1. Initial speech recognized via Meta relay
    accumulator.update("A process is an isolated execution environment", true);
    expect(accumulator.finalizedText).toBe(
      "A process is an isolated execution environment"
    );

    // 2. Network hiccups, Meta connection drops, and browser speech recognition takes over
    // Browser SpeechRecognition receives interim words for the continuation
    accumulator.update(
      "A process is an isolated execution environment with dedicated virtual memory",
      false
    );
    expect(accumulator.interimText).toBe("with dedicated virtual memory");

    // 3. Browser speech recognition finalizes that phrase
    accumulator.update(
      "A process is an isolated execution environment with dedicated virtual memory",
      true
    );
    expect(accumulator.finalizedText).toBe(
      "A process is an isolated execution environment with dedicated virtual memory"
    );
    expect(accumulator.interimText).toBe("");

    // 4. Student finishes immediately with a trailing phrase in progress
    accumulator.update("which prevents memory corruption", false);
    const result = accumulator.finalize();

    expect(result).toBe(
      "A process is an isolated execution environment with dedicated virtual memory which prevents memory corruption"
    );
  });

  it("batches and merges audio chunks without data corruption", () => {
    // Simulate chunk queueing logic
    const chunk1 = new Uint8Array([1, 2, 3, 4]);
    const chunk2 = new Uint8Array([5, 6, 7, 8]);
    const chunk3 = new Uint8Array([9, 10]);

    const queue = [chunk1, chunk2, chunk3];
    const totalLength = queue.reduce((acc, c) => acc + c.byteLength, 0);
    expect(totalLength).toBe(10);

    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of queue) {
      merged.set(c, offset);
      offset += c.byteLength;
    }

    expect(Array.from(merged)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("identifies Bluetooth headsets and audio devices accurately", () => {
    const testLabels = [
      { label: "Microphone Array (Realtek Audio)", isBluetooth: false },
      { label: "Galaxy Buds2 Pro Hands-Free AG Audio", isBluetooth: true },
      { label: "AirPods Pro", isBluetooth: true },
      { label: "WH-1000XM4 Headset", isBluetooth: true },
      { label: "USB Condenser Microphone", isBluetooth: false },
      { label: "Wireless Audio Headset", isBluetooth: true },
    ];

    const isBluetoothRegex =
      /bluetooth|hands-free|airpods|buds|wireless|headset/i;

    for (const item of testLabels) {
      const detected = isBluetoothRegex.test(item.label);
      expect(detected).toBe(item.isBluetooth);
    }
  });

  it("handles conversational pauses and simulated SpeechRecognition restart", () => {
    let running = false;
    let restartCount = 0;

    const mockRecognition = {
      start: () => {
        if (running) throw new Error("Already running");
        running = true;
      },
      stop: () => {
        running = false;
      },
      simulatePauseOnEnd: () => {
        running = false;
        // Auto-restart on end
        if (!running) {
          restartCount++;
          mockRecognition.start();
        }
      },
    };

    mockRecognition.start();
    expect(running).toBe(true);

    // Student pauses for 4 seconds -> browser fires onend
    mockRecognition.simulatePauseOnEnd();
    expect(running).toBe(true);
    expect(restartCount).toBe(1);

    // Student pauses again -> auto-restarts again
    mockRecognition.simulatePauseOnEnd();
    expect(running).toBe(true);
    expect(restartCount).toBe(2);

    mockRecognition.stop();
    expect(running).toBe(false);
  });
});
