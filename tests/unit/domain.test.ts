import { describe, expect, it } from "vitest";
import {
  ExtractRequestSchema,
  ExtractedQuestionSchema,
  QuestionRubricSchema,
  RubricCriterionCategorySchema,
  RubricCriterionSchema,
  RubricRequestSchema,
  StudyMaterialSchema,
  StudySetSchema,
  ExtractionStatusSchema,
  RUBRIC_CATEGORY_META,
  ExtractResponseSchema,
} from "../../src/lib/domain/study-set";

describe("Domain Models and Zod Schemas", () => {
  describe("RubricCriterionCategorySchema and Student Labels", () => {
    it("accepts all five valid criterion categories", () => {
      const categories = [
        "essential_concept",
        "technical_anchor",
        "relationship_sequence",
        "accuracy_constraint",
        "optional_detail",
      ];
      for (const cat of categories) {
        expect(RubricCriterionCategorySchema.safeParse(cat).success).toBe(true);
      }
    });

    it("rejects unknown category", () => {
      expect(
        RubricCriterionCategorySchema.safeParse("arbitrary_category").success
      ).toBe(false);
    });

    it("maps categories strictly to student-friendly vocabulary without developer jargon", () => {
      expect(RUBRIC_CATEGORY_META.essential_concept.studentLabel).toBe(
        "Main idea"
      );
      expect(RUBRIC_CATEGORY_META.technical_anchor.studentLabel).toBe(
        "Key term"
      );
      expect(RUBRIC_CATEGORY_META.relationship_sequence.studentLabel).toBe(
        "Steps in order"
      );
      expect(RUBRIC_CATEGORY_META.accuracy_constraint.studentLabel).toBe(
        "Mistakes to avoid"
      );
      expect(RUBRIC_CATEGORY_META.optional_detail.studentLabel).toBe(
        "Helpful extra"
      );

      // Verify no developer jargon in student labels
      for (const meta of Object.values(RUBRIC_CATEGORY_META)) {
        expect(meta.studentLabel.toLowerCase()).not.toContain("rubric");
        expect(meta.studentLabel.toLowerCase()).not.toContain("anchor");
        expect(meta.studentLabel.toLowerCase()).not.toContain("constraint");
      }
    });
  });

  describe("ExtractionStatusSchema", () => {
    it("validates all four source-grounded extraction statuses", () => {
      expect(ExtractionStatusSchema.safeParse("found_qa").success).toBe(true);
      expect(ExtractionStatusSchema.safeParse("missing_question").success).toBe(
        true
      );
      expect(ExtractionStatusSchema.safeParse("missing_answer").success).toBe(
        true
      );
      expect(ExtractionStatusSchema.safeParse("unclear").success).toBe(true);
      expect(
        ExtractionStatusSchema.safeParse("invented_question").success
      ).toBe(false);
    });
  });

  describe("RubricCriterionSchema", () => {
    it("validates a conforming criterion", () => {
      const valid = {
        id: "crit_123",
        category: "essential_concept",
        name: "Proton Motive Force",
        description:
          "Explains how the electrochemical gradient drives ATP synthesis.",
        satisfactoryDemonstration:
          "Student explains the chemical (pH) and electrical gradient in their own words.",
        isMandatory: true,
        orderIndex: 0,
      };

      const result = RubricCriterionSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Proton Motive Force");
        expect(result.data.isMandatory).toBe(true);
      }
    });

    it("rejects criterion with empty name or description", () => {
      const invalid = {
        id: "crit_123",
        category: "essential_concept",
        name: "",
        description: "",
        satisfactoryDemonstration: "Guidance",
        isMandatory: true,
      };
      expect(RubricCriterionSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("QuestionRubricSchema", () => {
    it("validates a complete question rubric", () => {
      const valid = {
        id: "rub_123",
        questionId: "q_456",
        studyMaterialId: "mat_789",
        criteria: [
          {
            id: "crit_1",
            category: "essential_concept",
            name: "F0 / F1 domains",
            description:
              "Differentiates membrane F0 rotor from matrix F1 head.",
            satisfactoryDemonstration: "Mentions rotor and catalytic head.",
            isMandatory: true,
            orderIndex: 0,
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      expect(QuestionRubricSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects a rubric with zero criteria", () => {
      const invalid = {
        id: "rub_123",
        questionId: "q_456",
        studyMaterialId: "mat_789",
        criteria: [],
        updatedAt: new Date().toISOString(),
      };
      expect(QuestionRubricSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("ExtractedQuestionSchema", () => {
    it("validates a well-formed extracted question", () => {
      const valid = {
        id: "q_1",
        studyMaterialId: "mat_1",
        orderIndex: 0,
        question: "Explain the role of the F0 domain in ATP synthase.",
        referenceAnswer:
          "The F0 domain acts as a membrane-embedded rotary motor powered by proton transit.",
        sourceExcerpt: "Protons enter an inlet half-channel in subunit a.",
      };
      expect(ExtractedQuestionSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects question with too short text", () => {
      const invalid = {
        id: "q_1",
        studyMaterialId: "mat_1",
        orderIndex: 0,
        question: "Why?",
        referenceAnswer: "Too short",
      };
      expect(ExtractedQuestionSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe("StudyMaterialSchema & StudySetSchema", () => {
    it("validates StudyMaterialSchema independently", () => {
      const now = new Date().toISOString();
      const material = {
        id: "mat_test",
        title: "Distributed Consensus",
        sourceText:
          "Paxos ensures consensus across an asynchronous network of unreliable nodes.",
        characterCount: 76,
        createdAt: now,
        updatedAt: now,
      };
      expect(StudyMaterialSchema.safeParse(material).success).toBe(true);
    });

    it("validates a full study set aggregate", () => {
      const now = new Date().toISOString();
      const material = {
        id: "mat_abc",
        title: "Biochemistry Exam Review",
        sourceText:
          "This is a comprehensive study guide about cellular respiration and ATP synthase.",
        characterCount: 82,
        createdAt: now,
        updatedAt: now,
      };

      const question = {
        id: "q_abc",
        studyMaterialId: "mat_abc",
        orderIndex: 0,
        question: "How does the proton gradient drive ATP synthesis?",
        referenceAnswer:
          "Protons flow down their electrochemical gradient through ATP synthase.",
        sourceExcerpt: "Protons flow through ATP synthase.",
      };

      const rubric = {
        id: "rub_abc",
        questionId: "q_abc",
        studyMaterialId: "mat_abc",
        criteria: [
          {
            id: "crit_abc",
            category: "essential_concept" as const,
            name: "Chemiosmotic Coupling",
            description: "PMF coupling to phosphorylation.",
            satisfactoryDemonstration:
              "Mentions coupling between proton flow and ATP generation.",
            isMandatory: true,
            orderIndex: 0,
          },
        ],
        updatedAt: now,
      };

      const studySet = {
        id: "mat_abc",
        material,
        questions: [question],
        rubrics: { [question.id]: rubric },
        createdAt: now,
        updatedAt: now,
      };

      const result = StudySetSchema.safeParse(studySet);
      expect(result.success).toBe(true);
    });
  });

  describe("API Request and Response Schemas", () => {
    it("validates ExtractRequestSchema with sufficient length and optional studentQuestion", () => {
      const valid = {
        title: "DNS Resolution",
        sourceText:
          "The Domain Name System translates human readable hostnames into IP addresses.",
        studentQuestion: "How does a client resolve a domain name?",
      };
      expect(ExtractRequestSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects ExtractRequestSchema with sourceText under 20 characters", () => {
      const invalid = {
        sourceText: "Too short",
      };
      expect(ExtractRequestSchema.safeParse(invalid).success).toBe(false);
    });

    it("validates ExtractResponseSchema with status missing_question", () => {
      const missingQ = {
        success: true,
        status: "missing_question" as const,
        message:
          "We found your study notes, but couldn't find your exam questions.",
        detectedContent: "Notes about cell respiration",
      };
      expect(ExtractResponseSchema.safeParse(missingQ).success).toBe(true);
    });

    it("validates RubricRequestSchema", () => {
      const valid = {
        questionId: "q_100",
        question: "What is an authoritative nameserver?",
        referenceAnswer:
          "An authoritative nameserver holds the actual DNS records for a domain zone.",
        sourceText:
          "The recursive resolver contacts the Authoritative Name Server for example.com which holds the zone records.",
        studyMaterialId: "mat_100",
      };
      expect(RubricRequestSchema.safeParse(valid).success).toBe(true);
    });
  });
});
