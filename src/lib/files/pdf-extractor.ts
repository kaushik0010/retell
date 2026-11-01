/**
 * PDF Inspection and Text Extraction Engine for Retell
 *
 * Uses PDF.js to inspect PDF documents completely client-side.
 * Categorizes PDFs into:
 *  - text: structured digital documents with selectable text.
 *  - scanned: physical scans or image-only pages without selectable text.
 *  - hybrid: mixed pages with both text and drawings/diagrams.
 *
 * For text-based PDFs, extracts text with preserved page boundaries (--- Page X ---)
 * and paragraph line breaks, avoiding multi-megabyte binary payload uploads.
 */

export interface PdfPageSummary {
  pageNumber: number;
  text: string;
  characterCount: number;
  hasSelectableText: boolean;
}

export interface PdfInspectionResult {
  pageCount: number;
  classification: "text" | "scanned" | "hybrid";
  pages: PdfPageSummary[];
  aggregateText: string;
  totalCharacterCount: number;
}

/**
 * Dynamically resolves PDF.js runtime in browser and test/server environments.
 */
export async function getPdfJs() {
  if (typeof window !== "undefined") {
    const pdfjs = await import("pdfjs-dist");
    if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    return pdfjs;
  } else {
    // In Node.js / Vitest environments, use the legacy build to avoid DOM polyfill issues
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      return pdfjs;
    } catch {
      const pdfjs = await import("pdfjs-dist");
      return pdfjs;
    }
  }
}

/**
 * Extracts structured text from PDF.js TextItem arrays, preserving line and paragraph breaks.
 */
export function extractTextFromItems(items: unknown[]): string {
  const lines: string[] = [];
  let currentLine = "";
  let lastY: number | null = null;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object" || !("str" in rawItem))
      continue;
    const item = rawItem as {
      str: string;
      transform?: number[];
      hasEOL?: boolean;
    };
    const str = item.str;
    if (!str && !item.hasEOL) continue;

    const currentY =
      item.transform &&
      Array.isArray(item.transform) &&
      item.transform.length >= 6
        ? Math.round(item.transform[5] as number)
        : null;

    if (lastY !== null && currentY !== null) {
      const diff = Math.abs(currentY - lastY);
      if (diff > 20) {
        // Significant vertical leap -> Paragraph break
        if (currentLine.trim()) {
          lines.push(currentLine.trim(), "");
        }
        currentLine = "";
      } else if (diff > 8) {
        // Standard line break
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
        }
        currentLine = "";
      }
    }

    if (
      currentLine.length > 0 &&
      !currentLine.endsWith(" ") &&
      str &&
      !str.startsWith(" ")
    ) {
      currentLine += " ";
    }
    currentLine += str;

    if (item.hasEOL) {
      if (currentLine.trim()) {
        lines.push(currentLine.trim());
      }
      currentLine = "";
      lastY = null;
    } else {
      lastY = currentY;
    }
  }

  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  return lines.join("\n").trim();
}

/**
 * Inspects a PDF file or buffer and determines its structure, page count,
 * text contents, and whether it is text-based, scanned, or hybrid.
 */
export async function inspectPdf(
  input: File | Blob | ArrayBuffer | Uint8Array
): Promise<PdfInspectionResult> {
  const pdfjs = await getPdfJs();

  let data: Uint8Array;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
    data = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else if (input instanceof ArrayBuffer) {
    data = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    data = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else {
    const arrayBuf = await input.arrayBuffer();
    data = new Uint8Array(arrayBuf);
  }

  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const doc = await loadingTask.promise;
  const pageCount = doc.numPages;
  const pages: PdfPageSummary[] = [];

  let textPagesCount = 0;
  let totalCharacterCount = 0;

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const extracted = extractTextFromItems(content.items);
    const charCount = extracted.trim().length;
    // A page is considered to have selectable text if it contains at least 35 characters
    const hasSelectable = charCount >= 35;

    if (hasSelectable) {
      textPagesCount++;
    }
    totalCharacterCount += charCount;

    pages.push({
      pageNumber: i,
      text: extracted,
      characterCount: charCount,
      hasSelectableText: hasSelectable,
    });
  }

  let classification: "text" | "scanned" | "hybrid";
  if (pageCount === 0 || textPagesCount === 0) {
    classification = "scanned";
  } else if (
    textPagesCount === pageCount ||
    textPagesCount / pageCount >= 0.75
  ) {
    classification = "text";
  } else {
    classification = "hybrid";
  }

  const aggregateText =
    classification === "scanned"
      ? ""
      : pages
          .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
          .join("\n\n");

  await doc.destroy();

  return {
    pageCount,
    classification,
    pages,
    aggregateText,
    totalCharacterCount,
  };
}

/**
 * Renders a single PDF page onto a canvas and exports it as an image File.
 * Useful for processing scanned PDF pages client-side.
 */
export async function renderPdfPageToImageFile(
  input: File | Blob | ArrayBuffer | Uint8Array,
  pageNumber: number,
  options?: {
    scale?: number;
    fileName?: string;
    quality?: number;
  }
): Promise<File | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const pdfjs = await getPdfJs();
  let data: Uint8Array;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) {
    data = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else if (input instanceof ArrayBuffer) {
    data = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    data = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else {
    const arrayBuf = await input.arrayBuffer();
    data = new Uint8Array(arrayBuf);
  }

  const doc = await pdfjs.getDocument({ data }).promise;
  if (pageNumber < 1 || pageNumber > doc.numPages) {
    await doc.destroy();
    return null;
  }

  const page = await doc.getPage(pageNumber);
  const scale = options?.scale || 1.75;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    await doc.destroy();
    return null;
  }

  // White background for transparent pages
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  const quality = options?.quality ?? 0.88;
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );

  await doc.destroy();

  if (!blob) return null;

  const baseName = options?.fileName || "page";
  return new File([blob], `${baseName}-p${pageNumber}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
