import { describe, it, expect } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  getAnonymousIdentity,
  attachDeviceCookie,
  hashIdentifier,
  ANONYMOUS_DEVICE_COOKIE_NAME,
} from "@/lib/accounting/anonymous-identity";

describe("Anonymous Identity & Privacy-Preserving Device Resolution", () => {
  it("generates a valid UUIDv4 deviceId when no device cookie is present", () => {
    const req = new NextRequest("http://localhost:3000/api/rubric", {
      headers: { "x-forwarded-for": "203.0.113.195" },
    });

    const identity = getAnonymousIdentity(req);

    expect(identity.isNewDevice).toBe(true);
    expect(identity.deviceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(identity.deviceKey).toMatch(/^device_[0-9a-f]{32}$/);
    expect(identity.clientIp).toBe("203.0.113.195");
    expect(identity.ipKey).toMatch(/^ip_[0-9a-f]{32}$/);
  });

  it("reuses existing valid device cookie when supplied", () => {
    const existingId = "c56a4180-65aa-42ec-a945-5fd21dec0538";
    const req = new NextRequest("http://localhost:3000/api/rubric", {
      headers: {
        cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${existingId}`,
        "x-real-ip": "198.51.100.42",
      },
    });

    const identity = getAnonymousIdentity(req);

    expect(identity.isNewDevice).toBe(false);
    expect(identity.deviceId).toBe(existingId);
    expect(identity.clientIp).toBe("198.51.100.42");
    expect(identity.deviceKey).toBe(hashIdentifier("device", existingId));
  });

  it("replaces invalid or malformed device cookies with a fresh UUIDv4", () => {
    const invalidCookies = [
      "not-a-uuid",
      "../etc/passwd",
      "<script>alert(1)</script>",
      "12345",
      "12345678-1234-1234-1234-123456789012345", // too long
    ];

    for (const badCookie of invalidCookies) {
      const req = new NextRequest("http://localhost:3000/api/extract", {
        headers: {
          cookie: `${ANONYMOUS_DEVICE_COOKIE_NAME}=${badCookie}`,
        },
      });

      const identity = getAnonymousIdentity(req);
      expect(identity.isNewDevice).toBe(true);
      expect(identity.deviceId).not.toBe(badCookie);
      expect(identity.deviceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }
  });

  it("correctly extracts client IP from multi-hop x-forwarded-for header", () => {
    const req = new NextRequest("http://localhost:3000/api/extract", {
      headers: {
        "x-forwarded-for": "192.0.2.1, 10.0.0.1, 172.16.0.1",
      },
    });

    const identity = getAnonymousIdentity(req);
    expect(identity.clientIp).toBe("192.0.2.1");
  });

  it("falls back to 127.0.0.1 when no IP headers are present", () => {
    const req = new NextRequest("http://localhost:3000/api/extract");
    const identity = getAnonymousIdentity(req);
    expect(identity.clientIp).toBe("127.0.0.1");
  });

  it("attaches secure HttpOnly cookie to NextResponse", () => {
    const response = NextResponse.json({ success: true });
    const deviceId = "c56a4180-65aa-42ec-a945-5fd21dec0538";

    attachDeviceCookie(response, deviceId);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(`${ANONYMOUS_DEVICE_COOKIE_NAME}=${deviceId}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");
  });

  it("generates deterministic HMAC key hashes without storing raw PII", () => {
    const rawDevice = "e0a6d0c4-9467-4228-a6d1-419b4e39b9c9";
    const hash1 = hashIdentifier("device", rawDevice);
    const hash2 = hashIdentifier("device", rawDevice);
    const diffHash = hashIdentifier("device", "another-uuid");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(diffHash);
    expect(hash1).not.toContain(rawDevice);
    expect(hash1.startsWith("device_")).toBe(true);
  });
});
