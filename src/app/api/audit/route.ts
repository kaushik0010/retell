import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { SemanticAuditRequestSchema } from "@/lib/domain/semantic-audit";
import { evaluateStudentAnswer } from "@/lib/audit/evaluator";
import { sanitizeError } from "@/lib/providers/errors";
import {
  guardAiEndpoint,
  completeAiExecution,
  AnonymousIdentity,
} from "@/lib/accounting";

export async function POST(req: NextRequest) {
  let guardIdentity: AnonymousIdentity | undefined;
  let guardReservationId: string | undefined;

  try {
    const body = await req.json();
    const parsedRequest = SemanticAuditRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid audit request payload",
          details: parsedRequest.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      attemptId,
      studySetId,
      questionId,
      question,
      referenceAnswer,
      transcript,
      criteria,
      scope,
      mockFallback,
    } = parsedRequest.data;

    const guard = await guardAiEndpoint(req, "audit", {
      charCount: referenceAnswer.length + transcript.length,
      skipBudget: Boolean(mockFallback),
    });
    if (!guard.proceed) {
      return guard.response;
    }

    guardIdentity = guard.identity;
    guardReservationId = guard.reservationId;

    const auditResult = await evaluateStudentAnswer({
      attemptId,
      studySetId,
      questionId,
      question,
      referenceAnswer,
      transcript,
      criteria,
      scope,
      mockFallback,
    });

    return completeAiExecution({
      response: NextResponse.json({
        success: true,
        audit: auditResult,
      }),
      identity: guard.identity,
      reservationId: guard.reservationId,
    });
  } catch (err: unknown) {
    const sanitized = sanitizeError(err);
    console.error("Semantic audit API route error:", err);
    const errorResponse = NextResponse.json(
      {
        success: false,
        error: sanitized.message,
        category: sanitized.category,
      },
      { status: sanitized.statusCode || 500 }
    );

    if (guardIdentity) {
      return completeAiExecution({
        response: errorResponse,
        identity: guardIdentity,
        reservationId: guardReservationId,
        isDefiniteFailure:
          sanitized.category === "AUTHENTICATION_ERROR" ||
          sanitized.category === "MODEL_UNAVAILABLE",
        isUncertainOutcome:
          sanitized.category === "TIMEOUT" ||
          sanitized.category === "NETWORK_ERROR",
      });
    }

    return errorResponse;
  }
}
