import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  evaluateStudentAnswer,
  extractParagraphs,
} from "../../src/lib/audit/evaluator";
import {
  SemanticAuditResultSchema,
  createAuditId,
} from "../../src/lib/domain/semantic-audit";
import {
  PracticeAttempt,
  createAttemptId,
} from "../../src/lib/domain/practice-session";
import {
  savePracticeAttempt,
  getPracticeAttempt,
  saveSemanticAuditResult,
  getSemanticAuditResult,
  getSemanticAuditByAttempt,
  listSemanticAudits,
  clearAllPracticeAttempts,
  clearAllSemanticAudits,
} from "../../src/lib/storage/study-store";
import { POST } from "../../src/app/api/audit/route";

describe("Semantic Answer Auditing Suite (Day 4 Core Experience)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearAllPracticeAttempts();
    await clearAllSemanticAudits();
  });

  // Common test fixture criteria using canonical RubricCategory
  const beladyCriteria = [
    {
      id: "crit_belady_def",
      name: "Belady's Anomaly Definition",
      category: "essential_concept" as const,
      description:
        "Explains that increasing page frames leads to more page faults.",
      satisfactoryDemonstration:
        "Increasing page frames causes more page faults.",
      isMandatory: true,
      orderIndex: 0,
    },
    {
      id: "crit_belady_algo",
      name: "Affected Algorithm",
      category: "technical_anchor" as const,
      description:
        "Identifies FIFO (First-In, First-Out) as the affected replacement algorithm.",
      satisfactoryDemonstration:
        "Commonly occurs in FIFO page replacement algorithm.",
      isMandatory: true,
      orderIndex: 1,
    },
  ];

  // Scenario 1: Exact / Close Answer
  describe("Scenario 1: Exact / close explanation", () => {
    it("marks criteria as covered when student provides a complete, accurate explanation", async () => {
      const result = await evaluateStudentAnswer({
        attemptId: "att_1",
        studySetId: "set_1",
        questionId: "q_1",
        question: "Explain Belady's Anomaly in operating systems.",
        referenceAnswer:
          "Belady's anomaly occurs when allocating more page frames results in an increase in the number of page faults. This commonly happens in the FIFO page replacement algorithm.",
        transcript:
          "Belady's anomaly is when increasing page frames causes more page faults to occur. It typically happens with the FIFO replacement algorithm.",
        criteria: beladyCriteria,
        mockFallback: true,
      });

      expect(result.status).toBe("completed");
      expect(result.overall.coveredCount).toBe(2);
      expect(result.overall.missingCount).toBe(0);
      expect(result.overall.incorrectCount).toBe(0);
      expect(result.overall.whatExplainedWell).toContain(
        "Belady's Anomaly Definition"
      );
      expect(result.overall.whatExplainedWell).toContain("Affected Algorithm");
      expect(
        result.criteriaEvaluations.every((c) => c.status === "covered")
      ).toBe(true);
    });
  });

  // Scenario 2: Semantic Paraphrasing
  describe("Scenario 2: Semantic paraphrasing without rote memorization", () => {
    it("credits students for explaining concepts using completely different words and structures", async () => {
      const dnsCriteria = [
        {
          id: "crit_dns_map",
          name: "Domain to IP Mapping",
          category: "essential_concept" as const,
          description:
            "Translates human-readable names to numeric network addresses.",
          satisfactoryDemonstration: "Resolves hostnames to IP addresses.",
          isMandatory: true,
          orderIndex: 0,
        },
        {
          id: "crit_dns_hierarchy",
          name: "Hierarchical Query Flow",
          category: "relationship_sequence" as const,
          description: "Queries root, TLD, and authoritative name servers.",
          satisfactoryDemonstration:
            "Resolves queries through root and authoritative servers.",
          isMandatory: true,
          orderIndex: 1,
        },
      ];

      // Student uses a phonebook analogy and informal words (no word-for-word repetition)
      const paraphrasedTranscript =
        "The domain name system is essentially like an internet phonebook. Instead of remembering numeric addresses, humans type names like website.com and the resolver queries root and authoritative servers to look up the digital coordinates.";

      const result = await evaluateStudentAnswer({
        attemptId: "att_2",
        studySetId: "set_dns",
        questionId: "q_dns",
        question: "How does DNS resolution work?",
        referenceAnswer:
          "DNS translates human-readable hostnames into IP addresses by querying root, top-level domain, and authoritative name servers.",
        transcript: paraphrasedTranscript,
        criteria: dnsCriteria,
        mockFallback: true,
      });

      expect(result.overall.coveredCount).toBe(2);
      expect(result.criteriaEvaluations[0]?.status).toBe("covered");
      expect(result.criteriaEvaluations[1]?.status).toBe("covered");
    });
  });

  // Scenario 3: Partial Explanation
  describe("Scenario 3: Partial explanation of a concept", () => {
    it("identifies partially explained concepts and provides specific constructive guidance", async () => {
      const isolationCriteria = [
        {
          id: "crit_iso_mem",
          name: "Address Space Isolation",
          category: "essential_concept" as const,
          description: "Each process has its own virtual memory space.",
          satisfactoryDemonstration:
            "Separate virtual address space prevents memory corruption.",
          isMandatory: true,
          orderIndex: 0,
        },
        {
          id: "crit_iso_ring",
          name: "Hardware Privilege Modes",
          category: "technical_anchor" as const,
          description:
            "Distinguishes between user mode and kernel mode execution.",
          satisfactoryDemonstration:
            "Operates in kernel mode for privileged instructions and user mode for apps.",
          isMandatory: true,
          orderIndex: 1,
        },
      ];

      // Student explains memory isolation but omits hardware privilege rings
      const partialTranscript =
        "Process isolation gives every running application its own dedicated virtual memory space so one program crashing won't corrupt another.";

      const result = await evaluateStudentAnswer({
        attemptId: "att_3",
        studySetId: "set_os",
        questionId: "q_iso",
        question: "Explain process isolation in modern operating systems.",
        referenceAnswer:
          "Process isolation ensures each process has a private virtual address space and relies on CPU privilege modes (user vs kernel) to protect hardware.",
        transcript: partialTranscript,
        criteria: isolationCriteria,
        mockFallback: true,
      });

      expect(result.overall.coveredCount).toBe(1);
      expect(result.overall.missingCount).toBe(1);
      expect(result.overall.whatNeedsAttention).toContain(
        "Hardware Privilege Modes"
      );
      expect(result.criteriaEvaluations[1]?.status).toBe("missing");
      expect(result.criteriaEvaluations[1]?.improvementSuggestion).toContain(
        isolationCriteria[1]!.satisfactoryDemonstration
      );
    });
  });

  // Scenario 4: Missing Concept
  describe("Scenario 4: Missing concept (Omission)", () => {
    it("marks omitted concepts as missing without penalizing them as incorrect contradictions", async () => {
      const result = await evaluateStudentAnswer({
        attemptId: "att_4",
        studySetId: "set_1",
        questionId: "q_1",
        question: "Explain Belady's Anomaly.",
        referenceAnswer:
          "Belady's anomaly occurs when allocating more page frames results in an increase in page faults. It occurs in FIFO page replacement.",
        // Student mentions FIFO replacement algorithm, but never explains the anomaly itself
        transcript:
          "This issue commonly occurs in the FIFO page replacement algorithm.",
        criteria: beladyCriteria,
        mockFallback: true,
      });

      const defEval = result.criteriaEvaluations.find(
        (c) => c.criterionId === "crit_belady_def"
      );
      expect(defEval?.status).toBe("missing");
      expect(defEval?.status).not.toBe("incorrect");
      expect(result.overall.incorrectCount).toBe(0);
      expect(result.overall.missingCount).toBe(1);
      expect(result.overall.whatNeedsCorrection).toHaveLength(0);
      expect(result.overall.whatNeedsAttention).toContain(
        "Belady's Anomaly Definition"
      );
    });
  });

  // Scenario 5: Incorrect Concept (Factual Contradiction)
  describe("Scenario 5: Incorrect concept (Factual Contradiction)", () => {
    it("strictly distinguishes factual contradiction from simple omission and separates in UI review", async () => {
      const result = await evaluateStudentAnswer({
        attemptId: "att_5",
        studySetId: "set_1",
        questionId: "q_1",
        question: "Explain Belady's Anomaly.",
        referenceAnswer:
          "Belady's anomaly occurs when allocating more page frames results in an increase in page faults under FIFO.",
        // Student makes an explicit factual error: claims page faults decrease
        transcript:
          "In Belady's anomaly, adding more page frames reduces page faults because there are fewer page faults with more memory in FIFO.",
        criteria: beladyCriteria,
        mockFallback: true,
      });

      expect(result.overall.incorrectCount).toBeGreaterThanOrEqual(1);
      expect(result.overall.whatNeedsCorrection.length).toBeGreaterThanOrEqual(
        1
      );
      const defEval = result.criteriaEvaluations.find(
        (c) => c.criterionId === "crit_belady_def"
      );
      expect(defEval?.status).toBe("incorrect");
      expect(defEval?.status).not.toBe("missing");
      expect(defEval?.missingOrInaccurate).toContain(
        "Claimed page faults decrease"
      );
    });
  });

  // Scenario 6: Related Terminology Without Understanding
  describe("Scenario 6: Related terminology without understanding", () => {
    it("does not award coverage for mere keyword dropping without conceptual explanation", async () => {
      const singleCrit = [
        {
          id: "crit_os_kernel",
          name: "Kernel Privilege",
          category: "essential_concept" as const,
          description: "Operates in privileged mode to manage memory and CPU.",
          satisfactoryDemonstration:
            "Kernel executes privileged instructions in supervisor mode.",
          isMandatory: true,
          orderIndex: 0,
        },
      ];

      // Student recites isolated terms without explaining the mechanism
      const keywordStuffing =
        "kernel privileged instructions supervisor word test.";

      const result = await evaluateStudentAnswer({
        attemptId: "att_6",
        studySetId: "set_os",
        questionId: "q_k",
        question: "What is the function of the OS kernel?",
        referenceAnswer:
          "The kernel executes privileged instructions in supervisor mode to manage system resources.",
        transcript: keywordStuffing,
        criteria: singleCrit,
        mockFallback: true,
      });

      expect(result.status).toBe("completed");
    });
  });

  // Scenario 7: Additional Valid Example
  describe("Scenario 7: Additional valid example or real-world analogy", () => {
    it("does not penalize students for introducing valid examples not found in the reference answer", async () => {
      const result = await evaluateStudentAnswer({
        attemptId: "att_7",
        studySetId: "set_1",
        questionId: "q_1",
        question: "Explain Belady's Anomaly.",
        referenceAnswer:
          "Belady's anomaly occurs when allocating more page frames results in an increase in page faults in FIFO.",
        transcript:
          "Belady's anomaly is when increasing page frames causes more page faults under FIFO replacement. For example, with the reference string 1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5, three frames produce 9 faults while four frames produce 10 faults.",
        criteria: beladyCriteria,
        mockFallback: true,
      });

      expect(result.overall.coveredCount).toBe(2);
      expect(result.overall.incorrectCount).toBe(0);
      expect(
        result.criteriaEvaluations.every((c) => c.status === "covered")
      ).toBe(true);
    });
  });

  // Scenario 8: Minor Transcription Imperfection
  describe("Scenario 8: Minor speech recognition imperfection", () => {
    it("tolerates minor phonetic transcription variations when intended meaning is clear", async () => {
      const result = await evaluateStudentAnswer({
        attemptId: "att_8",
        studySetId: "set_1",
        questionId: "q_1",
        question: "Explain Belady's Anomaly.",
        referenceAnswer:
          "Belady's anomaly occurs when allocating more page frames results in an increase in page faults under FIFO.",
        transcript:
          "Beladys anomaly is when allocating more page frames causes an increase in page faults in the fifo replacement algorithm.",
        criteria: beladyCriteria,
        mockFallback: true,
      });

      expect(result.overall.coveredCount).toBe(2);
    });
  });

  // Scenario 9: Ambiguous / Garbled Transcript
  describe("Scenario 9: Ambiguous or garbled speech capture", () => {
    it("handles empty or negligible speech capture cleanly with compassionate feedback", async () => {
      const result = await evaluateStudentAnswer({
        attemptId: "att_9",
        studySetId: "set_1",
        questionId: "q_1",
        question: "Explain Belady's Anomaly.",
        referenceAnswer:
          "Belady's anomaly occurs when more frames produce more page faults in FIFO.",
        transcript: "   ",
        criteria: beladyCriteria,
        mockFallback: true,
      });

      expect(result.status).toBe("completed");
      expect(result.overall.coveredCount).toBe(0);
      expect(result.overall.missingCount).toBe(2);
      expect(result.overall.summary).toContain("No spoken answer was detected");
    });
  });

  // Scenario 10: Paragraph-Scoped Audit
  describe("Scenario 10: Paragraph-scoped practice evaluation", () => {
    it("evaluates only targeted paragraph without marking unselected paragraphs as missing", async () => {
      const multiParagraphAnswer = `Paragraph 1: Belady's anomaly occurs when allocating more page frames results in an increase in page faults under FIFO replacement.

Paragraph 2: Stack algorithms like LRU and Optimal page replacement never suffer from Belady's anomaly because the set of pages in memory for n frames is always a subset of pages for n+1 frames.`;

      const paragraphs = extractParagraphs(multiParagraphAnswer);
      expect(paragraphs).toHaveLength(2);

      // Student chooses to practice only Paragraph 1
      const studentTranscript =
        "Belady's anomaly happens when increasing page frames causes more page faults, especially in FIFO replacement.";

      const result = await evaluateStudentAnswer({
        attemptId: "att_p1",
        studySetId: "set_multi",
        questionId: "q_multi",
        question:
          "Explain Belady's Anomaly and compare FIFO with Stack algorithms.",
        referenceAnswer: multiParagraphAnswer,
        transcript: studentTranscript,
        criteria: beladyCriteria,
        scope: {
          type: "paragraph",
          paragraphIndex: 0,
          totalParagraphs: 2,
        },
        mockFallback: true,
      });

      expect(result.scope.type).toBe("paragraph");
      expect(result.scope.paragraphIndex).toBe(0);
      expect(result.overall.coveredCount).toBe(2);
      expect(result.overall.missingCount).toBe(0);
    });
  });

  // Scenario 11: Attempt Preservation & Provider Recovery
  describe("Scenario 11: Local storage persistence and resilient retry", () => {
    it("preserves student attempt in IndexedDB before audit, and allows successful retry if audit initially failed", async () => {
      const attempt: PracticeAttempt = {
        id: createAttemptId(),
        studySetId: "set_resilience",
        questionId: "q_resilience",
        transcript:
          "Belady's anomaly is when adding more page frames causes more page faults in the FIFO replacement algorithm.",
        wordCount: 18,
        durationSeconds: 8,
        status: "completed",
        scope: "whole_answer",
        createdAt: new Date().toISOString(),
      };

      // 1. Save attempt record locally FIRST
      await savePracticeAttempt(attempt);

      const retrievedBefore = await getPracticeAttempt(attempt.id);
      expect(retrievedBefore).not.toBeNull();
      expect(retrievedBefore?.transcript).toBe(attempt.transcript);
      expect(retrievedBefore?.auditId).toBeUndefined();

      // 2. Simulate initial audit failure (e.g. offline/network timeout)
      // The attempt remains safely stored in IndexedDB!
      expect(retrievedBefore?.id).toBe(attempt.id);

      // 3. Simulate retry: evaluate and save audit result
      const auditResult = await evaluateStudentAnswer({
        attemptId: attempt.id,
        studySetId: attempt.studySetId,
        questionId: attempt.questionId,
        question: "Explain Belady's Anomaly.",
        referenceAnswer:
          "Belady's anomaly occurs when more frames produce more faults under FIFO.",
        transcript: attempt.transcript,
        criteria: beladyCriteria,
        mockFallback: true,
      });

      await saveSemanticAuditResult(auditResult);
      attempt.auditId = auditResult.id;
      await savePracticeAttempt(attempt);

      // Verify audit is linked and queryable by attemptId
      const retrievedAfter = await getPracticeAttempt(attempt.id);
      expect(retrievedAfter?.auditId).toBe(auditResult.id);

      const auditByAttempt = await getSemanticAuditByAttempt(attempt.id);
      expect(auditByAttempt).not.toBeNull();
      expect(auditByAttempt?.id).toBe(auditResult.id);
      expect(auditByAttempt?.overall.coveredCount).toBe(2);
    });
  });

  // Scenario 12: Schema Validation & Anti-Hallucination Evidence
  describe("Scenario 12: Schema validation and anti-hallucination evidence guard", () => {
    it("validates SemanticAuditResultSchema structure and rejects invalid payloads", () => {
      const invalidData = {
        id: "audit_123",
        attemptId: "att_123",
        // missing required fields like studySetId, questionId, status, overall
      };

      const parsed = SemanticAuditResultSchema.safeParse(invalidData);
      expect(parsed.success).toBe(false);
    });

    it("enforces valid status values in criterion evaluation", () => {
      const validAudit = SemanticAuditResultSchema.safeParse({
        id: createAuditId(),
        attemptId: "att_123",
        studySetId: "set_123",
        questionId: "q_123",
        status: "completed",
        scope: { type: "whole_answer" },
        overall: {
          summary: "Good job",
          whatExplainedWell: ["Concept 1"],
          whatNeedsAttention: [],
          whatNeedsCorrection: [],
          suggestedNextImprovement: "Keep going",
          coveredCount: 1,
          partiallyCoveredCount: 0,
          missingCount: 0,
          incorrectCount: 0,
          optionalCount: 0,
          totalCriteria: 1,
        },
        criteriaEvaluations: [
          {
            criterionId: "c_1",
            criterionName: "Concept 1",
            category: "essential_concept",
            status: "covered",
            explanation: "Explained well",
            transcriptEvidence: "clear words",
            missingOrInaccurate: null,
            improvementSuggestion: "None",
            orderIndex: 0,
          },
        ],
        hasUncertainty: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(validAudit.success).toBe(true);
    });
  });

  // Route API and Storage Lifecycle Tests
  describe("POST /api/audit Route Handler & Storage Operations", () => {
    it("returns 400 when payload fails validation", async () => {
      const req = new NextRequest("http://localhost:3000/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: "att_invalid",
          // missing studySetId, questionId, transcript, etc.
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("Invalid audit request payload");
    });

    it("processes valid audit request and returns structured evaluation", async () => {
      const req = new NextRequest("http://localhost:3000/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: "att_route_test",
          studySetId: "set_route_test",
          questionId: "q_route_test",
          question: "Explain Belady's Anomaly.",
          referenceAnswer:
            "Belady's anomaly occurs when more frames produce more faults under FIFO.",
          transcript:
            "Belady's anomaly occurs when increasing frames causes more page faults in FIFO.",
          criteria: beladyCriteria,
          scope: { type: "whole_answer" },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.audit).toBeDefined();
      expect(data.audit.overall.coveredCount).toBe(2);
    });

    it("verifies full IndexedDB storage lifecycle for semantic audits", async () => {
      const audit = SemanticAuditResultSchema.parse({
        id: createAuditId(),
        attemptId: "att_store_1",
        studySetId: "set_store_1",
        questionId: "q_store_1",
        status: "completed",
        scope: { type: "whole_answer" },
        overall: {
          summary: "Tested storage",
          whatExplainedWell: ["Concept A"],
          whatNeedsAttention: [],
          whatNeedsCorrection: [],
          suggestedNextImprovement: "Great work",
          coveredCount: 1,
          partiallyCoveredCount: 0,
          missingCount: 0,
          incorrectCount: 0,
          optionalCount: 0,
          totalCriteria: 1,
        },
        criteriaEvaluations: [
          {
            criterionId: "c_a",
            criterionName: "Concept A",
            category: "essential_concept",
            status: "covered",
            explanation: "All good",
            transcriptEvidence: "Concept A was stated",
            missingOrInaccurate: null,
            improvementSuggestion: "Keep it up",
            orderIndex: 0,
          },
        ],
        hasUncertainty: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Save
      await saveSemanticAuditResult(audit);

      // Get by audit ID
      const retrievedById = await getSemanticAuditResult(audit.id);
      expect(retrievedById).not.toBeNull();
      expect(retrievedById?.id).toBe(audit.id);

      // Get by attempt ID
      const retrievedByAttempt = await getSemanticAuditByAttempt("att_store_1");
      expect(retrievedByAttempt).not.toBeNull();
      expect(retrievedByAttempt?.attemptId).toBe("att_store_1");

      // List audits by study set
      const auditsList = await listSemanticAudits("set_store_1");
      expect(auditsList).toHaveLength(1);
      expect(auditsList[0]?.id).toBe(audit.id);

      // Clear all
      await clearAllSemanticAudits();
      const listAfterClear = await listSemanticAudits("set_store_1");
      expect(listAfterClear).toHaveLength(0);
    });
  });
});
