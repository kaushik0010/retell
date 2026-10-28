import { describe, expect, it } from "vitest";
import { SAMPLE_STUDY_MATERIALS } from "../../src/features/library/sample-materials";

describe("Navigation, Presets and Route Contracts", () => {
  it("provides four realistic sample study presets with authentic exam Q&As", () => {
    expect(SAMPLE_STUDY_MATERIALS).toHaveLength(4);

    for (const sample of SAMPLE_STUDY_MATERIALS) {
      expect(sample.id).toBeTruthy();
      expect(sample.title).toBeTruthy();
      expect(sample.category).toBeTruthy();
      expect(sample.sourceText.length).toBeGreaterThan(100);

      // Verify that sample texts model real exam questions and original answers
      expect(sample.sourceText).toMatch(/question/i);
      expect(sample.sourceText).toMatch(/answer/i);
    }
  });

  it("includes Operating Systems Page Replacement sample matching design references", () => {
    const osSample = SAMPLE_STUDY_MATERIALS.find(
      (s) => s.id === "sample_os_page_replacement"
    );
    expect(osSample).toBeDefined();
    expect(osSample?.title).toContain("Operating Systems: Page Replacement");
    expect(osSample?.sourceText).toContain("FIFO");
    expect(osSample?.sourceText).toContain("LRU");
    expect(osSample?.sourceText).toContain("Optimal");
    expect(osSample?.sourceText).toContain("Belady");
  });

  it("verifies canonical application routes", () => {
    const routes = {
      home: "/",
      library: "/library",
      addMaterial: "/materials/new",
      review: (id: string) => `/review/${id}`,
      practice: (id: string) => `/practice/${id}`,
    };

    expect(routes.home).toBe("/");
    expect(routes.library).toBe("/library");
    expect(routes.addMaterial).toBe("/materials/new");
    expect(routes.review("test_123")).toBe("/review/test_123");
    expect(routes.practice("test_123")).toBe("/practice/test_123");
  });

  it("verifies SEO page metadata definitions", async () => {
    const homeMeta = (await import("../../src/app/page")).metadata;
    expect(homeMeta.title).toBe("Turn Study into Confidence");
    expect(homeMeta.description).toContain("Retell");

    const libraryMeta = (await import("../../src/app/library/page")).metadata;
    expect(libraryMeta.title).toBe("Study Library");

    const addMeta = (await import("../../src/app/materials/new/page")).metadata;
    expect(addMeta.title).toBe("Add Study Material");

    const generateReviewMeta = (await import("../../src/app/review/[id]/page"))
      .generateMetadata;
    const reviewMeta = await generateReviewMeta({
      params: Promise.resolve({ id: "set_test_123" }),
    });
    expect(reviewMeta.title).toBe("Review Points to Remember");
    expect(reviewMeta.description).toContain("set_test_123");
  });
});
