# Retell — Implementation Plan & Architecture Specification

This document details the planned structural architecture, directory organization, component boundaries, and phase-by-phase implementation sequence for Retell.

---

## 1. Repository and Scaffold Structure

The project is structured around a domain-driven, feature-colocated layout in `src/`, cleanly separating UI presentation, domain logic, client storage, and server-side provider adapters.

```
retell/
├── .env.example                     # Verified environment variable template (no secrets)
├── .gitignore                       # Git exclusion rules (excluding .env*, node_modules, etc.)
├── .prettierrc                      # Code formatting standard with Tailwind plugin
├── eslint.config.mjs                # ESLint 9 flat configuration with Next.js rules
├── next.config.ts                   # Next.js 16 configuration
├── package.json                     # Dependencies, scripts, and package manager specification
├── pnpm-lock.yaml                   # Deterministic pnpm lockfile
├── postcss.config.mjs               # PostCSS configuration for Tailwind CSS v4
├── tsconfig.json                    # Strict TypeScript configuration
├── README.md                        # Project overview and run instructions
│
├── docs/                            # Project governance and technical documentation
│   ├── ARCHITECTURE.md              # System boundaries and architectural decisions
│   ├── DECISIONS.md                 # Architecture Decision Records (ADRs)
│   ├── IMPLEMENTATION_PLAN.md       # This authoritative implementation plan
│   ├── PROGRESS.md                  # Granular task checklist and verification log
│   ├── PROVIDER_VERIFICATION.md     # AI model capability and integration test checklist
│   └── ROADMAP.md                   # Six-day milestone roadmap
│
├── src/
│   ├── app/                         # Next.js App Router (pages, layouts, route handlers)
│   │   ├── api/                     # Server-side HTTP route handlers
│   │   │   ├── extract/             # Material extraction endpoint (planned)
│   │   │   ├── rubric/              # Rubric generation endpoint (planned)
│   │   │   └── audit/               # Semantic answer evaluation endpoint (planned)
│   │   ├── globals.css              # Tailwind CSS v4 entrypoint and brand theme tokens
│   │   ├── layout.tsx               # Root application shell and font definitions
│   │   └── page.tsx                 # Home entrypoint
│   │
│   ├── components/                  # Shared primitive UI components (buttons, cards, inputs)
│   │   └── ui/                      # Reusable design system primitives
│   │
│   ├── features/                    # Feature-specific modules (colocated UI and logic)
│   │   ├── home/                    # Hero presentation, onboarding, quick actions
│   │   ├── library/                 # Study material ingestion, note pasting, document listing
│   │   ├── source-review/           # Extracted Q&A review, rubric inspection & editor
│   │   ├── practice/                # Practice Room, microphone input, live waveform, transcript
│   │   └── answer-review/           # Semantic audit cards, gap analysis, attempt comparison
│   │
│   ├── lib/                         # Shared core utilities and abstractions
│   │   ├── audio/                   # Browser microphone capture, PCM conversion, AudioWorklet (planned)
│   │   ├── storage/                 # Local-first IndexedDB repository (Dexie / IDB) (planned)
│   │   ├── providers/               # Server-only AI adapters (Meta Model API & Baseten) (planned)
│   │   │   ├── meta.ts              # Meta API reasoning & ASR client adapter
│   │   │   ├── baseten.ts           # Baseten inference client adapter
│   │   │   └── types.ts             # Provider agnostic interfaces
│   │   └── utils.ts                 # General classname and styling utilities
│   │
│   └── types/                       # Shared domain TypeScript interfaces
│       └── index.ts                 # Rubric, Attempt, Evaluation, and Provider types
│
└── tests/                           # Test suites (unit, integration, and E2E) (planned)
    ├── unit/                        # Rubric parsing, prompt synthesis, schema validation tests
    └── e2e/                         # Playwright browser end-to-end flows
```

---

## 2. Design System and Tokens

### Color Tokens

