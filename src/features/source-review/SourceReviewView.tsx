"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ExtractedQuestion,
  QuestionRubric,
  RUBRIC_CATEGORY_META,
  RubricCriterion,
  RubricCriterionCategory,
  StudySet,
} from "@/lib/domain/study-set";
import { saveStudySet } from "@/lib/storage/study-store";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  AlertCircleIcon,
} from "@/components/icons";

import { ImportQuestionsModal } from "./ImportQuestionsModal";

interface SourceReviewViewProps {
  initialStudySet: StudySet;
  onBack?: () => void;
  onSaved?: (updatedSet: StudySet) => void;
}

/**
 * Deterministic serializer for computing study set dirty state.
 * Inspects all user-editable fields (title, questions, reference answers, order, pageNumber, and all rubric criteria).
 */
export function serializeStudySetForComparison(set: StudySet): string {
  return JSON.stringify({
    title: (set.material.title || "").trim(),
    questions: set.questions.map((q) => ({
      id: q.id,
      question: (q.question || "").trim(),
      referenceAnswer: (q.referenceAnswer || "").trim(),
      orderIndex: q.orderIndex,
      pageNumber: q.pageNumber,
    })),
    rubrics: Object.fromEntries(
      Object.entries(set.rubrics).map(([qId, rubric]) => [
        qId,
        (rubric?.criteria || []).map((c) => ({
          id: c.id,
          category: c.category,
          name: (c.name || "").trim(),
          description: (c.description || "").trim(),
          satisfactoryDemonstration: (c.satisfactoryDemonstration || "").trim(),
          isMandatory: Boolean(c.isMandatory),
          orderIndex: c.orderIndex,
        })),
      ])
    ),
  });
}

/**
 * Auto-expanding content-aware textarea to prevent nested scrolling and clipped text.
 */
function AutoResizeTextarea({
  value,
  onChange,
  className,
  placeholder,
  minRows = 2,
  ...props
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  minRows?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange">) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(
        textareaRef.current.scrollHeight,
        minRows * 22
      )}px`;
    }
  }, [value, minRows]);

  return (
    <textarea
      ref={textareaRef}
      rows={minRows}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${Math.max(
          e.target.scrollHeight,
          minRows * 22
        )}px`;
      }}
      placeholder={placeholder}
      className={`w-full min-w-0 resize-none overflow-hidden break-words ${className || ""}`}
      {...props}
    />
  );
}

