/**
 * Server and client utilities for validating, inspecting, and formatting study material files (PDFs and Images).
 */

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB (safe client & server ceiling)
export const MAX_PDF_PAGES = 50; // Meta vision limit for per-request page visual understanding

export interface ValidatedFileResult {
  valid: boolean;
  error?: string;
  mimeType: string;
  type: "pdf" | "image" | "unknown";
  extension: string;
  pageCount?: number;
}

/**
 * Inspect magic bytes / file signatures to detect actual file type rather than trusting browser MIME.
 */
export function detectMimeTypeFromBuffer(buffer: Uint8Array | Buffer): {
  mime: string;
  extension: string;
  type: "pdf" | "image" | "unknown";
} {
  if (buffer.length >= 4) {
    // PDF: %PDF (0x25 0x50 0x44 0x46)
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return { mime: "application/pdf", extension: "pdf", type: "pdf" };
    }

    // JPEG: 0xFF 0xD8 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: "image/jpeg", extension: "jpg", type: "image" };
    }

    // PNG: 0x89 0x50 0x4E 0x47
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return { mime: "image/png", extension: "png", type: "image" };
    }

    // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { mime: "image/webp", extension: "webp", type: "image" };
    }
  }

  return {
    mime: "application/octet-stream",
    extension: "bin",
    type: "unknown",
  };
}

/**
 * Fast regex-based PDF page count extractor from buffer.
 */
export function getPdfPageCount(buffer: Uint8Array | Buffer): number {
  try {
    let str = "";
    if (typeof Buffer !== "undefined") {
      str = Buffer.from(buffer).toString("latin1");
    } else if (typeof TextDecoder !== "undefined") {
      str = new TextDecoder("latin1").decode(buffer);
    } else {
      str = String.fromCharCode(...buffer.subarray(0, 50000));
    }
    // Check /Count inside /Type /Pages
    const countMatch = str.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/);
    if (countMatch && countMatch[1]) {
      const parsed = parseInt(countMatch[1], 10);
      if (parsed > 0) return parsed;
    }
    // Fallback: count /Type /Page
    const matches = str.match(/\/Type\s*\/Page\b/g);
    return matches ? matches.length : 1;
  } catch {
    return 1;
  }
}

/**
 * Validates file buffer, file size, format signatures, and page limits.
 */
export function validateStudyFile(
  buffer: Uint8Array | Buffer,
  originalName: string,
  maxBytes: number = MAX_FILE_SIZE_BYTES
): ValidatedFileResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: `"${originalName}" is empty. Please select a valid document or image.`,
      mimeType: "application/octet-stream",
      type: "unknown",
      extension: "",
    };
  }

  if (buffer.length > maxBytes) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(1);
    const limitMb = (maxBytes / (1024 * 1024)).toFixed(0);
    return {
      valid: false,
      error: `"${originalName}" (${sizeMb} MB) exceeds the ${limitMb} MB size limit. Please upload a smaller file or chapter.`,
      mimeType: "application/octet-stream",
      type: "unknown",
      extension: "",
    };
  }

  const detected = detectMimeTypeFromBuffer(buffer);

  if (detected.type === "unknown") {
    return {
      valid: false,
      error: `"${originalName}" is not a supported file format. Please upload a PDF, JPG, or PNG.`,
      mimeType: detected.mime,
      type: "unknown",
      extension: detected.extension,
    };
  }

  let pageCount: number | undefined;
  if (detected.type === "pdf") {
    pageCount = getPdfPageCount(buffer);
    if (pageCount > MAX_PDF_PAGES) {
      return {
        valid: false,
        error: `"${originalName}" contains ${pageCount} pages, which exceeds the ${MAX_PDF_PAGES}-page limit for visual analysis. Please upload an assignment or chapter under 50 pages.`,
        mimeType: detected.mime,
        type: detected.type,
        extension: detected.extension,
        pageCount,
      };
    }
  }

  return {
    valid: true,
    mimeType: detected.mime,
    type: detected.type,
    extension: detected.extension,
    pageCount,
  };
}

/**
 * Format bytes into human-readable string (e.g. 1.2 MB, 450 KB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
