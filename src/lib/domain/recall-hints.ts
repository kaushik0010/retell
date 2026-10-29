import { RubricCriterion } from "./study-set";

export interface RecallHint {
  cue: string;
  source: "criterion" | "reference_answer";
  criterionName?: string;
}

export interface GenerateRecallHintParams {
  referenceAnswer?: string;
  criteria?: RubricCriterion[];
  currentTranscript: string;
  previousHints?: string[];
  maxHintsPerAttempt?: number;
}

const COMMON_STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "in",
  "on",
  "at",
  "of",
  "to",
  "for",
  "with",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "that",
  "this",
  "it",
  "as",
  "from",
  "which",
  "their",
  "there",
  "when",
  "where",
  "than",
  "then",
  "concept",
  "explanation",
  "definition",
  "understanding",
  "importance",
  "overview",
]);

/**
 * Normalizes text to lowercase alphanumeric tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !COMMON_STOP_WORDS.has(w));
}

/**
 * Extracts a concise 1-4 word recall cue from a criterion name or sentence.
 */
function extractConciseCue(raw: string): string {
  // Remove filler prefixes
  const cleaned = raw
    .replace(
      /^(concept of|explanation of|definition of|understanding of|overview of)\s+/i,
      ""
    )
    .replace(/[:\-–—].*$/, "")
    .trim();

  // Split into words
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return words.join(" ");
  }

  // Pick first 3 significant words
  return words.slice(0, 3).join(" ");
}

/**
 * Checks whether the student's spoken transcript already addresses a candidate cue.
 */
function isConceptMentioned(
  transcriptTokens: Set<string>,
  cue: string
): boolean {
  const cueTokens = tokenize(cue);
  if (cueTokens.length === 0) return false;

  let matches = 0;
  for (const token of cueTokens) {
    if (transcriptTokens.has(token)) {
      matches++;
    }
  }

  // If majority of key tokens appear, consider covered
  return matches >= Math.ceil(cueTokens.length * 0.6);
}

/**
 * Generates an answer-grounded recall hint when a student pauses.
 * Returns null if no grounded hint is possible or if max hints reached.
 */
export function generateRecallHint({
  referenceAnswer = "",
  criteria = [],
  currentTranscript = "",
  previousHints = [],
  maxHintsPerAttempt = 3,
}: GenerateRecallHintParams): RecallHint | null {
  // Guard: Cap maximum hints to avoid revealing the entire answer
  if (previousHints.length >= maxHintsPerAttempt) {
    return null;
  }

  const transcriptTokens = new Set(tokenize(currentTranscript));
  const seenCues = new Set(previousHints.map((h) => h.toLowerCase().trim()));

  // 1. Try deriving next cue from Rubric Criteria
  if (criteria && criteria.length > 0) {
    for (const criterion of criteria) {
      const cue = extractConciseCue(criterion.name);
      if (!cue || cue.length < 3) continue;

      const normalizedCue = cue.toLowerCase();
      if (seenCues.has(normalizedCue)) continue;

      if (!isConceptMentioned(transcriptTokens, cue)) {
        return {
          cue,
          source: "criterion",
          criterionName: criterion.name,
        };
      }
    }
    // All provided rubric criteria have been addressed
    return null;
  }

  // 2. Fallback: derive next cue from Reference Answer sentences when no criteria exist
  const cleanAnswer = referenceAnswer.trim();
  if (cleanAnswer.length >= 10) {
    const sentences = cleanAnswer
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    for (const sentence of sentences) {
      const cue = extractConciseCue(sentence);
      if (!cue || cue.length < 3) continue;

      const normalizedCue = cue.toLowerCase();
      if (seenCues.has(normalizedCue)) continue;

      if (!isConceptMentioned(transcriptTokens, cue)) {
        return {
          cue,
          source: "reference_answer",
        };
      }
    }
  }

  // If everything has been mentioned or no valid cues could be derived, show nothing
  return null;
}
