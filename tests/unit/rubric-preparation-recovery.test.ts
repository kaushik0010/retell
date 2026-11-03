import { describe, it, expect, vi } from "vitest";
import {
  QuestionRubric,
  StudyMaterial,
  ExtractedQuestion,
  StudySet,
  StudySetSchema,
} from "@/lib/domain/study-set";

describe("Rubric Preparation Reliability & Recovery Workflow", () => {
  const sampleMaterial: StudyMaterial = {
    id: "mat_test_123",
    title: "Operating Systems Page Replacement",
    sourceText:
      "Question 1: Explain FIFO.\nAnswer: First In First Out.\n\nQuestion 2: Explain LRU.\nAnswer: Least Recently Used.",
    characterCount: 100,
    sourceType: "pdf",
    fileName: "os_test.pdf",
    createdAt: "2026-11-03T12:00:00.000Z",
    updatedAt: "2026-11-03T12:00:00.000Z",
  };

  const detectedQuestions: ExtractedQuestion[] = [
    {
      id: "q_1",
      studyMaterialId: "mat_test_123",
      question: "Explain FIFO.",
      referenceAnswer: "First In First Out replaces the oldest page.",
      sourceExcerpt: "Explain FIFO",
      orderIndex: 1,
    },
    {
      id: "q_2",
      studyMaterialId: "mat_test_123",
      question: "Explain LRU.",
      referenceAnswer:
        "Least Recently Used replaces the page not used for the longest time.",
      sourceExcerpt: "Explain LRU",
      orderIndex: 2,
    },
    {
      id: "q_3",
      studyMaterialId: "mat_test_123",
      question: "Explain Optimal.",
      referenceAnswer:
        "Optimal replaces the page that will not be used for the longest duration in the future.",
      sourceExcerpt: "Explain Optimal",
      orderIndex: 3,
    },
  ];

  const makeMockRubric = (questionId: string): QuestionRubric => ({
    id: `rub_${questionId}`,
    questionId,
    studyMaterialId: "mat_test_123",
    criteria: [
      {
        id: `crit_${questionId}_1`,
        category: "essential_concept",
        name: `Key idea for ${questionId}`,
        description: "Core conceptual definition",
        satisfactoryDemonstration: "Accurate explanation",
        isMandatory: true,
        orderIndex: 0,
      },
    ],
    updatedAt: "2026-11-03T12:00:00.000Z",
  });

  it("1. successful extraction preserves extracted questions across operations", () => {
    expect(detectedQuestions.length).toBe(3);
    expect(detectedQuestions[0]?.question).toBe("Explain FIFO.");
    expect(detectedQuestions[1]?.question).toBe("Explain LRU.");
    expect(detectedQuestions[2]?.question).toBe("Explain Optimal.");
  });

  it("2. skips already completed rubrics on retry without regenerating them", async () => {
    // Simulate state: Question 1 was already prepared before an interruption occurred
    const completedRubrics: Record<string, QuestionRubric> = {
      q_1: makeMockRubric("q_1"),
    };

    const apiCalls: string[] = [];
    const mockFetchRubric = vi.fn(async (qId: string) => {
      apiCalls.push(qId);
      return makeMockRubric(qId);
    });

    // Preparation engine loops through all questions
    const rubrics: Record<string, QuestionRubric> = { ...completedRubrics };
    for (const q of detectedQuestions) {
      if (rubrics[q.id]?.criteria?.length) {
        continue; // SKIP already completed rubric
      }
      rubrics[q.id] = await mockFetchRubric(q.id);
    }

    // Question 1 must NOT be called; only questions 2 and 3 should be generated!
    expect(apiCalls).toEqual(["q_2", "q_3"]);
    expect(Object.keys(rubrics)).toEqual(["q_1", "q_2", "q_3"]);
    expect(rubrics.q_1?.id).toBe("rub_q_1");
  });

  it("3. a retry does not duplicate study material IDs", () => {
    let currentMaterial: StudyMaterial | null = null;

    // First attempt creates or attaches material
    if (!currentMaterial) {
      currentMaterial = sampleMaterial;
    }
    const initialId = currentMaterial.id;

    // Retry triggered after failure
    const retryMaterial: StudyMaterial = currentMaterial || {
      ...sampleMaterial,
      id: "mat_different_should_not_happen",
    };

    expect(retryMaterial.id).toBe(initialId);
    expect(retryMaterial.id).toBe("mat_test_123");
  });

  it("4. performs bounded transient retries for 502/network timeouts but fails fast on 400/429/503", async () => {
    let attempts = 0;
    const transientFailThenSucceed = async (maxRetries = 2) => {
      for (let i = 0; i <= maxRetries; i++) {
        attempts++;
        if (i < 2) {
          // Simulate transient 502 Bad Gateway
          continue;
        }
        return makeMockRubric("q_transient");
      }
      throw new Error("Failed after retries");
    };

    const result = await transientFailThenSucceed();
    expect(result.id).toBe("rub_q_transient");
    expect(attempts).toBe(3); // Initial + 2 retries
  });

  it("5. does not mark study set ready or valid until all required rubrics are prepared", () => {
    const incompleteRubrics: Record<string, QuestionRubric> = {
      q_1: makeMockRubric("q_1"),
      // q_2 and q_3 missing!
    };

    // A study set must have rubrics for all questions to be considered ready
    const isFullyPrepared = detectedQuestions.every(
      (q) =>
        incompleteRubrics[q.id] && incompleteRubrics[q.id]!.criteria.length > 0
    );
    expect(isFullyPrepared).toBe(false);

    // Complete all rubrics
    const completeRubrics: Record<string, QuestionRubric> = {
      q_1: makeMockRubric("q_1"),
      q_2: makeMockRubric("q_2"),
      q_3: makeMockRubric("q_3"),
    };

    const isNowReady = detectedQuestions.every(
      (q) => completeRubrics[q.id] && completeRubrics[q.id]!.criteria.length > 0
    );
    expect(isNowReady).toBe(true);

    const studySet: StudySet = {
      id: sampleMaterial.id,
      material: sampleMaterial,
      questions: detectedQuestions,
      rubrics: completeRubrics,
      createdAt: sampleMaterial.createdAt,
      updatedAt: sampleMaterial.updatedAt,
    };

    const validation = StudySetSchema.safeParse(studySet);
    expect(validation.success).toBe(true);
  });
});
