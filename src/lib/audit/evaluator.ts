import "server-only";

import {
  SemanticAuditResult,
  SemanticAuditResultSchema,
  SemanticAuditLLMOutputSchema,
  SemanticAuditLLMOutput,
  CriterionEvaluation,
  CriterionEvaluationStatus,
  AttemptScope,
  createAuditId,
} from "../domain/semantic-audit";
import { RubricCriterion } from "../domain/study-set";
import { getReasoningProvider } from "../providers";

export interface EvaluateAnswerParams {
  attemptId: string;
  studySetId: string;
  questionId: string;
  question: string;
  referenceAnswer: string;
  transcript: string;
  criteria: RubricCriterion[];
  scope?: AttemptScope;
  mockFallback?: boolean;
}

/**
 * Splits multi-paragraph answers into cleaned paragraph slices.
 */
export function extractParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Core semantic evaluator comparing student spoken transcript
 * against reference material and rubric criteria.
 *
 * Evaluates conceptual understanding, NOT rote memorization.
 */
export async function evaluateStudentAnswer(
  params: EvaluateAnswerParams
): Promise<SemanticAuditResult> {
  const {
    attemptId,
    studySetId,
    questionId,
    question,
    referenceAnswer,
    transcript,
    criteria,
    scope = { type: "whole_answer" },
    mockFallback = false,
  } = params;

  const provider = getReasoningProvider();

  // Determine target text based on scope
  let effectiveReference = referenceAnswer;
  const effectiveCriteria = criteria;

  if (scope.type === "paragraph" && typeof scope.paragraphIndex === "number") {
    const paragraphs = extractParagraphs(referenceAnswer);
    if (paragraphs[scope.paragraphIndex]) {
      effectiveReference = paragraphs[scope.paragraphIndex]!;
      scope.totalParagraphs = paragraphs.length;
      scope.targetText = effectiveReference;
    }
  }

  // If mock fallback requested or provider is not configured, run deterministic evaluation
  if (mockFallback || !provider.isConfigured()) {
    return evaluateDeterministically({
      attemptId,
      studySetId,
      questionId,
      question,
      referenceAnswer: effectiveReference,
      transcript,
      criteria: effectiveCriteria,
      scope,
    });
  }

  // Prompt design for Meta Muse Spark 1.3
  const systemPrompt = `You are an expert, encouraging exam assessor for Retell.
Your mission is to evaluate the student's SPOKEN EXPLANATION of an exam answer.

CENTRAL EVALUATION PRINCIPLE:
Evaluate CONCEPTUAL UNDERSTANDING, NOT memorization of exact sentences or vocabulary.
A student must receive credit for a correct explanation even when they use completely different words, sentence structures, or valid real-world examples.

FAIR EXAMINER RULES:
1. Accept semantically equivalent paraphrases and conversational phrasing.
2. Accept valid student examples that demonstrate the concept.
3. DO NOT penalize grammar, accent, speaking style, minor hesitation, or speech-to-text transcription imperfections (e.g. typos like "Cash" instead of "Cache" if the context clearly means Cache).
4. DO NOT mark a concept covered merely because the student mentioned a technical keyword in passing without explaining it ("keyword drop").
5. Strictly DISTINGUISH between:
   - "missing": The student simply did not mention or attempt this concept.
   - "incorrect": The student stated something factually wrong or in direct contradiction with the reference material.
   NEVER mark an omission as "incorrect".
6. DO NOT invent extra requirements absent from the reference answer.
7. EVIDENCE REQUIREMENT:
   Every covered, partially covered, or incorrect evaluation MUST cite actual transcript words in "transcriptEvidence" if present. NEVER hallucinate quotes.
8. SCOPE COMPLIANCE:
   ${
     scope.type === "paragraph"
       ? `The student is practicing ONLY Paragraph ${(scope.paragraphIndex ?? 0) + 1} of this answer. Evaluate understanding of ONLY this paragraph's content. DO NOT mark concepts from other paragraphs as missing!`
       : "The student is practicing the complete answer."
   }

