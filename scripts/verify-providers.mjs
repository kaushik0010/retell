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

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      stages: {
        connection: "Blocked",
        handshake: "Blocked",
        transcription: "Blocked",
      },
      latencyMs: 0,
    };
  }

  // Check for test PCM audio fixture
  const fixturePath = path.resolve(
    __dirname,
    "../tests/fixtures/speech-24k.pcm"
  );
  let pcmBuffer = null;
  if (fs.existsSync(fixturePath)) {
    pcmBuffer = fs.readFileSync(fixturePath);
  }

  const start = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    let sessionId = null;
    let handshakeAcked = false;
    let finalTranscript = "";
    const interimTranscripts = [];
    let audioProcessedMs = 0;

    const cleanupAndResolve = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (
          ws &&
          (ws.readyState === WebSocket.OPEN ||
            ws.readyState === WebSocket.CONNECTING)
        ) {
          ws.close();
        }
      } catch {}
      resolve(result);
    };

    const timer = setTimeout(() => {
      cleanupAndResolve({
        provider: "Meta Voice Transcribe",
        model: modelId,
        status: handshakeAcked ? "Failed" : "Failed",
        details: `Operation timed out after 18000ms (handshakeAcked: ${handshakeAcked})`,
        stages: {
          connection: "Verified",
          handshake: handshakeAcked ? "Verified" : "Failed",
          transcription: "Failed",
        },
        latencyMs: Date.now() - start,
      });
    }, 18000);

    let ws;
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        // Send official corrected handshake frame
        const token = apiKey.startsWith("Bearer ")
          ? apiKey
          : `Bearer ${apiKey}`;
        const handshake = {
          authorization: {
            accessToken: token,
          },
          audioEncoding: "PCM_24KHZ",
          model: modelId,
          mode: "PUSH_TO_TALK",
        };
        ws.send(JSON.stringify(handshake));
      };

      ws.onmessage = async (event) => {
        const raw = String(event.data);
        let msg = null;
        try {
          msg = JSON.parse(raw);
        } catch {
          msg = { raw };
        }

        // 1. Handshake acknowledgement check
        if (msg.sessionId && !handshakeAcked) {
          sessionId = msg.sessionId;
          handshakeAcked = true;

          // If no audio fixture available, report handshake verification
          if (!pcmBuffer || pcmBuffer.length === 0) {
            cleanupAndResolve({
              provider: "Meta Voice Transcribe",
              model: modelId,
              status: "Verified (Handshake Only)",
              details: `Handshake verified with sessionId: ${sanitize(sessionId)}. Missing audio fixture to stream.`,
              stages: {
                connection: "Verified",
                handshake: "Verified",
                transcription: "Unverified",
              },
              sessionId,
              latencyMs: Date.now() - start,
            });
            return;
          }

          // 2. Stream audio frames in real-time paced chunks (80ms chunks = 3,840 bytes at 24kHz mono 16-bit)
          const chunkSize = 3840;
          let offset = 0;
          try {
            while (offset < pcmBuffer.length && !settled) {
              const end = Math.min(offset + chunkSize, pcmBuffer.length);
              const chunk = pcmBuffer.subarray(offset, end);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(chunk);
              }
              offset = end;
              await new Promise((r) => setTimeout(r, 75));
            }

            // 3. Send endStream signal after final audio frame
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "endStream" }));
            }
          } catch (err) {
            cleanupAndResolve({
              provider: "Meta Voice Transcribe",
              model: modelId,
              status: "Failed",
              details: `Streaming error: ${sanitize(err.message)}`,
              stages: {
                connection: "Verified",
                handshake: "Verified",
                transcription: "Failed",
              },
              latencyMs: Date.now() - start,
            });
          }
          return;
        }

        // 2. Server event processing
        if (msg.type === "error") {
          cleanupAndResolve({
            provider: "Meta Voice Transcribe",
            model: modelId,
            status: "Failed",
            details: `Server error event: ${sanitize(msg.message || JSON.stringify(msg))}`,
            stages: {
              connection: "Verified",
              handshake: handshakeAcked ? "Verified" : "Failed",
              transcription: "Failed",
            },
            latencyMs: Date.now() - start,
          });
          return;
        }

        if (msg.type === "audioProgress") {
          audioProcessedMs = msg.audioProcessedMs || audioProcessedMs;
        }

        if (msg.type === "transcript") {
          if (msg.final) {
            finalTranscript = msg.transcript || "";
          } else {
            interimTranscripts.push(msg.transcript);
          }
        }
      };

      ws.onerror = (err) => {
        cleanupAndResolve({
          provider: "Meta Voice Transcribe",
          model: modelId,
          status: "Failed",
          details: sanitize(err?.message || "WebSocket communication error"),
          stages: {
            connection: handshakeAcked ? "Verified" : "Failed",
            handshake: handshakeAcked ? "Verified" : "Failed",
            transcription: "Failed",
          },
          latencyMs: Date.now() - start,
        });
      };

      ws.onclose = (event) => {
        const isClean = event.code === 1000;
        const transcriptSuccess = Boolean(
          finalTranscript && finalTranscript.trim().length > 0
        );

        cleanupAndResolve({
          provider: "Meta Voice Transcribe",
          model: modelId,
          status: transcriptSuccess
            ? "Verified"
            : isClean
              ? "Verified"
              : "Failed",
          details: transcriptSuccess
            ? `Transcribed: "${sanitize(finalTranscript)}" (Code ${event.code})`
            : `Socket closed code ${event.code}: ${sanitize(event.reason || "no reason")}`,
          stages: {
            connection: "Verified",
            handshake: handshakeAcked ? "Verified" : "Failed",
            transcription: transcriptSuccess ? "Verified" : "Failed",
          },
          finalTranscript,
          sessionId,
          audioProcessedMs,
          closeCode: event.code,
          closeReason: event.reason,
          latencyMs: Date.now() - start,
        });
      };
    } catch (err) {
      cleanupAndResolve({
        provider: "Meta Voice Transcribe",
        model: modelId,
        status: "Failed",
        details: sanitize(err.message),
        stages: {
          connection: "Failed",
          handshake: "Failed",
          transcription: "Failed",
        },
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
  if (transcribeResult.stages) {
    console.log(
      `  -> Stages:    Connection=${transcribeResult.stages.connection}, Handshake=${transcribeResult.stages.handshake}, Transcription=${transcribeResult.stages.transcription}`
    );
  }
  if (transcribeResult.sessionId) {
    console.log(`  -> SessionId: ${sanitize(transcribeResult.sessionId)}`);
  }
  if (transcribeResult.finalTranscript) {
    console.log(`  -> Transcript: "${transcribeResult.finalTranscript}"`);
  }
  if (transcribeResult.audioProcessedMs) {
    console.log(`  -> AudioMs:   ${transcribeResult.audioProcessedMs}ms`);
  }
  if (transcribeResult.closeCode) {
    console.log(
      `  -> CloseCode: ${transcribeResult.closeCode} (${transcribeResult.closeReason || "normal"})`
    );
  }
  console.log(`  -> Details:   ${transcribeResult.details}`);
  console.log("\n=================================================");
  console.log("  Verification Run Completed");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Verification runner error:", sanitize(err.message));
  process.exit(1);
});
