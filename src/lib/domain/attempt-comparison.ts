import { RubricCriterion, RubricCriterionCategory } from "./study-set";
import { PracticeAttempt } from "./practice-session";
import {
  CriterionEvaluationStatus,
  SemanticAuditResult,
} from "./semantic-audit";

/**
 * Result of checking whether two attempts have compatible scopes for comparison.
 */
export type ComparisonScopeCompatibility =
  | {
      compatible: true;
      scopeDescription: string;
      isParagraphScope: boolean;
      paragraphIndex?: number;
      totalParagraphs?: number;
    }
  | {
      compatible: false;
      reason: string;
    };

/**
 * Deterministic transition classification for a single criterion between two attempts.
 */
export type ConceptTransitionType =
  | "retained"
  | "improved"
  | "partial_progress"
  | "regressed"
  | "new_misconception"
  | "still_missing"
  | "still_incorrect"
  | "still_partial"
  | "not_evaluated";

/**
 * Detailed comparison for an individual rubric criterion across two attempts.
 */
export interface ConceptComparison {
  criterionId: string;
  criterionName: string;
  category: RubricCriterionCategory;
  isMandatory: boolean;
  earlierStatus: CriterionEvaluationStatus | "not_evaluated";
  laterStatus: CriterionEvaluationStatus | "not_evaluated";
  transition: ConceptTransitionType;
  studentMessage: string;
  earlierEvidence?: string | null;
  laterEvidence?: string | null;
  earlierImprovementSuggestion?: string;
  laterImprovementSuggestion?: string;
}

/**
 * Summary metrics and narrative for attempt comparison.
 */
export interface AttemptComparisonSummary {
  conceptsCoveredEarlier: number;
  conceptsCoveredLater: number;
  mandatoryTotal: number;
  netProgress: number; // later - earlier
  improvedConcepts: string[];
  retainedConcepts: string[];
  stillMissingConcepts: string[];
  regressedConcepts: string[];
  newMisconceptions: string[];
  wordsSpokenChange: number; // later - earlier
  durationSecondsChange: number; // later - earlier
  headline: string;
  studentFeedback: string;
}

/**
 * Complete structured outcome of comparing two practice attempts.
 */
export interface AttemptComparisonResult {
  isComparable: boolean;
  incompatibilityReason?: string;
  earlierAttempt: PracticeAttempt;
  laterAttempt: PracticeAttempt;
  earlierAudit: SemanticAuditResult | null;
  laterAudit: SemanticAuditResult | null;
  scopeDescription: string;
  concepts: ConceptComparison[];
  summary: AttemptComparisonSummary;
}

/**
 * Outcome classification for student progress comparison summary.
 */
export type ComparisonOutcome =
  "improvement" | "regression" | "no_change" | "mixed_progress";

/**
 * Structured presentation payload for the visual Progress Summary component.
 */
export interface ProgressSummaryData {
  outcome: ComparisonOutcome;
  statusLabel: string; // "Improved" | "Needs attention" | "No change" | "Mixed progress"
  headline: string; // "+1 concept", "−1 concept", "Consistent coverage", "Mixed changes"
  subheadline: string; // Short encouraging explanation
  earlierAttempt: PracticeAttempt;
  laterAttempt: PracticeAttempt;
  earlierAudit: SemanticAuditResult;
  laterAudit: SemanticAuditResult;
  earlierCovered: number;
  laterCovered: number;
  totalCriteria: number;
  earlierPercentage: number;
  laterPercentage: number;
  scopeDescription: string;
  mostMeaningfulChange: string;
  netProgress: number; // laterCovered - earlierCovered
}

/**
 * Check whether two attempts have compatible practice scopes for meaningful comparison.
 *
 * Rules:
 * - Whole answer vs whole answer: compatible
 * - Paragraph N vs Paragraph N: compatible
 * - Paragraph N vs whole answer: incompatible
 * - Paragraph N vs Paragraph M (different N & M): incompatible
 * - Historical attempts with unknown scope: safe explanation, incompatible
 */
