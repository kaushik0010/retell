"use client";

import React, { useState } from "react";
import {
  SAMPLE_STUDY_MATERIALS,
  SampleStudyMaterial,
} from "./sample-materials";
import {
  ExtractedQuestion,
  QuestionRubric,
  StudyMaterial,
  StudySet,
} from "@/lib/domain/study-set";
import { saveStudySet } from "@/lib/storage/study-store";
import { BookOpenIcon, SparklesIcon, ArrowPathIcon } from "@/components/icons";

interface MaterialIngestionFormProps {
  onStudySetReady: (studySet: StudySet) => void;
}

export function MaterialIngestionForm({
  onStudySetReady,
}: MaterialIngestionFormProps) {
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const characterCount = sourceText.length;
  const wordCount = sourceText.trim()
    ? sourceText.trim().split(/\s+/).length
    : 0;

  const handleSelectSample = (sample: SampleStudyMaterial) => {
    setTitle(sample.title);
    setSourceText(sample.sourceText);
    setError(null);
  };

  const handleClear = () => {
    setTitle("");
    setSourceText("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (characterCount < 20) {
      setError("Study material must be at least 20 characters long.");
      return;
    }

    if (characterCount > 20000) {
      setError("Study material exceeds the 20,000 character limit.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Extract questions and reference answers
      setLoadingStep(
        "Extracting key conceptual questions & reference answers..."
      );

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          sourceText,
        }),
      });

      const extractData = await extractRes.json();

      if (!extractRes.ok || !extractData.success) {
        throw new Error(
          extractData.error ||
            "Failed to extract questions from the provided study material."
        );
      }

      const studyMaterial: StudyMaterial = extractData.studyMaterial;
      const questions: ExtractedQuestion[] = extractData.questions;

      if (!questions || questions.length === 0) {
        throw new Error("No exam questions could be extracted from this text.");
      }

      // Step 2: Generate rubrics for each extracted question
      const rubrics: Record<string, QuestionRubric> = {};

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q) continue;

        setLoadingStep(
          `Generating source-grounded rubric for Question ${i + 1} of ${questions.length}...`
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
              `Failed to generate rubric for question ${i + 1}`
          );
        }

        rubrics[q.id] = rubricData.rubric;
      }

      // Step 3: Package complete study set and persist locally
      setLoadingStep("Finalizing and saving study set to local storage...");

      const studySet: StudySet = {
        id: studyMaterial.id,
        material: studyMaterial,
        questions,
        rubrics,
        createdAt: studyMaterial.createdAt,
        updatedAt: studyMaterial.updatedAt,
      };

      await saveStudySet(studySet);

      // Trigger completion callback to transition to Review View
      onStudySetReady(studySet);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="space-y-6">
      {/* Sample presets shelf */}
      <div className="border-brand-peach/60 rounded-2xl border bg-white/80 p-5 shadow-xs">
        <div className="text-brand-secondary flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
          <SparklesIcon className="text-brand-tomato h-4 w-4" />
          <span>Quick Start with Curated Exam Materials</span>
        </div>
        <p className="text-brand-secondary mt-1 text-xs">
          Click any preset to load real exam text with technical concepts and
          mechanisms:
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {SAMPLE_STUDY_MATERIALS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={isLoading}
              onClick={() => handleSelectSample(sample)}
              className="group border-brand-peach/50 bg-brand-cream/60 hover:border-brand-tomato/50 flex flex-col rounded-xl border p-3 text-left transition hover:bg-white hover:shadow-xs disabled:opacity-50"
            >
              <span className="text-brand-tomato text-[11px] font-semibold">
                {sample.category}
              </span>
              <span className="font-heading text-brand-ink group-hover:text-brand-tomato mt-1 line-clamp-1 text-xs font-bold">
                {sample.title.split(":")[1]?.trim() || sample.title}
              </span>
              <span className="text-brand-secondary mt-1 line-clamp-2 text-[11px]">
                {sample.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Ingestion Form */}
      <form
        onSubmit={handleSubmit}
        className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs sm:p-8"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-brand-ink text-xl font-bold">
              Add New Study Material
            </h2>
            <p className="text-brand-secondary mt-0.5 text-xs">
              Paste textbook notes, syllabus requirements, or lecture slides.
              Retell will extract questions and generate structured evaluation
              rubrics.
            </p>
          </div>
          {(title || sourceText) && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-brand-secondary hover:text-brand-ink mt-2 inline-flex items-center text-xs font-medium sm:mt-0"
            >
              Clear form
            </button>
          )}
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            <div className="flex items-start gap-2">
              <span className="font-bold">Error:</span>
              <div className="flex-1">{error}</div>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {/* Title Input */}
          <div>
            <label
              htmlFor="material-title"
              className="text-brand-ink block text-xs font-semibold"
            >
              Study Set Title{" "}
              <span className="text-brand-secondary font-normal">
                (optional — AI will suggest one if blank)
              </span>
            </label>
            <input
              id="material-title"
              type="text"
              value={title}
              disabled={isLoading}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Systems: Paxos Consensus Algorithm"
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
                Source Study Material{" "}
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
              placeholder="Paste your syllabus text, lecture notes, textbook excerpt, or technical documentation here..."
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
                  Meta reasoning model is analyzing concepts and constructing
                  semantic criteria.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-brand-secondary flex items-center gap-2 text-xs">
            <BookOpenIcon className="text-brand-secondary h-4 w-4" />
            <span>
              Accepts paraphrasing • Rubric criteria fully editable before
              practice
            </span>
          </div>

          <button
            type="submit"
            disabled={
              isLoading || characterCount < 20 || characterCount > 20000
            }
            className="bg-brand-tomato hover:bg-brand-tomato-hover focus-visible:outline-brand-tomato inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-white shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                <span>Processing Material...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4" />
                <span>Extract Questions &amp; Generate Rubrics</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
