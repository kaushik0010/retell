import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTranscribeSessionInRedis,
  verifyTranscribeSessionOwnership,
  finalizeTranscribeSessionInRedis,
} from "@/lib/accounting/transcribe-guard";
import {
  setTestRedisInstance,
  setTestRedisDisabled,
  InMemoryAccountingRedis,
} from "@/lib/accounting/redis-client";
import { AnonymousIdentity } from "@/lib/accounting/anonymous-identity";
import { getUtcDailyKey } from "@/lib/accounting/budget-ledger";

describe("Persistent Transcribe Session Guard & Device Coordination", () => {
  let redisSimulator: InMemoryAccountingRedis;

  beforeEach(() => {
    redisSimulator = new InMemoryAccountingRedis();
    setTestRedisInstance(redisSimulator);
    setTestRedisDisabled(false);
  });

  const deviceA: AnonymousIdentity = {
    deviceId: "device-uuid-1111",
    isNewDevice: false,
    clientIp: "203.0.113.10",
    deviceKey: "device_key_device_a",
    ipKey: "ip_key_shared_network",
  };

  const deviceB: AnonymousIdentity = {
    deviceId: "device-uuid-2222",
    isNewDevice: false,
    clientIp: "203.0.113.10",
    deviceKey: "device_key_device_b",
    ipKey: "ip_key_shared_network",
  };

  it("registers a spoken transcribe session in Redis and reserves budget", async () => {
    const res = await registerTranscribeSessionInRedis({
      sessionId: "trans_test_001",
      identity: deviceA,
      isMock: false,
      provider: "meta_voice",
    });

    expect(res.allowed).toBe(true);
    expect(res.reservationId).toBeDefined();

    // Active session lock for device A is registered in Redis
    const activeSession = await redisSimulator.get(
      `tsess:active:dev:${deviceA.deviceKey}`
    );
    expect(activeSession).toBe("trans_test_001");
  });

  it("blocks concurrent session attempts on the same device", async () => {
    // 1st session on Device A
    const first = await registerTranscribeSessionInRedis({
      sessionId: "trans_test_001",
      identity: deviceA,
      isMock: false,
      provider: "meta_voice",
    });
    expect(first.allowed).toBe(true);

    // 2nd session attempt while 1st is still active on Device A
    const second = await registerTranscribeSessionInRedis({
      sessionId: "trans_test_002",
      identity: deviceA,
      isMock: false,
      provider: "meta_voice",
    });

    expect(second.allowed).toBe(false);
    expect(second.statusCode).toBe(429);
    expect(second.message).toBe(
      "You already have an active spoken recording in progress. Please finish or stop it first."
    );
  });

  it("allows separate devices on the same IP to run their own sessions", async () => {
    const resA = await registerTranscribeSessionInRedis({
      sessionId: "trans_device_a",
      identity: deviceA,
      isMock: false,
      provider: "meta_voice",
    });
    expect(resA.allowed).toBe(true);

    // Device B on the same IP
    const resB = await registerTranscribeSessionInRedis({
      sessionId: "trans_device_b",
      identity: deviceB,
      isMock: false,
      provider: "meta_voice",
    });
    expect(resB.allowed).toBe(true);
  });

  it("verifies session ownership and blocks session hijacking across devices", async () => {
    await registerTranscribeSessionInRedis({
      sessionId: "trans_private_a",
      identity: deviceA,
      isMock: false,
      provider: "meta_voice",
    });

    // Valid caller (Device A)
    const validCheck = await verifyTranscribeSessionOwnership(
      "trans_private_a",
      deviceA
    );
    expect(validCheck.valid).toBe(true);
    expect(validCheck.session?.sessionId).toBe("trans_private_a");

    // Impersonating caller (Device B attempting to access Device A's session)
    const hijackCheck = await verifyTranscribeSessionOwnership(
      "trans_private_a",
      deviceB
    );
    expect(hijackCheck.valid).toBe(false);
    expect(hijackCheck.statusCode).toBe(403);
    expect(hijackCheck.message).toBe("Session access denied.");
  });

  it("rejects non-existent or expired sessions gracefully", async () => {
    const check = await verifyTranscribeSessionOwnership(
      "trans_non_existent",
      deviceA
    );
    expect(check.valid).toBe(false);
    expect(check.statusCode).toBe(404);
    expect(check.message).toBe("Session not found or expired.");
  });

  it("idempotently finalizes sessions, settles audio duration, and releases device lock", async () => {
    const budgetKey = getUtcDailyKey();

    await registerTranscribeSessionInRedis({
      sessionId: "trans_to_finish",
      identity: deviceA,
      isMock: false,
      provider: "meta_voice",
    });

    const activeBefore = await redisSimulator.get(
      `tsess:active:dev:${deviceA.deviceKey}`
    );
    expect(activeBefore).toBe("trans_to_finish");

    // Finish session after 45 seconds of speech (45,000 ms)
    // 45s = 0.75 min @ $0.012/min = $0.009 = 9,000 micro-USD
    const finishRes1 = await finalizeTranscribeSessionInRedis({
      sessionId: "trans_to_finish",
      identity: deviceA,
      audioProcessedMs: 45000,
    });
    expect(finishRes1.finalized).toBe(true);

    // Device lock is released
    const activeAfter = await redisSimulator.get(
      `tsess:active:dev:${deviceA.deviceKey}`
    );
    expect(activeAfter).toBeNull();

    // Budget ledger confirmed cost was updated by 9,000 micros
    const confirmedCost = Number(
      await redisSimulator.hget(budgetKey, "confirmed_cost_micros")
    );
    expect(confirmedCost).toBe(9000);

    // Idempotency: calling finalize again does not double-bill
    const finishRes2 = await finalizeTranscribeSessionInRedis({
      sessionId: "trans_to_finish",
      identity: deviceA,
      audioProcessedMs: 45000,
    });
    expect(finishRes2.finalized).toBe(true);

    const confirmedCostAfterSecond = Number(
      await redisSimulator.hget(budgetKey, "confirmed_cost_micros")
    );
    expect(confirmedCostAfterSecond).toBe(9000);

    // Device A can now start a new session
    const newSession = await registerTranscribeSessionInRedis({
      sessionId: "trans_subsequent",
      identity: deviceA,
      isMock: false,
      provider: "meta_voice",
    });
    expect(newSession.allowed).toBe(true);
  });

  it("FAILS CLOSED with 503 if Redis is unavailable during session creation", async () => {
    setTestRedisDisabled(true);

    const res = await registerTranscribeSessionInRedis({
      sessionId: "trans_fail_closed",
      identity: deviceA,
      isMock: false,
      provider: "meta_voice",
    });

    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(res.message).toBe(
      "Retell is temporarily unable to process new requests. Please try again later."
    );
  });
});