export function checkScopeCompatibility(
  attemptA: PracticeAttempt,
  attemptB: PracticeAttempt,
  auditA?: SemanticAuditResult | null,
  auditB?: SemanticAuditResult | null
): ComparisonScopeCompatibility {
  if (attemptA.questionId !== attemptB.questionId) {
    return {
      compatible: false,
      reason:
        "These attempts belong to different questions. Comparison requires attempts on the same question.",
    };
  }

  // Helper to reliably classify attempt scope without fabricating metadata
  const classifyScope = (
    att: PracticeAttempt,
    audit?: SemanticAuditResult | null
  ): {
    scope: "whole_answer" | "paragraph" | "unknown";
    paragraphIndex?: number;
    totalParagraphs?: number;
  } => {
    // 1. Explicit attempt scope
    if (att.scope === "paragraph") {
      return {
        scope: "paragraph",
        paragraphIndex: att.paragraphIndex ?? 0,
        totalParagraphs: att.totalParagraphs,
      };
    }
    if (att.scope === "whole_answer") {
      return { scope: "whole_answer" };
    }

    // 2. Reliable audit scope if available
    if (audit?.scope) {
      if (audit.scope.type === "paragraph") {
        return {
          scope: "paragraph",
          paragraphIndex: audit.scope.paragraphIndex ?? 0,
          totalParagraphs: audit.scope.totalParagraphs,
        };
      }
      if (audit.scope.type === "whole_answer") {
        return { scope: "whole_answer" };
      }
    }

    // 3. Fallback: If attempt explicitly lacks scope metadata, mark as unknown
    return { scope: "unknown" };
  };

  const scopeA = classifyScope(attemptA, auditA);
  const scopeB = classifyScope(attemptB, auditB);

  // Case D: Older attempts without scope metadata
  if (scopeA.scope === "unknown" || scopeB.scope === "unknown") {
    return {
      compatible: false,
      reason:
        "This attempt was recorded before practice scope tracking was introduced. Its practice scope is unavailable, so a direct progress comparison cannot be made.",
    };
  }

  // Case B: Both are whole answer
  if (scopeA.scope === "whole_answer" && scopeB.scope === "whole_answer") {
    return {
      compatible: true,
      scopeDescription: "Whole Answer",
      isParagraphScope: false,
    };
  }

  // Case A: Both are paragraph
  if (scopeA.scope === "paragraph" && scopeB.scope === "paragraph") {
    const idxA = scopeA.paragraphIndex ?? 0;
    const idxB = scopeB.paragraphIndex ?? 0;
    const total = scopeA.totalParagraphs || scopeB.totalParagraphs;

    if (idxA === idxB) {
      return {
        compatible: true,
        scopeDescription: total
          ? `Paragraph ${idxA + 1} of ${total}`
          : `Paragraph ${idxA + 1}`,
        isParagraphScope: true,
        paragraphIndex: idxA,
        totalParagraphs: total,
      };
    }

    return {
      compatible: false,
      reason: `Attempt 1 evaluates Paragraph ${idxA + 1}, while Attempt 2 evaluates Paragraph ${idxB + 1}. Because these cover different parts of the answer, they cannot be directly compared.`,
    };
  }

  // Case C: Mismatched scopes (Paragraph vs Whole Answer)
  if (scopeA.scope !== scopeB.scope) {
    const paraAttempt = scopeA.scope === "paragraph" ? scopeA : scopeB;
    const pNum = (paraAttempt.paragraphIndex ?? 0) + 1;
    return {
      compatible: false,
      reason: `One attempt evaluated only Paragraph ${pNum}, while the other evaluated the whole answer. To see accurate progress, compare attempts that practice the same scope.`,
    };
  }

  return {
    compatible: false,
    reason:
      "These attempts have incompatible practice scopes and cannot be compared.",
  };
}

/**
 * Determines the transition status and student-friendly description between two criterion statuses.
 */
