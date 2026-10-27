import type { z } from "zod";

export type ProviderId = "meta" | "baseten";

export type SanitizedErrorCategory =
  | "MISSING_API_KEY"
  | "INVALID_CONFIGURATION"
  | "AUTHENTICATION_ERROR"
  | "RATE_LIMIT_ERROR"
  | "MODEL_UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE_FORMAT"
  | "SCHEMA_VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ReasoningRequest {
  messages: ChatMessage[];
  responseFormat?: "json_object" | "json_schema";
  temperature?: number;
  correlationId?: string;
  timeoutMs?: number;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ProviderError {
  category: SanitizedErrorCategory;
  message: string;
  statusCode?: number;
}

export interface ReasoningResponse<T> {
  success: boolean;
  provider: ProviderId;
  model: string;
  rawContent: string;
  data?: T;
  latencyMs: number;
  correlationId?: string;
  usage?: TokenUsage;
  error?: ProviderError;
}

export interface ProviderDiagnostic {
  provider: ProviderId;
  model: string;
  configured: boolean;
  reachable: boolean;
  latencyMs?: number;
  error?: ProviderError;
}

export interface ReasoningProvider {
  readonly id: ProviderId;
  readonly modelId: string;
  isConfigured(): boolean;
  generateStructured<T>(
    request: ReasoningRequest,
    schema: z.ZodType<T>
  ): Promise<ReasoningResponse<T>>;
  checkHealth(): Promise<ProviderDiagnostic>;
}

// Transcription-specific contracts
export interface TranscriptionSessionConfig {
  modelId: string;
  sampleRate: number;
  mode: "PUSH_TO_TALK" | "STREAMING";
  languageBias?: string[];
  keywords?: string[];
}

export interface TranscriptionHandshakePayload {
  api_key: string;
  model: string;
  mode: string;
  audioEncoding: "PCM_16KHZ" | "PCM_24KHZ" | "WAV";
  sample_rate: number;
  language_bias?: string[];
  keywords?: string[];
}

export interface TranscriptionProvider {
  readonly id: "meta";
  readonly modelId: string;
  readonly endpoint: string;
  isConfigured(): boolean;
  createHandshakePayload(
    apiKey: string,
    config?: Partial<TranscriptionSessionConfig>
  ): TranscriptionHandshakePayload;
}
