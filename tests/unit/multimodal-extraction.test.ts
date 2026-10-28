import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../src/app/api/extract/route";
import * as providersModule from "../../src/lib/providers";
import {
  detectMimeTypeFromBuffer,
  getPdfPageCount,
  validateStudyFile,
  formatFileSize,
  MAX_FILE_SIZE_BYTES,
  MAX_PDF_PAGES,
} from "../../src/lib/files";

describe("Multimodal Ingestion & File Validation (Phase 1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("File Format & Magic Byte Detection", () => {
    it("exports standard file limits", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(20 * 1024 * 1024);
      expect(MAX_PDF_PAGES).toBe(50);
    });

    it("detects PDF from %PDF- magic bytes", () => {
      const pdfBuffer = Buffer.from("%PDF-1.5\n%Header test content");
      const detected = detectMimeTypeFromBuffer(pdfBuffer);
      expect(detected.type).toBe("pdf");
      expect(detected.mime).toBe("application/pdf");
      expect(detected.extension).toBe("pdf");
    });

    it("detects JPEG from 0xFFD8FF magic bytes", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const detected = detectMimeTypeFromBuffer(jpegBuffer);
      expect(detected.type).toBe("image");
      expect(detected.mime).toBe("image/jpeg");
      expect(detected.extension).toBe("jpg");
    });

    it("detects PNG from 0x89504E47 magic bytes", () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const detected = detectMimeTypeFromBuffer(pngBuffer);
      expect(detected.type).toBe("image");
      expect(detected.mime).toBe("image/png");
      expect(detected.extension).toBe("png");
    });

    it("detects WebP from RIFF...WEBP magic bytes", () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      const detected = detectMimeTypeFromBuffer(webpBuffer);
      expect(detected.type).toBe("image");
      expect(detected.mime).toBe("image/webp");
      expect(detected.extension).toBe("webp");
    });

    it("rejects unknown or binary stream formats as unknown", () => {
      const randomBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44]);
      const detected = detectMimeTypeFromBuffer(randomBuffer);
      expect(detected.type).toBe("unknown");
    });
  });

  describe("PDF Page Count Extraction", () => {
    it("extracts page count from /Count in /Pages dictionary", () => {
      const pdfContent =
        "%PDF-1.4\n1 0 obj\n<< /Type /Pages /Count 8 /Kids [...] >>\nendobj";
      const count = getPdfPageCount(Buffer.from(pdfContent));
      expect(count).toBe(8);
    });

    it("falls back to counting /Type /Page objects when /Count is absent", () => {
      const pdfContent =
        "%PDF-1.4\n<< /Type /Page >>\n<< /Type /Page >>\n<< /Type /Page >>";
      const count = getPdfPageCount(Buffer.from(pdfContent));
      expect(count).toBe(3);
    });
  });

  describe("File Validation & Guardrails", () => {
    it("rejects empty (0 byte) files with student-friendly message", () => {
      const res = validateStudyFile(Buffer.alloc(0), "empty_notes.pdf");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("empty");
    });

    it("rejects files exceeding 20 MB with clear size explanation", () => {
      const bigBuffer = Buffer.alloc(21 * 1024 * 1024);
      const res = validateStudyFile(bigBuffer, "huge_textbook.pdf");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("exceeds the 20 MB size limit");
    });

    it("rejects corrupt or unsupported files", () => {
      const corruptBuffer = Buffer.from("random text pretending to be a pdf");
      const res = validateStudyFile(corruptBuffer, "fake.pdf");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("not a supported file format");
    });

    it("rejects PDFs exceeding the maximum 50-page limit for visual understanding", () => {
      const longPdf = "%PDF-1.4\n<< /Type /Pages /Count 72 >>";
      const res = validateStudyFile(Buffer.from(longPdf), "long_handbook.pdf");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("72 pages");
      expect(res.error).toContain("50-page limit");
    });

    it("accepts valid PDFs and reports page count", () => {
      const validPdf = "%PDF-1.4\n<< /Type /Pages /Count 10 >>";
      const res = validateStudyFile(
        Buffer.from(validPdf),
        "operating_systems.pdf"
      );
      expect(res.valid).toBe(true);
      expect(res.type).toBe("pdf");
      expect(res.pageCount).toBe(10);
    });
  });

  describe("Human-Readable File Sizing", () => {
    it("formats bytes, KB, and MB accurately", () => {
      expect(formatFileSize(500)).toBe("500 B");
      expect(formatFileSize(108 * 1024)).toBe("108 KB");
      expect(formatFileSize(3.77 * 1024 * 1024)).toBe("3.8 MB");
    });
  });

  describe("POST /api/extract with Multipart File Uploads", () => {
    it("returns 400 when multipart request contains no files", async () => {
      const formData = new FormData();
      formData.append("title", "Empty Upload");

      const req = new NextRequest("http://localhost:3000/api/extract", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("No valid file was provided");
    });

    it("returns 400 when uploaded file fails magic-byte validation", async () => {
      const formData = new FormData();
      const fakePdf = new File(["not a pdf"], "notes.pdf", {
        type: "application/pdf",
      });
      formData.append("file", fakePdf);

      const req = new NextRequest("http://localhost:3000/api/extract", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain("not a supported file format");
    });

    it("extracts questions and answers from a valid PDF upload using multimodal reasoning", async () => {
      const mockLLMOutput = {
        status: "found_qa",
        suggestedTitle: "Operating Systems: Page Replacement",
        questions: [
          {
            question:
              "Explain the FIFO page replacement algorithm and Belady's anomaly.",
            referenceAnswer:
              "FIFO replaces the oldest page in memory. Belady's anomaly shows that giving more page frames can paradoxically increase page faults.",
            sourceExcerpt: "FIFO is simple but suffers from Belady's anomaly.",
            pageNumber: 1,
            isUncertain: false,
          },
        ],
      };

      vi.spyOn(providersModule, "getReasoningProvider").mockReturnValue({
        id: "meta",
        modelId: "muse-spark-1.3",
        isConfigured: () => true,
        generateStructured: vi.fn().mockResolvedValue({
          success: true,
          provider: "meta",
          model: "muse-spark-1.3",
          rawContent: JSON.stringify(mockLLMOutput),
          data: mockLLMOutput,
          latencyMs: 1400,
        }),
        checkHealth: vi.fn(),
      });

      const validPdfBytes = new Uint8Array([
        0x25,
        0x50,
        0x44,
        0x46,
        0x2d,
        0x31,
        0x2e,
        0x35, // %PDF-1.5
        0x0a,
        0x2f,
        0x54,
        0x79,
        0x70,
        0x65,
        0x20,
        0x2f,
        0x50,
        0x61,
        0x67,
        0x65,
        0x73,
        0x20,
        0x2f,
        0x43,
        0x6f,
        0x75,
        0x6e,
        0x74,
        0x20,
        0x32,
      ]);
      const pdfFile = new File([validPdfBytes], "OS_Unit1.pdf", {
        type: "application/pdf",
      });

      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("title", "OS Exam Notes");

      const req = new NextRequest("http://localhost:3000/api/extract", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.status).toBe("found_qa");
      expect(data.studyMaterial.sourceType).toBe("pdf");
      expect(data.studyMaterial.fileName).toBe("OS_Unit1.pdf");
      expect(data.questions).toHaveLength(1);
      expect(data.questions[0].question).toContain("FIFO page replacement");
      expect(data.questions[0].pageNumber).toBe(1);
    });

    it("extracts questions and answers from a scanned image upload", async () => {
      const mockLLMOutput = {
        status: "found_qa",
        suggestedTitle: "Software Engineering Definitions",
        questions: [
          {
            question: "Define the terms: i) Software ii) Software Engineering.",
            referenceAnswer:
              "Software is instructions that operate computers. Software Engineering is the systematic process of designing and maintaining software.",
            sourceExcerpt:
              "Software is instructions... Software Engineering is systematic...",
            pageNumber: 1,
            isUncertain: false,
          },
        ],
      };

      vi.spyOn(providersModule, "getReasoningProvider").mockReturnValue({
        id: "meta",
        modelId: "muse-spark-1.3",
        isConfigured: () => true,
        generateStructured: vi.fn().mockResolvedValue({
          success: true,
          provider: "meta",
          model: "muse-spark-1.3",
          rawContent: JSON.stringify(mockLLMOutput),
          data: mockLLMOutput,
          latencyMs: 800,
        }),
        checkHealth: vi.fn(),
      });

      // Valid JPEG header: 0xFF, 0xD8, 0xFF, 0xE0
      const validJpegBytes = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
      ]);
      const imgFile = new File([validJpegBytes], "scanned_notes.jpg", {
        type: "image/jpeg",
      });

      const formData = new FormData();
      formData.append("file", imgFile);

      const req = new NextRequest("http://localhost:3000/api/extract", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.studyMaterial.sourceType).toBe("image");
      expect(data.studyMaterial.fileName).toBe("scanned_notes.jpg");
      expect(data.questions[0].question).toContain("Software Engineering");
    });

    it("handles missing question prompt in uploaded notes gracefully", async () => {
      const mockLLMOutput = {
        status: "missing_question",
        guidanceMessage:
          "We found your study notes, but couldn't find your exam questions.",
        detectedContent:
          "Notes explaining TCP 3-way handshake and SYN/ACK flags.",
        suggestedTitle: "Computer Networks: TCP Handshake",
        questions: [],
      };

      vi.spyOn(providersModule, "getReasoningProvider").mockReturnValue({
        id: "meta",
        modelId: "muse-spark-1.3",
        isConfigured: () => true,
        generateStructured: vi.fn().mockResolvedValue({
          success: true,
          provider: "meta",
          model: "muse-spark-1.3",
          rawContent: JSON.stringify(mockLLMOutput),
          data: mockLLMOutput,
          latencyMs: 900,
        }),
        checkHealth: vi.fn(),
      });

      const validPdfBytes = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
      ]);
      const pdfFile = new File([validPdfBytes], "tcp_notes.pdf", {
        type: "application/pdf",
      });

      const formData = new FormData();
      formData.append("file", pdfFile);

      const req = new NextRequest("http://localhost:3000/api/extract", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.status).toBe("missing_question");
      expect(data.detectedContent).toContain("TCP 3-way handshake");
      expect(data.questions).toHaveLength(0);
    });
  });
});
