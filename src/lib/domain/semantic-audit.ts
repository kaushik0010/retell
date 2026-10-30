import { z } from "zod";
import { RubricCriterionCategorySchema } from "./study-set";

/**
 * Criterion evaluation status for semantic answer auditing.
 * Evaluates conceptual understanding, NOT sentence memorization.
 */
export const CriterionEvaluationStatusSchema = z.enum([
  "covered",
  "partially_covered",
  "missing",
  "incorrect",
  "optional",
]);

export type CriterionEvaluationStatus = z.infer<
  typeof CriterionEvaluationStatusSchema
>;

/**
 * Student-friendly visual presentation for each evaluation status.
 */
export const CRITERION_STATUS_META: Record<
  CriterionEvaluationStatus,
  {
    label: string;
    studentLabel: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    icon: string;
  }
> = {
  covered: {
    label: "Covered",
    studentLabel: "Covered",
    description: "You explained this concept accurately and clearly.",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-800",
    badgeBorder: "border-emerald-200",
    icon: "✓",
  },
  partially_covered: {
    label: "Partially covered",
    studentLabel: "Partially covered",
    description:
      "You explained some of this concept, but left out important details.",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-200",
    icon: "◐",
  },
  missing: {
    label: "Missing",
    studentLabel: "Missing",
    description: "This important concept was not mentioned in your response.",
    badgeBg: "bg-stone-100",
    badgeText: "text-stone-700",
    badgeBorder: "border-stone-200",
    icon: "○",
  },
  incorrect: {
    label: "Needs correction",
    studentLabel: "Needs correction",
    description:
      "This explanation conflicts with the reference material or has a factual error.",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-800",
    badgeBorder: "border-rose-200",
    icon: "✕",
  },
  optional: {
    label: "Helpful extra",
    studentLabel: "Helpful extra",
    description: "A helpful additional point, not required for full marks.",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-800",
    badgeBorder: "border-blue-200",
    icon: "+",
  },
};

/**
 * Detailed evaluation of a single criterion against the student's spoken transcript.
 */
export const CriterionEvaluationSchema = z.object({
  criterionId: z.string().min(1, "Criterion ID is required"),
  criterionName: z.string().min(1, "Criterion name is required"),
  category: RubricCriterionCategorySchema.default("essential_concept"),
  status: CriterionEvaluationStatusSchema,
  explanation: z
    .string()
    .min(1, "Specific, grounded explanation of the decision is required"),
  transcriptEvidence: z
    .string()
    .nullable()
    .optional()
    .describe("Actual words from transcript supporting the evaluation"),
  missingOrInaccurate: z
    .string()
    .nullable()
    .optional()
    .describe("Specific omitted or conflicting details"),
  improvementSuggestion: z
    .string()
    .min(1, "Actionable suggestion for next attempt is required"),
  orderIndex: z.number().int().default(0),
});

export type CriterionEvaluation = z.infer<typeof CriterionEvaluationSchema>;

/**
 * High-level overall assessment of the student's explanation.
 */
export const OverallAssessmentSchema = z.object({
  summary: z
    .string()
    .min(1, "Overall summary is required")
    .describe(
      "A concise, honest summary of what was explained well and what needs attention"
    ),
  whatExplainedWell: z.array(z.string()).default([]),
  whatNeedsAttention: z.array(z.string()).default([]),
  whatNeedsCorrection: z.array(z.string()).default([]),
  suggestedNextImprovement: z
    .string()
    .min(1, "The most useful 1-2 actionable next steps"),
  coveredCount: z.number().int().nonnegative().default(0),
  partiallyCoveredCount: z.number().int().nonnegative().default(0),
  missingCount: z.number().int().nonnegative().default(0),
  incorrectCount: z.number().int().nonnegative().default(0),
  optionalCount: z.number().int().nonnegative().default(0),
  totalCriteria: z.number().int().nonnegative().default(0),
});

export type OverallAssessment = z.infer<typeof OverallAssessmentSchema>;

/**
 * Scope of the practice attempt being evaluated.
 * Supports whole-answer attempts and paragraph-level practice for long answers.
 */
export const AttemptScopeSchema = z.object({
  type: z
    .enum(["whole_answer", "paragraph", "selected_paragraphs"])
    .default("whole_answer"),
  paragraphIndex: z.number().int().nonnegative().optional(),
  totalParagraphs: z.number().int().positive().optional(),
  targetText: z.string().optional(),
});

export type AttemptScope = z.infer<typeof AttemptScopeSchema>;

/**
 * Complete, Zod-validated semantic audit result.
 * Persisted in IndexedDB associated with a specific PracticeAttempt.
 */
export const SemanticAuditResultSchema = z.object({
  id: z.string().min(1, "Audit ID is required"),
  attemptId: z.string().min(1, "Attempt ID is required"),
  studySetId: z.string().min(1, "Study set ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  status: z.enum(["completed", "partial", "failed"]).default("completed"),
  scope: AttemptScopeSchema.default({ type: "whole_answer" }),
  overall: OverallAssessmentSchema,
  criteriaEvaluations: z.array(CriterionEvaluationSchema),
  hasUncertainty: z.boolean().default(false),
  uncertaintyNotes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SemanticAuditResult = z.infer<typeof SemanticAuditResultSchema>;

/**
 * LLM Structured Output Schema for `/api/audit`.
 * Clean separation between model output and hydrated aggregate entity.
 */
export const SemanticAuditLLMOutputSchema = z.object({
  overallSummary: z.string().min(5),
  whatExplainedWell: z.array(z.string()).default([]),
  whatNeedsAttention: z.array(z.string()).default([]),
  whatNeedsCorrection: z.array(z.string()).default([]),
  suggestedNextImprovement: z.string().min(5),
  criteriaEvaluations: z.array(
    z.object({
      criterionId: z.string().min(1),
      status: CriterionEvaluationStatusSchema,
      explanation: z.string().min(5),
      transcriptEvidence: z.string().nullable().optional(),
      missingOrInaccurate: z.string().nullable().optional(),
      improvementSuggestion: z.string().min(5),
    })
  ),
  hasUncertainty: z.boolean().default(false),
  uncertaintyNotes: z.string().optional(),
});

export type SemanticAuditLLMOutput = z.infer<
  typeof SemanticAuditLLMOutputSchema
>;

/**
 * Client request payload for `POST /api/audit`.
 */
export const SemanticAuditRequestSchema = z.object({
  attemptId: z.string().min(1, "Attempt ID is required"),
  studySetId: z.string().min(1, "Study set ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  question: z.string().min(3, "Question is required"),
  referenceAnswer: z.string().min(5, "Reference answer is required"),
  transcript: z.string().min(1, "Spoken transcript is required"),
  criteria: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        category: RubricCriterionCategorySchema.default("essential_concept"),
        description: z.string().default(""),
        satisfactoryDemonstration: z.string().default(""),
        isMandatory: z.boolean().default(true),
        orderIndex: z.number().int().default(0),
      })
    )
    .min(1, "At least one criterion is required for evaluation"),
  scope: AttemptScopeSchema.optional(),
  mockFallback: z.boolean().optional(),
});

export type SemanticAuditRequest = z.infer<typeof SemanticAuditRequestSchema>;

/**
 * Helper to generate a unique audit ID.
 */
export function createAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
