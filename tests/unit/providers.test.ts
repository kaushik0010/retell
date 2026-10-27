import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SmokeTestOutputSchema } from "../../src/lib/providers/schemas";
import {
  BasetenReasoningProvider,
  MetaReasoningProvider,
  MetaTranscriptionProvider,
} from "../../src/lib/providers";

describe("Provider Adapters (Unit & Offline Validation)", () => {
  const originalMetaKey = process.env.META_MODEL_API_KEY;
  const originalBasetenKey = process.env.BASETEN_API_KEY;

  beforeEach(() => {
    delete process.env.META_MODEL_API_KEY;
    delete process.env.BASETEN_API_KEY;
  });

  afterEach(() => {
    if (originalMetaKey !== undefined) {
      process.env.META_MODEL_API_KEY = originalMetaKey;
    }
    if (originalBasetenKey !== undefined) {
      process.env.BASETEN_API_KEY = originalBasetenKey;
    }
  });

  describe("MetaReasoningProvider", () => {
    it("reports not configured when META_MODEL_API_KEY is unset", () => {
      const provider = new MetaReasoningProvider();
      expect(provider.isConfigured()).toBe(false);
      expect(provider.modelId).toBe("muse-spark-1.3");
    });

    it("rejects generateStructured immediately with MISSING_API_KEY if unconfigured", async () => {
      const provider = new MetaReasoningProvider();
      const res = await provider.generateStructured(
        { messages: [{ role: "user", content: "test" }] },
        SmokeTestOutputSchema
      );
      expect(res.success).toBe(false);
      expect(res.error?.category).toBe("MISSING_API_KEY");
      expect(res.latencyMs).toBe(0);
    });

    it("reports healthy diagnostic as unconfigured", async () => {
      const provider = new MetaReasoningProvider();
      const health = await provider.checkHealth();
      expect(health.configured).toBe(false);
      expect(health.reachable).toBe(false);
      expect(health.error?.category).toBe("MISSING_API_KEY");
    });
  });

  describe("BasetenReasoningProvider", () => {
    it("reports not configured when BASETEN_API_KEY is unset", () => {
      const provider = new BasetenReasoningProvider();
      expect(provider.isConfigured()).toBe(false);
      expect(provider.modelId).toBe("meta-models/muse-spark-open-1026");
    });

    it("rejects generateStructured immediately with MISSING_API_KEY if unconfigured", async () => {
      const provider = new BasetenReasoningProvider();
      const res = await provider.generateStructured(
        { messages: [{ role: "user", content: "test" }] },
        SmokeTestOutputSchema
      );
      expect(res.success).toBe(false);
      expect(res.error?.category).toBe("MISSING_API_KEY");
      expect(res.latencyMs).toBe(0);
    });
  });

  describe("MetaTranscriptionProvider", () => {
    it("constructs correct handshake payload with PCM_16KHZ audio encoding", () => {
      const provider = new MetaTranscriptionProvider();
      expect(provider.endpoint).toBe("wss://api.meta.ai/v1/asr/realtime");
      expect(provider.modelId).toBe("muse-voice-transcribe-1.0");

      const payload = provider.createHandshakePayload("mock_test_key", {
        mode: "PUSH_TO_TALK",
        sampleRate: 16000,
      });

      expect(payload.api_key).toBe("mock_test_key");
      expect(payload.model).toBe("muse-voice-transcribe-1.0");
      expect(payload.audioEncoding).toBe("PCM_16KHZ");
      expect(payload.sample_rate).toBe(16000);
      expect(payload.mode).toBe("PUSH_TO_TALK");
    });
  });
});
