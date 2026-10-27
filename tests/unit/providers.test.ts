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

  describe("MetaTranscriptionProvider (Official Protocol Handshake)", () => {
    it("constructs official handshake payload with authorization.accessToken and PCM_24KHZ default", () => {
      const provider = new MetaTranscriptionProvider();
      expect(provider.endpoint).toBe("wss://api.meta.ai/v1/asr/realtime");
      expect(provider.modelId).toBe("muse-voice-transcribe-1.0");

      const payload = provider.createHandshakePayload("test_secret_key");

      expect(payload.authorization.accessToken).toBe("Bearer test_secret_key");
      expect(payload.audioEncoding).toBe("PCM_24KHZ");
      expect(payload.model).toBe("muse-voice-transcribe-1.0");
      expect(payload.mode).toBe("PUSH_TO_TALK");
    });

    it("supports PCM_16KHZ encoding and languageBias when specified", () => {
      const provider = new MetaTranscriptionProvider();
      const payload = provider.createHandshakePayload(
        "Bearer already_prefixed_key",
        {
          sampleRate: 16000,
          mode: "STREAMING",
          languageBias: ["en"],
          keywords: ["Meta", "Retell"],
        }
      );

      expect(payload.authorization.accessToken).toBe(
        "Bearer already_prefixed_key"
      );
      expect(payload.audioEncoding).toBe("PCM_16KHZ");
      expect(payload.mode).toBe("STREAMING");
      expect(payload.languageBias).toEqual(["en"]);
      expect(payload.keywords).toEqual(["Meta", "Retell"]);
    });

    it("generates correct endStream JSON message", () => {
      const provider = new MetaTranscriptionProvider();
      const endStream = provider.createEndStreamMessage();
      expect(endStream).toBe('{"type":"endStream"}');
      const parsed = JSON.parse(endStream);
      expect(parsed.type).toBe("endStream");
    });

    it("parses server events accurately", () => {
      const provider = new MetaTranscriptionProvider();

      const ackRaw = '{"sessionId":"voyager/duplex/TEST12345"}';
      const ackParsed = provider.parseServerMessage(ackRaw);
      expect(ackParsed).toEqual({ sessionId: "voyager/duplex/TEST12345" });

      const progressRaw = '{"type":"audioProgress","audioProcessedMs":1200}';
      const progressParsed = provider.parseServerMessage(progressRaw);
      expect(progressParsed).toEqual({
        type: "audioProgress",
        audioProcessedMs: 1200,
      });

      const transcriptRaw =
        '{"type":"transcript","transcript":"Active recall is explaining aloud","final":true,"audioProcessedMs":4320}';
      const transcriptParsed = provider.parseServerMessage(transcriptRaw);
      expect(transcriptParsed).toEqual({
        type: "transcript",
        transcript: "Active recall is explaining aloud",
        final: true,
        audioProcessedMs: 4320,
      });

      const invalidRaw = "invalid non json text";
      expect(provider.parseServerMessage(invalidRaw)).toBeNull();
    });
  });
});