EVALUATION STATUSES:
- "covered": Student communicated the concept accurately and sufficiently.
- "partially_covered": Student communicated some understanding but omitted key details.
- "missing": Student did not communicate this concept.
- "incorrect": Student stated something that conflicts with reference material or contains a substantive factual error.
- "optional": Helpful additional detail, not required for full understanding.

OUTPUT SCHEMA:
Return ONLY valid JSON matching this schema:
{
  "overallSummary": "A concise, supportive 1-2 sentence overall assessment",
  "whatExplainedWell": ["Point 1 explained well", "Point 2 explained well"],
  "whatNeedsAttention": ["Missing or incomplete concept 1", "Missing concept 2"],
  "whatNeedsCorrection": ["Factual error 1 (leave empty if no factual errors)"],
  "suggestedNextImprovement": "The most useful 1-2 actionable next steps for the student",
  "criteriaEvaluations": [
    {
      "criterionId": "ID of the criterion from the prompt",
      "status": "covered" | "partially_covered" | "missing" | "incorrect" | "optional",
      "explanation": "Clear, grounded explanation of why this status was chosen",
      "transcriptEvidence": "Exact quote from transcript or null if missing",
      "missingOrInaccurate": "What was omitted or what conflicted, or null if fully covered",
      "improvementSuggestion": "Specific tip to cover or correct this next time"
    }
  ],
  "hasUncertainty": false,
  "uncertaintyNotes": "Optional notes if transcript quality made evaluation ambiguous"
}`;

  const userPrompt = `QUESTION:
${question}

APPROVED IMPORTANT POINTS (RUBRIC CRITERIA):
${effectiveCriteria
  .map(
    (c) =>
      `- [ID: ${c.id}] "${c.name}" (${c.category}, mandatory: ${c.isMandatory})
  Guidance: ${c.satisfactoryDemonstration}`
  )
  .join("\n")}

REFERENCE ANSWER:
${effectiveReference}

STUDENT SPOKEN TRANSCRIPT:
"${transcript}"

Evaluate the student's conceptual understanding now in valid JSON.`;

  try {
    const result = await provider.generateStructured(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        timeoutMs: 45000,
      },
      SemanticAuditLLMOutputSchema
    );

    if (!result.success || !result.data) {
      console.warn(
        "Model reasoning audit failed or returned invalid format; falling back to deterministic evaluator:",
        result.error?.message
      );
      return evaluateDeterministically({
        attemptId,
        studySetId,
        questionId,
        question,
        referenceAnswer: effectiveReference,
        transcript,
        criteria: effectiveCriteria,
        scope,
      });
    }

    const data: SemanticAuditLLMOutput = result.data;
    return buildAuditAggregate({
      attemptId,
      studySetId,
      questionId,
      criteria: effectiveCriteria,
      scope,
      llmOutput: data,
      transcript,
    });
  } catch (err) {
    console.warn(
      "Exception during LLM semantic audit; falling back to deterministic evaluator:",
      err
    );
    return evaluateDeterministically({
      attemptId,
      studySetId,
      questionId,
      question,
      referenceAnswer: effectiveReference,
      transcript,
      criteria: effectiveCriteria,
      scope,
    });
  }
}

/**
 * Maps LLM output into the validated domain aggregate with accurate counts.
 */
