import { NextRequest } from "next/server";
import { getTranscribeSession } from "@/lib/providers/transcribe-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  const session = getTranscribeSession(sessionId);
  if (!session) {
    return new Response(
      JSON.stringify({ error: "Session not found or expired" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const push = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // Stream might be closed
        }
      };

      // Send initial connection acknowledgement
      push({
        type: "connected",
        sessionId: session.id,
        metaSessionId: session.metaSessionId,
        isMock: session.isMock,
      });

      const unsubscribe = session.subscribe((event) => {
        push(event);
        if (event.type === "closed") {
          try {
            controller.close();
          } catch {}
        }
      });

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
