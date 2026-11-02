import "server-only";

import { getAccountingRedis } from "./redis-client";
import { getAccountingConfig } from "./config";
import { AnonymousIdentity } from "./anonymous-identity";
import { reserveDailyBudget, settleDailyBudget } from "./budget-ledger";

export interface TranscribeSessionRecord {
  sessionId: string;
  deviceKey: string;
  ipKey: string;
  createdAt: number;
  lastActivityAt: number;
  maxDurationSeconds: number;
  status: "active" | "finished" | "expired";
  reservationId: string;
  isMock: boolean;
  provider: string;
}

export interface RegisterSessionResult {
  allowed: boolean;
  reservationId?: string;
  statusCode?: number;
  message?: string;
}

export interface VerifySessionResult {
  valid: boolean;
  session?: TranscribeSessionRecord;
  statusCode?: number;
  message?: string;
}

/**
 * Atomically registers a speech transcription session in shared Redis storage,
 * enforcing single active session per device, IP concurrent limits, and reserving
 * budget for maximum allowed duration.
 */
export async function registerTranscribeSessionInRedis(params: {
  sessionId: string;
  identity: AnonymousIdentity;
  isMock: boolean;
  provider: string;
}): Promise<RegisterSessionResult> {
  const { sessionId, identity, isMock, provider } = params;
  const redis = getAccountingRedis();

  if (!redis) {
    // Fail closed: Do not initialize paid voice session without shared coordination
    return {
      allowed: false,
      statusCode: 503,
      message:
        "Retell is temporarily unable to process new requests. Please try again later.",
    };
  }

  const config = getAccountingConfig();
  const limits = config.limits.transcribeSession;
  const devActiveKey = `tsess:active:dev:${identity.deviceKey}`;
  const ipActiveKey = `tsess:active:ip:${identity.ipKey}`;

  // 1. Check if this device already has an active session
  const existingActiveSession = await redis.get<string>(devActiveKey);
  if (existingActiveSession && existingActiveSession !== sessionId) {
    return {
      allowed: false,
      statusCode: 429,
      message:
        "You already have an active spoken recording in progress. Please finish or stop it first.",
    };
  }

  // 2. Sliding window check for session creation rate limit
  const now = Date.now();
  const sessionRateKey = `rl:s:dev:transcribe:${identity.deviceKey}`;
  const count = await redis.zcard(sessionRateKey);
  if (count >= limits.deviceMaxIn10Min) {
    return {
      allowed: false,
      statusCode: 429,
      message:
        "You're doing that a little too quickly. Please wait a moment and try again.",
    };
  }

  // 3. Atomically reserve daily spending budget for maximum session duration
  // If mock fallback session, estimated cost is $0
  let reservationId: string | undefined;
  if (!isMock) {
    const budgetRes = await reserveDailyBudget("transcribe", {
      maxAudioSeconds: limits.maxSessionDurationSeconds,
    });
    if (!budgetRes.approved) {
      return {
        allowed: false,
        statusCode: budgetRes.statusCode || 503,
        message: budgetRes.message,
      };
    }
    reservationId = budgetRes.reservationId;
  } else {
    reservationId = `resv_mock_${Date.now()}`;
  }

  // 4. Store session record in Redis with 10-minute TTL
  const sessionRecord: TranscribeSessionRecord = {
    sessionId,
    deviceKey: identity.deviceKey,
    ipKey: identity.ipKey,
    createdAt: now,
    lastActivityAt: now,
    maxDurationSeconds: limits.maxSessionDurationSeconds,
    status: "active",
    reservationId: reservationId || "",
    isMock,
    provider,
  };

  const sessionKey = `tsess:${sessionId}`;
  const sessionTtlSeconds = 600; // 10 minutes

  await redis.set(sessionKey, JSON.stringify(sessionRecord), {
    ex: sessionTtlSeconds,
  });
  await redis.set(devActiveKey, sessionId, {
    ex: limits.maxSessionDurationSeconds + 30,
  });
  await redis.zadd(sessionRateKey, now, String(now));
  await redis.expire(sessionRateKey, 600);

  return {
    allowed: true,
    reservationId,
  };
}

/**
 * Verifies session existence and device ownership, preventing cross-device session hijacking.
 * Does NOT consume separate rate-limit tokens for individual audio chunks.
 */
export async function verifyTranscribeSessionOwnership(
  sessionId: string | null,
  identity: AnonymousIdentity
): Promise<VerifySessionResult> {
  if (!sessionId) {
    return {
      valid: false,
      statusCode: 400,
      message: "Session ID is required.",
    };
  }

  const redis = getAccountingRedis();
  if (!redis) {
    return {
      valid: false,
      statusCode: 503,
      message:
        "Retell is temporarily unable to process new requests. Please try again later.",
    };
  }

  const sessionKey = `tsess:${sessionId}`;
  const raw = await redis.get<string>(sessionKey);

  if (!raw) {
    return {
      valid: false,
      statusCode: 404,
      message: "Session not found or expired.",
    };
  }

  let session: TranscribeSessionRecord;
  try {
    session = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return {
      valid: false,
      statusCode: 500,
      message: "Invalid session state.",
    };
  }

  // Verify ownership: device HMAC must match
  if (session.deviceKey !== identity.deviceKey) {
    return {
      valid: false,
      statusCode: 403,
      message: "Session access denied.",
    };
  }

  // Update activity timestamp
  session.lastActivityAt = Date.now();
  await redis.set(sessionKey, JSON.stringify(session), { ex: 600 });

  return {
    valid: true,
    session,
  };
}

/**
 * Idempotently finalizes a transcription session in Redis, settles billable audio duration
 * against the daily budget, and releases the device's active session lock.
 */
export async function finalizeTranscribeSessionInRedis(params: {
  sessionId: string;
  identity: AnonymousIdentity;
  audioProcessedMs: number;
}): Promise<{ finalized: boolean }> {
  const { sessionId, identity, audioProcessedMs } = params;
  const redis = getAccountingRedis();
  if (!redis) return { finalized: false };

  const sessionKey = `tsess:${sessionId}`;
  const devActiveKey = `tsess:active:dev:${identity.deviceKey}`;

  const raw = await redis.get<string>(sessionKey);
  if (!raw) {
    // Already cleaned up or expired
    await redis.del(devActiveKey);
    return { finalized: true };
  }

  let session: TranscribeSessionRecord;
  try {
    session = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return { finalized: false };
  }

  if (session.deviceKey !== identity.deviceKey) {
    return { finalized: false };
  }

  // Idempotency: if already settled and finished, no-op
  if (session.status === "finished") {
    await redis.del(devActiveKey);
    return { finalized: true };
  }

  // Settle actual audio seconds against daily budget
  const actualSeconds = Math.max(Math.ceil(audioProcessedMs / 1000), 0);
  if (!session.isMock && session.reservationId) {
    await settleDailyBudget({
      reservationId: session.reservationId,
      actualAudioSeconds: actualSeconds,
      notes: `Session ${sessionId} audio duration ${actualSeconds}s`,
    });
  }

  session.status = "finished";
  await redis.set(sessionKey, JSON.stringify(session), { ex: 300 });
  await redis.del(devActiveKey);

  return { finalized: true };
}
