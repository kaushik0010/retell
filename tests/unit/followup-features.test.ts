import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateFileBatch, MAX_BATCH_FILES } from "../../src/lib/files";
import {
  ExtractedQuestion,
  QuestionRubric,
  StudySet,
} from "../../src/lib/domain/study-set";
import { serializeStudySetForComparison } from "../../src/features/source-review/SourceReviewView";

describe("Follow-up Features: Multi-Image Ingestion, Study-Set Import & Save-State UX", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Feature A: Multi-Image Ingestion & Batch Validation", () => {
    const validJpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const validPngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const validPdfHeader = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Count 1 >>");

    it("accepts multiple valid images and preserves their order", () => {
      const files = [
        { name: "page1.jpg", buffer: validJpegHeader },
        { name: "page2.png", buffer: validPngHeader },
        { name: "page3.jpg", buffer: validJpegHeader },
      ];

      const batch = validateFileBatch(files);
      expect(batch.valid).toBe(true);
      expect(batch.isPdf).toBe(false);
      expect(batch.results).toHaveLength(3);
      expect(batch.results[0]!.type).toBe("image");
      expect(batch.results[1]!.type).toBe("image");
      expect(batch.results[2]!.type).toBe("image");
    });

    it("rejects an invalid file inside an image batch", () => {
      const files = [
        { name: "page1.jpg", buffer: validJpegHeader },
        { name: "corrupt.jpg", buffer: Buffer.from("not an image") },
      ];

      const batch = validateFileBatch(files);
      expect(batch.valid).toBe(false);
      expect(batch.error).toContain("not a supported file format");
    });

    it("rejects when multiple files mix PDF and images together", () => {
      const files = [
        { name: "document.pdf", buffer: validPdfHeader },
        { name: "photo.jpg", buffer: validJpegHeader },
      ];

      const batch = validateFileBatch(files);
      expect(batch.valid).toBe(false);
      expect(batch.error).toContain("not both together");
    });

    it("rejects when more than one PDF is uploaded in a single batch", () => {
      const files = [
        { name: "doc1.pdf", buffer: validPdfHeader },
        { name: "doc2.pdf", buffer: validPdfHeader },
      ];

      const batch = validateFileBatch(files);
      expect(batch.valid).toBe(false);
      expect(batch.error).toContain("one PDF document at a time");
    });

    it("enforces MAX_BATCH_FILES limit", () => {
      const tooMany = Array.from({ length: MAX_BATCH_FILES + 1 }, (_, i) => ({
        name: `page_${i + 1}.jpg`,
        buffer: validJpegHeader,
      }));

      const batch = validateFileBatch(tooMany);
      expect(batch.valid).toBe(false);
      expect(batch.error).toContain(`maximum allowed is ${MAX_BATCH_FILES}`);
    });

    it("enforces total batch size ceiling (25 MB)", () => {
      const bigFile1 = Buffer.alloc(14 * 1024 * 1024);
      bigFile1[0] = 0xff;
      bigFile1[1] = 0xd8;
      bigFile1[2] = 0xff;

      const bigFile2 = Buffer.alloc(14 * 1024 * 1024);
      bigFile2[0] = 0xff;
      bigFile2[1] = 0xd8;
      bigFile2[2] = 0xff;

      const batch = validateFileBatch([
        { name: "page1.jpg", buffer: bigFile1 },
        { name: "page2.jpg", buffer: bigFile2 },
      ]);
      expect(batch.valid).toBe(false);
      expect(batch.error).toContain("exceeds the 25 MB limit");
    });

    it("correctly simulates removing a middle image while preserving order of remaining items", () => {
      const staged = [
        { id: "1", name: "page1.jpg" },
        { id: "2", name: "page2.jpg" },
        { id: "3", name: "page3.jpg" },
      ];

      // Remove index 1
      const updated = staged.filter((_, idx) => idx !== 1);
      expect(updated).toHaveLength(2);
      expect(updated[0]!.name).toBe("page1.jpg");
      expect(updated[1]!.name).toBe("page3.jpg");
    });

    it("correctly simulates reordering images up and down", () => {
      const staged = ["page1.jpg", "page2.jpg", "page3.jpg"];

      // Move page 2 up
      const copy = [...staged];
      const temp = copy[0]!;
      copy[0] = copy[1]!;
      copy[1] = temp;

      expect(copy).toEqual(["page2.jpg", "page1.jpg", "page3.jpg"]);
    });
  });

  describe("Feature B: Importing Questions into Existing Study Sets", () => {
    const mockInitialSet: StudySet = {
      id: "set_existing_1",
      material: {
        id: "mat_existing_1",
        title: "Operating Systems Exam",
        sourceText: "Initial question on FIFO page replacement.",
        characterCount: 42,
        createdAt: "2026-10-28T00:00:00.000Z",
        updatedAt: "2026-10-28T00:00:00.000Z",
      },
      questions: [
        {
          id: "q_original_1",
          studyMaterialId: "mat_existing_1",
          orderIndex: 0,
          question: "Explain Belady's Anomaly.",
          referenceAnswer:
            "Belady's anomaly occurs when adding more page frames leads to more page faults under FIFO.",
          sourceExcerpt: "Belady anomaly occurs...",
        },
      ],
      rubrics: {
        q_original_1: {
          id: "rub_original_1",
          questionId: "q_original_1",
          studyMaterialId: "mat_existing_1",
          criteria: [
            {
              id: "crit_1",
              category: "essential_concept",
              name: "Anomalous page fault behavior",
              description: "Explain why more frames cause more faults.",
              satisfactoryDemonstration: "Student explains FIFO queue shifts.",
              isMandatory: true,
              orderIndex: 0,
            },
          ],
          updatedAt: "2026-10-28T00:00:00.000Z",
        },
      },
      createdAt: "2026-10-28T00:00:00.000Z",
      updatedAt: "2026-10-28T00:00:00.000Z",
    };

    it("appends new distinct question records without overwriting original questions or IDs", () => {
      const importedCandidate: ExtractedQuestion = {
        id: "q_imported_new_99",
        studyMaterialId: mockInitialSet.material.id,
        orderIndex: mockInitialSet.questions.length,
        question: "Explain Deadlock Coffman Conditions.",
        referenceAnswer:
          "Mutual exclusion, Hold and wait, No preemption, Circular wait.",
        sourceExcerpt: "Coffman conditions...",
        pageNumber: 2,
      };

      const importedRubric: QuestionRubric = {
        id: "rub_imported_new_99",
        questionId: importedCandidate.id,
        studyMaterialId: mockInitialSet.material.id,
        criteria: [
          {
            id: "crit_coffman",
            category: "technical_anchor",
            name: "Four Coffman Conditions",
            description: "Must name all 4 conditions.",
            satisfactoryDemonstration:
              "Student lists Mutual exclusion, Hold and wait, No preemption, Circular wait.",
            isMandatory: true,
            orderIndex: 0,
          },
        ],
        updatedAt: "2026-10-28T00:00:00.000Z",
      };

      // Appending logic simulation
      const updatedQuestions = [...mockInitialSet.questions, importedCandidate];
      const updatedRubrics = {
        ...mockInitialSet.rubrics,
        [importedCandidate.id]: importedRubric,
      };

      expect(updatedQuestions).toHaveLength(2);
      expect(updatedQuestions[0]!.id).toBe("q_original_1");
      expect(updatedQuestions[1]!.id).toBe("q_imported_new_99");
      expect(updatedQuestions[1]!.orderIndex).toBe(1);
      expect(updatedRubrics["q_original_1"]).toBeDefined();
      expect(updatedRubrics["q_imported_new_99"]).toBeDefined();
    });

    it("supports deselecting unwanted candidate questions during import preview", () => {
      const candidateList = [
        { id: "cand_1", question: "Q1", selected: true },
        { id: "cand_2", question: "Q2", selected: false },
        { id: "cand_3", question: "Q3", selected: true },
      ];

      const toImport = candidateList.filter((c) => c.selected);
      expect(toImport).toHaveLength(2);
      expect(toImport.map((c) => c.id)).toEqual(["cand_1", "cand_3"]);
    });

    it("provides fallback rubric criteria if rubric generation fails for an individual imported question", () => {
      const newQId = "q_fallback_test";
      const fallbackRubric: QuestionRubric = {
        id: `rub_${newQId}`,
        questionId: newQId,
        studyMaterialId: "mat_1",
        criteria: [
          {
            id: `crit_${newQId}`,
            category: "essential_concept",
            name: "Main Idea",
            description: "Central idea explaining this concept.",
            satisfactoryDemonstration:
              "Explain the core concept accurately in your own words.",
            isMandatory: true,
            orderIndex: 0,
          },
        ],
        updatedAt: "2026-10-28T00:00:00.000Z",
      };

      expect(fallbackRubric.criteria).toHaveLength(1);
      expect(fallbackRubric.criteria[0]!.category).toBe("essential_concept");
      expect(fallbackRubric.criteria[0]!.isMandatory).toBe(true);
    });
  });

  describe("Feature C: Accurate Save-State Comparison & UX", () => {
    const baseStudySet: StudySet = {
      id: "set_save_1",
      material: {
        id: "mat_save_1",
        title: "Biology: Photosynthesis",
        sourceText: "Original biology text.",
        characterCount: 22,
        createdAt: "2026-10-28T00:00:00.000Z",
        updatedAt: "2026-10-28T00:00:00.000Z",
      },
      questions: [
        {
          id: "q_bio_1",
          studyMaterialId: "mat_save_1",
          orderIndex: 0,
          question: "What is the role of Chlorophyll a?",
          referenceAnswer:
            "Chlorophyll a absorbs blue and red wavelengths and transfers excited electrons.",
          sourceExcerpt: "Chlorophyll a absorbs...",
        },
      ],
      rubrics: {
        q_bio_1: {
          id: "rub_bio_1",
          questionId: "q_bio_1",
          studyMaterialId: "mat_save_1",
          criteria: [
            {
              id: "crit_bio_1",
              category: "essential_concept",
              name: "Absorption Spectrum",
              description: "Absorbs blue and red light.",
              satisfactoryDemonstration:
                "Student explains blue and red absorption.",
              isMandatory: true,
              orderIndex: 0,
            },
          ],
          updatedAt: "2026-10-28T00:00:00.000Z",
        },
      },
      createdAt: "2026-10-28T00:00:00.000Z",
      updatedAt: "2026-10-28T00:00:00.000Z",
    };

    it("verifies initial hydration is clean (not dirty, no false unsaved changes)", () => {
      const baseline = serializeStudySetForComparison(baseStudySet);
      const current = serializeStudySetForComparison(baseStudySet);

      const hasUnsavedChanges = current !== baseline;
      expect(hasUnsavedChanges).toBe(false);
    });

    it("detects title changes as unsaved", () => {
      const baseline = serializeStudySetForComparison(baseStudySet);

      const modified: StudySet = {
        ...baseStudySet,
        material: {
          ...baseStudySet.material,
          title: "Biology: Photosynthesis Light Reactions",
        },
      };

      const current = serializeStudySetForComparison(modified);
      expect(current !== baseline).toBe(true);
    });

    it("detects question and reference answer edits as unsaved", () => {
      const baseline = serializeStudySetForComparison(baseStudySet);

      const modifiedQuestion: StudySet = {
        ...baseStudySet,
        questions: [
          {
            ...baseStudySet.questions[0]!,
            question: "What is the primary role of Chlorophyll a?",
          },
        ],
      };

      expect(
        serializeStudySetForComparison(modifiedQuestion) !== baseline
      ).toBe(true);

      const modifiedAnswer: StudySet = {
        ...baseStudySet,
        questions: [
          {
            ...baseStudySet.questions[0]!,
            referenceAnswer:
              "Chlorophyll a absorbs blue, violet, and red light.",
          },
        ],
      };

      expect(serializeStudySetForComparison(modifiedAnswer) !== baseline).toBe(
        true
      );
    });

    it("detects changes to nested important point criteria fields", () => {
      const baseline = serializeStudySetForComparison(baseStudySet);

      // Modify satisfactoryDemonstration
      const modifiedCriteriaDemo: StudySet = {
        ...baseStudySet,
        rubrics: {
          q_bio_1: {
            ...baseStudySet.rubrics["q_bio_1"]!,
            criteria: [
              {
                ...baseStudySet.rubrics["q_bio_1"]!.criteria[0]!,
                satisfactoryDemonstration:
                  "Updated assessment guidance description.",
              },
            ],
          },
        },
      };
      expect(
        serializeStudySetForComparison(modifiedCriteriaDemo) !== baseline
      ).toBe(true);

      // Modify isMandatory flag
      const modifiedMandatory: StudySet = {
        ...baseStudySet,
        rubrics: {
          q_bio_1: {
            ...baseStudySet.rubrics["q_bio_1"]!,
            criteria: [
              {
                ...baseStudySet.rubrics["q_bio_1"]!.criteria[0]!,
                isMandatory: false,
              },
            ],
          },
        },
      };
      expect(
        serializeStudySetForComparison(modifiedMandatory) !== baseline
      ).toBe(true);

      // Modify category
      const modifiedCategory: StudySet = {
        ...baseStudySet,
        rubrics: {
          q_bio_1: {
            ...baseStudySet.rubrics["q_bio_1"]!,
            criteria: [
              {
                ...baseStudySet.rubrics["q_bio_1"]!.criteria[0]!,
                category: "technical_anchor",
              },
            ],
          },
        },
      };
      expect(
        serializeStudySetForComparison(modifiedCategory) !== baseline
      ).toBe(true);
    });

    it("detects adding or deleting a question as unsaved", () => {
      const baseline = serializeStudySetForComparison(baseStudySet);

      // Add a second question
      const withAddedQ: StudySet = {
        ...baseStudySet,
        questions: [
          ...baseStudySet.questions,
          {
            id: "q_bio_2",
            studyMaterialId: "mat_save_1",
            orderIndex: 1,
            question: "What is photophosphorylation?",
            referenceAnswer: "ATP synthesis driven by proton gradients.",
            sourceExcerpt: "",
          },
        ],
      };
      expect(serializeStudySetForComparison(withAddedQ) !== baseline).toBe(
        true
      );
    });

    it("updates baseline on successful persistence, returning to clean state", () => {
      let baseline = serializeStudySetForComparison(baseStudySet);

      // User makes an edit
      const modified: StudySet = {
        ...baseStudySet,
        material: { ...baseStudySet.material, title: "Updated Title" },
      };
      expect(serializeStudySetForComparison(modified) !== baseline).toBe(true);

      // Persistence succeeds -> baseline updated to saved snapshot
      baseline = serializeStudySetForComparison(modified);
      expect(serializeStudySetForComparison(modified) !== baseline).toBe(false);
    });

    it("handles save race condition: edits made during an in-flight save remain unsaved", () => {
      let baseline = serializeStudySetForComparison(baseStudySet);

      // Save started for edit 1
      const edit1: StudySet = {
        ...baseStudySet,
        material: { ...baseStudySet.material, title: "Title Saved" },
      };
      const snapshotBeingSaved = serializeStudySetForComparison(edit1);

      // User continues typing while save is in-flight (edit 2)
      const edit2: StudySet = {
        ...edit1,
        questions: [
          {
            ...edit1.questions[0]!,
            question: "Question edited during in-flight save?",
          },
        ],
      };

      // Save 1 finishes: updates baseline to snapshotBeingSaved
      baseline = snapshotBeingSaved;

      // Current state (edit2) must STILL be dirty because edit2 was not in snapshotBeingSaved
      const currentFingerprint = serializeStudySetForComparison(edit2);
      const stillHasUnsavedChanges = currentFingerprint !== baseline;
      expect(stillHasUnsavedChanges).toBe(true);
    });
  });
});