export function SourceReviewView({
  initialStudySet,
  onBack,
  onSaved,
}: SourceReviewViewProps) {
  const [studySet, setStudySet] = useState<StudySet>(initialStudySet);
  const [savedBaseline, setSavedBaseline] = useState<string>(() =>
    serializeStudySetForComparison(initialStudySet)
  );

  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    initialStudySet.questions[0]?.id || ""
  );
  const [isSourceExpanded, setIsSourceExpanded] = useState<boolean>(false);
  const [isMobileExcerptExpanded, setIsMobileExcerptExpanded] =
    useState<boolean>(false);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] =
    useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);

  // Accurate Save State Management
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  // Add new important point state
  const [isAddingPoint, setIsAddingPoint] = useState(false);
  const [newPointCategory, setNewPointCategory] =
    useState<RubricCriterionCategory>("essential_concept");
  const [newPointName, setNewPointName] = useState("");
  const [newPointDescription, setNewPointDescription] = useState("");
  const [newPointGuidance, setNewPointGuidance] = useState("");
  const [newPointMandatory, setNewPointMandatory] = useState(true);

  // Refresh points loading state
  const [isRefreshingPoints, setIsRefreshingPoints] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Derive dirty status from deep comparison against baseline
  const currentFingerprint = serializeStudySetForComparison(studySet);
  const hasUnsavedChanges = currentFingerprint !== savedBaseline;

  // Protect against accidental navigation with unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const activeQuestionIndex = studySet.questions.findIndex(
    (q) => q.id === selectedQuestionId
  );
  const activeQuestion: ExtractedQuestion | undefined =
    studySet.questions[activeQuestionIndex] || studySet.questions[0];

  const activeRubric: QuestionRubric | undefined = activeQuestion
    ? studySet.rubrics[activeQuestion.id]
    : undefined;

  // Save changes to IndexedDB
  const handleSave = async (setToSave: StudySet = studySet) => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const snapshotBeingSaved = serializeStudySetForComparison(setToSave);
    const updated: StudySet = {
      ...setToSave,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveStudySet(updated);
      setSavedBaseline(snapshotBeingSaved);
      setStudySet(updated);
      setIsSaving(false);
      setSaveError(null);
      if (onSaved) {
        onSaved(updated);
      }
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
      setSaveError(
        err instanceof Error
          ? err.message
          : "Failed to save changes. Please try again."
      );
    }
  };

  // Handle successful question import from modal
  const handleImportSuccess = async (
    importedQuestions: ExtractedQuestion[],
    importedRubrics: Record<string, QuestionRubric>,
    appendedSource: string
  ) => {
    const updatedQuestions = [...studySet.questions, ...importedQuestions];
    const updatedRubrics = { ...studySet.rubrics, ...importedRubrics };
    const updatedSource = studySet.material.sourceText
      ? `${studySet.material.sourceText}\n\n${appendedSource}`
      : appendedSource;

    const updatedSet: StudySet = {
      ...studySet,
      material: {
        ...studySet.material,
        sourceText: updatedSource,
        characterCount: updatedSource.length,
      },
      questions: updatedQuestions,
      rubrics: updatedRubrics,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveStudySet(updatedSet);
      setSavedBaseline(serializeStudySetForComparison(updatedSet));
      setStudySet(updatedSet);
      if (importedQuestions[0]) {
        setSelectedQuestionId(importedQuestions[0].id);
      }
      if (onSaved) {
        onSaved(updatedSet);
      }
    } catch (err) {
      console.error("Failed to persist imported questions:", err);
      setStudySet(updatedSet);
      setSaveError(
        "Imported questions were added but could not be saved to local storage. Click 'Save study set' to retry."
      );
    }
  };

  // Title changes
  const handleTitleChange = (newTitle: string) => {
    const updated: StudySet = {
      ...studySet,
      material: {
        ...studySet.material,
        title: newTitle,
      },
    };
    setStudySet(updated);
  };

  // Question and answer edits
  const handleQuestionTextChange = (newQuestion: string) => {
    if (!activeQuestion) return;
    const updatedQuestions = studySet.questions.map((q) =>
      q.id === activeQuestion.id ? { ...q, question: newQuestion } : q
    );
    setStudySet({ ...studySet, questions: updatedQuestions });
  };

  const handleReferenceAnswerChange = (newAnswer: string) => {
    if (!activeQuestion) return;
    const updatedQuestions = studySet.questions.map((q) =>
      q.id === activeQuestion.id ? { ...q, referenceAnswer: newAnswer } : q
    );
    setStudySet({ ...studySet, questions: updatedQuestions });
  };

  // Add question manually
  const handleAddQuestion = () => {
    const newId = `q_${crypto.randomUUID()}`;
    const newQ: ExtractedQuestion = {
      id: newId,
      studyMaterialId: studySet.material.id,
      question: "Explain the next concept or question from your material...",
      referenceAnswer: "Detailed answer explaining the concept...",
      sourceExcerpt: "",
      orderIndex: studySet.questions.length,
    };

    const newRubric: QuestionRubric = {
      id: `rub_${crypto.randomUUID()}`,
      questionId: newId,
      studyMaterialId: studySet.material.id,
      criteria: [
        {
          id: `crit_${crypto.randomUUID()}`,
          category: "essential_concept",
          name: "Main Idea",
          description:
            "Explain the central concept accurately in your own words.",
          satisfactoryDemonstration:
            "Student demonstrates understanding of the main mechanism.",
          isMandatory: true,
          orderIndex: 0,
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    const updated: StudySet = {
      ...studySet,
      questions: [...studySet.questions, newQ],
      rubrics: {
        ...studySet.rubrics,
        [newId]: newRubric,
      },
    };

    setStudySet(updated);
    setSelectedQuestionId(newId);
  };

  // Delete question
  const handleDeleteQuestion = (qId: string) => {
    if (studySet.questions.length <= 1) {
      alert("A study set must have at least one question.");
      return;
    }
    if (!confirm("Are you sure you want to remove this question?")) {
      return;
    }

    const updatedQuestions = studySet.questions.filter((q) => q.id !== qId);
    const updatedRubrics = { ...studySet.rubrics };
    delete updatedRubrics[qId];

    const updated: StudySet = {
      ...studySet,
      questions: updatedQuestions,
      rubrics: updatedRubrics,
    };

    setStudySet(updated);
    if (updatedQuestions[0]) {
      setSelectedQuestionId(updatedQuestions[0].id);
    }
  };

  // Update an existing point
  const handleUpdatePoint = (
    pointId: string,
    updates: Partial<RubricCriterion>
  ) => {
    if (!activeQuestion || !activeRubric) return;

    const updatedCriteria = activeRubric.criteria.map((c) =>
      c.id === pointId ? { ...c, ...updates } : c
    );

    const updatedRubric: QuestionRubric = {
      ...activeRubric,
      criteria: updatedCriteria,
      updatedAt: new Date().toISOString(),
    };

    setStudySet({
      ...studySet,
      rubrics: {
        ...studySet.rubrics,
        [activeQuestion.id]: updatedRubric,
      },
    });
  };

  const handleDeletePoint = (pointId: string) => {
    if (!activeQuestion || !activeRubric) return;
    if (activeRubric.criteria.length <= 1) {
      alert("Each answer must have at least one important point to remember.");
      return;
    }

    const updatedCriteria = activeRubric.criteria.filter(
      (c) => c.id !== pointId
    );

    const updatedRubric: QuestionRubric = {
      ...activeRubric,
      criteria: updatedCriteria,
      updatedAt: new Date().toISOString(),
    };

    setStudySet({
      ...studySet,
      rubrics: {
        ...studySet.rubrics,
        [activeQuestion.id]: updatedRubric,
      },
    });
  };

  // Add new point submission
  const handleAddPointSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuestion || !activeRubric) return;
    if (!newPointName.trim() || !newPointDescription.trim()) return;

    const newCrit: RubricCriterion = {
      id: `crit_${crypto.randomUUID()}`,
      category: newPointCategory,
      name: newPointName.trim(),
      description: newPointDescription.trim(),
      satisfactoryDemonstration:
        newPointGuidance.trim() ||
        "Student explains this point clearly in their own words.",
      isMandatory: newPointMandatory,
      orderIndex: activeRubric.criteria.length,
    };

    const updatedRubric: QuestionRubric = {
      ...activeRubric,
      criteria: [...activeRubric.criteria, newCrit],
      updatedAt: new Date().toISOString(),
    };

    setStudySet({
      ...studySet,
      rubrics: {
        ...studySet.rubrics,
        [activeQuestion.id]: updatedRubric,
      },
    });

    setNewPointName("");
    setNewPointDescription("");
    setNewPointGuidance("");
    setIsAddingPoint(false);
  };

  // Refresh points with AI
  const handleRefreshPoints = async () => {
    if (!activeQuestion) return;
    setIsRefreshingPoints(true);
    setRefreshError(null);

    try {
      const res = await fetch("/api/rubric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: activeQuestion.id,
          question: activeQuestion.question,
          referenceAnswer: activeQuestion.referenceAnswer,
          sourceText: studySet.material.sourceText,
          studyMaterialId: studySet.material.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not refresh points.");
      }

      const updatedRubrics = {
        ...studySet.rubrics,
        [activeQuestion.id]: data.rubric,
      };

      const updatedSet: StudySet = {
        ...studySet,
        rubrics: updatedRubrics,
      };

      setStudySet(updatedSet);
      await handleSave(updatedSet);
    } catch (err: unknown) {
      setRefreshError(
        err instanceof Error ? err.message : "Failed to refresh points"
      );
    } finally {
      setIsRefreshingPoints(false);
    }
  };

  // Step question on mobile
  const handleNextQuestion = () => {
    if (activeQuestionIndex < studySet.questions.length - 1) {
      setSelectedQuestionId(studySet.questions[activeQuestionIndex + 1]!.id);
    }
  };

  const handlePrevQuestion = () => {
    if (activeQuestionIndex > 0) {
      setSelectedQuestionId(studySet.questions[activeQuestionIndex - 1]!.id);
    }
  };

  // Filter criteria by category
  const filteredCriteria = activeRubric
    ? categoryFilter === "all"
      ? activeRubric.criteria
      : activeRubric.criteria.filter((c) => c.category === categoryFilter)
    : [];

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Top action & status bar matching reference */}
      <div className="border-brand-peach/80 flex w-full min-w-0 flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href="/library"
            onClick={onBack}
            className="border-brand-peach/80 bg-brand-cream/60 text-brand-ink hover:bg-brand-peach/40 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition"
            title="Back to library"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            {isEditingTitle ? (
              <input
                type="text"
                autoFocus
                value={studySet.material.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setIsEditingTitle(false);
                }}
                className="border-brand-tomato text-brand-ink w-full min-w-0 rounded-lg border bg-white px-2.5 py-1 text-sm font-bold focus:outline-none"
              />
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="font-heading text-brand-ink truncate text-base font-bold sm:text-lg">
                  {studySet.material.title}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-brand-secondary hover:text-brand-ink shrink-0 cursor-pointer rounded p-1"
                  title="Rename title"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
          {saveError && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700">
              <AlertCircleIcon className="h-3.5 w-3.5" />
              <span>{saveError}</span>
            </span>
          )}

          {hasUnsavedChanges && !isSaving && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
              Unsaved changes
            </span>
          )}

          {!hasUnsavedChanges && !isSaving && !saveError && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
              <CheckIcon className="h-3.5 w-3.5" />
              <span>Saved</span>
            </span>
          )}

          {isSaving ? (
            <button
              type="button"
              disabled
              className="bg-brand-tomato/70 inline-flex h-9 shrink-0 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-xs"
            >
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              <span>Saving...</span>
            </button>
          ) : hasUnsavedChanges || saveError ? (
            <button
              type="button"
              onClick={() => handleSave()}
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-xs transition"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              <span>Save study set</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Ready to Practise Explaining Aloud Banner matching reference */}
      <div className="flex w-full min-w-0 flex-col gap-4 rounded-2xl border border-[#F5D96B]/80 bg-gradient-to-r from-[#FFF8E1] to-[#FFF1D6] p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
          <div className="bg-brand-butter flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl shadow-2xs">
            🎙️
          </div>
          <div className="min-w-0">
            <h2 className="font-heading text-brand-ink text-sm font-bold">
              Ready to practise explaining aloud?
            </h2>
            <p className="text-brand-secondary mt-0.5 text-xs">
              Review and refine the important points below. When you&apos;re
              ready, start practising in the Practice Room.
            </p>
          </div>
        </div>

        {/* Honest affordance for Day 3 Practice Room */}
        <button
          type="button"
          onClick={() =>
            alert(
              "The Spoken Practice Room with real-time speech transcription unlocks in Day 3! Review and refine your points now so you're ready to rehearse aloud."
            )
          }
          title="The Spoken Practice Room opens in Day 3"
          className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-xs transition sm:w-auto"
        >
          <span>Start practising</span>
          <span>&rarr;</span>
        </button>
      </div>

      {/* Collapsible Source Material Accordion */}
      <div className="border-brand-peach/80 w-full min-w-0 overflow-hidden rounded-2xl border bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setIsSourceExpanded(!isSourceExpanded)}
          className="hover:bg-brand-cream/30 flex w-full min-w-0 cursor-pointer items-center justify-between p-4 text-left transition sm:px-6"
        >
          <div className="flex min-w-0 items-center gap-3">
            <DocumentTextIcon className="text-brand-tomato h-4 w-4 shrink-0" />
            <span className="font-heading text-brand-ink truncate text-xs font-bold sm:text-sm">
              Original Notes &amp; Source Text
            </span>
            <span className="bg-brand-cream text-brand-secondary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
              {studySet.material.characterCount.toLocaleString()} chars
            </span>
          </div>
          <ChevronDownIcon
            className={`text-brand-secondary h-4 w-4 shrink-0 transition-transform duration-200 ${
              isSourceExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isSourceExpanded && (
          <div className="border-brand-peach/40 bg-brand-cream/20 border-t p-4 sm:p-6">
            <div className="border-brand-peach/40 text-brand-secondary max-h-64 overflow-y-auto rounded-xl border bg-white p-4 font-sans text-xs leading-relaxed break-words whitespace-pre-wrap">
              {studySet.material.sourceText}
            </div>
          </div>
        )}
      </div>

      {/* Questions Selector Bar */}
      <div className="w-full min-w-0">
        {/* Desktop Question Pills */}
        <div className="border-brand-peach/60 hidden w-full min-w-0 flex-wrap items-center gap-2 border-b pb-3 sm:flex">
          <span className="text-brand-secondary mr-1 text-xs font-bold tracking-wider uppercase">
            Questions:
          </span>
          {studySet.questions.map((q, idx) => {
            const isSelected = q.id === selectedQuestionId;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedQuestionId(q.id)}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  isSelected
                    ? "bg-brand-tomato text-white shadow-2xs"
                    : "border-brand-peach/80 text-brand-ink hover:bg-brand-cream border bg-white"
                }`}
              >
                <span>
                  {idx + 1}. {q.question.slice(0, 28)}
                  {q.question.length > 28 ? "..." : ""}
                </span>
              </button>
            );
          })}

          {/* Add Question / Import Options */}
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:bg-brand-cream inline-flex cursor-pointer items-center gap-1 rounded-xl border border-dashed px-3 py-2 text-xs font-semibold transition"
              title="Add a question manually"
            >
              <PlusIcon className="text-brand-tomato h-3.5 w-3.5" />
              <span>Add Manually</span>
            </button>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="border-brand-peach/80 text-brand-tomato hover:bg-brand-cream/70 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-bold shadow-2xs transition"
              title="Import questions from images or PDF"
            >
              <DocumentTextIcon className="text-brand-tomato h-3.5 w-3.5" />
              <span>Import from File</span>
            </button>
          </div>
        </div>

        {/* Mobile Question Navigator matching reference */}
        <div className="border-brand-peach/60 w-full min-w-0 space-y-2 border-b pb-3 sm:hidden">
          <div className="flex items-center justify-between">
            <span className="text-brand-secondary text-xs font-bold tracking-wider uppercase">
              Questions
            </span>
            <div className="text-brand-secondary flex items-center gap-2 text-xs">
              <span className="text-brand-ink font-semibold">
                {activeQuestionIndex + 1} of {studySet.questions.length}
              </span>
              <button
                type="button"
                disabled={activeQuestionIndex === 0}
                onClick={handlePrevQuestion}
                className="border-brand-peach/80 text-brand-ink cursor-pointer rounded-lg border bg-white p-1 disabled:cursor-not-allowed disabled:opacity-40"
                title="Previous question"
              >
                &larr;
              </button>
              <button
                type="button"
                disabled={activeQuestionIndex === studySet.questions.length - 1}
                onClick={handleNextQuestion}
                className="border-brand-peach/80 text-brand-ink cursor-pointer rounded-lg border bg-white p-1 disabled:cursor-not-allowed disabled:opacity-40"
                title="Next question"
              >
                &rarr;
              </button>
            </div>
          </div>

          {/* Active Question Dropdown Selector */}
          <div className="relative w-full min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileDropdownOpen(!isMobileDropdownOpen)}
              className="bg-brand-tomato flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-2xs"
            >
              <span className="min-w-0 truncate text-left">
                {activeQuestionIndex + 1}. {activeQuestion?.question}
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isMobileDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isMobileDropdownOpen && (
              <div className="border-brand-peach/80 absolute top-full right-0 left-0 z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-white p-2 shadow-lg">
                {studySet.questions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setSelectedQuestionId(q.id);
                      setIsMobileDropdownOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                      q.id === selectedQuestionId
                        ? "bg-brand-peach/60 text-brand-tomato font-bold"
                        : "text-brand-ink hover:bg-brand-cream"
                    }`}
                  >
                    <span className="line-clamp-1">
                      {idx + 1}. {q.question}
                    </span>
                  </button>
                ))}

                <div className="border-brand-peach/40 mt-1 flex flex-col gap-1 border-t pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleAddQuestion();
                      setIsMobileDropdownOpen(false);
                    }}
                    className="text-brand-ink hover:bg-brand-cream flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-xs font-medium"
                  >
                    <PlusIcon className="text-brand-tomato h-3.5 w-3.5" />
                    <span>+ Add question manually</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportModalOpen(true);
                      setIsMobileDropdownOpen(false);
                    }}
                    className="text-brand-tomato hover:bg-brand-cream flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-xs font-bold"
                  >
                    <DocumentTextIcon className="h-3.5 w-3.5" />
                    <span>Import from PDF or images...</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout (Left: Q&A, Right: Important Points) */}
      {activeQuestion && (
        <div className="grid w-full min-w-0 items-start gap-6 lg:grid-cols-12">
          {/* Left Column: Question & Reference Answer (5 columns on lg) */}
          <div className="w-full min-w-0 space-y-4 lg:col-span-5">
            <div className="border-brand-peach/80 w-full min-w-0 space-y-4 rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
              {/* Question Header & Delete Action */}
              <div className="flex items-center justify-between">
                <span className="text-brand-tomato text-xs font-bold tracking-wider uppercase">
                  Question {activeQuestionIndex + 1}
                </span>
                {studySet.questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(activeQuestion.id)}
                    className="text-brand-secondary cursor-pointer rounded-lg p-1.5 transition hover:bg-red-50 hover:text-red-600"
                    title="Remove question"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Exam Question Field (Content-aware auto-resizing, no nested scroll) */}
              <div className="w-full min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-brand-ink block text-xs font-bold">
                    Exam Question
                  </label>
                  <span className="text-brand-secondary text-[11px]">
                    Click to edit
                  </span>
                </div>
                <div className="border-brand-peach/80 bg-brand-cream/30 focus-within:border-brand-tomato w-full min-w-0 rounded-xl border p-3.5 transition focus-within:bg-white">
                  <AutoResizeTextarea
                    minRows={3}
                    value={activeQuestion.question}
                    onChange={handleQuestionTextChange}
                    className="text-brand-ink bg-transparent font-sans text-xs leading-relaxed font-medium focus:outline-none"
                    placeholder="Enter exam question..."
                  />
                </div>
              </div>

              {/* Your Original Answer Field (Content-aware auto-resizing, no clipping) */}
              <div className="w-full min-w-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-brand-ink block text-xs font-bold">
                    Your Original Answer
                  </label>
                  <span className="bg-brand-butter/60 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-amber-950">
                    From your notes
                  </span>
                </div>
                <div className="border-brand-peach/80 bg-brand-cream/30 focus-within:border-brand-tomato w-full min-w-0 rounded-xl border p-3.5 transition focus-within:bg-white">
                  <AutoResizeTextarea
                    minRows={6}
                    value={activeQuestion.referenceAnswer}
                    onChange={handleReferenceAnswerChange}
                    className="text-brand-ink bg-transparent font-sans text-xs leading-relaxed focus:outline-none"
                    placeholder="Enter the reference answer you are studying from..."
                  />
                </div>
              </div>

              {/* Source Excerpt Box */}
              {activeQuestion.sourceExcerpt && (
                <>
                  {/* Desktop excerpt: always visible */}
                  <div className="hidden w-full min-w-0 rounded-xl border border-[#FFE2D7] bg-[#FFF4EE] p-3.5 sm:block">
                    <span className="text-brand-secondary text-[10px] font-bold tracking-wider uppercase">
                      Source Excerpt (From Your Material)
                    </span>
                    <p className="text-brand-secondary mt-1 text-xs leading-relaxed break-words italic">
                      &ldquo;{activeQuestion.sourceExcerpt}&rdquo;
                    </p>
                  </div>

                  {/* Mobile excerpt: collapsible accordion */}
                  <div className="w-full min-w-0 rounded-xl border border-[#FFE2D7] bg-[#FFF4EE] p-3 sm:hidden">
                    <button
                      type="button"
                      onClick={() =>
                        setIsMobileExcerptExpanded(!isMobileExcerptExpanded)
                      }
                      className="flex w-full cursor-pointer items-center justify-between text-left"
                    >
                      <span className="text-brand-secondary text-[10px] font-bold tracking-wider uppercase">
                        Source excerpt
                      </span>
                      <ChevronDownIcon
                        className={`text-brand-secondary h-3.5 w-3.5 shrink-0 transition-transform ${
                          isMobileExcerptExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isMobileExcerptExpanded && (
                      <p className="text-brand-secondary mt-2 text-xs leading-relaxed break-words italic">
                        &ldquo;{activeQuestion.sourceExcerpt}&rdquo;
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Refresh Points Action */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleRefreshPoints}
                  disabled={isRefreshingPoints}
                  className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:border-brand-tomato hover:bg-brand-cream inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRefreshingPoints ? (
                    <>
                      <ArrowPathIcon className="text-brand-tomato h-3.5 w-3.5 animate-spin" />
                      <span>Refreshing points...</span>
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="text-brand-tomato h-3.5 w-3.5" />
                      <span>Refresh important points</span>
                    </>
                  )}
                </button>
                {refreshError && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {refreshError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Important Points to Remember (7 columns on lg) */}
          <div className="w-full min-w-0 space-y-4 lg:col-span-7">
            <div className="border-brand-peach/80 w-full min-w-0 rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
              {/* Header and Add Button */}
              <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-heading text-brand-ink text-base font-bold sm:text-lg">
                    Important points to remember
                  </h2>
                  <p className="text-brand-secondary mt-0.5 text-xs">
                    {activeRubric?.criteria.length || 0} points to cover. Retell
                    accepts paraphrasing in your own words.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingPoint(!isAddingPoint)}
                  className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:bg-brand-cream inline-flex shrink-0 cursor-pointer items-center gap-1.5 self-start rounded-xl border px-3.5 py-1.5 text-xs font-bold transition sm:self-auto"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span>Add an important point</span>
                </button>
              </div>

              {/* Category Filter Pills (Horizontal scrollable, student vocabulary) */}
              <div
                role="region"
                aria-label="Filter points by category"
                tabIndex={0}
                className="border-brand-peach/40 mt-4 flex w-full min-w-0 scrollbar-thin flex-nowrap items-center gap-1.5 overflow-x-auto border-b pb-3 focus:outline-none"
              >
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition ${
                    categoryFilter === "all"
                      ? "bg-brand-ink text-white shadow-2xs"
                      : "bg-brand-cream/70 text-brand-secondary hover:text-brand-ink"
                  }`}
                >
                  All ({activeRubric?.criteria.length || 0})
                </button>
                {(
                  Object.keys(RUBRIC_CATEGORY_META) as RubricCriterionCategory[]
                ).map((cat) => {
                  const count =
                    activeRubric?.criteria.filter((c) => c.category === cat)
                      .length || 0;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition ${
                        categoryFilter === cat
                          ? "bg-brand-ink text-white shadow-2xs"
                          : "bg-brand-cream/70 text-brand-secondary hover:text-brand-ink"
                      }`}
                    >
                      {RUBRIC_CATEGORY_META[cat].studentLabel} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Inline Add Important Point Form */}
              {isAddingPoint && (
                <form
                  onSubmit={handleAddPointSubmit}
                  className="border-brand-peach bg-brand-cream/40 mt-4 w-full min-w-0 space-y-3 rounded-xl border p-4"
                >
                  <h3 className="font-heading text-brand-ink text-xs font-bold">
                    Add an important point to remember
                  </h3>

                  <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label className="text-brand-ink mb-1 block text-[11px] font-semibold">
                        Category
                      </label>
                      <select
                        value={newPointCategory}
                        onChange={(e) =>
                          setNewPointCategory(
                            e.target.value as RubricCriterionCategory
                          )
                        }
                        className="border-brand-peach/80 text-brand-ink w-full cursor-pointer rounded-lg border bg-white px-2.5 py-1.5 text-xs focus:outline-none"
                      >
                        {(
                          Object.keys(
                            RUBRIC_CATEGORY_META
                          ) as RubricCriterionCategory[]
                        ).map((cat) => (
                          <option key={cat} value={cat}>
                            {RUBRIC_CATEGORY_META[cat].studentLabel}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="min-w-0">
                      <label className="text-brand-ink mb-1 block text-[11px] font-semibold">
                        Point Title
                      </label>
                      <input
                        type="text"
                        required
                        value={newPointName}
                        onChange={(e) => setNewPointName(e.target.value)}
                        placeholder="e.g. Recursive client request"
                        className="border-brand-peach/80 text-brand-ink w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="w-full min-w-0">
                    <label className="text-brand-ink mb-1 block text-[11px] font-semibold">
                      What needs to be remembered
                    </label>
                    <input
                      type="text"
                      required
                      value={newPointDescription}
                      onChange={(e) => setNewPointDescription(e.target.value)}
                      placeholder="Explain that the client sends a recursive DNS query to its configured resolver."
                      className="border-brand-peach/80 text-brand-ink w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="w-full min-w-0">
                    <label className="text-brand-ink mb-1 block text-[11px] font-semibold">
                      What a good answer explains (accepts your own words)
                    </label>
                    <textarea
                      rows={2}
                      value={newPointGuidance}
                      onChange={(e) => setNewPointGuidance(e.target.value)}
                      placeholder="Explains that the client does a recursive query and expects the resolver to fully resolve the name."
                      className="border-brand-peach/80 text-brand-ink w-full rounded-lg border bg-white p-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="text-brand-ink inline-flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={newPointMandatory}
                        onChange={(e) => setNewPointMandatory(e.target.checked)}
                        className="text-brand-tomato focus:ring-brand-tomato cursor-pointer rounded"
                      />
                      <span className="font-semibold">Must include</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingPoint(false)}
                        className="text-brand-secondary hover:text-brand-ink cursor-pointer rounded-lg px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-brand-tomato hover:bg-brand-tomato-hover cursor-pointer rounded-lg px-3.5 py-1 text-xs font-bold text-white shadow-2xs"
                      >
                        Add to list
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Important Point Cards List matching reference */}
              <div className="mt-4 w-full min-w-0 space-y-3">
                {filteredCriteria.length === 0 ? (
                  <div className="text-brand-secondary p-6 text-center text-xs">
                    No points in this category.
                  </div>
                ) : (
                  filteredCriteria.map((criterion) => {
                    const meta = RUBRIC_CATEGORY_META[criterion.category];
                    return (
                      <div
                        key={criterion.id}
                        className="border-brand-peach/70 hover:border-brand-peach w-full min-w-0 space-y-2.5 rounded-xl border bg-white p-3.5 shadow-2xs transition sm:p-4"
                      >
                        {/* Point Top Row: Category, Title, Controls */}
                        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span
                              className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                            >
                              {meta.studentLabel}
                            </span>

                            <input
                              type="text"
                              value={criterion.name}
                              onChange={(e) =>
                                handleUpdatePoint(criterion.id, {
                                  name: e.target.value,
                                })
                              }
                              className="font-heading text-brand-ink hover:border-brand-peach focus:border-brand-tomato w-full min-w-0 flex-1 border-b border-transparent text-xs font-bold focus:outline-none sm:text-sm"
                            />
                          </div>

                          <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
                            <label className="text-brand-secondary inline-flex cursor-pointer items-center gap-1.5 text-[11px] sm:text-xs">
                              <input
                                type="checkbox"
                                checked={criterion.isMandatory}
                                onChange={(e) =>
                                  handleUpdatePoint(criterion.id, {
                                    isMandatory: e.target.checked,
                                  })
                                }
                                className="text-brand-tomato focus:ring-brand-tomato cursor-pointer rounded"
                              />
                              <span className="font-medium">Must include</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleDeletePoint(criterion.id)}
                              className="text-brand-secondary cursor-pointer rounded p-1 transition hover:bg-red-50 hover:text-red-600"
                              title="Remove point"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description (auto-resizing, no clipped line) */}
                        <div className="w-full min-w-0">
                          <AutoResizeTextarea
                            minRows={1}
                            value={criterion.description}
                            onChange={(val) =>
                              handleUpdatePoint(criterion.id, {
                                description: val,
                              })
                            }
                            className="text-brand-secondary hover:border-brand-peach focus:border-brand-tomato border-b border-transparent text-xs leading-relaxed focus:outline-none"
                            placeholder="Explanation of this point..."
                          />
                        </div>

                        {/* What a Good Answer Explains Guidance Box */}
                        <div className="border-brand-peach/40 bg-brand-cream/60 w-full min-w-0 rounded-xl border p-3">
                          <span className="text-brand-secondary block text-[10px] font-bold tracking-wider uppercase">
                            What a good answer explains (accepts your own
                            words):
                          </span>
                          <AutoResizeTextarea
                            minRows={2}
                            value={criterion.satisfactoryDemonstration}
                            onChange={(val) =>
                              handleUpdatePoint(criterion.id, {
                                satisfactoryDemonstration: val,
                              })
                            }
                            className="text-brand-ink hover:border-brand-peach focus:border-brand-tomato mt-1 rounded border border-transparent bg-transparent text-xs leading-relaxed focus:bg-white focus:outline-none"
                            placeholder="Describe how a student can satisfactorily explain this in their own words..."
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Questions from PDF or Images Modal */}
      <ImportQuestionsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        studySet={studySet}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
