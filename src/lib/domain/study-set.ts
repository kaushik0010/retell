import { z } from "zod";

/**
 * Criterion category defining the pedagogical purpose of the rubric item.
 * Internal enum values remain stable for schemas and storage.
 */
export const RubricCriterionCategorySchema = z.enum([
  "essential_concept",
  "technical_anchor",
  "relationship_sequence",
  "accuracy_constraint",
  "optional_detail",
]);

export type RubricCriterionCategory = z.infer<
  typeof RubricCriterionCategorySchema
>;

/**
 * Student-friendly metadata and styling configuration for rubric categories.
 * Translates internal categories into natural learning vocabulary:
 * - essential_concept  -> "Main idea"
 * - technical_anchor   -> "Key term"
 * - relationship_seq   -> "Steps in order"
 * - accuracy_constraint-> "Mistakes to avoid"
 * - optional_detail    -> "Helpful extra"
 */
export const RUBRIC_CATEGORY_META: Record<
  RubricCriterionCategory,
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
  essential_concept: {
    label: "Main idea",
    studentLabel: "Main idea",
    description: "The central idea that makes the answer correct.",
    badgeBg: "bg-red-50",
    badgeText: "text-red-700",
    badgeBorder: "border-red-200",
    icon: "target",
  },
  technical_anchor: {
    label: "Key term",
    studentLabel: "Key term",
    description: "Important terms, formulas, or specific words to remember.",
    badgeBg: "bg-orange-50",
    badgeText: "text-orange-700",
    badgeBorder: "border-orange-200",
    icon: "tag",
  },
  relationship_sequence: {
    label: "Steps in order",
    studentLabel: "Steps in order",
    description: "The sequence of events or connections between ideas.",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-200",
    icon: "list-ordered",
  },
  accuracy_constraint: {
    label: "Mistakes to avoid",
    studentLabel: "Mistakes to avoid",
    description: "Common misconceptions or incorrect claims to steer clear of.",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-200",
    icon: "alert-triangle",
  },
  optional_detail: {
    label: "Helpful extra",
    studentLabel: "Helpful extra",
    description:
      "Extra details that improve an answer but are not strictly required.",
    badgeBg: "bg-stone-100",
    badgeText: "text-stone-700",
    badgeBorder: "border-stone-200",
    icon: "plus-circle",
  },
};

/**
 * Single evaluation criterion within a rubric.
 */
export const RubricCriterionSchema = z.object({
  id: z.string().min(1, "Criterion ID is required"),
  category: RubricCriterionCategorySchema,
  name: z.string().min(1, "Criterion name is required"),
  description: z.string().min(1, "Criterion description is required"),
  satisfactoryDemonstration: z
    .string()
    .min(1, "Assessment guidance is required"),
  isMandatory: z.boolean().default(true),
  orderIndex: z.number().int().default(0),
});

export type RubricCriterion = z.infer<typeof RubricCriterionSchema>;

/**
 * Full rubric definition for a single question.
 */
