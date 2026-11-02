import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createTranscribeSession } from "@/lib/providers/transcribe-session";
import {
  getAnonymousIdentity,
  attachDeviceCookie,
  checkTranscribePreconditions,
  commitTranscribeSession,
  releaseTranscribePreReservation,
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

    const isMock = Boolean(body.mockFallback);

    // 1. Pre-flight checks: rate limit, stale lock recovery, active session check, budget reservation
    // Runs BEFORE connecting to upstream Meta WebSocket to avoid consuming paid resources if rejected
    const preCheck = await checkTranscribePreconditions(identity, isMock);
    if (!preCheck.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error:
            preCheck.message ||
            "Retell is temporarily unable to process new requests. Please try again later.",
        },
        { status: preCheck.statusCode || 429 }
      );
      if (identity.isNewDevice) {
        attachDeviceCookie(response, identity.deviceId);
      }
      return response;
    }

    // 2. Only after all checks pass: create upstream transcribe session
    let session;
    try {
      session = await createTranscribeSession({
        sampleRate: body.sampleRate || 24000,
        languageBias: body.languageBias,
        mockFallback: body.mockFallback,
      });
    } catch (createErr) {
      // Upstream connection or handshake failed -> release reservation immediately
      if (preCheck.reservationId) {
        await releaseTranscribePreReservation(preCheck.reservationId, identity);
      }
      throw createErr;
    }

    // 3. Commit session record and active device lock in Redis
    try {
      await commitTranscribeSession({
        sessionId: session.id,
        identity,
        reservationId: preCheck.reservationId || "",
        isMock: session.isMock,
        provider: session.provider,
      });
    } catch (commitErr) {
      // Failed to commit to Redis -> close session and refund
      session.close();
      if (preCheck.reservationId) {
        await releaseTranscribePreReservation(preCheck.reservationId, identity);
      }
      throw commitErr;
    }

    // 4. Return success response
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