export function deriveConceptTransition(
  earlierStatus: CriterionEvaluationStatus | "not_evaluated",
  laterStatus: CriterionEvaluationStatus | "not_evaluated",
  criterionName: string
): { transition: ConceptTransitionType; message: string } {
  // If either was not evaluated
  if (earlierStatus === "not_evaluated" || laterStatus === "not_evaluated") {
    return {
      transition: "not_evaluated",
      message: `Not evaluated in both attempts: "${criterionName}".`,
    };
  }

  // Covered in both
  if (earlierStatus === "covered" && laterStatus === "covered") {
    return {
      transition: "retained",
      message: `Maintained coverage: "${criterionName}" is clearly explained in both attempts.`,
    };
  }

  // Improved to covered
  if (earlierStatus !== "covered" && laterStatus === "covered") {
    return {
      transition: "improved",
      message: `You improved: "${criterionName}" is now fully covered!`,
    };
  }

  // Partial progress
  if (
    (earlierStatus === "missing" || earlierStatus === "incorrect") &&
    laterStatus === "partially_covered"
  ) {
    return {
      transition: "partial_progress",
      message: `Partial progress: "${criterionName}" is now partially explained.`,
    };
  }

  // Regressed from covered to partially covered
  if (earlierStatus === "covered" && laterStatus === "partially_covered") {
    return {
      transition: "regressed",
      message: `You previously covered "${criterionName}", but only partially explained it in this attempt.`,
    };
  }

  // Regressed to missing
  if (
    (earlierStatus === "covered" || earlierStatus === "partially_covered") &&
    laterStatus === "missing"
  ) {
    return {
      transition: "regressed",
      message: `You previously covered "${criterionName}", but it was missing in this attempt.`,
    };
  }

  // New misconception
  if (
    (earlierStatus === "covered" || earlierStatus === "partially_covered") &&
    laterStatus === "incorrect"
  ) {
    return {
      transition: "new_misconception",
      message: `Needs correction: "${criterionName}" was accurate before, but this attempt introduced a factual conflict.`,
    };
  }

  // Still incorrect
  if (earlierStatus === "incorrect" && laterStatus === "incorrect") {
    return {
      transition: "still_incorrect",
      message: `Still needs correction: "${criterionName}" has a factual misunderstanding to review.`,
    };
  }

  // Still partial
  if (
    earlierStatus === "partially_covered" &&
    laterStatus === "partially_covered"
  ) {
    return {
      transition: "still_partial",
      message: `Needs more detail: "${criterionName}" is partially explained in both attempts.`,
    };
  }

  // Still missing
  if (earlierStatus === "missing" && laterStatus === "missing") {
    return {
      transition: "still_missing",
      message: `Still to practise: "${criterionName}".`,
    };
  }

  // Optional or other
  return {
    transition: "retained",
    message: `Status: "${criterionName}".`,
  };
}

/**
 * Compare two practice attempts belonging to the same question deterministically.
 */
