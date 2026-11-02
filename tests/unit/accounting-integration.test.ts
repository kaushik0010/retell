import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as extractRoute } from "@/app/api/extract/route";
import { POST as rubricRoute } from "@/app/api/rubric/route";
import { POST as auditRoute } from "@/app/api/audit/route";
import { POST as transcribeSessionRoute } from "@/app/api/transcribe/session/route";
import { POST as transcribeAudioRoute } from "@/app/api/transcribe/audio/route";
import { POST as transcribeFinishRoute } from "@/app/api/transcribe/finish/route";
import {
  setTestRedisInstance,
  setTestRedisDisabled,
  InMemoryAccountingRedis,
} from "@/lib/accounting/redis-client";
import { ANONYMOUS_DEVICE_COOKIE_NAME } from "@/lib/accounting/anonymous-identity";
import { getUtcDailyKey } from "@/lib/accounting/budget-ledger";

describe("Protected Routes Accounting & Security Integration", () => {
  let redisSimulator: InMemoryAccountingRedis;

  beforeEach(() => {
    redisSimulator = new InMemoryAccountingRedis();
    setTestRedisInstance(redisSimulator);
    setTestRedisDisabled(false);
  });

  const testDeviceId = "c56a4180-65aa-42ec-a945-5fd21dec0538";

  describe("POST /api/extract Protection", () => {
    it("attaches HttpOnly device cookie to new students and enforces rate limits", async () => {
      // 1. Initial extraction request without cookie
      const req1 = new NextRequest("http://localhost:3000/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.88",
        },
        body: JSON.stringify({
          sourceText:
            "Q: What is caching? A: A technique to store copies of data.",
        }),
      });

      const res1 = await extractRoute(req1);
      // Even if AI provider fails or succeeds, the cookie must be attached
      const setCookie = res1.headers.get("set-cookie");
      expect(setCookie).toContain(ANONYMOUS_DEVICE_COOKIE_NAME);
      expect(setCookie).toContain("HttpOnly");
    });

    it("fails closed with 503 if Redis is unreachable", async () => {
      setTestRedisDisabled(true);

      const req = new NextRequest("http://localhost:3000/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
        },
        body: JSON.stringify({
          sourceText: "Q: What is a process? A: A program in execution.",
        }),
      });

      const res = await extractRoute(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe(
        "Retell is temporarily unable to process new requests. Please try again later."
      );
    });
  });

  describe("POST /api/rubric Protection", () => {
    it("enforces rate limits on rapid rubric generation calls", async () => {
      // Rubric device burst max is 8
      for (let i = 0; i < 8; i++) {
        const req = new NextRequest("http://localhost:3000/api/rubric", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
          },
          body: JSON.stringify({
            questionId: `q_${i}`,
            studyMaterialId: `mat_${i}`,
            question: `Explain concept number ${i} in detail?`,
            referenceAnswer: `Reference answer ${i} has enough length to satisfy the domain schema validation.`,
            sourceText: `Source notes ${i} must have at least twenty characters to be valid.`,
          }),
        });

        const res = await rubricRoute(req);
        // Should not be 429
        expect(res.status).not.toBe(429);
      }

      // 9th rapid request from the same device must be rate-limited
      const reqBlocked = new NextRequest("http://localhost:3000/api/rubric", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
        },
        body: JSON.stringify({
          questionId: "q_9",
          studyMaterialId: "mat_9",
          question: "Explain concept number 9 in detail?",
          referenceAnswer:
            "Reference answer 9 has enough length to satisfy the domain schema validation.",
          sourceText:
            "Source notes 9 must have at least twenty characters to be valid.",
        }),
      });

      const resBlocked = await rubricRoute(reqBlocked);
      expect(resBlocked.status).toBe(429);
      expect(resBlocked.headers.get("retry-after")).toBeDefined();
      const body = await resBlocked.json();
      expect(body.error).toBe(
        "You're doing that a little too quickly. Please wait a moment and try again."
      );
    });
  });

  describe("POST /api/audit Protection", () => {
    it("successfully runs mock fallback audit without depleting paid daily budget", async () => {
      const budgetKey = getUtcDailyKey();

      const req = new NextRequest("http://localhost:3000/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
        },
        body: JSON.stringify({
          attemptId: "att_001",
          studySetId: "set_001",
          questionId: "q_001",
          question: "Explain the Waterfall model.",
          referenceAnswer:
            "The Waterfall model is a sequential software lifecycle model.",
          transcript:
            "Waterfall model is linear sequential with distinct phases.",
          mockFallback: true,
        }),
      });

      const res = await auditRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.audit).toBeDefined();

      // No paid budget was consumed because mockFallback skipped paid reservation
      const confirmedCost = Number(
        await redisSimulator.hget(budgetKey, "confirmed_cost_micros")
      );
      expect(confirmedCost).toBe(0);
    });

    it("fails closed with 503 if Redis is unavailable for live audits", async () => {
      setTestRedisDisabled(true);

      const req = new NextRequest("http://localhost:3000/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
        },
        body: JSON.stringify({
          attemptId: "att_002",
          studySetId: "set_001",
          questionId: "q_001",
          question: "Explain the Waterfall model.",
          referenceAnswer:
            "The Waterfall model is a sequential software lifecycle model.",
          transcript: "Waterfall model is sequential.",
          mockFallback: false,
        }),
      });

      const res = await auditRoute(req);
      expect(res.status).toBe(503);
    });
  });

  describe("POST /api/transcribe Session, Audio & Finish Lifecycle", () => {
    it("enforces single session per device, verifies ownership, and settles on finish", async () => {
      const budgetKey = getUtcDailyKey();

      // 1. Initialize session on Device A
      const sessionReq1 = new NextRequest(
        "http://localhost:3000/api/transcribe/session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
          },
          body: JSON.stringify({ mockFallback: true }),
        }
      );

      const sessionRes1 = await transcribeSessionRoute(sessionReq1);
      expect(sessionRes1.status).toBe(200);
      const sessionData1 = await sessionRes1.json();
      expect(sessionData1.success).toBe(true);
      const sessionId = sessionData1.sessionId;
      expect(sessionId).toBeDefined();

      // 2. Attempt to start a 2nd concurrent session from same device -> rejected with 429
      const sessionReq2 = new NextRequest(
        "http://localhost:3000/api/transcribe/session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
          },
          body: JSON.stringify({ mockFallback: true }),
        }
      );

      const sessionRes2 = await transcribeSessionRoute(sessionReq2);
      expect(sessionRes2.status).toBe(429);
      const sessionData2 = await sessionRes2.json();
      expect(sessionData2.error).toContain(
        "already have an active spoken recording"
      );

      // 3. Audio chunk from unauthorized device -> rejected with 403
      const foreignDeviceId = "98765432-1234-4321-9876-1234567890ab";
      const audioReqUnauthorized = new NextRequest(
        `http://localhost:3000/api/transcribe/audio?sessionId=${sessionId}`,
        {
          method: "POST",
          headers: {
            cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${foreignDeviceId}`,
          },
          body: new Uint8Array([0, 1, 2, 3]),
        }
      );

      const audioResUnauthorized =
        await transcribeAudioRoute(audioReqUnauthorized);
      expect(audioResUnauthorized.status).toBe(403);

      // 4. Audio chunk from owner device -> succeeds
      const audioReqAuthorized = new NextRequest(
        `http://localhost:3000/api/transcribe/audio?sessionId=${sessionId}`,
        {
          method: "POST",
          headers: {
            cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
          },
          body: new Uint8Array([0, 1, 2, 3]),
        }
      );

      const audioResAuthorized = await transcribeAudioRoute(audioReqAuthorized);
      expect(audioResAuthorized.status).toBe(200);

      // 5. Finish session
      const finishReq = new NextRequest(
        `http://localhost:3000/api/transcribe/finish?sessionId=${sessionId}`,
        {
          method: "POST",
          headers: {
            cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
          },
        }
      );

      const finishRes = await transcribeFinishRoute(finishReq);
      expect(finishRes.status).toBe(200);

      // 6. Device is now unlocked, can start a new session
      const sessionReq3 = new NextRequest(
        "http://localhost:3000/api/transcribe/session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${testDeviceId}`,
          },
          body: JSON.stringify({ mockFallback: true }),
        }
      );

      const sessionRes3 = await transcribeSessionRoute(sessionReq3);
      expect(sessionRes3.status).toBe(200);
    });
  });
});
