/**
 * Standalone Provider Verification Script for Retell
 *
 * Runs minimal, secure live smoke tests against Meta Model API, Baseten,
 * and Meta Voice Transcribe without exposing secrets.
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-providers.mjs
 */

import { z } from "zod";

const SmokeTestSchema = z.object({
  status: z.string(),
  message: z.string(),
  concepts: z.array(z.string()),
});

function sanitize(str) {
  if (!str) return "";
  return str
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/Api-Key\s+[A-Za-z0-9._~+/-]+=*/gi, "Api-Key [REDACTED]")
    .replace(/key=[A-Za-z0-9._~+/-]+/gi, "key=[REDACTED]")
    .replace(/([a-zA-Z0-9_-]{20,})/g, "[REDACTED_TOKEN]");
}

async function testMetaReasoning() {
  const apiKey = process.env.META_MODEL_API_KEY?.trim();
  const modelId = process.env.META_REASONING_MODEL?.trim() || "muse-spark-1.3";
  const url = "https://api.meta.ai/v1/chat/completions";

  if (!apiKey) {
    return {
      provider: "Meta Model API",
      model: modelId,
      status: "Blocked",
      details: "META_MODEL_API_KEY not configured",
      latencyMs: 0,
    };
  }

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content:
              'Return ONLY valid JSON matching: {"status": "ok", "message": "Meta verification ready", "concepts": ["active_recall", "spoken_retrieval"]}. No markdown.',
          },
          {
            role: "user",
            content: "Provide the verification JSON.",
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20000),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text();
      return {
        provider: "Meta Model API",
        model: modelId,
        status: "Failed",
        statusCode: res.status,
        details: sanitize(errText.slice(0, 160)),
        latencyMs,
      };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const clean = raw
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(clean);
    }

    const validation = SmokeTestSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        provider: "Meta Model API",
        model: modelId,
        status: "Failed",
        details: `Schema validation failed: ${validation.error.message}`,
        latencyMs,
      };
    }

    return {
      provider: "Meta Model API",
      model: modelId,
      status: "Verified",
      details: `Structured output valid: ${JSON.stringify(validation.data)}`,
      latencyMs,
      usage: data.usage,
    };
  } catch (err) {
    return {
      provider: "Meta Model API",
      model: modelId,
      status: "Failed",
      details: sanitize(err.message),
      latencyMs: Date.now() - start,
    };
  }
}

async function testBasetenReasoning() {
  const apiKey = process.env.BASETEN_API_KEY?.trim();
  const modelId =
    process.env.BASETEN_REASONING_MODEL?.trim() ||
    "meta-models/muse-spark-open-1026";
  const url = "https://inference.baseten.co/v1/chat/completions";

  if (!apiKey) {
    return {
      provider: "Baseten Reasoning",
      model: modelId,
      status: "Blocked",
      details: "BASETEN_API_KEY not configured",
      latencyMs: 0,
    };
  }

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content:
              'Return ONLY valid JSON matching: {"status": "ok", "message": "Baseten verification ready", "concepts": ["active_recall", "spoken_retrieval"]}. No markdown.',
          },
          {
            role: "user",
            content: "Provide the verification JSON.",
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20000),
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text();
      return {
        provider: "Baseten Reasoning",
        model: modelId,
        status: "Failed",
        statusCode: res.status,
        details: sanitize(errText.slice(0, 160)),
        latencyMs,
      };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() || "";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const clean = raw
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(clean);
    }

    const validation = SmokeTestSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        provider: "Baseten Reasoning",
        model: modelId,
        status: "Failed",
        details: `Schema validation failed: ${validation.error.message}`,
        latencyMs,
      };
    }

    return {
      provider: "Baseten Reasoning",
      model: modelId,
      status: "Verified",
      details: `Structured output valid: ${JSON.stringify(validation.data)}`,
      latencyMs,
      usage: data.usage,
    };
  } catch (err) {
    return {
      provider: "Baseten Reasoning",
      model: modelId,
      status: "Failed",
      details: sanitize(err.message),
      latencyMs: Date.now() - start,
    };
  }
}