- **Warm Cream Background:** `#FFF8EB` (`--color-brand-cream`) — Primary application canvas.
- **Tomato Primary:** `#E6533D` (`--color-brand-tomato`) — Primary buttons, focal points, brand badge.
- **Tomato Hover:** `#C9432F` (`--color-brand-tomato-hover`) — Interactive button hover state.
- **Butter Yellow:** `#F5D96B` (`--color-brand-butter`) — Category tags, highlight markers, status accents.
- **Peach:** `#FFE2D7` (`--color-brand-peach`) — Soft borders, selection states, secondary cards.
- **Ink Text:** `#302B27` (`--color-brand-ink`) — Headings, high-contrast primary text.
- **Secondary Text:** `#74685C` (`--color-brand-secondary`) — Subheadings, metadata, captions.
- **White:** `#FFFFFF` (`--color-brand-white`) — Card backgrounds, dialog surfaces.

### Typography

- **Headings:** Plus Jakarta Sans (`font-heading`, 600/700/800 weight).
- **Body & Controls:** Inter (`font-sans`, 400/500/600 weight).

### Sizing and Spacing

- Base grid: 8px increments (`p-2`, `p-4`, `p-6`, `p-8`, `gap-4`, `gap-6`).
- Card radius: 16px (`rounded-2xl` / `rounded-card`).
- Button & Input radius: 12px (`rounded-xl` / `rounded-button`).
- Restrained, warm shadows; no glassmorphism or distracting motion.

---

## 3. Application Shell and Routing

### Page Routes

1. `/` — Home / Dashboard: Quick-start practice, recent materials, onboarding prompt.
2. `/library` — Study Library: Add new material, browse existing items, import/export.
3. `/review/[materialId]` — Source Review: Inspect and edit extracted question, reference answer, and rubric concepts.
4. `/practice/[materialId]` — Practice Room: Microphone audio streaming, real-time transcript, pause nudge.
5. `/review-answer/[attemptId]` — Answer Audit: Semantic breakdown, missing points, evidence citations, retry CTA.
6. `/compare/[materialId]` — Attempt Comparison: Side-by-side comparison of attempt #1 vs attempt #2.

### Architectural Component Boundaries

| Boundary                      | Responsibilities                                                                                                                              | Constraints                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Server Components**         | Initial layout rendering, static UI shells, SEO metadata, reading server configs                                                              | Cannot access browser APIs (`navigator.mediaDevices`, `window.indexedDB`)                              |
| **Client Components**         | Audio capture (`MediaRecorder`), audio stream management, local IndexedDB reads/writes, interactive rubric editing, live transcript display   | Must never import server secrets or call raw provider endpoints directly                               |
| **Route Handlers (`/api/*`)** | Ingesting server requests, validating schemas via Zod, dispatching requests to Meta/Baseten with server credentials, returning sanitized data | Server-only execution; credentials isolated from browser bundles                                       |
| **WebSocket Service**         | Persistent real-time audio chunk forwarding to Meta ASR endpoint (`muse-voice-transcribe-1.0`)                                                | If direct browser WSS lacks custom header support, a small Next.js / Node proxy bridges the connection |

---

## 4. Features: Library and Ingestion (`src/features/library`, `src/features/materials`)

- **Input Modalities:** Raw text paste, structured markdown notes, PDF documents, and multi-page note photos.
- **Client-Side Adaptive Image Optimization (`src/lib/files/image-optimizer.ts`):**
  - Offloaded to browser background Web Workers via `browser-image-compression`.
  - Legibility-first configuration: `maxWidthOrHeight: 2048`, `initialQuality: 0.86`, `maxSizeMB: 0.9`. Preserves fine handwriting, subscript/superscript, diagrams, and small textbook fonts.
  - Diagram transparency preservation: detects `image/png` and strictly preserves PNG MIME encoding, preventing black canvas backgrounds.
  - Fail-safe fallback strategy: skips images <= 200 KB already compact, discards compression if output is larger than original, and retains original file if Web Worker/compression throws an error.
- **Upload Payload Protection & Vercel Ceiling Safety (`src/lib/files/payload-budget.ts`):**
  - Models conservative multipart/form-data boundary and field overhead (~2 KB base + 1 KB/file).
  - Enforces client-side upload payload budget of 3.5 MB, safely below Vercel's unconfigurable 4.5 MB serverless body ceiling (HTTP 413).
  - Clear student guidance and non-blocking background progress badges in `NewMaterialView.tsx` and `ImportQuestionsModal.tsx`.
- **Extraction Pipeline:**
  - Client sends optimized files or text to `/api/extract`.
  - Server invokes Meta `muse-spark-1.3` with structured output prompts.
  - Returns extracted `question` and `referenceAnswer`.
