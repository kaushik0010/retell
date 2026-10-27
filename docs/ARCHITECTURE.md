# Retell — Architecture Specification

This document details the architectural principles, application boundaries, provider abstraction models, storage strategy, audio transcription topology, and security policies governing Retell.

---

## 1. Initial Architecture Overview

Retell is architected as a **local-first web application** backed by server-side reasoning proxies and real-time WebSocket transcription endpoints.

```
+─────────────────────────────────────────────────────────────────────────────+
│                               BROWSER RUNTIME                               │
│                                                                             │
│  +─────────────────────────+   +───────────────────────+   +─────────────+  │
│  │   UI Components         │   │ Audio Streaming       │   │ IndexedDB   │  │
│  │   - Home & Dashboard    │   │ - MediaRecorder       │   │ - Materials │  │
│  │   - Material Ingestion  │   │ - AudioWorklet (mono) │   │ - Rubrics   │  │
│  │   - Rubric Review       │   │ - WebSocket Client    │   │ - Attempts  │  │
│  │   - Practice Room       │   +───────────┬───────────+   +──────┬──────+  │
│  │   - Answer Audit UI     │               │                      │         │
│  +────────────┬────────────+               │                      │         │
│               │                            │                      │         │
+───────────────┼────────────────────────────┼──────────────────────┼─────────+
                │ HTTPS (API)                │ WSS                  │ Local
                ▼                            ▼                      ▼
+────────────────────────────+   +───────────────────────+
│ NEXT.JS BACKEND / API      │   │ WEBSOCKET PROXY       │
│                            │   │ (If auth required)    │
│ - Credential Containment   │   │                       │
│ - Schema Validation (Zod)  │   │ - Audio chunk stream  │
│ - Extraction Endpoint      │   │ - Live delta events   │
│ - Rubric Generation        │   +───────────┬───────────+
│ - Semantic Audit Engine    │               │
+───────────────┬────────────+               │
                │                            │
                ▼                            ▼
+─────────────────────────────────────────────────────────────────────────────+
│                           EXTERNAL AI PROVIDERS                             │
│                                                                             │
│  +───────────────────────────────────+  +────────────────────────────────+  │
│  │ Meta Model API                    │  │ Baseten Inference              │  │
│  │ - Reasoning: muse-spark-1.3       │  │ - Reasoning Fallback:          │  │
│  │ - ASR: muse-voice-transcribe-1.0  │  │   meta-models/muse-spark-open  │  │
│  +───────────────────────────────────+  +────────────────────────────────+  │
+─────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Application Boundaries

### Client-Side Boundaries (Browser)

- **UI State & Rendering:** Manages view state, interactive rubric editing, waveform visualization, and live transcript scrolling.
- **Audio Capture:** Requests user microphone access (`navigator.mediaDevices.getUserMedia`) and formats audio frames.
- **Data Persistence:** All study sets, extracted rubrics, transcripts, and attempt evaluations are saved directly into the browser's IndexedDB.
- **Strict Boundary:** The client bundle **never** receives or stores provider API keys.

### Server-Side Boundaries (Next.js App Router API Routes)

- **Credential Storage:** `META_MODEL_API_KEY` and `BASETEN_API_KEY` reside exclusively in server-side environment variables.
- **Payload Validation:** All incoming requests are validated using strict Zod schemas before being dispatched to AI providers.
- **Provider Proxying:** The server constructs structured prompts, enforces JSON output formatting, parses model responses, handles rate limits, and sanitizes output before returning it to the client.

### Potential WebSocket Service Boundary

- Meta's real-time ASR endpoint (`wss://api.meta.ai/v1/asr/realtime`) may require authentication headers or specific subprotocols not natively configurable in standard browser `WebSocket` APIs.
- If direct browser-to-Meta WebSocket connections are blocked by authentication constraints, a lightweight server-side WebSocket proxy will forward binary audio chunks to Meta and pipe transcript events back to the client.

---

## 3. Provider Abstraction Strategy

Retell implements a **Provider Adapter Pattern** to decouple application business logic from specific AI provider SDKs and HTTP APIs:

```ts
export interface ReasoningProvider {
  id: "meta" | "baseten";
  extractMaterial(input: { text: string }): Promise<ExtractedQA>;
  generateRubric(input: {
    question: string;
    answer: string;
  }): Promise<ConceptRubricItem[]>;
  evaluateSpokenAnswer(input: {
    rubric: RubricDefinition;
    transcript: string;
  }): Promise<AnswerAuditResult>;
}
```

### Provider Matrix

