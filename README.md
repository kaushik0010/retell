# Retell

> **Know it. Say it. Improve it.**

Retell is an AI-powered spoken practice and recall platform built for the **Meta Global AI Developer Hackathon**. It helps students master complex exam answers by speaking them aloud in their own words, receiving real-time transcription, and getting an objective, source-grounded semantic audit of essential concepts, required terminology, and reasoning structures.

---

## The Problem Retell Solves

Students preparing for technical, professional, and academic examinations often encounter a frustrating phenomenon: they understand the underlying topic conceptually, but when faced with an exam prompt, they fail to recall the specific technical terminology, key relationships, sequence of mechanisms, or structured evidence expected in high-scoring written answers.

Conventional study methods fall short:

- **Passive rereading** creates an illusion of competence without active retrieval practice.
- **Flashcard apps** test discrete atomic facts rather than connected, multi-sentence conceptual explanations.
- **Generic AI chat tools** frequently hallucinate, drift from the student's actual syllabus or reference text, and compare answers purely using keyword matching—penalizing valid paraphrases or accepting superficial buzzwords.

Retell bridges this gap through **spoken active recall grounded in the student's own reference materials**.

---

## Target Users

- **Technical & Engineering Students:** Computer Science, Electronics, Mechanical, and Civil Engineering candidates mastering complex systems, protocols, algorithms, and design trade-offs.
- **Medical & Bioscience Students:** Memorizing multi-step biochemical pathways, physiological mechanisms, pharmacology, and clinical diagnostic criteria.
- **Law & Professional Candidates:** Practicing statutory analyses, doctrinal tests, and multi-prong legal frameworks.
- **Any Student Preparing for Written Exams:** Needing to produce precise, comprehensive explanations under time constraints.

---

## The Core Product Experience

The complete student workflow consists of 10 structured steps:

```
[1. Ingest Material]  -->  [2. Extract Q&A]  -->  [3. Generate Rubric]
          |                                               |
[6. Real-Time Transcript] <-- [5. Practice Aloud]  <-- [4. Review & Correct]
          |
[7. Contextual Hint (Pause)]
          |
[8. Stop Speaking]     -->  [9. Semantic Audit]   -->  [10. Retry & Compare]
```

1. **Add Study Material:** Paste lecture notes, textbook excerpts, or upload reference documents.
2. **Extract Q&A:** The system identifies the target question and reference answer.
3. **Generate Structured Rubric:** Deconstructs the reference answer into essential concepts, required terminology, core relationships, sequences, and supporting evidence.
4. **Review & Correct:** The student inspects and refines the extracted rubric before practicing.
5. **Enter Practice Room:** Answer aloud naturally using browser microphone capture.
6. **Live Transcription:** Receive real-time speech transcription streamed directly as the student speaks.
7. **Contextual Pause Hints:** Receive an optional gentle nudge after an extended pause without prematurely declaring concepts missing.
8. **Stop Speaking:** Finalize the audio session with full transcript preservation.
9. **Source-Grounded Semantic Audit:** Evaluates coverage (correct, partially covered, missing, inaccurate) based on semantic meaning rather than literal keyword matching.
10. **Retry & Compare:** Re-attempt the explanation and track concept mastery across attempts.

---

## Planned Technology Stack

| Layer                       | Technology                    | Role / Purpose                                                             |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| **Framework**               | Next.js (App Router, v16.4.3) | Server-rendered shell, API routes, layout management                       |
| **Language**                | TypeScript (v5.9.3, Strict)   | Strict typing across domain models and APIs                                |
| **UI Library**              | React (v19.3.0)               | Interactive user interface                                                 |
| **Styling**                 | Tailwind CSS (v4)             | Design-token-driven responsive styling                                     |
| **Validation**              | Zod (v4.6.7)                  | Runtime schema validation for rubrics and API payloads                     |
| **Package Manager**         | pnpm (v11.0.9)                | Fast, deterministic dependency management                                  |
| **Code Quality**            | ESLint 9 + Prettier           | Consistent code formatting and static analysis                             |
| **Primary AI Provider**     | Meta Model API                | Reasoning (`muse-spark-1.3`) & Real-time ASR (`muse-voice-transcribe-1.0`) |
| **Alternative AI Provider** | Baseten                       | Alternative reasoning (`meta-models/muse-spark-open-1026`)                 |
| **Persistence**             | IndexedDB (Client)            | Local-first browser storage for study sets and attempts                    |
| **Testing**                 | Vitest & Playwright           | Unit, integration, and browser end-to-end testing                          |

---

## Architecture Overview

