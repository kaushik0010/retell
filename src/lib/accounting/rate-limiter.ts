import "server-only";

import { getAccountingRedis, isRedisConfigured } from "./redis-client";
import { getAccountingConfig, EndpointLimitConfig } from "./config";
import { AnonymousIdentity } from "./anonymous-identity";

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  message?: string;
  statusCode?: number;
  reason?: "rate_limited" | "infrastructure_unavailable";
}

export type ProtectedEndpoint = "extract" | "rubric" | "audit";

const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local maxRequests = tonumber(ARGV[1])
local windowSeconds = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local clearBefore = now - (windowSeconds * 1000)

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local currentCount = redis.call('ZCARD', key)

if currentCount < maxRequests then
    redis.call('ZADD', key, now, now .. ':' .. tostring(currentCount + 1))
    redis.call('EXPIRE', key, windowSeconds)
    return {1, maxRequests - currentCount - 1, 0}
else
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retryAfter = 1
    if oldest and oldest[2] then
        retryAfter = math.ceil((tonumber(oldest[2]) + (windowSeconds * 1000) - now) / 1000)
    end
    if retryAfter < 1 then retryAfter = 1 end
    return {0, 0, retryAfter}
end
`;

/**
 * Checks sliding-window rate limits atomically across Device Burst, Device Sustained,
 * IP Burst, and IP Sustained tiers for an AI endpoint.
 *
 * If Redis is unavailable or unconfigured, FAILS CLOSED: blocks paid AI operations
 * to prevent runaway cloud provider consumption.
 */
export async function checkEndpointRateLimit(
  endpoint: ProtectedEndpoint,
  identity: AnonymousIdentity
): Promise<RateLimitCheckResult> {
  const redis = getAccountingRedis();

  if (!redis) {
    // Fail closed: Do not invoke paid provider without working rate-limiting infrastructure
    return {
      allowed: false,
      statusCode: 503,
      reason: "infrastructure_unavailable",
      message:
        "Retell is temporarily unable to process new requests. Please try again later.",
    };
  }

  const config = getAccountingConfig();
  const limits: EndpointLimitConfig = config.limits[endpoint];
  const now = Date.now();

  const checks = [
    // 1. Device Burst
    {
      key: `rl:b:dev:${endpoint}:${identity.deviceKey}`,
      max: limits.deviceBurstMax,
      window: limits.deviceBurstWindowSeconds,
    },
    // 2. Device Sustained
    {
      key: `rl:s:dev:${endpoint}:${identity.deviceKey}`,
      max: limits.deviceSustainedMax,
      window: limits.deviceSustainedWindowSeconds,
    },
    // 3. IP Burst (tolerant of shared networks)
    {
      key: `rl:b:ip:${endpoint}:${identity.ipKey}`,
      max: limits.ipBurstMax,
      window: limits.ipBurstWindowSeconds,
    },
    // 4. IP Sustained
    {
      key: `rl:s:ip:${endpoint}:${identity.ipKey}`,
      max: limits.ipSustainedMax,
      window: limits.ipSustainedWindowSeconds,
    },
  ];

  try {
    for (const check of checks) {
      const res = await redis.eval<[number, number, number]>(
        SLIDING_WINDOW_LUA,
        [check.key],
        [check.max, check.window, now]
      );

      const [allowed, , retryAfter] = res;
      if (allowed === 0) {
        return {
          allowed: false,
          statusCode: 429,
          retryAfterSeconds: Math.max(retryAfter || 1, 1),
          reason: "rate_limited",
          message:
            "You're doing that a little too quickly. Please wait a moment and try again.",
        };
      }
    }

    return { allowed: true };
  } catch (err: unknown) {
    // Fail closed on Redis network timeouts or script execution failures
    return {
      allowed: false,
      statusCode: 503,
      reason: "infrastructure_unavailable",
      message:
        "Retell is temporarily unable to process new requests. Please try again later.",
    };
  }
}