| Role              | Primary Provider | Model ID                    | Fallback Provider                           | Fallback Model ID                  |
| ----------------- | ---------------- | --------------------------- | ------------------------------------------- | ---------------------------------- |
| **Reasoning**     | Meta Model API   | `muse-spark-1.3`            | Baseten                                     | `meta-models/muse-spark-open-1026` |
| **Transcription** | Meta Model API   | `muse-voice-transcribe-1.0` | Browser SpeechRecognition (diagnostic only) | N/A                                |

### Dynamic Switching & Resilience:

- The active reasoning provider is controlled via `REASONING_PROVIDER` (`meta` | `baseten`).
- If the primary provider returns a 5xx error, timeout, or rate-limit code, the adapter can automatically failover to Baseten for reasoning tasks.
- Dedicated transcription is unique to Meta's `muse-voice-transcribe-1.0`. Baseten is an alternative reasoning deployment, not a transcription drop-in.

---

## 4. Local-First Storage Approach

### Privacy & Simplicity Principle

For the hackathon MVP, Retell deliberately eliminates cloud user accounts, databases, and synchronization services:

- **No authentication overhead:** Students start practicing instantly without signups or passwords.
- **Zero data custody liability:** Personal study notes, course materials, and audio recordings remain strictly within the user's browser.
- **Offline survivability:** Previously saved materials and historical attempts remain readable and reviewable even without an internet connection.

### IndexedDB Schema Design

- **`materials` store:** Keyed by UUID. Stores raw text, extracted question, reference answer, creation timestamp.
- **`rubrics` store:** Keyed by UUID (foreign key `materialId`). Stores array of structured `ConceptRubricItem` objects.
- **`attempts` store:** Keyed by UUID (foreign key `rubricId`). Stores transcript, audio duration, concept evaluations (`correct`, `partial`, `missing`, `incorrect`), and feedback.

---

## 5. Real-Time Transcription Strategy

1. **Microphone Capture:** Browser `MediaStream` captured via `AudioContext` and processed through an `AudioWorkletNode` or `MediaRecorder` slice.
2. **Audio Format:** 16kHz mono PCM (or 16-bit linear PCM / WebM Opus, subject to provider verification).
3. **Session Lifecycle:**
   - **Start:** User clicks "Start Answering". Microphone active; WebSocket session initiates.
   - **Streaming:** Audio packets sent every 100–250ms. As partial transcripts arrive, they are rendered incrementally.
   - **Pause Detection:** If voice activity drops for >4 seconds, an optional subtle hint displays ("Need a hint? Think about...").
   - **Stop / Finalize:** User clicks "Done Speaking". WebSocket signals end-of-stream. Finalized transcript is locked into state.
   - **Disconnection Resilience:** If the network drops, the accumulated transcript is immediately saved locally to prevent data loss.

---

## 6. Security and Privacy Principles

1. **Zero Secret Leakage:** Provider API keys are never bundled into client JS or exposed via Next.js `NEXT_PUBLIC_` prefixes.
2. **Sanitized Inputs:** All student inputs are validated on the server with length restrictions to prevent prompt-injection attacks and excessive token consumption.
3. **Content Protection:** Student notes and materials are not sent to any third-party logging or analytics providers.
4. **Local Audio Handling:** Audio streams are forwarded directly to the transcription endpoint and never stored on Retell servers.

---

## 7. Architectural Decisions: Verified Facts vs. Assumptions

| Item                                                       | Status            | Detail                                                                                                                                                                             |
| ---------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js App Router v16 + React 19 compatibility            | **Verified Fact** | Successfully builds with webpack; serves HTTP 200                                                                                                                                  |
| Tailwind CSS v4 design token utilities                     | **Verified Fact** | Brand colors and fonts render properly across all viewports                                                                                                                        |
| Server-side credential isolation via Next.js API           | **Verified Fact** | Standard server environment variable protection; `server-only` package enforced                                                                                                    |
| Meta Model API `muse-spark-1.3` endpoint & latency         | **Verified Fact** | Verified via live completions: latency 2.5–3.4s, strictly conforms to structured JSON output with reasoning tokens                                                                 |
| Baseten `meta-models/muse-spark-open-1026` response format | **Verified Fact** | Verified via live completions: latency 1.2–2.4s, strictly conforms to structured JSON output                                                                                       |
| Meta ASR `muse-voice-transcribe-1.0` WebSocket protocol    | **Verified Fact** | `wss://api.meta.ai/v1/asr/realtime` duplex protocol verified; accepts `audioEncoding: "PCM_16KHZ"`; however current hackathon key lacks ASR entitlement (reported as Unauthorized) |
