import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getTranscribeSession } from "@/lib/providers/transcribe-session";
import {
  getAnonymousIdentity,
  verifyTranscribeSessionOwnership,
  finalizeTranscribeSessionInRedis,
} from "@/lib/accounting";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let sessionId: string | null = null;

  try {
    const { searchParams } = new URL(req.url);
    sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      try {
        const body = await req.json();
        sessionId = body?.sessionId || null;
      } catch {
        // Not JSON
      }
    }

    const identity = getAnonymousIdentity(req);
    const verification = await verifyTranscribeSessionOwnership(
      sessionId,
      identity
    );

    if (!verification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: verification.message || "Session not found or expired",
        },
        { status: verification.statusCode || 404 }
      );
    }

    const session = getTranscribeSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found or already closed" },
        { status: 404 }
      );
    }

    const finalTranscript = await session.finish();

    await finalizeTranscribeSessionInRedis({
      sessionId: session.id,
      identity,
      audioProcessedMs: session.audioProcessedMs,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      finalTranscript: finalTranscript || session.finalTranscript,
      audioProcessedMs: session.audioProcessedMs,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to finish transcribe session";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
