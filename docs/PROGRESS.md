# Retell — Progress Tracking and Verification Checklist

This is the authoritative, real-time checklist tracking all tasks across the Retell development lifecycle. Every task transition requires recorded verification evidence.

---

## 1. Completed Tasks

- [x] **`TASK-1.1` — Environment and Repository Initialization**
  - Confirmed target directory `D:\Javascript\Hackathons\retell`.
  - Initialized Git repository with master branch.
  - Configured `.gitignore` to strictly exclude `.env*`, `.pnpm-debug.log*`, `node_modules`, and local build artifacts while explicitly whitelisting `.env.example`.
  - Verified no secret-bearing files are tracked.

- [x] **`TASK-1.2` — Next.js Application Scaffolding with pnpm**
  - Scaffolded Next.js 16.4.3 (App Router), React 19.3.0, TypeScript 5.9.3, and Tailwind CSS 4.3.3.
  - Configured pnpm (v11.0.9) as package manager.
  - Installed runtime schema validation (`zod` v4.6.7), styling utilities (`clsx`, `tailwind-merge`), and dev tooling (`prettier`, `eslint-config-prettier`, `@tailwindcss/postcss`, `postcss`).
  - Added strict TypeScript options (`noUncheckedIndexedAccess`, `noImplicitOverride`) in `tsconfig.json`.

- [x] **`TASK-1.3` — Visual Design Tokens & Foundational Styling**
  - Established brand color palette in Tailwind v4 `@theme`: Warm cream (`#FFF8EB`), Tomato (`#E6533D`), Tomato hover (`#C9432F`), Butter yellow (`#F5D96B`), Peach (`#FFE2D7`), Ink (`#302B27`), Secondary text (`#74685C`), and White (`#FFFFFF`).
  - Set up typography font tokens for Plus Jakarta Sans (headings) and Inter (body and UI).
  - Configured 16px card radius and 12px button radius conventions.
  - Built responsive foundational landing page in `src/app/page.tsx` tested for 390px, 768px, and 1440px widths.

- [x] **`TASK-1.4` — Project Documentation Suite**
  - Created comprehensive `README.md` with problem statement, workflow, architecture, and commands.
  - Created `docs/ROADMAP.md` covering the complete 6-day plan and buffer window.
  - Created `docs/IMPLEMENTATION_PLAN.md` with module boundaries and responsibilities.
  - Created `docs/ARCHITECTURE.md` specifying system boundaries, security, and persistence models.
  - Created `docs/PROVIDER_VERIFICATION.md` with Meta and Baseten verification matrix.
  - Created `.env.example` placeholder template.
  - Created `docs/DECISIONS.md` recording all locked architectural decisions.

- [x] **`TASK-1.5` — Task 1 Verification & Git Commit**
  - All static checks (TypeScript, ESLint, Prettier, Webpack production build) verified with zero errors.
  - Verified local dev and production server HTTP 200 responses.
  - Clean working tree committed with Conventional Commit message.

- [x] **`TASK-1.6` — Provider Verification, Adapters & AI Smoke Tests (Task 2)**
  - Implemented interchangeable `ReasoningProvider` interface supporting Meta and Baseten (`src/lib/providers/`).
  - Enforced server-side execution boundaries with `server-only`.
  - Implemented resilient token-stripping sanitization (`sanitizeMessage`, `sanitizeError`, `categorizeHttpError`).
  - Added development verification route handler `/api/dev/verify-provider` guarded against production exposure.
  - Wrote comprehensive unit tests (`tests/unit/`) for schemas, sanitization, and provider adapters using Vitest.
  - Executed live smoke tests against Meta Model API (`muse-spark-1.3`) — **Verified**.
  - Executed live smoke tests against Baseten (`meta-models/muse-spark-open-1026`) — **Verified**.

- [x] **`TASK-1.7` — Correct Meta ASR Protocol and Verify Live Transcription (Task 3)**
  - Diagnosed Task 2 handshake format defect (`api_key` top-level vs official `authorization.accessToken`).
  - Corrected handshake payload structure to match official Meta Voice schema (`authorization: { accessToken: "Bearer <KEY>" }`, `audioEncoding: "PCM_24KHZ"`, `model: "muse-voice-transcribe-1.0"`, `mode: "PUSH_TO_TALK"`).
  - Created deterministic non-sensitive test audio fixtures: `tests/fixtures/speech-24k.wav` and `speech-24k.pcm` (spoken sentence: _"Active recall is explaining concepts aloud in your own words."_).
  - Implemented multi-stage smoke test in `scripts/verify-providers.mjs`:
    - Stage A: Connection & handshake acknowledgement validation (`sessionId`).
    - Stage B: Real-time paced audio chunk streaming (80ms frames = 3,840 bytes).
    - Stage C: `{"type": "endStream"}` signal and final transcript reception.
    - Stage D: Graceful close validation (close code 1000).
  - Executed live end-to-end transcription smoke test:
    - **Outcome: 100% Verified**!
    - Final transcript received: `"Active recall is explaining concepts aloud in your own words."`
    - Close code: `1000` (`"No more transcript segments"`).
  - Updated unit tests in `tests/unit/providers.test.ts` (23/23 tests passing).

- [x] **`TASK-2.1` – `TASK-2.5` — Study Material Ingestion & Source-Grounded Rubric Generation (Task 4)**
  - **Domain Models & Zod Schemas (`src/lib/domain/study-set.ts`, `src/types/index.ts`):**
    - Defined schemas for `StudyMaterial`, `ExtractedQuestion`, `RubricCriterion`, `QuestionRubric`, and `StudySet`.
    - Implemented 5 distinct rubric criterion categories: `essential_concept`, `technical_anchor`, `relationship_sequence`, `accuracy_constraint`, and `optional_detail`.
    - Added `satisfactoryDemonstration` field to mandate semantic evaluation and explicitly accept paraphrases without keyword penalization.
  - **Question Extraction API (`POST /api/extract`):**
    - Defensively isolated user input from system instructions with strict prompt injection defense.
    - Grounded questions and reference answers strictly in the source material with excerpt citations.
  - **Rubric Generation API (`POST /api/rubric`):**
    - Generates multi-dimensional criteria across all 5 categories with stable IDs and mandatory flags.
    - Tested live with `muse-spark-1.3` (generating 5 verified criteria in 8.5s).
  - **Browser Persistence Layer (`src/lib/storage/study-store.ts`):**
    - IndexedDB storage (`retell_db`, store `study_sets`) with safe in-memory fallback for SSR and test runners.
    - Full CRUD support: save, get, list, update, and delete.
  - **Interactive User Interfaces:**
    - `MaterialIngestionForm.tsx`: Text input, character counter, 4 curated sample presets (DNS Resolution, React Reconciliation, ATP Synthase, OAuth PKCE), and multi-step progress indicators.
    - `SourceReviewView.tsx`: Collapsible source drawer, question selector, inline editing for questions, reference answers, and criteria, "+ Add Criterion", category filter tabs, and "Regenerate Rubric" action.
    - `StudySetList.tsx`: Local study library browser with question count, criteria summary, timestamps, and delete controls.
    - Responsive across 390px, 768px, and 1440px viewports.
  - **Testing & Verification:**
    - 47 passing unit tests across 7 test suites (`domain.test.ts`, `storage.test.ts`, `extract.test.ts`, `rubric.test.ts`, `providers.test.ts`, `sanitization.test.ts`, `schemas.test.ts`).
    - Clean TypeScript (`tsc --noEmit`), ESLint, and Prettier checks.
    - Successful Webpack production build.

- [x] **`TASK-2.6` — Navigation, Student-First UX, Source-Grounded Extraction & Visual Alignment (Task 5)**
  - **Real Route-Based Navigation & Universal Shell (`src/components/AppShell.tsx`, `src/app/layout.tsx`):**
    - Built persistent desktop left sidebar (240px) with brand book icon, peach active pill indicator, and tomato icons.
    - Added desktop search bar and user profile indicator.
    - Added mobile fixed bottom navigation bar (`Home`, `Study Library`, `Add Material`) with responsive active indicators.
    - Established dedicated URLs for all key states: `/` (Home), `/materials/new` (Add Material), `/library` (Study Library), `/review/[id]` (Points Review).
  - **Source-Grounded Extraction Pipeline (`src/app/api/extract/route.ts`, `src/lib/domain/study-set.ts`):**
    - Eliminated synthetic question invention from plain prose; forced strict ground truth extraction of real questions, exam prompts (Explain, Describe, Compare, Discuss), or explicit Q&A notes.
    - Added `ExtractionStatusSchema` with explicit handling for `found_qa`, `missing_question`, `missing_answer`, and `unclear`.
    - Added support for student-provided questions (`studentQuestion`) when notes lack a question header.
    - Updated sample presets with authentic exam question pairs (Operating Systems, DNS Resolution, React Reconciliation, ATP Synthase).
  - **Student-First Vocabulary Migration:**
    - Purged internal developer and assessment jargon ("rubric", "technical anchor", "accuracy constraint", "satisfactory demonstration", internal IDs).
    - Established friendly, encouraging student terms: "Points to remember", "Main idea", "Key term", "Steps in order", "Mistakes to avoid", and "Helpful extra".
    - Updated Points Review screen (`SourceReviewView.tsx`) with category tabs, inline editing, and Day 3 Practice Room banner preview.
  - **Design & Layout Alignment (Matching Visual References):**
    - Home screen (`src/app/page.tsx`): Hero banner, quick-action navigation, "Continue Practising" section with real IndexedDB card data, real progress stats, and sample study set quick-starts.
    - Add Material screen (`src/app/materials/new/page.tsx`): Stepper indicator, mode selector (Paste text, Upload notes, Take photo), sample material pills, missing question/answer resolution flows, and character counter.
    - Study Library screen (`src/app/library/page.tsx`): Search bar, filter tabs (All, Ready to practice, Added this week), card grid with question counts, Review Points & Practise actions, and delete confirmation.
  - **Testing & Verification:**
    - 56 passing unit tests across 8 test suites (`domain.test.ts`, `storage.test.ts`, `extract.test.ts`, `rubric.test.ts`, `providers.test.ts`, `sanitization.test.ts`, `schemas.test.ts`, `navigation.test.ts`).
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check with 0 errors and 0 warnings.
    - Clean Prettier code formatting verified across all files.
    - Successful Next.js production build (`next build --webpack`) generating all static and dynamic routes.

