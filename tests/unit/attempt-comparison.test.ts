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
});