export function compareAttempts({
  attemptA,
  attemptB,
  auditA,
  auditB,
  criteria,
}: {
  attemptA: PracticeAttempt;
  attemptB: PracticeAttempt;
  auditA: SemanticAuditResult | null;
  auditB: SemanticAuditResult | null;
  criteria: RubricCriterion[];
}): AttemptComparisonResult {
  // Sort chronologically: earlierAttempt is the baseline, laterAttempt is the subsequent attempt
  const isAFirst =
    new Date(attemptA.createdAt).getTime() <=
    new Date(attemptB.createdAt).getTime();
  const earlierAttempt = isAFirst ? attemptA : attemptB;
  const laterAttempt = isAFirst ? attemptB : attemptA;
  const earlierAudit = isAFirst ? auditA : auditB;
  const laterAudit = isAFirst ? auditB : auditA;

  // 1. Verify scope compatibility
  const compatibility = checkScopeCompatibility(
    earlierAttempt,
    laterAttempt,
    earlierAudit,
    laterAudit
  );
  if (!compatibility.compatible) {
    return {
      isComparable: false,
      incompatibilityReason: compatibility.reason,
      earlierAttempt,
      laterAttempt,
      earlierAudit,
      laterAudit,
      scopeDescription: "Incompatible scopes",
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
        headline: "Incompatible attempts",
        studentFeedback: compatibility.reason,
      },
    };
  }

  // 2. Verify audit presence
  if (!earlierAudit || !laterAudit) {
    const missingWhich =
      !earlierAudit && !laterAudit
        ? "both attempts"
        : !earlierAudit
          ? "the earlier attempt"
          : "the later attempt";
    return {
      isComparable: false,
      incompatibilityReason: `Semantic evaluation has not finished for ${missingWhich}. Run an audit on pending attempts before comparing.`,
      earlierAttempt,
      laterAttempt,
      earlierAudit,
      laterAudit,
      scopeDescription: compatibility.scopeDescription,
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
        headline: "Audit pending",
        studentFeedback:
          "One or both attempts have not completed semantic evaluation.",
      },
    };
  }

  // 3. Map criteria evaluations
  const earlierEvalsMap = new Map(
    earlierAudit.criteriaEvaluations.map((c) => [c.criterionId, c])
  );
  const laterEvalsMap = new Map(
    laterAudit.criteriaEvaluations.map((c) => [c.criterionId, c])
  );

  // If this is a paragraph-level comparison:
  // Ensure we only include criteria that belong to this paragraph!
  // If whole-question criteria were passed, filter to only those evaluated in this paragraph
  let targetCriteria = criteria;
  const isParagraph =
    earlierAttempt.scope === "paragraph" ||
    laterAttempt.scope === "paragraph" ||
    compatibility.isParagraphScope;

  if (isParagraph && targetCriteria.length > 0) {
    const evaluatedCriteria = targetCriteria.filter(
      (c) => earlierEvalsMap.has(c.id) || laterEvalsMap.has(c.id)
    );
    if (evaluatedCriteria.length > 0) {
      targetCriteria = evaluatedCriteria;
    }
  }

  // If criteria are provided, use them; otherwise extract union from audits
  const criteriaList: Array<{
    id: string;
    name: string;
    category: RubricCriterionCategory;
    isMandatory: boolean;
  }> =
    targetCriteria.length > 0
      ? targetCriteria.map((c) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          isMandatory: c.isMandatory ?? true,
        }))
      : Array.from(
          new Set([
            ...earlierAudit.criteriaEvaluations.map((c) => c.criterionId),
            ...laterAudit.criteriaEvaluations.map((c) => c.criterionId),
          ])
        ).map((id) => {
          const evalItem = laterEvalsMap.get(id) || earlierEvalsMap.get(id);
          return {
            id,
            name: evalItem?.criterionName || "Concept",
            category: evalItem?.category || "essential_concept",
            isMandatory: evalItem?.category !== "optional_detail",
          };
        });

  const concepts: ConceptComparison[] = [];
  const improvedConcepts: string[] = [];
  const retainedConcepts: string[] = [];
  const stillMissingConcepts: string[] = [];
  const regressedConcepts: string[] = [];
  const newMisconceptions: string[] = [];

  let coveredEarlierMandatory = 0;
  let coveredLaterMandatory = 0;
  let mandatoryTotal = 0;

  for (const crit of criteriaList) {
    const isMandatory = crit.isMandatory !== false;
    if (isMandatory) mandatoryTotal++;

    const earlyEval = earlierEvalsMap.get(crit.id);
    const lateEval = laterEvalsMap.get(crit.id);

    const earlyStatus: CriterionEvaluationStatus | "not_evaluated" =
      earlyEval?.status || "not_evaluated";
    const lateStatus: CriterionEvaluationStatus | "not_evaluated" =
      lateEval?.status || "not_evaluated";

    if (isMandatory && earlyStatus === "covered") coveredEarlierMandatory++;
    if (isMandatory && lateStatus === "covered") coveredLaterMandatory++;

    const { transition, message } = deriveConceptTransition(
      earlyStatus,
      lateStatus,
      crit.name
    );

    if (transition === "improved" || transition === "partial_progress") {
      improvedConcepts.push(crit.name);
    } else if (transition === "retained") {
      retainedConcepts.push(crit.name);
    } else if (
      transition === "still_missing" ||
      transition === "still_incorrect"
    ) {
      stillMissingConcepts.push(crit.name);
    } else if (transition === "regressed") {
      regressedConcepts.push(crit.name);
    } else if (transition === "new_misconception") {
      newMisconceptions.push(crit.name);
    }

    concepts.push({
      criterionId: crit.id,
      criterionName: crit.name,
      category: crit.category,
      isMandatory,
      earlierStatus: earlyStatus,
      laterStatus: lateStatus,
      transition,
      studentMessage: message,
      earlierEvidence: earlyEval?.transcriptEvidence,
      laterEvidence: lateEval?.transcriptEvidence,
      earlierImprovementSuggestion: earlyEval?.improvementSuggestion,
      laterImprovementSuggestion: lateEval?.improvementSuggestion,
    });
  }

  const netProgress = coveredLaterMandatory - coveredEarlierMandatory;
  const wordsSpokenChange =
    (laterAttempt.wordCount || 0) - (earlierAttempt.wordCount || 0);
  const durationSecondsChange =
    (laterAttempt.durationSeconds || 0) - (earlierAttempt.durationSeconds || 0);

  // Derive plain student-friendly headline and feedback
  let headline = "";
  let studentFeedback = "";

  if (netProgress > 0) {
    headline = `Great progress! You covered ${netProgress} more key ${
      netProgress === 1 ? "concept" : "concepts"
    } than in your earlier attempt.`;
    studentFeedback = `You maintained your grasp of ${retainedConcepts.length} points and added ${improvedConcepts.length} newly covered or improved concepts.`;
  } else if (netProgress === 0 && coveredLaterMandatory === mandatoryTotal) {
    headline =
      "Complete conceptual coverage! You covered all key points in both attempts.";
    studentFeedback =
      "Your understanding of all essential concepts remains solid and consistent.";
  } else if (netProgress === 0) {
    headline =
      "Steady effort! Your conceptual coverage matched your previous attempt.";
    studentFeedback =
      stillMissingConcepts.length > 0
        ? `Focus on reviewing: ${stillMissingConcepts.slice(0, 2).join(", ")}.`
        : "Keep practicing to refine your fluency and explanations.";
  } else {
    const drop = Math.abs(netProgress);
    headline = `You covered ${drop} fewer key ${
      drop === 1 ? "concept" : "concepts"
    } than in your previous attempt.`;
    studentFeedback =
      regressedConcepts.length > 0
        ? `Concepts that were omitted this time: ${regressedConcepts.join(", ")}.`
        : "Review the points to remember and try another spoken run.";
  }

  return {
    isComparable: true,
    earlierAttempt,
    laterAttempt,
    earlierAudit,
    laterAudit,
    scopeDescription: compatibility.scopeDescription,
    concepts,
    summary: {
      conceptsCoveredEarlier: coveredEarlierMandatory,
      conceptsCoveredLater: coveredLaterMandatory,
      mandatoryTotal,
      netProgress,
      improvedConcepts,
      retainedConcepts,
      stillMissingConcepts,
      regressedConcepts,
      newMisconceptions,
      wordsSpokenChange,
      durationSecondsChange,
      headline,
      studentFeedback,
    },
  };
}