- **Validation:** Zod schema guarantees both fields are non-empty strings before proceeding.

---

## 5. Features: Source Review and Rubric (`src/features/source-review`)

- **Rubric Generation:**
  - Server breaks down the reference answer into structured concept items:
    - `id`: unique slug
    - `name`: concise concept title
    - `description`: conceptual explanation
    - `requiredTerminology`: array of technical terms expected
    - `relationships`: dependencies or causal links to other concepts
    - `isEssential`: boolean (core vs supporting detail)
    - `orderIndex`: chronological or logical sequence index
- **Review UI:**
  - Students review extracted concepts in an editable accordion/card list.
  - Inline editing allows students to add missing points or tweak terminology before practicing.
  - Persisted to IndexedDB as the authoritative ground truth for this study item.

---

## 6. Features: Practice Room (`src/features/practice`)

- **Audio Capture:**
  - Requests microphone access via `navigator.mediaDevices.getUserMedia({ audio: true })`.
  - Captures mono audio at 16kHz or browser-native rate.
  - Encodes chunks for WebSocket streaming.
- **WebSocket Streaming:**
  - Establishes connection to Meta ASR endpoint.
  - Streams audio packets as the user speaks.
  - Receives live transcript delta events and updates the UI in real time.
- **Pause & Silence Detection:**
  - Monitors audio energy levels / speech pauses.
  - If silence exceeds 4 seconds, triggers an optional contextual nudge (e.g. "Take your time—consider how X relates to Y") without marking any concept missing.
- **Session Finalization:**
  - On stop, closes the WebSocket cleanly, finalizes the full transcript string, and commits the attempt record to local storage.

---

## 7. AI Provider Layer (`src/lib/providers`)

### Primary Provider: Meta Model API

- Reasoning Model: `muse-spark-1.3`
- Transcription Model: `muse-voice-transcribe-1.0`
- Reasoning URL: `https://api.meta.ai/v1/chat/completions`
- Transcription WebSocket: `wss://api.meta.ai/v1/asr/realtime`

### Alternative Provider: Baseten

- Reasoning Model: `meta-models/muse-spark-open-1026`
- Base URL: `https://inference.baseten.co/v1/chat/completions`

### Unified Adapter Interface

```ts
export interface ReasoningProviderAdapter {
  extractQuestionAndAnswer(
    rawText: string
  ): Promise<{ question: string; referenceAnswer: string }>;
  generateRubric(
    question: string,
    answer: string
  ): Promise<ConceptRubricItem[]>;
  auditAnswer(
    rubric: RubricDefinition,
    transcript: string
  ): Promise<AnswerAuditResult>;
}
```

---

## 7.1 Learning Progress & Comparison Architecture (`src/lib/domain/attempt-comparison.ts`, `src/features/answer-review/ProgressSummaryCard.tsx`)

- **Unified Single Source of Truth:**
  - `deriveProgressSummary`, `findPrecedingComparableAttempt`, and `compareAttempts` provide canonical comparison and transition classification across both Answer Review and the dedicated Compare Progress page.
- **Four Distinct Outcome States:**
  - `improvement`: Net concept coverage increases, `+X concept(s)` headline, green visual treatment, primary improved concept description.
  - `regression`: Net concept coverage decreases, `−X concept(s)` headline, supportive `Needs attention` badge, rose visual treatment, primary regressed concept description.
  - `no_change`: Conceptual coverage and individual concept statuses remain identical, `Consistent coverage` headline, warm cream neutral treatment.
  - `mixed_progress`: Individual concepts show both improvements and regressions, `Mixed changes` headline, amber treatment, ensuring regressions are never concealed behind an unchanged aggregate score.
- **Strict Practice Scope Isolation:**
  - Paragraph-level practice compares exclusively with prior attempts practicing the same paragraph (Paragraph N vs Paragraph N).
  - Whole-answer practice compares exclusively with prior whole-answer attempts.
  - Cross-scope comparisons (e.g. Paragraph 1 vs Paragraph 2, or Whole Answer vs Paragraph) are rejected; the Progress Summary is omitted gracefully.
- **Historical Record Backward Compatibility:**
  - Resolves legacy attempts lacking explicit `attempt.scope` by inspecting persisted `audit.scope`.
  - Gracefully omits the summary when historical audits are incomplete or scope cannot be determined safely, without inventing scores or triggering billable AI calls.
