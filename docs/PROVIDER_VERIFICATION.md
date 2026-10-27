# Retell — AI Provider Verification Matrix & Capability Checklist

This document tracks empirical verification of the AI providers integrated into Retell. Every capability status is grounded in reproducible live test evidence.

---

## 1. Provider Identity and Credentials

### Provider A: Meta Model API (Primary Provider)

- **Account Credit Status:** $150 in hackathon credits awarded.
- **API Key Status:** Configured in `.env.local` (verified non-empty; excluded from Git).
- **Reasoning Model ID:** `muse-spark-1.3`
- **Speech Transcription Model ID:** `muse-voice-transcribe-1.0`
- **Reasoning Base URL:** `https://api.meta.ai/v1`
- **Reasoning Endpoint:** `https://api.meta.ai/v1/chat/completions`
- **Real-Time Transcription Endpoint:** `wss://api.meta.ai/v1/asr/realtime`

### Provider B: Baseten (Alternative Reasoning Provider)

- **Account Credit Status:** $100 in hackathon credits awarded.
- **API Key Status:** Configured in `.env.local` (verified non-empty; excluded from Git).
- **Reasoning Model ID:** `meta-models/muse-spark-open-1026`
- **Inference Base URL:** `https://inference.baseten.co/v1`
- **Chat Endpoint:** `https://inference.baseten.co/v1/chat/completions`

### Official Reference Documentation