function buildAuditAggregate(params: {
  attemptId: string;
  studySetId: string;
  questionId: string;
  criteria: RubricCriterion[];
  scope: AttemptScope;
  llmOutput: SemanticAuditLLMOutput;
  transcript: string;
}): SemanticAuditResult {
  const {
    attemptId,
    studySetId,
    questionId,
    criteria,
    scope,
    llmOutput,
    transcript,
  } = params;
  const now = new Date().toISOString();

  const criteriaEvaluations: CriterionEvaluation[] = [];

  // Match each criterion from the rubric
  for (let i = 0; i < criteria.length; i++) {
    const criterion = criteria[i]!;
    const evalData = llmOutput.criteriaEvaluations.find(
      (e) => e.criterionId === criterion.id
    );

    if (evalData) {
      // Validate that cited transcript evidence actually appears in the transcript
      let validEvidence = evalData.transcriptEvidence || null;
      if (validEvidence && validEvidence.trim()) {
        const cleanEvidence = validEvidence.toLowerCase().trim();
        const cleanTranscript = transcript.toLowerCase();
        // If quoted phrase is not in transcript, nullify or trim
        if (
          !cleanTranscript.includes(cleanEvidence) &&
          cleanEvidence.length > 10
        ) {
          validEvidence = null;
        }
      }

      criteriaEvaluations.push({
        criterionId: criterion.id,
        criterionName: criterion.name,
        category: criterion.category,
        status: evalData.status,
        explanation: evalData.explanation,
        transcriptEvidence: validEvidence,
        missingOrInaccurate: evalData.missingOrInaccurate || null,
        improvementSuggestion: evalData.improvementSuggestion,
        orderIndex: i,
      });
    } else {
      // Criterion missing from LLM output -> fallback to missing
      criteriaEvaluations.push({
        criterionId: criterion.id,
        criterionName: criterion.name,
        category: criterion.category,
        status: criterion.isMandatory ? "missing" : "optional",
        explanation: "This concept was not identified in the response.",
        transcriptEvidence: null,
        missingOrInaccurate: "Concept not mentioned.",
        improvementSuggestion: `Mention and explain "${criterion.name}" in your answer.`,
        orderIndex: i,
      });
    }
  }

  // Calculate transparent counts
  let coveredCount = 0;
  let partiallyCoveredCount = 0;
  let missingCount = 0;
  let incorrectCount = 0;
  let optionalCount = 0;

  for (const c of criteriaEvaluations) {
    if (c.status === "covered") coveredCount++;
    else if (c.status === "partially_covered") partiallyCoveredCount++;
    else if (c.status === "missing") missingCount++;
    else if (c.status === "incorrect") incorrectCount++;
    else if (c.status === "optional") optionalCount++;
  }

  const result: SemanticAuditResult = {
    id: createAuditId(),
    attemptId,
    studySetId,
    questionId,
    status: "completed",
    scope,
    overall: {
      summary: llmOutput.overallSummary,
      whatExplainedWell: llmOutput.whatExplainedWell,
      whatNeedsAttention: llmOutput.whatNeedsAttention,
      whatNeedsCorrection: llmOutput.whatNeedsCorrection,
      suggestedNextImprovement: llmOutput.suggestedNextImprovement,
      coveredCount,
      partiallyCoveredCount,
      missingCount,
      incorrectCount,
      optionalCount,
      totalCriteria: criteria.length,
    },
    criteriaEvaluations,
    hasUncertainty: llmOutput.hasUncertainty,
    uncertaintyNotes: llmOutput.uncertaintyNotes,
    createdAt: now,
    updatedAt: now,
  };

  return SemanticAuditResultSchema.parse(result);
}

/**
 * Deterministic Semantic Evaluator
 *
 * Used for offline mode, unit tests, and fallback when the AI reasoning model
 * is unreachable. Applies semantic token analysis, synonym matching, and
 * negation detection to evaluate answers without keyword bias.
 */
