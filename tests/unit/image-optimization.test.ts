import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isOptimizableImage,
  optimizeSingleImage,
  optimizeImageBatch,
  DEFAULT_OPTIMIZATION_CONFIG,
} from "../../src/lib/files/image-optimizer";
import {
  calculateMultipartPayloadSize,
  assessUploadPayloadBudget,
  CLIENT_UPLOAD_BUDGET_BYTES,
  VERCEL_MAX_PAYLOAD_LIMIT_BYTES,
  ESTIMATED_MULTIPART_BASE_OVERHEAD,
  ESTIMATED_MULTIPART_PER_FILE_OVERHEAD,
} from "../../src/lib/files/payload-budget";
import imageCompression from "browser-image-compression";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(),
}));

describe("Image Optimization & Safe Upload Payload Limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isOptimizableImage", () => {
    it("recognizes standard compressible image MIME types", () => {
      const jpegFile = new File([new Uint8Array(10)], "photo.jpg", {
        type: "image/jpeg",
      });
      const pngFile = new File([new Uint8Array(10)], "diagram.png", {
        type: "image/png",
      });
      const webpFile = new File([new Uint8Array(10)], "notes.webp", {
        type: "image/webp",
      });

      expect(isOptimizableImage(jpegFile)).toBe(true);
      expect(isOptimizableImage(pngFile)).toBe(true);
      expect(isOptimizableImage(webpFile)).toBe(true);
    });

    it("rejects non-image files such as PDF and text files", () => {
      const pdfFile = new File([new Uint8Array(10)], "notes.pdf", {
        type: "application/pdf",
      });
      const txtFile = new File([new Uint8Array(10)], "readme.txt", {
        type: "text/plain",
      });
      const noTypeFile = new File([new Uint8Array(10)], "unknown");

      expect(isOptimizableImage(pdfFile)).toBe(false);
      expect(isOptimizableImage(txtFile)).toBe(false);
      expect(isOptimizableImage(noTypeFile)).toBe(false);
    });
  });

  describe("optimizeSingleImage", () => {
    it("skips compression for images already below minCompressibleSizeBytes (200 KB)", async () => {
      // 100 KB file
      const smallBytes = new Uint8Array(100 * 1024);
      const smallFile = new File([smallBytes], "already-small.jpg", {
        type: "image/jpeg",
      });

      const result = await optimizeSingleImage(smallFile);

      expect(imageCompression).not.toHaveBeenCalled();
      expect(result.wasOptimized).toBe(false);
      expect(result.isFallback).toBe(false);
      expect(result.file).toBe(smallFile);
      expect(result.note).toContain("Already optimal");
    });

    it("optimizes large images using Web Worker and legibility-focused settings", async () => {
      // 1.5 MB file
      const largeBytes = new Uint8Array(1500 * 1024);
      const largeFile = new File([largeBytes], "handwritten-notes.jpg", {
        type: "image/jpeg",
      });

      // Mock successful compression returning 600 KB file
      const compressedBytes = new Uint8Array(600 * 1024);
      const compressedFile = new File(
        [compressedBytes],
        "handwritten-notes.jpg",
        {
          type: "image/jpeg",
        }
      );
      vi.mocked(imageCompression).mockResolvedValueOnce(compressedFile);

      const result = await optimizeSingleImage(largeFile);

      expect(imageCompression).toHaveBeenCalledTimes(1);
      const [passedFile, options] = vi.mocked(imageCompression).mock.calls[0]!;
      expect(passedFile).toBe(largeFile);
      expect(options.useWebWorker).toBe(true);
      expect(options.maxSizeMB).toBe(DEFAULT_OPTIMIZATION_CONFIG.maxSizeMB);
      expect(options.maxWidthOrHeight).toBe(
        DEFAULT_OPTIMIZATION_CONFIG.maxWidthOrHeight
      );
      expect(options.initialQuality).toBe(
        DEFAULT_OPTIMIZATION_CONFIG.initialQuality
      );
      expect(options.fileType).toBe("image/jpeg");

      expect(result.wasOptimized).toBe(true);
      expect(result.isFallback).toBe(false);
      expect(result.file.name).toBe(largeFile.name);
      expect(result.file.size).toBe(compressedFile.size);
      expect(result.file.type).toBe("image/jpeg");
      expect(result.originalFile).toBe(largeFile);
      expect(result.note).toContain("saved");
    });

    it("preserves PNG format for diagrams to avoid black canvas transparency artifacts", async () => {
      const pngBytes = new Uint8Array(1200 * 1024);
      const pngFile = new File([pngBytes], "architecture-diagram.png", {
        type: "image/png",
      });

      const compressedFile = new File(
        [new Uint8Array(500 * 1024)],
        "architecture-diagram.png",
        { type: "image/png" }
      );
      vi.mocked(imageCompression).mockResolvedValueOnce(compressedFile);

      const result = await optimizeSingleImage(pngFile);

      expect(imageCompression).toHaveBeenCalledTimes(1);
      const [, options] = vi.mocked(imageCompression).mock.calls[0]!;
      expect(options.fileType).toBe("image/png");
      expect(result.file.type).toBe("image/png");
    });

    it("discards compressed output if larger than the original image", async () => {
      const originalBytes = new Uint8Array(300 * 1024);
      const originalFile = new File([originalBytes], "diagram.png", {
        type: "image/png",
      });

      // Simulate compressed output that expanded to 350 KB
      const largerFile = new File([new Uint8Array(350 * 1024)], "diagram.png", {
        type: "image/png",
      });
      vi.mocked(imageCompression).mockResolvedValueOnce(largerFile);

      const result = await optimizeSingleImage(originalFile);

      expect(result.wasOptimized).toBe(false);
      expect(result.file).toBe(originalFile);
      expect(result.note).toContain("Original retained");
    });

    it("falls back gracefully to original file if compression throws an error", async () => {
      const largeBytes = new Uint8Array(1000 * 1024);
      const originalFile = new File([largeBytes], "corrupted.jpg", {
        type: "image/jpeg",
      });

      vi.mocked(imageCompression).mockRejectedValueOnce(
        new Error("Canvas WebGL context lost")
      );

      const result = await optimizeSingleImage(originalFile);

      expect(result.wasOptimized).toBe(false);
      expect(result.isFallback).toBe(true);
      expect(result.file).toBe(originalFile);
      expect(result.error).toContain("Canvas WebGL context lost");
      expect(result.note).toContain("Original retained");
    });
  });

  describe("optimizeImageBatch", () => {
    it("preserves exact page order across sequential batch optimizations", async () => {
      const file1 = new File([new Uint8Array(500 * 1024)], "page1.jpg", {
        type: "image/jpeg",
      });
      const file2 = new File([new Uint8Array(600 * 1024)], "page2.jpg", {
        type: "image/jpeg",
      });
      const file3 = new File([new Uint8Array(700 * 1024)], "page3.jpg", {
        type: "image/jpeg",
      });

      vi.mocked(imageCompression)
        .mockResolvedValueOnce(
          new File([new Uint8Array(200 * 1024)], "page1.jpg", {
            type: "image/jpeg",
          })
        )
        .mockResolvedValueOnce(
          new File([new Uint8Array(250 * 1024)], "page2.jpg", {
            type: "image/jpeg",
          })
        )
        .mockResolvedValueOnce(
          new File([new Uint8Array(300 * 1024)], "page3.jpg", {
            type: "image/jpeg",
          })
        );

      const batchResults = await optimizeImageBatch([file1, file2, file3]);

      expect(batchResults).toHaveLength(3);
      expect(batchResults[0]!.file.name).toBe("page1.jpg");
      expect(batchResults[1]!.file.name).toBe("page2.jpg");
      expect(batchResults[2]!.file.name).toBe("page3.jpg");
      expect(batchResults[0]!.wasOptimized).toBe(true);
      expect(batchResults[1]!.wasOptimized).toBe(true);
      expect(batchResults[2]!.wasOptimized).toBe(true);
    });
  });

  describe("Payload Budget & Multipart Calculation", () => {
    it("correctly estimates multipart form overhead for multiple files and fields", () => {
      const files = [{ size: 1000 }, { size: 2000 }, { size: 3000 }];
      const extraFields = { title: "Software Engineering Unit 2" };

      const estimated = calculateMultipartPayloadSize(files, extraFields);

      // Base overhead (2048) + file raw sum (6000) + per-file overhead (3 * 1024) + title field overhead
      const expectedMin =
        ESTIMATED_MULTIPART_BASE_OVERHEAD +
        6000 +
        3 * ESTIMATED_MULTIPART_PER_FILE_OVERHEAD;
      expect(estimated).toBeGreaterThan(expectedMin);
    });

    it("assesses upload within 3.5 MB budget accurately", () => {
      // 2 files totaling ~1.8 MB
      const files = [
        { name: "page1.jpg", size: 900 * 1024 },
        { name: "page2.jpg", size: 900 * 1024 },
      ];

      const assessment = assessUploadPayloadBudget(
        files,
        CLIENT_UPLOAD_BUDGET_BYTES,
        { title: "Exam Prep" }
      );

      expect(assessment.withinBudget).toBe(true);
      expect(assessment.excessBytes).toBe(0);
      expect(assessment.warning).toBeUndefined();
      expect(assessment.actionGuidance).toBeUndefined();
      expect(assessment.totalFileBytes).toBe(1800 * 1024);
      expect(assessment.budgetBytes).toBe(CLIENT_UPLOAD_BUDGET_BYTES);
    });

    it("warns and provides student guidance when exceeding 3.5 MB budget", () => {
      // 4 large uncompressed images totaling 3.8 MB raw
      const files = [
        { name: "page1.jpg", size: 1000 * 1024 },
        { name: "page2.jpg", size: 1000 * 1024 },
        { name: "page3.jpg", size: 1000 * 1024 },
        { name: "page4.jpg", size: 1000 * 1024 },
      ];

      const assessment = assessUploadPayloadBudget(
        files,
        CLIENT_UPLOAD_BUDGET_BYTES,
        { title: "Big Set" }
      );

      expect(assessment.withinBudget).toBe(false);
      expect(assessment.excessBytes).toBeGreaterThan(0);
      expect(assessment.warning).toBeDefined();
      expect(assessment.warning).toContain("too large to add together");
      expect(assessment.actionGuidance).toContain("fewer pages");
      expect(assessment.totalPayloadBytes).toBeLessThan(
        VERCEL_MAX_PAYLOAD_LIMIT_BYTES // Confirms 3.5 MB safety ceiling triggers well before Vercel 4.5 MB hard limit
      );
    });
  });
});
