import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../src/app/api/rubric/route";
import * as providersModule from "../../src/lib/providers";

describe("POST /api/rubric Route Handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for payload missing questionId or too short fields", async () => {
    const req = new NextRequest("http://localhost:3000/api/rubric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: "",
        question: "Q",
        referenceAnswer: "A",
        sourceText: "Too short",
        studyMaterialId: "",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Invalid request payload");
  });

  it("returns 503 if reasoning provider is not configured", async () => {
    vi.spyOn(providersModule, "getReasoningProvider").mockReturnValue({
      id: "meta",
      modelId: "muse-spark-1.3",
      isConfigured: () => false,
      generateStructured: vi.fn(),
      checkHealth: vi.fn(),
    });

    const req = new NextRequest("http://localhost:3000/api/rubric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: "q_100",
        question: "How does the F0 rotor rotate in ATP synthase?",
        referenceAnswer:
          "Protons enter the inlet channel of subunit a and protonate the c-ring, causing rotary motion.",
        sourceText:
          "Protons enter an inlet half-channel in subunit a of the F0 domain, protonating the c-ring rotor.",
        studyMaterialId: "mat_100",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Reasoning provider is not configured");
  });

  it("returns 200 with structured criteria adhering to semantic rubric schema", async () => {
    const mockOutput = {
      criteria: [
        {
          category: "essential_concept",
          name: "Subunit 'a' Proton Channel",
          description:
            "Explanation of protons entering the inlet half-channel.",
          satisfactoryDemonstration:
            "Student conveys that protons enter through the stationary subunit a channel.",
          isMandatory: true,
        },
        {
          category: "relationship_sequence",
          name: "c-ring Rotary Motion",
          description: "Rotation of the c-ring driving the central stalk.",
          satisfactoryDemonstration:
            "Student describes how protonation induces mechanical rotation of the c-ring.",
          isMandatory: true,
        },
      ],
    };

    vi.spyOn(providersModule, "getReasoningProvider").mockReturnValue({
      id: "meta",
      modelId: "muse-spark-1.3",
      isConfigured: () => true,
      generateStructured: vi.fn().mockResolvedValue({
        success: true,
        provider: "meta",
        model: "muse-spark-1.3",
        rawContent: JSON.stringify(mockOutput),
        data: mockOutput,
        latencyMs: 150,
      }),
      checkHealth: vi.fn(),
    });

    const req = new NextRequest("http://localhost:3000/api/rubric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionId: "q_100",
        question: "How does the F0 rotor rotate in ATP synthase?",
        referenceAnswer:
          "Protons enter the inlet channel of subunit a and protonate the c-ring, causing rotary motion.",
        sourceText:
          "Protons enter an inlet half-channel in subunit a of the F0 domain, protonating the c-ring rotor.",
        studyMaterialId: "mat_100",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.rubric.id).toMatch(/^rub_/);
    expect(data.rubric.questionId).toBe("q_100");
    expect(data.rubric.criteria).toHaveLength(2);
    expect(data.rubric.criteria[0].id).toMatch(/^crit_/);
    expect(data.rubric.criteria[0].category).toBe("essential_concept");
    expect(data.rubric.criteria[1].category).toBe("relationship_sequence");
  });
});
