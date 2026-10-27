"use client";

import React, { useState } from "react";
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
} from "@/components/icons";

interface SourceReviewViewProps {
  initialStudySet: StudySet;
  onBack?: () => void;
  onSaved?: (updatedSet: StudySet) => void;
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
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"clean" | "dirty" | "saving">(
    "clean"
  );
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Adding new important point state
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

  // Question editing
  const handleQuestionTextChange = (text: string) => {
    if (!activeQuestion) return;
    const updatedQuestions = studySet.questions.map((q) =>
      q.id === activeQuestion.id ? { ...q, question: text } : q
    );
    setStudySet({
      ...studySet,
      questions: updatedQuestions,
    });
    markDirty();
  };

  const handleReferenceAnswerChange = (ans: string) => {
    if (!activeQuestion) return;
    const updatedQuestions = studySet.questions.map((q) =>
      q.id === activeQuestion.id ? { ...q, referenceAnswer: ans } : q
    );
    setStudySet({
      ...studySet,
      questions: updatedQuestions,
    });
    markDirty();
  };

  // Add a new question manually
  const handleAddQuestion = () => {
    const newId = `q_${crypto.randomUUID()}`;
    const newQ: ExtractedQuestion = {
      id: newId,
      studyMaterialId: studySet.material.id,
      orderIndex: studySet.questions.length,
      question: "New practice question",
      referenceAnswer: "Answer from your notes or textbook.",
      sourceExcerpt: "",
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

  // Delete current question
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

  const handleAddPointSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuestion || !activeRubric) return;
    if (!newPointName.trim() || !newPointDescription.trim()) return;

    const newPoint: RubricCriterion = {
      id: `crit_${crypto.randomUUID()}`,
      category: newPointCategory,
      name: newPointName.trim(),
      description: newPointDescription.trim(),
      satisfactoryDemonstration:
        newPointGuidance.trim() ||
        "Student explains this concept clearly in their own words.",
      isMandatory: newPointMandatory,
      orderIndex: activeRubric.criteria.length,
    };

    const updatedRubric: QuestionRubric = {
      ...activeRubric,
      criteria: [...activeRubric.criteria, newPoint],
      updatedAt: new Date().toISOString(),
    };

    setStudySet({
      ...studySet,
      rubrics: {
        ...studySet.rubrics,
        [activeQuestion.id]: updatedRubric,
      },
    });

    setIsAddingPoint(false);
    setNewPointName("");
    setNewPointDescription("");
    setNewPointGuidance("");
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

  // Filter criteria by category
  const filteredCriteria = activeRubric
    ? categoryFilter === "all"
      ? activeRubric.criteria
      : activeRubric.criteria.filter((c) => c.category === categoryFilter)
    : [];

  return (
    <div className="space-y-6">
      {/* Top action & status bar */}
      <div className="border-brand-peach/80 flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/library"
            onClick={onBack}
            className="border-brand-peach/60 bg-brand-cream/60 text-brand-ink hover:bg-brand-peach/40 inline-flex h-9 w-9 items-center justify-center rounded-xl border transition"
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
                className="border-brand-tomato text-brand-ink rounded-lg border bg-white px-2 py-1 text-sm font-bold focus:outline-none"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-brand-ink text-base font-bold sm:text-lg">
                  {studySet.material.title}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="text-brand-secondary hover:text-brand-ink rounded p-1"
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
            <span className="text-xs font-semibold text-amber-700">
              Changes not saved
            </span>
          )}

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saveStatus === "saving"}
            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-bold text-white shadow-xs transition disabled:opacity-50"
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

      {/* Spoken Practice Room Milestone Banner */}
      <div className="border-brand-peach/80 bg-brand-cream/60 flex items-center justify-between rounded-2xl border p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="bg-brand-butter flex h-8 w-8 items-center justify-center rounded-xl text-base">
            🎙️
          </span>
          <div>
            <h2 className="text-brand-ink text-xs font-bold">
              Ready to practise explaining aloud?
            </h2>
            <p className="text-brand-secondary text-[11px]">
              The Spoken Practice Room with live speech transcription unlocks in
              Day 3. Review and refine your points below.
            </p>
          </div>
        </div>

        <span className="bg-brand-peach/80 text-brand-tomato hidden rounded-full px-3 py-1 text-[10px] font-bold sm:inline-flex">
          Practice Room • Day 3
        </span>
      </div>

      {/* Collapsible Source Material Accordion */}
      <div className="border-brand-peach/80 overflow-hidden rounded-2xl border bg-white shadow-xs">
        <button
          type="button"
          onClick={() => setIsSourceExpanded(!isSourceExpanded)}
          className="hover:bg-brand-cream/30 flex w-full items-center justify-between p-4 text-left transition sm:px-6"
        >
          <div className="flex items-center gap-3">
            <span className="font-heading text-brand-ink text-xs font-bold">
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
            <div className="border-brand-peach/40 text-brand-secondary max-h-60 overflow-y-auto rounded-xl border bg-white p-4 font-sans text-xs leading-relaxed whitespace-pre-wrap">
              {studySet.material.sourceText}
            </div>
          </div>
        )}
      </div>

      {/* Questions Tabs matching reference image 1 */}
      <div className="border-brand-peach/60 flex flex-wrap items-center gap-2 border-b pb-3">
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
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                isSelected
                  ? "bg-brand-tomato text-white shadow-2xs"
                  : "border-brand-peach/60 text-brand-ink hover:bg-brand-cream border bg-white"
              }`}
            >
              <span>
                {idx + 1}. {q.question.slice(0, 24)}...
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={handleAddQuestion}
          className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:bg-brand-cream inline-flex items-center gap-1 rounded-xl border border-dashed px-3 py-1.5 text-xs font-semibold transition"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          <span>Add Question</span>
        </button>
      </div>

      {activeQuestion && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Question & Reference Answer (5 cols on lg) */}
          <div className="space-y-4 lg:col-span-5">
            <div className="border-brand-peach/80 space-y-4 rounded-2xl border bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-brand-tomato text-xs font-bold tracking-wider uppercase">
                  Question {activeQuestionIndex + 1}
                </span>
                {studySet.questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(activeQuestion.id)}
                    className="text-brand-secondary rounded-lg p-1 transition hover:bg-red-50 hover:text-red-600"
                    title="Remove question"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Question Text */}
              <div>
                <label className="text-brand-ink mb-1 block text-xs font-bold">
                  Exam Question Prompt
                </label>
                <textarea
                  rows={3}
                  value={activeQuestion.question}
                  onChange={(e) => handleQuestionTextChange(e.target.value)}
                  className="border-brand-peach/80 bg-brand-cream/30 text-brand-ink focus:border-brand-tomato w-full rounded-xl border p-3 font-sans text-xs font-medium focus:bg-white focus:outline-none"
                />
              </div>

              {/* Reference Answer */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-brand-ink block text-xs font-bold">
                    Your Original Answer
                  </label>
                  <span className="bg-brand-butter/50 text-brand-ink rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    From your notes
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={activeQuestion.referenceAnswer}
                  onChange={(e) => handleReferenceAnswerChange(e.target.value)}
                  className="border-brand-peach/80 bg-brand-cream/30 text-brand-ink focus:border-brand-tomato w-full rounded-xl border p-3 font-sans text-xs leading-relaxed focus:bg-white focus:outline-none"
                />
              </div>

              {/* Source Excerpt */}
              {activeQuestion.sourceExcerpt && (
                <div className="border-brand-peach/60 bg-brand-cream/50 rounded-xl border p-3">
                  <span className="text-brand-secondary text-[10px] font-bold tracking-wider uppercase">
                    From your material:
                  </span>
                  <p className="text-brand-secondary mt-1 text-xs italic">
                    &ldquo;{activeQuestion.sourceExcerpt}&rdquo;
                  </p>
                </div>
              )}

              {/* Refresh Points Action */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleRefreshPoints}
                  disabled={isRefreshingPoints}
                  className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:bg-brand-cream hover:border-brand-tomato inline-flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition disabled:opacity-50"
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

          {/* Right Column: Important Points to Remember (7 cols on lg) */}
          <div className="space-y-4 lg:col-span-7">
            <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-heading text-brand-ink text-sm font-bold sm:text-base">
                    Important points to remember
                  </h2>
                  <p className="text-brand-secondary text-[11px]">
                    {activeRubric?.criteria.length || 0} points to cover. Retell
                    accepts paraphrasing in your own words.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddingPoint(!isAddingPoint)}
                  className="border-brand-peach bg-brand-cream/60 text-brand-ink hover:bg-brand-cream inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  <span>Add an important point</span>
                </button>
              </div>

              {/* Category Filter Pills using student vocabulary */}
              <div className="border-brand-peach/40 mt-4 flex flex-wrap gap-1.5 border-b pb-3">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    categoryFilter === "all"
                      ? "bg-brand-ink text-white"
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
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                        categoryFilter === cat
                          ? "bg-brand-ink text-white"
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
                        className="border-brand-peach/80 text-brand-ink w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs focus:outline-none"
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
                        placeholder="e.g. Belady's Anomaly in FIFO"
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
                      placeholder="Explain that increasing frames in FIFO can increase page faults."
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
                      placeholder="Student mentions that more memory can paradoxically cause more faults in FIFO."
                      className="border-brand-peach/80 text-brand-ink w-full rounded-lg border bg-white p-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="text-brand-ink inline-flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={newPointMandatory}
                        onChange={(e) => setNewPointMandatory(e.target.checked)}
                        className="text-brand-tomato focus:ring-brand-tomato rounded"
                      />
                      <span className="font-semibold">Must include</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingPoint(false)}
                        className="text-brand-secondary hover:text-brand-ink rounded-lg px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-brand-tomato hover:bg-brand-tomato-hover rounded-lg px-3 py-1 text-xs font-bold text-white shadow-2xs"
                      >
                        Add to list
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Criteria Cards List using student vocabulary */}
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
                        className="border-brand-peach/70 hover:border-brand-peach rounded-xl border bg-white p-4 transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
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
                              className="font-heading text-brand-ink hover:border-brand-peach focus:border-brand-tomato border-b border-transparent text-xs font-bold focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="text-brand-secondary inline-flex cursor-pointer items-center gap-1.5 text-[11px]">
                              <input
                                type="checkbox"
                                checked={criterion.isMandatory}
                                onChange={(e) =>
                                  handleUpdatePoint(criterion.id, {
                                    isMandatory: e.target.checked,
                                  })
                                }
                                className="text-brand-tomato focus:ring-brand-tomato rounded"
                              />
                              <span>Must include</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleDeletePoint(criterion.id)}
                              className="text-brand-secondary rounded p-1 transition hover:bg-red-50 hover:text-red-600"
                              title="Remove point"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="mt-2">
                          <input
                            type="text"
                            value={criterion.description}
                            onChange={(e) =>
                              handleUpdatePoint(criterion.id, {
                                description: e.target.value,
                              })
                            }
                            className="text-brand-secondary hover:border-brand-peach focus:border-brand-tomato w-full border-b border-transparent text-xs focus:outline-none"
                          />
                        </div>

                        {/* Satisfactory Demonstration Guidance */}
                        <div className="border-brand-peach/50 bg-brand-cream/30 mt-2.5 rounded-lg border p-2.5">
                          <span className="text-brand-secondary block text-[10px] font-bold tracking-wider uppercase">
                            What a good answer explains (accepts your own
                            words):
                          </span>
                          <textarea
                            rows={2}
                            value={criterion.satisfactoryDemonstration}
                            onChange={(e) =>
                              handleUpdatePoint(criterion.id, {
                                satisfactoryDemonstration: e.target.value,
                              })
                            }
                            className="text-brand-ink hover:border-brand-peach focus:border-brand-tomato mt-1 w-full rounded border border-transparent bg-transparent text-[11px] leading-relaxed focus:bg-white focus:outline-none"
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
