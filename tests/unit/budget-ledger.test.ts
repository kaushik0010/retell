import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  reserveDailyBudget,
  settleDailyBudget,
  calculateEstimatedCostMicros,
  calculateActualTokenCostMicros,
  calculateActualAudioCostMicros,
  getUtcDailyKey,
} from "@/lib/accounting/budget-ledger";
import { getAccountingConfig } from "@/lib/accounting/config";
import {
  setTestRedisInstance,
  setTestRedisDisabled,
  InMemoryAccountingRedis,
} from "@/lib/accounting/redis-client";

describe("Global Daily AI Spending Ledger & Protection", () => {
  let redisSimulator: InMemoryAccountingRedis;

  beforeEach(() => {
    redisSimulator = new InMemoryAccountingRedis();
    setTestRedisInstance(redisSimulator);
    setTestRedisDisabled(false);
  });

  describe("Cost Estimation & Token/Audio Calculation", () => {
    it("computes estimated costs in micro-USD for all protected operations", () => {
      const extractCost = calculateEstimatedCostMicros("extract", {
        charCount: 3500,
      });
      const rubricCost = calculateEstimatedCostMicros("rubric");
      const auditCost = calculateEstimatedCostMicros("audit");
      const transcribeCost = calculateEstimatedCostMicros("transcribe", {
        maxAudioSeconds: 300,
      });

      // Micro-USD: 1 USD = 1,000,000 micros. Sub-cent operations are 100-3000 micros.
      expect(extractCost).toBeGreaterThan(500);
      expect(rubricCost).toBeGreaterThan(200);
      expect(auditCost).toBeGreaterThan(300);
      // 5 minutes @ $0.012/min = $0.06 = 60,000 micros
      expect(transcribeCost).toBe(60000);
    });

    it("calculates exact micro-USD provider cost from token usage", () => {
      // 1000 prompt tokens @ $1.25/1M = 1.25 micros * 1000 = 1250 micros
      // 500 completion tokens @ $4.25/1M = 4.25 micros * 500 = 2125 micros
      const cost = calculateActualTokenCostMicros({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      });

      expect(cost).toBe(3375);
    });

    it("calculates exact audio transcription cost in micro-USD", () => {
      // 60 seconds (1 minute) @ $0.012/min = 12,000 micros
      const cost = calculateActualAudioCostMicros(60);
      expect(cost).toBe(12000);

      // 30 seconds (0.5 minute) = 6,000 micros
      const halfMinute = calculateActualAudioCostMicros(30);
      expect(halfMinute).toBe(6000);
    });
  });

  describe("UTC Daily Ledger Boundaries", () => {
    it("derives strict UTC daily keys regardless of local timezones", () => {
      const lateEveningUtc = new Date("2026-11-02T23:59:59Z");
      const earlyMorningUtc = new Date("2026-11-03T00:00:01Z");

      expect(getUtcDailyKey(lateEveningUtc)).toBe("budget:utc:2026-11-02");
      expect(getUtcDailyKey(earlyMorningUtc)).toBe("budget:utc:2026-11-03");
    });
  });

  describe("Atomic Reservation & Budget Enforcement", () => {
    it("approves reservations within daily budget ceiling", async () => {
      const result = await reserveDailyBudget("audit");

      expect(result.approved).toBe(true);
      expect(result.reservationId).toMatch(/^resv_\d+_[0-9a-f]+$/);
      expect(result.remainingBudgetMicros).toBeDefined();
    });

    it("rejects reservations when aggregate budget is exhausted", async () => {
      const budgetKey = getUtcDailyKey();
      // Daily budget default is $30.00 = 30,000,000 micro-USD.
      // Pre-fill confirmed cost up to $29.99
      await redisSimulator.hset(budgetKey, {
        confirmed_cost_micros: 29_995_000,
        reserved_cost_micros: 0,
      });

      // An extract call requiring estimated tokens will exceed $30.00 (30,000,000 micros)
      const result = await reserveDailyBudget("extract");

      expect(result.approved).toBe(false);
      expect(result.statusCode).toBe(503);
      expect(result.reason).toBe("budget_exhausted");
      expect(result.message).toBe(
        "Retell is temporarily unable to process new requests. Please try again later."
      );
    });

    it("settles actual token usage and refunds the unused difference", async () => {
      const budgetKey = getUtcDailyKey();

      // Reserve for rubric
      const reservation = await reserveDailyBudget("rubric");
      expect(reservation.approved).toBe(true);

      const reservedBefore = Number(
        await redisSimulator.hget(budgetKey, "reserved_cost_micros")
      );
      expect(reservedBefore).toBeGreaterThan(0);

      // Settle with modest actual usage (500 prompt tokens * 1.25 + 200 output tokens * 4.25 = 625 + 850 = 1475 micros)
      await settleDailyBudget({
        reservationId: reservation.reservationId!,
        actualTokens: {
          promptTokens: 500,
          completionTokens: 200,
          totalTokens: 700,
        },
      });

      const reservedAfter = Number(
        await redisSimulator.hget(budgetKey, "reserved_cost_micros")
      );
      const confirmedAfter = Number(
        await redisSimulator.hget(budgetKey, "confirmed_cost_micros")
      );

      // Reserved cost was released back to 0
      expect(reservedAfter).toBe(0);
      // Confirmed cost increased only by actual amount (1475 micros)
      expect(confirmedAfter).toBe(1475);
    });

    it("releases 100% of reserved funds on definite provider failure", async () => {
      const budgetKey = getUtcDailyKey();

      const reservation = await reserveDailyBudget("extract");
      expect(reservation.approved).toBe(true);

      // Provider returned definite 401 auth error or 503 service unavailable
      await settleDailyBudget({
        reservationId: reservation.reservationId!,
        isDefiniteFailure: true,
      });

      const reservedAfter = Number(
        await redisSimulator.hget(budgetKey, "reserved_cost_micros")
      );
      const confirmedAfter = Number(
        await redisSimulator.hget(budgetKey, "confirmed_cost_micros")
      );

      // 100% refunded
      expect(reservedAfter).toBe(0);
      expect(confirmedAfter).toBe(0);
    });

    it("conservatively retains estimated cost as confirmed on timeout outcomes", async () => {
      const budgetKey = getUtcDailyKey();

      const reservation = await reserveDailyBudget("extract");
      expect(reservation.approved).toBe(true);

      const initialEstimate = Number(
        await redisSimulator.hget(budgetKey, "reserved_cost_micros")
      );

      // Network dropped or timeout occurred (uncertain whether provider billed)
      await settleDailyBudget({
        reservationId: reservation.reservationId!,
        isUncertainOutcome: true,
      });

      const reservedAfter = Number(
        await redisSimulator.hget(budgetKey, "reserved_cost_micros")
      );
      const confirmedAfter = Number(
        await redisSimulator.hget(budgetKey, "confirmed_cost_micros")
      );

      // Reserved was moved to confirmed to prevent budget overages
      expect(reservedAfter).toBe(0);
      expect(confirmedAfter).toBe(initialEstimate);
    });

    it("FAILS CLOSED when Redis is disabled or unreachable", async () => {
      setTestRedisDisabled(true);

      const result = await reserveDailyBudget("audit");

      expect(result.approved).toBe(false);
      expect(result.statusCode).toBe(503);
      expect(result.reason).toBe("infrastructure_unavailable");
      expect(result.message).toBe(
        "Retell is temporarily unable to process new requests. Please try again later."
      );
    });
  });

  describe("Configuration Defaults and Environment Overrides", () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it("resolves canonical hackathon defaults when environment variables are unset", () => {
      delete process.env.RETELL_DAILY_BUDGET_USD;
      delete process.env.RETELL_PRICE_PER_1M_INPUT_TOKENS_USD;
      delete process.env.RETELL_PRICE_PER_1M_OUTPUT_TOKENS_USD;
      delete process.env.RETELL_PRICE_PER_AUDIO_MINUTE_USD;

      const config = getAccountingConfig();
      expect(config.dailyBudgetUsd).toBe(30.0);
      expect(config.pricing.pricePer1MInputTokensUsd).toBe(1.25);
      expect(config.pricing.pricePer1MOutputTokensUsd).toBe(4.25);
      expect(config.pricing.pricePerAudioMinuteUsd).toBe(0.012);
    });

    it("allows explicit environment variables to override defaults", () => {
      process.env.RETELL_DAILY_BUDGET_USD = "50.00";
      process.env.RETELL_PRICE_PER_1M_INPUT_TOKENS_USD = "2.50";
      process.env.RETELL_PRICE_PER_1M_OUTPUT_TOKENS_USD = "8.00";
      process.env.RETELL_PRICE_PER_AUDIO_MINUTE_USD = "0.024";

      const config = getAccountingConfig();
      expect(config.dailyBudgetUsd).toBe(50.0);
      expect(config.pricing.pricePer1MInputTokensUsd).toBe(2.5);
      expect(config.pricing.pricePer1MOutputTokensUsd).toBe(8.0);
      expect(config.pricing.pricePerAudioMinuteUsd).toBe(0.024);
    });
  });
});