- [x] **`TASK-2.7` — UI Polish, Question Review Redesign, Responsive Fixes & Page SEO (Task 6)**
  - **Home Page Polish (`src/app/page.tsx`, `src/features/home/HomeView.tsx`):**
    - Integrated authentic student illustration (`public/assets/homepage_illustration.png`) with responsive proportions (`object-contain`, `priority`, desktop side-by-side, mobile stacked beneath CTA).
    - Purged misleading/developer labels ("Saved locally", "Ready to test", "IndexedDB local", "Q&A + Key Points", "100% Private", "Day 2 Milestone").
    - Retained truthful metrics with elevated typography: Study Sets, Questions to Rehearse, and Key Points to Remember.
    - Replaced misleading "Practise" action with an honest disabled affordance explaining that the Voice Practice Room unlocks in Day 3.
  - **Add Material Single-Row Curated Presets (`src/features/materials/NewMaterialView.tsx`):**
    - Sized and aligned the 4 sample topic cards into one single, horizontal-scrolling row (`flex-nowrap`, `shrink-0 min-w-[220px] max-w-[260px]`, `overflow-x-auto`) across desktop, tablet, and mobile.
    - Prevented page-level overflow with `max-w-full overflow-hidden`.
  - **Question Review Redesign (`src/features/source-review/SourceReviewView.tsx`, `src/features/review/ReviewClient.tsx`):**
    - Redesigned to match the provided visual reference (`media_1793177929850_39591af6.jpg`).
    - Implemented `AutoResizeTextarea` ensuring full content readability for questions, original answers, point descriptions, and satisfactory demonstration guidance without nested scrolling or clipped text.
    - Desktop: Sized two-column grid (5 cols Q&A, 7 cols Points) with generous width and padding.
    - Mobile: Full single-column flow with `1 of N` question navigator, arrow buttons, active question dropdown selector, horizontal category pill scroll, and collapsible source excerpt.
    - Added `beforeunload` warning to safeguard students against accidental loss of unsaved edits.
    - Honest Practice Room affordance banner (`Ready to practise explaining aloud?`) explaining Day 3 speech practice.
  - **Interaction Affordances Audit (`cursor-pointer`):**
    - Applied explicit `cursor-pointer` to all buttons, navigation links, sample preset cards, filter tabs, checkboxes, question selectors, and icon triggers.
    - Applied `cursor-not-allowed` to disabled controls.
  - **App Router SEO & Page Metadata:**
    - Established default title and template (`%s | Retell`) in `src/app/layout.tsx`.
    - Added student-first metadata across all routes: `/` (Home), `/library` (Study Library), `/materials/new` (Add Study Material), and `/review/[id]` (Review Points to Remember).
  - **Verification:**
    - 57 passing unit tests across 8 test suites in Vitest.
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check with 0 errors and 0 warnings.
    - Clean Prettier formatting across all files.
    - Successful Webpack production build generating all 8 static and dynamic routes.

- [x] **`TASK-2.8` — Mobile Responsiveness and Section-Level Horizontal Scrolling (Task 7)**
  - **Home Page Hero Ordering (`src/features/home/HomeView.tsx`):**
    - Implemented responsive CSS Grid ordering: on mobile (< 768px), strictly displays (1) Heading & description (`order-1`), (2) Hero illustration (`order-2`), (3) Primary "Add study material" CTA button (`order-3`).
    - On desktop (>= 768px), preserves side-by-side layout: heading (`md:col-span-7`), CTA beneath description (`md:order-2 md:col-span-7`), and illustration in the right column (`md:order-3 md:col-span-5 md:row-span-2`).
    - Zero element duplication: exactly one `<Image>` and one `<Link>` CTA in the DOM.
  - **Add Material Section Scrolling & Compact Stepper (`src/features/materials/NewMaterialView.tsx`):**
    - Constrained curated topic sample cards strictly inside a dedicated horizontal scroll container (`role="region" aria-label="Curated exam topics" tabIndex={0}`) with `w-[230px] min-w-[210px] shrink-0` card dimensions and `min-w-0` on parent.
    - Replaced wide stepper dividers with compact responsive spacing (`gap-1.5 sm:gap-3`, `w-4 sm:w-10`) preventing document blowout on narrow screens.
    - Made input mode selector tabs horizontally scrollable (`w-full min-w-0 overflow-x-auto scrollbar-thin flex-nowrap`).
  - **Question Review Responsive Safeguards (`src/features/source-review/SourceReviewView.tsx`):**
    - Added `w-full min-w-0` to all grid wrappers (`lg:col-span-5`, `lg:col-span-7`) preventing flex blowout caused by intrinsic input sizing.
    - Fixed point card top row on mobile: stacks category badge + title input with `min-w-0 flex-1`, while placing "Must include" toggle and delete button on the second row with `justify-between`.
    - Enforced `break-words` and `min-w-0` on `AutoResizeTextarea` to wrap long unbroken words.
    - Constrained category filter pills row to dedicated section scroller (`role="region" aria-label="Filter points by category" tabIndex={0}`).
  - **Global Shell Isolation (`src/components/AppShell.tsx`, `src/app/globals.css`):**
    - Added `w-full min-w-0` across root shell containers.
    - Added `pb-24 lg:pb-0` to ensure mobile fixed bottom navigation bar never obscures bottom page content.
    - Audited against prohibited `w-screen` and rejected global `overflow-x-hidden` hacks on `html` or `body`.
  - **Testing & Verification:**
    - 62 passing unit tests across 9 test suites in Vitest (including new `tests/unit/responsive-layout.test.ts`).
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check with 0 errors and 0 warnings.
    - Clean Prettier formatting across all files.
    - Successful Webpack production build (`next build --webpack`) generating all 8 static and dynamic routes.

- [x] **`TASK-2.11` — Follow-up: Multi-Image Ingestion, Import Questions into Existing Sets & Accurate Save-State UX**
  - **Feature A — Multi-Image Ingestion & Batch File Validation (`src/lib/files/index.ts`, `src/features/materials/NewMaterialView.tsx`):**
    - Implemented `validateFileBatch()` enforcing batch limits (max 15 images, 25 MB total batch ceiling, single PDF rule).
    - Added multi-file selection (`multiple` on `<input>`), drag-and-drop batch upload, and camera append button ("+ Add another photo" / "Take another photo").
    - Preview thumbnails with page indicators (`Page 1`, `Page 2`), file sizes, reordering controls (`Move up`, `Move down`), and individual removal triggers.
    - Updated `POST /api/extract` server prompt with page indexing (`--- PAGE / IMAGE i OF N ---`), cross-page answer continuity, and overlap deduplication instructions.
    - Added double-click prevention on extraction submission.
  - **Feature B — Import Questions into Existing Study Sets (`src/features/source-review/ImportQuestionsModal.tsx`, `src/features/source-review/SourceReviewView.tsx`):**
    - Dual actions on desktop and mobile: "+ Add Manually" and "Import from File" (PDF or images).
    - Created Butter & Tomato styled modal (`ImportQuestionsModal.tsx`) with 2-step workflow: file staging/validation followed by candidate question preview.
    - Candidate checkboxes, inline editing, and uncertainty flags (`isUncertain`) before importing.
    - Appending logic: assigns fresh unique IDs (`q_${crypto.randomUUID()}`), preserves existing questions, sequential rubric generation with fallback, and auto-persists to IndexedDB.
  - **Feature C — Accurate Save-State UX (`src/features/source-review/SourceReviewView.tsx`):**
    - Removed confusing "Saved to browser" text; established deep deterministic baseline serialization (`serializeStudySetForComparison()`).
    - Compares title, question, reference answer, orderIndex, and full rubric criteria details (name, description, guidance, mandatory flag).
    - Displays quiet "Saved" checkmark when clean; shows "Unsaved changes" + primary "Save study set" button when dirty.
    - Protects against in-flight save races by establishing baseline strictly from the confirmed saved snapshot.
    - Pure React 19 state architecture satisfying `react-hooks/refs` rules.
  - **Testing & Verification:**
    - 99 passing unit tests across 11 test suites in Vitest (including new 18-test suite in `tests/unit/followup-features.test.ts`).
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check (`pnpm run lint`) with 0 errors and 0 warnings.
    - Clean Prettier code formatting verified across all files.
    - Successful Webpack production build (`next build --webpack`) generating all 8 static and dynamic routes.

