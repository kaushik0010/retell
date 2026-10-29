import { describe, expect, it } from "vitest";
import { generateRecallHint } from "../../src/lib/domain/recall-hints";
import { RubricCriterion } from "../../src/lib/domain/study-set";

describe("generateRecallHint Unit Test Suite", () => {
  const sampleCriteria: RubricCriterion[] = [
    {
      id: "crit_1",
      category: "technical_anchor",
      name: "FIFO Page Replacement",
      description: "Applies to First-In First-Out page replacement algorithm.",
      satisfactoryDemonstration: "Mentions FIFO or first-in first-out.",
      isMandatory: true,
      orderIndex: 0,
    },
    {
      id: "crit_2",
      category: "essential_concept",
      name: "Increasing Page Frames",
      description: "More physical page frames allocated to the process.",
      satisfactoryDemonstration: "Refers to adding or increasing frames.",
      isMandatory: true,
      orderIndex: 1,
    },
    {
      id: "crit_3",
      category: "essential_concept",
      name: "Higher Page Faults",
      description: "Results in more page faults instead of fewer.",
      satisfactoryDemonstration: "Explains anomaly where faults increase.",
      isMandatory: true,
      orderIndex: 2,
    },
  ];

  const sampleAnswer =
    "Belady's anomaly occurs in FIFO page replacement where increasing the number of page frames leads to more page faults. For example, 3 frames cause 9 faults while 4 frames cause 10 faults.";

  it("selects the first unmentioned criterion as a short 1-4 word cue", () => {
    const hint = generateRecallHint({
      referenceAnswer: sampleAnswer,
      criteria: sampleCriteria,
      currentTranscript:
        "Belady's anomaly is an unexpected behavior in memory.",
      previousHints: [],
    });

    expect(hint).not.toBeNull();
    expect(hint?.cue).toBe("FIFO Page Replacement");
    expect(hint?.source).toBe("criterion");
    // Word count of cue must be brief (<= 4 words)
    expect(hint?.cue.split(/\s+/).length).toBeLessThanOrEqual(4);
  });

  it("respects semantic paraphrasing: skips already mentioned concepts", () => {
    // Student already mentioned FIFO in their explanation
    const hint = generateRecallHint({
      referenceAnswer: sampleAnswer,
      criteria: sampleCriteria,
      currentTranscript:
        "Belady's anomaly occurs when using the FIFO page replacement algorithm.",
      previousHints: [],
    });

    expect(hint).not.toBeNull();
    // Criterion 1 (FIFO) is skipped; Criterion 2 is selected
    expect(hint?.cue).toBe("Increasing Page Frames");
  });

  it("avoids repeating hints shown in previous pauses", () => {
    const hint = generateRecallHint({
      referenceAnswer: sampleAnswer,
      criteria: sampleCriteria,
      currentTranscript: "Belady's anomaly in memory management.",
      previousHints: ["FIFO Page Replacement"],
    });

    expect(hint).not.toBeNull();
    expect(hint?.cue).not.toBe("FIFO Page Replacement");
    expect(hint?.cue).toBe("Increasing Page Frames");
  });

  it("caps hints at maximum 3 per attempt to prevent answer dumping", () => {
    const hint = generateRecallHint({
      referenceAnswer: sampleAnswer,
      criteria: sampleCriteria,
      currentTranscript: "I am stuck on this exam question.",
      previousHints: ["Hint 1", "Hint 2", "Hint 3"],
      maxHintsPerAttempt: 3,
    });

    expect(hint).toBeNull();
  });

  it("falls back to reference answer sentences when no rubric criteria exist", () => {
    const hint = generateRecallHint({
      referenceAnswer:
        "React Virtual DOM compares new elements with previous elements. Reconciliation determines which DOM nodes require updating.",
      criteria: [],
      currentTranscript: "React uses a virtual DOM.",
      previousHints: [],
    });

    expect(hint).not.toBeNull();
    expect(hint?.source).toBe("reference_answer");
    expect(hint?.cue.split(/\s+/).length).toBeLessThanOrEqual(4);
  });

  it("returns null when all key concepts have already been mentioned", () => {
    const hint = generateRecallHint({
      referenceAnswer: sampleAnswer,
      criteria: sampleCriteria,
      currentTranscript:
        "In FIFO page replacement, increasing page frames causes higher page faults.",
      previousHints: [],
    });

    // Student has covered all 3 criteria; no hint needed
    expect(hint).toBeNull();
  });

  it("returns null for empty or short answers rather than fabricating hints", () => {
    const hint = generateRecallHint({
      referenceAnswer: "",
      criteria: [],
      currentTranscript: "Some words.",
      previousHints: [],
    });

    expect(hint).toBeNull();

    const shortHint = generateRecallHint({
      referenceAnswer: "Too short",
      criteria: [],
      currentTranscript: "Some words.",
      previousHints: [],
    });

    expect(shortHint).toBeNull();
  });
});
