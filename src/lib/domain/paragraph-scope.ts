import { RubricCriterion } from "./study-set";
import { AttemptScope } from "./semantic-audit";

/**
 * Splits multi-paragraph text by double newlines into clean paragraph slices.
 */
export function extractParagraphs(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Stable paragraph identifier (e.g., 'p_1', 'p_2').
 */
export function getParagraphId(paragraphIndex: number): string {
  return `p_${paragraphIndex + 1}`;
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
 * Tokenizes text into normalized stems.
 */
function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !COMMON_STOP_WORDS.has(w));
}

function stemWord(word: string): string {
  let s = word
    .toLowerCase()
    .replace(/(ing|ed|es|s|tion|ation|ution|ly|ment|ive|al|er)$/, "");
  if (s.endsWith("u") && (s.endsWith("solu") || s.endsWith("evolu"))) {
    s = s.slice(0, -1) + "v";
  }
  return s;
}

function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 3 && b.length >= 3) {
    const sA = stemWord(a);
    const sB = stemWord(b);
    if (sA.length >= 3 && sB.length >= 3) {
      if (sA === sB) return true;
      if (
        (sA.length >= 4 && sB.startsWith(sA)) ||
        (sB.length >= 4 && sA.startsWith(sB))
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculates keyword overlap score between a criterion and a paragraph.
 */
export function getCriterionParagraphScore(
  criterion: RubricCriterion,
  paragraphText: string
): number {
  const targetTokens = new Set(tokenizeWords(paragraphText));
  const criterionTokens = tokenizeWords(
    `${criterion.name} ${criterion.description} ${criterion.satisfactoryDemonstration}`
  );

  let score = 0;
  for (const token of criterionTokens) {
    if (targetTokens.has(token)) {
      score++;
      continue;
    }
    for (const t of targetTokens) {
      if (wordsMatch(token, t)) {
        score++;
        break;
      }
    }
  }
  return score;
}

/**
 * Maps each rubric criterion to the single paragraph that best represents it.
 */
export function mapCriteriaToParagraphs(
  criteria: RubricCriterion[],
  paragraphs: string[]
): Map<number, RubricCriterion[]> {
  const result = new Map<number, RubricCriterion[]>();
  for (let i = 0; i < paragraphs.length; i++) {
    result.set(i, []);
  }

  if (paragraphs.length === 0) return result;
  if (paragraphs.length === 1) {
    result.set(0, [...criteria]);
    return result;
  }

  for (let cIdx = 0; cIdx < criteria.length; cIdx++) {
    const criterion = criteria[cIdx]!;
    let bestParagraphIndex = -1;
    let highestScore = 0;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const score = getCriterionParagraphScore(criterion, paragraphs[pIdx]!);
      if (score > highestScore) {
        highestScore = score;
        bestParagraphIndex = pIdx;
      }
    }

    // If score is 0 across all paragraphs, assign based on relative order index
    if (bestParagraphIndex === -1 || highestScore === 0) {
      bestParagraphIndex = Math.min(
        paragraphs.length - 1,
        Math.floor(
          (criterion.orderIndex / Math.max(criteria.length, 1)) *
            paragraphs.length
        )
      );
    }

    const currentList = result.get(bestParagraphIndex) || [];
    currentList.push(criterion);
    result.set(bestParagraphIndex, currentList);
  }

  return result;
}

/**
 * Filters criteria strictly belonging to the specified paragraph.
 * If no criteria map to this paragraph, synthesizes baseline criteria from its sentences.
 */
export function filterCriteriaForParagraph(
  criteria: RubricCriterion[],
  paragraphs: string[],
  paragraphIndex: number
): RubricCriterion[] {
  if (paragraphs.length <= 1) {
    return criteria;
  }

  const mapping = mapCriteriaToParagraphs(criteria, paragraphs);
  const matched = mapping.get(paragraphIndex) || [];

  if (matched.length > 0) {
    return matched;
  }

  // Synthesize baseline criteria from paragraph sentences if no existing criteria mapped
  const paragraphText = paragraphs[paragraphIndex];
  if (paragraphText) {
    const sentences = paragraphText
      .split(/(?<=[.?!])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);
    const chosen = sentences.length > 0 ? sentences : [paragraphText];
    return chosen.map((sent, idx) => ({
      id: `crit_p${paragraphIndex + 1}_${idx + 1}`,
      name: sent.length > 60 ? `${sent.slice(0, 57)}...` : sent,
      category: "essential_concept" as const,
      description: sent,
      satisfactoryDemonstration: sent,
      isMandatory: true,
      orderIndex: idx,
    }));
  }

  return [];
}

export interface ScopedPracticeContext {
  isParagraph: boolean;
  paragraphIndex?: number;
  totalParagraphs: number;
  paragraphText: string;
  criteria: RubricCriterion[];
}

/**
 * Authoritatively resolves the practice scope, reference text, and criteria.
 * Throws an error if a paragraph scope cannot be resolved from the reference answer.
 */
export function resolvePracticeScope(params: {
  referenceAnswer: string;
  criteria: RubricCriterion[];
  scope?: AttemptScope;
}): ScopedPracticeContext {
  const { referenceAnswer, criteria, scope } = params;
  const paragraphs = extractParagraphs(referenceAnswer);

  if (scope?.type === "paragraph") {
    if (typeof scope.paragraphIndex !== "number" || scope.paragraphIndex < 0) {
      throw new Error(
        "Invalid paragraph practice scope: paragraphIndex is required."
      );
    }

    if (!paragraphs[scope.paragraphIndex]) {
      throw new Error(
        `Cannot resolve selected Paragraph ${scope.paragraphIndex + 1} from reference answer (found ${paragraphs.length} paragraphs).`
      );
    }

    const paragraphText = paragraphs[scope.paragraphIndex]!;
    const scopedCriteria = filterCriteriaForParagraph(
      criteria,
      paragraphs,
      scope.paragraphIndex
    );

    return {
      isParagraph: true,
      paragraphIndex: scope.paragraphIndex,
      totalParagraphs: paragraphs.length,
      paragraphText,
      criteria: scopedCriteria,
    };
  }

  return {
    isParagraph: false,
    totalParagraphs: Math.max(paragraphs.length, 1),
    paragraphText: referenceAnswer,
    criteria,
  };
}
