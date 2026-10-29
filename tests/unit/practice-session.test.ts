import { describe, expect, it, beforeEach } from "vitest";
import {
  calculateWordCount,
  createAttemptId,
  PracticeAttemptSchema,
  PracticeSessionStateSchema,
} from "../../src/lib/domain/practice-session";
import { calculateRms, floatTo16BitPCM } from "../../src/lib/audio/capture";
import {
  clearAllPracticeAttempts,
  getPracticeAttempt,
  listPracticeAttempts,
  savePracticeAttempt,
} from "../../src/lib/storage/study-store";
import {
  createTranscribeSession,
  getTranscribeSession,
} from "../../src/lib/providers/transcribe-session";

describe("Practice Session Domain & Word Counting", () => {
  it("validates session state machine states", () => {
    const validStates = [
      "idle",
      "requesting_permission",
      "connecting",
      "listening",
      "finishing",
      "completed",
      "error",
    ];

    for (const state of validStates) {
      expect(PracticeSessionStateSchema.safeParse(state).success).toBe(true);
    }

    expect(PracticeSessionStateSchema.safeParse("recording").success).toBe(
      false
    );
  });

  it("calculates word count accurately across spaces and punctuation", () => {
    expect(calculateWordCount("")).toBe(0);
    expect(calculateWordCount("   ")).toBe(0);
    expect(calculateWordCount("Hello")).toBe(1);
    expect(
      calculateWordCount("First In First Out page replacement algorithm.")
    ).toBe(7);
    expect(
      calculateWordCount("  Multiple   spaces \n and \t newlines!  ")
    ).toBe(4);
  });

  it("generates unique attempt IDs with valid prefix", () => {
    const id1 = createAttemptId();
    const id2 = createAttemptId();
    expect(id1).toMatch(/^attempt_\d+_[a-z0-9]+$/);
    expect(id2).toMatch(/^attempt_\d+_[a-z0-9]+$/);
    expect(id1).not.toBe(id2);
  });

  it("validates practice attempt records with strict Zod schema", () => {
    const valid = {
      id: "attempt_123",
      studySetId: "set_abc",
      questionId: "q_456",
      transcript: "This is what I explained aloud.",
      wordCount: 6,
      durationSeconds: 15,
      status: "completed" as const,
      createdAt: new Date().toISOString(),
    };

    const parsed = PracticeAttemptSchema.safeParse(valid);
    expect(parsed.success).toBe(true);

    const invalid = {
      id: "",
      studySetId: "",
      questionId: "",
    };
    expect(PracticeAttemptSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("Audio Capture & Resampling Math", () => {
  it("converts Float32 audio samples to 16-bit signed PCM", () => {
    const input = new Float32Array([0, 1.0, -1.0, 0.5, -0.5, 2.0, -2.0]);
    const pcm16 = floatTo16BitPCM(input);

    expect(pcm16.length).toBe(input.length);
    expect(pcm16[0]).toBe(0);
    expect(pcm16[1]).toBe(32767); // Max positive signed 16-bit
    expect(pcm16[2]).toBe(-32768); // Min negative signed 16-bit
    expect(pcm16[3]).toBe(16383); // ~0.5 * 32767
    expect(pcm16[4]).toBe(-16384); // ~ -0.5 * 32768
    // Clipped values:
    expect(pcm16[5]).toBe(32767);
    expect(pcm16[6]).toBe(-32768);
  });

  it("computes RMS energy correctly for silence and active audio", () => {
    const silent = new Float32Array([0, 0, 0, 0]);
    expect(calculateRms(silent)).toBe(0);

    const uniform = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    expect(calculateRms(uniform)).toBeCloseTo(0.5, 5);

    const empty = new Float32Array([]);
    expect(calculateRms(empty)).toBe(0);
  });
});

describe("Server-Side Transcribe Relay Session Lifecycle", () => {
  it("initializes a transcribe session and receives events", async () => {
    const session = await createTranscribeSession({
      sampleRate: 24000,
      mockFallback: true,
    });

    expect(session.id).toMatch(/^trans_\d+_/);
    expect(session.isClosed).toBe(false);

    // Retrieve via global map
    const retrieved = getTranscribeSession(session.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(session.id);

    // Subscribe to events
    const receivedEvents: unknown[] = [];
    const unsubscribe = session.subscribe((evt) => {
      receivedEvents.push(evt);
    });

    // Send 3840 bytes of mock audio (80ms at 24kHz 16-bit mono)
    const mockAudioChunk = new Uint8Array(3840);
    session.sendAudio(mockAudioChunk);

    expect(session.audioProcessedMs).toBeGreaterThan(0);
    expect(receivedEvents).toContainEqual(
      expect.objectContaining({
        type: "audioProgress",
      })
    );

    // Finish session
    const finalWords = await session.finish();
    expect(finalWords).toBeDefined();
    expect(session.isClosed).toBe(true);

    unsubscribe();
    session.close();
  });
});

describe("Practice Attempt Local Persistence", () => {
  beforeEach(async () => {
    await clearAllPracticeAttempts();
  });

  it("stores and retrieves attempts associated with specific study sets", async () => {
    const now = new Date().toISOString();
    await savePracticeAttempt({
      id: "attempt_fifo_1",
      studySetId: "set_os_fifo",
      questionId: "q_belady",
      transcript:
        "Belady's anomaly occurs when increasing the number of page frames results in more page faults.",
      wordCount: 15,
      durationSeconds: 18,
      status: "completed",
      createdAt: now,
    });

    const saved = await getPracticeAttempt("attempt_fifo_1");
    expect(saved).not.toBeNull();
    expect(saved?.transcript).toContain("Belady's anomaly");
    expect(saved?.wordCount).toBe(15);

    const allAttempts = await listPracticeAttempts("set_os_fifo");
    expect(allAttempts).toHaveLength(1);
    expect(allAttempts[0]!.id).toBe("attempt_fifo_1");
  });
});
