import { describe, it, expect } from "vitest";
import {
  extractTextFromItems,
  inspectPdf,
  PdfInspectionResult,
} from "@/lib/files/pdf-extractor";
import { assessUploadPayloadBudget } from "@/lib/files/payload-budget";
import * as fs from "fs";
import * as path from "path";

describe("PDF Inspection, Extraction & Student UX", () => {
  describe("extractTextFromItems", () => {
    it("extracts and trims plain text items", () => {
      const items = [
        { str: "What", transform: [1, 0, 0, 1, 0, 100], hasEOL: false },
        { str: "is", transform: [1, 0, 0, 1, 40, 100], hasEOL: false },
        { str: "active", transform: [1, 0, 0, 1, 60, 100], hasEOL: false },
        { str: "recall?", transform: [1, 0, 0, 1, 100, 100], hasEOL: true },
      ];
      const result = extractTextFromItems(items);
      expect(result).toBe("What is active recall?");
    });

    it("preserves line breaks when hasEOL is true", () => {
      const items = [
        { str: "Question 1", transform: [1, 0, 0, 1, 0, 200], hasEOL: true },
        {
          str: "Explain DNS resolution.",
          transform: [1, 0, 0, 1, 0, 185],
          hasEOL: true,
        },
      ];
      const result = extractTextFromItems(items);
      expect(result).toBe("Question 1\nExplain DNS resolution.");
    });

    it("detects paragraph breaks based on vertical coordinate delta (> 20px)", () => {
      const items = [
        {
          str: "Paragraph 1 ends here.",
          transform: [1, 0, 0, 1, 0, 200],
          hasEOL: false,
        },
        // Large vertical gap: 200 - 160 = 40px
        {
          str: "Paragraph 2 starts here.",
          transform: [1, 0, 0, 1, 0, 160],
          hasEOL: true,
        },
      ];
      const result = extractTextFromItems(items);
      expect(result).toContain("\n\n");
      expect(result).toContain("Paragraph 1 ends here.");
      expect(result).toContain("Paragraph 2 starts here.");
    });

    it("ignores non-text items gracefully", () => {
      const items = [
        null,
        undefined,
        {},
        { notStr: 123 },
        { str: "Valid text", transform: [1, 0, 0, 1, 0, 100], hasEOL: true },
      ];
      const result = extractTextFromItems(items);
      expect(result).toBe("Valid text");
    });
  });

  describe("inspectPdf with authentic sample file", () => {
    it("correctly inspects STE_QB_UT1.pdf as a 14-page scanned document", async () => {
      const filePath = path.resolve(
        process.cwd(),
        "public/assets/qa_material/STE_QB_UT1.pdf"
      );
      expect(fs.existsSync(filePath)).toBe(true);

      const buffer = fs.readFileSync(filePath);
      const result: PdfInspectionResult = await inspectPdf(buffer);

      expect(result.pageCount).toBe(14);
      expect(result.classification).toBe("scanned");
      expect(result.totalCharacterCount).toBe(0);
      expect(result.pages.length).toBe(14);
      expect(result.aggregateText).toBe("");
    });
  });

  describe("Payload Budget & Safe Limits for PDFs", () => {
    it("warns students in friendly language when total file size exceeds budget", () => {
      // 4 MB file exceeds 3.5 MB budget
      const fakeLargeFile = {
        name: "LargeNotes.pdf",
        size: 4.2 * 1024 * 1024,
      };

      const assessment = assessUploadPayloadBudget([fakeLargeFile]);
      expect(assessment.withinBudget).toBe(false);
      expect(assessment.warning).toBeDefined();
      expect(assessment.warning!).toContain(
        "These pages are too large to add together"
      );
      expect(assessment.actionGuidance).toBeDefined();
      expect(assessment.actionGuidance!).toContain("Try selecting fewer pages");
      // Must not contain prohibited technical words
      expect(assessment.warning!.toLowerCase()).not.toContain("vercel");
      expect(assessment.warning!.toLowerCase()).not.toContain("serverless");
      expect(assessment.warning!.toLowerCase()).not.toContain("payload");
    });

    it("approves files within 3.5 MB ceiling", () => {
      const compactFile = {
        name: "CompactNotes.pdf",
        size: 1.5 * 1024 * 1024,
      };

      const assessment = assessUploadPayloadBudget([compactFile]);
      expect(assessment.withinBudget).toBe(true);
      expect(assessment.warning).toBeUndefined();
    });
  });
});
