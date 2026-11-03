/**
 * Student-Friendly Error Mapping & Classification Utility
 *
 * Translates raw exceptions, HTTP errors, network failures, and internal provider
 * codes into clear, reassuring, and actionable messages suitable for students.
 * Never exposes API keys, Redis details, HTTP status codes, or raw stack traces.
 */

export type ErrorContext = "extraction" | "practice" | "evaluation" | "general";

export type StudentErrorCategory =
  | "permission"
  | "device"
  | "network"
  | "rate_limit"
  | "budget"
  | "file_validation"
  | "content_structure"
  | "application"
  | "unknown";

export interface StudentFriendlyError {
  /** User-facing message written in encouraging, non-technical student language */
  message: string;
  /** Suggested recovery action label (e.g. "Try again", "Allow microphone access") */
  actionLabel?: string;
  /** Whether the user can resolve the issue themselves */
  userActionable: boolean;
  /** Internal classification for structured logging and UI indicators */
  category: StudentErrorCategory;
}

/**
 * Maps any raw error into a structured student-friendly representation.
 */
export function mapToStudentError(
  error: unknown,
  context: ErrorContext = "general"
): StudentFriendlyError {
  const rawMsg =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "error" in error
          ? String((error as { error: unknown }).error)
          : "";

  const lower = rawMsg.toLowerCase();

  // 1. Microphone Permission Denied
  if (
    lower.includes("notallowederror") ||
    lower.includes("permission denied") ||
    lower.includes("permissiondismissederror") ||
    (lower.includes("microphone") && lower.includes("permission"))
  ) {
    return {
      message:
        "Microphone access is blocked. Allow microphone access in your browser settings and try again.",
      actionLabel: "Allow microphone access",
      userActionable: true,
      category: "permission",
    };
  }

  // 2. Microphone Hardware Unavailable
  if (
    lower.includes("notfounderror") ||
    lower.includes("devicesnotfounderror") ||
    lower.includes("no microphone detected") ||
    (lower.includes("microphone") && lower.includes("unavailable"))
  ) {
    return {
      message:
        "We couldn't find a working microphone. Check your device and try again.",
      actionLabel: "Check device",
      userActionable: true,
      category: "device",
    };
  }

  // 3. Active Recording Conflict
  if (
    lower.includes("active spoken recording in progress") ||
    lower.includes("active recording") ||
    lower.includes("single session per device")
  ) {
    return {
      message:
        "You already have a practice recording in progress. Please finish or cancel it first.",
      actionLabel: "Finish current practice",
      userActionable: true,
      category: "application",
    };
  }

  // 4. Rate Limiting / Rapid Attempts
  if (
    lower.includes("too quickly") ||
    lower.includes("429") ||
    lower.includes("rate_limit") ||
    lower.includes("rate limit") ||
    lower.includes("quota exceeded")
  ) {
    return {
      message:
        "You've made several attempts in a short time. Please wait a little and try again.",
      actionLabel: "Try again shortly",
      userActionable: false,
      category: "rate_limit",
    };
  }

  // 5. Daily AI Budget Exhausted
  if (
    lower.includes("budget_exhausted") ||
    lower.includes("daily budget") ||
    lower.includes("daily spending cap")
  ) {
    return {
      message:
        "Retell has reached its daily practice capacity. Please check back tomorrow or try again later.",
      actionLabel: "Return to Library",
      userActionable: false,
      category: "budget",
    };
  }

  // 6. Infrastructure or Service Temporarily Offline
  if (
    lower.includes("infrastructure_unavailable") ||
    lower.includes("temporarily unable to process") ||
    lower.includes("redis")
  ) {
    return {
      message:
        "Retell is temporarily unable to process new requests. Please try again in a few moments.",
      actionLabel: "Try again shortly",
      userActionable: false,
      category: "application",
    };
  }

  // 7. Network Disconnections & Fetch Failures
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("offline") ||
    lower.includes("internet disconnected")
  ) {
    return {
      message:
        "Your internet connection appears to be unavailable. Reconnect and try again.",
      actionLabel: "Check connection",
      userActionable: true,
      category: "network",
    };
  }

  // 8. Timeouts
  if (
    lower.includes("timeouterror") ||
    lower.includes("timed out") ||
    lower.includes("timeout")
  ) {
    return {
      message: "Your connection took too long. Please try again.",
      actionLabel: "Try again",
      userActionable: true,
      category: "network",
    };
  }

  // 9. Unsupported File Types
  if (
    lower.includes("unsupported") &&
    (lower.includes("format") ||
      lower.includes("file") ||
      lower.includes("pdf"))
  ) {
    return {
      message:
        "This file type isn't supported. Please upload an image (PNG, JPEG, WebP) or PDF.",
      actionLabel: "Choose another file",
      userActionable: true,
      category: "file_validation",
    };
  }

  // 10. File Size / Upload Budget Excess
  if (
    lower.includes("too large") ||
    lower.includes("exceeds") ||
    lower.includes("413") ||
    lower.includes("payload")
  ) {
    return {
      message:
        "This file is too large. Try choosing a smaller file or fewer pages.",
      actionLabel: "Select smaller file",
      userActionable: true,
      category: "file_validation",
    };
  }

  // 11. Corrupted PDF
  if (
    lower.includes("pdf") &&
    (lower.includes("corrupt") ||
      lower.includes("couldn't read") ||
      lower.includes("could not read") ||
      lower.includes("failed to read"))
  ) {
    return {
      message: "We couldn't read this PDF. Try another copy of the file.",
      actionLabel: "Upload another copy",
      userActionable: true,
      category: "file_validation",
    };
  }

  // 12. Missing Questions or Reference Answers
  if (
    lower.includes("missing question") ||
    lower.includes("missing_question") ||
    lower.includes("empty question prompt")
  ) {
    return {
      message:
        "We couldn't find both a question and its answer. Please check your material.",
      actionLabel: "Check your material",
      userActionable: true,
      category: "content_structure",
    };
  }

  if (
    lower.includes("missing answer") ||
    lower.includes("missing_answer") ||
    lower.includes("empty reference answer")
  ) {
    return {
      message:
        "We couldn't find an answer in your material. Please paste or upload the answer you want to study.",
      actionLabel: "Add answer",
      userActionable: true,
      category: "content_structure",
    };
  }

  // 13. Paragraph Scope Resolution Defect
  if (lower.includes("cannot resolve selected paragraph")) {
    return {
      message:
        "We couldn't match this paragraph from your reference answer. Try practising the whole answer instead.",
      actionLabel: "Practise whole answer",
      userActionable: true,
      category: "content_structure",
    };
  }

  // 14. Provider / Server / HTTP 500 Failures
  if (
    lower.includes("500") ||
    lower.includes("502") ||
    lower.includes("authentication_error") ||
    lower.includes("model_unavailable") ||
    lower.includes("internal server error") ||
    lower.includes("upstream request failed") ||
    lower.includes("provider internal") ||
    lower.includes("api key")
  ) {
    if (context === "extraction") {
      return {
        message:
          "Something went wrong while processing your material. Please try again shortly.",
        actionLabel: "Try again",
        userActionable: false,
        category: "application",
      };
    }
    if (context === "practice") {
      return {
        message:
          "Live transcription is temporarily unavailable. You can try starting your practice again.",
        actionLabel: "Try again",
        userActionable: false,
        category: "application",
      };
    }
    if (context === "evaluation") {
      return {
        message:
          "We couldn't finish evaluating your answer. Your saved response is safe. Please try again.",
        actionLabel: "Retry evaluation",
        userActionable: false,
        category: "application",
      };
    }
    return {
      message: "Something went wrong on our side. Please try again shortly.",
      actionLabel: "Try again",
      userActionable: false,
      category: "application",
    };
  }

  // 15. Context-specific fallback for unspecified messages
  if (context === "practice") {
    return {
      message:
        "Live transcription was interrupted. You can try starting your practice again.",
      actionLabel: "Try again",
      userActionable: false,
      category: "application",
    };
  }
  if (context === "evaluation") {
    return {
      message:
        "We couldn't finish evaluating your answer. Your saved response is safe. Please try again.",
      actionLabel: "Retry evaluation",
      userActionable: false,
      category: "application",
    };
  }
  if (context === "extraction") {
    return {
      message:
        "Something went wrong while processing your material. Please try again.",
      actionLabel: "Try again",
      userActionable: false,
      category: "application",
    };
  }

  // 16. General Fallback
  return {
    message: "We couldn't complete that action. Please try again.",
    actionLabel: "Try again",
    userActionable: false,
    category: "unknown",
  };
}

/**
 * Convenience helper returning only the student-friendly message string.
 */
export function getStudentFriendlyErrorMessage(
  error: unknown,
  context: ErrorContext = "general"
): string {
  return mapToStudentError(error, context).message;
}
