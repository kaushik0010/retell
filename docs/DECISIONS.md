# Retell — Architecture Decision Records (ADRs)

This log records all locked and active architectural decisions, their rationales, and currently open considerations.

---

## Locked Decisions

### ADR-001: Next.js App Router with TypeScript & Strict Type Checking

- **Decision:** Use Next.js 16 (App Router) with React 19 and TypeScript with strict compiler settings (`noUncheckedIndexedAccess`, `noImplicitOverride`).
- **Rationale:** Provides modern server-rendered layout boundaries, streamlined server-only API route handlers for secure credential containment, and compile-time type safety across complex rubric data models.
- **Status:** **Locked & Implemented.**

### ADR-002: Tailwind CSS v4 with Custom Brand Design Tokens

- **Decision:** Standardize on Tailwind CSS v4 utilizing `@theme` tokens for the warm, learning-focused brand palette (`#FFF8EB`, `#E6533D`, `#F5D96B`, `#FFE2D7`, `#302B27`, `#74685C`, `#FFFFFF`).
- **Rationale:** Establishes a distinctive, accessible aesthetic avoiding generic AI dashboard tropes (blue/purple gradients, glassmorphism), while maintaining strict responsive layout rules (390px, 768px, 1440px).
- **Status:** **Locked & Implemented.**

### ADR-003: pnpm Package Management

- **Decision:** Use pnpm (v11.0.9) exclusively for dependency management and execution scripts.
- **Rationale:** Ensures fast, deterministic, space-efficient dependency trees with strict package resolution.
- **Status:** **Locked & Implemented.**

### ADR-004: Zod for Runtime Schema Validation

- **Decision:** Validate all external inputs, AI model outputs, and persistence payloads using Zod schemas.
- **Rationale:** LLMs can occasionally return malformed JSON or omit expected fields. Runtime schema validation guarantees that malformed responses are intercepted and repaired before reaching client UI components.
- **Status:** **Locked & Implemented.**

### ADR-005: Local-First Browser Persistence via IndexedDB

- **Decision:** Persist study materials, extracted rubrics, transcripts, and attempt evaluations exclusively in the browser's IndexedDB for the hackathon MVP.
- **Rationale:** Delivers instant responsiveness, zero latency, offline capability, and maximum privacy with no server database maintenance or user account requirements.
- **Status:** **Locked.**

### ADR-006: Dual AI Provider Strategy (Meta Model API Primary, Baseten Fallback)

- **Decision:** Implement an abstraction layer supporting Meta's `muse-spark-1.3` as primary reasoning and Baseten's `meta-models/muse-spark-open-1026` as an alternative reasoning fallback. Real-time transcription is dedicated to Meta's `muse-voice-transcribe-1.0`.
- **Rationale:** Shields the project from potential credit activation or service disruptions while testing Meta's proprietary transcription capabilities.
- **Status:** **Locked.**

### ADR-007: Server-Side API Key Containment

- **Decision:** Keep all provider credentials strictly on the server in environment variables. Client components interact exclusively with server API route handlers.
- **Rationale:** Zero credential leakage to browser network tabs, client bundles, or repository history.
- **Status:** **Locked.**

### ADR-008: Webpack Bundler Fallback for Next.js 16 Builds on Windows

- **Decision:** Use Next.js with `--webpack` for production builds and development servers.
- **Rationale:** In Next.js 16 on Windows, Turbopack encounters an IPC child process communication issue when executing CSS/PostCSS loaders. Webpack builds cleanly, reliably, and rapidly (8.4 seconds) without errors.
- **Status:** **Locked & Implemented.**

### ADR-009: Lightweight Server-Side Provider Adapters with Zod Validation

- **Decision:** Implement provider adapters using native `fetch` and global `WebSocket` guarded by `server-only`, avoiding heavy external SDKs.
- **Rationale:** Native `fetch` with `AbortSignal.timeout` provides deterministic latency tracking, correlation IDs, and transparent header handling. Every response is parsed and strictly validated with Zod before being consumed by application logic.
- **Status:** **Locked & Implemented.**

---

## Open Decisions Under Evaluation

| ID       | Topic                                          | Options                                                                                                                 | Trade-offs / Findings                                                                                                                                                                                       | Target Milestone               |
| -------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `OD-001` | Direct Browser vs Proxy WebSocket for Meta ASR | **Resolved:** Server-side WebSocket Proxy required to protect credentials; browser speech fallback for unentitled keys. | Empirically verified: Meta ASR requires `api_key` in the first JSON frame. Exposing this frame to browser clients would violate credential isolation rules. In addition, current keys lack ASR entitlement. | Day 3 (Practice Room)          |
| `OD-002` | Client Audio Capture Format                    | A) Raw PCM via `AudioWorklet`<br>B) Compressed WebM/Opus via `MediaRecorder`                                            | Empirically verified: Meta ASR requires `audioEncoding: "PCM_16KHZ"`. Client pipeline must capture 16kHz mono PCM frames.                                                                                   | Day 3 (Practice Room)          |
| `OD-003` | IndexedDB Client Wrapper Library               | A) `idb` (lightweight promise wrapper)<br>B) `dexie` (fluent query API and schema migrations)                           | `idb` is ultra-compact (<2KB); `dexie` simplifies multi-index queries and migrations.                                                                                                                       | Day 2 (Persistence Foundation) |
