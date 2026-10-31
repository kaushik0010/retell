"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudySet, ExtractedQuestion } from "@/lib/domain/study-set";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";
import { checkScopeCompatibility } from "@/lib/domain/attempt-comparison";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronRightIcon,
  PlayIcon,
  SparklesIcon,
} from "@/components/icons";

interface AttemptHistoryViewProps {
  studySet: StudySet;
  attempts: PracticeAttempt[];
  audits: Record<string, SemanticAuditResult>;
  initialQuestionId?: string;
}

export function AttemptHistoryView({
  studySet,
  attempts,
  audits,
  initialQuestionId,
}: AttemptHistoryViewProps) {
  const router = useRouter();

  // Active question state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    initialQuestionId || studySet.questions[0]?.id || ""
  );

  // Selected attempts for comparison (max 2)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [scopeFilter, setScopeFilter] = useState<string>("all");

  const activeQuestion: ExtractedQuestion | undefined =
    studySet.questions.find((q) => q.id === selectedQuestionId) ||
    studySet.questions[0];

  // Filter attempts for active question
  const questionAttempts = useMemo(() => {
    return attempts
      .filter((a) => a.questionId === selectedQuestionId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }, [attempts, selectedQuestionId]);

  // Filter by scope if requested
  const filteredAttempts = useMemo(() => {
    if (scopeFilter === "all") return questionAttempts;
    if (scopeFilter === "whole_answer") {
      return questionAttempts.filter(
        (a) => !a.scope || a.scope === "whole_answer"
      );
    }
    // paragraph:0, paragraph:1, etc.
    if (scopeFilter.startsWith("paragraph_")) {
      const idx = parseInt(scopeFilter.replace("paragraph_", ""), 10);
      return questionAttempts.filter(
        (a) => a.scope === "paragraph" && a.paragraphIndex === idx
      );
    }
    return questionAttempts;
  }, [questionAttempts, scopeFilter]);

  // Extract distinct paragraph options for filter
  const paragraphCount = useMemo(() => {
    if (!activeQuestion) return 0;
    const parts = activeQuestion.referenceAnswer
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    return parts.length;
  }, [activeQuestion]);

  // Selection toggle for comparison
  const handleToggleCompare = (attemptId: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(attemptId)) {
        return prev.filter((id) => id !== attemptId);
      }
      if (prev.length >= 2) {
        // Replace oldest selection
        return [prev[1]!, attemptId];
      }
      return [...prev, attemptId];
    });
  };

  // Check compatibility of the 2 selected attempts
  const compareCompatibility = useMemo(() => {
    if (selectedForCompare.length !== 2) return null;
    const attA = attempts.find((a) => a.id === selectedForCompare[0]);
    const attB = attempts.find((a) => a.id === selectedForCompare[1]);
    if (!attA || !attB) return null;
    return checkScopeCompatibility(attA, attB);
  }, [selectedForCompare, attempts]);

  const handleLaunchComparison = () => {
    if (selectedForCompare.length === 2 && compareCompatibility?.compatible) {
      router.push(
        `/study/${studySet.id}/compare?a=${selectedForCompare[0]}&b=${selectedForCompare[1]}`
      );
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/review/${studySet.id}`}
          className="text-brand-secondary hover:text-brand-ink inline-flex items-center gap-1.5 text-xs font-semibold transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to study set points</span>
        </Link>

        <Link
          href={`/study/${studySet.id}/practice?questionId=${selectedQuestionId}`}
          className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-1.5 self-start rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition sm:self-auto"
        >
          <PlayIcon className="h-3.5 w-3.5" />
          <span>Practise this question</span>
        </Link>
      </div>

      {/* Main Info Card */}
      <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-2">
          <span className="bg-brand-cream text-brand-tomato rounded-lg px-2.5 py-1 text-xs font-bold">
            Learning History
          </span>
          <span className="text-brand-secondary text-xs">
            {studySet.material.title}
          </span>
        </div>

        {/* Question Selector if multiple questions */}
        {studySet.questions.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 border-b border-stone-100 pb-3">
            {studySet.questions.map((q, idx) => (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setSelectedQuestionId(q.id);
                  setSelectedForCompare([]);
                }}
                className={`cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  q.id === selectedQuestionId
                    ? "bg-brand-tomato text-white shadow-2xs"
                    : "bg-brand-cream/60 text-brand-secondary hover:text-brand-ink"
                }`}
              >
                Question {idx + 1}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3">
          <h1 className="font-heading text-brand-ink text-lg font-bold sm:text-xl">
            {activeQuestion?.question || "Practice Attempts"}
          </h1>
          <p className="text-brand-secondary mt-1 text-xs">
            {questionAttempts.length === 1
              ? "1 practice attempt saved locally"
              : `${questionAttempts.length} practice attempts saved locally`}
          </p>
        </div>

        {/* Scope Filter Tabs */}
        {paragraphCount > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-brand-secondary text-xs">Scope:</span>
            <button
              type="button"
              onClick={() => setScopeFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                scopeFilter === "all"
                  ? "bg-brand-ink text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              All ({questionAttempts.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter("whole_answer")}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                scopeFilter === "whole_answer"
                  ? "bg-brand-ink text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              Whole Answer
            </button>
            {Array.from({ length: paragraphCount }).map((_, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => setScopeFilter(`paragraph_${pIdx}`)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                  scopeFilter === `paragraph_${pIdx}`
                    ? "bg-brand-ink text-white"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                Paragraph {pIdx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating Comparison Selection Bar */}
      {selectedForCompare.length > 0 && (
        <div className="border-brand-peach/80 sticky top-4 z-20 flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-brand-butter text-brand-ink flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold">
              {selectedForCompare.length}
            </span>
            <div className="text-xs">
              <p className="font-bold text-stone-900">
                {selectedForCompare.length === 1
                  ? "Select one more attempt to compare"
                  : "2 attempts selected"}
              </p>
              {compareCompatibility && !compareCompatibility.compatible && (
                <p className="font-medium text-rose-700">
                  {compareCompatibility.reason}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedForCompare([])}
              className="text-brand-secondary hover:text-brand-ink rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Clear
            </button>

            <button
              type="button"
              disabled={
                selectedForCompare.length !== 2 ||
                !compareCompatibility?.compatible
              }
              onClick={handleLaunchComparison}
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              <span>Compare Progress</span>
            </button>
          </div>
        </div>
      )}

      {/* Attempts List */}
      {filteredAttempts.length === 0 ? (
        <div className="border-brand-peach flex flex-col items-center justify-center rounded-2xl border border-dashed bg-white/70 p-12 text-center">
          <div className="bg-brand-cream text-brand-tomato flex h-12 w-12 items-center justify-center rounded-2xl">
            <BookOpenIcon className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-brand-ink mt-3 text-sm font-bold">
            No practice attempts recorded yet
          </h3>
          <p className="text-brand-secondary mt-1 max-w-sm text-xs">
            Rehearse this exam answer aloud in the Practice Room to evaluate
            your conceptual recall and build your learning history.
          </p>
          <div className="mt-4">
            <Link
              href={`/study/${studySet.id}/practice?questionId=${selectedQuestionId}`}
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition"
            >
              <PlayIcon className="h-3.5 w-3.5" />
              <span>Start your first attempt</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAttempts.map((attempt, idx) => {
            const audit = audits[attempt.id];
            const isSelected = selectedForCompare.includes(attempt.id);
            const isLatest = idx === 0 && scopeFilter === "all";

            // Find preceding attempt with same scope if available
            const precedingAttempt = filteredAttempts
              .slice(idx + 1)
              .find((other) => {
                const res = checkScopeCompatibility(attempt, other);
                return res.compatible;
              });

            const coveredCount = audit?.overall.coveredCount ?? 0;
            const totalCriteria =
              audit?.overall.totalCriteria ||
              studySet.rubrics[selectedQuestionId]?.criteria.length ||
              0;

            return (
              <div
                key={attempt.id}
                className={`border-brand-peach/80 relative rounded-2xl border bg-white p-5 shadow-xs transition hover:shadow-sm ${
                  isSelected ? "ring-brand-tomato bg-brand-cream/20 ring-2" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    {/* Compare Selection Checkbox */}
                    <input
                      type="checkbox"
                      id={`compare_${attempt.id}`}
                      checked={isSelected}
                      onChange={() => handleToggleCompare(attempt.id)}
                      className="accent-brand-tomato mt-1 h-4 w-4 cursor-pointer rounded"
                      aria-label={`Select attempt from ${formatDate(attempt.createdAt)} for comparison`}
                    />

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isLatest && (
                          <span className="bg-brand-tomato rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                            Latest Attempt
                          </span>
                        )}

                        <span className="bg-brand-cream text-brand-secondary border-brand-peach/60 rounded-md border px-2 py-0.5 text-[11px] font-bold">
                          {attempt.scope === "paragraph"
                            ? `Paragraph ${(attempt.paragraphIndex ?? 0) + 1}${
                                attempt.totalParagraphs
                                  ? ` of ${attempt.totalParagraphs}`
                                  : ""
                              }`
                            : "Whole Answer"}
                        </span>

                        <span className="text-brand-secondary text-xs">
                          {formatDate(attempt.createdAt)}
                        </span>
                      </div>

                      {/* Transcript snippet */}
                      <p className="text-brand-ink mt-2.5 line-clamp-2 text-xs leading-relaxed italic">
                        {attempt.transcript
                          ? `"${attempt.transcript}"`
                          : "No words spoken."}
                      </p>

                      {/* Stat Metrics */}
                      <div className="text-brand-secondary mt-3 flex flex-wrap items-center gap-3 text-xs">
                        <span>{attempt.wordCount} words</span>
                        <span>•</span>
                        <span>{formatDuration(attempt.durationSeconds)}</span>
                        <span>•</span>
                        {audit ? (
                          <span className="font-bold text-emerald-800">
                            {coveredCount} of {totalCriteria} concepts covered
                          </span>
                        ) : (
                          <span className="font-medium text-amber-800">
                            Evaluation pending
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    {precedingAttempt && (
                      <Link
                        href={`/study/${studySet.id}/compare?a=${precedingAttempt.id}&b=${attempt.id}`}
                        className="border-brand-peach/80 hover:bg-brand-cream/60 text-brand-secondary hover:text-brand-ink inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
                      >
                        <SparklesIcon className="h-3 w-3" />
                        <span>Compare with previous</span>
                      </Link>
                    )}

                    <Link
                      href={`/study/${studySet.id}/attempts/${attempt.id}`}
                      className="bg-brand-cream hover:bg-brand-peach/60 text-brand-tomato inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition"
                    >
                      <span>Review feedback</span>
                      <ChevronRightIcon className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
