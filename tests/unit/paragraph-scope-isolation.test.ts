import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  extractParagraphs,
  filterCriteriaForParagraph,
  mapCriteriaToParagraphs,
  resolvePracticeScope,
} from "../../src/lib/domain/paragraph-scope";
import { RubricCriterion, StudySet } from "../../src/lib/domain/study-set";
import { evaluateStudentAnswer } from "../../src/lib/audit/evaluator";
import { AnswerReviewView } from "../../src/features/answer-review/AnswerReviewView";
import { PracticeAttempt } from "../../src/lib/domain/practice-session";
import { SemanticAuditResult } from "../../src/lib/domain/semantic-audit";

describe("Strict Paragraph Scope Isolation & Evaluation Pipeline (Section 4)", () => {
  // Realistic 3-paragraph reference answer fixture
  const threeParagraphAnswer =
    "DNS provides domain name resolution by translating human-readable hostnames into numerical IP addresses.\n\n" +
    "When a lookup occurs, the recursive resolver queries the hierarchy of root nameservers and TLD servers.\n\n" +
    "The final authoritative server returns the zone records, which are cached according to the TTL to optimize latency.";

  const threeParagraphCriteria: RubricCriterion[] = [
    {
      id: "crit_p1_resolution",
      category: "essential_concept",
      name: "Domain Name Resolution",
      description: "Translates human-readable hostnames into IP addresses.",
      satisfactoryDemonstration: "Explains hostname to IP mapping.",
      isMandatory: true,
      orderIndex: 0,
    },
    {
      id: "crit_p2_hierarchy",
      category: "essential_concept",
      name: "Recursive Hierarchy Query",
      description: "Resolver queries root and TLD nameserver hierarchy.",
      satisfactoryDemonstration: "Describes root and TLD query sequence.",
      isMandatory: true,
      orderIndex: 1,
    },
    {
      id: "crit_p3_authoritative",
      category: "essential_concept",
      name: "Authoritative Records & TTL Caching",
      description:
        "Authoritative nameserver answers and TTL caching reduces lookups.",
      satisfactoryDemonstration:
        "Explains authoritative answer and TTL caching.",
      isMandatory: true,
      orderIndex: 2,
    },
  ];

  const nowIso = new Date().toISOString();
  const sampleStudySet: StudySet = {
    id: "set_scope_test",
    material: {
      id: "mat_1",
      title: "Networking Exam Prep",
      sourceText: threeParagraphAnswer,
      characterCount: threeParagraphAnswer.length,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    questions: [
      {
        id: "q_dns_1",
        studyMaterialId: "mat_1",
        orderIndex: 0,
        question: "Explain the complete DNS resolution process.",
        referenceAnswer: threeParagraphAnswer,
        sourceExcerpt: threeParagraphAnswer.slice(0, 50),
      },
    ],
    rubrics: {
      q_dns_1: {
        id: "rubric_dns_1",
        questionId: "q_dns_1",
        studyMaterialId: "mat_1",
        criteria: threeParagraphCriteria,
        updatedAt: nowIso,
      },
    },
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const paragraphs = extractParagraphs(threeParagraphAnswer);

  // Test A — Paragraph 1 only
  it("Test A: evaluates ONLY Paragraph 1; Paragraphs 2 and 3 criteria are NOT marked missing", async () => {
    const scopedContext = resolvePracticeScope({
      referenceAnswer: threeParagraphAnswer,
      criteria: threeParagraphCriteria,
      scope: { type: "paragraph", paragraphIndex: 0 },
    });

    expect(scopedContext.isParagraph).toBe(true);
    expect(scopedContext.paragraphIndex).toBe(0);
    expect(scopedContext.totalParagraphs).toBe(3);
    expect(scopedContext.paragraphText).toBe(paragraphs[0]);
    // Only Criterion 1 belongs to Paragraph 1
    expect(scopedContext.criteria.length).toBe(1);
    expect(scopedContext.criteria[0]?.id).toBe("crit_p1_resolution");

    // Perform deterministic evaluation of student explanation for Paragraph 1
    const audit = await evaluateStudentAnswer({
      attemptId: "att_p1",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      question: "Explain the complete DNS resolution process.",
      referenceAnswer: threeParagraphAnswer,
      transcript: "DNS resolves human-readable domain names into IP addresses.",
      criteria: threeParagraphCriteria,
      scope: { type: "paragraph", paragraphIndex: 0 },
      mockFallback: true,
    });

    // Verification
    expect(audit.scope.type).toBe("paragraph");
    expect(audit.scope.paragraphIndex).toBe(0);
    expect(audit.scope.targetText).toBe(paragraphs[0]);
    expect(audit.criteriaEvaluations.length).toBe(1);
    expect(audit.criteriaEvaluations[0]?.criterionId).toBe(
      "crit_p1_resolution"
    );
    expect(audit.criteriaEvaluations[0]?.status).toBe("covered");
    expect(audit.overall.totalCriteria).toBe(1);
    expect(audit.overall.coveredCount).toBe(1);
    expect(audit.overall.missingCount).toBe(0);
    // Crucial: Paragraphs 2 and 3 criteria MUST NOT appear under whatNeedsAttention!
    expect(audit.overall.whatNeedsAttention).not.toContain(
      "Recursive Hierarchy Query"
    );
    expect(audit.overall.whatNeedsAttention).not.toContain(
      "Authoritative Records & TTL Caching"
    );
  });

  // Test B — Paragraph 2 only
  it("Test B: evaluates ONLY Paragraph 2; concepts from Paragraphs 1 and 3 are completely excluded", async () => {
    const scopedContext = resolvePracticeScope({
      referenceAnswer: threeParagraphAnswer,
      criteria: threeParagraphCriteria,
      scope: { type: "paragraph", paragraphIndex: 1 },
    });

    expect(scopedContext.paragraphIndex).toBe(1);
    expect(scopedContext.paragraphText).toBe(paragraphs[1]);
    expect(scopedContext.criteria.length).toBe(1);
    expect(scopedContext.criteria[0]?.id).toBe("crit_p2_hierarchy");

    const audit = await evaluateStudentAnswer({
      attemptId: "att_p2",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      question: "Explain the complete DNS resolution process.",
      referenceAnswer: threeParagraphAnswer,
      transcript:
        "The recursive resolver queries the root and TLD nameserver hierarchy.",
      criteria: threeParagraphCriteria,
      scope: { type: "paragraph", paragraphIndex: 1 },
      mockFallback: true,
    });

    expect(audit.criteriaEvaluations.length).toBe(1);
    expect(audit.criteriaEvaluations[0]?.criterionId).toBe("crit_p2_hierarchy");
    expect(audit.overall.totalCriteria).toBe(1);
    expect(audit.overall.whatNeedsAttention).toHaveLength(0);
  });

  // Test C — Paragraph 3 only
  it("Test C: evaluates ONLY Paragraph 3; concepts from Paragraphs 1 and 2 do NOT appear in the audit", async () => {
    const scopedContext = resolvePracticeScope({
      referenceAnswer: threeParagraphAnswer,
      criteria: threeParagraphCriteria,
      scope: { type: "paragraph", paragraphIndex: 2 },
    });

    expect(scopedContext.paragraphIndex).toBe(2);
    expect(scopedContext.paragraphText).toBe(paragraphs[2]);
    expect(scopedContext.criteria.length).toBe(1);
    expect(scopedContext.criteria[0]?.id).toBe("crit_p3_authoritative");

    const audit = await evaluateStudentAnswer({
      attemptId: "att_p3",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      question: "Explain the complete DNS resolution process.",
      referenceAnswer: threeParagraphAnswer,
      transcript:
        "Authoritative nameserver answers with the record, and TTL caching saves it.",
      criteria: threeParagraphCriteria,
      scope: { type: "paragraph", paragraphIndex: 2 },
      mockFallback: true,
    });

    expect(audit.criteriaEvaluations.length).toBe(1);
    expect(audit.criteriaEvaluations[0]?.criterionId).toBe(
      "crit_p3_authoritative"
    );
    expect(audit.overall.totalCriteria).toBe(1);
    expect(audit.overall.coveredCount).toBe(1);
  });

  // Test D — Whole answer
  it("Test D: evaluates all paragraphs and criteria when scope is whole_answer", async () => {
    const scopedContext = resolvePracticeScope({
      referenceAnswer: threeParagraphAnswer,
      criteria: threeParagraphCriteria,
      scope: { type: "whole_answer" },
    });

    expect(scopedContext.isParagraph).toBe(false);
    expect(scopedContext.paragraphText).toBe(threeParagraphAnswer);
    expect(scopedContext.criteria.length).toBe(3);

    const audit = await evaluateStudentAnswer({
      attemptId: "att_whole",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      question: "Explain the complete DNS resolution process.",
      referenceAnswer: threeParagraphAnswer,
      transcript:
        "DNS translates hostnames to IP addresses. Resolvers query root and TLD servers. Authoritative servers respond and results are cached.",
      criteria: threeParagraphCriteria,
      scope: { type: "whole_answer" },
      mockFallback: true,
    });

    expect(audit.scope.type).toBe("whole_answer");
    expect(audit.criteriaEvaluations.length).toBe(3);
    expect(audit.overall.totalCriteria).toBe(3);
  });

  // Test E — Criteria mapping and paragraph distribution
  it("Test E: cleanly distributes criteria across paragraphs preserving order and boundaries", () => {
    const mapping = mapCriteriaToParagraphs(threeParagraphCriteria, paragraphs);
    expect(mapping.get(0)?.length).toBe(1);
    expect(mapping.get(1)?.length).toBe(1);
    expect(mapping.get(2)?.length).toBe(1);
    expect(mapping.get(0)?.[0]?.id).toBe("crit_p1_resolution");
    expect(mapping.get(1)?.[0]?.id).toBe("crit_p2_hierarchy");
    expect(mapping.get(2)?.[0]?.id).toBe("crit_p3_authoritative");

    const filteredP0 = filterCriteriaForParagraph(
      threeParagraphCriteria,
      paragraphs,
      0
    );
    expect(filteredP0.length).toBe(1);
    expect(filteredP0[0]?.id).toBe("crit_p1_resolution");
  });

  // Test F — Paragraph scope persistence & Answer Review rendering
  it("Test F: Answer Review renders ONLY Paragraph 1's reference text and criteria for paragraph attempts", () => {
    const paragraphAttempt: PracticeAttempt = {
      id: "att_p1_rendered",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      transcript:
        "DNS provides domain name resolution for hostnames to IP addresses.",
      wordCount: 10,
      durationSeconds: 15,
      status: "completed",
      scope: "paragraph",
      paragraphIndex: 0,
      paragraphText: paragraphs[0],
      totalParagraphs: 3,
      createdAt: new Date().toISOString(),
    };

    const paragraphAudit: SemanticAuditResult = {
      id: "audit_p1_rendered",
      attemptId: "att_p1_rendered",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      status: "completed",
      scope: {
        type: "paragraph",
        paragraphIndex: 0,
        totalParagraphs: 3,
        targetText: paragraphs[0],
      },
      overall: {
        summary: "You explained Paragraph 1 clearly and accurately.",
        whatExplainedWell: ["Domain Name Resolution"],
        whatNeedsAttention: [],
        whatNeedsCorrection: [],
        suggestedNextImprovement: "Move on to Paragraph 2 practice.",
        coveredCount: 1,
        partiallyCoveredCount: 0,
        missingCount: 0,
        incorrectCount: 0,
        optionalCount: 0,
        totalCriteria: 1,
      },
      criteriaEvaluations: [
        {
          criterionId: "crit_p1_resolution",
          criterionName: "Domain Name Resolution",
          category: "essential_concept",
          status: "covered",
          explanation: "Accurately explained hostname to IP mapping.",
          transcriptEvidence:
            "domain name resolution for hostnames to IP addresses",
          missingOrInaccurate: null,
          improvementSuggestion: "Well done.",
          orderIndex: 0,
        },
      ],
      hasUncertainty: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const markup = renderToStaticMarkup(
      React.createElement(AnswerReviewView, {
        studySet: sampleStudySet,
        attempt: paragraphAttempt,
        initialAudit: paragraphAudit,
      })
    );

    // Verify Paragraph 1 Scope Badge is rendered
    expect(markup).toContain("Paragraph 1 Practice");
    expect(markup).toContain("Paragraph-Level Practice:");
    // Verify Paragraph 1 criterion appears
    expect(markup).toContain("Domain Name Resolution");
    // Verify Paragraphs 2 and 3 criteria DO NOT appear
    expect(markup).not.toContain("Recursive Hierarchy Query");
    expect(markup).not.toContain("Authoritative Records &amp; TTL Caching");
    expect(markup).not.toContain("Authoritative Records & TTL Caching");
  });

  // Test G — Missing or invalid paragraph metadata throws recoverable error without silent fallback
  it("Test G: throws clear, recoverable error when paragraphIndex cannot be resolved instead of silent fallback", () => {
    // Out-of-bounds paragraph index 99
    expect(() =>
      resolvePracticeScope({
        referenceAnswer: threeParagraphAnswer,
        criteria: threeParagraphCriteria,
        scope: { type: "paragraph", paragraphIndex: 99 },
      })
    ).toThrowError(/Cannot resolve selected Paragraph 100/);

    // Negative paragraph index
    expect(() =>
      resolvePracticeScope({
        referenceAnswer: threeParagraphAnswer,
        criteria: threeParagraphCriteria,
        scope: { type: "paragraph", paragraphIndex: -1 },
      })
    ).toThrowError(/Invalid paragraph practice scope/);
  });

  // Test H — Retry paragraph audit uses original paragraph scope
  it("Test H: retrying a paragraph audit preserves the original paragraph scope and does not revert to whole answer", async () => {
    // Retry of an attempt with scope: { type: 'paragraph', paragraphIndex: 1 }
    const retryAudit = await evaluateStudentAnswer({
      attemptId: "att_p2_retry",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      question: "Explain the complete DNS resolution process.",
      referenceAnswer: threeParagraphAnswer,
      transcript: "Queries root and TLD servers.",
      criteria: threeParagraphCriteria,
      scope: { type: "paragraph", paragraphIndex: 1 },
      mockFallback: true,
    });

    expect(retryAudit.scope.type).toBe("paragraph");
    expect(retryAudit.scope.paragraphIndex).toBe(1);
    expect(retryAudit.criteriaEvaluations.length).toBe(1);
    expect(retryAudit.criteriaEvaluations[0]?.criterionId).toBe(
      "crit_p2_hierarchy"
    );
  });

  // Test I — Cross-attempt isolation: paragraph and whole-answer attempts remain completely independent
  it("Test I: maintains strict cross-attempt isolation between whole-answer and paragraph-scoped attempts", async () => {
    const wholeAudit = await evaluateStudentAnswer({
      attemptId: "att_whole_iso",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      question: "Explain DNS resolution.",
      referenceAnswer: threeParagraphAnswer,
      transcript: "DNS translates hostnames to IP addresses.",
      criteria: threeParagraphCriteria,
      scope: { type: "whole_answer" },
      mockFallback: true,
    });

    const paragraphAudit = await evaluateStudentAnswer({
      attemptId: "att_p1_iso",
      studySetId: "set_scope_test",
      questionId: "q_dns_1",
      question: "Explain DNS resolution.",
      referenceAnswer: threeParagraphAnswer,
      transcript: "DNS translates hostnames to IP addresses.",
      criteria: threeParagraphCriteria,
      scope: { type: "paragraph", paragraphIndex: 0 },
      mockFallback: true,
    });

    // Whole answer evaluated all 3 criteria; Paragraph 1 evaluated exactly 1 criterion
    expect(wholeAudit.criteriaEvaluations.length).toBe(3);
    expect(paragraphAudit.criteriaEvaluations.length).toBe(1);
    expect(wholeAudit.overall.totalCriteria).toBe(3);
    expect(paragraphAudit.overall.totalCriteria).toBe(1);
    // In whole answer, P2 and P3 are missing
    expect(wholeAudit.overall.missingCount).toBe(2);
    // In paragraph 1 attempt, P1 was covered, so missingCount is 0!
    expect(paragraphAudit.overall.missingCount).toBe(0);
  });

  // Test J — Reference text correctness
  it("Test J: ensures the resolved reference text for paragraph practice exactly equals the paragraph slice", () => {
    for (let i = 0; i < paragraphs.length; i++) {
      const scopedContext = resolvePracticeScope({
        referenceAnswer: threeParagraphAnswer,
        criteria: threeParagraphCriteria,
        scope: { type: "paragraph", paragraphIndex: i },
      });

      expect(scopedContext.paragraphText).toBe(paragraphs[i]);
      expect(
        scopedContext.paragraphText.includes(
          paragraphs[(i + 1) % paragraphs.length]!
        )
      ).toBe(false);
    }
  });
});
