import { describe, expect, it } from "vitest";
import { TranscriptAccumulator } from "../../src/lib/audio/transcript-accumulator";
import { calculateWordCount } from "../../src/lib/domain/practice-session";

describe("TranscriptAccumulator Regression Test Suite", () => {
  it("preserves speech when student finishes immediately with only interim events", () => {
    const acc = new TranscriptAccumulator();

    // Student speaks, but recognizer only emitted interim/partial events so far
    acc.update("Belady's anomaly occurs in FIFO page replacement", false);

    expect(acc.interimText).toBe(
      "Belady's anomaly occurs in FIFO page replacement"
    );
    expect(acc.finalizedText).toBe("");
    expect(acc.getFullTranscript()).toBe(
      "Belady's anomaly occurs in FIFO page replacement"
    );

    // User clicks "Finish attempt"
    const finalTranscript = acc.finalize();

    expect(finalTranscript).toBe(
      "Belady's anomaly occurs in FIFO page replacement"
    );
    expect(acc.finalizedText).toBe(
      "Belady's anomaly occurs in FIFO page replacement"
    );
    expect(acc.interimText).toBe("");
    expect(acc.isCompleted).toBe(true);

    // Word count must match exact spoken words (7 words)
    expect(calculateWordCount(finalTranscript)).toBe(7);
  });

  it("safely handles multi-part finalized segments without duplication", () => {
    const acc = new TranscriptAccumulator();

    acc.update("Belady's anomaly occurs", true);
    expect(acc.finalizedText).toBe("Belady's anomaly occurs");

    // Recognizer emits another segment
    acc.update("in FIFO page replacement.", true);
    expect(acc.finalizedText).toBe(
      "Belady's anomaly occurs in FIFO page replacement."
    );

    // Recognizer re-emits subset (must not duplicate)
    acc.update("in FIFO page replacement.", true);
    expect(acc.finalizedText).toBe(
      "Belady's anomaly occurs in FIFO page replacement."
    );
  });

  it("handles finalized sentence plus in-flight interim tail on finish", () => {
    const acc = new TranscriptAccumulator();

    acc.update("First in first out replaces the oldest page.", true);
    acc.update("However adding more frames can cause faults", false);

    expect(acc.getFullTranscript()).toBe(
      "First in first out replaces the oldest page. However adding more frames can cause faults"
    );

    const finalResult = acc.finalize();
    expect(finalResult).toBe(
      "First in first out replaces the oldest page. However adding more frames can cause faults"
    );
    expect(calculateWordCount(finalResult)).toBe(15);
  });

  it("rejects late provider events after completion", () => {
    const acc = new TranscriptAccumulator();

    acc.update("This is my full and complete explanation.", true);
    acc.finalize();

    expect(acc.finalizedText).toBe("This is my full and complete explanation.");
    expect(acc.isCompleted).toBe(true);

    // Late arriving event after finish click
    acc.update("", false);
    acc.update("late bogus words", false);
    acc.update("late bogus words", true);

    // State must remain strictly untouched
    expect(acc.finalizedText).toBe("This is my full and complete explanation.");
    expect(acc.interimText).toBe("");
  });

  it("is idempotent when finalize is called repeatedly", () => {
    const acc = new TranscriptAccumulator();

    acc.update("Single attempt spoken text", false);
    const firstCall = acc.finalize();
    const secondCall = acc.finalize();

    expect(firstCall).toBe("Single attempt spoken text");
    expect(secondCall).toBe("Single attempt spoken text");
  });

  it("handles server final merge when server returns fuller transcript", () => {
    const acc = new TranscriptAccumulator();

    acc.update("Belady's anomaly", false);

    // Server final returns complete flushed transcript
    const result = acc.finalize(
      "Belady's anomaly occurs in FIFO page replacement algorithm."
    );

    expect(result).toBe(
      "Belady's anomaly occurs in FIFO page replacement algorithm."
    );
  });

  it("preserves local transcript if server final returns empty", () => {
    const acc = new TranscriptAccumulator();

    acc.update("Local words spoken by student", false);

    // Server final returns empty string (e.g. timeout or closed socket)
    const result = acc.finalize("");

    expect(result).toBe("Local words spoken by student");
  });

  it("handles completely empty speech without inventing words", () => {
    const acc = new TranscriptAccumulator();

    const result = acc.finalize();
    expect(result).toBe("");
    expect(calculateWordCount(result)).toBe(0);
  });
});