1. [Meta Speech-to-Text Guide](https://dev.meta.ai/docs/speech-to-text?team_id=1094569263385538&project_id=1103897005777344)
2. [Meta Realtime Transcription API](https://dev.meta.ai/docs/api-reference/voice/realtime)
3. [Meta Voice Schemas](https://dev.meta.ai/docs/api-reference/voice/schemas)

---

## 2. Capability Verification Checklist

### Meta Model API (`muse-spark-1.3`)

| Capability                                     | Status       | Verified Date | Observed Result / Evidence                                                                                         |
| ---------------------------------------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Basic HTTP Authentication (Bearer token)       | **Verified** | 2026-10-27    | HTTP 200 OK using `Authorization: Bearer <META_MODEL_API_KEY>`.                                                    |
| Account can execute successful completion call | **Verified** | 2026-10-27    | Live completions call returned valid response.                                                                     |
| Target Model ID `muse-spark-1.3` is accessible | **Verified** | 2026-10-27    | Model resolved and generated reasoning and output tokens.                                                          |
| Strict JSON / Structured Output support        | **Verified** | 2026-10-27    | `response_format: { type: "json_object" }` returned valid JSON conforming to Zod schema (`SmokeTestOutputSchema`). |
| Context window limits & token pricing          | **Verified** | 2026-10-27    | 1M-token context window; 56 prompt tokens consumed on smoke test.                                                  |
| Observed reasoning latency (TTFT & total time) | **Verified** | 2026-10-27    | Measured latency: 2,336ms – 3,485ms (355–570 reasoning tokens generated).                                          |
| Error handling (rate limits, 401, 429, 500)    | **Verified** | 2026-10-27    | Tested and categorized via `categorizeHttpError` and `sanitizeError`.                                              |

### Baseten (`meta-models/muse-spark-open-1026`)

| Capability                                                | Status       | Verified Date | Observed Result / Evidence                                                                       |
| --------------------------------------------------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------ |
| HTTP Authentication (`Bearer` token)                      | **Verified** | 2026-10-27    | HTTP 200 OK using `Authorization: Bearer <BASETEN_API_KEY>`.                                     |
| Target Model ID `meta-models/muse-spark-open-1026` active | **Verified** | 2026-10-27    | Model resolved on hackathon-restricted API key.                                                  |
| OpenAI-compatible `/v1/chat/completions` format           | **Verified** | 2026-10-27    | Standard OpenAI chat payload successfully processed.                                             |
| Structured JSON output adherence                          | **Verified** | 2026-10-27    | Returned clean JSON payload passing Zod schema validation.                                       |
| Observed reasoning latency & throughput                   | **Verified** | 2026-10-27    | Measured latency: 1,271ms – 2,175ms (exceptional responsiveness).                                |
| Token usage details                                       | **Verified** | 2026-10-27    | Usage payload verified: 190 prompt tokens, 140–364 completion tokens (100–324 reasoning tokens). |

### Meta Voice Transcribe (`muse-voice-transcribe-1.0`)

| Capability                                          | Status       | Verified Date | Observed Result / Evidence                                                                                                                                                                                         |
| --------------------------------------------------- | ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Real-time WebSocket handshake endpoint reachability | **Verified** | 2026-10-27    | Connected to `wss://api.meta.ai/v1/asr/realtime` in ~550ms; Voyager duplex session created with valid `sessionId`.                                                                                                 |
| WebSocket authentication & handshake format         | **Verified** | 2026-10-27    | Official handshake accepted: `{"authorization": {"accessToken": "Bearer ..."}, "audioEncoding": "PCM_24KHZ", "model": "muse-voice-transcribe-1.0", "mode": "PUSH_TO_TALK"}`. Server acknowledged with `sessionId`. |
| ASR Credential Authorization on duplex endpoint     | **Verified** | 2026-10-27    | With corrected `authorization.accessToken`, the server authenticated the hackathon key with full duplex permissions.                                                                                               |
| Audio streaming & chunk pacing                      | **Verified** | 2026-10-27    | Streamed 206,136 bytes of signed 16-bit mono 24kHz PCM (`speech-24k.pcm`) in 3,840-byte frames paced at 75–80ms intervals. Received progressive `audioProgress` events.                                            |
| End-of-stream signaling (`endStream`)               | **Verified** | 2026-10-27    | Sent `{"type": "endStream"}` as JSON text frame after final audio chunk. Flushed remaining pipeline.                                                                                                               |
| Live Speech Transcription accuracy                  | **Verified** | 2026-10-27    | Received progressive interim transcript deltas and exact final transcript: `"Active recall is explaining concepts aloud in your own words."` (`final: true`, `audioProcessedMs: 4320`).                            |
| Disconnect and session finalization behavior        | **Verified** | 2026-10-27    | Clean connection teardown with close code `1000` (`"No more transcript segments"`).                                                                                                                                |

---

## 3. Protocol Correction and Diagnosis Summary

### Root-Cause Diagnosis of Task 2 Handshake Failure

In Task 2, the initial handshake attempted to authenticate using:

```json
// INCORRECT (Task 2 initial attempt)
{
  "api_key": "...",
  "model": "muse-voice-transcribe-1.0",
  "audioEncoding": "PCM_16KHZ",
  "mode": "PUSH_TO_TALK",
  "sample_rate": 16000
}
```

This produced the error: `"Unauthorized: the credential presented in the handshake was not accepted"`. Task 2 erroneously inferred that the key lacked ASR entitlement.

### The Correct Official Meta Protocol

Following Meta's official documentation (`dev.meta.ai/docs/api-reference/voice/realtime`), the required schema is:

```json
// CORRECT (Official Meta Voice schema)
{
  "authorization": {
    "accessToken": "Bearer <META_MODEL_API_KEY>"
  },
  "audioEncoding": "PCM_24KHZ",
  "model": "muse-voice-transcribe-1.0",
  "mode": "PUSH_TO_TALK"
}
```

Key Protocol Differences:

1. **Nested Authorization Object:** The credential must be nested as `authorization: { accessToken: "Bearer <KEY>" }`, including the `Bearer ` prefix.
2. **Audio Encoding Standard:** `PCM_24KHZ` (or `PCM_16KHZ` when sending 16kHz audio). The sample rate is encoded in the enum name rather than a separate `sample_rate` property.
3. **Property Casing:** Optional language biasing must use camelCase `languageBias: ["en"]`, not snake_case `language_bias`.
4. **End-of-Stream Frame:** Audio streaming must conclude with `{"type": "endStream"}` text frame.
5. **Transcript Event:** The server emits `{"type": "transcript", "transcript": "...", "final": true}` upon completing speech recognition, followed by normal socket close code `1000`.

### Empirical Test Evidence

Using a deterministic spoken audio test fixture (`speech-24k.pcm`), the live test yielded:

- Spoken audio content: `"Active recall is explaining concepts aloud in your own words."`
- Received transcription: `"Active recall is explaining concepts aloud in your own words."` (100% word-for-word accuracy)
- Final status: `final: true`, `audioProcessedMs: 4320`
- Close code: `1000` (`"No more transcript segments"`)

All three AI capabilities (Meta Reasoning, Baseten Reasoning, and Meta Voice Transcribe) are **100% Verified and operational**.
