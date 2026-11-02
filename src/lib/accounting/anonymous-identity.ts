import "server-only";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAccountingConfig } from "./config";

export const ANONYMOUS_DEVICE_COOKIE_NAME = "retell_device_id";

// RFC 4122 UUID v4 regex validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AnonymousIdentity {
  /**
   * The client device identifier (UUIDv4) stored in a secure HttpOnly cookie.
   */
  deviceId: string;

  /**
   * Whether this device identifier was freshly generated during this request.
   */
  isNewDevice: boolean;

  /**
   * The client IP address determined from trusted headers.
   */
  clientIp: string;

  /**
   * Keyed HMAC of the device identifier safe for Redis key names.
   * Completely irreversible; no raw device IDs stored in Redis.
   */
  deviceKey: string;

  /**
   * Keyed HMAC of the IP address safe for Redis key names.
   * Completely irreversible; no raw IP addresses stored in Redis.
   */
  ipKey: string;
}

/**
 * Resolves or initializes the anonymous student device ID using an HttpOnly cookie.
 * Does NOT collect hardware identifiers, canvas signatures, WebGL data, or PII.
 *
 * Notice: This is an abuse prevention mechanism, not tamper-proof user authentication.
 * A determined user can clear cookies to obtain a new identifier.
 */
export function resolveAnonymousDevice(req: NextRequest): {
  deviceId: string;
  isNewDevice: boolean;
} {
  const cookieValue = req.cookies.get(ANONYMOUS_DEVICE_COOKIE_NAME)?.value;

  if (cookieValue && UUID_REGEX.test(cookieValue.trim())) {
    return {
      deviceId: cookieValue.trim().toLowerCase(),
      isNewDevice: false,
    };
  }

  // Generate a cryptographically strong random UUIDv4
  const freshId = crypto.randomUUID().toLowerCase();
  return {
    deviceId: freshId,
    isNewDevice: true,
  };
}

/**
 * Resolves the client IP using trusted deployment headers (Vercel edge proxy).
 * Tolerates shared networks (college hostels, campus Wi-Fi, libraries).
 */
export function resolveClientIp(req: NextRequest): string {
  // In Vercel and standard reverse proxies, x-forwarded-for contains client IP as the first entry
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && isValidIp(first)) {
      return first;
    }
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  // Fallback for local development
  return "127.0.0.1";
}

function isValidIp(ip: string): boolean {
  // Basic sanity check for IPv4 or IPv6
  if (!ip || ip.length > 45) return false;
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  return ipv4.test(ip) || ipv6.test(ip);
}

/**
 * Creates an irreversible, keyed SHA-256 HMAC for constructing Redis keys.
 * Ensures Redis key inspection reveals zero raw cookies, device IDs, or IP addresses.
 */
export function hashIdentifier(
  type: "device" | "ip",
  rawValue: string,
  secretOverride?: string
): string {
  const secret = secretOverride || getAccountingConfig().anonymousHmacSecret;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(`${type}:${rawValue}`)
    .digest("hex")
    .slice(0, 32);

  return `${type}_${hmac}`;
}

/**
 * Extracts and prepares complete anonymous identity from an incoming NextRequest.
 */
export function getAnonymousIdentity(req: NextRequest): AnonymousIdentity {
  const { deviceId, isNewDevice } = resolveAnonymousDevice(req);
  const clientIp = resolveClientIp(req);

  return {
    deviceId,
    isNewDevice,
    clientIp,
    deviceKey: hashIdentifier("device", deviceId),
    ipKey: hashIdentifier("ip", clientIp),
  };
}

/**
 * Attaches the HttpOnly device cookie to an outgoing response if the device is new.
 */
export function attachDeviceCookie(
  response: NextResponse | Response,
  deviceId: string
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieOptions = {
    name: ANONYMOUS_DEVICE_COOKIE_NAME,
    value: deviceId,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 365 * 24 * 60 * 60, // 1 year
    secure: isProduction,
  };

  if ("cookies" in response && typeof response.cookies?.set === "function") {
    response.cookies.set(cookieOptions);
  } else if ("headers" in response && response.headers instanceof Headers) {
    const parts = [
      `${ANONYMOUS_DEVICE_COOKIE_NAME}=${deviceId}`,
      `Path=/`,
      `Max-Age=${365 * 24 * 60 * 60}`,
      `HttpOnly`,
      `SameSite=Lax`,
    ];
    if (isProduction) parts.push("Secure");
    response.headers.append("Set-Cookie", parts.join("; "));
  }
}
