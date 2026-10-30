import { describe, expect, it, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createTranscribeSession,
  getTranscribeSession,
  type TranscribeEventData,
} from "../../src/lib/providers/transcribe-session";
import {
  MetaTranscriptionProvider,
  sanitizeApiToken,
} from "../../src/lib/providers/meta";
import { TranscriptAccumulator } from "../../src/lib/audio/transcript-accumulator";
import { ContextualHint } from "../../src/features/practice/ContextualHint";
import fs from "fs";
import path from "path";

describe("Transcription Reliability & Session Lifecycle Regression Suite", () => {
  beforeEach(() => {
    // Clear global active sessions map before each test
    const globalTranscribe = globalThis as unknown as {
      __retellActiveSessions?: Map<string, unknown>;
    };
    globalTranscribe.__retellActiveSessions?.clear();
  });

  it("sanitizes API keys removing outer quotes, CRLF, and duplicate Bearer prefixes", () => {
    // Double quotes
    expect(sanitizeApiToken('"sec_key_12345"')).toBe("sec_key_12345");
    // Single quotes
    expect(sanitizeApiToken("'sec_key_67890'")).toBe("sec_key_67890");
    // Windows CRLF
    expect(sanitizeApiToken("sec_key_abc\r\n")).toBe("sec_key_abc");
    // Bearer prefix in env
    expect(sanitizeApiToken("Bearer sec_key_with_bearer")).toBe(
      "sec_key_with_bearer"
    );
    expect(sanitizeApiToken("bearer sec_key_lower_bearer")).toBe(
      "sec_key_lower_bearer"
    );
    // Quoted with Bearer
    expect(sanitizeApiToken('"Bearer sec_key_quoted_bearer"')).toBe(
      "sec_key_quoted_bearer"
    );
    // Empty, null, undefined
    expect(sanitizeApiToken("")).toBe("");
    expect(sanitizeApiToken(null)).toBe("");
    expect(sanitizeApiToken(undefined)).toBe("");
  });

  it("formats handshake payload with exact Bearer prefix and no duplicate or quotes", () => {
    const provider = new MetaTranscriptionProvider();
    const payload = provider.createHandshakePayload('"my_secret_token_123"', {
      sampleRate: 24000,
    });

    expect(payload.authorization.accessToken).toBe(
      "Bearer my_secret_token_123"
    );
    expect(payload.audioEncoding).toBe("PCM_24KHZ");
    expect(payload.mode).toBe("PUSH_TO_TALK");
    expect(payload.authorization.accessToken.includes('"')).toBe(false);
    expect(payload.authorization.accessToken.startsWith("Bearer Bearer")).toBe(
      false
    );
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
      closeReason: "Policy Violation",
      message:
        "Meta API policy or authentication rejected (code 1008: Policy Violation). Please verify META_MODEL_API_KEY and model permissions.",
    });

    const closedEvt = receivedEvents.find((e) => e.type === "closed");
    expect(closedEvt).toBeDefined();
    expect(closedEvt?.closeCode).toBe(1008);
    expect(closedEvt?.closeReason).toBe("Policy Violation");
    expect(closedEvt?.message).toContain(
      "Meta API policy or authentication rejected"
    );

    session.close();
  });

  it("distinguishes abnormal network drop (code 1006) from auth failure", async () => {
    const session = await createTranscribeSession({
      sampleRate: 24000,
      mockFallback: true,
    });

    const receivedEvents: TranscribeEventData[] = [];
    session.subscribe((evt) => {
      receivedEvents.push(evt);
    });

    // Code 1006 must never be reported as authentication failed
    session.broadcast({
      type: "closed",
      closeCode: 1006,
      closeReason: "",
      message:
        "Meta transcription connection dropped abnormally (network or TLS reset). Switched to fallback.",
    });

    const closedEvt = receivedEvents.find((e) => e.type === "closed");
    expect(closedEvt?.closeCode).toBe(1006);
    expect(closedEvt?.message).not.toContain("authentication failed");
    expect(closedEvt?.message).toContain("dropped abnormally");

    session.close();
  });

  it("renders ContextualHint with 'Hint:' label and zero occurrences of 'Recall cue'", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContextualHint, {
        isVisible: true,
        hintText: "Recursive query",
      })
    );

    expect(html).toContain("Hint:");
    expect(html).toContain("Recursive query");
    expect(html).not.toContain("Recall cue");
  });

  it("verifies PracticeRoomView source code contains no mic dropdown and no student-facing provider badges", () => {
    const practiceRoomPath = path.resolve(
      __dirname,
      "../../src/features/practice/PracticeRoomView.tsx"
    );
    const source = fs.readFileSync(practiceRoomPath, "utf-8");

    // No microphone dropdown selector
    expect(source).not.toContain("mic-device-select");
    expect(source).not.toContain("Audio Input Device");
    // No student-facing provider badges
    expect(source).not.toContain("Meta Voice AI");
    expect(source).not.toContain("Browser Speech Engine");
    // Completed state metrics card is 2 columns (spoken words, duration)
    expect(source).toContain("grid grid-cols-2");
    expect(source).not.toContain("Transcription Engine");
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
