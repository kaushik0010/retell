import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createTranscribeSession } from "@/lib/providers/transcribe-session";
import {
  getAnonymousIdentity,
  attachDeviceCookie,
  registerTranscribeSessionInRedis,
} from "@/lib/accounting";

export async function POST(req: NextRequest) {
  const identity = getAnonymousIdentity(req);

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

    const registration = await registerTranscribeSessionInRedis({
      sessionId: session.id,
      identity,
      isMock: session.isMock,
      provider: session.provider,
    });

    if (!registration.allowed) {
      session.close();
      const response = NextResponse.json(
        {
          success: false,
          error:
            registration.message ||
            "Retell is temporarily unable to process new requests. Please try again later.",
        },
        { status: registration.statusCode || 429 }
      );
      if (identity.isNewDevice) {
        attachDeviceCookie(response, identity.deviceId);
      }
      return response;
    }

    const response = NextResponse.json({
      success: true,
      sessionId: session.id,
      isMock: session.isMock,
      metaSessionId: session.metaSessionId,
      provider: session.provider,
    });

    if (identity.isNewDevice) {
      attachDeviceCookie(response, identity.deviceId);
    }

    return response;
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to initialize transcribe session";
    console.error("Transcribe session initialization error:", err);
    const response = NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
    if (identity.isNewDevice) {
      attachDeviceCookie(response, identity.deviceId);
    }
    return response;
  }
}
