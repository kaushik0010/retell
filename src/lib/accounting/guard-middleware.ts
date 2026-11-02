import "server-only";

import { NextRequest, NextResponse } from "next/server";
import {
  getAnonymousIdentity,
  attachDeviceCookie,
  AnonymousIdentity,
} from "./anonymous-identity";
import { checkEndpointRateLimit, ProtectedEndpoint } from "./rate-limiter";
import { reserveDailyBudget, settleDailyBudget } from "./budget-ledger";
import type { TokenUsage } from "@/lib/providers/types";

export interface GuardOptions {
  charCount?: number;
  imageCount?: number;
  skipBudget?: boolean;
}

export interface GuardSuccess {
  proceed: true;
  identity: AnonymousIdentity;
  reservationId?: string;
}

export interface GuardFailure {
  proceed: false;
  response: NextResponse;
}

export type GuardResult = GuardSuccess | GuardFailure;

/**
 * Standard pre-flight guard for paid AI route handlers.
 *
 * Sequence:
 * 1. Resolves anonymous device and trusted client IP.
 * 2. Checks multi-window sliding rate limits (Device & IP).
 * 3. Atomically checks and reserves global daily AI spending budget (unless skipBudget is set).
 * 4. Fails closed if rate limit is exceeded or Redis is unavailable.
 */
export async function guardAiEndpoint(
  req: NextRequest,
  endpoint: ProtectedEndpoint,
  options?: GuardOptions
): Promise<GuardResult> {
  const identity = getAnonymousIdentity(req);

  // 1. Sliding window rate limiting
  const rateLimitResult = await checkEndpointRateLimit(endpoint, identity);
  if (!rateLimitResult.allowed) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (rateLimitResult.retryAfterSeconds) {
      headers["Retry-After"] = String(rateLimitResult.retryAfterSeconds);
    }
    const response = NextResponse.json(
      {
        success: false,
        error:
          rateLimitResult.message ||
          "You're doing that a little too quickly. Please wait a moment and try again.",
      },
      { status: rateLimitResult.statusCode || 429, headers }
    );
    if (identity.isNewDevice) {
      attachDeviceCookie(response, identity.deviceId);
    }
    return { proceed: false, response };
  }

  // 2. Global daily budget reservation (skipped if skipBudget is true, e.g. mock fallback)
  let reservationId: string | undefined;
  if (!options?.skipBudget) {
    const budgetResult = await reserveDailyBudget(endpoint, options);
    if (!budgetResult.approved) {
      const response = NextResponse.json(
        {
          success: false,
          error:
            budgetResult.message ||
            "Retell is temporarily unable to process new requests. Please try again later.",
        },
        { status: budgetResult.statusCode || 503 }
      );
      if (identity.isNewDevice) {
        attachDeviceCookie(response, identity.deviceId);
      }
      return { proceed: false, response };
    }
    reservationId = budgetResult.reservationId;
  }

  return {
    proceed: true,
    identity,
    reservationId,
  };
}

/**
 * Post-flight finalizer that settles AI usage against the budget reservation
 * and attaches the anonymous device cookie to the response.
 */
export async function completeAiExecution(params: {
  response: NextResponse;
  identity: AnonymousIdentity;
  reservationId?: string;
  usage?: TokenUsage;
  isDefiniteFailure?: boolean;
  isUncertainOutcome?: boolean;
}): Promise<NextResponse> {
  const {
    response,
    identity,
    reservationId,
    usage,
    isDefiniteFailure,
    isUncertainOutcome,
  } = params;

  if (reservationId) {
    await settleDailyBudget({
      reservationId,
      actualTokens: usage,
      isDefiniteFailure,
      isUncertainOutcome,
    });
  }

  if (identity.isNewDevice) {
    attachDeviceCookie(response, identity.deviceId);
  }

  return response;
}