export const QuestionRubricSchema = z.object({
  id: z.string().min(1, "Rubric ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  studyMaterialId: z.string().min(1, "Study material ID is required"),
  criteria: z
    .array(RubricCriterionSchema)
    .min(1, "Rubric must contain at least one criterion"),
  updatedAt: z.string(),
});

export type QuestionRubric = z.infer<typeof QuestionRubricSchema>;

/**
 * Question extracted from study material, with reference answer grounded in source.
 */
export const ExtractedQuestionSchema = z.object({
  id: z.string().min(1, "Question ID is required"),
  studyMaterialId: z.string().min(1, "Study material ID is required"),
  orderIndex: z.number().int().default(0),
  question: z.string().min(5, "Question must be at least 5 characters"),
  referenceAnswer: z
    .string()
    .min(10, "Reference answer must be at least 10 characters"),
  sourceExcerpt: z.string().default(""),
  pageNumber: z.number().int().optional(),
  isUncertain: z.boolean().optional(),
});

export type ExtractedQuestion = z.infer<typeof ExtractedQuestionSchema>;

/**
 * Ingested study material metadata and original source text.
 */
export const StudyMaterialSchema = z.object({
  id: z.string().min(1, "Material ID is required"),
  title: z.string().min(1, "Title is required"),
  sourceText: z.string().min(1, "Source text must not be empty"),
  characterCount: z.number().int().nonnegative(),
  sourceType: z.enum(["text", "pdf", "image"]).optional(),
  fileName: z.string().optional(),
  fileSize: z.number().int().optional(),
  pageCount: z.number().int().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StudyMaterial = z.infer<typeof StudyMaterialSchema>;

/**
 * Complete Study Set aggregate stored in IndexedDB.
 */
export const StudySetSchema = z.object({
  id: z.string().min(1, "Study set ID is required"),
  material: StudyMaterialSchema,
  questions: z
    .array(ExtractedQuestionSchema)
    .min(1, "Study set must have at least one question"),
  rubrics: z.record(z.string(), QuestionRubricSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StudySet = z.infer<typeof StudySetSchema>;

// Status of extraction based on source text grounding
export const ExtractionStatusSchema = z.enum([
  "found_qa",
  "missing_question",
  "missing_answer",
  "unclear",
]);

export type ExtractionStatus = z.infer<typeof ExtractionStatusSchema>;

// Request and LLM schemas for Extraction API
export const ExtractRequestSchema = z.object({
  title: z.string().max(120).optional(),
  sourceText: z
    .string()
    .min(20, "Study material must be at least 20 characters")
    .max(100000, "Study material exceeds 100,000 characters"),
  studentQuestion: z.string().optional(),
  sourceType: z.enum(["text", "pdf", "image"]).optional(),
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  pageCount: z.number().optional(),
});

export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

export const ExtractedQuestionLLMOutputSchema = z.object({
  question: z.string().min(3, "Question must be at least 3 characters"),
  referenceAnswer: z
    .string()
    .min(5, "Reference answer must be at least 5 characters"),
  sourceExcerpt: z.string().default(""),
  pageNumber: z.number().int().optional(),
  isUncertain: z.boolean().default(false),
});

export const ExtractionLLMOutputSchema = z.object({
  status: ExtractionStatusSchema.default("found_qa"),
  guidanceMessage: z.string().optional(),
  detectedContent: z.string().optional(),
  suggestedTitle: z.string().optional(),
  questions: z.array(ExtractedQuestionLLMOutputSchema).default([]),
});

export type ExtractionLLMOutput = z.infer<typeof ExtractionLLMOutputSchema>;

export const ExtractResponseSchema = z.object({
  success: z.boolean(),
  status: ExtractionStatusSchema,
  message: z.string().optional(),
  detectedContent: z.string().optional(),
  studyMaterial: StudyMaterialSchema.optional(),
  questions: z.array(ExtractedQuestionSchema).optional(),
  error: z.string().optional(),
});

export type ExtractResponse = z.infer<typeof ExtractResponseSchema>;

// Request and LLM schemas for Rubric API
export const RubricRequestSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  question: z.string().min(5, "Question must be at least 5 characters"),
  referenceAnswer: z
    .string()
    .min(10, "Reference answer must be at least 10 characters"),
  sourceText: z.string().min(20, "Source text must be at least 20 characters"),
  studyMaterialId: z.string().min(1, "Study material ID is required"),
});

export type RubricRequest = z.infer<typeof RubricRequestSchema>;

export const RubricCriterionLLMOutputSchema = z.object({
  category: RubricCriterionCategorySchema,
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  satisfactoryDemonstration: z
    .string()
    .min(1, "Guidance for satisfactory demonstration is required"),
  isMandatory: z.boolean(),
});

export const RubricLLMOutputSchema = z.object({
  criteria: z
    .array(RubricCriterionLLMOutputSchema)
    .min(1, "Must generate at least 1 key point"),
});

export type RubricLLMOutput = z.infer<typeof RubricLLMOutputSchema>;
