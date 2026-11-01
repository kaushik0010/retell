import { formatFileSize } from "./index";

/**
 * Upload Payload Budget & Vercel Request Body Protection.
 *
 * Vercel Serverless Functions enforce a strict, unconfigurable 4.5 MB request body limit.
 * Requests exceeding 4.5 MB are rejected immediately at the edge with HTTP 413.
 *
 * To ensure safe execution, Retell implements a conservative client-side ceiling of 3.5 MB,
 * accounting for multipart/form-data boundary overhead, header frames, and form fields.
 */

export const VERCEL_MAX_PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024; // 4.5 MB hard Vercel ceiling
export const CLIENT_UPLOAD_BUDGET_BYTES = 3.5 * 1024 * 1024; // 3.5 MB safe client budget

export const ESTIMATED_MULTIPART_PER_FILE_OVERHEAD = 1024; // 1 KB per file part (Content-Disposition, MIME, boundaries)
export const ESTIMATED_MULTIPART_BASE_OVERHEAD = 2048; // 2 KB for form boundaries and closure frames

export interface PayloadBudgetAssessment {
  /** True if total payload is within the safe 3.5 MB budget */
  withinBudget: boolean;
  /** Sum of raw file bytes */
  totalFileBytes: number;
  /** Estimated total multipart HTTP request body size in bytes */
  totalPayloadBytes: number;
  /** Permitted upload budget in bytes */
  budgetBytes: number;
  /** Formatted raw file size (e.g. "2.8 MB") */
  totalFormatted: string;
  /** Formatted total HTTP payload size (e.g. "2.8 MB") */
  payloadFormatted: string;
  /** Formatted budget limit (e.g. "3.5 MB") */
  budgetFormatted: string;
  /** Number of bytes exceeding budget, or 0 if within budget */
  excessBytes: number;
  /** Formatted excess bytes */
  excessFormatted: string;
  /** Student-friendly warning message if budget is exceeded */
  warning?: string;
  /** Actionable guidance on what the student can do to resolve the issue */
  actionGuidance?: string;
}

/**
 * Calculates the conservative estimated byte size of a multipart/form-data request.
 */
export function calculateMultipartPayloadSize(
  files: Array<{ size: number }>,
  extraFields?: Record<string, string | undefined>
): number {
  let size = ESTIMATED_MULTIPART_BASE_OVERHEAD;

  for (const file of files) {
    size += file.size + ESTIMATED_MULTIPART_PER_FILE_OVERHEAD;
  }

  if (extraFields) {
    for (const [key, val] of Object.entries(extraFields)) {
      if (val) {
        // Field boundary, name, CRLF, and utf-8 string bytes
        const valBytes =
          typeof Blob !== "undefined" ? new Blob([val]).size : val.length;
        size += key.length + valBytes + 256;
      }
    }
  }

  return size;
}

/**
 * Assesses an array of staged/optimized upload files against the upload payload budget.
 */
export function assessUploadPayloadBudget(
  files: Array<{ name?: string; size: number }>,
  budgetBytes: number = CLIENT_UPLOAD_BUDGET_BYTES,
  extraFields?: Record<string, string | undefined>
): PayloadBudgetAssessment {
  const totalFileBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const totalPayloadBytes = calculateMultipartPayloadSize(files, extraFields);
  const withinBudget = totalPayloadBytes <= budgetBytes;
  const excessBytes = Math.max(0, totalPayloadBytes - budgetBytes);

  const totalFormatted = formatFileSize(totalFileBytes);
  const payloadFormatted = formatFileSize(totalPayloadBytes);
  const budgetFormatted = formatFileSize(budgetBytes);
  const excessFormatted = formatFileSize(excessBytes);

  let warning: string | undefined;
  let actionGuidance: string | undefined;

  if (!withinBudget) {
    warning = `Selected upload payload (${payloadFormatted}) exceeds the ${budgetFormatted} safe upload limit.`;
    actionGuidance =
      "To ensure reliable analysis on Vercel, please select fewer pages (e.g. 3–5 pages at a time) or remove unnecessary photos.";
  }

  return {
    withinBudget,
    totalFileBytes,
    totalPayloadBytes,
    budgetBytes,
    totalFormatted,
    payloadFormatted,
    budgetFormatted,
    excessBytes,
    excessFormatted,
    warning,
    actionGuidance,
  };
}
