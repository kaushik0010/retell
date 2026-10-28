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
} from "@/components/icons";

interface SourceReviewViewProps {
  initialStudySet: StudySet;
  onBack?: () => void;
  onSaved?: (updatedSet: StudySet) => void;
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
      className={`w-full resize-none overflow-hidden ${className || ""}`}
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
  const [saveStatus, setSaveStatus] = useState<"clean" | "dirty" | "saving">(
    "clean"
  );
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

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

  // Protect against accidental navigation with unsaved edits
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === "dirty") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveStatus]);

  const activeQuestionIndex = studySet.questions.findIndex(
    (q) => q.id === selectedQuestionId
  );
  const activeQuestion: ExtractedQuestion | undefined =
    studySet.questions[activeQuestionIndex] || studySet.questions[0];

  const activeRubric: QuestionRubric | undefined = activeQuestion
    ? studySet.rubrics[activeQuestion.id]
    : undefined;

  const markDirty = () => {
    if (saveStatus !== "dirty") {
      setSaveStatus("dirty");
    }
  };

  // Save changes to IndexedDB
  const handleSave = async (setToSave: StudySet = studySet) => {
    setSaveStatus("saving");
    try {
      const updated: StudySet = {
        ...setToSave,
        updatedAt: new Date().toISOString(),
      };
      await saveStudySet(updated);
      setStudySet(updated);
      setSaveStatus("clean");
      setSaveFeedback("Saved to browser");
      setTimeout(() => setSaveFeedback(null), 3000);
      if (onSaved) {
        onSaved(updated);
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveFeedback("Failed to save changes");
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
    markDirty();
  };

  // Question and answer edits
  const handleQuestionTextChange = (newQuestion: string) => {
    if (!activeQuestion) return;
    const updatedQuestions = studySet.questions.map((q) =>
      q.id === activeQuestion.id ? { ...q, question: newQuestion } : q
    );
    setStudySet({ ...studySet, questions: updatedQuestions });
    markDirty();
  };

  const handleReferenceAnswerChange = (newAnswer: string) => {
    if (!activeQuestion) return;
    const updatedQuestions = studySet.questions.map((q) =>
      q.id === activeQuestion.id ? { ...q, referenceAnswer: newAnswer } : q
    );
    setStudySet({ ...studySet, questions: updatedQuestions });
    markDirty();
  };

  // Add question
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
    markDirty();
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
    markDirty();
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
    markDirty();
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
    markDirty();
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
    markDirty();
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
    <div className="space-y-6">
      {/* Top action & status bar matching reference */}
      <div className="border-brand-peach/80 flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/library"
            onClick={onBack}
            className="border-brand-peach/80 bg-brand-cream/60 text-brand-ink hover:bg-brand-peach/40 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition"
            title="Back to library"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-2">
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
                className="border-brand-tomato text-brand-ink rounded-lg border bg-white px-2.5 py-1 text-sm font-bold focus:outline-none"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-brand-ink text-base font-bold sm:text-lg">
                  {studySet.material.title}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-brand-secondary hover:text-brand-ink cursor-pointer rounded p-1"
                  title="Rename title"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveFeedback && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
              <CheckIcon className="h-3.5 w-3.5" />
              <span>{saveFeedback}</span>
            </span>
          )}

          {saveStatus === "dirty" && !saveFeedback && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
              Changes not saved
            </span>
          )}

          {saveStatus === "clean" && !saveFeedback && (
            <span className="border-brand-peach/60 bg-brand-cream/80 text-brand-secondary hidden rounded-full border px-3 py-1 text-xs font-medium sm:inline-block">
              Saved to browser
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saveStatus === "saving"}
            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveStatus === "saving" ? (
              <>
                <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckIcon className="h-3.5 w-3.5" />
                <span>Save study set</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Ready to Practise Explaining Aloud Banner matching reference */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#F5D96B]/80 bg-gradient-to-r from-[#FFF8E1] to-[#FFF1D6] p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="bg-brand-butter flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl shadow-2xs">
            🎙️
          </div>
          <div>
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
          className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 self-start rounded-xl px-4 text-xs font-bold text-white shadow-xs transition sm:self-auto"
        >
          <span>Start practising</span>
          <span>&rarr;</span>
        </button>
      </div>

      {/* Collapsible Source Material Accordion */}
      <div className="border-brand-peach/80 overflow-hidden rounded-2xl border bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setIsSourceExpanded(!isSourceExpanded)}
          className="hover:bg-brand-cream/30 flex w-full cursor-pointer items-center justify-between p-4 text-left transition sm:px-6"
        >
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="text-brand-tomato h-4 w-4" />
            <span className="font-heading text-brand-ink text-xs font-bold sm:text-sm">
              Original Notes &amp; Source Text
            </span>
            <span className="bg-brand-cream text-brand-secondary rounded-full px-2 py-0.5 text-[10px] font-medium">
              {studySet.material.characterCount.toLocaleString()} chars
            </span>
          </div>
          <ChevronDownIcon
            className={`text-brand-secondary h-4 w-4 transition-transform duration-200 ${
              isSourceExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isSourceExpanded && (
          <div className="border-brand-peach/40 bg-brand-cream/20 border-t p-4 sm:p-6">
            <div className="border-brand-peach/40 text-brand-secondary max-h-64 overflow-y-auto rounded-xl border bg-white p-4 font-sans text-xs leading-relaxed whitespace-pre-wrap">
              {studySet.material.sourceText}
            </div>
          </div>
        )}
      </div>

      {/* Questions Selector Bar */}
      <div>
        {/* Desktop Question Pills */}
        <div className="border-brand-peach/60 hidden flex-wrap items-center gap-2 border-b pb-3 sm:flex">
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

          <button
            type="button"
            onClick={handleAddQuestion}
            className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:bg-brand-cream inline-flex cursor-pointer items-center gap-1 rounded-xl border border-dashed px-3 py-2 text-xs font-semibold transition"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span>Add Question</span>
          </button>
        </div>

        {/* Mobile Question Navigator matching reference */}
        <div className="border-brand-peach/60 space-y-2 border-b pb-3 sm:hidden">
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
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMobileDropdownOpen(!isMobileDropdownOpen)}
              className="bg-brand-tomato flex w-full cursor-pointer items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-2xs"
            >
              <span className="truncate">
                {activeQuestionIndex + 1}. {activeQuestion?.question}
              </span>
              <ChevronDownIcon
                className={`h-4 w-4 shrink-0 transition-transform ${
                  isMobileDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isMobileDropdownOpen && (
              <div className="border-brand-peach/80 absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-white p-2 shadow-lg">
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
                <button
                  type="button"
                  onClick={() => {
                    handleAddQuestion();
                    setIsMobileDropdownOpen(false);
                  }}
                  className="border-brand-peach/40 text-brand-tomato hover:bg-brand-cream mt-1 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border-t px-3 pt-2 text-left text-xs font-bold"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span>+ Add Question</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout (Left: Q&A, Right: Important Points) */}
      {activeQuestion && (
        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* Left Column: Question & Reference Answer (5 columns on lg) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="border-brand-peach/80 space-y-4 rounded-2xl border bg-white p-5 shadow-xs">
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-brand-ink block text-xs font-bold">
                    Exam Question
                  </label>
                  <span className="text-brand-secondary text-[11px]">
                    Click to edit
                  </span>
                </div>
                <div className="border-brand-peach/80 bg-brand-cream/30 focus-within:border-brand-tomato rounded-xl border p-3.5 transition focus-within:bg-white">
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-brand-ink block text-xs font-bold">
                    Your Original Answer
                  </label>
                  <span className="bg-brand-butter/60 rounded-full px-2.5 py-0.5 text-[10px] font-bold text-amber-950">
                    From your notes
                  </span>
                </div>
                <div className="border-brand-peach/80 bg-brand-cream/30 focus-within:border-brand-tomato rounded-xl border p-3.5 transition focus-within:bg-white">
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
                  <div className="hidden rounded-xl border border-[#FFE2D7] bg-[#FFF4EE] p-3.5 sm:block">
                    <span className="text-brand-secondary text-[10px] font-bold tracking-wider uppercase">
                      Source Excerpt (From Your Material)
                    </span>
                    <p className="text-brand-secondary mt-1 text-xs leading-relaxed italic">
                      &ldquo;{activeQuestion.sourceExcerpt}&rdquo;
                    </p>
                  </div>

                  {/* Mobile excerpt: collapsible accordion */}
                  <div className="rounded-xl border border-[#FFE2D7] bg-[#FFF4EE] p-3 sm:hidden">
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
                        className={`text-brand-secondary h-3.5 w-3.5 transition-transform ${
                          isMobileExcerptExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isMobileExcerptExpanded && (
                      <p className="text-brand-secondary mt-2 text-xs leading-relaxed italic">
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
          <div className="space-y-4 lg:col-span-7">
            <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs">
              {/* Header and Add Button */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
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
                  className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:bg-brand-cream inline-flex cursor-pointer items-center gap-1.5 self-start rounded-xl border px-3.5 py-1.5 text-xs font-bold transition sm:self-auto"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span>Add an important point</span>
                </button>
              </div>

              {/* Category Filter Pills (Horizontal scrollable, student vocabulary) */}
              <div className="border-brand-peach/40 mt-4 flex scrollbar-thin flex-nowrap items-center gap-1.5 overflow-x-auto border-b pb-3">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition ${
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
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition ${
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
                  className="border-brand-peach bg-brand-cream/40 mt-4 space-y-3 rounded-xl border p-4"
                >
                  <h3 className="font-heading text-brand-ink text-xs font-bold">
                    Add an important point to remember
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
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

                    <div>
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

                  <div>
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

                  <div>
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
              <div className="mt-4 space-y-3">
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
                        className="border-brand-peach/70 hover:border-brand-peach space-y-2.5 rounded-xl border bg-white p-4 shadow-2xs transition"
                      >
                        {/* Point Top Row: Category, Title, Controls */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-1 flex-wrap items-center gap-2">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
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
                              className="font-heading text-brand-ink hover:border-brand-peach focus:border-brand-tomato flex-1 border-b border-transparent text-xs font-bold focus:outline-none sm:text-sm"
                            />
                          </div>

                          <div className="flex shrink-0 items-center gap-2.5">
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
                        <div>
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
                        <div className="border-brand-peach/40 bg-brand-cream/60 rounded-xl border p-3">
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
    </div>
  );
}
