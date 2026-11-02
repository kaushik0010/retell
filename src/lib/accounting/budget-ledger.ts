import "server-only";

import crypto from "crypto";
import { getAccountingRedis } from "./redis-client";
import { getAccountingConfig } from "./config";
import type { TokenUsage } from "@/lib/providers/types";

export interface BudgetReservationResult {
  approved: boolean;
  reservationId?: string;
  remainingBudgetMicros?: number;
  statusCode?: number;
  message?: string;
  reason?: "budget_exhausted" | "infrastructure_unavailable";
}

export interface BudgetSettlementParams {
  reservationId: string;
  actualTokens?: TokenUsage;
  actualAudioSeconds?: number;
  isDefiniteFailure?: boolean;
  isUncertainOutcome?: boolean;
  notes?: string;
}

/**
 * UTC daily date key (e.g. "budget:utc:2026-11-02").
 * All budget limits reset strictly at 00:00:00 UTC.
 */
export function getUtcDailyKey(date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `budget:utc:${yyyy}-${mm}-${dd}`;
}

const RESERVE_BUDGET_LUA = `
local budgetKey = KEYS[1]
local resvKey = KEYS[2]
local estimated = tonumber(ARGV[1])
local maxBudget = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local payload = ARGV[4]

local confirmed = tonumber(redis.call('HGET', budgetKey, 'confirmed_cost_micros') or '0')
local reserved = tonumber(redis.call('HGET', budgetKey, 'reserved_cost_micros') or '0')

if (confirmed + reserved + estimated) > maxBudget then
    local remaining = maxBudget - (confirmed + reserved)
    if remaining < 0 then remaining = 0 end
    return {0, remaining}
end

redis.call('HINCRBY', budgetKey, 'reserved_cost_micros', estimated)
redis.call('HINCRBY', budgetKey, 'operations_count', 1)
redis.call('EXPIRE', budgetKey, 86400 * 3)

redis.call('SET', resvKey, payload, 'EX', ttl)
local remaining = maxBudget - (confirmed + reserved + estimated)
return {1, remaining}
`;

const SETTLE_BUDGET_LUA = `
local budgetKey = KEYS[1]
local resvKey = KEYS[2]
local actualCostMicros = tonumber(ARGV[1])
local status = ARGV[2]

local rawResv = redis.call('GET', resvKey)
if not rawResv then
    return {0, "reservation_not_found"}
end

local estimated = tonumber(string.match(rawResv, '"estimatedCostMicros":(%d+)') or '0')
local isSettled = string.find(rawResv, '"settled":true') ~= nil

if isSettled then
    return {1, "already_settled"}
end

redis.call('HINCRBY', budgetKey, 'reserved_cost_micros', -estimated)
redis.call('HINCRBY', budgetKey, 'confirmed_cost_micros', actualCostMicros)

local updatedPayload = '{"estimatedCostMicros":' .. estimated .. ',"actualCostMicros":' .. actualCostMicros .. ',"status":"' .. status .. '","settled":true}'
redis.call('SET', resvKey, updatedPayload, 'EX', 300)

return {1, "settled"}
`;

/**
 * Calculates conservative estimated cost in micro-USD (1 USD = 1,000,000 micros)
 * for pre-flight budget reservation before calling AI provider.
 */
export function calculateEstimatedCostMicros(
  operation: "extract" | "rubric" | "audit" | "transcribe",
  params?: {
    charCount?: number;
    imageCount?: number;
    maxAudioSeconds?: number;
  }
): number {
  const config = getAccountingConfig();
  const inputRateMicrosPerToken = config.pricing.pricePer1MInputTokensUsd; // e.g. 1.25 micros / token
  const outputRateMicrosPerToken = config.pricing.pricePer1MOutputTokensUsd; // e.g. 4.25 micros / token

  switch (operation) {
    case "extract": {
      // Conservative estimate: ~4,000 input tokens + ~2,500 output tokens
      const chars = params?.charCount || 3000;
      const estimatedInputTokens =
        Math.max(Math.ceil(chars / 3.5), 1500) + 1000;
      const estimatedOutputTokens = 2500;
      const cost =
        estimatedInputTokens * inputRateMicrosPerToken +
        estimatedOutputTokens * outputRateMicrosPerToken;
      return Math.ceil(cost);
    }
    case "rubric": {
      // Conservative estimate: ~1,500 input tokens + ~1,000 output tokens
      const estimatedInputTokens = 1500;
      const estimatedOutputTokens = 1000;
      const cost =
        estimatedInputTokens * inputRateMicrosPerToken +
        estimatedOutputTokens * outputRateMicrosPerToken;
      return Math.ceil(cost);
    }
    case "audit": {
      // Conservative estimate: ~2,000 input tokens + ~1,200 output tokens
      const estimatedInputTokens = 2000;
      const estimatedOutputTokens = 1200;
      const cost =
        estimatedInputTokens * inputRateMicrosPerToken +
        estimatedOutputTokens * outputRateMicrosPerToken;
      return Math.ceil(cost);
    }
    case "transcribe": {
      // Up to max session duration (e.g. 300 seconds = 5 minutes)
      const durationSeconds = params?.maxAudioSeconds || 300;
      const ratePerSecondMicros =
        (config.pricing.pricePerAudioMinuteUsd * 1_000_000) / 60;
      return Math.ceil(durationSeconds * ratePerSecondMicros);
    }
  }
}

/**
 * Computes exact provider cost in micro-USD from confirmed token usage.
 */
