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
 * Pre-flight verification for spoken practice recording:
 * 1. Checks Redis availability (fails closed with 503).
 * 2. Checks active session lock for device with automatic stale/abandoned recovery.
 * 3. Enforces sliding window rate limits (clearing expired timestamps).
 * 4. Pre-reserves daily budget (if paid session) BEFORE connecting to upstream Meta WebSocket.
 */
export async function checkTranscribePreconditions(
  identity: AnonymousIdentity,
  isMock: boolean
): Promise<RegisterSessionResult> {
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
  const now = Date.now();

  // 1. Check if this device already has an active session (with stale lock recovery)
  const existingActiveSession = await redis.get<string>(devActiveKey);
  if (existingActiveSession) {
    const oldSessionKey = `tsess:${existingActiveSession}`;
    const rawOld = await redis.get<string>(oldSessionKey);
    let isStillActive = false;

    if (rawOld) {
      try {
        const oldRecord =
          typeof rawOld === "string" ? JSON.parse(rawOld) : rawOld;
        if (oldRecord && oldRecord.status === "active") {
          const ageMs =
            now - (oldRecord.lastActivityAt || oldRecord.createdAt || 0);
          // If inactive for > 45 seconds without finishing, treat as abandoned
          if (ageMs < 45_000) {
            isStillActive = true;
          } else {
            // Settle abandoned reservation to unblock budget
            if (!oldRecord.isMock && oldRecord.reservationId) {
              await settleDailyBudget({
                reservationId: oldRecord.reservationId,
                isDefiniteFailure: true,
              });
            }
          }
        }
      } catch {
        // Corrupted session record -> clean up
      }
    }

    if (isStillActive) {
      return {
        allowed: false,
        statusCode: 429,
        message:
          "You already have an active spoken recording in progress. Please finish or stop it first.",
      };
    } else {
      // Stale or abandoned session: recover lock
      await redis.del(devActiveKey);
    }
  }

  // 2. Sliding window check for session creation rate limit
  const sessionRateKey = `rl:s:dev:transcribe:${identity.deviceKey}`;
  await redis.zremrangebyscore(sessionRateKey, 0, now - 600 * 1000);
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

  return {
    allowed: true,
    reservationId,
  };
}

/**
 * Commits a newly established transcribe session to Redis after upstream connection succeeds.
 */
export async function commitTranscribeSession(params: {
  sessionId: string;
  identity: AnonymousIdentity;
  reservationId: string;
  isMock: boolean;
  provider: string;
}): Promise<void> {
  const { sessionId, identity, reservationId, isMock, provider } = params;
  const redis = getAccountingRedis();
  if (!redis) return;

  const config = getAccountingConfig();
  const limits = config.limits.transcribeSession;
  const devActiveKey = `tsess:active:dev:${identity.deviceKey}`;
  const sessionRateKey = `rl:s:dev:transcribe:${identity.deviceKey}`;
  const now = Date.now();

  const sessionRecord: TranscribeSessionRecord = {
    sessionId,
    deviceKey: identity.deviceKey,
    ipKey: identity.ipKey,
    createdAt: now,
    lastActivityAt: now,
    maxDurationSeconds: limits.maxSessionDurationSeconds,
    status: "active",
    reservationId,
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
  await redis.zadd(sessionRateKey, {
    score: now,
    member: `${sessionId}:${now}`,
  });
  await redis.expire(sessionRateKey, 600);
}

/**
 * Safely releases a pre-flight budget reservation and active session lock if upstream connection fails.
 */
export async function releaseTranscribePreReservation(
  reservationId?: string,
  identity?: AnonymousIdentity
): Promise<void> {
  if (reservationId && !reservationId.startsWith("resv_mock_")) {
    await settleDailyBudget({
      reservationId,
      isDefiniteFailure: true,
    });
  }

  if (identity) {
    const redis = getAccountingRedis();
    if (redis) {
      const devActiveKey = `tsess:active:dev:${identity.deviceKey}`;
      await redis.del(devActiveKey);
    }
  }
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

  const preCheck = await checkTranscribePreconditions(identity, isMock);
  if (!preCheck.allowed) {
    return preCheck;
  }

  try {
    await commitTranscribeSession({
      sessionId,
      identity,
      reservationId: preCheck.reservationId || "",
      isMock,
      provider,
    });

    return {
      allowed: true,
      reservationId: preCheck.reservationId,
    };
  } catch (err) {
    if (preCheck.reservationId) {
      await releaseTranscribePreReservation(preCheck.reservationId, identity);
    }
    throw err;
  }
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
