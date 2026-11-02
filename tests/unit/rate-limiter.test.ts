import { describe, it, expect, beforeEach } from "vitest";
import { checkEndpointRateLimit } from "@/lib/accounting/rate-limiter";
import {
  setTestRedisInstance,
  setTestRedisDisabled,
  InMemoryAccountingRedis,
} from "@/lib/accounting/redis-client";
import { AnonymousIdentity } from "@/lib/accounting/anonymous-identity";

describe("Sliding Window Rate Limiter & Abuse Protection", () => {
  let redisSimulator: InMemoryAccountingRedis;

  beforeEach(() => {
    redisSimulator = new InMemoryAccountingRedis();
    setTestRedisInstance(redisSimulator);
    setTestRedisDisabled(false);
  });

  const testIdentity: AnonymousIdentity = {
    deviceId: "c56a4180-65aa-42ec-a945-5fd21dec0538",
    isNewDevice: false,
    clientIp: "203.0.113.195",
    deviceKey: "device_test_hash_123456",
    ipKey: "ip_test_hash_abcdef",
  };

  it("allows initial requests within burst and sustained limits", async () => {
    const result = await checkEndpointRateLimit("extract", testIdentity);
    expect(result.allowed).toBe(true);
    expect(result.statusCode).toBeUndefined();
  });

  it("blocks rapid requests when device burst limit is reached", async () => {
    // Config: extract device burst is 3 requests per 60s
    const first = await checkEndpointRateLimit("extract", testIdentity);
    const second = await checkEndpointRateLimit("extract", testIdentity);
    const third = await checkEndpointRateLimit("extract", testIdentity);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(true);

    // 4th request exceeds burst ceiling
    const fourth = await checkEndpointRateLimit("extract", testIdentity);
    expect(fourth.allowed).toBe(false);
    expect(fourth.statusCode).toBe(429);
    expect(fourth.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(fourth.message).toBe(
      "You're doing that a little too quickly. Please wait a moment and try again."
    );
  });

  it("enforces IP rate limits across multiple devices sharing the same network", async () => {
    // IP burst for extract is 10 per 60s
    // Simulate 5 different devices on the same IP (2 requests each = 10 total requests)
    for (let i = 1; i <= 5; i++) {
      const devIdentity: AnonymousIdentity = {
        deviceId: `device-uuid-0000-0000-${i}`,
        isNewDevice: true,
        clientIp: "198.51.100.55",
        deviceKey: `device_unique_key_${i}`,
        ipKey: "ip_shared_campus_hash",
      };

      const r1 = await checkEndpointRateLimit("extract", devIdentity);
      const r2 = await checkEndpointRateLimit("extract", devIdentity);
      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
    }

    // 11th request from another device on the same IP should hit IP burst ceiling (10)
    const dev6: AnonymousIdentity = {
      deviceId: "device-uuid-0000-0000-6",
      isNewDevice: true,
      clientIp: "198.51.100.55",
      deviceKey: "device_unique_key_6",
      ipKey: "ip_shared_campus_hash",
    };

    const blocked = await checkEndpointRateLimit("extract", dev6);
    expect(blocked.allowed).toBe(false);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.reason).toBe("rate_limited");
  });

  it("FAILS CLOSED with student-friendly 503 if Redis is unavailable", async () => {
    // Simulate Redis infrastructure failure
    setTestRedisDisabled(true);

    const result = await checkEndpointRateLimit("audit", testIdentity);
    expect(result.allowed).toBe(false);
    expect(result.statusCode).toBe(503);
    expect(result.reason).toBe("infrastructure_unavailable");
    expect(result.message).toBe(
      "Retell is temporarily unable to process new requests. Please try again later."
    );
    // Student-friendly message contains no internal infrastructure jargon
    expect(result.message).not.toContain("Redis");
    expect(result.message).not.toContain("Upstash");
    expect(result.message).not.toContain("database");
  });
});
