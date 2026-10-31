import { RubricCriterion } from "./study-set";
import {
  extractParagraphs,
  filterCriteriaForParagraph,
} from "./paragraph-scope";

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
  scopedParagraphIndex?: number | null;
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
  "into",
  "onto",
  "also",
  "over",
  "each",
  "both",
  "under",
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
 * Extracts a normalized stem for common English morphological suffixes.
 */
function getStem(word: string): string {
  let s = word
    .toLowerCase()
    .replace(/(ing|ed|es|s|tion|ation|ution|ly|ment|ive|al|er)$/, "");
  if (s.endsWith("u") && (s.endsWith("solu") || s.endsWith("evolu"))) {
    s = s.slice(0, -1) + "v";
  }
  return s;
}

/**
 * Checks whether two words share a common stem or match exactly.
 */
function isWordMatch(tokenA: string, tokenB: string): boolean {
  if (tokenA === tokenB) return true;
  if (tokenA.length >= 3 && tokenB.length >= 3) {
    const stemA = getStem(tokenA);
    const stemB = getStem(tokenB);
    if (stemA.length >= 3 && stemB.length >= 3) {
      if (stemA === stemB) return true;
      if (
        (stemA.length >= 4 && stemB.startsWith(stemA)) ||
        (stemB.length >= 4 && stemA.startsWith(stemB))
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Extracts a concise 1-3 word technical cue from a criterion name or sentence.
 * Strips numbering, boilerplate, punctuation, and returns a clean, capitalized 1-3 word phrase.
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
    /^(the\s+)?(concept of|explanation of|definition of|understanding of|overview of|importance of|role of|mechanism of|process of|description of)\s+/i,
    ""
  );

  // 3. Handle colon, dash, or semicolon separators:
  // If formatted as "Category: Specific Detail", prefer the specific detail after the separator
  // so multiple criteria sharing a category prefix (e.g. "DNS Resolution: Root query") don't collide.
  if (/[:\-–—;]/.test(text)) {
    const parts = text
      .split(/[:\-–—;]/)
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
      /^(the\s+)?(concept of|explanation of|definition of|understanding of|overview of|importance of|role of|mechanism of|process of|description of)\s+/i,
      ""
    )
    .trim();

  // Clean trailing punctuation and surrounding non-alphanumeric characters
  text = text.replace(/^[\s\W_]+|[\s\W_]+$/g, "").trim();

  // 4. Split into words and clean punctuation on individual tokens
  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/^[\s\W_]+|[\s\W_]+$/g, "").trim())
    .filter(Boolean);

  if (words.length === 0) return "";

  // If already 1 to 3 words, capitalize and return
  if (words.length <= 3) {
    const joined = words.join(" ");
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  }

  // Filter out stop words to preserve the most salient technical keywords
  const salient = words.filter((w) => !COMMON_STOP_WORDS.has(w.toLowerCase()));
  const targetWords =
    salient.length >= 1 ? salient.slice(0, 3) : words.slice(0, 3);
  const joined = targetWords.join(" ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
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
      continue;
    }

    // Check stem matches (e.g. "resolve" matches "resolver" or "resolving")
    for (const t of transcriptTokens) {
      if (isWordMatch(token, t)) {
        matches++;
        break;
      }
    }
  }

  // For 1-word cues, require full match
  if (cueTokens.length === 1) {
    return matches >= 1;
  }

  // For 2-word cues, require BOTH words to match
  if (cueTokens.length === 2) {
    return matches >= 2;
  }

  // For 3+ word cues, require at least 2 matches (>= 66% overlap)
  return matches >= Math.min(cueTokens.length, 2);
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
  scopedParagraphIndex = null,
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

  const paragraphs = extractParagraphs(referenceAnswer);
  const isParagraphScope =
    typeof scopedParagraphIndex === "number" && scopedParagraphIndex >= 0;

  const targetText =
    isParagraphScope && paragraphs[scopedParagraphIndex]
      ? paragraphs[scopedParagraphIndex]!
      : referenceAnswer;

  const effectiveCriteria = isParagraphScope
    ? filterCriteriaForParagraph(criteria, paragraphs, scopedParagraphIndex)
    : criteria;

  // 1. Try deriving next cue from Rubric Criteria
  if (effectiveCriteria && effectiveCriteria.length > 0) {
    for (const criterion of effectiveCriteria) {
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
    // All provided rubric criteria have either been mentioned or hinted
    return null;
  }

  // 2. Fallback: derive next cue from Reference Answer sentences ONLY when no criteria exist
  const cleanAnswer = targetText.trim();
  if (cleanAnswer.length >= 10) {
    const sentences = cleanAnswer
      .split(/(?<=[.?!])\s+|\n+/)
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