export function calculateActualTokenCostMicros(usage?: TokenUsage): number {
  if (!usage) return 0;
  const config = getAccountingConfig();
  const inputRate = config.pricing.pricePer1MInputTokensUsd;
  const outputRate = config.pricing.pricePer1MOutputTokensUsd;

  const promptTokens = usage.promptTokens || 0;
  const completionTokens = usage.completionTokens || 0;

  return Math.ceil(promptTokens * inputRate + completionTokens * outputRate);
}

/**
 * Computes actual audio transcription cost in micro-USD from successfully processed audio seconds.
 */
export function calculateActualAudioCostMicros(audioSeconds: number): number {
  if (audioSeconds <= 0) return 0;
  const config = getAccountingConfig();
  const ratePerSecondMicros =
    (config.pricing.pricePerAudioMinuteUsd * 1_000_000) / 60;
  return Math.ceil(audioSeconds * ratePerSecondMicros);
}

/**
 * Atomically reserves estimated cost against the shared daily AI spending budget in Redis.
 *
 * Sequence:
 * 1. Checks current confirmed + active reserved costs against global daily limit.
 * 2. If remaining budget is insufficient, REJECTS without calling AI provider.
 * 3. Atomically increases reserved_cost_micros and records the pending reservation with TTL.
 * 4. Fails closed if Redis is unavailable.
 */
export async function reserveDailyBudget(
  operation: "extract" | "rubric" | "audit" | "transcribe",
  params?: {
    charCount?: number;
    imageCount?: number;
    maxAudioSeconds?: number;
  }
): Promise<BudgetReservationResult> {
  const redis = getAccountingRedis();

  if (!redis) {
    // Fail closed: Never invoke paid AI operations when shared budget ledger is unavailable
    return {
      approved: false,
      statusCode: 503,
      reason: "infrastructure_unavailable",
      message:
        "Retell is temporarily unable to process new requests. Please try again later.",
    };
  }

  const config = getAccountingConfig();
  const maxBudgetMicros = Math.floor(config.dailyBudgetUsd * 1_000_000);
  const estimatedCostMicros = calculateEstimatedCostMicros(operation, params);

  const reservationId = `resv_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
  const budgetKey = getUtcDailyKey();
  const resvKey = `resv:${reservationId}`;

  const reservationPayload = JSON.stringify({
    reservationId,
    operation,
    estimatedCostMicros,
    budgetKey,
    createdAt: Date.now(),
    settled: false,
  });

  try {
    const res = await redis.eval<[number, number]>(
      RESERVE_BUDGET_LUA,
      [budgetKey, resvKey],
      [
        estimatedCostMicros,
        maxBudgetMicros,
        config.reservationTtlSeconds,
        reservationPayload,
      ]
    );

    const [approved, remainingMicros] = res;

    if (approved === 0) {
      return {
        approved: false,
        remainingBudgetMicros: remainingMicros,
        statusCode: 503,
        reason: "budget_exhausted",
        message:
          "Retell is temporarily unable to process new requests. Please try again later.",
      };
    }

    return {
      approved: true,
      reservationId,
      remainingBudgetMicros: remainingMicros,
    };
  } catch {
    // Fail closed on Redis script failure or connection error
    return {
      approved: false,
      statusCode: 503,
      reason: "infrastructure_unavailable",
      message:
        "Retell is temporarily unable to process new requests. Please try again later.",
    };
  }
}

/**
 * Idempotently settles a previously approved budget reservation after AI provider response.
 *
 * Reconciles the reserved amount:
 * - On definite provider failure: releases 100% of reserved amount.
 * - On successful response with token usage: settles actual cost and releases unused reserve.
 * - On uncertain outcome (timeout): conservatively records estimated amount as confirmed to protect daily cap.
 */
export async function settleDailyBudget(
  params: BudgetSettlementParams
): Promise<void> {
  const {
    reservationId,
    actualTokens,
    actualAudioSeconds,
    isDefiniteFailure,
    isUncertainOutcome,
  } = params;

  if (!reservationId) return;

  const redis = getAccountingRedis();
  if (!redis) return;

  const budgetKey = getUtcDailyKey();
  const resvKey = `resv:${reservationId}`;

  let actualCostMicros = 0;
  let settlementStatus = "success";

  if (isDefiniteFailure) {
    // Definite failure before provider execution -> 0 cost
    actualCostMicros = 0;
    settlementStatus = "definite_failure";
  } else if (isUncertainOutcome) {
    // Timeout or network drop during execution -> conservative settlement
    const rawResv = await redis.get<string>(resvKey);
    let estimated = 0;
    if (rawResv) {
      try {
        const parsed = JSON.parse(rawResv);
        estimated = parsed.estimatedCostMicros || 0;
      } catch {}
    }
    actualCostMicros = estimated;
    settlementStatus = "uncertain_timeout";
  } else if (typeof actualAudioSeconds === "number") {
    actualCostMicros = calculateActualAudioCostMicros(actualAudioSeconds);
    settlementStatus = "audio_confirmed";
  } else if (actualTokens) {
    actualCostMicros = calculateActualTokenCostMicros(actualTokens);
    settlementStatus = "tokens_confirmed";
  }

  try {
    await redis.eval(
      SETTLE_BUDGET_LUA,
      [budgetKey, resvKey],
      [actualCostMicros, settlementStatus]
    );
  } catch {
    // Suppress settlement logging to prevent error exposure
  }
}