- **Component Architecture:**
  - `ProgressSummaryCard.tsx`: Desktop side-by-side cards with visual progress meters, coverage percentages, directional indicator, and direct "View full comparison →" navigation; responsive vertical stacking on mobile viewports.
  - Placed at Section 3 in `AnswerReviewView.tsx` directly above Overall Assessment, establishing an 8-stage canonical review order.

---

## 8. Persistence: IndexedDB (`src/lib/storage`)

- Schema Version 1:
  - `materials`: `id`, `title`, `question`, `referenceAnswer`, `createdAt`
  - `rubrics`: `id`, `materialId`, `concepts`, `updatedAt`
  - `attempts`: `id`, `rubricId`, `transcript`, `durationMs`, `evaluation`, `createdAt`
- All data stored in user's browser; complete privacy, offline availability.

---

## 9. Error Handling and Resilience

- **Audio Disconnect:** If WebSocket drops mid-speech, the client preserves whatever transcript has been accumulated and displays an option to resume or evaluate partial speech.
- **Provider Timeout:** If the reasoning call times out, the transcript is not lost. The student can retry evaluation without re-recording speech.
- **JSON Parse Failure:** Provider adapters employ fallback schema-repair parsing.

---

## 10. Documentation and Governance

- All architectural decisions documented in `docs/DECISIONS.md`.
- Provider capabilities verified and recorded in `docs/PROVIDER_VERIFICATION.md`.
- Daily milestone progress tracked in `docs/PROGRESS.md`.

---

## 11. AI Usage Accounting, Rate Limiting & Global Spending Protection (`src/lib/accounting`)

- **Anonymous Device Identification:**
  - Secure `HttpOnly` UUIDv4 cookie (`retell_device_id`, 1-year duration, `SameSite=Lax`, `Path=/`, `Secure` in production).
  - Server-side SHA-256 HMAC hashing (`device_<32hex>`, `ip_<32hex>`). Zero PII, raw cookies, or IP addresses stored in Redis.
- **Persistent Sliding Window Rate Limiting:**
  - Atomic Lua script executing multi-tier checks: Device Burst, Device Sustained, IP Burst, IP Sustained.
  - Return HTTP 429 with student-friendly message and standard `Retry-After` header.
- **Global Daily Spending Cap:**
  - Strict UTC daily reset (`budget:utc:YYYY-MM-DD`).
  - Canonical $30.00 daily budget ceiling for hackathon testing (`RETELL_DAILY_BUDGET_USD=30.00`) with pricing defaults ($1.25/1M input tokens, $4.25/1M output tokens, $0.012/min audio).
  - Integer micro-USD arithmetic (1 USD = 1,000,000 micros) eliminating floating-point rounding drift.
  - Atomic two-phase reservation: pre-flight reservation checks confirmed + reserved balance against daily ceiling; post-flight settlement reconciles confirmed token usage, refunds definite errors, and conservatively retains reservations on timeouts.
- **Fail-Closed Security Architecture:**
  - If Redis is unconfigured or unreachable in production, paid AI operations reject cleanly with HTTP 503, preventing cloud spending overages.
- **Speech Transcription Session Guard & Startup Lifecycle:**
  - Enforces single active recording session per device lock (`tsess:active:dev:<hmac>`).
  - **Pre-Flight Guarding (`checkTranscribePreconditions`):** Runs rate-limit sliding window, stale-lock cleanup, active-session check, and budget reservation _before_ establishing any upstream Meta WebSocket connection. Guarantees zero upstream API calls on rejected attempts.
  - **Self-Healing Lock Architecture:** Automatically detects and reclaims stale or abandoned session locks (>45s inactivity) to prevent students from being blocked if a previous tab or session crashed.
  - **User Gesture Priority Order:** Audio capture (`getUserMedia`) must execute _first_ as a direct response to the user click before requesting server session creation or Redis reservations. If permission is denied, zero server calls are made.
  - **Fail-Safe Pre-Reservation Refund (`releaseTranscribePreReservation`):** Releases daily budget reservations and clears locks immediately if upstream session creation fails.
  - Validates session ownership against caller device HMAC to block session hijacking across devices.
  - Audio chunk transmissions do not consume separate operation quotas.
  - Idempotent finalization settles billable audio duration against daily budget and releases active session locks.
