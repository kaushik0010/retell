import { describe, expect, it } from "vitest";
import {
  categorizeHttpError,
  sanitizeError,
  sanitizeMessage,
} from "../../src/lib/providers/errors";

describe("Sanitization & Error Categorization", () => {
  it("redacts Bearer tokens from error strings", () => {
    const raw =
      "Request failed with Authorization: Bearer sk-meta-secret-1234567890abcdef";
    const cleaned = sanitizeMessage(raw);
    expect(cleaned).not.toContain("sk-meta-secret-1234567890abcdef");
    expect(cleaned).toContain("[REDACTED");
  });

  it("redacts Api-Key tokens from error strings", () => {
    const raw = "API call rejected for Api-Key b10_secret_abcdef9876543210";
    const cleaned = sanitizeMessage(raw);
    expect(cleaned).not.toContain("b10_secret_abcdef9876543210");
    expect(cleaned).toContain("[REDACTED");
  });

  it("categorizes 401 as AUTHENTICATION_ERROR", () => {
    const err = categorizeHttpError(401, '{"error": "Unauthorized key"}');
    expect(err.category).toBe("AUTHENTICATION_ERROR");
    expect(err.statusCode).toBe(401);
  });

  it("categorizes 404 as MODEL_UNAVAILABLE", () => {
    const err = categorizeHttpError(404, '{"error": "Model not found"}');
    expect(err.category).toBe("MODEL_UNAVAILABLE");
    expect(err.statusCode).toBe(404);
  });

  it("categorizes 429 as RATE_LIMIT_ERROR", () => {
    const err = categorizeHttpError(429, '{"error": "Quota exhausted"}');
    expect(err.category).toBe("RATE_LIMIT_ERROR");
    expect(err.statusCode).toBe(429);
  });

  it("categorizes 500 as NETWORK_ERROR", () => {
    const err = categorizeHttpError(500, "Internal Server Error");
    expect(err.category).toBe("NETWORK_ERROR");
    expect(err.statusCode).toBe(500);
  });

  it("categorizes timeout exceptions as TIMEOUT", () => {
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    const err = sanitizeError(timeoutErr);
    expect(err.category).toBe("TIMEOUT");
  });
});
