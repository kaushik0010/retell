import { describe, it, expect } from "vitest";
import {
  mapToStudentError,
  getStudentFriendlyErrorMessage,
} from "../../src/lib/errors";

describe("Student-Friendly Error Mapping & Classification", () => {
  describe("User-Actionable Errors", () => {
    it("maps microphone permission denial to clear browser setting guidance", () => {
      const err1 = new Error("NotAllowedError: Permission denied by user");
      const err2 = "PermissionDismissedError";

      const res1 = mapToStudentError(err1, "practice");
      const res2 = mapToStudentError(err2, "practice");

      expect(res1.userActionable).toBe(true);
      expect(res1.category).toBe("permission");
      expect(res1.message).toContain("Microphone access is blocked");
      expect(res1.actionLabel).toBe("Allow microphone access");

      expect(res2.userActionable).toBe(true);
      expect(res2.message).toContain("Microphone access is blocked");
    });

    it("maps missing microphone hardware to device check guidance", () => {
      const err = new Error(
        "NotFoundError: No microphone detected on your device."
      );
      const res = mapToStudentError(err, "practice");

      expect(res.userActionable).toBe(true);
      expect(res.category).toBe("device");
      expect(res.message).toBe(
        "We couldn't find a working microphone. Check your device and try again."
      );
    });

    it("maps network disconnection and fetch failures to reconnect guidance", () => {
      const err1 = new TypeError("Failed to fetch");
      const err2 = new Error(
        "Network communication failure: ECONNREFUSED 127.0.0.1:443"
      );

      const res1 = mapToStudentError(err1);
      const res2 = mapToStudentError(err2);

      expect(res1.userActionable).toBe(true);
      expect(res1.category).toBe("network");
      expect(res1.message).toContain(
        "internet connection appears to be unavailable"
      );

      expect(res2.userActionable).toBe(true);
      expect(res2.message).toContain(
        "internet connection appears to be unavailable"
      );
    });

    it("maps timeout errors to friendly retry message", () => {
      const err = new Error("The operation was aborted due to timeout");
      const res = mapToStudentError(err);

      expect(res.userActionable).toBe(true);
      expect(res.category).toBe("network");
      expect(res.message).toBe(
        "Your connection took too long. Please try again."
      );
    });

    it("maps unsupported file formats to supported image/pdf guidance", () => {
      const err = "Unsupported file format: audio/mp3";
      const res = mapToStudentError(err, "extraction");

      expect(res.userActionable).toBe(true);
      expect(res.category).toBe("file_validation");
      expect(res.message).toContain("This file type isn't supported");
    });

    it("maps file size and upload payload limits to smaller file guidance", () => {
      const err = "File size exceeds the 4.5 MB upload limit";
      const res = mapToStudentError(err, "extraction");

      expect(res.userActionable).toBe(true);
      expect(res.category).toBe("file_validation");
      expect(res.message).toBe(
        "This file is too large. Try choosing a smaller file or fewer pages."
      );
    });

    it("maps corrupted PDF to upload another copy guidance", () => {
      const err = "Failed to read PDF: file is corrupt or password protected";
      const res = mapToStudentError(err, "extraction");

      expect(res.userActionable).toBe(true);
      expect(res.category).toBe("file_validation");
      expect(res.message).toBe(
        "We couldn't read this PDF. Try another copy of the file."
      );
    });

    it("maps missing question or answer prompts to material guidance", () => {
      const qErr = "missing_question: no question prompt found";
      const aErr = "missing_answer: empty reference answer";

      const qRes = mapToStudentError(qErr, "extraction");
      const aRes = mapToStudentError(aErr, "extraction");

      expect(qRes.userActionable).toBe(true);
      expect(qRes.category).toBe("content_structure");
      expect(qRes.message).toBe(
        "We couldn't find both a question and its answer. Please check your material."
      );

      expect(aRes.userActionable).toBe(true);
      expect(aRes.category).toBe("content_structure");
      expect(aRes.message).toContain("couldn't find an answer");
    });
  });

  describe("Application-Side & Resource Protection Errors", () => {
    it("maps rate-limiting (429) to polite wait guidance without technical quota details", () => {
      const err =
        "You're doing that a little too quickly. HTTP 429 rate_limited";
      const res = mapToStudentError(err);

      expect(res.userActionable).toBe(false);
      expect(res.category).toBe("rate_limit");
      expect(res.message).toBe(
        "You've made several attempts in a short time. Please wait a little and try again."
      );
      expect(res.message).not.toContain("429");
      expect(res.message).not.toContain("quota");
    });

    it("maps daily AI budget exhaustion to respectful capacity notice without exposing budget sums", () => {
      const err = "budget_exhausted: global daily budget cap reached";
      const res = mapToStudentError(err);

      expect(res.userActionable).toBe(false);
      expect(res.category).toBe("budget");
      expect(res.message).toBe(
        "Retell has reached its daily practice capacity. Please check back tomorrow or try again later."
      );
      expect(res.message).not.toContain("$30");
      expect(res.message).not.toContain("30,000,000");
      expect(res.message).not.toContain("Redis");
    });

    it("provides reassuring, context-specific messages for internal server errors", () => {
      const raw500 = "Provider internal server error (HTTP 500).";

      const extractRes = mapToStudentError(raw500, "extraction");
      expect(extractRes.message).toBe(
        "Something went wrong while processing your material. Please try again shortly."
      );

      const practiceRes = mapToStudentError(raw500, "practice");
      expect(practiceRes.message).toBe(
        "Live transcription is temporarily unavailable. You can try starting your practice again."
      );

      const auditRes = mapToStudentError(raw500, "evaluation");
      expect(auditRes.message).toBe(
        "We couldn't finish evaluating your answer. Your saved response is safe. Please try again."
      );
    });

    it("falls back to a polite default when error message is unknown", () => {
      const unknownMsg = getStudentFriendlyErrorMessage(
        new Error("Unexpected internal state")
      );
      expect(unknownMsg).toBe(
        "We couldn't complete that action. Please try again."
      );
    });
  });

  describe("Absence of Prohibited Technical Jargon in All Generated Messages", () => {
    const PROHIBITED_WORDS = [
      "api",
      "http",
      "status code",
      "sse",
      "websocket",
      "redis",
      "provider",
      "token accounting",
      "rate limiting",
      "payload",
      "server error",
      "internal processing",
      "stack trace",
      "database operation",
    ];

    const testErrors = [
      "NotAllowedError",
      "NotFoundError",
      "ECONNREFUSED",
      "TimeoutError",
      "429 rate limit exceeded",
      "budget_exhausted",
      "infrastructure_unavailable",
      "Unsupported PDF",
      "missing_question",
      "missing_answer",
      "HTTP 500 Provider internal server error",
      "Cannot resolve selected Paragraph",
      "random unhandled exception",
    ];

    it("ensures zero prohibited technical terms in mapped student error messages", () => {
      for (const raw of testErrors) {
        for (const ctx of [
          "extraction",
          "practice",
          "evaluation",
          "general",
        ] as const) {
          const res = mapToStudentError(raw, ctx);
          const msgLower = res.message.toLowerCase();

          for (const term of PROHIBITED_WORDS) {
            expect(msgLower).not.toContain(term);
          }
        }
      }
    });
  });
});
