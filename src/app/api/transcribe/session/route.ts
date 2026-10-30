import { NextRequest, NextResponse } from "next/server";
import { createTranscribeSession } from "@/lib/providers/transcribe-session";

export async function POST(req: NextRequest) {
  try {
    let body: {
      sampleRate?: number;
      languageBias?: string[];
      mockFallback?: boolean;
    } = {};

    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const session = await createTranscribeSession({
      sampleRate: body.sampleRate || 24000,
      languageBias: body.languageBias,
      mockFallback: body.mockFallback,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      isMock: session.isMock,
      metaSessionId: session.metaSessionId,
      provider: session.provider,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to initialize transcribe session";
    console.error("Transcribe session initialization error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
