import { NextRequest, NextResponse } from "next/server";
import { getTranscribeSession } from "@/lib/providers/transcribe-session";

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

    const session = getTranscribeSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found or already closed" },
        { status: 404 }
      );
    }

    const finalTranscript = await session.finish();

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
