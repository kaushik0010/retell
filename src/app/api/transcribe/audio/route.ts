import { NextRequest, NextResponse } from "next/server";
import { getTranscribeSession } from "@/lib/providers/transcribe-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  const session = getTranscribeSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Session not found or expired" },
      { status: 404 }
    );
  }

  try {
    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength > 0) {
      session.sendAudio(new Uint8Array(arrayBuffer));
    }

    return NextResponse.json({
      success: true,
      bytesReceived: arrayBuffer.byteLength,
      audioProcessedMs: session.audioProcessedMs,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to process audio chunk";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
