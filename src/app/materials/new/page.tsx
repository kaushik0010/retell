"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SAMPLE_STUDY_MATERIALS,
  SampleStudyMaterial,
} from "@/features/library/sample-materials";
import {
  ExtractedQuestion,
  QuestionRubric,
  StudyMaterial,
  StudySet,
} from "@/lib/domain/study-set";
import { saveStudySet } from "@/lib/storage/study-store";
import {
  SparklesIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  AlertCircleIcon,
} from "@/components/icons";

export default function AddMaterialPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <ArrowPathIcon className="text-brand-tomato h-6 w-6 animate-spin" />
        </div>
      }
    >
      <AddMaterialContent />
    </Suspense>
  );
}

function AddMaterialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset");

  const presetMatch = presetParam
    ? SAMPLE_STUDY_MATERIALS.find((s) => s.id === presetParam)
    : undefined;

  const [title, setTitle] = useState(presetMatch?.title || "");
  const [sourceText, setSourceText] = useState(presetMatch?.sourceText || "");
  const [activeTab, setActiveTab] = useState<"paste" | "upload" | "photo">(
    "paste"
  );

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Missing question / answer recovery state
  const [missingQuestionPrompt, setMissingQuestionPrompt] = useState<
    string | null
  >(null);
  const [studentInputQuestion, setStudentInputQuestion] = useState("");
  const [missingAnswerPrompt, setMissingAnswerPrompt] = useState<string | null>(
    null
  );
  const [studentInputAnswer, setStudentInputAnswer] = useState("");

  const characterCount = sourceText.length;
  const wordCount = sourceText.trim()
    ? sourceText.trim().split(/\s+/).length
    : 0;

  const handleSelectSample = (sample: SampleStudyMaterial) => {
    setTitle(sample.title);
    setSourceText(sample.sourceText);
    setError(null);
    setMissingQuestionPrompt(null);
    setMissingAnswerPrompt(null);
  };

  const handleClear = () => {
    setTitle("");
    setSourceText("");
    setError(null);
    setMissingQuestionPrompt(null);
    setMissingAnswerPrompt(null);
  };

  const executeExtraction = async (customQuestion?: string) => {
    if (characterCount < 20) {
      setError("Please paste at least 20 characters of study material.");
      return;
    }

    if (characterCount > 20000) {
      setError("Study material exceeds the 20,000 character limit.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setLoadingStep(
        "Finding existing questions and answers in your material..."
      );

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          sourceText,
          studentQuestion: customQuestion?.trim() || undefined,
        }),
      });

      const extractData = await extractRes.json();

      if (!extractRes.ok || !extractData.success) {
        throw new Error(
          extractData.error ||
            "Could not find questions and answers in this material."
        );
      }

      // Handle Missing Question Case: student pasted notes without question
      if (extractData.status === "missing_question") {
        setMissingQuestionPrompt(
          extractData.message ||
            "We found your study notes, but couldn't find your exam questions. What question will your exam ask about this material?"
        );
        setIsLoading(false);
        setLoadingStep("");
        return;
      }

      // Handle Missing Answer Case: student pasted question without answer
      if (extractData.status === "missing_answer") {
        setMissingAnswerPrompt(
          extractData.message ||
            "We found your question, but couldn't find the answer in your material. Please paste the answer you want to study from."
        );
        setIsLoading(false);
        setLoadingStep("");
        return;
      }

      const studyMaterial: StudyMaterial = extractData.studyMaterial;
      const questions: ExtractedQuestion[] = extractData.questions;

      if (!questions || questions.length === 0) {
        throw new Error(
          "No question-answer pairs could be extracted. Please paste text with at least one question and answer."
        );
      }

      // Step 2: Generate important points (rubric) for each extracted question
      const rubrics: Record<string, QuestionRubric> = {};

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q) continue;

        setLoadingStep(
          `Finding important points to remember for Question ${i + 1} of ${questions.length}...`
        );

        const rubricRes = await fetch("/api/rubric", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.id,
            question: q.question,
            referenceAnswer: q.referenceAnswer,
            sourceText: studyMaterial.sourceText,
            studyMaterialId: studyMaterial.id,
          }),
        });

        const rubricData = await rubricRes.json();

        if (!rubricRes.ok || !rubricData.success) {
          throw new Error(
            rubricData.error ||
              `Could not find key points for Question ${i + 1}`
          );
        }

        rubrics[q.id] = rubricData.rubric;
      }

      // Step 3: Package complete study set and persist to IndexedDB
      setLoadingStep("Saving study set to your local browser storage...");

      const studySet: StudySet = {
        id: studyMaterial.id,
        material: studyMaterial,
        questions,
        rubrics,
        createdAt: studyMaterial.createdAt,
        updatedAt: studyMaterial.updatedAt,
      };

      await saveStudySet(studySet);

      // Navigate to Review screen
      router.push(`/review/${studySet.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while processing your material.";
      setError(msg);
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeExtraction();
  };

  const handleResolveMissingQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInputQuestion.trim()) return;
    setMissingQuestionPrompt(null);
    executeExtraction(studentInputQuestion);
  };

  const handleResolveMissingAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInputAnswer.trim()) return;
    const combined = `${sourceText}\n\nAnswer:\n${studentInputAnswer}`;
    setSourceText(combined);
    setMissingAnswerPrompt(null);
  };

  return (
    <div className="space-y-6">
      {/* Stepper matching reference image 1 */}
      <div className="flex items-center justify-center gap-2 py-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="bg-brand-tomato flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs">
            1
          </div>
          <span className="text-brand-ink text-xs font-bold">Add Material</span>
        </div>
        <div className="bg-brand-peach h-0.5 w-8 sm:w-16" />
        <div className="flex items-center gap-2 opacity-60">
          <div className="bg-brand-cream border-brand-peach text-brand-secondary flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
            2
          </div>
          <span className="text-brand-secondary text-xs font-medium">
            Review Points
          </span>
        </div>
        <div className="bg-brand-peach h-0.5 w-8 sm:w-16" />
        <div className="flex items-center gap-2 opacity-60">
          <div className="bg-brand-cream border-brand-peach text-brand-secondary flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
            3
          </div>
          <span className="text-brand-secondary text-xs font-medium">
            Practise
          </span>
        </div>
      </div>

      {/* Main Header matching reference */}
      <div className="text-center sm:text-left">
        <h1 className="font-heading text-brand-ink text-2xl font-bold sm:text-3xl">
          Add your study material
        </h1>
        <p className="text-brand-secondary mt-1 text-xs sm:text-sm">
          Paste your questions and answers. Retell will find the important
          points to remember and help you practise them aloud.
        </p>
      </div>

      {/* Mode Tabs matching reference image 1 */}
      <div className="border-brand-peach/60 flex border-b">
        <button
          type="button"
          onClick={() => setActiveTab("paste")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition ${
            activeTab === "paste"
              ? "border-brand-tomato text-brand-tomato"
              : "text-brand-secondary hover:text-brand-ink border-transparent"
          }`}
        >
          <DocumentTextIcon className="h-4 w-4" />
          <span>Paste Text</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-medium transition ${
            activeTab === "upload"
              ? "border-brand-tomato text-brand-tomato"
              : "text-brand-secondary hover:text-brand-ink border-transparent"
          }`}
        >
          <span>Upload File</span>
          <span className="bg-brand-peach/50 text-brand-tomato rounded-full px-2 py-0.5 text-[9px] font-bold">
            Coming Day 5
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("photo")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-medium transition ${
            activeTab === "photo"
              ? "border-brand-tomato text-brand-tomato"
              : "text-brand-secondary hover:text-brand-ink border-transparent"
          }`}
        >
          <span>Take Photo</span>
          <span className="bg-brand-peach/50 text-brand-tomato rounded-full px-2 py-0.5 text-[9px] font-bold">
            Coming Day 5
          </span>
        </button>
      </div>

      {/* Curated Sample Presets Pills */}
      <div className="border-brand-peach/60 rounded-2xl border bg-white/80 p-4 shadow-xs">
        <div className="text-brand-secondary flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
          <SparklesIcon className="text-brand-tomato h-4 w-4" />
          <span>Or load a curated exam topic with one click:</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLE_STUDY_MATERIALS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={isLoading}
              onClick={() => handleSelectSample(sample)}
              className="group border-brand-peach/60 bg-brand-cream/60 hover:border-brand-tomato/50 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left transition hover:bg-white disabled:opacity-50"
            >
              <span className="text-brand-tomato text-[10px] font-bold tracking-wider uppercase">
                {sample.category}:
              </span>
              <span className="font-heading text-brand-ink group-hover:text-brand-tomato text-xs font-bold">
                {sample.title.split(":")[1]?.trim() || sample.title}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Missing Question Resolution Card */}
      {missingQuestionPrompt && (
        <form
          onSubmit={handleResolveMissingQuestion}
          className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-heading text-sm font-bold text-amber-900">
                What question does this material answer?
              </h3>
              <p className="mt-0.5 text-xs text-amber-800">
                {missingQuestionPrompt}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-amber-900">
              Your Exam Question:
            </label>
            <input
              type="text"
              required
              autoFocus
              value={studentInputQuestion}
              onChange={(e) => setStudentInputQuestion(e.target.value)}
              placeholder="e.g. Explain how DNS translates domain names into IP addresses."
              className="text-brand-ink focus:border-brand-tomato w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 items-center justify-center rounded-xl px-4 text-xs font-bold text-white shadow-xs transition"
            >
              Confirm Question &amp; Find Key Points
            </button>
            <button
              type="button"
              onClick={() => setMissingQuestionPrompt(null)}
              className="text-xs text-amber-800 hover:text-amber-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Missing Answer Resolution Card */}
      {missingAnswerPrompt && (
        <form
          onSubmit={handleResolveMissingAnswer}
          className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h3 className="font-heading text-sm font-bold text-amber-900">
                Please paste the answer for this question
              </h3>
              <p className="mt-0.5 text-xs text-amber-800">
                {missingAnswerPrompt}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-amber-900">
              Answer from your notes or textbook:
            </label>
            <textarea
              rows={4}
              required
              autoFocus
              value={studentInputAnswer}
              onChange={(e) => setStudentInputAnswer(e.target.value)}
              placeholder="Paste the answer you are studying from..."
              className="text-brand-ink focus:border-brand-tomato w-full rounded-xl border border-amber-300 bg-white p-3 text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 items-center justify-center rounded-xl px-4 text-xs font-bold text-white shadow-xs transition"
            >
              Add Answer &amp; Continue
            </button>
            <button
              type="button"
              onClick={() => setMissingAnswerPrompt(null)}
              className="text-xs text-amber-800 hover:text-amber-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Main Ingestion Form */}
      <form
        onSubmit={handleSubmit}
        className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs sm:p-8"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-brand-ink text-lg font-bold">
              Paste your study questions and answers
            </h2>
            <p className="text-brand-secondary text-xs">
              Include questions and their answers. Retell preserves your exact
              framing and finds the key points to remember.
            </p>
          </div>
          {(title || sourceText) && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-brand-secondary hover:text-brand-ink mt-2 text-xs font-medium sm:mt-0"
            >
              Clear form
            </button>
          )}
        </div>

        {/* Error notification without losing text */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            <div className="flex items-start gap-2">
              <span className="font-bold">Error:</span>
              <div className="flex-1">{error}</div>
            </div>
          </div>
        )}

        <div className="mt-5 space-y-4">
          {/* Title Input */}
          <div>
            <label
              htmlFor="material-title"
              className="text-brand-ink block text-xs font-semibold"
            >
              Subject or topic title{" "}
              <span className="text-brand-secondary font-normal">
                (optional)
              </span>
            </label>
            <input
              id="material-title"
              type="text"
              value={title}
              disabled={isLoading}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems: Page Replacement or Biology: Respiration"
              className="border-brand-peach/80 bg-brand-cream/30 text-brand-ink placeholder:text-brand-secondary/60 focus:border-brand-tomato focus:ring-brand-tomato mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:outline-none disabled:opacity-50"
            />
          </div>

          {/* Source Text Input */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="material-source"
                className="text-brand-ink block text-xs font-semibold"
              >
                Questions and Answers{" "}
                <span className="text-brand-tomato">*</span>
              </label>
              <div className="text-brand-secondary flex items-center gap-2 text-[11px]">
                <span>{wordCount} words</span>
                <span>•</span>
                <span
                  className={
                    characterCount > 20000
                      ? "font-bold text-red-600"
                      : characterCount < 20 && characterCount > 0
                        ? "text-amber-600"
                        : "text-brand-secondary"
                  }
                >
                  {characterCount.toLocaleString()} / 20,000 chars
                </span>
              </div>
            </div>

            <textarea
              id="material-source"
              required
              rows={12}
              value={sourceText}
              disabled={isLoading}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={`Paste your questions and answers here. For example:\n\nQuestion:\nExplain the different page replacement algorithms and compare their advantages.\n\nAnswer (from your material):\nPage replacement algorithms decide which page to remove from memory when a page fault occurs. Common algorithms include FIFO, LRU, and Optimal...`}
              className="border-brand-peach/80 bg-brand-cream/30 text-brand-ink placeholder:text-brand-secondary/60 focus:border-brand-tomato focus:ring-brand-tomato mt-1.5 w-full rounded-xl border p-3.5 font-sans text-sm leading-relaxed focus:bg-white focus:ring-1 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Loading Progress State */}
        {isLoading && (
          <div className="border-brand-peach/60 bg-brand-cream/60 mt-5 rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <ArrowPathIcon className="text-brand-tomato h-5 w-5 animate-spin" />
              <div>
                <p className="text-brand-ink text-xs font-semibold">
                  {loadingStep}
                </p>
                <p className="text-brand-secondary mt-0.5 text-[11px]">
                  Grounded in your notes • Accepting paraphrasing
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-brand-secondary text-xs">
            Retell preserves your exact questions and prepares your spoken
            checklist.
          </p>

          <button
            type="submit"
            disabled={
              isLoading || characterCount < 20 || characterCount > 20000
            }
            className="bg-brand-tomato hover:bg-brand-tomato-hover focus-visible:outline-brand-tomato inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                <span>Finding Questions &amp; Key Points...</span>
              </>
            ) : (
              <>
                <span>Find questions and key points</span>
                <span>&rarr;</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
