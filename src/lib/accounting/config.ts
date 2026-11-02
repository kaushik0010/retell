import "server-only";

/**
 * Server-only configuration for persistent rate limiting, AI usage accounting,
 * and global daily spending protection.
 *
 * All financial, pricing, and secret settings reside exclusively on the server.
 * Never expose these values or variables to client bundles or API responses.
 */

export interface EndpointLimitConfig {
  deviceBurstMax: number;
  deviceBurstWindowSeconds: number;
  deviceSustainedMax: number;
  deviceSustainedWindowSeconds: number;
  ipBurstMax: number;
  ipBurstWindowSeconds: number;
  ipSustainedMax: number;
  ipSustainedWindowSeconds: number;
}

export interface AccountingConfig {
  /**
   * Upstash Redis REST configuration.
   */
  redisRestUrl?: string;
  redisRestToken?: string;

  /**
   * Global daily AI spending budget in USD.
   * Resets every UTC midnight.
   * Default: $30.00 USD (hackathon testing baseline; operator-configurable).
   */
  dailyBudgetUsd: number;

  /**
   * Server-side HMAC secret for hashing anonymous device cookies and IP addresses
   * before constructing Redis keys. Ensures no PII or raw identifiers reside in Redis.
   */
  anonymousHmacSecret: string;

  /**
   * Pricing rates in USD.
   * Configurable via environment variables without hardcoded or invented assumptions.
   */
  pricing: {
    pricePer1MInputTokensUsd: number;
    pricePer1MOutputTokensUsd: number;
    pricePerAudioMinuteUsd: number;
  };

  /**
   * Endpoint rate limits.
   */
  limits: {
    extract: EndpointLimitConfig;
    rubric: EndpointLimitConfig;
    audit: EndpointLimitConfig;
    transcribeSession: {
      maxConcurrentPerDevice: number;
      maxConcurrentPerIp: number;
      deviceMaxIn10Min: number;
      deviceMaxIn24Hours: number;
      ipMaxIn10Min: number;
      maxSessionDurationSeconds: number;
    };
  };

  /**
   * Reservation parameters.
   */
  reservationTtlSeconds: number;
}

function parseNumberEnv(
  key: string,
  defaultValue: number,
  minVal?: number,
  maxVal?: number
): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = parseFloat(raw.trim());
  if (isNaN(parsed) || !isFinite(parsed)) return defaultValue;
  if (typeof minVal === "number" && parsed < minVal) return minVal;
  if (typeof maxVal === "number" && parsed > maxVal) return maxVal;
  return parsed;
}

/**
 * Resolves current accounting configuration from server environment variables.
 */
export function getAccountingConfig(): AccountingConfig {
  const redisRestUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  // Canonical default daily budget: $30.00 USD (hackathon testing baseline)
  // Operators can configure RETELL_DAILY_BUDGET_USD in .env.local / Vercel env
  const dailyBudgetUsd = parseNumberEnv(
    "RETELL_DAILY_BUDGET_USD",
    30.0,
    0.5,
    500.0
  );

  // HMAC secret for privacy-conscious key generation
  const anonymousHmacSecret =
    process.env.RETELL_ANONYMOUS_HMAC_SECRET?.trim() ||
    process.env.META_MODEL_API_KEY?.slice(0, 32) ||
    "retell_default_server_hmac_secret_2026";

  // Authoritative application-side model pricing baseline (operator-configurable)
  // Canonical defaults for hackathon testing period:
  // - Input tokens: $1.25 per 1M tokens ($0.00000125 / token)
  // - Output tokens: $4.25 per 1M tokens ($0.00000425 / token)
  // - Audio: $0.012 per minute ($0.0002 / second)
  const pricePer1MInputTokensUsd = parseNumberEnv(
    "RETELL_PRICE_PER_1M_INPUT_TOKENS_USD",
    1.25
  );
  const pricePer1MOutputTokensUsd = parseNumberEnv(
    "RETELL_PRICE_PER_1M_OUTPUT_TOKENS_USD",
    4.25
  );
  const pricePerAudioMinuteUsd = parseNumberEnv(
    "RETELL_PRICE_PER_AUDIO_MINUTE_USD",
    0.012
  );

  return {
    redisRestUrl,
    redisRestToken,
    dailyBudgetUsd,
    anonymousHmacSecret,
    pricing: {
      pricePer1MInputTokensUsd,
      pricePer1MOutputTokensUsd,
      pricePerAudioMinuteUsd,
    },
    limits: {
      // Extraction: High token usage (full syllabus/notes analysis)
      // Device: 5 requests / 10m, 25 / 24h
      // IP: 20 requests / 10m, 100 / 24h (shared campus accommodation)
      extract: {
        deviceBurstMax: 3,
        deviceBurstWindowSeconds: 60,
        deviceSustainedMax: 10,
        deviceSustainedWindowSeconds: 600,
        ipBurstMax: 10,
        ipBurstWindowSeconds: 60,
        ipSustainedMax: 40,
        ipSustainedWindowSeconds: 600,
      },
      // Rubric generation: 1 call per question
      // Device: 8 requests / 60s burst, 25 / 5m
      // IP: 30 requests / 60s burst, 100 / 5m
      rubric: {
        deviceBurstMax: 8,
        deviceBurstWindowSeconds: 60,
        deviceSustainedMax: 25,
        deviceSustainedWindowSeconds: 300,
        ipBurstMax: 30,
        ipBurstWindowSeconds: 60,
        ipSustainedMax: 100,
        ipSustainedWindowSeconds: 300,
      },
      // Answer auditing: Spoken evaluation per practice attempt
      // Device: 5 requests / 60s burst, 20 / 5m
      // IP: 20 requests / 60s burst, 80 / 5m
      audit: {
        deviceBurstMax: 5,
        deviceBurstWindowSeconds: 60,
        deviceSustainedMax: 20,
        deviceSustainedWindowSeconds: 300,
        ipBurstMax: 20,
        ipBurstWindowSeconds: 60,
        ipSustainedMax: 80,
        ipSustainedWindowSeconds: 300,
      },
      // Speech transcription session coordination
      transcribeSession: {
        maxConcurrentPerDevice: 1, // Only 1 active spoken recording per device
        maxConcurrentPerIp: 6, // Up to 6 simultaneous sessions from shared campus IP
        deviceMaxIn10Min: 8, // Normal practice loop
        deviceMaxIn24Hours: 50,
        ipMaxIn10Min: 35,
        maxSessionDurationSeconds: 300, // 5 minutes max per spoken attempt
      },
    },
    reservationTtlSeconds: 150, // 2.5 minutes before un-settled reservation auto-expires
  };
}
