import { describe, expect, it } from "vitest";
import {
  generateRecallHint,
  extractConciseCue,
} from "../../src/lib/domain/recall-hints";
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

  it("selects the first unmentioned criterion as a short 1-3 word cue", () => {
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
    // Word count of cue must be concise (1-3 words)
    const wordCount = hint?.cue.split(/\s+/).length || 0;
    expect(wordCount).toBeGreaterThanOrEqual(1);
    expect(wordCount).toBeLessThanOrEqual(3);
  });

  it("extracts concise 1-3 word cues matching required technical phrase shapes", () => {
    expect(extractConciseCue("Recursive query")).toBe("Recursive query");
    expect(extractConciseCue("1. Root nameserver.")).toBe("Root nameserver");
    expect(extractConciseCue("Step 2: TLD nameserver,")).toBe("TLD nameserver");
    expect(extractConciseCue("Criterion 3 - Systematic development:")).toBe(
      "Systematic development"
    );
    expect(extractConciseCue("Concept of Recursive Query")).toBe(
      "Recursive Query"
    );

    // Verify word counts strictly 1-3 words
    const cues = [
      extractConciseCue("Recursive query"),
      extractConciseCue("1. Root nameserver."),
      extractConciseCue("Step 2: TLD nameserver,"),
      extractConciseCue("Criterion 3 - Systematic development:"),
    ];

    for (const cue of cues) {
      const words = cue.split(/\s+/);
      expect(words.length).toBeGreaterThanOrEqual(1);
      expect(words.length).toBeLessThanOrEqual(3);
    }
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

  it("supports explicit max hints cap when specified", () => {
    const hint = generateRecallHint({
      referenceAnswer: sampleAnswer,
      criteria: sampleCriteria,
      currentTranscript: "I am stuck on this exam question.",
      previousHints: ["Hint 1", "Hint 2", "Hint 3"],
      maxHintsPerAttempt: 3,
    });

    expect(hint).toBeNull();
  });

  it("continues offering useful hints beyond three when multiple criteria exist", () => {
    const multiCriteria: RubricCriterion[] = [
      {
        id: "c1",
        category: "essential_concept",
        name: "Criterion 1: Client query",
        description: "",
        satisfactoryDemonstration: "",
        isMandatory: true,
        orderIndex: 0,
      },
      {
        id: "c2",
        category: "essential_concept",
        name: "Criterion 2: Recursive resolver",
        description: "",
        satisfactoryDemonstration: "",
        isMandatory: true,
        orderIndex: 1,
      },
      {
        id: "c3",
        category: "essential_concept",
        name: "Criterion 3: Root nameserver",
        description: "",
        satisfactoryDemonstration: "",
        isMandatory: true,
        orderIndex: 2,
      },
      {
        id: "c4",
        category: "essential_concept",
        name: "Criterion 4: TLD nameserver",
        description: "",
        satisfactoryDemonstration: "",
        isMandatory: true,
        orderIndex: 3,
      },
      {
        id: "c5",
        category: "essential_concept",
        name: "Criterion 5: Authoritative nameserver",
        description: "",
        satisfactoryDemonstration: "",
        isMandatory: true,
        orderIndex: 4,
      },
    ];

    // Hint 1
    const h1 = generateRecallHint({
      referenceAnswer: "DNS resolves hostnames to IP addresses.",
      criteria: multiCriteria,
      currentTranscript: "",
      previousHints: [],
    });
    expect(h1).not.toBeNull();
    expect(h1?.cue).toBe("Client query");

    // Hint 2
    const h2 = generateRecallHint({
      referenceAnswer: "DNS resolves hostnames to IP addresses.",
      criteria: multiCriteria,
      currentTranscript: "",
      previousHints: [h1!.cue],
    });
    expect(h2).not.toBeNull();
    expect(h2?.cue).toBe("Recursive resolver");

    // Hint 3
    const h3 = generateRecallHint({
      referenceAnswer: "DNS resolves hostnames to IP addresses.",
      criteria: multiCriteria,
      currentTranscript: "",
      previousHints: [h1!.cue, h2!.cue],
    });
    expect(h3).not.toBeNull();
    expect(h3?.cue).toBe("Root nameserver");

    // Hint 4: MUST NOT stop after three!
    const h4 = generateRecallHint({
      referenceAnswer: "DNS resolves hostnames to IP addresses.",
      criteria: multiCriteria,
      currentTranscript: "",
      previousHints: [h1!.cue, h2!.cue, h3!.cue],
    });
    expect(h4).not.toBeNull();
    expect(h4?.cue).toBe("TLD nameserver");

    // Hint 5
    const h5 = generateRecallHint({
      referenceAnswer: "DNS resolves hostnames to IP addresses.",
      criteria: multiCriteria,
      currentTranscript: "",
      previousHints: [h1!.cue, h2!.cue, h3!.cue, h4!.cue],
    });
    expect(h5).not.toBeNull();
    expect(h5?.cue).toBe("Authoritative nameserver");

    // Once all 5 criteria have been shown, returns null (no hallucinated hints)
    const h6 = generateRecallHint({
      referenceAnswer: "DNS resolves hostnames to IP addresses.",
      criteria: multiCriteria,
      currentTranscript: "",
      previousHints: [h1!.cue, h2!.cue, h3!.cue, h4!.cue, h5!.cue],
    });
    expect(h6).toBeNull();
  });

  it("extracts distinct cues from criteria that share category prefix before colon or dash", () => {
    const prefixedCriteria: RubricCriterion[] = [
      {
        id: "p1",
        category: "essential_concept",
        name: "Process Isolation: Dedicated address space",
        description: "",
        satisfactoryDemonstration: "",
        isMandatory: true,
        orderIndex: 0,
      },
      {
        id: "p2",
        category: "essential_concept",
        name: "Process Isolation: IPC communication overhead",
        description: "",
        satisfactoryDemonstration: "",
        isMandatory: true,
        orderIndex: 1,
      },
    ];

    const cue1 = generateRecallHint({
      referenceAnswer: "A process has isolated memory.",
      criteria: prefixedCriteria,
      currentTranscript: "",
      previousHints: [],
    });

    expect(cue1).not.toBeNull();
    expect(cue1?.cue).toBe("Dedicated address space");

    const cue2 = generateRecallHint({
      referenceAnswer: "A process has isolated memory.",
      criteria: prefixedCriteria,
      currentTranscript: "",
      previousHints: [cue1!.cue],
    });

    expect(cue2).not.toBeNull();
    expect(cue2?.cue).toBe("IPC communication overhead");
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
    expect(hint?.cue.split(/\s+/).length).toBeLessThanOrEqual(3);
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
