import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  deriveConceptTransition,
  compareAttempts,
  deriveProgressSummary,
  findPrecedingComparableAttempt,
  AttemptComparisonResult,
} from "@/lib/domain/attempt-comparison";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";
import { RubricCriterion } from "@/lib/domain/study-set";
import { ProgressSummaryCard } from "@/features/answer-review/ProgressSummaryCard";
import { AnswerReviewView } from "@/features/answer-review/AnswerReviewView";
import { StudySet } from "@/lib/domain/study-set";

describe("Visual Progress Summary on Answer Review", () => {
  // Test criteria fixtures
  const fourCriteria: RubricCriterion[] = [
    {
      id: "crit_1",
      name: "Victim selection on page fault",
      category: "essential_concept",
      description: "Decides which page to remove on fault.",
      satisfactoryDemonstration: "Explains victim selection.",
      isMandatory: true,
      orderIndex: 0,
    },
    {
      id: "crit_2",
      name: "Core terminology and quality goals",
      category: "technical_anchor",
      description: "Mentions FIFO, LRU, Optimal.",
      satisfactoryDemonstration: "Names the 3 algorithms.",
      isMandatory: true,
      orderIndex: 1,
    },
    {
      id: "crit_3",
      name: "Rule to tradeoff comparison",
      category: "relationship_sequence",
      description: "Compares overhead vs hit rate.",
      satisfactoryDemonstration: "Contrasts LRU and FIFO.",
      isMandatory: true,
      orderIndex: 2,
    },
    {
      id: "crit_4",
      name: "Avoid FIFO-LRU-Optimal confusions",
      category: "accuracy_constraint",
      description: "Avoids Belady anomaly misconceptions.",
      satisfactoryDemonstration: "Accurate distinction.",
      isMandatory: true,
      orderIndex: 3,
    },
  ];

  // Base attempt fixtures
  const attemptBaseline: PracticeAttempt = {
    id: "att_base_1",
    studySetId: "set_os_1",
    questionId: "q_page_rep",
    transcript: "Page replacement chooses a victim frame. FIFO is simplest.",
    wordCount: 10,
    durationSeconds: 15,
    status: "completed",
    scope: "whole_answer",
    createdAt: "2026-11-03T10:00:00.000Z",
  };

  const attemptFollowup: PracticeAttempt = {
    id: "att_follow_2",
    studySetId: "set_os_1",
    questionId: "q_page_rep",
    transcript:
      "Page replacement decides victim page. Algorithms include FIFO, LRU, and Optimal. LRU has higher hardware overhead than FIFO.",
    wordCount: 20,
    durationSeconds: 30,
    status: "completed",
    scope: "whole_answer",
    createdAt: "2026-11-03T10:15:00.000Z",
  };

  // Helper to build mock audits
  function createAudit(
    attemptId: string,
    evals: Array<{
      id: string;
      status: "covered" | "partially_covered" | "missing" | "incorrect";
    }>
  ): SemanticAuditResult {
    const coveredCount = evals.filter((e) => e.status === "covered").length;
    const partiallyCoveredCount = evals.filter(
      (e) => e.status === "partially_covered"
    ).length;
    const missingCount = evals.filter((e) => e.status === "missing").length;
    const incorrectCount = evals.filter((e) => e.status === "incorrect").length;

    return {
      id: `audit_${attemptId}`,
      attemptId,
      studySetId: "set_os_1",
      questionId: "q_page_rep",
      status: "completed",
      scope: { type: "whole_answer" },
      overall: {
        summary: "Audit summary.",
        whatExplainedWell: evals
          .filter((e) => e.status === "covered")
          .map((e) => e.id),
        whatNeedsAttention: evals
          .filter(
            (e) => e.status === "missing" || e.status === "partially_covered"
          )
          .map((e) => e.id),
        whatNeedsCorrection: evals
          .filter((e) => e.status === "incorrect")
          .map((e) => e.id),
        suggestedNextImprovement: "Keep practicing.",
        coveredCount,
        partiallyCoveredCount,
        missingCount,
        incorrectCount,
        optionalCount: 0,
        totalCriteria: evals.length,
      },
      criteriaEvaluations: evals.map((e, idx) => {
        const crit =
          fourCriteria.find((c) => c.id === e.id) || fourCriteria[idx]!;
        return {
          criterionId: crit.id,
          criterionName: crit.name,
          category: crit.category,
          status: e.status,
          explanation: `Evaluation for ${crit.name}`,
          transcriptEvidence: "Evidence transcript text",
          improvementSuggestion: "Practice this item",
          orderIndex: idx,
        };
      }),
      hasUncertainty: false,
      createdAt: "2026-11-03T10:00:00.000Z",
      updatedAt: "2026-11-03T10:00:00.000Z",
    };
  }

  describe("1. Transition Classification & Regression Handling", () => {
    it("classifies covered -> partially_covered as regression", () => {
      const res = deriveConceptTransition(
        "covered",
        "partially_covered",
        "Core terminology"
      );
      expect(res.transition).toBe("regressed");
      expect(res.message).toContain("previously covered");
      expect(res.message).toContain("partially explained");
    });

    it("classifies partially_covered -> covered as improvement", () => {
      const res = deriveConceptTransition(
        "partially_covered",
        "covered",
        "Core terminology"
      );
      expect(res.transition).toBe("improved");
      expect(res.message).toContain("You improved");
    });

    it("classifies missing -> partially_covered as partial progress", () => {
      const res = deriveConceptTransition(
        "missing",
        "partially_covered",
        "Core terminology"
      );
      expect(res.transition).toBe("partial_progress");
      expect(res.message).toContain("Partial progress");
    });

    it("classifies covered -> covered as retained", () => {
      const res = deriveConceptTransition(
        "covered",
        "covered",
        "Core terminology"
      );
      expect(res.transition).toBe("retained");
      expect(res.message).toContain("Maintained coverage");
    });
  });

  describe("2. Progress Summary Outcome Calculation", () => {
    it("calculates Improvement outcome (+1 concept, 75% -> 100%)", () => {
      // Earlier attempt: 3 of 4 covered (crit_2 is partially covered)
      const auditEarlier = createAudit(attemptBaseline.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "partially_covered" },
        { id: "crit_3", status: "covered" },
        { id: "crit_4", status: "covered" },
      ]);
      // Later attempt: 4 of 4 covered (crit_2 improved to covered)
      const auditLater = createAudit(attemptFollowup.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "covered" },
        { id: "crit_3", status: "covered" },
        { id: "crit_4", status: "covered" },
      ]);

      const comp = compareAttempts({
        attemptA: attemptBaseline,
        attemptB: attemptFollowup,
        auditA: auditEarlier,
        auditB: auditLater,
        criteria: fourCriteria,
      });

      const summary = deriveProgressSummary(comp);
      expect(summary).not.toBeNull();
      expect(summary!.outcome).toBe("improvement");
      expect(summary!.statusLabel).toBe("Improved");
      expect(summary!.headline).toBe("+1 concept");
      expect(summary!.subheadline).toContain("one more important concept");
      expect(summary!.earlierCovered).toBe(3);
      expect(summary!.laterCovered).toBe(4);
      expect(summary!.totalCriteria).toBe(4);
      expect(summary!.earlierPercentage).toBe(75);
      expect(summary!.laterPercentage).toBe(100);
      expect(summary!.mostMeaningfulChange).toBe(
        "Core terminology and quality goals: Partially covered → Covered"
      );
    });

    it("calculates Regression outcome (−1 concept, Needs attention)", () => {
      // Earlier attempt: 4 of 4 covered
      const auditEarlier = createAudit(attemptBaseline.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "covered" },
        { id: "crit_3", status: "covered" },
        { id: "crit_4", status: "covered" },
      ]);
      // Later attempt: 3 of 4 covered (crit_2 regressed to partially covered)
      const auditLater = createAudit(attemptFollowup.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "partially_covered" },
        { id: "crit_3", status: "covered" },
        { id: "crit_4", status: "covered" },
      ]);

      const comp = compareAttempts({
        attemptA: attemptBaseline,
        attemptB: attemptFollowup,
        auditA: auditEarlier,
        auditB: auditLater,
        criteria: fourCriteria,
      });

      const summary = deriveProgressSummary(comp);
      expect(summary).not.toBeNull();
      expect(summary!.outcome).toBe("regression");
      expect(summary!.statusLabel).toBe("Needs attention");
      expect(summary!.headline).toBe("−1 concept");
      expect(summary!.subheadline).toContain("one fewer key concept");
      expect(summary!.earlierCovered).toBe(4);
      expect(summary!.laterCovered).toBe(3);
      expect(summary!.earlierPercentage).toBe(100);
      expect(summary!.laterPercentage).toBe(75);
      expect(summary!.mostMeaningfulChange).toBe(
        "Core terminology and quality goals: Covered → Partially covered"
      );
    });

    it("calculates No Change outcome (Consistent coverage, unchanged statuses)", () => {
      // Both attempts have identical 3 of 4 covered, same missing concept
      const auditEarlier = createAudit(attemptBaseline.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "covered" },
        { id: "crit_3", status: "covered" },
        { id: "crit_4", status: "missing" },
      ]);
      const auditLater = createAudit(attemptFollowup.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "covered" },
        { id: "crit_3", status: "covered" },
        { id: "crit_4", status: "missing" },
      ]);

      const comp = compareAttempts({
        attemptA: attemptBaseline,
        attemptB: attemptFollowup,
        auditA: auditEarlier,
        auditB: auditLater,
        criteria: fourCriteria,
      });

      const summary = deriveProgressSummary(comp);
      expect(summary).not.toBeNull();
      expect(summary!.outcome).toBe("no_change");
      expect(summary!.statusLabel).toBe("No change");
      expect(summary!.headline).toBe("Consistent coverage");
      expect(summary!.subheadline).toContain("matched your previous attempt");
      expect(summary!.earlierCovered).toBe(3);
      expect(summary!.laterCovered).toBe(3);
      expect(summary!.earlierPercentage).toBe(75);
      expect(summary!.laterPercentage).toBe(75);
      expect(summary!.mostMeaningfulChange).toContain("Coverage maintained");
    });

    it("calculates Mixed Progress outcome (net count unchanged, but individual transitions exist)", () => {
      // Earlier attempt: crit_1 and crit_2 covered, crit_3 and crit_4 missing (2 of 4)
      const auditEarlier = createAudit(attemptBaseline.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "covered" },
        { id: "crit_3", status: "missing" },
        { id: "crit_4", status: "missing" },
      ]);
      // Later attempt: crit_1 covered, crit_2 missing (regressed!), crit_3 covered (improved!), crit_4 missing (2 of 4)
      const auditLater = createAudit(attemptFollowup.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "missing" },
        { id: "crit_3", status: "covered" },
        { id: "crit_4", status: "missing" },
      ]);

      const comp = compareAttempts({
        attemptA: attemptBaseline,
        attemptB: attemptFollowup,
        auditA: auditEarlier,
        auditB: auditLater,
        criteria: fourCriteria,
      });

      const summary = deriveProgressSummary(comp);
      expect(summary).not.toBeNull();
      expect(summary!.outcome).toBe("mixed_progress");
      expect(summary!.statusLabel).toBe("Mixed progress");
      expect(summary!.headline).toBe("Mixed changes");
      expect(summary!.subheadline).toContain(
        "Some concepts improved while others need more detail"
      );
      expect(summary!.earlierCovered).toBe(2);
      expect(summary!.laterCovered).toBe(2);
      expect(summary!.earlierPercentage).toBe(50);
      expect(summary!.laterPercentage).toBe(50);
      expect(summary!.mostMeaningfulChange).toContain(
        "Rule to tradeoff comparison: Missing → Covered"
      );
    });

    it("calculates Mixed Progress with net positive progress (+1 net concept)", () => {
      // Earlier: crit_1 covered (1 of 4)
      const auditEarlier = createAudit(attemptBaseline.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "missing" },
        { id: "crit_3", status: "missing" },
        { id: "crit_4", status: "missing" },
      ]);
      // Later: crit_1 missing (regressed!), crit_2 covered (improved!), crit_3 covered (improved!), crit_4 missing (2 of 4)
      const auditLater = createAudit(attemptFollowup.id, [
        { id: "crit_1", status: "missing" },
        { id: "crit_2", status: "covered" },
        { id: "crit_3", status: "covered" },
        { id: "crit_4", status: "missing" },
      ]);

      const comp = compareAttempts({
        attemptA: attemptBaseline,
        attemptB: attemptFollowup,
        auditA: auditEarlier,
        auditB: auditLater,
        criteria: fourCriteria,
      });

      const summary = deriveProgressSummary(comp);
      expect(summary).not.toBeNull();
      expect(summary!.outcome).toBe("mixed_progress");
      expect(summary!.statusLabel).toBe("Mixed progress");
      expect(summary!.headline).toBe("+1 net concept");
    });
  });

  describe("3. Scope Compatibility & Attempt Selection Rules", () => {
    it("matches matching paragraph-level attempts (Paragraph 2 vs Paragraph 2)", () => {
      const p2Earlier: PracticeAttempt = {
        ...attemptBaseline,
        id: "att_p2_early",
        scope: "paragraph",
        paragraphIndex: 1,
        totalParagraphs: 3,
        createdAt: "2026-11-03T09:00:00.000Z",
      };
      const p2Current: PracticeAttempt = {
        ...attemptFollowup,
        id: "att_p2_current",
        scope: "paragraph",
        paragraphIndex: 1,
        totalParagraphs: 3,
        createdAt: "2026-11-03T10:00:00.000Z",
      };

      const found = findPrecedingComparableAttempt(p2Current, [
        p2Earlier,
        p2Current,
      ]);
      expect(found).not.toBeNull();
      expect(found!.id).toBe("att_p2_early");
    });

    it("rejects different paragraphs (Paragraph 1 vs Paragraph 2)", () => {
      const p1Earlier: PracticeAttempt = {
        ...attemptBaseline,
        id: "att_p1_early",
        scope: "paragraph",
        paragraphIndex: 0,
        totalParagraphs: 3,
        createdAt: "2026-11-03T09:00:00.000Z",
      };
      const p2Current: PracticeAttempt = {
        ...attemptFollowup,
        id: "att_p2_current",
        scope: "paragraph",
        paragraphIndex: 1,
        totalParagraphs: 3,
        createdAt: "2026-11-03T10:00:00.000Z",
      };

      const found = findPrecedingComparableAttempt(p2Current, [
        p1Earlier,
        p2Current,
      ]);
      expect(found).toBeNull();
    });

    it("rejects mismatched whole_answer vs paragraph", () => {
      const wholeEarlier: PracticeAttempt = {
        ...attemptBaseline,
        id: "att_whole",
        scope: "whole_answer",
        createdAt: "2026-11-03T09:00:00.000Z",
      };
      const p2Current: PracticeAttempt = {
        ...attemptFollowup,
        id: "att_p2_current",
        scope: "paragraph",
        paragraphIndex: 1,
        totalParagraphs: 3,
        createdAt: "2026-11-03T10:00:00.000Z",
      };

      const found = findPrecedingComparableAttempt(p2Current, [
        wholeEarlier,
        p2Current,
      ]);
      expect(found).toBeNull();
    });

    it("skips intermediate incompatible attempts to find older compatible attempt", () => {
      // History in reverse order:
      // att_3: Paragraph 1 (current)
      // att_2: Paragraph 2 (incompatible with Paragraph 1)
      // att_1: Paragraph 1 (compatible with Paragraph 1)
      const att1: PracticeAttempt = {
        ...attemptBaseline,
        id: "att_1",
        scope: "paragraph",
        paragraphIndex: 0,
        totalParagraphs: 2,
        createdAt: "2026-11-03T08:00:00.000Z",
      };
      const att2: PracticeAttempt = {
        ...attemptBaseline,
        id: "att_2",
        scope: "paragraph",
        paragraphIndex: 1,
        totalParagraphs: 2,
        createdAt: "2026-11-03T09:00:00.000Z",
      };
      const att3Current: PracticeAttempt = {
        ...attemptFollowup,
        id: "att_3",
        scope: "paragraph",
        paragraphIndex: 0,
        totalParagraphs: 2,
        createdAt: "2026-11-03T10:00:00.000Z",
      };

      const found = findPrecedingComparableAttempt(att3Current, [
        att1,
        att2,
        att3Current,
      ]);
      expect(found).not.toBeNull();
      expect(found!.id).toBe("att_1");
    });
  });

  describe("4. Historical Attempt Compatibility", () => {
    it("handles legacy attempt lacking attempt.scope but possessing audit.scope", () => {
      const legacyAttempt: PracticeAttempt = {
        ...attemptBaseline,
        id: "att_legacy_1",
        scope: undefined, // legacy attempt without explicit scope
        createdAt: "2026-10-25T10:00:00.000Z",
      };
      const currentAttempt: PracticeAttempt = {
        ...attemptFollowup,
        id: "att_current_2",
        scope: "whole_answer",
        createdAt: "2026-11-03T10:00:00.000Z",
      };

      const legacyAudit = createAudit(legacyAttempt.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "missing" },
      ]);
      legacyAudit.scope = { type: "whole_answer" };

      const currentAudit = createAudit(currentAttempt.id, [
        { id: "crit_1", status: "covered" },
        { id: "crit_2", status: "covered" },
      ]);

      const found = findPrecedingComparableAttempt(
        currentAttempt,
        [legacyAttempt, currentAttempt],
        currentAudit,
        { [legacyAttempt.id]: legacyAudit, [currentAttempt.id]: currentAudit }
      );

      expect(found).not.toBeNull();
      expect(found!.id).toBe("att_legacy_1");
    });

    it("gracefully returns null when legacy attempt scope is completely unknown", () => {
      const legacyUnknown: PracticeAttempt = {
        ...attemptBaseline,
        id: "att_unknown",
        scope: undefined,
        createdAt: "2026-10-20T10:00:00.000Z",
      };
      const currentAttempt: PracticeAttempt = {
        ...attemptFollowup,
        id: "att_current",
        scope: "whole_answer",
        createdAt: "2026-11-03T10:00:00.000Z",
      };

      // Both attempt and audit lack scope
      const legacyAuditWithoutScope = {
        ...createAudit(legacyUnknown.id, []),
        scope: undefined as unknown as { type: "whole_answer" },
      };

      const found = findPrecedingComparableAttempt(
        currentAttempt,
        [legacyUnknown, currentAttempt],
        undefined,
        { [legacyUnknown.id]: legacyAuditWithoutScope }
      );

      expect(found).toBeNull();
    });

    it("returns null when comparison is incompatible", () => {
      const incompComparison: AttemptComparisonResult = {
        isComparable: false,
        incompatibilityReason: "Incompatible scopes",
        earlierAttempt: attemptBaseline,
        laterAttempt: attemptFollowup,
        earlierAudit: null,
        laterAudit: null,
        scopeDescription: "Incompatible",
        concepts: [],
        summary: {
          conceptsCoveredEarlier: 0,
          conceptsCoveredLater: 0,
          mandatoryTotal: 0,
          netProgress: 0,
          improvedConcepts: [],
          retainedConcepts: [],
          stillMissingConcepts: [],
          regressedConcepts: [],
          newMisconceptions: [],
          wordsSpokenChange: 0,
          durationSecondsChange: 0,
          headline: "Incompatible",
          studentFeedback: "Cannot compare",
        },
      };

      expect(deriveProgressSummary(incompComparison)).toBeNull();
    });
  });

  describe("5. ProgressSummaryCard Component Rendering", () => {
    it("renders Improvement card matching mockup elements", () => {
      const summaryData = {
        outcome: "improvement" as const,
        statusLabel: "Improved",
        headline: "+1 concept",
        subheadline:
          "You covered one more important concept than your previous attempt.",
        earlierAttempt: attemptBaseline,
        laterAttempt: attemptFollowup,
        earlierAudit: createAudit(attemptBaseline.id, []),
        laterAudit: createAudit(attemptFollowup.id, []),
        earlierCovered: 3,
        laterCovered: 4,
        totalCriteria: 4,
        earlierPercentage: 75,
        laterPercentage: 100,
        scopeDescription: "Paragraph 2 of 2",
        mostMeaningfulChange:
          "Core terminology and quality goals: Partially covered → Covered",
        netProgress: 1,
      };

      const html = renderToStaticMarkup(
        React.createElement(ProgressSummaryCard, {
          data: summaryData,
          studySetId: "set_os_1",
        })
      );

      // Verify title & badges
      expect(html).toContain("Your progress");
      expect(html).toContain("Improved");
      expect(html).toContain("+1 concept");
      expect(html).toContain("You covered one more important concept");

      // Verify CTA button with exact link
      expect(html).toContain("View full comparison");
      expect(html).toContain(
        "/study/set_os_1/compare?a=att_base_1&amp;b=att_follow_2"
      );

      // Verify comparison cards
      expect(html).toContain("Previous attempt");
      expect(html).toContain("3 of 4");
      expect(html).toContain("75% covered");

      expect(html).toContain("This attempt (current)");
      expect(html).toContain("4 of 4");
      expect(html).toContain("100% covered");

      // Verify what changed row
      expect(html).toContain("What changed?");
      expect(html).toContain(
        "Core terminology and quality goals: Partially covered → Covered"
      );
    });

    it("renders Regression card with Needs attention treatment", () => {
      const summaryData = {
        outcome: "regression" as const,
        statusLabel: "Needs attention",
        headline: "−1 concept",
        subheadline:
          "You covered one fewer key concept than your previous attempt.",
        earlierAttempt: attemptBaseline,
        laterAttempt: attemptFollowup,
        earlierAudit: createAudit(attemptBaseline.id, []),
        laterAudit: createAudit(attemptFollowup.id, []),
        earlierCovered: 4,
        laterCovered: 3,
        totalCriteria: 4,
        earlierPercentage: 100,
        laterPercentage: 75,
        scopeDescription: "Whole Answer",
        mostMeaningfulChange:
          "Core terminology and quality goals: Covered → Partially covered",
        netProgress: -1,
      };

      const html = renderToStaticMarkup(
        React.createElement(ProgressSummaryCard, {
          data: summaryData,
          studySetId: "set_os_1",
        })
      );

      expect(html).toContain("Needs attention");
      expect(html).toContain("−1 concept");
      expect(html).toContain("You covered one fewer key concept");
      expect(html).toContain(
        "Core terminology and quality goals: Covered → Partially covered"
      );
    });

    it("renders Mixed Progress card with amber treatment", () => {
      const summaryData = {
        outcome: "mixed_progress" as const,
        statusLabel: "Mixed progress",
        headline: "Mixed changes",
        subheadline: "Some concepts improved while others need more detail.",
        earlierAttempt: attemptBaseline,
        laterAttempt: attemptFollowup,
        earlierAudit: createAudit(attemptBaseline.id, []),
        laterAudit: createAudit(attemptFollowup.id, []),
        earlierCovered: 2,
        laterCovered: 2,
        totalCriteria: 4,
        earlierPercentage: 50,
        laterPercentage: 50,
        scopeDescription: "Whole Answer",
        mostMeaningfulChange: "Rule to tradeoff comparison: Missing → Covered",
        netProgress: 0,
      };

      const html = renderToStaticMarkup(
        React.createElement(ProgressSummaryCard, {
          data: summaryData,
          studySetId: "set_os_1",
        })
      );

      expect(html).toContain("Mixed progress");
      expect(html).toContain("Mixed changes");
      expect(html).toContain(
        "Some concepts improved while others need more detail."
      );
    });

    it("renders No Change card with consistent coverage treatment", () => {
      const summaryData = {
        outcome: "no_change" as const,
        statusLabel: "No change",
        headline: "Consistent coverage",
        subheadline: "Your conceptual coverage matched your previous attempt.",
        earlierAttempt: attemptBaseline,
        laterAttempt: attemptFollowup,
        earlierAudit: createAudit(attemptBaseline.id, []),
        laterAudit: createAudit(attemptFollowup.id, []),
        earlierCovered: 3,
        laterCovered: 3,
        totalCriteria: 4,
        earlierPercentage: 75,
        laterPercentage: 75,
        scopeDescription: "Whole Answer",
        mostMeaningfulChange:
          "Coverage maintained across all evaluated concepts.",
        netProgress: 0,
      };

      const html = renderToStaticMarkup(
        React.createElement(ProgressSummaryCard, {
          data: summaryData,
          studySetId: "set_os_1",
        })
      );

      expect(html).toContain("No change");
      expect(html).toContain("Consistent coverage");
      expect(html).toContain(
        "Coverage maintained across all evaluated concepts."
      );
    });

    it("verifies AnswerReviewView integration does not crash and preserves order", () => {
      const mockStudySet: StudySet = {
        id: "set_os_1",
        material: {
          id: "mat_1",
          title: "Operating Systems",
          sourceText: "Sample OS text",
          characterCount: 14,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        questions: [
          {
            id: "q_page_rep",
            studyMaterialId: "mat_1",
            orderIndex: 0,
            question: "Explain the different page replacement algorithms.",
            referenceAnswer:
              "Page replacement decides which page to remove on fault.",
            sourceExcerpt: "Page replacement excerpt",
          },
        ],
        rubrics: {
          q_page_rep: {
            id: "rubric_1",
            questionId: "q_page_rep",
            studyMaterialId: "mat_1",
            criteria: fourCriteria,
            updatedAt: new Date().toISOString(),
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const audit = createAudit(attemptBaseline.id, [
        { id: "crit_1", status: "covered" },
      ]);

      const html = renderToStaticMarkup(
        React.createElement(AnswerReviewView, {
          studySet: mockStudySet,
          attempt: attemptBaseline,
          initialAudit: audit,
        })
      );

      // Verify essential sections are rendered
      expect(html).toContain("Answer Review");
      expect(html).toContain(
        "Explain the different page replacement algorithms."
      );
      expect(html).toContain("Overall Assessment");
      expect(html).toContain("Concept Coverage");
    });
  });
});
