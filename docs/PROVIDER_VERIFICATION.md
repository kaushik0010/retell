# Retell — AI Provider Verification Matrix & Capability Checklist

This document tracks empirical verification of the AI providers integrated into Retell. Every capability starts marked **Unverified** until a live, verified call provides reproducible evidence.

---

## 1. Provider Identity and Credentials

### Provider A: Meta Model API (Primary Provider)

- **Account Credit Status:** $150 in hackathon credits awarded.
- **API Key Status:** Pending confirmation / verification test.
- **Reasoning Model ID:** `muse-spark-1.3`
- **Speech Transcription Model ID:** `muse-voice-transcribe-1.0`
- **Reasoning Base URL:** `https://api.meta.ai/v1`
- **Reasoning Endpoint:** `https://api.meta.ai/v1/chat/completions`
- **Real-Time Transcription Endpoint:** `wss://api.meta.ai/v1/asr/realtime`

### Provider B: Baseten (Alternative Reasoning Provider)

- **Account Credit Status:** $100 in hackathon credits awarded.
- **API Key Status:** Pending confirmation / verification test.
- **Reasoning Model ID:** `meta-models/muse-spark-open-1026`
- **Inference Base URL:** `https://inference.baseten.co/v1`
- **Chat Endpoint:** `https://inference.baseten.co/v1/chat/completions`

---

## 2. Capability Verification Checklist

### Meta Model API (`muse-spark-1.3`)

| Capability                                     | Status         | Verified Date | Observed Result / Evidence              |
| ---------------------------------------------- | -------------- | ------------- | --------------------------------------- |
| Basic HTTP Authentication (Bearer token)       | **Unverified** | —             | Pending initial smoke test              |
| Account can execute successful completion call | **Unverified** | —             | Pending initial smoke test              |
| Target Model ID `muse-spark-1.3` is accessible | **Unverified** | —             | Pending initial smoke test              |
| Strict JSON / Structured Output support        | **Unverified** | —             | Pending schema validation test          |
| Context window limits & token pricing          | **Unverified** | —             | Pending documentation and latency check |
| Observed reasoning latency (TTFT & total time) | **Unverified** | —             | Pending latency benchmark               |
| Error handling (rate limits, 401, 429, 500)    | **Unverified** | —             | Pending error simulation                |

### Meta Voice Transcribe (`muse-voice-transcribe-1.0`)

| Capability                                                 | Status         | Verified Date | Observed Result / Evidence         |
| ---------------------------------------------------------- | -------------- | ------------- | ---------------------------------- |
| Real-time WebSocket handshake succeeds                     | **Unverified** | —             | Pending WebSocket handshake test   |
| WebSocket authentication mechanism (query param vs header) | **Unverified** | —             | Pending protocol test              |
| Audio input format compatibility (PCM 16kHz mono vs Opus)  | **Unverified** | —             | Pending audio chunk ingestion test |
| Streaming transcript event shape & latency                 | **Unverified** | —             | Pending speech streaming test      |
| Disconnect and session finalization behavior               | **Unverified** | —             | Pending teardown test              |
| Rate limits, connection timeouts & reconnection            | **Unverified** | —             | Pending stability test             |

### Baseten (`meta-models/muse-spark-open-1026`)

| Capability                                                | Status         | Verified Date | Observed Result / Evidence |
| --------------------------------------------------------- | -------------- | ------------- | -------------------------- |
| HTTP Authentication (`Api-Key` or `Bearer`)               | **Unverified** | —             | Pending initial smoke test |
| Target Model ID `meta-models/muse-spark-open-1026` active | **Unverified** | —             | Pending initial smoke test |
| OpenAI-compatible `/v1/chat/completions` format           | **Unverified** | —             | Pending endpoint test      |
| Structured JSON output adherence                          | **Unverified** | —             | Pending schema test        |
| Observed reasoning latency & throughput                   | **Unverified** | —             | Pending benchmark test     |
| Rate limit response structure & status codes              | **Unverified** | —             | Pending error test         |

---

## 3. Verification Protocol (To be executed in Task 2)

When API credentials are configured in `.env.local`:

1. **Never commit actual keys** or print complete keys in logs or screenshots.
2. Run dedicated server-side verification scripts (`scripts/verify-providers.ts` or route handlers).
3. Record exact response headers, latency numbers, and token counts.
4. Record structured output conformity against Zod schemas.
5. Update this document with date, exact model version returned, and verified status.
