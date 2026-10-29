import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllPracticeAttempts,
  clearAllStudySets,
  deletePracticeAttempt,
  deleteStudySet,
  getPracticeAttempt,
  getStudySet,
  listPracticeAttempts,
  listStudySets,
  savePracticeAttempt,
  saveStudySet,
  updateStudySet,
} from "../../src/lib/storage/study-store";
import { StudySet } from "../../src/lib/domain/study-set";
import { PracticeAttempt } from "../../src/lib/domain/practice-session";

function createMockStudySet(
  id: string,
  title: string,
  timestamp: string
): StudySet {
  return {
    id,
    material: {
      id,
      title,
      sourceText:
        "Sample test source material with sufficient length for testing.",
      characterCount: 65,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    questions: [
      {
        id: `q_${id}`,
        studyMaterialId: id,
        orderIndex: 0,
        question: "Sample question for test?",
        referenceAnswer: "Sample reference answer grounded in test material.",
        sourceExcerpt: "Sample test source excerpt.",
      },
    ],
    rubrics: {
      [`q_${id}`]: {
        id: `rub_${id}`,
        questionId: `q_${id}`,
        studyMaterialId: id,
        criteria: [
          {
            id: `crit_${id}`,
            category: "essential_concept",
            name: "Test Concept",
            description: "Test description",
            satisfactoryDemonstration: "Test guidance",
            isMandatory: true,
            orderIndex: 0,
          },
        ],
        updatedAt: timestamp,
      },
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("Study Store (IndexedDB / In-Memory Fallback)", () => {
  beforeEach(async () => {
    await clearAllStudySets();
  });

  it("saves and retrieves a study set by ID", async () => {
    const item = createMockStudySet(
      "set_1",
      "Computer Networks",
      "2026-10-27T10:00:00Z"
    );
    await saveStudySet(item);

    const retrieved = await getStudySet("set_1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe("set_1");
    expect(retrieved?.material.title).toBe("Computer Networks");
    expect(retrieved?.questions).toHaveLength(1);
    expect(retrieved?.rubrics["q_set_1"]).toBeDefined();
  });

  it("returns null for a non-existent study set", async () => {
    const retrieved = await getStudySet("non_existent_id");
    expect(retrieved).toBeNull();
  });

  it("lists multiple study sets sorted descending by updatedAt", async () => {
    const itemA = createMockStudySet(
      "set_a",
      "Older Set",
      "2026-10-25T10:00:00Z"
    );
    const itemB = createMockStudySet(
      "set_b",
      "Newer Set",
      "2026-10-27T12:00:00Z"
    );
    const itemC = createMockStudySet(
      "set_c",
      "Middle Set",
      "2026-10-26T11:00:00Z"
    );

    await saveStudySet(itemA);
    await saveStudySet(itemB);
    await saveStudySet(itemC);

    const list = await listStudySets();
    expect(list).toHaveLength(3);
    expect(list[0]?.id).toBe("set_b");
    expect(list[1]?.id).toBe("set_c");
    expect(list[2]?.id).toBe("set_a");
  });

  it("deletes a study set by ID", async () => {
    const item = createMockStudySet(
      "set_del",
      "To Delete",
      "2026-10-27T10:00:00Z"
    );
    await saveStudySet(item);

    const before = await getStudySet("set_del");
    expect(before).not.toBeNull();

    await deleteStudySet("set_del");

    const after = await getStudySet("set_del");
    expect(after).toBeNull();
  });

  it("updates an existing study set", async () => {
    const item = createMockStudySet(
      "set_update",
      "Original Title",
      "2026-10-27T10:00:00Z"
    );
    await saveStudySet(item);

    const updatedItem: StudySet = {
      ...item,
      material: {
        ...item.material,
        title: "Renamed Title",
      },
      updatedAt: "2026-10-27T11:00:00Z",
    };

    await updateStudySet(updatedItem);

    const retrieved = await getStudySet("set_update");
    expect(retrieved?.material.title).toBe("Renamed Title");
  });

  it("persists, retrieves, and filters practice attempts", async () => {
    await clearAllPracticeAttempts();

    const attempt1: PracticeAttempt = {
      id: "attempt_1",
      studySetId: "set_a",
      questionId: "q_1",
      transcript: "This is my spoken answer explaining the primary concept.",
      wordCount: 9,
      durationSeconds: 12,
      status: "completed",
      createdAt: "2026-10-29T10:00:00Z",
    };

    const attempt2: PracticeAttempt = {
      id: "attempt_2",
      studySetId: "set_a",
      questionId: "q_2",
      transcript: "Second spoken answer for question two.",
      wordCount: 6,
      durationSeconds: 8,
      status: "completed",
      createdAt: "2026-10-29T11:00:00Z",
    };

    await savePracticeAttempt(attempt1);
    await savePracticeAttempt(attempt2);

    const fetched = await getPracticeAttempt("attempt_1");
    expect(fetched).not.toBeNull();
    expect(fetched?.wordCount).toBe(9);
    expect(fetched?.transcript).toContain("primary concept");

    const forSetA = await listPracticeAttempts("set_a");
    expect(forSetA).toHaveLength(2);
    // Ordered newest first
    expect(forSetA[0]!.id).toBe("attempt_2");

    const forQ1 = await listPracticeAttempts("set_a", "q_1");
    expect(forQ1).toHaveLength(1);
    expect(forQ1[0]!.id).toBe("attempt_1");

    await deletePracticeAttempt("attempt_1");
    const remaining = await listPracticeAttempts("set_a");
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe("attempt_2");
  });
});
