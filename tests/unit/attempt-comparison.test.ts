import { describe, it, expect } from "vitest";
import {
  checkScopeCompatibility,
  deriveConceptTransition,
  compareAttempts,
} from "@/lib/domain/attempt-comparison";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";
import { RubricCriterion } from "@/lib/domain/study-set";

describe("Attempt-to-Attempt Comparison Engine", () => {
  const baseAttemptA: PracticeAttempt = {
    id: "attempt_1",
    studySetId: "set_1",
    questionId: "q_1",
    transcript: "DNS resolves names to IP addresses.",
    wordCount: 7,
    durationSeconds: 12,
    status: "completed",
    scope: "whole_answer",
    createdAt: "2026-10-31T10:00:00.000Z",
  };

  const baseAttemptB: PracticeAttempt = {
    id: "attempt_2",
    studySetId: "set_1",
    questionId: "q_1",
    transcript:
      "DNS resolves hostnames to IP addresses. The browser first queries the local resolver cache.",
    wordCount: 15,
    durationSeconds: 22,
    status: "completed",
    scope: "whole_answer",
    createdAt: "2026-10-31T10:15:00.000Z",
  };

  const criteria: RubricCriterion[] = [
    {
      id: "crit_dns_purpose",
      name: "Purpose of DNS",
      category: "essential_concept",
      description: "Translates human-readable domain names into IP addresses.",
      satisfactoryDemonstration: "Explains mapping names to IP addresses.",
      isMandatory: true,
      orderIndex: 0,
    },
    {
      id: "crit_cache",
      name: "Local Cache Lookup",
      category: "essential_concept",
      description: "Browser checks local resolver cache first.",
      satisfactoryDemonstration: "Mentions local cache or resolver.",
      isMandatory: true,
      orderIndex: 1,
    },
    {
      id: "crit_root_server",
      name: "Root Nameserver",
      category: "essential_concept",
      description: "Queries root server if cache misses.",
      satisfactoryDemonstration: "Mentions root or TLD servers.",
      isMandatory: true,
      orderIndex: 2,
    },
  ];

  const auditA: SemanticAuditResult = {
    id: "audit_1",
    attemptId: "attempt_1",
    studySetId: "set_1",
    questionId: "q_1",
    status: "completed",
    scope: { type: "whole_answer" },
    overall: {
      summary: "Understood basic purpose, missed caching and root servers.",
      whatExplainedWell: ["Purpose of DNS"],
      whatNeedsAttention: ["Local Cache Lookup", "Root Nameserver"],
      whatNeedsCorrection: [],
      suggestedNextImprovement: "Mention local cache check.",
      coveredCount: 1,
      partiallyCoveredCount: 0,
      missingCount: 2,
      incorrectCount: 0,
      optionalCount: 0,
      totalCriteria: 3,
    },
    criteriaEvaluations: [
      {
        criterionId: "crit_dns_purpose",
        criterionName: "Purpose of DNS",
        category: "essential_concept",
        status: "covered",
        explanation: "Accurately stated resolving names to IP addresses.",
        transcriptEvidence: "DNS resolves names to IP addresses",
        improvementSuggestion: "Good explanation.",
        orderIndex: 0,
      },
      {
        criterionId: "crit_cache",
        criterionName: "Local Cache Lookup",
        category: "essential_concept",
        status: "missing",
        explanation: "Did not mention local cache.",
        improvementSuggestion: "State browser checks local cache.",
        orderIndex: 1,
      },
      {
        criterionId: "crit_root_server",
        criterionName: "Root Nameserver",
        category: "essential_concept",
        status: "missing",
        explanation: "Did not mention root servers.",
        improvementSuggestion: "Describe hierarchical resolution.",
        orderIndex: 2,
      },
    ],
    hasUncertainty: false,
    createdAt: "2026-10-31T10:00:05.000Z",
    updatedAt: "2026-10-31T10:00:05.000Z",
  };

  const auditB: SemanticAuditResult = {
    id: "audit_2",
    attemptId: "attempt_2",
    studySetId: "set_1",
    questionId: "q_1",
    status: "completed",
    scope: { type: "whole_answer" },
    overall: {
      summary: "Understood purpose and local cache. Root servers missing.",
      whatExplainedWell: ["Purpose of DNS", "Local Cache Lookup"],
      whatNeedsAttention: ["Root Nameserver"],
      whatNeedsCorrection: [],
      suggestedNextImprovement: "Mention root nameservers.",
      coveredCount: 2,
      partiallyCoveredCount: 0,
      missingCount: 1,
      incorrectCount: 0,
      optionalCount: 0,
      totalCriteria: 3,
    },
    criteriaEvaluations: [
      {
        criterionId: "crit_dns_purpose",
        criterionName: "Purpose of DNS",
        category: "essential_concept",
        status: "covered",
        explanation: "Hostnames to IP addresses correctly stated.",
        transcriptEvidence: "DNS resolves hostnames to IP addresses",
        improvementSuggestion: "Clear definition.",
        orderIndex: 0,
      },
      {
        criterionId: "crit_cache",
        criterionName: "Local Cache Lookup",
        category: "essential_concept",
        status: "covered",
        explanation: "Browser queries local resolver cache.",
        transcriptEvidence:
          "The browser first queries the local resolver cache",
        improvementSuggestion: "Accurate detail.",
        orderIndex: 1,
      },
      {
        criterionId: "crit_root_server",
        criterionName: "Root Nameserver",
        category: "essential_concept",
        status: "missing",
        explanation: "Did not mention root servers.",
        improvementSuggestion: "Describe root servers.",
        orderIndex: 2,
      },
    ],
    hasUncertainty: false,
    createdAt: "2026-10-31T10:15:05.000Z",
    updatedAt: "2026-10-31T10:15:05.000Z",
  };

  describe("Scope Compatibility Checks", () => {
    it("accepts two whole_answer attempts for the same question", () => {
      const res = checkScopeCompatibility(baseAttemptA, baseAttemptB);
      expect(res.compatible).toBe(true);
      if (res.compatible) {
        expect(res.scopeDescription).toBe("Whole Answer");
      }
    });

    it("accepts two attempts practicing the same paragraph", () => {
      const para1A: PracticeAttempt = {
        ...baseAttemptA,
        scope: "paragraph",
        paragraphIndex: 0,
        totalParagraphs: 2,
      };
      const para1B: PracticeAttempt = {
        ...baseAttemptB,
        scope: "paragraph",
        paragraphIndex: 0,
        totalParagraphs: 2,
      };

      const res = checkScopeCompatibility(para1A, para1B);
      expect(res.compatible).toBe(true);
      if (res.compatible) {
        expect(res.scopeDescription).toBe("Paragraph 1 of 2");
      }
    });

    it("rejects attempts practicing different paragraphs", () => {
      const para1: PracticeAttempt = {
        ...baseAttemptA,
        scope: "paragraph",
        paragraphIndex: 0,
        totalParagraphs: 2,
      };
      const para2: PracticeAttempt = {
        ...baseAttemptB,
        scope: "paragraph",
        paragraphIndex: 1,
        totalParagraphs: 2,
      };

      const res = checkScopeCompatibility(para1, para2);
      expect(res.compatible).toBe(false);
      if (!res.compatible) {
        expect(res.reason).toContain("Paragraph 1");
        expect(res.reason).toContain("Paragraph 2");
      }
    });

    it("rejects attempt pair mixing whole_answer and paragraph", () => {
      const whole: PracticeAttempt = {
        ...baseAttemptA,
        scope: "whole_answer",
      };
      const para1: PracticeAttempt = {
        ...baseAttemptB,
        scope: "paragraph",
        paragraphIndex: 0,
        totalParagraphs: 2,
      };

      const res = checkScopeCompatibility(whole, para1);
      expect(res.compatible).toBe(false);
      if (!res.compatible) {
        expect(res.reason).toContain("same scope");
      }
    });

    it("rejects attempts from different questions", () => {
      const diffQ: PracticeAttempt = {
        ...baseAttemptB,
        questionId: "q_other",
      };

      const res = checkScopeCompatibility(baseAttemptA, diffQ);
      expect(res.compatible).toBe(false);
      if (!res.compatible) {
        expect(res.reason).toContain("different questions");
      }
    });
  });

  describe("Concept Transitions", () => {
    it("detects improved concept (missing -> covered)", () => {
      const { transition, message } = deriveConceptTransition(
        "missing",
        "covered",
        "Local Cache"
      );
      expect(transition).toBe("improved");
      expect(message).toContain("You improved");
      expect(message).toContain("Local Cache");
    });

    it("detects retained concept (covered -> covered)", () => {
      const { transition, message } = deriveConceptTransition(
        "covered",
        "covered",
        "Purpose of DNS"
      );
      expect(transition).toBe("retained");
      expect(message).toContain("Maintained coverage");
    });

    it("detects regressed concept (covered -> missing)", () => {
      const { transition, message } = deriveConceptTransition(
        "covered",
        "missing",
        "Local Cache"
      );
      expect(transition).toBe("regressed");
      expect(message).toContain("previously covered");
    });

    it("detects new misconception (covered -> incorrect)", () => {
      const { transition, message } = deriveConceptTransition(
        "covered",
        "incorrect",
        "Root Servers"
      );
      expect(transition).toBe("new_misconception");
      expect(message).toContain("factual conflict");
    });

    it("detects still missing concept (missing -> missing)", () => {
      const { transition, message } = deriveConceptTransition(
        "missing",
        "missing",
        "Root Servers"
      );
      expect(transition).toBe("still_missing");
      expect(message).toContain("Still to practise");
    });
  });

  describe("End-to-End Attempt Comparison", () => {
    it("compares two valid attempts and calculates net positive progress", () => {
      const result = compareAttempts({
        attemptA: baseAttemptA,
        attemptB: baseAttemptB,
        auditA,
        auditB,
        criteria,
      });

      expect(result.isComparable).toBe(true);
      expect(result.summary.conceptsCoveredEarlier).toBe(1);
      expect(result.summary.conceptsCoveredLater).toBe(2);
      expect(result.summary.mandatoryTotal).toBe(3);
      expect(result.summary.netProgress).toBe(1);
      expect(result.summary.improvedConcepts).toContain("Local Cache Lookup");
      expect(result.summary.retainedConcepts).toContain("Purpose of DNS");
      expect(result.summary.stillMissingConcepts).toContain("Root Nameserver");
      expect(result.summary.wordsSpokenChange).toBe(8); // 15 - 7
      expect(result.summary.durationSecondsChange).toBe(10); // 22 - 12
      expect(result.summary.headline).toContain("1 more key concept");
    });

    it("orders attempts chronologically regardless of argument order", () => {
      // Pass Attempt B first, then Attempt A
      const result = compareAttempts({
        attemptA: baseAttemptB,
        attemptB: baseAttemptA,
        auditA: auditB,
        auditB: auditA,
        criteria,
      });

      expect(result.isComparable).toBe(true);
      expect(result.earlierAttempt.id).toBe("attempt_1");
      expect(result.laterAttempt.id).toBe("attempt_2");
      expect(result.summary.netProgress).toBe(1);
    });

    it("gracefully reports pending audit when an attempt has not been audited yet", () => {
      const result = compareAttempts({
        attemptA: baseAttemptA,
        attemptB: baseAttemptB,
        auditA,
        auditB: null,
        criteria,
      });

      expect(result.isComparable).toBe(false);
      expect(result.incompatibilityReason).toContain(
        "Semantic evaluation has not finished"
      );
    });
  });

  describe("Paragraph-Level Scope Comparison (10 Key Requirements)", () => {
    // 2-paragraph reference answer scenario matching user screenshot:
    // Paragraph 1: 1 concept ("Victim selection on page fault")
    // Paragraph 2: 3 concepts ("FIFO, LRU, Optimal terminology", "Rule to tradeoff comparison", "Avoid FIFO-LRU-Optimal confusions")
    const wholeQuestionCriteria: RubricCriterion[] = [
      {
        id: "crit_victim_selection",
        name: "Victim selection on page fault",
        category: "essential_concept",
        description: "Explains page replacement purpose and common algorithms.",
        satisfactoryDemonstration: "Explains replacing a page on fault.",
        isMandatory: true,
        orderIndex: 0,
      },
      {
        id: "crit_algo_terms",
        name: "FIFO, LRU, Optimal terminology",
        category: "technical_anchor",
        description: "Names FIFO, LRU, and Optimal algorithms with details.",
        satisfactoryDemonstration: "Names all three algorithms accurately.",
        isMandatory: true,
        orderIndex: 1,
      },
      {
        id: "crit_tradeoffs",
        name: "Rule to tradeoff comparison",
        category: "relationship_sequence",
        description: "Compares tradeoffs between FIFO, LRU, and Optimal.",
        satisfactoryDemonstration:
          "Explains Belady anomaly and stack property.",
        isMandatory: true,
        orderIndex: 2,
      },
      {
        id: "crit_mistakes",
        name: "Avoid FIFO-LRU-Optimal confusions",
        category: "accuracy_constraint",
        description: "Avoids confusing LRU with FIFO.",
        satisfactoryDemonstration:
          "Clearly distinguishes recency from arrival order.",
        isMandatory: true,
        orderIndex: 3,
      },
    ];

    const p1Attempt1: PracticeAttempt = {
      id: "p1_att_1",
      studySetId: "os_set",
      questionId: "q_page_replacement",
      transcript:
        "page replacement algorithm decide which page to remove when a page fault occurs. Common algorithms include FIFO and LRU.",
      wordCount: 22,
      durationSeconds: 23,
      status: "completed",
      scope: "paragraph",
      paragraphIndex: 0,
      paragraphText:
        "Page replacement algorithms decide which page to remove from memory when a page fault occurs. Common algorithms include FIFO, LRU, and Optimal.",
      totalParagraphs: 2,
      createdAt: "2026-11-03T10:30:00.000Z",
    };

    const p1Audit1: SemanticAuditResult = {
      id: "p1_audit_1",
      attemptId: "p1_att_1",
      studySetId: "os_set",
      questionId: "q_page_replacement",
      status: "completed",
      scope: { type: "paragraph", paragraphIndex: 0, totalParagraphs: 2 },
      overall: {
        summary:
          "Good start — you clearly explained victim selection, just add Optimal.",
        whatExplainedWell: ["Victim selection on page fault"],
        whatNeedsAttention: ["Omitted Optimal"],
        whatNeedsCorrection: [],
        suggestedNextImprovement: "Name Optimal alongside FIFO and LRU.",
        coveredCount: 0,
        partiallyCoveredCount: 1,
        missingCount: 0,
        incorrectCount: 0,
        optionalCount: 0,
        totalCriteria: 1,
      },
      criteriaEvaluations: [
        {
          criterionId: "crit_victim_selection",
          criterionName: "Victim selection on page fault",
          category: "essential_concept",
          status: "partially_covered",
          explanation: "Accurately communicated core idea but omitted Optimal.",
          transcriptEvidence:
            "page replacement algorithm decide which page to remove when a page fault occurs. Common algorithms include FIFO and LRU.",
          missingOrInaccurate:
            "Omitted Optimal from the list of common algorithms.",
          improvementSuggestion: "Include Optimal alongside FIFO and LRU.",
          orderIndex: 0,
        },
      ],
      createdAt: "2026-11-03T10:30:10.000Z",
      updatedAt: "2026-11-03T10:30:10.000Z",
      hasUncertainty: false,
    };

    const p1Attempt2: PracticeAttempt = {
      id: "p1_att_2",
      studySetId: "os_set",
      questionId: "q_page_replacement",
      transcript:
        "page replacement algorithm decide which page to remove from memory when a page fault occurs. Common algorithms include FIFO, LRU, and optimal.",
      wordCount: 22,
      durationSeconds: 56,
      status: "completed",
      scope: "paragraph",
      paragraphIndex: 0,
      paragraphText:
        "Page replacement algorithms decide which page to remove from memory when a page fault occurs. Common algorithms include FIFO, LRU, and Optimal.",
      totalParagraphs: 2,
      createdAt: "2026-11-03T10:35:00.000Z",
    };

    const p1Audit2: SemanticAuditResult = {
      id: "p1_audit_2",
      attemptId: "p1_att_2",
      studySetId: "os_set",
      questionId: "q_page_replacement",
      status: "completed",
      scope: { type: "paragraph", paragraphIndex: 0, totalParagraphs: 2 },
      overall: {
        summary:
          "Great job! You clearly stated the purpose and named all three algorithms.",
        whatExplainedWell: ["Victim selection on page fault"],
        whatNeedsAttention: [],
        whatNeedsCorrection: [],
        suggestedNextImprovement: "Keep this clear intro as-is.",
        coveredCount: 1,
        partiallyCoveredCount: 0,
        missingCount: 0,
        incorrectCount: 0,
        optionalCount: 0,
        totalCriteria: 1,
      },
      criteriaEvaluations: [
        {
          criterionId: "crit_victim_selection",
          criterionName: "Victim selection on page fault",
          category: "essential_concept",
          status: "covered",
          explanation:
            "Student communicated both elements required for Paragraph 1.",
          transcriptEvidence:
            "page replacement algorithm decide which page to remove from memory when a page fault occurs. Common algorithms include FIFO, LRU, and optimal.",
          improvementSuggestion: "Continue with confident delivery.",
          orderIndex: 0,
        },
      ],
      createdAt: "2026-11-03T10:35:10.000Z",
      updatedAt: "2026-11-03T10:35:10.000Z",
      hasUncertainty: false,
    };

    // 1. Paragraph 1 vs Paragraph 1 comparison
    it("1. compares Paragraph 1 attempt with another Paragraph 1 attempt without leaking other paragraphs", () => {
      const comp = compareAttempts({
        attemptA: p1Attempt1,
        attemptB: p1Attempt2,
        auditA: p1Audit1,
        auditB: p1Audit2,
        criteria: wholeQuestionCriteria, // Even if whole question rubric is passed
      });

      expect(comp.isComparable).toBe(true);
      expect(comp.scopeDescription).toBe("Paragraph 1 of 2");
      // CRITICAL FIX: The denominator must be 1 (the paragraph's concept), NOT 4!
      expect(comp.summary.mandatoryTotal).toBe(1);
      expect(comp.summary.conceptsCoveredEarlier).toBe(0);
      expect(comp.summary.conceptsCoveredLater).toBe(1);
      expect(comp.summary.netProgress).toBe(1);
      expect(comp.summary.improvedConcepts).toEqual([
        "Victim selection on page fault",
      ]);
      expect(comp.concepts.length).toBe(1);
      expect(comp.concepts[0]?.criterionName).toBe(
        "Victim selection on page fault"
      );
      expect(comp.concepts[0]?.transition).toBe("improved");
      expect(comp.concepts[0]?.earlierStatus).toBe("partially_covered");
      expect(comp.concepts[0]?.laterStatus).toBe("covered");
    });

    // 2. Paragraph 2 vs Paragraph 2 comparison
    it("2. compares Paragraph 2 attempt with another Paragraph 2 attempt", () => {
      const p2Attempt1: PracticeAttempt = {
        ...p1Attempt1,
        id: "p2_att_1",
        paragraphIndex: 1,
        createdAt: "2026-11-03T11:00:00.000Z",
      };
      const p2Attempt2: PracticeAttempt = {
        ...p1Attempt2,
        id: "p2_att_2",
        paragraphIndex: 1,
        createdAt: "2026-11-03T11:10:00.000Z",
      };
      const p2Audit1: SemanticAuditResult = {
        ...p1Audit1,
        id: "p2_audit_1",
        attemptId: "p2_att_1",
        criteriaEvaluations: [
          {
            criterionId: "crit_algo_terms",
            criterionName: "FIFO, LRU, Optimal terminology",
            category: "technical_anchor",
            status: "covered",
            explanation: "Explained FIFO and LRU.",
            improvementSuggestion: "Add Optimal.",
            orderIndex: 0,
          },
        ],
      };
      const p2Audit2: SemanticAuditResult = {
        ...p1Audit2,
        id: "p2_audit_2",
        attemptId: "p2_att_2",
        criteriaEvaluations: [
          {
            criterionId: "crit_algo_terms",
            criterionName: "FIFO, LRU, Optimal terminology",
            category: "technical_anchor",
            status: "covered",
            explanation: "Explained all 3.",
            improvementSuggestion: "Good.",
            orderIndex: 0,
          },
          {
            criterionId: "crit_tradeoffs",
            criterionName: "Rule to tradeoff comparison",
            category: "relationship_sequence",
            status: "covered",
            explanation: "Detailed tradeoffs.",
            improvementSuggestion: "Good.",
            orderIndex: 1,
          },
        ],
      };

      const comp = compareAttempts({
        attemptA: p2Attempt1,
        attemptB: p2Attempt2,
        auditA: p2Audit1,
        auditB: p2Audit2,
        criteria: wholeQuestionCriteria,
      });

      expect(comp.isComparable).toBe(true);
      expect(comp.scopeDescription).toBe("Paragraph 2 of 2");
      expect(comp.summary.conceptsCoveredEarlier).toBe(1);
      expect(comp.summary.conceptsCoveredLater).toBe(2);
      expect(comp.summary.netProgress).toBe(1);
    });

    // 3. Whole-answer attempt compared with another whole-answer attempt
    it("3. compares whole-answer attempt with another whole-answer attempt", () => {
      const comp = checkScopeCompatibility(baseAttemptA, baseAttemptB);
      expect(comp.compatible).toBe(true);
      if (comp.compatible) {
        expect(comp.scopeDescription).toBe("Whole Answer");
        expect(comp.isParagraphScope).toBe(false);
      }
    });

    // 4. Paragraph-level attempt compared against whole-answer attempt
    it("4. explicitly rejects paragraph attempt compared against whole-answer attempt with clear explanation", () => {
      const wholeAnswerSameQ: PracticeAttempt = {
        ...baseAttemptB,
        questionId: "q_page_replacement",
      };
      const comp = checkScopeCompatibility(p1Attempt1, wholeAnswerSameQ);
      expect(comp.compatible).toBe(false);
      if (!comp.compatible) {
        expect(comp.reason).toContain(
          "One attempt evaluated only Paragraph 1, while the other evaluated the whole answer"
        );
      }
    });

    // 5. Paragraph 1 compared against Paragraph 2
    it("5. explicitly rejects Paragraph 1 attempt compared against Paragraph 2 attempt", () => {
      const p2Attempt: PracticeAttempt = {
        ...p1Attempt2,
        paragraphIndex: 1,
      };
      const comp = checkScopeCompatibility(p1Attempt1, p2Attempt);
      expect(comp.compatible).toBe(false);
      if (!comp.compatible) {
        expect(comp.reason).toContain(
          "Attempt 1 evaluates Paragraph 1, while Attempt 2 evaluates Paragraph 2"
        );
      }
    });

    // 6. Historical attempts without scope metadata
    it("6. rejects historical attempts lacking scope metadata without fabricating historical scope", () => {
      const legacyAttemptA: PracticeAttempt = {
        ...baseAttemptA,
        scope: undefined,
      };
      const legacyAttemptB: PracticeAttempt = {
        ...baseAttemptB,
        scope: undefined,
      };
      const comp = checkScopeCompatibility(legacyAttemptA, legacyAttemptB);
      expect(comp.compatible).toBe(false);
      if (!comp.compatible) {
        expect(comp.reason).toContain("practice scope is unavailable");
      }
    });

    // 7. Paragraph-level concept coverage calculations
    it("7. calculates concept coverage using only paragraph's actual concepts", () => {
      const comp = compareAttempts({
        attemptA: p1Attempt1,
        attemptB: p1Attempt2,
        auditA: p1Audit1,
        auditB: p1Audit2,
        criteria: wholeQuestionCriteria,
      });

      // Total mandatory must be 1 (only the concept evaluated in Paragraph 1)
      expect(comp.summary.mandatoryTotal).toBe(1);
      expect(comp.summary.conceptsCoveredEarlier).toBe(0);
      expect(comp.summary.conceptsCoveredLater).toBe(1);
    });

    // 8. Paragraph-level spoken evidence
    it("8. isolates spoken evidence to the paragraph scope", () => {
      const comp = compareAttempts({
        attemptA: p1Attempt1,
        attemptB: p1Attempt2,
        auditA: p1Audit1,
        auditB: p1Audit2,
        criteria: wholeQuestionCriteria,
      });

      const concept = comp.concepts[0]!;
      expect(concept.earlierEvidence).toContain("FIFO and LRU");
      expect(concept.laterEvidence).toContain("optimal");
    });

    // 9. Progress summaries and concept counts
    it("9. produces accurate progress headline and summary metrics for paragraph practice", () => {
      const comp = compareAttempts({
        attemptA: p1Attempt1,
        attemptB: p1Attempt2,
        auditA: p1Audit1,
        auditB: p1Audit2,
        criteria: wholeQuestionCriteria,
      });

      expect(comp.summary.headline).toContain(
        "Great progress! You covered 1 more key concept"
      );
      expect(comp.summary.improvedConcepts).toContain(
        "Victim selection on page fault"
      );
      expect(comp.summary.wordsSpokenChange).toBe(0);
      expect(comp.summary.durationSecondsChange).toBe(33); // 56 - 23
    });

    // 10. Scope preservation in attempt records
    it("10. preserves scope type, paragraphIndex, paragraphText, and totalParagraphs in attempt record", () => {
      expect(p1Attempt1.scope).toBe("paragraph");
      expect(p1Attempt1.paragraphIndex).toBe(0);
      expect(p1Attempt1.totalParagraphs).toBe(2);
      expect(p1Attempt1.paragraphText).toContain(
        "Page replacement algorithms decide"
      );
    });
  });
});