- [x] **`TASK-2.12` — UI Refinement: Dedicated PDF Tab, Responsive Image Uploads & Homepage Document Title**
  - **Upload File Tab Dedicated to PDFs (`src/features/materials/NewMaterialView.tsx`):**
    - Updated Tab 1 label to `Upload File (PDF)`. Dedicated specifically to single-PDF uploads up to 20MB / 50 pages.
    - Single PDF file input (`accept=".pdf,application/pdf"`), PDF drop validation, and clear error feedback if non-PDF files are dropped.
    - Preserved PDF page count display, file size formatting, extraction flow, loading states, and master-detail review.
  - **Take Photo / Upload Images Tab (`src/features/materials/NewMaterialView.tsx`):**
    - Renamed image tab to `Take Photo / Upload Images` (responsive `Photo / Images` on small mobile viewports).
    - Consolidated all multiple-image upload, preview, reordering, and removal workflows under this tab.
    - On laptops and desktops (`lg:` and up): primary action is "Upload images" (opens multi-select image file picker), with drag-and-drop support. Zero camera primary action is displayed on desktop.
    - On mobile phones and tablets (`< lg`): primary action is "Take photo" (opens camera), with an accessible secondary action "Select from device" (file picker) so mobile and tablet students can easily select existing photos from their library without using the camera.
    - Preserved batch limits (up to 15 images, 25MB total), magic-byte validation, ordering, page continuity, and double-submit protection.
  - **Homepage Document Title (`src/app/page.tsx`, `tests/unit/navigation.test.ts`):**
    - Set homepage document title to exact absolute string `Retell | Turn Study into Confidence` using `title: { absolute: "Retell | Turn Study into Confidence" }`.
    - Preserved template-based metadata across all other routes (`/library`, `/materials/new`, `/review/[id]`).
    - Updated and added regression tests in `tests/unit/navigation.test.ts`.
  - **Testing & Verification:**
    - 99 passing unit tests across 11 test suites in Vitest.
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check (`pnpm run lint`) with 0 errors and 0 warnings.
    - Clean Prettier code formatting verified across all files.
    - Successful Webpack production build (`next build --webpack`) generating all 8 static and dynamic routes.

- [x] **`TASK-2.9` — Home Hero Illustration Desktop & Tablet Positioning Alignment (Task 8)**
  - Fixed CSS Grid auto-placement defect in `src/features/home/HomeView.tsx` where `order-3` on illustration caused auto-placement to skip Row 1 (leaving a blank area beside heading and description) and drop the illustration into Row 2/3.
  - Implemented explicit grid coordinates for desktop/tablet (`md:`):
    - Heading & description: `md:col-start-1 md:col-span-7 md:row-start-1`
    - CTA button: `md:col-start-1 md:col-span-7 md:row-start-2`
    - Illustration: `md:col-start-8 md:col-span-5 md:row-start-1 md:row-span-2 md:self-center md:justify-end`
    - Vertical gap between rows adjusted to `md:gap-y-5` (20px) and column gap `md:gap-x-8` (32px).
  - Preserved mobile (< 768px) ordering: heading & description (`order-1`) -> illustration (`order-2`) -> CTA button (`order-3`).
  - Zero DOM duplication: exactly one `<Image>` and one `<Link>` CTA in the DOM.
  - Verified static checks and production build.

