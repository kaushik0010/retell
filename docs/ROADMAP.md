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

| Task ID    | Task Description                                                                          | Status        | Implementation Plan Ref                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `TASK-2.1` | Build Material Ingestion UI (`src/features/library`) supporting text paste and note input | **Completed** | [Section 4](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#4-features-library-and-ingestion)    |
| `TASK-2.2` | Implement server-side Q&A extraction pipeline using Meta reasoning model                  | **Completed** | [Section 4](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#4-features-library-and-ingestion)    |
| `TASK-2.3` | Build Rubric Generation engine producing structured concept objects with Zod schemas      | **Completed** | [Section 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#5-features-source-review-and-rubric) |
| `TASK-2.4` | Build Source Review UI (`src/features/source-review`) allowing students to edit concepts  | **Completed** | [Section 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#5-features-source-review-and-rubric) |
| `TASK-2.5` | Implement foundational local storage persistence for study items in browser               | **Completed** | [Section 8](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#8-persistence-indexeddb)             |
| `TASK-2.6` | Route-based navigation, Student-First UX, source-grounded extraction & visual polish      | **Completed** | [Section 4, 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                                  |
| `TASK-2.7` | UI Polish, Question Review Redesign, Responsive Fixes, Cursor Affordances & Page SEO      | **Completed** | [Section 2, 4, 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                               |
| `TASK-2.8` | Mobile Responsiveness, Hero Order Correction & Section-Level Horizontal Scrolling         | **Completed** | [Section 2, 4, 5](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md)                               |
| `TASK-2.9` | Home Hero Illustration Desktop & Tablet Positioning Alignment                             | **Completed** | [Section 2](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#2-design-system-and-tokens)          |

### Acceptance Criteria

- [x] Student can input raw study material and receive extracted Q&A within 5 seconds.
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

### Dependencies & Risks

- **Risk:** Malformed JSON from model reasoning output.
- **Mitigation:** Strict Zod schema parsing with retry logic and fallback repair prompts.

---

## Day 3 — October 29: Practice Room, Microphone Capture, Real-Time Transcription & WebSocket Lifecycle

### Objective

Create the spoken Practice Room with browser microphone capture, resilient WebSocket audio streaming, real-time live transcription display, audio session lifecycle management, and pause detection.

### Tasks & Status

| Task ID    | Task Description                                                                                  | Status  | Implementation Plan Ref                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `TASK-3.1` | Build Practice Room UI (`src/features/practice`) with waveform and status indicator               | Pending | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |
| `TASK-3.2` | Implement client-side audio capture pipeline (`src/lib/audio`) via `MediaRecorder`/`AudioWorklet` | Pending | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |
| `TASK-3.3` | Implement WebSocket connection to Meta real-time ASR endpoint (`muse-voice-transcribe-1.0`)       | Pending | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer)      |
| `TASK-3.4` | Implement live transcript streaming UI with real-time word updates                                | Pending | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |
| `TASK-3.5` | Implement silence/pause detection with optional contextual nudge hint                             | Pending | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |
| `TASK-3.6` | Ensure audio session finalization preserves full transcript under all disconnect scenarios        | Pending | [Section 6](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#6-features-practice-room) |

### Acceptance Criteria

- Microphone permissions handled gracefully with clear user instructions.
- Live transcription renders on screen with sub-second perceived latency.
- Disconnections, user stops, and network drops preserve the accumulated transcript safely.

### Dependencies & Risks

- **Risk:** WebSocket protocol compatibility between browser and Meta ASR endpoint (format, sample rate, headers).
- **Mitigation:** Node.js WebSocket proxy if direct browser WebSocket requires authentication headers not supported in browser WebSocket API.

---

## Day 4 — October 30: Semantic Answer Auditing, Actionable Feedback, Retries & Attempt Comparison

### Objective

Implement the semantic evaluation engine that scores spoken transcripts against the structured rubric, highlights covered, partial, missing, and inaccurate points without keyword bias, and enables side-by-side attempt comparisons.

### Tasks & Status

| Task ID    | Task Description                                                                             | Status  | Implementation Plan Ref                                                                              |
| ---------- | -------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `TASK-4.1` | Implement server-side semantic answer audit route handler using Meta reasoning model         | Pending | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |
| `TASK-4.2` | Build Answer Review UI (`src/features/answer-review`) with concept breakdown cards           | Pending | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |
| `TASK-4.3` | Implement concept status visualizer (`correct`, `partially_covered`, `missing`, `incorrect`) | Pending | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |
| `TASK-4.4` | Implement retry practice flow preserving previous attempts                                   | Pending | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |
| `TASK-4.5` | Build Attempt Comparison view highlighting progression across tries                          | Pending | [Section 7](file:///D:/Javascript/Hackathons/retell/docs/IMPLEMENTATION_PLAN.md#7-ai-provider-layer) |

### Acceptance Criteria

- Semantic audit accepts valid paraphrases and does not perform naive string equality.
- Missing and inaccurate points cite specific evidence from the student transcript.
- Students can view attempt #1 vs attempt #2 to observe concept coverage improvement.

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
