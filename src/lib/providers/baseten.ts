import "server-only";

import type { z } from "zod";
import { categorizeHttpError, sanitizeError } from "./errors";
import type {
  ProviderDiagnostic,
  ReasoningProvider,
  ReasoningRequest,
  ReasoningResponse,
} from "./types";

const DEFAULT_BASETEN_REASONING_MODEL = "meta-models/muse-spark-open-1026";
const BASETEN_BASE_URL = "https://inference.baseten.co/v1";
const DEFAULT_TIMEOUT_MS = 25000;

export class BasetenReasoningProvider implements ReasoningProvider {
  public readonly id = "baseten" as const;
  public readonly modelId: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.BASETEN_API_KEY?.trim();
    this.modelId =
      process.env.BASETEN_REASONING_MODEL?.trim() ||
      DEFAULT_BASETEN_REASONING_MODEL;
    this.baseUrl = BASETEN_BASE_URL;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public async checkHealth(): Promise<ProviderDiagnostic> {
    if (!this.isConfigured()) {
      return {
        provider: this.id,
        model: this.modelId,
        configured: false,
        reachable: false,
        error: {
          category: "MISSING_API_KEY",
          message:
            "BASETEN_API_KEY is not defined or is empty in server environment.",
        },
      };
    }

    const startTime = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.modelId,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10000),
      });

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const body = await res.text();
        return {
          provider: this.id,
          model: this.modelId,
          configured: true,
          reachable: false,
          latencyMs,
          error: categorizeHttpError(res.status, body),
        };
      }

      return {
        provider: this.id,
        model: this.modelId,
        configured: true,
        reachable: true,
        latencyMs,
      };
    } catch (err) {
      return {
        provider: this.id,
        model: this.modelId,
        configured: true,
        reachable: false,
        latencyMs: Date.now() - startTime,
        error: sanitizeError(err),
      };
    }
  }

  public async generateStructured<T>(
    request: ReasoningRequest,
    schema: z.ZodType<T>
  ): Promise<ReasoningResponse<T>> {
    const correlationId =
      request.correlationId ||
      `baseten_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.id,
        model: this.modelId,
        rawContent: "",
        latencyMs: 0,
        correlationId,
        error: {
          category: "MISSING_API_KEY",
          message:
            "BASETEN_API_KEY is missing. Configure it in .env.local to enable Baseten reasoning calls.",
        },
      };
    }

    const timeoutMs = request.timeoutMs || DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    const messages = [...request.messages];
    const hasSystem = messages.some((m) => m.role === "system");
    if (!hasSystem) {
      messages.unshift({
        role: "system",
        content:
          "You are an expert educational reasoning assistant. You MUST return ONLY valid JSON matching the requested schema. Do not enclose in markdown backticks.",
      });
    }

    const payload = {
      model: this.modelId,
      messages,
      response_format: { type: "json_object" },
      ...(typeof request.temperature === "number"
        ? { temperature: request.temperature }
        : {}),
    };

    let attempt = 0;
    const maxRetries = 1;

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(timeoutMs),
        });

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
          const errorBody = await response.text();
          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < maxRetries
          ) {
            attempt++;
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }

          return {
            success: false,
            provider: this.id,
            model: this.modelId,
            rawContent: "",
            latencyMs,
            correlationId,
            error: categorizeHttpError(response.status, errorBody),
          };
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };

        const rawContent = data.choices?.[0]?.message?.content?.trim() || "";

        if (!rawContent) {
          return {
            success: false,
            provider: this.id,
            model: this.modelId,
            rawContent: "",
            latencyMs,
            correlationId,
            error: {
              category: "INVALID_RESPONSE_FORMAT",
              message: "Model returned an empty content string.",
            },
          };
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawContent);
        } catch {
          const clean = rawContent
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();
          try {
            parsedJson = JSON.parse(clean);
          } catch {
            return {
              success: false,
              provider: this.id,
              model: this.modelId,
              rawContent,
              latencyMs,
              correlationId,
              error: {
                category: "INVALID_RESPONSE_FORMAT",
                message: "Model response could not be parsed as valid JSON.",
              },
            };
          }
        }

        const validation = schema.safeParse(parsedJson);
        if (!validation.success) {
          return {
            success: false,
            provider: this.id,
            model: this.modelId,
            rawContent,
            latencyMs,
            correlationId,
            error: {
              category: "SCHEMA_VALIDATION_ERROR",
              message: `Structured output validation failed: ${validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
            },
          };
        }

        return {
          success: true,
          provider: this.id,
          model: this.modelId,
          rawContent,
          data: validation.data,
          latencyMs,
          correlationId,
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
            totalTokens: data.usage?.total_tokens,
          },
        };
      } catch (err) {
        if (attempt < maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }

        return {
          success: false,
          provider: this.id,
          model: this.modelId,
          rawContent: "",
          latencyMs: Date.now() - startTime,
          correlationId,
          error: sanitizeError(err),
        };
      }
    }

    return {
      success: false,
      provider: this.id,
      model: this.modelId,
      rawContent: "",
      latencyMs: Date.now() - startTime,
      correlationId,
      error: {
        category: "UNKNOWN_ERROR",
        message: "Maximum retries exhausted without a response.",
      },
    };
  }
}