async function testMetaVoiceTranscription() {
  const apiKey = process.env.META_MODEL_API_KEY?.trim();
  const modelId =
    process.env.META_TRANSCRIPTION_MODEL?.trim() || "muse-voice-transcribe-1.0";
  const wsUrl = "wss://api.meta.ai/v1/asr/realtime";

  if (!apiKey) {
    return {
      provider: "Meta Voice Transcribe",
      model: modelId,
      status: "Blocked",
      details: "META_MODEL_API_KEY not configured",
      latencyMs: 0,
    };
  }

  const start = Date.now();
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          ws.close();
        } catch {}
        resolve({
          provider: "Meta Voice Transcribe",
          model: modelId,
          status: "Failed",
          details: "WebSocket connection timed out after 8000ms",
          latencyMs: Date.now() - start,
        });
      }
    }, 8000);

    let ws;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Send initial handshake frame containing api_key, model, and audioEncoding
        const handshake = {
          api_key: apiKey,
          model: modelId,
          audioEncoding: "PCM_16KHZ",
          mode: "PUSH_TO_TALK",
          sample_rate: 16000,
        };
        ws.send(JSON.stringify(handshake));
      };

      ws.onmessage = (event) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const latencyMs = Date.now() - start;
        const raw = String(event.data);
        try {
          ws.close();
        } catch {}

        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }

        const isUnauthorized =
          typeof parsed === "object" &&
          parsed !== null &&
          (parsed.message?.includes("Unauthorized") || parsed.type === "error");

        resolve({
          provider: "Meta Voice Transcribe",
          model: modelId,
          status: isUnauthorized ? "Blocked" : "Verified",
          details: isUnauthorized
            ? `Endpoint reached & duplex session created (${parsed.sessionId ? "sessionId allocated" : "session active"}), but credential lacked ASR authorization: ${sanitize(parsed.message || JSON.stringify(parsed))}`
            : `WebSocket handshake acknowledged: ${sanitize(JSON.stringify(parsed).slice(0, 140))}`,
          latencyMs,
        });
      };

      ws.onerror = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          provider: "Meta Voice Transcribe",
          model: modelId,
          status: "Failed",
          details: sanitize(
            err?.message || "WebSocket handshake connection error"
          ),
          latencyMs: Date.now() - start,
        });
      };

      ws.onclose = (event) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          provider: "Meta Voice Transcribe",
          model: modelId,
          status: event.code === 1000 ? "Verified" : "Failed",
          details: `WebSocket closed with code ${event.code}: ${sanitize(event.reason || "no reason")}`,
          latencyMs: Date.now() - start,
        });
      };
    } catch (err) {
      clearTimeout(timer);
      resolve({
        provider: "Meta Voice Transcribe",
        model: modelId,
        status: "Failed",
        details: sanitize(err.message),
        latencyMs: Date.now() - start,
      });
    }
  });
}

async function main() {
  console.log("=================================================");
  console.log("  Retell AI Provider Verification & Smoke Tests  ");
  console.log("=================================================\n");

  console.log("[1/3] Testing Meta Muse Spark 1.3 Reasoning...");
  const metaResult = await testMetaReasoning();
  console.log(`  -> Status:    ${metaResult.status}`);
  console.log(`  -> Latency:   ${metaResult.latencyMs}ms`);
  console.log(`  -> Details:   ${metaResult.details}`);
  if (metaResult.usage) {
    console.log(`  -> Tokens:    ${JSON.stringify(metaResult.usage)}`);
  }
  console.log("");

  console.log("[2/3] Testing Baseten Muse Spark Open Reasoning...");
  const basetenResult = await testBasetenReasoning();
  console.log(`  -> Status:    ${basetenResult.status}`);
  console.log(`  -> Latency:   ${basetenResult.latencyMs}ms`);
  console.log(`  -> Details:   ${basetenResult.details}`);
  if (basetenResult.usage) {
    console.log(`  -> Tokens:    ${JSON.stringify(basetenResult.usage)}`);
  }
  console.log("");

  console.log("[3/3] Testing Meta Voice Transcribe WebSocket...");
  const transcribeResult = await testMetaVoiceTranscription();
  console.log(`  -> Status:    ${transcribeResult.status}`);
  console.log(`  -> Latency:   ${transcribeResult.latencyMs}ms`);
  console.log(`  -> Details:   ${transcribeResult.details}`);
  console.log("\n=================================================");
  console.log("  Verification Run Completed");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Verification runner error:", sanitize(err.message));
  process.exit(1);
});
