import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../src/app/api/extract/route";
import * as providersModule from "../../src/lib/providers";

describe("POST /api/extract Route Handler", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for payload with sourceText under 20 characters", async () => {
    const req = new NextRequest("http://localhost:3000/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText: "Too short",
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

    const req = new NextRequest("http://localhost:3000/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText:
          "The Domain Name System (DNS) is a hierarchical naming system that maps domain names to IP addresses.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Reasoning provider is not configured");
  });

  it("returns 200 with extracted questions and study material on valid generation", async () => {
    const mockOutput = {
      suggestedTitle: "Computer Networks: DNS Resolution",
      questions: [
        {
          question: "How does a recursive resolver resolve a hostname?",
          referenceAnswer:
            "The recursive resolver iteratively queries root, TLD, and authoritative nameservers until obtaining the final A record.",
          sourceExcerpt:
            "The recursive resolver performs an iterative resolution sequence.",
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
        latencyMs: 120,
      }),
      checkHealth: vi.fn(),
    });

    const req = new NextRequest("http://localhost:3000/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "DNS Resolution Flow",
        sourceText:
          "The Domain Name System (DNS) is a hierarchical naming system that maps domain names to IP addresses.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.studyMaterial.title).toBe("DNS Resolution Flow");
    expect(data.studyMaterial.id).toMatch(/^mat_/);
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].id).toMatch(/^q_/);
    expect(data.questions[0].question).toBe(
      "How does a recursive resolver resolve a hostname?"
    );
  });
});
