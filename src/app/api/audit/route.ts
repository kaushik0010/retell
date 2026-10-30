import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { SemanticAuditRequestSchema } from "@/lib/domain/semantic-audit";
import { evaluateStudentAnswer } from "@/lib/audit/evaluator";
import { sanitizeError } from "@/lib/providers/errors";

export async function POST(req: NextRequest) {
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

    return NextResponse.json({
      success: true,
      audit: auditResult,
    });
  } catch (err: unknown) {
    const sanitized = sanitizeError(err);
    console.error("Semantic audit API route error:", err);
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
