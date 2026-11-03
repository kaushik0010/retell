import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

describe("Judge Testing PDF Sample Materials", () => {
  const qaDir = path.resolve(process.cwd(), "public/assets/qa_material");
  const aimlPdfPath = path.join(
    qaDir,
    "AI_ML_Module_2_Questions_with_Answers.pdf"
  );
  const stePdfPath = path.join(qaDir, "STE_QB_UT1.pdf");

  it("1. confirms both required sample PDF files exist in public/assets/qa_material", () => {
    expect(fs.existsSync(aimlPdfPath)).toBe(true);
    expect(fs.existsSync(stePdfPath)).toBe(true);
  });

  it("2. confirms AI & ML sample PDF is valid with 6 pages and digital text", async () => {
    const stat = fs.statSync(aimlPdfPath);
    expect(stat.size).toBeGreaterThan(100_000); // ~150 KB
    expect(stat.size).toBeLessThan(500_000);

    const data = new Uint8Array(fs.readFileSync(aimlPdfPath));
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    expect(doc.numPages).toBe(6);

    const page1 = await doc.getPage(1);
    const content = await page1.getTextContent();
    const pageText = (content.items as Array<{ str?: string }>)
      .map((it) => it.str || "")
      .join(" ");
    expect(pageText).toContain("YADHAVRAO TASGAONKAR INSTITUTE");
    const normalizedText = pageText.replace(/\s+/g, "");
    expect(normalizedText).toContain("MachineLearning");
    expect(normalizedText).toContain("QuestionswithAnswers");
  });

  it("3. confirms scanned question bank STE_QB_UT1.pdf is valid with 14 pages", async () => {
    const stat = fs.statSync(stePdfPath);
    expect(stat.size).toBeGreaterThan(1_000_000); // ~1.59 MB
    expect(stat.size).toBeLessThan(3_000_000);

    const data = new Uint8Array(fs.readFileSync(stePdfPath));
    const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    expect(doc.numPages).toBe(14);
  });

  it("4. verifies README.md documents both files in a dedicated testing section", () => {
    const readmePath = path.resolve(process.cwd(), "README.md");
    const readmeContent = fs.readFileSync(readmePath, "utf-8");

    expect(readmeContent).toContain(
      "## Testing Retell with Sample Study Materials"
    );
    expect(readmeContent).toContain(
      "AI_ML_Module_2_Questions_with_Answers.pdf"
    );
    expect(readmeContent).toContain("STE_QB_UT1.pdf");
    expect(readmeContent).toContain("public/assets/qa_material");
  });
});