/**
 * Helper to format criterion evaluation status into friendly display text.
 */
function formatStatus(
  status: CriterionEvaluationStatus | "not_evaluated"
): string {
  switch (status) {
    case "covered":
      return "Covered";
    case "partially_covered":
      return "Partially covered";
    case "missing":
      return "Missing";
    case "incorrect":
      return "Needs correction";
    case "optional":
      return "Helpful extra";
    default:
      return "Not evaluated";
  }
}

/**
 * Derives a compact, student-first Progress Summary from a full attempt comparison result.
 * Returns null if the attempts cannot be compared or lack completed evaluation audits.
 */
export function deriveProgressSummary(
  comparison: AttemptComparisonResult
): ProgressSummaryData | null {
  if (
    !comparison.isComparable ||
    !comparison.earlierAudit ||
    !comparison.laterAudit
  ) {
    return null;
  }

  const {
    earlierAttempt,
    laterAttempt,
    earlierAudit,
    laterAudit,
    concepts,
    summary,
  } = comparison;

  const mandatoryConcepts = concepts.filter((c) => c.isMandatory);
  const targetConcepts =
    mandatoryConcepts.length > 0 ? mandatoryConcepts : concepts;

  if (targetConcepts.length === 0) {
    return null;
  }

  const totalCriteria = targetConcepts.length;
  const earlierCovered = summary.conceptsCoveredEarlier;
  const laterCovered = summary.conceptsCoveredLater;
  const netProgress = laterCovered - earlierCovered;

  const earlierPercentage = Math.round((earlierCovered / totalCriteria) * 100);
  const laterPercentage = Math.round((laterCovered / totalCriteria) * 100);

  // Transition flags
  const hasImprovements = targetConcepts.some(
    (c) => c.transition === "improved" || c.transition === "partial_progress"
  );
  const hasRegressions = targetConcepts.some(
    (c) => c.transition === "regressed" || c.transition === "new_misconception"
  );

  let outcome: ComparisonOutcome;
  let statusLabel: string;
  let headline: string;
  let subheadline: string;

  if (hasImprovements && hasRegressions) {
    outcome = "mixed_progress";
    statusLabel = "Mixed progress";
    if (netProgress === 0) {
      headline = "Mixed changes";
      subheadline = "Some concepts improved while others need more detail.";
    } else if (netProgress > 0) {
      headline = `+${netProgress} net ${netProgress === 1 ? "concept" : "concepts"}`;
      subheadline =
        "You improved on some concepts, but others need more detail.";
    } else {
      headline = `−${Math.abs(netProgress)} net ${
        Math.abs(netProgress) === 1 ? "concept" : "concepts"
      }`;
      subheadline = "Some concepts improved, but others were missed this time.";
    }
  } else if (hasImprovements) {
    outcome = "improvement";
    statusLabel = "Improved";
    const count = netProgress > 0 ? netProgress : 1;
    headline = `+${count} ${count === 1 ? "concept" : "concepts"}`;
    subheadline = `You covered ${
      count === 1
        ? "one more important concept"
        : `${count} more important concepts`
    } than your previous attempt.`;
  } else if (hasRegressions) {
    outcome = "regression";
    statusLabel = "Needs attention";
    const drop = netProgress < 0 ? Math.abs(netProgress) : 1;
    headline = `−${drop} ${drop === 1 ? "concept" : "concepts"}`;
    subheadline = `You covered ${
      drop === 1 ? "one fewer key concept" : `${drop} fewer key concepts`
    } than your previous attempt.`;
  } else {
    outcome = "no_change";
    statusLabel = "No change";
    headline = "Consistent coverage";
    subheadline = "Your conceptual coverage matched your previous attempt.";
  }

  // Derive the single most meaningful change description
  let mostMeaningfulChange = "";

  if (hasImprovements && hasRegressions) {
    const improvedConcept =
      targetConcepts.find((c) => c.transition === "improved") ||
      targetConcepts.find((c) => c.transition === "partial_progress");
    const regressedConcept =
      targetConcepts.find((c) => c.transition === "regressed") ||
      targetConcepts.find((c) => c.transition === "new_misconception");

    if (improvedConcept && regressedConcept) {
      mostMeaningfulChange = `${improvedConcept.criterionName}: ${formatStatus(
        improvedConcept.earlierStatus
      )} → ${formatStatus(improvedConcept.laterStatus)}`;
    }
  }

  if (!mostMeaningfulChange && hasImprovements) {
    const improvedConcept =
      targetConcepts.find((c) => c.transition === "improved") ||
      targetConcepts.find((c) => c.transition === "partial_progress");
    if (improvedConcept) {
      mostMeaningfulChange = `${improvedConcept.criterionName}: ${formatStatus(
        improvedConcept.earlierStatus
      )} → ${formatStatus(improvedConcept.laterStatus)}`;
    }
  }

  if (!mostMeaningfulChange && hasRegressions) {
    const regressedConcept =
      targetConcepts.find((c) => c.transition === "regressed") ||
      targetConcepts.find((c) => c.transition === "new_misconception");
    if (regressedConcept) {
      mostMeaningfulChange = `${regressedConcept.criterionName}: ${formatStatus(
        regressedConcept.earlierStatus
      )} → ${formatStatus(regressedConcept.laterStatus)}`;
    }
  }

  if (!mostMeaningfulChange) {
    if (laterCovered === totalCriteria) {
      mostMeaningfulChange =
        "All key concepts were consistently covered in both attempts.";
    } else {
      mostMeaningfulChange =
        "Coverage maintained across all evaluated concepts.";
    }
  }

  return {
    outcome,
    statusLabel,
    headline,
    subheadline,
    earlierAttempt,
    laterAttempt,
    earlierAudit,
    laterAudit,
    earlierCovered,
    laterCovered,
    totalCriteria,
    earlierPercentage,
    laterPercentage,
    scopeDescription: comparison.scopeDescription,
    mostMeaningfulChange,
    netProgress,
  };
}

