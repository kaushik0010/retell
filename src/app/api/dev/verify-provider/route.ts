import { NextRequest, NextResponse } from "next/server";
import {
  BasetenReasoningProvider,
  MetaReasoningProvider,
  ProviderVerifyRequestSchema,
  SmokeTestOutputSchema,
  type ProviderId,
  type SmokeTestOutput,
} from "@/lib/providers";

export const dynamic = "force-dynamic";

interface SmokeTestResult {
  provider: ProviderId;
  model: string;
  configured: boolean;
  success: boolean;
  latencyMs: number;
  validationOutcome: "passed" | "failed" | "skipped";
  parsedOutput?: SmokeTestOutput;
  error?: {
    category: string;
    message: string;
    statusCode?: number;
  };
}

async function runSmokeTest(providerId: ProviderId): Promise<SmokeTestResult> {
  const provider =
    providerId === "meta"
      ? new MetaReasoningProvider()
      : new BasetenReasoningProvider();

  if (!provider.isConfigured()) {
    return {
      provider: providerId,
      model: provider.modelId,
      configured: false,
      success: false,
      latencyMs: 0,
      validationOutcome: "skipped",
      error: {
        category: "MISSING_API_KEY",
        message: `API key for ${providerId.toUpperCase()} is not set in environment.`,
      },
    };
  }

  const prompt = [
    {
      role: "system" as const,
      content:
        'You are a verification assistant. Respond ONLY with a valid JSON object matching this schema: {"status": "ok", "message": "Smoke test successful", "concepts": ["concept_a", "concept_b"]}. No markdown backticks.',
    },
    {
      role: "user" as const,
      content:
        'Return a JSON object verifying active reasoning capability with status "ok", message "Retell verification ready", and two short concepts related to spoken active recall.',
    },
  ];

  const response = await provider.generateStructured(
    { messages: prompt, temperature: 0.1, timeoutMs: 25000 },
    SmokeTestOutputSchema
  );

  return {
    provider: providerId,
    model: provider.modelId,
    configured: true,
    success: response.success,
    latencyMs: response.latencyMs,
    validationOutcome: response.success
      ? "passed"
      : response.error?.category === "SCHEMA_VALIDATION_ERROR"
        ? "failed"
        : "skipped",
    parsedOutput: response.data,
    error: response.error,
  };
}

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Verification endpoints are disabled in production mode." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const providerParam = searchParams.get("provider") || "all";

  const parsed = ProviderVerifyRequestSchema.safeParse({
    provider: providerParam,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider parameter. Use 'meta', 'baseten', or 'all'." },
      { status: 400 }
    );
  }

  const target = parsed.data.provider;
  const results: SmokeTestResult[] = [];

  if (target === "meta" || target === "all") {
    results.push(await runSmokeTest("meta"));
  }

  if (target === "baseten" || target === "all") {
    results.push(await runSmokeTest("baseten"));
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
  });
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Verification endpoints are disabled in production mode." },
      { status: 403 }
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // defaults to empty
  }

  const parsed = ProviderVerifyRequestSchema.safeParse(body);
  const target = parsed.success ? parsed.data.provider : "all";

  const results: SmokeTestResult[] = [];

  if (target === "meta" || target === "all") {
    results.push(await runSmokeTest("meta"));
  }

  if (target === "baseten" || target === "all") {
    results.push(await runSmokeTest("baseten"));
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results,
  });
}
