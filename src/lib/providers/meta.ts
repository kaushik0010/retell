import "server-only";

import type { z } from "zod";
import { categorizeHttpError, sanitizeError } from "./errors";
import type {
  MetaServerEvent,
  ProviderDiagnostic,
  ReasoningProvider,
  ReasoningRequest,
  ReasoningResponse,
  TranscriptionHandshakePayload,
  TranscriptionProvider,
  TranscriptionSessionConfig,
} from "./types";

const DEFAULT_META_REASONING_MODEL = "muse-spark-1.3";
const DEFAULT_META_TRANSCRIPTION_MODEL = "muse-voice-transcribe-1.0";
const META_BASE_URL = "https://api.meta.ai/v1";
const META_TRANSCRIPTION_WS = "wss://api.meta.ai/v1/asr/realtime";
const DEFAULT_TIMEOUT_MS = 25000;

export class MetaReasoningProvider implements ReasoningProvider {
  public readonly id = "meta" as const;
  public readonly modelId: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.META_MODEL_API_KEY?.trim();
    this.modelId =
      process.env.META_REASONING_MODEL?.trim() || DEFAULT_META_REASONING_MODEL;
    this.baseUrl = META_BASE_URL;
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
            "META_MODEL_API_KEY is not defined or is empty in server environment.",
        },
      };
    }

    const startTime = Date.now();
    try {
      // Lightweight models or completions probe with minimal tokens
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
      `meta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
            "META_MODEL_API_KEY is missing. Configure it in .env.local to enable Meta reasoning calls.",
        },
      };
    }

    const timeoutMs = request.timeoutMs || DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    // Prepare messages: ensure instructions emphasize strictly valid JSON
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
          // Retry on 429 or 5xx once
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

        // Parse and validate with Zod
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawContent);
        } catch {
          // Attempt markdown fence strip if present
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

export class MetaTranscriptionProvider implements TranscriptionProvider {
  public readonly id = "meta" as const;
  public readonly modelId: string;
  public readonly endpoint: string;
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.META_MODEL_API_KEY?.trim();
    this.modelId =
      process.env.META_TRANSCRIPTION_MODEL?.trim() ||
      DEFAULT_META_TRANSCRIPTION_MODEL;
    this.endpoint = META_TRANSCRIPTION_WS;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public createHandshakePayload(
    apiKey: string,
    config?: Partial<TranscriptionSessionConfig>
  ): TranscriptionHandshakePayload {
    const rawKey = apiKey.trim();
    const token = rawKey.startsWith("Bearer ") ? rawKey : `Bearer ${rawKey}`;
    const encoding = config?.sampleRate === 16000 ? "PCM_16KHZ" : "PCM_24KHZ";

    return {
      authorization: {
        accessToken: token,
      },
      audioEncoding: encoding,
      model: this.modelId,
      mode: config?.mode || "PUSH_TO_TALK",
      ...(config?.languageBias && config.languageBias.length > 0
        ? { languageBias: config.languageBias }
        : {}),
      ...(config?.keywords && config.keywords.length > 0
        ? { keywords: config.keywords }
        : {}),
    };
  }

  public createEndStreamMessage(): string {
    return JSON.stringify({ type: "endStream" });
  }

  public parseServerMessage(raw: string): MetaServerEvent | null {
    try {
      return JSON.parse(raw) as MetaServerEvent;
    } catch {
      return null;
    }
  }
}
