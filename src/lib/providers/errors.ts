import type { ProviderError, SanitizedErrorCategory } from "./types";

/**
 * Strips potential API keys, authorization tokens, or sensitive patterns from error messages.
 */
export function sanitizeMessage(raw: string): string {
  if (!raw) return "An unspecified error occurred.";
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/Api-Key\s+[A-Za-z0-9._~+/-]+=*/gi, "Api-Key [REDACTED]")
    .replace(/key=[A-Za-z0-9._~+/-]+/gi, "key=[REDACTED]")
    .replace(/([a-zA-Z0-9_-]{20,})/g, "[REDACTED_TOKEN]");
}

/**
 * Categorizes an HTTP status code and upstream response into a safe internal error category.
 */
export function categorizeHttpError(
  statusCode: number,
  rawBody?: string
): ProviderError {
  let category: SanitizedErrorCategory = "UNKNOWN_ERROR";
  let message = `Upstream request failed with HTTP ${statusCode}.`;

  if (statusCode === 401 || statusCode === 403) {
    category = "AUTHENTICATION_ERROR";
    message =
      "Authentication failed. Check that the provider API key is valid and has permission for this model.";
  } else if (statusCode === 404) {
    category = "MODEL_UNAVAILABLE";
    message =
      "Model not found. The configured model ID may be invalid, deprecated, or restricted on this account.";
  } else if (statusCode === 429) {
    category = "RATE_LIMIT_ERROR";
    message =
      "Rate limit or quota exceeded. Account credits may be exhausted or rate limit was reached.";
  } else if (statusCode >= 500 && statusCode < 600) {
    category = "NETWORK_ERROR";
    message = `Provider internal server error (HTTP ${statusCode}).`;
  }

  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      if (typeof parsed["error"] === "string") {
        message = `${message} Upstream: ${sanitizeMessage(parsed["error"])}`;
      } else if (
        typeof parsed["error"] === "object" &&
        parsed["error"] !== null
      ) {
        const errObj = parsed["error"] as Record<string, unknown>;
        if (typeof errObj["message"] === "string") {
          message = `${message} Upstream: ${sanitizeMessage(errObj["message"])}`;
        }
      }
    } catch {
      // Body is not JSON; use truncated sanitized snippet
      const snippet = sanitizeMessage(rawBody.slice(0, 150));
      if (snippet.trim().length > 0) {
        message = `${message} Details: ${snippet}`;
      }
    }
  }

  return {
    category,
    message,
    statusCode,
  };
}

/**
 * Categorizes caught exceptions (network failure, timeout, abort, etc.).
 */
export function sanitizeError(err: unknown): ProviderError {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.message.includes("timeout")) {
      return {
        category: "TIMEOUT",
        message: "Request timed out waiting for provider response.",
      };
    }
    if (
      err.name === "AbortError" ||
      err.message.includes("aborted") ||
      err.message.includes("fetch failed") ||
      err.message.includes("ENOTFOUND") ||
      err.message.includes("ECONNREFUSED")
    ) {
      return {
        category: "NETWORK_ERROR",
        message: `Network communication failure: ${sanitizeMessage(err.message)}`,
      };
    }
    return {
      category: "UNKNOWN_ERROR",
      message: sanitizeMessage(err.message),
    };
  }

  return {
    category: "UNKNOWN_ERROR",
    message: "An unknown non-Error exception was thrown.",
  };
}
