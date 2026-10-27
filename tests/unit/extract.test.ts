import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../src/app/api/extract/route";
import * as providersModule from "../../src/lib/providers";

describe("POST /api/extract Route Handler (Source-Grounded Extraction)", () => {
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

  it("extracts existing questions and reference answers with found_qa status", async () => {
    const mockOutput = {
      status: "found_qa",
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
          "Question: How does a recursive resolver resolve a hostname? Answer: The recursive resolver iteratively queries root, TLD, and authoritative nameservers.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("found_qa");
    expect(data.studyMaterial.title).toBe("DNS Resolution Flow");
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].question).toBe(
      "How does a recursive resolver resolve a hostname?"
    );
  });

  it("returns missing_question without inventing questions when text contains only explanatory notes", async () => {
    const mockOutput = {
      status: "missing_question",
      guidanceMessage:
        "We found your study notes, but couldn't find your exam questions. What question will your exam ask about this material?",
      detectedContent:
        "Notes explaining the difference between recursive and iterative DNS resolution.",
      suggestedTitle: "DNS Notes",
      questions: [],
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
        latencyMs: 110,
      }),
      checkHealth: vi.fn(),
    });

    const req = new NextRequest("http://localhost:3000/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText:
          "DNS resolution is a process that translates domain names into numerical IP addresses. Root servers refer to TLD servers.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("missing_question");
    expect(data.questions).toHaveLength(0);
    expect(data.message).toContain("couldn't find your exam questions");
  });

  it("returns missing_answer when material contains only questions without answers", async () => {
    const mockOutput = {
      status: "missing_answer",
      guidanceMessage:
        "We found your question, but couldn't find the answer in your material. Please paste the answer you want to study from.",
      questions: [],
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
        latencyMs: 90,
      }),
      checkHealth: vi.fn(),
    });

    const req = new NextRequest("http://localhost:3000/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText:
          "1. What is the difference between TCP and UDP? 2. When would you use UDP over TCP?",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("missing_answer");
    expect(data.questions).toHaveLength(0);
  });

  it("pairs student-supplied question with grounded answer when studentQuestion is provided", async () => {
    const mockOutput = {
      status: "found_qa",
      suggestedTitle: "DNS Resolution Mechanism",
      questions: [
        {
          question: "Explain the DNS resolution process step by step.",
          referenceAnswer:
            "The client contacts a recursive resolver which queries root, TLD, and authoritative servers.",
          sourceExcerpt: "Root servers refer to TLD servers.",
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
        latencyMs: 140,
      }),
      checkHealth: vi.fn(),
    });

    const req = new NextRequest("http://localhost:3000/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceText:
          "DNS resolution translates domain names to IPs. The client contacts a recursive resolver which queries root, TLD, and authoritative servers.",
        studentQuestion: "Explain the DNS resolution process step by step.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.status).toBe("found_qa");
    expect(data.questions).toHaveLength(1);
    expect(data.questions[0].question).toBe(
      "Explain the DNS resolution process step by step."
    );
  });
});