```
                      +---------------------------------------+
                      |            Browser Client             |
                      |                                       |
                      |  - App Router Pages & Components       |
                      |  - Microphone Capture (MediaStream)   |
                      |  - IndexedDB (Materials & Attempts)   |
                      +-------------------+-------------------+
                                          |
                        HTTP API Requests | Real-time WebSocket
                                          | (Transcribe Stream)
                                          v
                      +---------------------------------------+
                      |      Next.js Server & Proxy Layer     |
                      |                                       |
                      |  - Server-side Credential Isolation   |
                      |  - Rubric Generation Endpoint         |
                      |  - Semantic Audit Endpoint            |
                      |  - Provider Adapter (Meta / Baseten)  |
                      +-------------------+-------------------+
                                          |
                         HTTPS / WSS APIs | (Never exposed to client)
                                          v
                      +---------------------------------------+
                      |         AI Inference Providers        |
                      |                                       |
                      |  - Meta Model API (muse-spark-1.3)    |
                      |  - Meta ASR (muse-voice-transcribe)   |
                      |  - Baseten (muse-spark-open-1026)     |
                      +---------------------------------------+
```

### Key Architectural Tenets:

- **Local-First Privacy:** Student study materials, generated rubrics, audio sessions, and historical attempts are stored locally in the browser's IndexedDB. No unnecessary user accounts or third-party cloud data synchronization.
- **Provider Credential Isolation:** All reasoning calls and provider authentication keys reside exclusively on the server side. No credentials or secret tokens are ever exposed to client bundles.
- **Semantic Over Literal Evaluation:** Rubric checks evaluate whether underlying meanings, causal relationships, and technical concepts are communicated accurately, tolerating valid synonyms and paraphrases.
- **Transcript Preservation:** If an AI evaluation step experiences a timeout or network glitch, the student's spoken transcript is never lost and remains accessible for retry or manual review.

---

## Current Implementation Status

### Implemented in Task 1 (Foundation):

- [x] Project workspace scaffolded with Next.js 16 (App Router), React 19, TypeScript (Strict).
- [x] Tailwind CSS v4 design system configured with warm brand tokens (`#FFF8EB`, `#E6533D`, `#F5D96B`, `#FFE2D7`, `#302B27`, `#74685C`, `#FFFFFF`).
- [x] Typography configured with Plus Jakarta Sans (headings) and Inter (body/UI).
- [x] ESLint flat config and Prettier formatting established without conflicts.
- [x] Production build and development server verified.
- [x] Environment configuration template (`.env.example`) and strict `.gitignore` rules in place.
- [x] Complete project documentation established (`README.md`, `ROADMAP.md`, `IMPLEMENTATION_PLAN.md`, `PROGRESS.md`, `ARCHITECTURE.md`, `PROVIDER_VERIFICATION.md`, `DECISIONS.md`).

### Planned (Upcoming Tasks):

- [ ] Provider smoke tests & provider adapters (Task 2).
- [ ] Material ingestion, Q&A extraction, and structured rubric generation (Day 2).
- [ ] Practice Room audio capture and real-time transcription via WebSocket (Day 3).
- [ ] Semantic answer evaluation, concept gap auditing, and attempt comparison (Day 4).
- [ ] Full IndexedDB persistence and responsive polishing (Day 5).
- [ ] End-to-end evaluation, deployment, and demo preparation (Day 6).

---

## Local Setup & Development

### Prerequisites

- Node.js `v20+` (verified on `v22.21.0`)
- pnpm `v10+` (verified on `v11.0.9`)
- Git `v2.40+`

### Installation

1. Navigate to the project root:

   ```bash
   cd retell
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` to populate your Meta Model API or Baseten API keys when available. Note: local development and scaffolding can proceed without keys.

### Available Commands

| Command                 | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| `pnpm run dev`          | Starts the Next.js development server at `http://localhost:3000` |
| `pnpm run build`        | Builds the optimized production bundle with TypeScript checks    |
| `pnpm run start`        | Runs the production server from the compiled build output        |
| `pnpm run lint`         | Runs ESLint 9 static analysis across the codebase                |
| `pnpm run type-check`   | Runs `tsc --noEmit` to validate strict TypeScript types          |
| `pnpm run format`       | Formats all code with Prettier and Tailwind CSS class sorting    |
| `pnpm run format:check` | Verifies code formatting compliance                              |

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```env
NODE_ENV=development

# Primary AI Provider: Meta Model API
META_MODEL_API_KEY=
META_REASONING_MODEL=muse-spark-1.3
META_TRANSCRIPTION_MODEL=muse-voice-transcribe-1.0

# Alternative Reasoning Provider: Baseten
BASETEN_API_KEY=
BASETEN_REASONING_MODEL=meta-models/muse-spark-open-1026

# Provider Configuration
REASONING_PROVIDER=meta
TRANSCRIPTION_PROVIDER=meta
```

**Security Policy:** Never commit `.env.local`, `.env`, or API keys to Git. Secret keys are excluded by `.gitignore`.
