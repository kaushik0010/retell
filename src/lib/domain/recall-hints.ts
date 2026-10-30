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
 * Avoids cutting off meaningful concept words at colons or dashes.
 */
export function extractConciseCue(raw: string): string {
  let text = raw.trim();

  // 1. Remove numbering prefixes: "1. ", "Step 1: ", "Criterion 1 - "
  text = text.replace(
    /^(step|criterion|point|item)?\s*\d+[\.\:\)\-–—]\s*/i,
    ""
  );

  // 2. Remove generic academic boilerplate prefixes
  text = text.replace(
    /^(concept of|explanation of|definition of|understanding of|overview of|importance of|role of|mechanism of)\s+/i,
    ""
  );

  // 3. Handle colon or dash separators:
  // If formatted as "Category: Specific Detail", prefer the specific detail after the separator
  // so multiple criteria sharing a category prefix (e.g. "DNS Resolution: Root query") don't collide.
  if (/[:\-–—]/.test(text)) {
    const parts = text
      .split(/[:\-–—]/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      const afterSeparator = parts.slice(1).join(" ").trim();
      // If the content after separator has meaningful words, use it; otherwise fall back to first part
      if (afterSeparator.length >= 4) {
        text = afterSeparator;
      } else if (parts[0] && parts[0].length >= 4) {
        text = parts[0];
      }
    }
  }

  // Remove secondary boilerplate that might have followed the separator
  text = text
    .replace(
      /^(concept of|explanation of|definition of|understanding of|overview of|importance of|role of|mechanism of)\s+/i,
      ""
    )
    .trim();

  // 4. Split into words and limit to 1-4 words (concise cue)
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 4) {
    return words.join(" ");
  }

  // Filter out stop words to preserve the most salient keywords
  const salient = words.filter((w) => !COMMON_STOP_WORDS.has(w.toLowerCase()));
  if (salient.length >= 2 && salient.length <= 4) {
    return salient.join(" ");
  }
  if (salient.length > 4) {
    return salient.slice(0, 3).join(" ");
  }

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
    } else {
      // Check partial/stem matches (e.g. "resolve" matches "resolver" or "resolving")
      for (const t of transcriptTokens) {
        if (
          (token.length >= 4 && t.startsWith(token.slice(0, -1))) ||
          (t.length >= 4 && token.startsWith(t.slice(0, -1)))
        ) {
          matches++;
          break;
        }
      }
    }
  }

  // If majority of key tokens appear, consider covered
  return matches >= Math.ceil(cueTokens.length * 0.6);
}

/**
 * Generates an answer-grounded recall hint when a student pauses.
 * Returns null if no grounded hint is possible or all concepts have been covered.
 * Continues offering useful hints across the entire attempt without an arbitrary limit.
 */
export function generateRecallHint({
  referenceAnswer = "",
  criteria = [],
  currentTranscript = "",
  previousHints = [],
  maxHintsPerAttempt = Infinity,
}: GenerateRecallHintParams): RecallHint | null {
  // Optional cap: only enforced if explicitly passed as a finite number
  if (
    Number.isFinite(maxHintsPerAttempt) &&
    previousHints.length >= maxHintsPerAttempt
  ) {
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
