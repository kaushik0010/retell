import "server-only";

import { NextRequest, NextResponse } from "next/server";
import {
  RubricRequestSchema,
  RubricLLMOutputSchema,
  QuestionRubric,
  RubricCriterion,
} from "@/lib/domain/study-set";
import { getReasoningProvider } from "@/lib/providers";
import { sanitizeError } from "@/lib/providers/errors";
import { guardAiEndpoint, completeAiExecution } from "@/lib/accounting";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedRequest = RubricRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: parsedRequest.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      questionId,
      question,
      referenceAnswer,
      sourceText,
      studyMaterialId,
    } = parsedRequest.data;

    const provider = getReasoningProvider();

    const guard = await guardAiEndpoint(req, "rubric", {
      charCount: referenceAnswer.length + sourceText.length,
    });
    if (!guard.proceed) {
      return guard.response;
    }

    if (!provider.isConfigured()) {
      return completeAiExecution({
        response: NextResponse.json(
          {
            success: false,
            error:
              "Reasoning provider is not configured. Please verify your API key in .env.local.",
          },
          { status: 503 }
        ),
        identity: guard.identity,
        reservationId: guard.reservationId,
        isDefiniteFailure: true,
      });
    }

    const systemPrompt = `You are an expert exam preparation coach for Retell.
Your role is to identify the IMPORTANT POINTS TO REMEMBER for a student studying this question and answer.

PEDAGOGICAL OBJECTIVE:
When students practice speaking their answer aloud, examiners look for specific core ideas, terminology, and logical connections.
Identify the essential points grounded directly in the student's answer.

CATEGORIES TO USE (Use only those that genuinely apply; do not force every question into all 5):
1. "essential_concept": Main idea that makes the answer fundamentally correct (isMandatory: true).
2. "technical_anchor": Key terms, formulas, mechanisms, or specific words examiners expect (isMandatory: true).
3. "relationship_sequence": Steps in order, causal chains, or connections between ideas (isMandatory: true, only when an order or connection exists).
4. "accuracy_constraint": Mistakes to avoid; common student traps or misconceptions (isMandatory: true, only when realistic traps exist).
5. "optional_detail": Helpful extras or bonus depth that improve an answer but are not strictly required (isMandatory: false).

SEMANTIC PARAPHRASING MANDATE:
Retell evaluates conceptual understanding, NOT literal keyword matching.
In "satisfactoryDemonstration", clearly describe what a correct answer explains, emphasizing that students may use their own words and synonyms.

Return valid JSON:
{
  "criteria": [
    {
      "category": "essential_concept" | "technical_anchor" | "relationship_sequence" | "accuracy_constraint" | "optional_detail",
      "name": "Short, natural title for this point (e.g., 'Root to TLD sequence' or 'Proton Motive Force')",
      "description": "What this point covers",
      "satisfactoryDemonstration": "What a good answer explains in the student's own words",
      "isMandatory": true | false
    }
  ]
}`;

    const userPrompt = `EXAM QUESTION:
${question}

ORIGINAL ANSWER FROM STUDENT NOTES:
${referenceAnswer}

ADDITIONAL CONTEXT (FROM NOTES):
---
${sourceText.slice(0, 3000)}
---

Identify the important points to remember in valid JSON.`;

    const result = await provider.generateStructured(
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      },
      RubricLLMOutputSchema
    );

    if (!result.success || !result.data) {
      return completeAiExecution({
        response: NextResponse.json(
          {
            success: false,
            error:
              result.error?.message ||
              "Failed to find important points for this question.",
            category: result.error?.category || "MODEL_UNAVAILABLE",
          },
          { status: 502 }
        ),
        identity: guard.identity,
        reservationId: guard.reservationId,
        isDefiniteFailure:
          result.error?.category === "AUTHENTICATION_ERROR" ||
          result.error?.category === "MODEL_UNAVAILABLE",
        isUncertainOutcome:
          result.error?.category === "TIMEOUT" ||
          result.error?.category === "NETWORK_ERROR",
      });
    }

    const now = new Date().toISOString();
    const criteria: RubricCriterion[] = result.data.criteria.map(
      (c, index) => ({
        id: `crit_${crypto.randomUUID()}`,
        category: c.category,
        name: c.name,
        description: c.description,
        satisfactoryDemonstration: c.satisfactoryDemonstration,
        isMandatory: c.isMandatory,
        orderIndex: index,
      })
    );

    const rubric: QuestionRubric = {
      id: `rub_${crypto.randomUUID()}`,
      questionId,
      studyMaterialId,
      criteria,
      updatedAt: now,
    };

    return completeAiExecution({
      response: NextResponse.json({
        success: true,
        rubric,
      }),
      identity: guard.identity,
      reservationId: guard.reservationId,
      usage: result.usage,
    });
  } catch (err: unknown) {
    const sanitized = sanitizeError(err);
    return NextResponse.json(
      {
        success: false,
        error: sanitized.message,
        category: sanitized.category,
      },
      { status: sanitized.statusCode || 500 }
    );
  }
}
