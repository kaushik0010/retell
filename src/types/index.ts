/**
 * Core domain types for Retell.
 * These types establish the shared foundational contracts across the application.
 */

export * from "../lib/domain/study-set";

export type ProviderId = "meta" | "baseten";

export interface ConceptRubricItem {
  id: string;
  name: string;
  description: string;
  requiredTerminology: string[];
  relationships: string[];
  isEssential: boolean;
  orderIndex: number;
}

export interface RubricDefinition {
  id: string;
  sourceMaterialId: string;
  question: string;
  referenceAnswer: string;
  concepts: ConceptRubricItem[];
  createdAt: string;
  updatedAt: string;
}

export type ConceptCoverageStatus =
  "correct" | "partially_covered" | "missing" | "incorrect";

export interface ConceptEvaluation {
  conceptId: string;
  status: ConceptCoverageStatus;
  evidence: string[];
  feedback: string;
}

export interface AnswerAuditResult {
  attemptId: string;
  rubricId: string;
  transcript: string;
  durationMs: number;
  evaluations: ConceptEvaluation[];
  summaryFeedback: string;
  createdAt: string;
}
