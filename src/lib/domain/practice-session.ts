import { z } from "zod";

/**
 * Practice session state machine lifecycle.
 */
export const PracticeSessionStateSchema = z.enum([
  "idle",
  "requesting_permission",
  "connecting",
  "listening",
  "finishing",
  "auditing",
  "completed",
  "error",
]);

export type PracticeSessionState = z.infer<typeof PracticeSessionStateSchema>;

/**
 * Categorized error types for friendly student recovery guidance.
 */
export const PracticeErrorTypeSchema = z.enum([
  "PERMISSION_DENIED",
  "NO_MICROPHONE",
  "CONNECTION_FAILED",
  "STREAM_ERROR",
  "UNKNOWN",
]);

export type PracticeErrorType = z.infer<typeof PracticeErrorTypeSchema>;

export interface PracticeError {
  type: PracticeErrorType;
  message: string;
  suggestion?: string;
}

/**
 * Individual transcript chunk or token from the speech recognizer.
 */
export const LiveTranscriptSegmentSchema = z.object({
  id: z.string(),
  text: z.string(),
  isFinal: z.boolean().default(false),
  timestampMs: z.number().default(0),
});

export type LiveTranscriptSegment = z.infer<typeof LiveTranscriptSegmentSchema>;

/**
 * Persisted student attempt record.
 */
export const PracticeAttemptSchema = z.object({
  id: z.string().min(1, "Attempt ID is required"),
  studySetId: z.string().min(1, "Study set ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  transcript: z.string().default(""),
  wordCount: z.number().int().nonnegative().default(0),
  durationSeconds: z.number().int().nonnegative().default(0),
  status: z.enum(["completed", "partial", "abandoned"]).default("completed"),
  audioProcessedMs: z.number().int().nonnegative().optional(),
  scope: z
    .enum(["whole_answer", "paragraph", "selected_paragraphs"])
    .optional(),
  paragraphIndex: z.number().int().nonnegative().optional(),
  auditId: z.string().optional(),
  createdAt: z.string(),
});

export type PracticeAttempt = z.infer<typeof PracticeAttemptSchema>;

/**
 * Calculate accurate word count from raw transcript text.
 */
export function calculateWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Generate a unique attempt ID.
 */
export function createAttemptId(): string {
  return `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
