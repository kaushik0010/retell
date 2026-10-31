import { describe, it, expect, beforeEach } from "vitest";
import {
  saveStudySet,
  getStudySet,
  savePracticeAttempt,
  saveSemanticAuditResult,
  getPracticeAttemptsByQuestion,
  getAttemptWithAudit,
  clearAllStudySets,
  clearAllPracticeAttempts,
  clearAllSemanticAudits,
} from "@/lib/storage/study-store";
import { StudySet } from "@/lib/domain/study-set";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";
import {
  compareAttempts,
  checkScopeCompatibility,
} from "@/lib/domain/attempt-comparison";

describe("Day 5 Complete End-to-End Learning & Progress Workflow", () => {
  beforeEach(async () => {
    await clearAllStudySets();
    await clearAllPracticeAttempts();
    await clearAllSemanticAudits();
  });

  const sampleStudySet: StudySet = {
    id: "set_exam_prep",
    material: {
      id: "mat_1",
      title: "Operating Systems — Virtual Memory",
      sourceText:
        "Virtual memory creates an illusion of a large contiguous address space using paging. The MMU translates virtual addresses to physical frame numbers via page tables. When a page is not resident in RAM, a page fault occurs.",
      characterCount: 220,
      createdAt: "2026-10-31T07:00:00.000Z",
      updatedAt: "2026-10-31T07:00:00.000Z",
    },
    questions: [
      {
        id: "q_vm_paging",
        studyMaterialId: "mat_1",
        question:
          "Explain how virtual memory and paging work, and what happens during a page fault.",
        referenceAnswer:
          "Virtual memory provides an illusion of large continuous memory. The hardware MMU uses page tables to translate virtual addresses to physical RAM frames. When a requested page is not in RAM, the OS handles a page fault interrupt by swapping the page from disk.",
        sourceExcerpt:
          "Virtual memory creates an illusion of a large contiguous address space using paging.",
        orderIndex: 0,
      },
    ],
    rubrics: {
      q_vm_paging: {
        id: "rubric_vm_paging",
        questionId: "q_vm_paging",
        studyMaterialId: "mat_1",
        criteria: [
          {
            id: "crit_vm_illusion",
            name: "Virtual Memory Illusion",
            category: "essential_concept",
            description: "Provides an illusion of large contiguous memory.",
            satisfactoryDemonstration:
              "Mentions illusion of large address space.",
            isMandatory: true,
            orderIndex: 0,
          },
          {
            id: "crit_mmu_translation",
            name: "MMU Address Translation",
            category: "essential_concept",
            description: "MMU translates virtual addresses using page tables.",
            satisfactoryDemonstration: "Mentions MMU and page tables.",
            isMandatory: true,
            orderIndex: 1,
          },
          {
            id: "crit_page_fault",
            name: "Page Fault Interrupt",
            category: "essential_concept",
            description: "Page fault occurs when page is missing from RAM.",
            satisfactoryDemonstration:
              "Explains page fault and loading from disk.",
            isMandatory: true,
            orderIndex: 2,
          },
        ],
        updatedAt: "2026-10-31T07:00:00.000Z",
      },
    },
    createdAt: "2026-10-31T07:00:00.000Z",
    updatedAt: "2026-10-31T07:00:00.000Z",
  };

  it("completes full repeated student practice journey: save -> attempt 1 -> attempt 2 -> compare", async () => {
    // 1. Save study set
    await saveStudySet(sampleStudySet);
    const retrievedSet = await getStudySet("set_exam_prep");
    expect(retrievedSet).not.toBeNull();
    expect(retrievedSet?.material.title).toBe(
      "Operating Systems — Virtual Memory"
    );

    // 2. Student completes Attempt 1
    const attempt1: PracticeAttempt = {
      id: "att_run_1",
      studySetId: "set_exam_prep",
      questionId: "q_vm_paging",
      transcript:
        "Virtual memory creates an illusion of large continuous memory space for programs.",
      wordCount: 12,
      durationSeconds: 15,
      status: "completed",
      scope: "whole_answer",
      createdAt: "2026-10-31T08:00:00.000Z",
    };
    await savePracticeAttempt(attempt1);

    // Audit for Attempt 1
    const audit1: SemanticAuditResult = {
      id: "audit_run_1",
      attemptId: "att_run_1",
      studySetId: "set_exam_prep",
      questionId: "q_vm_paging",
      status: "completed",
      scope: { type: "whole_answer" },
      overall: {
        summary:
          "Understood virtual memory illusion, missed MMU and page fault.",
        whatExplainedWell: ["Virtual Memory Illusion"],
        whatNeedsAttention: ["MMU Address Translation", "Page Fault Interrupt"],
        whatNeedsCorrection: [],
        suggestedNextImprovement: "Explain how the MMU translates addresses.",
        coveredCount: 1,
        partiallyCoveredCount: 0,
        missingCount: 2,
        incorrectCount: 0,
        optionalCount: 0,
        totalCriteria: 3,
      },
      criteriaEvaluations: [
        {
          criterionId: "crit_vm_illusion",
          criterionName: "Virtual Memory Illusion",
          category: "essential_concept",
          status: "covered",
          explanation: "Accurately stated illusion of large continuous memory.",
          transcriptEvidence: "illusion of large continuous memory space",
          improvementSuggestion: "Well done.",
          orderIndex: 0,
        },
        {
          criterionId: "crit_mmu_translation",
          criterionName: "MMU Address Translation",
          category: "essential_concept",
          status: "missing",
          explanation: "MMU was not mentioned.",
          improvementSuggestion: "Mention MMU translation.",
          orderIndex: 1,
        },
        {
          criterionId: "crit_page_fault",
          criterionName: "Page Fault Interrupt",
          category: "essential_concept",
          status: "missing",
          explanation: "Page faults were not described.",
          improvementSuggestion: "Describe page fault interrupt.",
          orderIndex: 2,
        },
      ],
      hasUncertainty: false,
      createdAt: "2026-10-31T08:00:05.000Z",
      updatedAt: "2026-10-31T08:00:05.000Z",
    };
    attempt1.auditId = "audit_run_1";
    await savePracticeAttempt(attempt1);
    await saveSemanticAuditResult(audit1);

    // 3. Student reviews feedback and completes Attempt 2
    const attempt2: PracticeAttempt = {
      id: "att_run_2",
      studySetId: "set_exam_prep",
      questionId: "q_vm_paging",
      transcript:
        "Virtual memory gives programs an illusion of large continuous RAM. The memory management unit or MMU translates virtual addresses to physical pages using page tables. When a page is missing from RAM, a page fault occurs.",
      wordCount: 38,
      durationSeconds: 32,
      status: "completed",
      scope: "whole_answer",
      createdAt: "2026-10-31T08:20:00.000Z",
    };
    await savePracticeAttempt(attempt2);

    // Audit for Attempt 2
    const audit2: SemanticAuditResult = {
      id: "audit_run_2",
      attemptId: "att_run_2",
      studySetId: "set_exam_prep",
      questionId: "q_vm_paging",
      status: "completed",
      scope: { type: "whole_answer" },
      overall: {
        summary: "Excellent complete explanation of all concepts.",
        whatExplainedWell: [
          "Virtual Memory Illusion",
          "MMU Address Translation",
          "Page Fault Interrupt",
        ],
        whatNeedsAttention: [],
        whatNeedsCorrection: [],
        suggestedNextImprovement: "You have mastered this question.",
        coveredCount: 3,
        partiallyCoveredCount: 0,
        missingCount: 0,
        incorrectCount: 0,
        optionalCount: 0,
        totalCriteria: 3,
      },
      criteriaEvaluations: [
        {
          criterionId: "crit_vm_illusion",
          criterionName: "Virtual Memory Illusion",
          category: "essential_concept",
          status: "covered",
          explanation: "Illusion of continuous RAM clearly stated.",
          transcriptEvidence: "illusion of large continuous RAM",
          improvementSuggestion: "Clear definition.",
          orderIndex: 0,
        },
        {
          criterionId: "crit_mmu_translation",
          criterionName: "MMU Address Translation",
          category: "essential_concept",
          status: "covered",
          explanation: "MMU and page tables correctly explained.",
          transcriptEvidence:
            "memory management unit or MMU translates virtual addresses",
          improvementSuggestion: "Accurate hardware explanation.",
          orderIndex: 1,
        },
        {
          criterionId: "crit_page_fault",
          criterionName: "Page Fault Interrupt",
          category: "essential_concept",
          status: "covered",
          explanation: "Page fault missing from RAM stated.",
          transcriptEvidence:
            "When a page is missing from RAM, a page fault occurs",
          improvementSuggestion: "Correct handling.",
          orderIndex: 2,
        },
      ],
      hasUncertainty: false,
      createdAt: "2026-10-31T08:20:05.000Z",
      updatedAt: "2026-10-31T08:20:05.000Z",
    };
    attempt2.auditId = "audit_run_2";
    await savePracticeAttempt(attempt2);
    await saveSemanticAuditResult(audit2);

    // 4. Verify Attempt History contains both attempts ordered newest-first
    const history = await getPracticeAttemptsByQuestion(
      "set_exam_prep",
      "q_vm_paging"
    );
    expect(history.length).toBe(2);
    expect(history[0]?.id).toBe("att_run_2");
    expect(history[1]?.id).toBe("att_run_1");

    // 5. Compare Attempt 1 and Attempt 2
    const comparison = compareAttempts({
      attemptA: attempt1,
      attemptB: attempt2,
      auditA: audit1,
      auditB: audit2,
      criteria: sampleStudySet.rubrics["q_vm_paging"]!.criteria,
    });

    expect(comparison.isComparable).toBe(true);
    expect(comparison.summary.conceptsCoveredEarlier).toBe(1);
    expect(comparison.summary.conceptsCoveredLater).toBe(3);
    expect(comparison.summary.netProgress).toBe(2);
    expect(comparison.summary.improvedConcepts).toContain(
      "MMU Address Translation"
    );
    expect(comparison.summary.improvedConcepts).toContain(
      "Page Fault Interrupt"
    );
    expect(comparison.summary.retainedConcepts).toContain(
      "Virtual Memory Illusion"
    );
    expect(comparison.summary.wordsSpokenChange).toBe(26); // 38 - 12
    expect(comparison.summary.headline).toContain("2 more key concepts");

    // 6. Test Scope Isolation: Attempt with Paragraph 1 cannot be compared with Whole Answer
    const paragraphAttempt: PracticeAttempt = {
      id: "att_run_p1",
      studySetId: "set_exam_prep",
      questionId: "q_vm_paging",
      transcript: "Only paragraph 1 spoken.",
      wordCount: 5,
      durationSeconds: 8,
      status: "completed",
      scope: "paragraph",
      paragraphIndex: 0,
      totalParagraphs: 2,
      createdAt: "2026-10-31T08:40:00.000Z",
    };
    await savePracticeAttempt(paragraphAttempt);

    const crossScopeCheck = checkScopeCompatibility(attempt2, paragraphAttempt);
    expect(crossScopeCheck.compatible).toBe(false);
    if (!crossScopeCheck.compatible) {
      expect(crossScopeCheck.reason).toContain("same scope");
    }

    // 7. Verify Data Integrity on Simulated Storage Reload
    const reloadedAtt1 = await getAttemptWithAudit("att_run_1");
    const reloadedAtt2 = await getAttemptWithAudit("att_run_2");

    expect(reloadedAtt1?.attempt.transcript).toBe(attempt1.transcript);
    expect(reloadedAtt1?.audit?.overall.summary).toContain(
      "Understood virtual memory illusion"
    );
    expect(reloadedAtt2?.attempt.transcript).toBe(attempt2.transcript);
    expect(reloadedAtt2?.audit?.overall.summary).toContain(
      "Excellent complete explanation"
    );
  });
});
