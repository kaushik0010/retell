# Retell — Six-Day Development Roadmap

**Hackathon:** Meta Global AI Developer Hackathon  
**Target Deadline:** November 4, 2026, 9:00 PM ET  
**Buffer Period:** November 2 – 4 (Reserved for demo video, polish, and final submission)

---

## Roadmap Overview

```
Oct 27 (Day 1)  ──►  Oct 28 (Day 2)  ──►  Oct 29 (Day 3)  ──►  Oct 30 (Day 4)  ──►  Oct 31 (Day 5)  ──►  Nov 1 (Day 6)  ──►  Nov 2-4 (Buffer)
Scaffold, Docs,       Ingest, Extract,     Practice Room,       Semantic Audit,      Core Screens,        Evaluation,          Demo Video,
Shell & Smoke-Tests   Rubric Engine        ASR & WebSocket      Feedback, Retries    IndexedDB, Polish    Deploy, Benchmarks   Submission
```

---

## Day 1 — October 27: Project Scaffold, Architecture, Provider Smoke Tests & Application Shell

### Objective

Establish a rock-solid, production-minded development foundation, define all architecture contracts, implement foundational brand design tokens, verify AI provider connectivity, and construct the basic application navigation shell.

### Tasks & Status

| Task ID    | Task Description                                                                                                                                              | Status        | Implementation Plan Ref                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `TASK-1.1` | Initialize Git repository and verify `.gitignore` isolation                                                                                                   | **Completed** | [Section 1](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#1-repository-and-scaffold-structure) |
| `TASK-1.2` | Scaffold Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Zod, and pnpm                                                                                  | **Completed** | [Section 1](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#1-repository-and-scaffold-structure) |
| `TASK-1.3` | Configure brand palette design tokens, typography, and responsive baseline                                                                                    | **Completed** | [Section 2](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#2-design-system-and-tokens)          |
| `TASK-1.4` | Establish complete project documentation suite (`README`, `ROADMAP`, `IMPLEMENTATION_PLAN`, `PROGRESS`, `ARCHITECTURE`, `PROVIDER_VERIFICATION`, `DECISIONS`) | **Completed** | [Section 10](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#10-documentation-and-governance)    |
| `TASK-1.5` | Implement server-side Provider Verification smoke-test suite (Meta & Baseten)                                                                                 | **Completed** | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer)                 |
| `TASK-1.6` | Verify provider adapters & live AI smoke tests (`muse-spark-1.3`, `muse-spark-open-1026`)                                                                     | **Completed** | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer)                 |
| `TASK-1.7` | Correct Meta ASR Protocol (`authorization.accessToken`, `PCM_24KHZ`) and verify live speech transcription (`muse-voice-transcribe-1.0`)                       | **Completed** | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer)                 |

### Acceptance Criteria

- [x] Clean Next.js build and TypeScript type-check with zero errors.
- [x] ESLint flat config with Prettier passing without warnings.
- [x] `.env.example` committed with no actual secrets.
- [x] Provider smoke tests demonstrate actual API latency and response formats with verified credentials.
- [x] Live Meta Voice Transcribe speech recognition verified with audio fixture and final transcript.

### Dependencies & Risks

- **Risk:** Meta Model API rate limits or transient network drops.
- **Mitigation:** Baseten reasoning provider configured as verified alternative adapter; 1-shot retry and bounded timeouts in place. All 3 capabilities (Meta reasoning, Baseten reasoning, Meta ASR) are verified and operational.

---

## Day 2 — October 28: Material Ingestion, Extraction, Rubric Generation & Source Review

### Objective

Allow students to input study materials (text or structured notes), extract the central question and reference answer, generate a source-grounded rubric broken down into essential concepts and terminology, and let students review and edit the rubric.

### Tasks & Status

| Task ID     | Task Description                                                                               | Status        | Implementation Plan Ref                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `TASK-2.1`  | Build Material Ingestion UI (`src/features/library`) supporting text paste and note input      | **Completed** | [Section 4](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#4-features-library-and-ingestion)    |
| `TASK-2.2`  | Implement server-side Q&A extraction pipeline using Meta reasoning model                       | **Completed** | [Section 4](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#4-features-library-and-ingestion)    |
| `TASK-2.3`  | Build Rubric Generation engine producing structured concept objects with Zod schemas           | **Completed** | [Section 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#5-features-source-review-and-rubric) |
| `TASK-2.4`  | Build Source Review UI (`src/features/source-review`) allowing students to edit concepts       | **Completed** | [Section 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#5-features-source-review-and-rubric) |
| `TASK-2.5`  | Implement foundational local storage persistence for study items in browser                    | **Completed** | [Section 8](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#8-persistence-indexeddb)             |
| `TASK-2.6`  | Route-based navigation, Student-First UX, source-grounded extraction & visual polish           | **Completed** | [Section 4, 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                                  |
| `TASK-2.7`  | UI Polish, Question Review Redesign, Responsive Fixes, Cursor Affordances & Page SEO           | **Completed** | [Section 2, 4, 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                               |
| `TASK-2.8`  | Mobile Responsiveness, Hero Order Correction & Section-Level Horizontal Scrolling              | **Completed** | [Section 2, 4, 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                               |
| `TASK-2.9`  | Home Hero Illustration Desktop & Tablet Positioning Alignment                                  | **Completed** | [Section 2](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#2-design-system-and-tokens)          |
| `TASK-2.10` | Phase 1: Image, Camera and PDF Ingestion with Meta Multimodal Reasoning & Master-Detail Review | **Completed** | [Section 4](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#4-features-library-and-ingestion)    |
| `TASK-2.11` | Follow-up: Multi-Image Ingestion, Import Questions into Existing Sets & Accurate Save-State UX | **Completed** | [Section 4, 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                                  |
| `TASK-2.12` | UI Refinement: Dedicated PDF Tab, Responsive Image Uploads & Homepage Document Title           | **Completed** | [Section 2, 4](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                                  |

### Acceptance Criteria

- [x] Student can input raw study material and receive extracted Q&A within 5 seconds.
- [x] Students can upload assignment PDFs (up to 20MB, 50 pages) and images (JPEG, PNG, WebP) or take a photo with mobile camera.
- [x] Client and server validate magic bytes (`%PDF-`, `0xFFD8FF`, `0x89504E47`, `RIFF...WEBP`) rather than trusting file extensions.
- [x] Real-world test fixtures discovered and verified under `public/assets/qa_material/`: `STE_QB_UT1.pdf` (3.77 MB, 10 pages) and `test_qa.jpeg` (108.7 KB).
- [x] Multimodal reasoning pipeline with Meta `muse-spark-1.3` successfully extracts authentic questions with citations and page numbers.
- [x] Unified Material Ingestion UI at `/materials/new` matches design reference with `Upload File`, `Take Photo`, and `Paste Text` tabs.
- [x] Master-detail review interface displays detected questions, editable question/answer cards, and interactive `Split` and `Merge` tools.
- [x] Sequential rubric generation creates structured points to remember and persists full study set to browser IndexedDB before navigating to review.
- [x] Generated rubric produces validated structured items across 5 student-facing categories (Main idea, Key term, Steps in order, Mistakes to avoid, Helpful extra).
- [x] Student can add, modify, or remove rubric concepts and regenerate rubrics before starting practice.
- [x] Study set persists reliably to local browser IndexedDB across page reloads.
- [x] Real route-based navigation implemented (`/`, `/materials/new`, `/library`, `/review/[id]`) with responsive sidebar & mobile bottom bar.
- [x] Source-grounded extraction strictly enforces original text fidelity, detects missing questions/answers, and forbids silent question fabrication.
- [x] Complete purge of developer/rubric jargon in favor of student-first active recall terminology.
- [x] Home page hero features the authentic student illustration with responsive proportions and truthful study metrics.
- [x] Home page mobile hero order strictly follows heading/description -> hero illustration -> primary CTA button on mobile (< 768px), side-by-side on desktop (>= 768px), with zero DOM duplication.
- [x] Document-level horizontal scroll eliminated across 320px, 360px, 390px, 430px, 768px, and 1440px viewports (`scrollWidth <= clientWidth`).
- [x] Section-level horizontal scrolling properly constrained to dedicated scrollers (curated sample topics and category filter pills) with accessible region roles and `min-w-0` guards.
- [x] Question Review page completely redesigned matching visual reference with auto-expanding textareas, mobile question selector, and zero nested scrolling.
- [x] Interactive controls audit completed with explicit `cursor-pointer` and honest disabled practice affordances.
- [x] Full App Router SEO page metadata and title templates implemented across all user-facing routes.
- [x] Prohibited global `overflow-x-hidden` hacks on `html` or `body` completely avoided.
- [x] Multi-image batch ingestion supports up to 15 images and 25 MB total batch with magic-byte validation, drag-and-drop, camera appends, reordering, and cross-page question continuity.
- [x] Import questions into existing study sets via dedicated modal without losing existing questions or attempt history, featuring candidate selection checkboxes, inline edits, and sequential rubric generation.
- [x] Accurate study-set save states in Points Review view with deep serialization comparison, quiet saved state, unsaved changes banner with primary save button, and in-flight save race protection.
- [x] Upload File tab dedicated specifically to PDF ingestion with single-file validation and drop zone.
- [x] Take Photo / Upload Images tab consolidates multiple-image ingestion with responsive primary actions (desktop/laptop shows "Upload images" with multi-file picker, mobile/tablet shows "Take photo" + "Select from device", with no camera primary action on desktop).
- [x] Homepage document title configured as exact absolute title `Retell | Turn Study into Confidence` while preserving template titles across all other routes.

### Dependencies & Risks

- **Risk:** Malformed JSON from model reasoning output.
- **Mitigation:** Strict Zod schema parsing with retry logic and fallback repair prompts.

---

## Day 3 — October 29: Practice Room, Microphone Capture, Real-Time Transcription & WebSocket Lifecycle

### Objective

Create the spoken Practice Room with browser microphone capture, resilient WebSocket audio streaming, real-time live transcription display, audio session lifecycle management, and pause detection.

### Tasks & Status

| Task ID    | Task Description                                                                                  | Status    | Implementation Plan Ref                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------- |
| `TASK-3.1` | Build Practice Room UI (`src/features/practice`) with waveform and status indicator               | Completed | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |
| `TASK-3.2` | Implement client-side audio capture pipeline (`src/lib/audio`) via `MediaRecorder`/`AudioWorklet` | Completed | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |
| `TASK-3.3` | Implement WebSocket connection to Meta real-time ASR endpoint (`muse-voice-transcribe-1.0`)       | Completed | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer)      |
| `TASK-3.4` | Implement live transcript streaming UI with real-time word updates                                | Completed | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |
| `TASK-3.5` | Implement silence/pause detection with optional contextual nudge hint                             | Completed | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |
| `TASK-3.6` | Ensure audio session finalization preserves full transcript under all disconnect scenarios        | Completed | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |

### Key Milestones Completed

- [x] Spoken Practice Room UI implemented at canonical route `/study/:id/practice` (with `/practice/:id` alias) styled with authentic Butter & Tomato design tokens.
- [x] Web Audio microphone capture pipeline resamples to 24kHz signed 16-bit PCM mono, chunks into 80ms frames (3,840 bytes), and releases all audio tracks on unmount without resource leakage.
- [x] Server-side Next.js route handlers (`/api/transcribe/*`) relay audio frames to `wss://api.meta.ai/v1/asr/realtime` with zero client-side secret exposure.
- [x] Real-time Server-Sent Events (SSE) stream deltas to client, distinguishing live interim speech from finalized phrases without word duplication.
- [x] RMS silence monitoring detects conversational pauses (> 4s) and surfaces a non-punitive, reassuring contextual nudge.
- [x] Practice attempt records (`id`, `studySetId`, `questionId`, `transcript`, `wordCount`, `durationSeconds`) persist reliably to IndexedDB (`retell_db` -> `practice_attempts`) with offline in-memory fallback.
- [x] Seamless navigation wired from Source Review ("Start practising") and Home page study set cards directly into the Practice Room.
- [x] Corrective Phase: Transcript loss on finish resolved via monotonic `TranscriptAccumulator`, interim token promotion, and safe snapshot fallbacks.
- [x] Corrective Phase: Contextual recall cues replace generic pause nudges with 1–4 word hints grounded in study material, capped at 3 per attempt.
- [x] Corrective Phase: Quiet-voice usability calibrated (`silenceThresholdRms: 0.008`) with waveform sensitivity scaling and clear UX guidance.
- [x] Reliability Phase: Global session registry (`globalThis`) and dangling WebSocket cleanup eliminate 404/200 desynchronization.
- [x] Reliability Phase: SpeechRecognition fallback auto-restart on pause/silence prevents permanent transcription death after pausing.
- [x] Reliability Phase: Bluetooth headset detection and input device selector in Practice Room with disconnection safety.
- [x] Reliability Phase: Unbounded contextual hints continue throughout long answers with distinct prefix-aware cue extraction.
- [x] Reliability Phase: Truthful provider observability (`Meta Voice AI` vs `Browser Speech Engine`) in live room and attempt summary.

### Acceptance Criteria

- Microphone permissions handled gracefully with clear user instructions.
- Live transcription renders on screen with sub-second perceived latency.
- Disconnections, user stops, and network drops preserve the accumulated transcript safely.

### Dependencies & Risks

- **Risk:** WebSocket protocol compatibility between browser and Meta ASR endpoint (format, sample rate, headers).
- **Mitigation:** Node.js WebSocket proxy if direct browser WebSocket requires authentication headers not supported in browser WebSocket API.

---

## Day 4 — October 30: Semantic Answer Auditing, Actionable Feedback, Retries & Paragraph Scoping

### Objective

Implement the semantic evaluation engine that assesses spoken transcripts against the reference answer and structured points to remember, highlights covered, partial, missing, and inaccurate points without keyword bias, strictly distinguishes omissions from factual contradictions, supports paragraph-level practice evaluation, and presents transparent conceptual coverage breakdowns in the Answer Review view.

### Tasks & Status

| Task ID    | Task Description                                                                                    | Status        | Implementation Plan Ref                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| `TASK-4.1` | Implement server-side semantic answer audit route handler (`/api/audit`) using Meta reasoning model | **Completed** | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |
| `TASK-4.2` | Build Answer Review UI (`/study/:id/attempts/:attemptId`) with conceptual breakdown cards           | **Completed** | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |
| `TASK-4.3` | Implement concept status visualizer (`covered`, `partially_covered`, `missing`, `incorrect`)        | **Completed** | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |
| `TASK-4.4` | Implement retry practice flow preserving previous attempts with local IndexedDB persistence         | **Completed** | [Section 7, 8](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                  |
| `TASK-4.5` | Implement paragraph-level answer scoping and evaluation for multi-paragraph answers                 | **Completed** | [Section 6, 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                  |
| `TASK-4.6` | Build Attempt-to-Attempt Progression & Comparison view                                              | Pending       | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |

### Key Milestones Completed

- [x] Evaluates conceptual understanding, NOT rote sentence memorization — students receive full credit for correct explanations using different phrasing, sentence structures, or valid real-world analogies.
- [x] Multi-status criterion evaluation (`covered`, `partially_covered`, `missing`, `incorrect`, `optional`) with honest visual distinction and badges.
- [x] Strict separation of omissions (`missing` / "What needs more attention") from factual errors (`incorrect` / "What needs correction").
- [x] Grounded transcript evidence citations with anti-hallucination verification — quoted student evidence must appear in the actual transcript or is omitted.
- [x] Transparent conceptual breakdown and coverage bar (e.g., "2 of 2 concepts covered") — zero unexplained percentages or AI confidence scores.
- [x] Local-first storage safety — student practice attempts are saved to IndexedDB _before_ triggering async evaluation, ensuring zero transcript loss on network drops or provider timeouts.
- [x] Canonical Answer Review route at `/study/:id/attempts/:attemptId` with SEO page metadata and seamless practice-to-review transition.
- [x] Paragraph-level practice support — multi-paragraph questions can be practiced by individual paragraph with scoped evaluation without penalizing unselected paragraphs.
- [x] 12-scenario evaluation test suite (`tests/unit/semantic-audit.test.ts`) validating exact matches, paraphrasing, partial answers, omissions, contradictions, keyword stuffing rejection, acoustic imperfections, and resilient storage retries.

### Acceptance Criteria

- [x] Semantic audit accepts valid paraphrases and does not perform naive string equality.
- [x] Missing and inaccurate points cite specific evidence from the student transcript.
- [x] Practice attempt transcripts persist safely in IndexedDB prior to calling evaluation endpoints.
- [x] Omissions and factual misconceptions are strictly separated in both evaluation and visual UI presentation.

### Dependencies & Risks

- **Risk:** Reasoning model hallucinating errors or overly harsh grading.
- **Mitigation:** Few-shot prompt grounding with reference answer citations and strict semantic equivalence rules.

---

## Day 5 — October 31: Complete Core Screens, IndexedDB Persistence, Reliability & Responsive UI

### Objective

Wire up the complete end-to-end user journey, finalize local IndexedDB persistence, perform responsive UI audits at 390px, 768px, and 1440px, and ensure comprehensive accessibility.

### Tasks & Status

| Task ID    | Task Description                                                                           | Status  | Implementation Plan Ref                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------- |
| `TASK-5.1` | Complete client-side IndexedDB repository (`src/lib/storage`) with Dexie or raw IDB        | Pending | [Section 8](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#8-persistence-indexeddb)         |
| `TASK-5.2` | Polish responsive layouts at 390px (mobile), 768px (tablet), and 1440px (desktop)          | Pending | [Section 2](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#2-design-system-and-tokens)      |
| `TASK-5.3` | Implement keyboard navigation, ARIA live regions for transcripts, and high-contrast checks | Pending | [Section 2](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#2-design-system-and-tokens)      |
| `TASK-5.4` | Add comprehensive error boundaries, retry buttons, and offline storage safeguards          | Pending | [Section 9](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#9-error-handling-and-resilience) |

### Acceptance Criteria

- Refreshing the browser preserves all study sets, rubrics, and attempts.
- No horizontal scrolling or broken components at 390px width.
- Screen readers receive live transcript updates via `aria-live`.

---

## Day 6 — November 1: Evaluation, Deployment, Provider Comparison & Demo Preparation

### Objective

Deploy production application, benchmark Meta Model API vs Baseten inference, conduct end-to-end user testing, and prepare demo scripts.

### Tasks & Status

| Task ID    | Task Description                                                        | Status  | Implementation Plan Ref                                                                                           |
| ---------- | ----------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `TASK-6.1` | Deploy Next.js application to Vercel production environment             | Pending | [Section 11](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#11-deployment-and-hosting)       |
| `TASK-6.2` | Benchmark and document latency/accuracy comparing Meta vs Baseten       | Pending | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer)              |
| `TASK-6.3` | Run automated Playwright end-to-end regression tests                    | Pending | [Section 10](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#10-documentation-and-governance) |
| `TASK-6.4` | Prepare structured demo scripts featuring real technical exam questions | Pending | [Section 12](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#12-demo-and-submission)          |

---

## November 2 – 4: Submission Preparation, Polish & Video

- **Nov 2:** Rehearse live demo walkthrough, test audio input across diverse hardware/microphones.
- **Nov 3:** Record and edit required 3-minute hackathon demo video showcasing real speech transcription and semantic auditing.
- **Nov 4 (Before 9 PM ET):** Complete submission write-up on Devpost/hackathon portal, verify links, publish video, and finalize repository.
