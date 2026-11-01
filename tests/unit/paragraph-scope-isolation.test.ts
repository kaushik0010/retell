import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
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
import { POST } from "../../src/app/api/audit/route";

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

  // Test K — Exact 2-paragraph question scenario ("Define i) Software ii) Software Engineering")
  describe("Test K: Two-paragraph question practice & evaluation (Software & Software Engineering)", () => {
    const twoParagraphAnswer =
      "Software is a collection of instructions, data, or programs used to operate computers and execute specific tasks.\n\n" +
      "Software Engineering is a systematic, disciplined, and quantifiable approach to the development, operation, and maintenance of software.";

    const twoParagraphCriteria: RubricCriterion[] = [
      {
        id: "crit_sw_def",
        name: "Software Definition",
        category: "essential_concept",
        description:
          "Defines software as instructions and programs operating computers.",
        satisfactoryDemonstration:
          "Explains software as programs executing tasks on computers.",
        isMandatory: true,
        orderIndex: 0,
      },
      {
        id: "crit_se_def",
        name: "Software Engineering Definition",
        category: "essential_concept",
        description:
          "Defines software engineering as systematic, disciplined engineering approach.",
        satisfactoryDemonstration:
          "Explains software engineering approach to development and maintenance.",
        isMandatory: true,
        orderIndex: 1,
      },
    ];

    it("evaluates Paragraph 1 cleanly without referencing Paragraph 2", async () => {
      const scopedP1 = resolvePracticeScope({
        referenceAnswer: twoParagraphAnswer,
        criteria: twoParagraphCriteria,
        scope: { type: "paragraph", paragraphIndex: 0 },
      });

      expect(scopedP1.isParagraph).toBe(true);
      expect(scopedP1.paragraphIndex).toBe(0);
      expect(scopedP1.totalParagraphs).toBe(2);
      expect(scopedP1.criteria).toHaveLength(1);
      expect(scopedP1.criteria[0]?.id).toBe("crit_sw_def");

      const auditP1 = await evaluateStudentAnswer({
        attemptId: "att_sw_1",
        studySetId: "set_sw",
        questionId: "q_sw_1",
        question: "Define the term i) Software ii) Software Engineering.",
        referenceAnswer: twoParagraphAnswer,
        transcript:
          "Software is a set of instructions and computer programs used to operate computers and perform tasks.",
        criteria: twoParagraphCriteria,
        scope: { type: "paragraph", paragraphIndex: 0 },
        mockFallback: true,
      });

      expect(auditP1.scope.type).toBe("paragraph");
      expect(auditP1.scope.paragraphIndex).toBe(0);
      expect(auditP1.criteriaEvaluations).toHaveLength(1);
      expect(auditP1.criteriaEvaluations[0]?.criterionId).toBe("crit_sw_def");
      expect(auditP1.overall.coveredCount).toBe(1);
      expect(auditP1.overall.whatNeedsAttention).not.toContain(
        "Software Engineering Definition"
      );
    });

    it("evaluates Paragraph 2 cleanly without throwing Cannot resolve selected Paragraph 2", async () => {
      const scopedP2 = resolvePracticeScope({
        referenceAnswer: twoParagraphAnswer,
        criteria: twoParagraphCriteria,
        scope: { type: "paragraph", paragraphIndex: 1 },
      });

      expect(scopedP2.isParagraph).toBe(true);
      expect(scopedP2.paragraphIndex).toBe(1);
      expect(scopedP2.totalParagraphs).toBe(2);
      expect(scopedP2.criteria).toHaveLength(1);
      expect(scopedP2.criteria[0]?.id).toBe("crit_se_def");

      const auditP2 = await evaluateStudentAnswer({
        attemptId: "att_sw_2",
        studySetId: "set_sw",
        questionId: "q_sw_1",
        question: "Define the term i) Software ii) Software Engineering.",
        referenceAnswer: twoParagraphAnswer,
        transcript:
          "Software engineering is a systematic and disciplined approach to software development and maintenance.",
        criteria: twoParagraphCriteria,
        scope: { type: "paragraph", paragraphIndex: 1 },
        mockFallback: true,
      });

      expect(auditP2.scope.type).toBe("paragraph");
      expect(auditP2.scope.paragraphIndex).toBe(1);
      expect(auditP2.criteriaEvaluations).toHaveLength(1);
      expect(auditP2.criteriaEvaluations[0]?.criterionId).toBe("crit_se_def");
      expect(auditP2.overall.coveredCount).toBe(1);
      // Paragraph 1 concept must NOT be marked missing
      expect(auditP2.overall.whatNeedsAttention).not.toContain(
        "Software Definition"
      );
    });
  });

  // Test L — Backward compatibility resilience when referenceAnswer is pre-scoped
  it("Test L: resolves Paragraph 2 when referenceAnswer contains only pre-scoped targetText", () => {
    const p2Text =
      "Software Engineering is a systematic, disciplined, and quantifiable approach to the development, operation, and maintenance of software.";

    const scoped = resolvePracticeScope({
      referenceAnswer: p2Text, // Only Paragraph 2 passed as referenceAnswer
      criteria: [
        {
          id: "crit_se_def",
          name: "Software Engineering Definition",
          category: "essential_concept",
          description: "Systematic approach to software.",
          satisfactoryDemonstration:
            "Explains systematic engineering approach.",
          isMandatory: true,
          orderIndex: 0,
        },
      ],
      scope: {
        type: "paragraph",
        paragraphIndex: 1,
        totalParagraphs: 2,
        targetText: p2Text,
      },
    });

    expect(scoped.isParagraph).toBe(true);
    expect(scoped.paragraphIndex).toBe(1);
    expect(scoped.totalParagraphs).toBe(2);
    expect(scoped.paragraphText).toBe(p2Text);
    expect(scoped.criteria).toHaveLength(1);
  });

  // Test M — Non-matching / unresolvable paragraph throws descriptive recoverable error
  it("Test M: throws descriptive error when paragraphIndex is truly unresolvable without silent fallback", () => {
    expect(() =>
      resolvePracticeScope({
        referenceAnswer: "Single paragraph answer here without paragraph 2.",
        criteria: [],
        scope: {
          type: "paragraph",
          paragraphIndex: 1, // Requests Paragraph 2 which does not exist and doesn't match targetText
        },
      })
    ).toThrowError(
      "Cannot resolve selected Paragraph 2 from reference answer (found 1 paragraphs)."
    );
  });

  // Test N — POST /api/audit route handler with Paragraph 2 scope
  describe("Test N: POST /api/audit route handler with paragraph practice", () => {
    const twoParagraphAnswer =
      "Software is a collection of instructions, data, or programs used to operate computers and execute specific tasks.\n\n" +
      "Software Engineering is a systematic, disciplined, and quantifiable approach to the development, operation, and maintenance of software.";

    it("POST /api/audit succeeds with 200 OK for Paragraph 2 when full referenceAnswer is provided", async () => {
      const p2Text = extractParagraphs(twoParagraphAnswer)[1]!;
      const req = new NextRequest("http://localhost:3000/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: "att_route_p2",
          studySetId: "set_route_test",
          questionId: "q_sw_1",
          question: "Define the term i) Software ii) Software Engineering.",
          referenceAnswer: twoParagraphAnswer,
          transcript:
            "Software engineering is a systematic approach to designing and maintaining software.",
          criteria: [
            {
              id: "crit_p1",
              name: "Software Definition",
              category: "essential_concept",
              description: "Instructions for computers",
              satisfactoryDemonstration: "Explains software instructions",
              isMandatory: true,
              orderIndex: 0,
            },
            {
              id: "crit_p2",
              name: "Software Engineering Definition",
              category: "essential_concept",
              description: "Systematic approach to software",
              satisfactoryDemonstration: "Explains disciplined engineering",
              isMandatory: true,
              orderIndex: 1,
            },
          ],
          scope: {
            type: "paragraph",
            paragraphIndex: 1,
            totalParagraphs: 2,
            targetText: p2Text,
          },
          mockFallback: true,
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.audit).toBeDefined();
      expect(data.audit.scope.type).toBe("paragraph");
      expect(data.audit.scope.paragraphIndex).toBe(1);
      expect(data.audit.criteriaEvaluations).toHaveLength(1);
      expect(data.audit.criteriaEvaluations[0].criterionId).toBe("crit_p2");
    });

    it("POST /api/audit succeeds with 200 OK for pre-scoped backward-compatible payload", async () => {
      const p2Text = extractParagraphs(twoParagraphAnswer)[1]!;
      const req = new NextRequest("http://localhost:3000/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: "att_route_p2_legacy",
          studySetId: "set_route_test",
          questionId: "q_sw_1",
          question: "Define the term i) Software ii) Software Engineering.",
          referenceAnswer: p2Text, // Pre-scoped text passed as referenceAnswer
          transcript:
            "Software engineering is a systematic approach to designing and maintaining software.",
          criteria: [
            {
              id: "crit_p2",
              name: "Software Engineering Definition",
              category: "essential_concept",
              description: "Systematic approach to software",
              satisfactoryDemonstration: "Explains disciplined engineering",
              isMandatory: true,
              orderIndex: 0,
            },
          ],
          scope: {
            type: "paragraph",
            paragraphIndex: 1,
            totalParagraphs: 2,
            targetText: p2Text,
          },
          mockFallback: true,
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.audit.scope.paragraphIndex).toBe(1);
      expect(data.audit.criteriaEvaluations).toHaveLength(1);
    });

    it("POST /api/audit returns 500 with descriptive error when paragraph cannot be resolved", async () => {
      const req = new NextRequest("http://localhost:3000/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: "att_route_invalid",
          studySetId: "set_route_test",
          questionId: "q_sw_1",
          question: "Define software.",
          referenceAnswer: "Single paragraph answer.",
          transcript: "Some spoken explanation.",
          criteria: [],
          scope: {
            type: "paragraph",
            paragraphIndex: 5, // Out of bounds
          },
          mockFallback: true,
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Cannot resolve selected Paragraph 6");
    });
  });
});