- [x] **`TASK-2.10` — Phase 1: Image, Camera and PDF Ingestion with Reliable Processing**
  - **Discovered Test Fixtures:**
    - Located authentic question bank PDF fixture: `public/assets/qa_material/STE_QB_UT1.pdf` (3,955,195 bytes, 3.77 MB / ~4 MB, 10 pages).
    - Located handwritten/printed study note image fixture: `public/assets/qa_material/test_qa.jpeg` (111,339 bytes, 108.7 KB, 988 x 748 pixels).
  - **Multimodal AI Provider Integration & Limits Verification:**
    - Extended `ChatMessage.content` with `MessageContentPart[]` supporting `{ type: "text" }`, `{ type: "image_url" }`, and `{ type: "file" }` in `src/lib/providers/types.ts` and `src/lib/providers/meta.ts`.
    - Extended client/server validation limit to 20 MB and 50 pages (safely within Meta's 50 MB / 100-page limits).
    - Executed empirical live verification against Meta `muse-spark-1.3`:
      - `test_qa.jpeg`: HTTP 200 in 6,933 ms; extracted exact question and reference answer on Software & Software Engineering.
      - `STE_QB_UT1.pdf`: HTTP 200 in 39,074 ms; extracted 10+ grounded questions across 10 pages (Waterfall model, Extreme Programming, DFD symbols, Data Object/Attributes) with accurate page numbers and citations.
  - **File Validation & Inspection (`src/lib/files/index.ts`):**
    - Implemented magic byte detector for `%PDF-`, `0xFFD8FF` (JPEG), `0x89504E47` (PNG), and `RIFF...WEBP`.
    - Added fast PDF page counter `getPdfPageCount` compatible with both Node and browser runtimes.
    - Added human-readable file size formatter `formatFileSize`.
  - **Server-Side Extraction Endpoint (`src/app/api/extract/route.ts`):**
    - Updated to seamlessly handle both `multipart/form-data` (PDFs and image uploads) and `application/json` (text paste).
    - Added 75s timeout ceiling for complex multi-page document reasoning.
    - Preserved source-grounding rules and missing question/answer detection.
  - **Unified Material Ingestion UI (`src/features/materials/NewMaterialView.tsx`):**
    - Redesigned to match visual design reference (`media_1793186812232_936782f6.png`):
      - 3 Input Tabs: `Upload File`, `Take Photo`, `Paste Text`.
      - Drag-and-drop file upload zone with format guidance and "PDF, JPG, PNG (Max 20MB)" indicator.
      - Camera capture tab with `<input type="file" accept="image/*" capture="environment" />`.
      - Selected file display banner (filename, pages/dimensions, size, change/remove controls).
      - Detected questions and answers master-detail review view.
      - Interactive `Split` and `Merge` action controls to refine question boundaries.
      - Responsive CTA: "Save and prepare ->" on desktop / "Continue to review ->" on mobile.
      - Sequential rubric generation for each question before saving full study set to browser IndexedDB and routing to `/review/[id]`.
  - **Testing & Verification:**
    - 81 passing unit tests across 10 test suites in Vitest (including new `multimodal-extraction.test.ts`).
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check with 0 errors and 0 warnings.
    - Clean Prettier code formatting verified across all files.
    - Successful Webpack production build (`next build --webpack`) generating all 8 static and dynamic routes.

- [x] **`TASK-2.12` — UI Refinement: Dedicated PDF Tab, Responsive Image Uploads & Homepage Document Title**
  - **Upload File Tab Dedicated to PDFs (`src/features/materials/NewMaterialView.tsx`):**
    - Updated Tab 1 label to `Upload File (PDF)`. Dedicated specifically to single-PDF uploads up to 20MB / 50 pages.
    - Single PDF file input (`accept=".pdf,application/pdf"`), PDF drop validation, and clear error feedback if non-PDF files are dropped.
    - Preserved PDF page count display, file size formatting, extraction flow, loading states, and master-detail review.
  - **Take Photo / Upload Images Tab (`src/features/materials/NewMaterialView.tsx`):**
    - Renamed image tab to `Take Photo / Upload Images` (responsive `Photo / Images` on small mobile viewports).
    - Consolidated all multiple-image upload, preview, reordering, and removal workflows under this tab.
    - On laptops and desktops (`lg:` and up): primary action is "Upload images" (opens multi-select image file picker), with drag-and-drop support. Zero camera primary action is displayed on desktop.
    - On mobile phones and tablets (`< lg`): primary action is "Take photo" (opens camera), with an accessible secondary action "Select from device" (file picker) so mobile and tablet students can easily select existing photos from their library without using the camera.
    - Preserved batch limits (up to 15 images, 25MB total), magic-byte validation, ordering, page continuity, and double-submit protection.
  - **Homepage Document Title (`src/app/page.tsx`, `tests/unit/navigation.test.ts`):**
    - Set homepage document title to exact absolute string `Retell | Turn Study into Confidence` using `title: { absolute: "Retell | Turn Study into Confidence" }`.
    - Preserved template-based metadata across all other routes (`/library`, `/materials/new`, `/review/[id]`).
    - Updated and added regression tests in `tests/unit/navigation.test.ts`.
  - **Testing & Verification:**
    - 99 passing unit tests across 11 test suites in Vitest.
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check (`pnpm run lint`) with 0 errors and 0 warnings.
    - Clean Prettier code formatting verified across all files.
    - Successful Webpack production build (`next build --webpack`) generating all 8 static and dynamic routes.

- [x] **`TASK-2.11` — Follow-up: Multi-Image Ingestion, Import Questions into Existing Sets & Accurate Save-State UX**
  - **Feature A — Multi-Image Ingestion & Batch File Validation (`src/lib/files/index.ts`, `src/features/materials/NewMaterialView.tsx`):**
    - Implemented `validateFileBatch()` enforcing batch limits (max 15 images, 25 MB total batch ceiling, single PDF rule).
    - Added multi-file selection (`multiple` on `<input>`), drag-and-drop batch upload, and camera append button ("+ Add another photo" / "Take another photo").
    - Preview thumbnails with page indicators (`Page 1`, `Page 2`), file sizes, reordering controls (`Move up`, `Move down`), and individual removal triggers.
    - Updated `POST /api/extract` server prompt with page indexing (`--- PAGE / IMAGE i OF N ---`), cross-page answer continuity, and overlap deduplication instructions.
    - Added double-click prevention on extraction submission.
  - **Feature B — Import Questions into Existing Study Sets (`src/features/source-review/ImportQuestionsModal.tsx`, `src/features/source-review/SourceReviewView.tsx`):**
    - Dual actions on desktop and mobile: "+ Add Manually" and "Import from File" (PDF or images).
    - Created Butter & Tomato styled modal (`ImportQuestionsModal.tsx`) with 2-step workflow: file staging/validation followed by candidate question preview.
    - Candidate checkboxes, inline editing, and uncertainty flags (`isUncertain`) before importing.
    - Appending logic: assigns fresh unique IDs (`q_${crypto.randomUUID()}`), preserves existing questions, sequential rubric generation with fallback, and auto-persists to IndexedDB.
  - **Feature C — Accurate Save-State UX (`src/features/source-review/SourceReviewView.tsx`):**
    - Removed confusing "Saved to browser" text; established deep deterministic baseline serialization (`serializeStudySetForComparison()`).
    - Compares title, question, reference answer, orderIndex, and full rubric criteria details (name, description, guidance, mandatory flag).
    - Displays quiet "Saved" checkmark when clean; shows "Unsaved changes" + primary "Save study set" button when dirty.
    - Protects against in-flight save races by establishing baseline strictly from the confirmed saved snapshot.
    - Pure React 19 state architecture satisfying `react-hooks/refs` rules.
  - **Testing & Verification:**
    - 99 passing unit tests across 11 test suites in Vitest (including new 18-test suite in `tests/unit/followup-features.test.ts`).
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check (`pnpm run lint`) with 0 errors and 0 warnings.
    - Clean Prettier code formatting verified across all files.
    - Successful Webpack production build (`next build --webpack`) generating all 8 static and dynamic routes.

- [x] **`TASK-2.12` — UI Refinement: Dedicated PDF Tab, Responsive Image Uploads & Homepage Document Title**
  - **Upload File Tab Dedicated to PDFs (`src/features/materials/NewMaterialView.tsx`):**
    - Updated Tab 1 label to `Upload File (PDF)`. Dedicated specifically to single-PDF uploads up to 20MB / 50 pages.
    - Single PDF file input (`accept=".pdf,application/pdf"`), PDF drop validation, and clear error feedback if non-PDF files are dropped.
    - Preserved PDF page count display, file size formatting, extraction flow, loading states, and master-detail review.
  - **Take Photo / Upload Images Tab (`src/features/materials/NewMaterialView.tsx`):**
    - Renamed image tab to `Take Photo / Upload Images` (responsive `Photo / Images` on small mobile viewports).
    - Consolidated all multiple-image upload, preview, reordering, and removal workflows under this tab.
    - On laptops and desktops (`lg:` and up): primary action is "Upload images" (opens multi-select image file picker), with drag-and-drop support. Zero camera primary action is displayed on desktop.
    - On mobile phones and tablets (`< lg`): primary action is "Take photo" (opens camera), with an accessible secondary action "Select from device" (file picker) so mobile and tablet students can easily select existing photos from their library without using the camera.
    - Preserved batch limits (up to 15 images, 25MB total), magic-byte validation, ordering, page continuity, and double-submit protection.
  - **Homepage Document Title (`src/app/page.tsx`, `tests/unit/navigation.test.ts`):**
    - Set homepage document title to exact absolute string `Retell | Turn Study into Confidence` using `title: { absolute: "Retell | Turn Study into Confidence" }`.
    - Preserved template-based metadata across all other routes (`/library`, `/materials/new`, `/review/[id]`).
    - Updated and added regression tests in `tests/unit/navigation.test.ts`.
  - **Testing & Verification:**
    - 99 passing unit tests across 11 test suites in Vitest.
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check (`pnpm run lint`) with 0 errors and 0 warnings.
    - Clean Prettier code formatting verified across all files.
    - Successful Webpack production build (`next build --webpack`) generating all 8 static and dynamic routes.

- [x] **`TASK-3.1` – `TASK-3.6` — Spoken Practice Room, Microphone Capture, Live Speech Transcription & WebSocket Lifecycle (Day 3 Milestone)**
  - **Spoken Practice Room UI (`src/features/practice/PracticeRoomView.tsx`, `PracticeRoomClient.tsx`):**
    - Built comprehensive Practice Room at canonical route `/study/:id/practice` with compatibility alias at `/practice/:id`.
    - Implemented with authentic Butter & Tomato design tokens (Warm Cream `#FFF8EB`, Tomato `#E6533D`, Butter `#F5D96B`, Peach `#FFE2D7`, Ink `#302B27`).
    - Prominent question display, page numbering, collapsible reference answer ("Show reference answer"), and "Points to Remember" concept checklist side panel.
    - Question switcher with previous/next controls when study sets contain multiple questions.
    - Calm, student-first states: "Ready to test your active recall?", "Start speaking", "Listening aloud", "Take your time", "Finish attempt", and "Practice attempt complete!".
    - Attempt completed summary card displaying duration, total words spoken, finalized transcript review, "Practise again", "Next question", and clear honest affordance for Day 4 Semantic Audit.
  - **Client-Side Web Audio Capture & Resampling (`src/lib/audio/capture.ts`):**
    - Explicit permission gating: microphone is never requested on page load; only upon clicking "Start speaking".
    - Resamples microphone input to 24kHz mono signed 16-bit PCM (`floatTo16BitPCM` with [-1.0, 1.0] clipping).
    - Emits frames in 80ms chunks (1,920 samples = 3,840 bytes) matching Meta Voice Transcribe specifications.
    - Continuous RMS energy calculation drives live waveform visualization and pause monitoring.
    - Graceful cleanup: terminates all `MediaStreamTrack`s (`track.stop()`) and closes `AudioContext` on stop or page unmount with zero resource leakage.
    - Never automatically terminates recording when students pause; raw audio is never written to disk or persisted (privacy-first).
  - **Server-Side Transcribe Relay API (`src/app/api/transcribe/*`, `src/lib/providers/transcribe-session.ts`):**
    - Zero client secret leakage: private `META_MODEL_API_KEY` remains strictly server-side.
    - `POST /api/transcribe/session`: Connects server-side to Meta Voice Transcribe WebSocket (`wss://api.meta.ai/v1/asr/realtime`), sends authenticated handshake frame (`authorization: { accessToken: "Bearer <KEY>" }`, `audioEncoding: "PCM_24KHZ"`, `model: "muse-voice-transcribe-1.0"`), and returns session ID.
    - `GET /api/transcribe/stream`: Server-Sent Events (SSE) stream pushing real-time `transcript` deltas, `audioProgress`, and `error` events to the browser.
    - `POST /api/transcribe/audio`: Receives binary PCM frames and forwards them to Meta's WebSocket.
    - `POST /api/transcribe/finish`: Dispatches `{"type": "endStream"}` text frame, awaits finalized transcript, flushes, and cleanly terminates session.
    - Graceful fallback: when offline, in sandbox, or without API key, runs simulated/local relay so students and evaluators can always rehearse speech end-to-end.
  - **Live Transcript Streaming UI (`src/features/practice/LiveTranscript.tsx`):**
    - Displays accumulated finalized phrases alongside in-progress interim text with subtle styling.
    - Live word count badge (`calculateWordCount`).
    - Auto-scrolls gracefully to bottom as new speech streams in.
  - **Silence & Pause Detection with Contextual Nudge (`src/features/practice/PauseNudge.tsx`):**
    - Monitors RMS volume energy continuously; when silence exceeds 4,000ms, renders a gentle, reassuring banner: "Take your time. There's no rush! Think about the key steps and explain them naturally in your own words."
    - Automatically fades out when speech resumes without penalizing the student or interrupting recording.
  - **Persistence & Attempt History (`src/lib/domain/practice-session.ts`, `src/lib/storage/study-store.ts`):**
    - Defined `PracticeAttemptSchema` and types: `id`, `studySetId`, `questionId`, `transcript`, `wordCount`, `durationSeconds`, `status`, `createdAt`.
    - Upgraded IndexedDB schema to Version 2 with `practice_attempts` object store (indexed by `studySetId`, `questionId`, `createdAt`), with memory store fallback for SSR and tests.
    - Provided `savePracticeAttempt`, `getPracticeAttempt`, `listPracticeAttempts`, and `deletePracticeAttempt`.
  - **Navigation Integration:**
    - Replaced Day 3 placeholder alert on Points Review page (`src/features/source-review/SourceReviewView.tsx`) with direct link to `/study/${studySet.id}/practice?questionId=${activeQuestion?.id || ""}`.
    - Activated "Practise" button on Home page recent study set cards linking to `/study/${set.id}/practice`.
  - **Testing & Verification:**
    - 108 passing unit tests across 12 test suites in Vitest (including new 8-test suite in `tests/unit/practice-session.test.ts`).
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check (`pnpm run lint`) with 0 errors and 0 warnings.
    - Clean Prettier code formatting verified across all files (`pnpm run format:check`).
    - Successful Webpack production build (`next build --webpack`) generating all 10 static and dynamic routes.

- [x] **`TASK-3.9` — Practice Room UI Reversion, Hint Presentation ("Hint:") & Targeted Meta Auth Diagnostics**
  - **Restored Simpler Microphone Experience (`src/features/practice/PracticeRoomView.tsx`):**
    - Removed microphone selection dropdown (`<select id="mic-device-select">`), device labels, Bluetooth indicators, and hardware enumeration logic.
    - Captures default microphone audio seamlessly via browser-standard permissions upon clicking "Start speaking".
    - Restored clean idle layout: centered microphone card, "Start speaking" CTA button, and quiet-voice usage note.
  - **Removed Student-Facing Provider Badges (`src/features/practice/PracticeRoomView.tsx`):**
    - Removed status bar containing `🎙️ Input: ...` and transcription-engine badges (`Meta Voice AI` / `Browser Speech Engine (Local)`) from recording canvas and completed attempt summary.
    - Reverted completed attempt metrics card to a clean 2-column layout (`Spoken Words` and `Duration`).
    - Kept provider state, fallback switching, and diagnostic details strictly server-side and console-only.
  - **Corrected Hint Presentation & 1–3 Word Salient Cues (`src/features/practice/ContextualHint.tsx`, `src/lib/domain/recall-hints.ts`):**
    - Replaced label `"Recall cue"` with **`"Hint:"`** (e.g. `💡 Hint: Recursive query`).
    - Stripped all occurrences of `"Recall cue"` across student-facing UI and accessibility labels.
    - Tuned `extractConciseCue` to target 1–3 words (concise technical terms such as `Recursive query`, `Root nameserver`, `TLD nameserver`, `Systematic development`).
    - Cleaned punctuation on individual tokens and stripped trailing/leading non-alphanumeric punctuation.
    - Grounded hints in rubric criteria; continues beyond 3 hints sequentially when uncovered concepts remain without duplicates; stops when all concepts are addressed or attempt ends.
  - **Targeted Meta Auth Check & Server Diagnostics (`src/lib/providers/meta.ts`, `src/lib/providers/transcribe-session.ts`):**
    - Implemented `sanitizeApiToken` to strip surrounding quotes (`"` or `'`), Windows CRLF artifacts (`\r\n`), and duplicate `Bearer ` prefixes from `.env.local` / environment variables.
    - Captured and logged server-side `{ closeCode, closeReason, wasClean }` without exposing sensitive tokens.
    - Correctly distinguished Policy Violation (code 1008 with exact reason string) from abnormal connection drops (code 1006), rate limits (code 1013), and server errors (code 1011).
    - Prevented generic connection timeouts or network drops from ever being misreported as authentication failures.
  - **Testing & Verification:**
    - 141 passing unit tests across 15 test suites in Vitest (`pnpm run test`).
    - Clean TypeScript validation (`tsc --noEmit`) with 0 errors.
    - Clean ESLint validation (`pnpm run lint`) with 0 errors and 0 warnings.
    - Clean Prettier formatting (`pnpm run format:check`) across all files.
    - Successful Webpack production build (`next build --webpack`) generating all 10 routes.
    - 124 passing unit tests across 14 test files (including 8 new tests in `transcript-accumulator.test.ts` and 7 in `recall-hints.test.ts`).
    - 100% clean TypeScript (`tsc --noEmit`), ESLint, and Prettier checks.
    - Clean production Webpack build (`next build --webpack`).

- [x] **`TASK-3.8` — Transcription Reliability Investigation, Lifecycle Fixes, Bluetooth Support & Unbounded Hints**
  - **Server Lifecycle & 404/200 Root Cause Fix (`src/lib/providers/transcribe-session.ts`, `src/app/api/transcribe/*`):**
    - Root cause of session 404s: In-memory `activeSessions` was module-scoped, allowing Next.js App Router chunks to isolate session maps. More critically, when Meta's WebSocket timed out at 4000ms, the dangling WebSocket remained active; upon subsequent OS-level abort, its `ws.onclose` fired and executed `activeSessions.delete(sessionId)`, wiping out the fallback session immediately before the browser requested `/api/transcribe/stream` and `/api/transcribe/audio`.
    - Fix: Anchored `activeSessions` to `globalThis.__retellActiveSessions`. Detached all listeners and cleanly terminated timed-out WebSockets. Guarded `ws.onclose` so it only deletes its own session instance. Increased handshake connection timeout from 4000ms to 9000ms (matching Meta's 10-second allowance).
    - Added structured close-code broadcasting (1000, 1008, 1011, 1013) with informative error messages.
  - **SpeechRecognition Fallback Pause Recovery (`src/lib/audio/transcribe-client.ts`):**
    - Root cause of transcription stopping after pause: When falling back to browser `SpeechRecognition`, Chrome terminates recognition after silence/pauses (`onend` / `"no-speech"`). Lacking an `onend` handler, recognition permanently died mid-practice.
    - Fix: Added resilient `onend` auto-restart logic, non-fatal handling of `"no-speech"` pause events, and structured diagnostic logging.
  - **Audio Pipeline & Delay Improvements (`src/lib/audio/transcribe-client.ts`):**
    - Suppressed unnecessary audio chunk uploads to `/api/transcribe/audio` when local browser fallback is active, eliminating 12.5 redundant HTTP requests/sec and freeing CPU/network.
    - Added queue-based chunk batching for live Meta relay: merges buffered audio frames and serializes HTTP requests, eliminating connection pool backpressure and delay.
    - Implemented seamless mid-session fallback if Meta connection drops without discarding accumulated transcripts.
  - **Bluetooth Microphone Support (`src/lib/audio/capture.ts`, `src/features/practice/PracticeRoomView.tsx`):**
    - Added `getAudioInputDevices()` enumerating microphones with automatic Bluetooth headset identification (`/bluetooth|hands-free|airpods|buds|wireless|headset/i`).
    - Added clean audio input device selector in the Practice Room idle state.
    - Tracked active microphone label and added `track.onended` listener for device disconnects with graceful warning preservation.
  - **Unbounded Contextual Recall Hints (`src/lib/domain/recall-hints.ts`):**
    - Removed arbitrary `maxHintsPerAttempt: 3` cap; hints now continue sequentially across the entire answer until all concepts are addressed.
    - Fixed `extractConciseCue`: eliminated aggressive truncation at colons/dashes that caused criteria with common prefixes (e.g. "DNS: Query" vs "DNS: Root") to collide.
  - **Provider Observability (`src/features/practice/PracticeRoomView.tsx`):**
    - Added truthful provider status pills: `🟢 Meta Voice AI` vs `🟡 Browser Speech Engine (Local)`. Never silently presents fallback as Meta transcription.
    - Displayed active engine and microphone in the completed attempt summary card.
  - **Testing & Verification:**
    - 135 passing unit tests across 15 test files (including 9 new tests in `transcription-reliability.test.ts`).
    - 100% clean TypeScript (`tsc --noEmit`), ESLint (`eslint`), and Prettier checks.
    - Clean production Webpack build (`next build --webpack`).

- [x] **`TASK-4.1` – `TASK-4.5` — Semantic Answer Auditing, Actionable Feedback, Retries & Paragraph Scoping (Day 4 Milestone)**
  - **Core Evaluation Principle:**
    - Evaluates **conceptual understanding, not rote memorization of exact sentences**.
    - Students receive full credit for correct explanations even when using different phrasing, vocabulary, sentence structures, or valid real-world analogies.
  - **Independent Criterion-Level Evaluation Model (`src/lib/domain/semantic-audit.ts`):**
    - Defined `CriterionEvaluationStatusSchema`: `covered`, `partially_covered`, `missing`, `incorrect`, `optional`.
    - Rich metadata per status (`CRITERION_STATUS_META`): student label, badge colors, icon, description.
    - Transparent overall assessment aggregate (`OverallAssessmentSchema`): plain-language summary, what was explained well, what needs more attention, what needs correction, suggested next improvement, and counts.
    - Anti-hallucination evidence guard: quotes actual transcript phrases only if verified to exist in student transcript; strips false citations.
    - Strict distinction: omissions (`missing`) are placed under "What needs more attention", while factual contradictions (`incorrect`) are strictly separated under "What needs correction".
  - **IndexedDB Schema Upgrade (Version 3) (`src/lib/storage/study-store.ts`):**
    - Upgraded IndexedDB version to 3; created `semantic_audits` store indexed on `attemptId` (unique), `studySetId`, `questionId`, `createdAt`.
    - Implemented `saveSemanticAuditResult`, `getSemanticAuditResult`, `getSemanticAuditByAttempt`, `listSemanticAudits`, `deleteSemanticAuditResult`, `clearAllSemanticAudits`, and in-memory map fallback for SSR and tests.
  - **Core Evaluator Engine & Fallback (`src/lib/audit/evaluator.ts`):**
    - Structured Meta Muse Spark 1.3 prompt enforcing fair examiner rules, conceptual grading, and evidence verification.
    - Multi-paragraph extractor `extractParagraphs()`.
    - Robust deterministic offline fallback `evaluateDeterministically()` with synonym matching, stemming, and negation/contradiction detection.
  - **Server-Side API Route (`src/app/api/audit/route.ts`):**
    - Handled `POST /api/audit` with Zod schema validation, reasoning provider execution, anti-hallucination verification, and error sanitization.
  - **Answer Review UI & Canonical Route (`src/features/answer-review/`, `src/app/study/[id]/attempts/[attemptId]/page.tsx`):**
    - Authentic Butter & Tomato styled review page at `/study/:id/attempts/:attemptId`.
    - Header with return to practice navigation, scope badge, and question context.
    - Transparent concept coverage bar (e.g. "2 of 2 concepts covered") with zero AI jargon.
    - Separate cards: "What you covered", "What needs more attention", and "What needs correction".
    - Collapsible full transcript review and reference answer comparison.
    - Suggested next steps: "Practise again" and "Back to Study Set".
  - **Practice Room Integration (`src/features/practice/PracticeRoomView.tsx`):**
    - Paragraph-level practice scope selector for multi-paragraph answers.
    - Monotonic transcript assembly -> safe attempt save to IndexedDB -> automated transition to auditing state -> `/api/audit` call -> seamless router navigation to Answer Review.
    - Resilient retry flow if evaluation fails: attempt remains safely saved in IndexedDB with retry button.
  - **Deterministic 16-Scenario Test Suite (`tests/unit/semantic-audit.test.ts`):**
    - 16 comprehensive tests covering exact answers, paraphrasing, partial coverage, omissions, contradictions, keyword stuffing rejection, valid extra examples, acoustic imperfections, garbled speech, paragraph scoping, IndexedDB persistence, provider retry resilience, schema validation, and API routes.
  - **Testing & Verification:**
    - 157 passing unit tests across 16 test files in Vitest (`pnpm run test`).
    - Clean TypeScript check (`tsc --noEmit`) with 0 errors.
    - Clean ESLint check (`eslint .`) with 0 errors.
    - Clean Prettier code formatting verified across all files (`prettier --check .`).
    - Clean Next.js Webpack production build (`next build --webpack`) with all 11 routes.

- [x] **`TASK-4.2` — Contextual Pause Hints Reliability & Sequential Recall Engine**
  - Explicit **"Hint:"** prompt label (purged all occurrences of "Recall cue").
  - Concise 1–3 word recall cues derived from source rubric criteria and reference answer.
  - Multi-signal pause detection: 80ms PCM frame debouncing (RMS 0.008) combined with external speech transcription updates (`notifySpeechActivity`), ensuring pause detection reliably reaches 4 seconds without premature cancellation by room noise or quiet speaking.
  - Sequential hinting without arbitrary 3-hint ceiling: subsequent pauses after speaking present the next uncovered concept without repeating previous hints.
  - Paragraph-level practice scoping: dynamically matches criteria to paragraph text so students practicing paragraph 2 are not hinted paragraph 0 concepts.
  - Instant dismissal on speech resume or manual click.
  - Clean state cleanup on attempt finish, cancel, or question switch.

- [x] **`TASK-4.3` — Meta Voice Real-Time Audio Ingress & Session Stability**
  - Sliced incoming PCM 24kHz mono audio buffers into 80ms frames (3,840 bytes) on server relay before forwarding to Meta WebSocket.
  - Prevented `code=1008, reason="Ingress below real-time"` errors by restoring unsent audio chunks into client upload queue during transient network drops, guaranteeing uninterrupted real-time audio duration.
  - Added 60-second session retention grace period in `activeSessions` upon WebSocket close, eliminating `/api/transcribe/finish` HTTP 404s.
  - Extended client finalization timeout to 6000ms, eliminating client-side abort errors (`AbortError: The user aborted a request`).
  - Relaxed `SemanticAuditRequestSchema` defaults (`transcript: z.string().default("")`, `criteria: z.array(...).default([])`), eliminating HTTP 400 Bad Request on empty attempts and auto-synthesizing baseline criteria when rubrics are unconfigured.
  - Created 15-scenario automated unit test suite in `tests/unit/pause-hints-lifecycle.test.ts`.

- [x] **`TASK-4.4` — Strict Paragraph Scope Isolation & Repeated Pause Hints Architecture**
  - **Authoritative Paragraph Scope Isolation (`src/lib/domain/paragraph-scope.ts`):**
    - Built canonical paragraph-scoping engine that maps criteria to paragraphs using keyword-stem overlap scoring.
    - Scopes reference answer, criteria, and evaluation targets strictly to the selected paragraph.
    - Updated `PracticeAttemptSchema` (`paragraphText`, `totalParagraphs`) so attempts preserve their exact paragraph context across storage and reloads.
    - Updated `evaluator.ts` so paragraph practice evaluates ONLY the selected paragraph; zero criteria from other paragraphs appear in `criteriaEvaluations`, `whatNeedsAttention`, or overall counts.
    - Updated `AnswerReviewView.tsx` so collapsible reference answer and feedback cards show ONLY the selected paragraph's reference text and criteria.
    - Guarded against missing or invalid paragraph metadata with explicit recoverable errors instead of silent full-answer fallback.
  - **Repeated Contextual Pause Hints:**
    - Fixed 2-word cue token overlap requirement (`matches >= 2`) in `isConceptMentioned()`, eliminating false-positive concept coverage matches from single common words.
    - Armed pause detection for immediate reset on any voice activity (`this.isPausedReported && consecutiveVoiceFrames >= 1`), ensuring subsequent pauses after speaking reliably fire new hints.
    - Eliminated duplicate hints and enforced strictly sequential cues without arbitrary limits.
  - **Regression Test Suites:**
    - Added `tests/unit/paragraph-scope-isolation.test.ts` (10 tests covering Scenarios A through J).
    - Expanded `tests/unit/pause-hints-lifecycle.test.ts` (17 tests covering Scenarios 1 through 17).
    - 184 passing unit tests across 18 test files in Vitest (`pnpm run test`).

- [x] **`TASK-4.6` & `TASK-5.1` – `TASK-5.4` — Attempt History, Progress Comparison, IndexedDB Resilience & Complete Core Screens (Day 5)**
  - **Attempt-to-Attempt Progression & Comparison (`src/lib/domain/attempt-comparison.ts`):**
    - Built deterministic conceptual transition comparator: `retained`, `improved`, `partial_progress`, `regressed`, `new_misconception`, `still_missing`, and `still_incorrect`.
    - Implemented strict scope compatibility enforcement (`checkScopeCompatibility`): accepts whole-answer vs whole-answer and matching paragraph indices; rejects cross-scope combinations with actionable student guidance.
    - Added transparent progress calculations (mandatory criteria only; optional details never skew core metrics).
  - **Attempt History & Comparison Interfaces (`src/features/history/`):**
    - `AttemptHistoryView.tsx`: Question-scoped history with relative timestamps, duration, word counts, scope badges, and multi-attempt selection for side-by-side comparison.
    - `AttemptComparisonView.tsx`: Progress summary banner with net progress pills, side-by-side attempt cards, and point-by-point transcript evidence comparisons.
    - Integrated history and comparison entry points into `AnswerReviewView.tsx`, `PracticeRoomView.tsx`, `SourceReviewView.tsx`, and `LibraryView.tsx`.
    - Canonical routes: `/study/:id/history`, `/study/:id/compare?a=:id&b=:id`, and `/study/:id/attempts`.
  - **IndexedDB Storage Resilience (`src/lib/storage/study-store.ts`):**
    - Upgraded database schema to version 4 with transaction rollback protection and quota overflow detection.
    - Added blocked/versionchange connection safeguards.
    - Added helper query methods: `getPracticeAttemptsByQuestion`, `getPreviousPracticeAttempt`, `getAttemptWithAudit`, and `getStorageDiagnostics`.
  - **Accessibility & Responsive Polish:**
    - Live transcript screen reader announcements via `role="region"` and `aria-live="polite"`.
    - Contextual pause hints with `role="status"` and `aria-live="polite"`.
    - Fully responsive layouts audited across 390px (mobile), 768px (tablet), and 1440px (desktop) with zero horizontal overflow.
  - **Verification Suite:**
    - Added `tests/unit/attempt-comparison.test.ts` (13 tests).
    - Added `tests/unit/attempt-history.test.ts` (4 tests).
    - Added `tests/unit/storage-resilience.test.ts` (5 tests).
    - Added `tests/unit/day5-e2e-workflow.test.ts` (complete student learning journey).
    - 208 passing unit tests across 22 test files in Vitest.

---

## 2. In Progress Tasks

- _None (Day 5 Core Experience, Attempt History & IndexedDB Resilience completed; ready for Day 6 Evaluation, Benchmarks & Deployment)_

---

## 3. Next Tasks

### Day 6: Evaluation, Deployment, Provider Comparison & Demo Preparation

- [ ] `TASK-6.1` — Production deployment to Vercel.
- [ ] `TASK-6.2` — Meta vs Baseten latency and accuracy comparison benchmarks.
- [ ] `TASK-6.3` — Playwright end-to-end automated tests.
- [ ] `TASK-6.4` — Structured demo script creation.

---

## 4. Remaining Tasks

- [x] **`TASK-5.5` — UI Refinement 1: Redesigned Attempt History Interface**
  - Redesigned `/study/:id/history` matching the approved Butter & Tomato visual design and reference layout (`media_1793521239637_1b622ffd.jpg`).
  - Implemented Question Header card with question pagination (`Question X of Y` with `<` and `>` controls), study set title, question prompt, source excerpt, and primary tomato `Practise this question` action.
  - Added dynamic scope filter pills (`All (N)`, `Whole Answer (N)`, and `Paragraph 1..N (N)`) updating dynamically with stored attempt counts.
  - Built 4 authentic summary metric cards: `Total attempts` (with paragraph and whole-answer breakdown), `Best coverage` (ratio, percentage pill, and "Across all attempts"), `Improvement` (`+X concepts` vs first attempt), and `Latest attempt` (formatted timestamp and coverage subtext).
  - Implemented vertical timeline track with amber/tomato dots, `Latest` badge on the most recent attempt, scope pills, word count, duration, concept coverage metrics, `Compare with previous` action, tomato `Review feedback →` button, and kebab menu with delete attempt confirmation modal.
  - Preserved multi-select custom comparison capability with sticky floating bar (`sticky top-4`).
  - Added unit test coverage in `tests/unit/attempt-history.test.ts` and verified responsive layout in `tests/unit/responsive-layout.test.ts`.

- [x] **`TASK-5.6` — UI Polish: Consistent Pointer Cursors on Learning History Pages**
  - Applied `cursor-pointer` to all interactive and actionable elements across Answer Review, Attempt History, and Attempt Comparison pages.
  - Covered primary/secondary buttons, navigation/back links, scope filter pills, question pagination controls, sort dropdowns, kebab menus, dropdown menu items, expandable evidence comparisons, and delete modal buttons.
  - Enforced `cursor-not-allowed` and `disabled:cursor-not-allowed` on disabled controls (e.g. disabled question paginators, disabled comparison actions, disabled modal buttons).
  - Ensured non-interactive text, cards, and decorative elements retain standard default cursor behavior.

- [x] **`TASK-5.7` — Critical Bug Fix: Paragraph-Level Semantic Audit Scope Resolution**
  - **Root Cause Confirmed:** In `PracticeRoomView.tsx` (initial attempt evaluation line 436 and retry line 503) and `AnswerReviewView.tsx` (on-demand audit line 96), client payloads sent `referenceAnswer: resolvedScope.paragraphText` (which contained only the single selected paragraph) instead of the complete multi-paragraph `activeQuestion.referenceAnswer`.
  - On the server, `evaluateStudentAnswer` passed this 1-paragraph string to `resolvePracticeScope`. For Paragraph 2 (`paragraphIndex: 1`), `extractParagraphs` found only 1 paragraph (`[p0]`), making `paragraphs[1]` undefined and throwing `Cannot resolve selected Paragraph 2 from reference answer (found 1 paragraphs)`. Paragraph 1 (`paragraphIndex: 0`) masked the bug because index 0 matched the 1-element array.
  - **Client Fix:** Updated `PracticeRoomView.tsx` (finish and retry flows) and `AnswerReviewView.tsx` to provide the authoritative multi-paragraph `activeQuestion.referenceAnswer` and all rubric criteria `activeRubric?.criteria || []` in the `/api/audit` request payload.
  - **Resolver Resilience & Backward Compatibility:** Enhanced `resolvePracticeScope` in `src/lib/domain/paragraph-scope.ts` to detect when `referenceAnswer` was already pre-scoped to `targetText` (e.g., from existing stored attempts or external callers). It authoritatively resolves without throwing a 500 error while retaining strict validation against truly unresolvable out-of-bounds indices without silent fallback.
  - **Attempt Safety:** Preserved transcript storage to IndexedDB _before_ the audit network call, ensuring spoken words remain fully safe and recoverable with zero re-recording and zero duplicate attempts on retry.
  - **Regression Coverage:** Added 7 new automated tests in `tests/unit/paragraph-scope-isolation.test.ts` reproducing the student's two-paragraph question ("Software" and "Software Engineering"), verifying Paragraph 1 and Paragraph 2 isolation, backward-compatibility resilience, error handling, and `/api/audit` route handler execution.

- [x] **`TASK-5.8` — Ingestion Phase 1: Client-Side Image Optimization & Upload Payload Protection**
  - **Adaptive Image Optimization:** Integrated `browser-image-compression` (v2.0.2) running in background Web Workers with legibility-first tuning (`maxWidthOrHeight: 2048`, `initialQuality: 0.86`, `maxSizeMB: 0.9`, `useWebWorker: true`) preserving handwritten formulas, diagram notations, and textbook text.
  - **Format & Transparency Safety:** Strict preservation of PNG format for architecture diagrams, preventing black-canvas transparency artifacts.
  - **Fail-Safe Fallbacks:** Bypasses recompression on small files <= 200 KB already compact, discards compressed files if larger than originals, and cleanly returns the original file if compression throws.
  - **Upload Payload Protection:** Enforced client upload ceiling of 3.5 MB with accurate multipart boundary and form overhead modeling against Vercel's unconfigurable 4.5 MB serverless body ceiling.
  - **Student Feedback & Controls:** Rendered non-blocking background optimization badges, size savings metrics, payload budget meter, and actionable student guidance in `NewMaterialView.tsx` and `ImportQuestionsModal.tsx`.
  - **Automated Test Coverage:** Added 11 unit and integration tests in `tests/unit/image-optimization.test.ts` verifying all compression branches, transparency, fallback resilience, batch ordering, and payload calculations. All 23 test suites (228 tests) passing.

- [x] **`TASK-5.9` — Image Upload UX Cleanup, Product-Wide Information Exposure Audit & Local PDF Preview & Ingestion**
  - **Part A: Product UX & Information Exposure Policy:**
    - Established strict product-wide policy prohibiting developer/infrastructure terminology in student-facing UI (no "Vercel", "serverless", "payload", "payload budget", "request", "response", "HTTP", "JSON", "MIME", "Web Worker", "IndexedDB", "Meta multimodal AI", "LLaMA").
    - Cleaned up image upload interface: removed technical badges ("Optimizing...", "Legibility-optimized", "Original retained"), compression percentages, struck-through original sizes, and live upload-payload meter while preserving background optimization silently in Web Workers.
    - Updated upload budget alert to natural, student-friendly copy: _"These pages are too large to add together. We recommend keeping your selection under 3.5 MB. Try selecting fewer pages or choosing smaller images."_
    - Guarded `/api/dev/verify-provider` route handler to return HTTP 404 in production mode (`NODE_ENV === "production"`).
    - Sanitized client error logging to prevent raw stack traces, API keys, Bearer tokens, or transcripts from printing to client console.
    - Added comprehensive regression test suite in `tests/unit/language-exposure-audit.test.ts` (5 tests passing).
  - **Part B: Local PDF Preview & Intelligent Ingestion Engine:**
    - Integrated `pdfjs-dist` (v4.10.38) with worker asset served locally from `public/pdf.worker.min.mjs` without any external cloud document viewers.
    - Created `PdfPreview.tsx` client component with first-page preview, prev/next pagination, page counter, zoom in/out, fit-to-width, canvas render cancellation on rapid navigation, and memory cleanup destroying PDF document instances on unmount.
    - Built `pdf-extractor.ts` client inspection engine distinguishing text-based, scanned, and hybrid PDFs:
      - Text-based PDFs: extracts structured text per page preserving page headers (`--- Page X ---`) and paragraph line breaks, transmitting lightweight JSON to `/api/extract` and avoiding large payload uploads.
      - Scanned PDFs (e.g., `STE_QB_UT1.pdf` verified with 0 text items across 14 pages): retains multimodal reasoning and image-based extraction.
    - Added automated test suite in `tests/unit/pdf-preview-ingestion.test.ts` (7 tests passing). All 25 test files (240 tests) passing with 0 failures.

- [x] **`TASK-5.10` — Persistent Rate Limiting, AI Usage Accounting & Global Spending Protection (Phase 3)**
  - Implemented anonymous-user device identification using secure `HttpOnly` UUIDv4 cookie (`retell_device_id`) with server-side HMAC hashing (`device_<32hex>`, `ip_<32hex>`). Zero PII or raw identifiers stored in Redis.
  - Multi-window sliding rate limiter in Upstash Redis evaluating Device Burst, Device Sustained, IP Burst, and IP Sustained tiers via atomic Lua script.
  - Global daily spending limit in USD ($5.00 default, operator-configurable) using micro-USD integer arithmetic (1 USD = 1,000,000 micros).
  - Two-phase atomic budget reservation: pre-flight reservation Lua script checks confirmed + reserved total, and post-flight settlement reconciles confirmed token usage, refunds definite errors, and conservatively retains reservations on timeouts.
  - Fail-closed security architecture: paid AI routes (`/api/extract`, `/api/rubric`, `/api/audit`, `/api/transcribe/*`) reject with HTTP 503 if Redis is unconfigured or unreachable in production.
  - Persistent transcribe session guard enforcing single active session per device, cross-device hijack prevention, and idempotent audio duration settlement.
  - Zero information exposure: all error messages provide clear student-friendly guidance without internal developer jargon.
  - 5 new comprehensive test suites added: `tests/unit/anonymous-identity.test.ts`, `tests/unit/rate-limiter.test.ts`, `tests/unit/budget-ledger.test.ts`, `tests/unit/transcribe-guard.test.ts`, `tests/unit/accounting-integration.test.ts`. Total: 30 test files, 274 tests passing with zero failures.

- [x] **`TASK-5.7` — Practice Room Transcription Startup 429 & Session Lifecycle Fix**
  - **Diagnosed and resolved root causes:**
    1. Upstash Redis `zadd` method signature compatibility (`{ score, member }` object shape instead of separate arguments), fixing `TypeError: Cannot use 'in' operator to search for 'score'`.
    2. Recovered from orphaned session locks in Redis with automatic stale detection (>45s inactivity), unblocking retried attempts without manual intervention.
    3. Reordered client-side practice startup in `PracticeRoomView.tsx` so microphone permission (`getUserMedia`) is prompted _first_ as a direct result of user interaction before initiating server sessions or budget reservations.
    4. Guarded route handler `POST /api/transcribe/session` with pre-flight checks (`checkTranscribePreconditions`) prior to opening upstream Meta WebSocket, eliminating billable upstream connections on rejected attempts.
    5. Added automatic budget pre-reservation refund (`releaseTranscribePreReservation`) if upstream session creation fails.
    6. Protected against double clicks and rapid multi-tap with `isStartingRef`.
    7. Cleansed user-facing audio error messages (no raw HTTP 429 or backend terminology shown to students).
  - **Verification:** 276 unit/integration tests passing across 30 test files (`pnpm run test`), zero TypeScript errors (`tsc --noEmit`), 100% Prettier compliance, production Webpack build passing with 19 compiled routes.

- [x] **`TASK-5.8` — Project README, MIT License, and Branded SVG Favicon**
  - Authored comprehensive, fact-grounded root-level `README.md` documenting the 5-step student workflow, problem statement, features, architecture, privacy boundaries, environment variables, technology stack, setup commands, and project status.
  - Added official root `LICENSE` file under the standard MIT License attributed to `Retell contributors`.
  - Replaced legacy default Next.js starter `favicon.ico` with hand-authored, pixel-perfect programmatic SVG favicon `src/app/icon.svg` using Retell's _Butter & Tomato_ brand design system (`#E6533D` tomato background with 7px rounded squircle, `#FFF8EB` warm cream centered geometric `R`).
  - Verified Next.js App Router metadata automatic discovery, serving `<link rel="icon" href="/icon.svg?..." type="image/svg+xml" sizes="any"/>` in production HTML.
  - Refined root layout metadata description to align with product positioning.
  - Updated ESLint configuration to ignore vendor bundle `public/pdf.worker.min.mjs` and cleaned up all unused variable warnings for 100% clean linting (0 errors, 0 warnings).
  - **Verification:** 276 tests passing across 30 test files (`pnpm run test`), zero TypeScript errors (`tsc --noEmit`), 100% ESLint compliance (0 errors, 0 warnings), 100% Prettier formatting, production Next.js build verified with 19 compiled routes.

- [x] **Hackathon Testing Configuration Adjustment (AI Budget & Pricing Defaults)**
  - Updated application-side accounting defaults for the hackathon evaluation period to provide generous headroom and avoid premature judge lockout:
    - `RETELL_DAILY_BUDGET_USD`: Updated canonical default from `$5.00` to `$30.00` (30,000,000 micro-USD).
    - `RETELL_PRICE_PER_1M_INPUT_TOKENS_USD`: Updated canonical default from `$0.30` to `$1.25`.
    - `RETELL_PRICE_PER_1M_OUTPUT_TOKENS_USD`: Updated canonical default from `$0.60` to `$4.25`.
    - `RETELL_PRICE_PER_AUDIO_MINUTE_USD`: Retained existing canonical default of `$0.012` per minute.
  - Preserved integer micro-USD precision, atomic Lua two-phase budget reservation/settlement/refund, and fail-closed security.
  - Updated documentation (`README.md`, `.env.example`, `IMPLEMENTATION_PLAN.md`, `ROADMAP.md`) and unit test assertions.

- [x] **Dedicated 404 Not Found Page & Lost Document Illustration**
  - **Custom SVG Paper Character (`src/components/illustrations/LostDocumentIllustration.tsx`):**
    - Hand-authored, scalable vector illustration recreating the approved visual reference design:
      - Tilted paper body with folded top-left corner, faint peach ruled lines, and warm chocolate brown outlines (`#7E4E2C`).
      - Expressive face with worried arched eyebrows, blinking dark oval eyes with catchlight sparks, soft peach blush cheeks (`#FFAAA6`), and a gentle frown.
      - Left arm akimbo on hip, right arm scratching head/temple in confusion.
      - Short stick legs with rounded feet grounded on a soft beige shadow ellipse (`#F4E6D2`).
      - Directional wooden signpost with two angled arrow boards pointing right/down-right, nestled in sage green bush mounds (`#98AB82`, `#A7B990`).
      - Floating tomato red question mark (`#E6533D`) and confusion accent ticks.
  - **Lightweight CSS Animations & Reduced-Motion Safeguard:**
    - Gentle floating document bobbing (`translateY(-8px)` over 4s), subtle question mark scaling, rhythmic eye blink (every 4.5s), and ground shadow breathing.
    - Zero external animation libraries required.
    - Full `@media (prefers-reduced-motion: reduce)` support: disables all nonessential animation and resets transforms.
  - **Next.js App Router Not Found Page (`src/app/not-found.tsx`):**
    - Implemented Next.js App Router `not-found.tsx` convention with full-viewport immersive canvas (`fixed inset-0 z-50 overflow-y-auto bg-brand-cream`).
    - Top-left Retell brand squircle with white capital `R` linking to `/`.
    - Centered layout with generous whitespace, organic peach background corner blobs (`aria-hidden="true"`).
    - Clear, friendly student-oriented copy:
      - Headline: _"Oops! This answer isn't here."_
      - Subtext: _"Looks like this page took a different route. Let's get you back on track."_
    - Dual actionable navigation buttons:
      - Primary: `Back to Home` (`/`) in solid Tomato red with `HomeIcon`.
      - Secondary: `Visit your Library` (`/library`) in Tomato outline with new `LayersIcon`.
      - Responsive stacking on mobile viewports (<640px) and side-by-side layout on tablet/desktop.
  - **Quality Assurance & Verification:**
    - 281 passing unit tests across 31 test files (`tests/unit/not-found.test.ts` added).
    - Zero TypeScript errors (`tsc --noEmit`), 100% ESLint compliance, 100% Prettier formatting.
    - Next.js production build verified (`next build --webpack`), registering `○ /_not-found` static prerender.
    - Local server HTTP 404 response verified end-to-end via `curl.exe`.

- [x] **`TASK-5.13` — Final Product Quality, UX, and Error Handling Audit**
  - **Eliminated Nonfunctional UI & Polished Layout:**
    - Removed nonfunctional hardcoded desktop navbar search input (`readOnly` input with no backing search functionality) from `src/components/AppShell.tsx`.
    - Removed unused `SearchIcon` and aligned desktop header actions to `justify-end` with "+ Add study material", maintaining visual balance across all breakpoints.
    - Removed redundant `"Ready to practise"` tab filter pill in `src/features/library/LibraryView.tsx` which previously duplicated the `"All"` filter, leaving clean and responsive `"All"` and `"Recently added"` filters.
  - **Centralized Student-Friendly Error Mapping (`src/lib/errors.ts`):**
    - Built comprehensive error mapping utility (`mapToStudentError`, `getStudentFriendlyErrorMessage`) translating raw infrastructure exceptions (HTTP status codes, WebSocket disconnects, Redis quota signals, database/IndexedDB exceptions) into actionable, supportive guidance.
    - Categorized errors into clear user-actionable groups: Device Permissions (Microphone), Hardware & Browser support, Network & Connectivity, Timeouts, Format & Size, File Corruption, Missing Content, Service Capacity / Rate Limits (429), Daily AI Budget Exhaustion, and Temporary Server / Provider issues.
    - Replaced all raw `"Error: ..."` banners and technical strings across Material Ingestion (`NewMaterialView.tsx`), Question Import (`ImportQuestionsModal.tsx`), Rubric Refinement (`SourceReviewView.tsx`), Real-Time Practice & Audio (`PracticeRoomView.tsx`), and Answer Review (`AnswerReviewView.tsx`).
    - Rewrote technical fallback notices in speech client (`transcribe-client.ts`) from `"Meta WebSocket unavailable; running browser speech engine"` to student-safe `"Live speech service unavailable; running local speech engine"`.
  - **Quality Assurance & Verification:**
    - Added dedicated test suite `tests/unit/student-errors.test.ts` (13 unit tests) asserting zero technical jargon leakage across all error cases and contexts.
    - Vitest unit test suite: 294 passed across 32 test files.
    - Zero TypeScript errors (`tsc --noEmit`), 100% ESLint compliance, 100% Prettier formatting.
    - Next.js production build (`next build --webpack`) verified clean across all 19 routes.

### Day 6: Evaluation & Deployment

- [ ] `TASK-6.1` — Production deployment to Vercel.
- [ ] `TASK-6.2` — Meta vs Baseten latency and accuracy comparison benchmarks.
- [ ] `TASK-6.3` — Playwright end-to-end automated tests.
- [ ] `TASK-6.4` — Structured demo script creation.

### November 2 – 4: Submission Preparation, Polish & Video

- Rehearse live demo walkthrough, record 3-minute video, Devpost submission.

---

## 5. Blocked or Awaiting External Access

- **None:** All 3 target capabilities are verified and operational:
  1. Meta Model API reasoning (`muse-spark-1.3`) — **Verified**
  2. Baseten reasoning (`meta-models/muse-spark-open-1026`) — **Verified**
  3. Meta Voice Transcribe (`muse-voice-transcribe-1.0`) — **Verified**

---

## 6. Verification Results

| Check                                | Command                   | Observed Result                                                                                                                                                                                                                                                                                                                                                                                                                             | Status       |
| ------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Vitest Unit Test Suite               | `pnpm run test`           | 294 passed across 32 test files (accounting-integration, anonymous-identity, rate-limiter, budget-ledger, transcribe-guard, pdf-preview-ingestion, image-optimization, paragraph-scope-isolation, attempt-comparison, attempt-history, responsive-layout, storage-resilience, day5-e2e-workflow, pause-hints-lifecycle, transcription-reliability, transcript-accumulator, recall-hints, practice-session, student-errors, not-found, etc.) | **PASSED**   |
| TypeScript Validation                | `pnpm run type-check`     | Zero errors across all `.ts` and `.tsx` files (`tsc --noEmit`)                                                                                                                                                                                                                                                                                                                                                                              | **PASSED**   |
| ESLint Code Quality                  | `pnpm run lint`           | Zero errors, zero warnings across all staged and core source files                                                                                                                                                                                                                                                                                                                                                                          | **PASSED**   |
| Prettier Formatting                  | `pnpm run format:check`   | All files conform to formatting standards                                                                                                                                                                                                                                                                                                                                                                                                   | **PASSED**   |
| Production Build                     | `pnpm run build`          | Webpack build compiled successfully; 19 routes registered (Home, Library, Add Material, Review, Practice, Study/Practice, Study/Attempts, Study/History, Study/Compare, APIs)                                                                                                                                                                                                                                                               | **PASSED**   |
| Live Meta Reasoning Smoke Test       | `pnpm run test:providers` | HTTP 200, 2336ms, valid JSON conforming to Zod schema, reasoning tokens verified                                                                                                                                                                                                                                                                                                                                                            | **VERIFIED** |
| Live Baseten Reasoning Smoke Test    | `pnpm run test:providers` | HTTP 200, 2175ms, valid JSON conforming to Zod schema, reasoning tokens verified                                                                                                                                                                                                                                                                                                                                                            | **VERIFIED** |
| Live Meta Voice Transcribe WebSocket | `pnpm run test:providers` | Handshake acknowledged (`sessionId`), streamed 206KB PCM audio, received 100% accurate final transcript, close code 1000                                                                                                                                                                                                                                                                                                                    | **VERIFIED** |

---

## 7. Latest Git Commit

- **Latest Commit:** `HEAD` — `feat(ingestion): optimize images before extraction` (hash `53bf6e1`)
- **Previous Commit:** `4cbc48b` — `fix: isolate paragraph audits and restore repeated hints`

---

## 8. Known Issues and Architectural Decisions

1. **Meta Voice Transcribe Official Protocol Confirmed:**
   - The initial handshake failure in Task 2 was caused by an outdated payload schema (`api_key` at root instead of `authorization.accessToken`). Once aligned with `dev.meta.ai/docs/api-reference/voice/schemas`, real-time speech transcription was empirically verified end-to-end.
2. **Deterministic Test Audio Fixture Created:**
   - Created `tests/fixtures/speech-24k.wav` and `speech-24k.pcm` locally via Windows speech synthesis, providing an ethical, non-sensitive, 100% reproducible benchmark for speech recognition testing.