/**
 * Finds the immediately preceding comparable attempt for a given attempt.
 * Evaluates candidates chronologically in reverse (most recent prior attempt first)
 * and verifies scope compatibility.
 */
export function findPrecedingComparableAttempt(
  currentAttempt: PracticeAttempt,
  allAttempts: PracticeAttempt[],
  currentAudit?: SemanticAuditResult | null,
  auditsByAttemptId?:
    | Record<string, SemanticAuditResult | undefined>
    | Map<string, SemanticAuditResult | undefined>
): PracticeAttempt | null {
  const currentCreated = new Date(currentAttempt.createdAt).getTime();

  // Filter to earlier attempts for the same question
  const earlierAttempts = allAttempts
    .filter(
      (a) =>
        a.questionId === currentAttempt.questionId &&
        a.id !== currentAttempt.id &&
        new Date(a.createdAt).getTime() < currentCreated
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const getAudit = (id: string): SemanticAuditResult | null => {
    if (!auditsByAttemptId) return null;
    if (auditsByAttemptId instanceof Map) {
      return auditsByAttemptId.get(id) ?? null;
    }
    return auditsByAttemptId[id] ?? null;
  };

  for (const earlier of earlierAttempts) {
    const earlierAudit = getAudit(earlier.id);
    const compatibility = checkScopeCompatibility(
      earlier,
      currentAttempt,
      earlierAudit,
      currentAudit
    );

    if (compatibility.compatible) {
      return earlier;
    }
  }

  return null;
}
