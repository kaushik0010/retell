import { describe, it, expect, beforeEach } from "vitest";
import {
  savePracticeAttempt,
  getPracticeAttemptsByQuestion,
  deletePracticeAttempt,
  clearAllPracticeAttempts,
} from "@/lib/storage/study-store";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { checkScopeCompatibility } from "@/lib/domain/attempt-comparison";

describe("Attempt History Management and Scope Filtering", () => {
  beforeEach(async () => {
    await clearAllPracticeAttempts();
  });

  const attempts: PracticeAttempt[] = [
    {
      id: "attempt_early",
      studySetId: "set_101",
      questionId: "q_1",
      transcript: "Early attempt text.",
      wordCount: 10,
      durationSeconds: 15,
      status: "completed",
      scope: "whole_answer",
      createdAt: "2026-10-31T08:00:00.000Z",
    },
    {
      id: "attempt_p1",
      studySetId: "set_101",
      questionId: "q_1",
      transcript: "Paragraph 1 attempt text.",
      wordCount: 14,
      durationSeconds: 20,
      status: "completed",
      scope: "paragraph",
      paragraphIndex: 0,
      totalParagraphs: 2,
      createdAt: "2026-10-31T08:30:00.000Z",
    },
    {
      id: "attempt_latest",
      studySetId: "set_101",
      questionId: "q_1",
      transcript: "Latest comprehensive attempt text.",
      wordCount: 25,
      durationSeconds: 35,
      status: "completed",
      scope: "whole_answer",
      createdAt: "2026-10-31T09:00:00.000Z",
    },
  ];

  it("persists multiple completed attempts independently without duplication", async () => {
    for (const att of attempts) {
      await savePracticeAttempt(att);
    }

    const loaded = await getPracticeAttemptsByQuestion("set_101", "q_1");
    expect(loaded.length).toBe(3);
  });

  it("identifies the most recent attempt as the first element in sorted order", async () => {
    for (const att of attempts) {
      await savePracticeAttempt(att);
    }

    const loaded = await getPracticeAttemptsByQuestion("set_101", "q_1");
    expect(loaded[0]?.id).toBe("attempt_latest");
    expect(loaded[0]?.wordCount).toBe(25);
  });

  it("filters attempts by specific scope without cross-scope leakage", async () => {
    for (const att of attempts) {
      await savePracticeAttempt(att);
    }

    const all = await getPracticeAttemptsByQuestion("set_101", "q_1");

    const wholeAnswerAttempts = all.filter(
      (a) => !a.scope || a.scope === "whole_answer"
    );
    expect(wholeAnswerAttempts.length).toBe(2);
    expect(wholeAnswerAttempts.map((a) => a.id)).toEqual([
      "attempt_latest",
      "attempt_early",
    ]);

    const paragraphAttempts = all.filter(
      (a) => a.scope === "paragraph" && a.paragraphIndex === 0
    );
    expect(paragraphAttempts.length).toBe(1);
    expect(paragraphAttempts[0]?.id).toBe("attempt_p1");
  });

  it("retains all metadata fields across save and reload", async () => {
    await savePracticeAttempt(attempts[1]!); // Paragraph attempt

    const all = await getPracticeAttemptsByQuestion("set_101", "q_1");
    const p1 = all[0]!;

    expect(p1.id).toBe("attempt_p1");
    expect(p1.scope).toBe("paragraph");
    expect(p1.paragraphIndex).toBe(0);
    expect(p1.totalParagraphs).toBe(2);
    expect(p1.durationSeconds).toBe(20);
    expect(p1.wordCount).toBe(14);
  });

  it("deletes a practice attempt by id cleanly from storage", async () => {
    for (const att of attempts) {
      await savePracticeAttempt(att);
    }

    await deletePracticeAttempt("attempt_p1");

    const remaining = await getPracticeAttemptsByQuestion("set_101", "q_1");
    expect(remaining.length).toBe(2);
    expect(remaining.map((a) => a.id)).not.toContain("attempt_p1");
  });

  it("resolves preceding compatible attempts correctly for comparison", () => {
    // attempt_early (whole_answer) is chronologically before attempt_latest (whole_answer)
    const early = attempts[0]!;
    const p1 = attempts[1]!;
    const latest = attempts[2]!;

    const wholeComp = checkScopeCompatibility(early, latest);
    expect(wholeComp.compatible).toBe(true);

    const crossComp = checkScopeCompatibility(p1, latest);
    expect(crossComp.compatible).toBe(false);
  });
});
