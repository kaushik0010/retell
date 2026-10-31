import { describe, it, expect, beforeEach } from "vitest";
import {
  savePracticeAttempt,
  getPracticeAttemptsByQuestion,
  getPreviousPracticeAttempt,
  getAttemptWithAudit,
  saveSemanticAuditResult,
  getStorageDiagnostics,
  clearAllPracticeAttempts,
  clearAllSemanticAudits,
} from "@/lib/storage/study-store";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";

describe("Storage Resilience, Diagnostics, and Attempt History Queries", () => {
  beforeEach(async () => {
    await clearAllPracticeAttempts();
    await clearAllSemanticAudits();
  });

  const attempt1: PracticeAttempt = {
    id: "att_101",
    studySetId: "set_alpha",
    questionId: "q_1",
    transcript: "First spoken explanation of recursion.",
    wordCount: 5,
    durationSeconds: 10,
    status: "completed",
    scope: "whole_answer",
    createdAt: "2026-10-31T09:00:00.000Z",
  };

  const attempt2: PracticeAttempt = {
    id: "att_102",
    studySetId: "set_alpha",
    questionId: "q_1",
    transcript:
      "Second spoken explanation of recursion with base case and recursive step.",
    wordCount: 11,
    durationSeconds: 18,
    status: "completed",
    scope: "whole_answer",
    createdAt: "2026-10-31T09:15:00.000Z",
  };

  const attempt3: PracticeAttempt = {
    id: "att_103",
    studySetId: "set_alpha",
    questionId: "q_1",
    transcript:
      "Third explanation detailing base case, call stack, and termination condition.",
    wordCount: 12,
    durationSeconds: 22,
    status: "completed",
    scope: "whole_answer",
    createdAt: "2026-10-31T09:30:00.000Z",
  };

  const diffQuestionAttempt: PracticeAttempt = {
    id: "att_201",
    studySetId: "set_alpha",
    questionId: "q_2",
    transcript: "Explanation of binary search trees.",
    wordCount: 5,
    durationSeconds: 15,
    status: "completed",
    scope: "whole_answer",
    createdAt: "2026-10-31T09:40:00.000Z",
  };

  it("retrieves attempts filtered by question ordered newest-first", async () => {
    await savePracticeAttempt(attempt1);
    await savePracticeAttempt(attempt2);
    await savePracticeAttempt(attempt3);
    await savePracticeAttempt(diffQuestionAttempt);

    const q1Attempts = await getPracticeAttemptsByQuestion("set_alpha", "q_1");
    expect(q1Attempts.length).toBe(3);
    expect(q1Attempts[0]?.id).toBe("att_103"); // Newest
    expect(q1Attempts[1]?.id).toBe("att_102");
    expect(q1Attempts[2]?.id).toBe("att_101"); // Oldest
  });

  it("finds the immediately preceding attempt for the same question", async () => {
    await savePracticeAttempt(attempt1);
    await savePracticeAttempt(attempt2);
    await savePracticeAttempt(attempt3);

    // Predecessor of attempt 3 is attempt 2
    const prevTo3 = await getPreviousPracticeAttempt("att_103");
    expect(prevTo3).not.toBeNull();
    expect(prevTo3?.id).toBe("att_102");

    // Predecessor of attempt 2 is attempt 1
    const prevTo2 = await getPreviousPracticeAttempt("att_102");
    expect(prevTo2).not.toBeNull();
    expect(prevTo2?.id).toBe("att_101");

    // Predecessor of attempt 1 (the earliest) is null
    const prevTo1 = await getPreviousPracticeAttempt("att_101");
    expect(prevTo1).toBeNull();
  });

  it("returns null for non-existent attempt predecessor lookup", async () => {
    const prev = await getPreviousPracticeAttempt("non_existent_id");
    expect(prev).toBeNull();
  });

  it("loads an attempt and its associated semantic audit together", async () => {
    const audit: SemanticAuditResult = {
      id: "audit_102",
      attemptId: "att_102",
      studySetId: "set_alpha",
      questionId: "q_1",
      status: "completed",
      scope: { type: "whole_answer" },
      overall: {
        summary: "Good coverage of recursion.",
        whatExplainedWell: ["Base case"],
        whatNeedsAttention: [],
        whatNeedsCorrection: [],
        suggestedNextImprovement: "Practice stack overflow examples.",
        coveredCount: 1,
        partiallyCoveredCount: 0,
        missingCount: 0,
        incorrectCount: 0,
        optionalCount: 0,
        totalCriteria: 1,
      },
      criteriaEvaluations: [
        {
          criterionId: "crit_base_case",
          criterionName: "Base Case",
          category: "essential_concept",
          status: "covered",
          explanation: "Explained base case clearly.",
          improvementSuggestion: "Keep this up.",
          orderIndex: 0,
        },
      ],
      hasUncertainty: false,
      createdAt: "2026-10-31T09:15:05.000Z",
      updatedAt: "2026-10-31T09:15:05.000Z",
    };

    attempt2.auditId = "audit_102";
    await savePracticeAttempt(attempt2);
    await saveSemanticAuditResult(audit);

    const loaded = await getAttemptWithAudit("att_102");
    expect(loaded).not.toBeNull();
    expect(loaded?.attempt.id).toBe("att_102");
    expect(loaded?.audit?.id).toBe("audit_102");
    expect(loaded?.audit?.overall.summary).toContain(
      "Good coverage of recursion"
    );
  });

  it("returns storage diagnostics with total entity counts", async () => {
    await savePracticeAttempt(attempt1);
    await savePracticeAttempt(attempt2);

    const diag = await getStorageDiagnostics();
    expect(diag).toHaveProperty("isSupported");
    expect(diag).toHaveProperty("usingFallback");
    expect(diag.attemptCount).toBeGreaterThanOrEqual(2);
  });
});