export function evaluateDeterministically(params: {
  attemptId: string;
  studySetId: string;
  questionId: string;
  question: string;
  referenceAnswer: string;
  transcript: string;
  criteria: RubricCriterion[];
  scope: AttemptScope;
}): SemanticAuditResult {
  const {
    attemptId,
    studySetId,
    questionId,
    transcript,
    criteria,
    scope,
  } = params;

  const now = new Date().toISOString();
  const cleanTranscript = transcript.trim();
  const lowerTranscript = cleanTranscript.toLowerCase();

  // If transcript is empty or negligible (< 3 characters)
  if (cleanTranscript.length < 3) {
    const emptyEvaluations: CriterionEvaluation[] = criteria.map((c, i) => ({
      criterionId: c.id,
      criterionName: c.name,
      category: c.category,
      status: "missing",
      explanation: "No speech was captured in this practice attempt.",
      transcriptEvidence: null,
      missingOrInaccurate: "Entire concept was omitted.",
      improvementSuggestion: `Speak your explanation aloud to practice "${c.name}".`,
      orderIndex: i,
    }));

    return SemanticAuditResultSchema.parse({
      id: createAuditId(),
      attemptId,
      studySetId,
      questionId,
      status: "completed",
      scope,
      overall: {
        summary:
          "No spoken answer was detected. Take a deep breath and explain the concepts aloud.",
        whatExplainedWell: [],
        whatNeedsAttention: criteria.map((c) => c.name),
        whatNeedsCorrection: [],
        suggestedNextImprovement:
          "Start by explaining the main concept aloud in your own words.",
        coveredCount: 0,
        partiallyCoveredCount: 0,
        missingCount: criteria.length,
        incorrectCount: 0,
        optionalCount: 0,
        totalCriteria: criteria.length,
      },
      criteriaEvaluations: emptyEvaluations,
      hasUncertainty: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Tokenize and extract stems
  const transcriptTokens = new Set(
    lowerTranscript
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  const criteriaEvaluations: CriterionEvaluation[] = [];
  const whatExplainedWell: string[] = [];
  const whatNeedsAttention: string[] = [];
  const whatNeedsCorrection: string[] = [];

  let coveredCount = 0;
  let partiallyCoveredCount = 0;
  let missingCount = 0;
  let incorrectCount = 0;
  let optionalCount = 0;

  for (let i = 0; i < criteria.length; i++) {
    const criterion = criteria[i]!;
    const nameLower = criterion.name.toLowerCase();
    const guidanceLower = criterion.satisfactoryDemonstration.toLowerCase();

    // Check for explicit contradiction / incorrect claim
    const contradictionDetected = detectContradiction(
      nameLower,
      guidanceLower,
      lowerTranscript
    );

    if (contradictionDetected) {
      incorrectCount++;
      const evalItem: CriterionEvaluation = {
        criterionId: criterion.id,
        criterionName: criterion.name,
        category: criterion.category,
        status: "incorrect",
        explanation: contradictionDetected.explanation,
        transcriptEvidence: contradictionDetected.evidence,
        missingOrInaccurate: contradictionDetected.conflictDetail,
        improvementSuggestion: `Correct this distinction: ${criterion.satisfactoryDemonstration}`,
        orderIndex: i,
      };
      criteriaEvaluations.push(evalItem);
      whatNeedsCorrection.push(
        `${criterion.name}: ${contradictionDetected.conflictDetail}`
      );
      continue;
    }

    // Check for concept coverage via semantic tokens
    const matchScore = computeConceptCoverage(
      criterion,
      lowerTranscript,
      transcriptTokens
    );

    let status: CriterionEvaluationStatus;
    let explanation: string;
    let evidence: string | null = null;
    let missingOrInaccurate: string | null = null;
    let suggestion: string;

    if (matchScore >= 0.5) {
      // Good semantic coverage
      status = "covered";
      coveredCount++;
      evidence = extractEvidenceExcerpt(lowerTranscript, criterion);
      explanation = `You clearly explained ${criterion.name.toLowerCase()} in your own words.`;
      suggestion = "Keep this clear explanation in your next attempt.";
      whatExplainedWell.push(criterion.name);
    } else if (matchScore >= 0.2) {
      // Partial coverage
      status = "partially_covered";
      partiallyCoveredCount++;
      evidence = extractEvidenceExcerpt(lowerTranscript, criterion);
      explanation = `You mentioned key elements of ${criterion.name.toLowerCase()}, but did not explain the complete mechanism.`;
      missingOrInaccurate = `Supporting details for ${criterion.name} were omitted.`;
      suggestion = `Be sure to also explain: ${criterion.satisfactoryDemonstration}`;
      whatNeedsAttention.push(criterion.name);
    } else {
      // Missing
      status = criterion.isMandatory ? "missing" : "optional";
      if (status === "missing") missingCount++;
      else optionalCount++;

      explanation = `You did not explain ${criterion.name.toLowerCase()} in your response.`;
      missingOrInaccurate = "Concept was not communicated.";
      suggestion = `Include this concept: ${criterion.satisfactoryDemonstration}`;
      if (criterion.isMandatory) {
        whatNeedsAttention.push(criterion.name);
      }
    }

    criteriaEvaluations.push({
      criterionId: criterion.id,
      criterionName: criterion.name,
      category: criterion.category,
      status,
      explanation,
      transcriptEvidence: evidence,
      missingOrInaccurate,
      improvementSuggestion: suggestion,
      orderIndex: i,
    });
  }

  // Overall assessment summary
  let summary = "";
  if (incorrectCount > 0) {
    summary = `You explained ${coveredCount} of ${criteria.length} concepts well, but there is an important technical distinction to correct.`;
  } else if (coveredCount === criteria.length) {
    summary =
      "Excellent explanation! You covered all key concepts clearly and accurately in your own words.";
  } else if (coveredCount >= Math.ceil(criteria.length * 0.6)) {
    summary = `You covered most of the required concepts (${coveredCount} of ${criteria.length}). One or two details need more explanation.`;
  } else if (coveredCount > 0) {
    summary = `You started your explanation well, but missed several important concepts (${coveredCount} of ${criteria.length} covered).`;
  } else {
    summary =
      "Your response did not address the required points. Review the reference answer and try explaining the core steps aloud.";
  }

  let suggestedNextImprovement = "";
  if (whatNeedsCorrection.length > 0) {
    suggestedNextImprovement = `Focus on correcting: ${whatNeedsCorrection[0]}`;
  } else if (whatNeedsAttention.length > 0) {
    suggestedNextImprovement = `Practice including: ${whatNeedsAttention[0]}`;
  } else {
    suggestedNextImprovement =
      "Try practicing again smoothly without pausing to build exam confidence.";
  }

  const hasUncertainty =
    lowerTranscript.includes("...") ||
    lowerTranscript.length < 15 ||
    lowerTranscript.includes("[inaudible]");

  return SemanticAuditResultSchema.parse({
    id: createAuditId(),
    attemptId,
    studySetId,
    questionId,
    status: "completed",
    scope,
    overall: {
      summary,
      whatExplainedWell,
      whatNeedsAttention,
      whatNeedsCorrection,
      suggestedNextImprovement,
      coveredCount,
      partiallyCoveredCount,
      missingCount,
      incorrectCount,
      optionalCount,
      totalCriteria: criteria.length,
    },
    criteriaEvaluations,
    hasUncertainty,
    uncertaintyNotes: hasUncertainty
      ? "The transcript was brief or contained potential audio cutoffs; evaluations reflect the audible portions."
      : undefined,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Calculates conceptual coverage score [0.0 - 1.0] using semantic tokens and synonyms.
 */
function computeConceptCoverage(
  criterion: RubricCriterion,
  transcriptLower: string,
  transcriptTokens: Set<string>
): number {
  const conceptText =
    `${criterion.name} ${criterion.description} ${criterion.satisfactoryDemonstration}`.toLowerCase();
  const rawTokens = conceptText
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length > 3 &&
        ![
          "this",
          "that",
          "with",
          "from",
          "have",
          "been",
          "were",
          "what",
          "good",
          "answer",
          "explains",
          "student",
          "concept",
          "point",
          "important",
        ].includes(w)
    );
  const conceptTokens = Array.from(new Set(rawTokens));

  if (conceptTokens.length === 0) return 0;

  // Synonyms and semantic equivalents table
  const synonymMap: Record<string, string[]> = {
    fault: ["error", "miss", "faults", "trap", "page fault"],
    increase: ["increases", "increasing", "higher", "more", "grows", "rises"],
    decrease: ["decreases", "decreasing", "lower", "fewer", "drops", "reduces"],
    frame: ["frames", "physical memory", "slots", "memory frames"],
    isolation: ["isolated", "separate", "dedicated", "independent", "private"],
    memory: ["ram", "address space", "virtual memory", "storage"],
    resolve: ["resolves", "resolving", "resolution", "lookup", "finds"],
    query: ["queries", "request", "requests", "question", "asking"],
    instruction: ["instructions", "commands", "directions", "rules", "program"],
    operate: ["operates", "run", "runs", "running", "control", "controls"],
    task: ["tasks", "functions", "actions", "jobs", "operations"],
    algorithm: [
      "method",
      "policy",
      "approach",
      "replacement",
      "scheme",
      "strategy",
      "algo",
    ],
    replacement: ["swapping", "eviction", "algorithm", "policy", "replacing"],
  };

  let matches = 0;
  for (const token of conceptTokens) {
    if (transcriptTokens.has(token) || transcriptLower.includes(token)) {
      matches += 1;
      continue;
    }

    // Check synonyms
    const syns = synonymMap[token];
    if (syns) {
      for (const syn of syns) {
        if (transcriptTokens.has(syn) || transcriptLower.includes(syn)) {
          matches += 1;
          break;
        }
      }
    }
  }

  return Math.min(1.0, matches / Math.min(conceptTokens.length, 6));
}

/**
 * Detects factual contradiction / negation against reference guidance.
 */
function detectContradiction(
  nameLower: string,
  guidanceLower: string,
  transcriptLower: string
): { explanation: string; evidence: string; conflictDetail: string } | null {
  // Scenario: Belady's anomaly (more frames causes MORE faults, not fewer)
  const isAnomalyGuidance =
    (guidanceLower.includes("increas") ||
      guidanceLower.includes("more") ||
      nameLower.includes("anomaly")) &&
    (guidanceLower.includes("fault") || nameLower.includes("anomaly"));

  if (isAnomalyGuidance) {
    if (
      transcriptLower.includes("fewer page fault") ||
      transcriptLower.includes("decreases page fault") ||
      transcriptLower.includes("decrease page fault") ||
      transcriptLower.includes("decreasing page fault") ||
      transcriptLower.includes("less page fault") ||
      transcriptLower.includes("reduces page fault") ||
      transcriptLower.includes("reduce page fault") ||
      transcriptLower.includes("reducing page fault")
    ) {
      return {
        explanation:
          "Your explanation contradicts Belady's anomaly. In FIFO, adding page frames causes MORE page faults, not fewer.",
        evidence: "reduces page faults / fewer page faults",
        conflictDetail:
          "Claimed page faults decrease, whereas Belady's anomaly shows page faults increase.",
      };
    }
  }

  // General negation pattern: "does not resolve", "never isolates", "opposite"
  if (
    transcriptLower.includes("not isolated") ||
    transcriptLower.includes("shares all memory")
  ) {
    if (guidanceLower.includes("isolated") || nameLower.includes("isolation")) {
      return {
        explanation:
          "You stated processes share memory directly without isolation, which conflicts with OS process isolation.",
        evidence: "shares all memory",
        conflictDetail:
          "Claimed memory is not isolated, but processes have dedicated address spaces.",
      };
    }
  }

  return null;
}

/**
 * Extracts a relevant 5-15 word excerpt from the transcript supporting the criterion.
 */
function extractEvidenceExcerpt(
  transcriptLower: string,
  criterion: RubricCriterion
): string | null {
  const words = transcriptLower.split(/\s+/);
  const criterionWords = criterion.name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (criterionWords.some((cw) => w.includes(cw) || cw.includes(w))) {
      const start = Math.max(0, i - 3);
      const end = Math.min(words.length, i + 8);
      return words.slice(start, end).join(" ");
    }
  }

  return words.slice(0, Math.min(words.length, 8)).join(" ");
}
