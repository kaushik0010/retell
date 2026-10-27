import { z } from "zod";

/**
 * Criterion category defining the pedagogical purpose of the rubric item.
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
 * Human-readable metadata and styling configuration for rubric categories.
 */
export const RUBRIC_CATEGORY_META: Record<
  RubricCriterionCategory,
  {
    label: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
  }
> = {
  essential_concept: {
    label: "Essential Concept",
    description:
      "Core ideas the student must explain correctly to receive credit.",
    badgeBg: "bg-red-50",
    badgeText: "text-red-700",
    badgeBorder: "border-red-200",
  },
  technical_anchor: {
    label: "Technical Anchor",
    description: "Crucial technical terms, mechanisms, or named components.",
    badgeBg: "bg-orange-50",
    badgeText: "text-orange-700",
    badgeBorder: "border-orange-200",
  },
  relationship_sequence: {
    label: "Relationship / Sequence",
    description:
      "Required causal chains, procedural dependencies, or sequential steps.",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-200",
  },
  accuracy_constraint: {
    label: "Accuracy Constraint",
    description:
      "Common misconceptions or false statements that must not be made.",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200",
  },
  optional_detail: {
    label: "Supporting Detail",
    description: "Helpful nuance or context; adds depth but not mandatory.",
    badgeBg: "bg-stone-100",
    badgeText: "text-stone-700",
    badgeBorder: "border-stone-200",
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
});

export type ExtractedQuestion = z.infer<typeof ExtractedQuestionSchema>;

/**
 * Ingested study material metadata and original source text.
 */
export const StudyMaterialSchema = z.object({
  id: z.string().min(1, "Material ID is required"),
  title: z.string().min(1, "Title is required"),
  sourceText: z.string().min(20, "Source text must be at least 20 characters"),
  characterCount: z.number().int().nonnegative(),
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

// Request and LLM schemas for Extraction API
export const ExtractRequestSchema = z.object({
  title: z.string().max(120).optional(),
  sourceText: z
    .string()
    .min(20, "Study material must be at least 20 characters")
    .max(20000, "Study material exceeds 20,000 characters"),
});

export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

export const ExtractedQuestionLLMOutputSchema = z.object({
  question: z.string().min(5, "Question must be at least 5 characters"),
  referenceAnswer: z
    .string()
    .min(10, "Reference answer must be at least 10 characters"),
  sourceExcerpt: z.string().default(""),
});

export const ExtractionLLMOutputSchema = z.object({
  suggestedTitle: z.string().optional(),
  questions: z
    .array(ExtractedQuestionLLMOutputSchema)
    .min(1, "Must extract at least one question")
    .max(5, "Maximum 5 questions per extraction"),
});

export type ExtractionLLMOutput = z.infer<typeof ExtractionLLMOutputSchema>;

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
    .min(2, "Must generate at least 2 rubric criteria"),
});

export type RubricLLMOutput = z.infer<typeof RubricLLMOutputSchema>;
