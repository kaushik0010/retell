"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudySet, ExtractedQuestion } from "@/lib/domain/study-set";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import { SemanticAuditResult } from "@/lib/domain/semantic-audit";
import { checkScopeCompatibility } from "@/lib/domain/attempt-comparison";
import { extractParagraphs } from "@/lib/domain/paragraph-scope";
import { deletePracticeAttempt } from "@/lib/storage/study-store";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  PlayIcon,
  ClockIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ScaleIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from "@/components/icons";

interface AttemptHistoryViewProps {
  studySet: StudySet;
  attempts: PracticeAttempt[];
  audits: Record<string, SemanticAuditResult>;
  initialQuestionId?: string;
}

export function AttemptHistoryView({
  studySet,
  attempts: initialAttempts,
  audits,
  initialQuestionId,
}: AttemptHistoryViewProps) {
  const router = useRouter();

  // Local state for attempts so user can delete attempts in-place
  const [attemptsList, setAttemptsList] =
    useState<PracticeAttempt[]>(initialAttempts);

  // Active question state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(
    initialQuestionId || studySet.questions[0]?.id || ""
  );

  // Multi-select for custom attempt comparison (max 2)
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);

  // Scope filter: "all" | "whole_answer" | "paragraph-0" | "paragraph-1" etc.
  const [scopeFilter, setScopeFilter] = useState<string>("all");

  // Sort order: "newest" | "oldest"
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Active kebab menu state for delete
  const [openMenuAttemptId, setOpenMenuAttemptId] = useState<string | null>(
    null
  );
  const [attemptToDelete, setAttemptToDelete] =
    useState<PracticeAttempt | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Current question index and active question
  const questionIndex = useMemo(() => {
    const idx = studySet.questions.findIndex(
      (q) => q.id === selectedQuestionId
    );
    return idx >= 0 ? idx : 0;
  }, [studySet.questions, selectedQuestionId]);

  const activeQuestion: ExtractedQuestion =
    studySet.questions[questionIndex] || studySet.questions[0]!;

  // Extracted paragraphs from the reference answer
  const paragraphs = useMemo(() => {
    if (!activeQuestion) return [];
    return extractParagraphs(activeQuestion.referenceAnswer);
  }, [activeQuestion]);

  // Question criteria for baseline counts
  const totalQuestionCriteria = useMemo(() => {
    if (!activeQuestion) return 4;
    return studySet.rubrics[activeQuestion.id]?.criteria.length || 4;
  }, [studySet.rubrics, activeQuestion]);

  // All attempts for this active question, chronological order (oldest to newest)
  const chronologicalQuestionAttempts = useMemo(() => {
    if (!activeQuestion) return [];
    return attemptsList
      .filter((a) => a.questionId === activeQuestion.id)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  }, [attemptsList, activeQuestion]);

  // Attempt number map based on chronological order (Attempt 1, Attempt 2, ...)
  const attemptNumberMap = useMemo(() => {
    const map = new Map<string, number>();
    chronologicalQuestionAttempts.forEach((att, idx) => {
      map.set(att.id, idx + 1);
    });
    return map;
  }, [chronologicalQuestionAttempts]);

  // Available scopes for the active question:
  // All, Whole Answer, and each Paragraph if paragraphs exist
  const availableScopes = useMemo(() => {
    if (!activeQuestion) return [];
    const scopes: { id: string; label: string; count: number }[] = [];

    // All count
    scopes.push({
      id: "all",
      label: "All",
      count: chronologicalQuestionAttempts.length,
    });

    // Whole Answer count
    const wholeCount = chronologicalQuestionAttempts.filter(
      (a) => !a.scope || a.scope === "whole_answer"
    ).length;
    scopes.push({
      id: "whole_answer",
      label: "Whole Answer",
      count: wholeCount,
    });

    // Paragraph counts
    paragraphs.forEach((_, pIdx) => {
      const pCount = chronologicalQuestionAttempts.filter(
        (a) => a.scope === "paragraph" && a.paragraphIndex === pIdx
      ).length;
      scopes.push({
        id: `paragraph-${pIdx}`,
        label: `Paragraph ${pIdx + 1}`,
        count: pCount,
      });
    });

    return scopes;
  }, [activeQuestion, paragraphs, chronologicalQuestionAttempts]);

  // Filtered and sorted attempts to display
  const displayedAttempts = useMemo(() => {
    let filtered = chronologicalQuestionAttempts;

    if (scopeFilter === "whole_answer") {
      filtered = filtered.filter((a) => !a.scope || a.scope === "whole_answer");
    } else if (scopeFilter.startsWith("paragraph-")) {
      const pIdx = parseInt(scopeFilter.replace("paragraph-", ""), 10);
      filtered = filtered.filter(
        (a) => a.scope === "paragraph" && a.paragraphIndex === pIdx
      );
    }

    // Sort order
    if (sortOrder === "newest") {
      return [...filtered].reverse();
    }
    return filtered;
  }, [chronologicalQuestionAttempts, scopeFilter, sortOrder]);

  // Find previous compatible attempt for each attempt to enable "Compare with previous"
  const getPrecedingCompatibleAttempt = (currentAttempt: PracticeAttempt) => {
    const currentCreated = new Date(currentAttempt.createdAt).getTime();
    // Look through chronological attempts before this one in reverse order
    const earlierAttempts = chronologicalQuestionAttempts
      .filter((a) => new Date(a.createdAt).getTime() < currentCreated)
      .reverse();

    for (const earlier of earlierAttempts) {
      const compatibility = checkScopeCompatibility(earlier, currentAttempt);
      if (compatibility.compatible) {
        return earlier;
      }
    }
    return null;
  };

  // Selection toggle for custom 2-attempt comparison
  const handleToggleCompare = (attemptId: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(attemptId)) {
        return prev.filter((id) => id !== attemptId);
      }
      if (prev.length >= 2) {
        return [prev[1]!, attemptId];
      }
      return [...prev, attemptId];
    });
  };

  // Check compatibility of custom selected 2 attempts
  const compareCompatibility = useMemo(() => {
    if (selectedForCompare.length !== 2) return null;
    const attA = attemptsList.find((a) => a.id === selectedForCompare[0]);
    const attB = attemptsList.find((a) => a.id === selectedForCompare[1]);
    if (!attA || !attB) return null;
    return checkScopeCompatibility(attA, attB);
  }, [selectedForCompare, attemptsList]);

  const handleLaunchComparison = () => {
    if (selectedForCompare.length === 2 && compareCompatibility?.compatible) {
      router.push(
        `/study/${studySet.id}/compare?a=${selectedForCompare[0]}&b=${selectedForCompare[1]}`
      );
    }
  };

  // Summary Metrics derivation
  const metrics = useMemo(() => {
    const totalCount = chronologicalQuestionAttempts.length;
    if (totalCount === 0) {
      return {
        totalCount: 0,
        paragraphCount: 0,
        wholeCount: 0,
        bestCoverageScore: 0,
        bestCoverageRatio: "0 of 0",
        bestCoveragePercent: 0,
        improvementText: "—",
        improvementSubtext: "No attempts yet",
        latestDateStr: "—",
        latestCoverageSubtext: "No attempts yet",
      };
    }

    const paragraphCount = chronologicalQuestionAttempts.filter(
      (a) => a.scope === "paragraph"
    ).length;
    const wholeCount = chronologicalQuestionAttempts.filter(
      (a) => !a.scope || a.scope === "whole_answer"
    ).length;

    // Best coverage across all attempts
    let bestPercent = 0;
    let bestCovered = 0;
    let bestTotal = 0;

    chronologicalQuestionAttempts.forEach((att) => {
      const audit = audits[att.id];
      if (audit?.overall && audit.overall.totalCriteria > 0) {
        const total = audit.overall.totalCriteria;
        const covered = audit.overall.coveredCount;
        const pct = Math.round((covered / total) * 100);
        if (pct >= bestPercent) {
          bestPercent = pct;
          bestCovered = covered;
          bestTotal = total;
        }
      } else if (att.wordCount > 0) {
        const total = totalQuestionCriteria;
        const ratio = Math.min(1, att.wordCount / 100);
        const covered = Math.round(ratio * total);
        const pct = Math.round(ratio * 100);
        if (pct >= bestPercent) {
          bestPercent = pct;
          bestCovered = covered;
          bestTotal = total;
        }
      }
    });

    if (bestTotal === 0) {
      bestTotal = totalQuestionCriteria;
    }

    // Improvement: Compare latest attempt with first attempt
    const firstAttempt = chronologicalQuestionAttempts[0];
    const latestAttempt =
      chronologicalQuestionAttempts[chronologicalQuestionAttempts.length - 1];

    let improvementText = "—";
    let improvementSubtext = "vs. first attempt";

    if (firstAttempt && latestAttempt && firstAttempt.id !== latestAttempt.id) {
      const firstAudit = audits[firstAttempt.id];
      const latestAudit = audits[latestAttempt.id];

      if (firstAudit?.overall && latestAudit?.overall) {
        const firstCovered = firstAudit.overall.coveredCount;
        const latestCovered = latestAudit.overall.coveredCount;
        const diff = latestCovered - firstCovered;
        if (diff > 0) {
          improvementText = `+${diff} concept${diff === 1 ? "" : "s"}`;
        } else if (diff === 0) {
          improvementText = "Maintained";
        } else {
          improvementText = `${diff} concepts`;
        }
      } else {
        const wordDiff = latestAttempt.wordCount - firstAttempt.wordCount;
        if (wordDiff > 0) {
          improvementText = `+${wordDiff} words`;
        } else if (wordDiff === 0) {
          improvementText = "Maintained";
        } else {
          improvementText = `${wordDiff} words`;
        }
      }
    } else if (totalCount === 1) {
      improvementText = "Baseline set";
      improvementSubtext = "First attempt";
    }

    // Latest attempt date and coverage
    let latestDateStr = "—";
    let latestCoverageSubtext = "—";
    if (latestAttempt) {
      const d = new Date(latestAttempt.createdAt);
      latestDateStr = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const latestAudit = audits[latestAttempt.id];
      if (latestAudit?.overall) {
        const total = latestAudit.overall.totalCriteria;
        const covered = latestAudit.overall.coveredCount;
        latestCoverageSubtext = `${covered} of ${total} concepts covered`;
      } else {
        latestCoverageSubtext = `${latestAttempt.wordCount} words recorded`;
      }
    }

    return {
      totalCount,
      paragraphCount,
      wholeCount,
      bestCoverageScore: bestCovered,
      bestCoverageRatio: `${bestCovered} of ${bestTotal}`,
      bestCoveragePercent: bestPercent,
      improvementText,
      improvementSubtext,
      latestDateStr,
      latestCoverageSubtext,
    };
  }, [chronologicalQuestionAttempts, audits, totalQuestionCriteria]);

  // Handle Question Navigation
  const handlePrevQuestion = () => {
    if (questionIndex > 0) {
      const prevQ = studySet.questions[questionIndex - 1];
      if (prevQ) {
        setSelectedQuestionId(prevQ.id);
        setScopeFilter("all");
        setSelectedForCompare([]);
        setOpenMenuAttemptId(null);
      }
    }
  };

  const handleNextQuestion = () => {
    if (questionIndex < studySet.questions.length - 1) {
      const nextQ = studySet.questions[questionIndex + 1];
      if (nextQ) {
        setSelectedQuestionId(nextQ.id);
        setScopeFilter("all");
        setSelectedForCompare([]);
        setOpenMenuAttemptId(null);
      }
    }
  };

  // Handle Attempt Deletion
  const handleDeleteConfirm = async () => {
    if (!attemptToDelete) return;
    setIsDeleting(true);
    try {
      await deletePracticeAttempt(attemptToDelete.id);
      setAttemptsList((prev) =>
        prev.filter((a) => a.id !== attemptToDelete.id)
      );
      setSelectedForCompare((prev) =>
        prev.filter((id) => id !== attemptToDelete.id)
      );
      setAttemptToDelete(null);
      setOpenMenuAttemptId(null);
    } catch (err) {
      console.error("Failed to delete attempt:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper for formatting duration
  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Helper for formatting date
  const formatAttemptDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  // Latest attempt in the entire chronological list for this question
  const latestChronologicalAttemptId =
    chronologicalQuestionAttempts.length > 0
      ? chronologicalQuestionAttempts[chronologicalQuestionAttempts.length - 1]
          ?.id
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      {/* Top Back Navigation */}
      <div>
        <Link
          href={`/review/${studySet.id}`}
          className="text-brand-secondary hover:text-brand-ink inline-flex items-center gap-1.5 text-xs font-semibold transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to study set</span>
        </Link>
      </div>

      {/* Floating Comparison Selection Bar */}
      {selectedForCompare.length > 0 && (
        <div className="border-brand-peach/80 sticky top-4 z-20 flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-brand-butter text-brand-ink flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold">
              {selectedForCompare.length}
            </span>
            <div>
              <p className="text-brand-ink text-xs font-bold">
                {selectedForCompare.length === 1
                  ? "Select 1 more attempt to compare"
                  : "Ready to compare attempts"}
              </p>
              {compareCompatibility && !compareCompatibility.compatible && (
                <p className="text-[11px] font-medium text-amber-700">
                  {compareCompatibility.reason}
                </p>
              )}
              {compareCompatibility && compareCompatibility.compatible && (
                <p className="text-[11px] font-medium text-emerald-700">
                  Compatible scopes ({compareCompatibility.scopeDescription})
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedForCompare([])}
              className="text-brand-secondary hover:text-brand-ink text-xs font-medium transition"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!compareCompatibility?.compatible}
              onClick={handleLaunchComparison}
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ScaleIcon className="h-3.5 w-3.5" />
              <span>Compare selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Question Header Card */}
      {activeQuestion && (
        <div className="border-brand-peach/60 rounded-3xl border bg-white p-6 shadow-xs sm:p-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            {/* Left: Document icon + Study set & question details */}
            <div className="flex items-start gap-4">
              <div className="bg-brand-peach/50 text-brand-tomato flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-xs">
                <BookOpenIcon className="h-7 w-7" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="text-brand-secondary text-xs font-medium">
                  {studySet.material.title || "Study Set"}
                </p>
                <h1 className="font-heading text-brand-ink text-xl font-bold tracking-tight sm:text-2xl">
                  {activeQuestion.question}
                </h1>
                {activeQuestion.sourceExcerpt && (
                  <p className="text-brand-secondary line-clamp-2 text-xs leading-relaxed">
                    {activeQuestion.sourceExcerpt}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Question Pagination & Practise Button */}
            <div className="flex shrink-0 flex-col items-start gap-3 sm:flex-row sm:items-center md:flex-col md:items-end">
              {/* Question X of Y */}
              <div className="flex items-center gap-2">
                <span className="text-brand-secondary text-xs font-semibold">
                  Question {questionIndex + 1} of {studySet.questions.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevQuestion}
                    disabled={questionIndex === 0}
                    aria-label="Previous question"
                    className="border-brand-peach/60 hover:bg-brand-cream/60 text-brand-ink flex h-7 w-7 items-center justify-center rounded-lg border bg-white text-xs transition disabled:pointer-events-none disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    disabled={questionIndex === studySet.questions.length - 1}
                    aria-label="Next question"
                    className="border-brand-peach/60 hover:bg-brand-cream/60 text-brand-ink flex h-7 w-7 items-center justify-center rounded-lg border bg-white text-xs transition disabled:pointer-events-none disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
              </div>

              {/* Practise this question button */}
              <Link
                href={`/study/${studySet.id}/practice?questionId=${activeQuestion.id}`}
                className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:shadow-sm"
              >
                <PlayIcon className="h-3.5 w-3.5 fill-current" />
                <span>Practise this question</span>
              </Link>
            </div>
          </div>

          {/* Scope Filter Pills Row */}
          <div className="border-brand-peach/40 mt-6 flex flex-wrap items-center gap-2 border-t pt-5">
            {availableScopes.map((scope) => {
              const isActive = scopeFilter === scope.id;
              return (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setScopeFilter(scope.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-brand-tomato text-white shadow-xs"
                      : "border-brand-peach/60 hover:border-brand-tomato/40 text-brand-secondary hover:text-brand-ink border bg-white"
                  }`}
                >
                  <span>{scope.label}</span>
                  <span
                    className={`py-0.2 rounded-full px-1.5 text-[10px] ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-brand-cream text-brand-secondary"
                    }`}
                  >
                    {scope.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Four Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-2 sm:gap-4 md:grid-cols-4">
        {/* Card 1: Total attempts */}
        <div className="border-brand-peach/60 rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-2">
            <div className="bg-brand-butter/30 text-brand-ink flex h-8 w-8 items-center justify-center rounded-xl">
              <BookOpenIcon className="h-4 w-4" />
            </div>
            <span className="text-brand-secondary text-xs font-medium">
              Total attempts
            </span>
          </div>
          <div className="mt-3">
            <div className="font-heading text-brand-ink text-2xl font-bold sm:text-3xl">
              {metrics.totalCount}
            </div>
            <p className="text-brand-secondary mt-1 text-[11px]">
              {metrics.paragraphCount} paragraph • {metrics.wholeCount} whole
              answer
            </p>
          </div>
        </div>

        {/* Card 2: Best coverage */}
        <div className="border-brand-peach/60 rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-2">
            <div className="bg-brand-butter/30 text-brand-ink flex h-8 w-8 items-center justify-center rounded-xl">
              <ChartBarIcon className="h-4 w-4" />
            </div>
            <span className="text-brand-secondary text-xs font-medium">
              Best coverage
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-brand-ink text-2xl font-bold sm:text-3xl">
                {metrics.bestCoverageRatio}
              </span>
              {metrics.totalCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {metrics.bestCoveragePercent}%
                </span>
              )}
            </div>
            <p className="text-brand-secondary mt-1 text-[11px]">
              Across all attempts
            </p>
          </div>
        </div>

        {/* Card 3: Improvement */}
        <div className="border-brand-peach/60 rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-2">
            <div className="bg-brand-butter/30 text-brand-ink flex h-8 w-8 items-center justify-center rounded-xl">
              <ArrowTrendingUpIcon className="h-4 w-4" />
            </div>
            <span className="text-brand-secondary text-xs font-medium">
              Improvement
            </span>
          </div>
          <div className="mt-3">
            <div className="font-heading text-brand-ink text-2xl font-bold sm:text-3xl">
              {metrics.improvementText}
            </div>
            <p className="text-brand-secondary mt-1 text-[11px]">
              {metrics.improvementSubtext}
            </p>
          </div>
        </div>

        {/* Card 4: Latest attempt */}
        <div className="border-brand-peach/60 rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-2">
            <div className="bg-brand-butter/30 text-brand-ink flex h-8 w-8 items-center justify-center rounded-xl">
              <ClockIcon className="h-4 w-4" />
            </div>
            <span className="text-brand-secondary text-xs font-medium">
              Latest attempt
            </span>
          </div>
          <div className="mt-3">
            <div className="font-heading text-brand-ink truncate text-sm font-bold sm:text-base">
              {metrics.latestDateStr}
            </div>
            <p className="text-brand-secondary mt-1 truncate text-[11px]">
              {metrics.latestCoverageSubtext}
            </p>
          </div>
        </div>
      </div>

      {/* Practice Attempts Section */}
      <div className="space-y-4 pt-2">
        {/* Section Header with Sort Dropdown */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-brand-ink text-lg font-bold">
              Practice Attempts
            </h2>
            <p className="text-brand-secondary text-xs">
              Your recent practice attempts for this question. Compare your
              progress and revisit previous feedback.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="border-brand-peach/60 relative inline-flex items-center rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold shadow-xs">
              <span className="text-brand-secondary mr-1">⇅</span>
              <select
                aria-label="Sort attempts order"
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "newest" | "oldest")
                }
                className="text-brand-ink cursor-pointer bg-transparent text-xs font-semibold outline-hidden"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>

        {/* Empty state when no attempts match */}
        {displayedAttempts.length === 0 ? (
          <div className="border-brand-peach/60 rounded-3xl border border-dashed bg-white/70 p-12 text-center">
            <div className="bg-brand-peach/40 text-brand-tomato mx-auto flex h-12 w-12 items-center justify-center rounded-2xl">
              <BookOpenIcon className="h-6 w-6" />
            </div>
            <h3 className="font-heading text-brand-ink mt-3 text-sm font-bold">
              No practice attempts yet
            </h3>
            <p className="text-brand-secondary mx-auto mt-1 max-w-sm text-xs">
              {chronologicalQuestionAttempts.length === 0
                ? "You haven't recorded any practice attempts for this question yet."
                : "No attempts match the selected scope filter."}
            </p>
            <div className="mt-5">
              <Link
                href={`/study/${studySet.id}/practice?questionId=${activeQuestion.id}`}
                className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition"
              >
                <PlayIcon className="h-3.5 w-3.5 fill-current" />
                <span>Start your first attempt</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Timeline Container */
          <div className="before:bg-brand-peach/80 relative space-y-4 pl-4 before:absolute before:top-6 before:bottom-6 before:left-[11px] before:w-0.5 sm:pl-6 sm:before:left-[15px]">
            {displayedAttempts.map((attempt) => {
              const attemptNumber = attemptNumberMap.get(attempt.id) || 1;
              const isLatest = attempt.id === latestChronologicalAttemptId;
              const precedingCompatible =
                getPrecedingCompatibleAttempt(attempt);
              const isSelected = selectedForCompare.includes(attempt.id);

              // Scope label and badge styling
              const isParagraphScope = attempt.scope === "paragraph";
              const paragraphIdx = attempt.paragraphIndex ?? 0;
              const scopeBadgeText = isParagraphScope
                ? `Paragraph ${paragraphIdx + 1}`
                : "Whole Answer";

              // Concept coverage audit stats
              const audit = audits[attempt.id];
              let coveredCount = 0;
              let partialCount = 0;
              let missingCount = 0;
              let totalPoints = totalQuestionCriteria;
              let scorePercent = 0;

              if (audit?.overall && audit.overall.totalCriteria > 0) {
                totalPoints = audit.overall.totalCriteria;
                coveredCount = audit.overall.coveredCount;
                partialCount = audit.overall.partiallyCoveredCount;
                missingCount = audit.overall.missingCount;
                scorePercent = Math.round((coveredCount / totalPoints) * 100);
              } else if (attempt.wordCount > 0) {
                // Approximate fallback
                const ratio = Math.min(1, attempt.wordCount / 100);
                coveredCount = Math.round(ratio * totalPoints);
                missingCount = Math.max(0, totalPoints - coveredCount);
                scorePercent = Math.round(ratio * 100);
              }

              // Score badge colour
              const scoreBadgeClass =
                scorePercent >= 70
                  ? "bg-emerald-100 text-emerald-800"
                  : scorePercent >= 40
                    ? "bg-amber-100 text-amber-800"
                    : "bg-orange-100 text-orange-800";

              return (
                <div key={attempt.id} className="relative">
                  {/* Timeline dot */}
                  <div
                    className={`absolute top-6 -left-[18px] h-3 w-3 rounded-full ring-4 ring-[#FFF8EB] sm:-left-[22px] ${
                      isLatest ? "bg-brand-tomato" : "bg-amber-400"
                    }`}
                  />

                  {/* Attempt Card */}
                  <div
                    className={`rounded-2xl border p-5 shadow-xs transition hover:shadow-sm ${
                      isSelected
                        ? "ring-brand-tomato bg-brand-cream/30 border-brand-tomato ring-2"
                        : isLatest
                          ? "border-brand-tomato/40 ring-brand-tomato/20 bg-[#FFF8F3] ring-1"
                          : "border-brand-peach/60 bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left: Attempt Number, Date, Scope badge, Words & Duration */}
                      <div className="space-y-2 lg:w-1/3">
                        <div className="flex flex-wrap items-center gap-2">
                          {isLatest && (
                            <span className="bg-brand-tomato rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                              Latest
                            </span>
                          )}
                          <span className="font-heading text-brand-ink text-sm font-bold">
                            Attempt {attemptNumber}
                          </span>
                          <span className="text-brand-secondary text-xs">
                            {formatAttemptDate(attempt.createdAt)}
                          </span>
                        </div>

                        {/* Scope pill */}
                        <div>
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              isParagraphScope
                                ? "border border-orange-200 bg-orange-50 text-orange-700"
                                : "border border-blue-200 bg-blue-50 text-blue-700"
                            }`}
                          >
                            {scopeBadgeText}
                          </span>
                        </div>

                        {/* Words & Duration */}
                        <div className="text-brand-secondary flex items-center gap-3 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <span>📄</span>
                            <span>{attempt.wordCount} words</span>
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <span>⏱</span>
                            <span>
                              {formatDuration(attempt.durationSeconds)}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Middle: Concepts covered metric */}
                      <div className="border-brand-peach/40 space-y-1.5 border-t pt-3 lg:w-1/3 lg:border-t-0 lg:pt-0">
                        <div className="text-brand-secondary text-[11px] font-medium tracking-wider uppercase">
                          Concepts covered
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-brand-ink text-xl font-bold">
                            {coveredCount} of {totalPoints}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${scoreBadgeClass}`}
                          >
                            {scorePercent}%
                          </span>
                        </div>
                        <p className="text-brand-secondary text-xs">
                          {coveredCount} covered • {partialCount} partial •{" "}
                          {missingCount} missing
                        </p>
                      </div>

                      {/* Right: Actions (Compare, Review, Kebab Menu) */}
                      <div className="border-brand-peach/40 flex items-center justify-between gap-2 border-t pt-3 lg:w-auto lg:border-t-0 lg:pt-0">
                        <div className="flex items-center gap-2">
                          {/* Compare button */}
                          {precedingCompatible ? (
                            <Link
                              href={`/study/${studySet.id}/compare?a=${precedingCompatible.id}&b=${attempt.id}`}
                              className="border-brand-peach/60 hover:bg-brand-cream/60 text-brand-ink inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-semibold shadow-xs transition"
                            >
                              <ScaleIcon className="h-3.5 w-3.5" />
                              <span>Compare with previous</span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="No earlier attempt with the same practice scope to compare with."
                              className="border-brand-peach/40 inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border bg-gray-50/80 px-3 py-2 text-xs font-semibold text-gray-400 opacity-60"
                            >
                              <ScaleIcon className="h-3.5 w-3.5" />
                              <span>Compare with previous</span>
                            </button>
                          )}

                          {/* Review feedback button */}
                          <Link
                            href={`/study/${studySet.id}/attempts/${attempt.id}`}
                            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:shadow-sm"
                          >
                            <span>Review feedback</span>
                            <span>→</span>
                          </Link>
                        </div>

                        {/* Kebab Menu */}
                        <div className="relative">
                          <button
                            type="button"
                            aria-label="Attempt options"
                            onClick={() =>
                              setOpenMenuAttemptId(
                                openMenuAttemptId === attempt.id
                                  ? null
                                  : attempt.id
                              )
                            }
                            className="hover:bg-brand-cream/80 text-brand-secondary hover:text-brand-ink flex h-8 w-8 items-center justify-center rounded-lg transition"
                          >
                            <EllipsisVerticalIcon className="h-4 w-4" />
                          </button>

                          {/* Dropdown Menu */}
                          {openMenuAttemptId === attempt.id && (
                            <div className="border-brand-peach/60 absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border bg-white py-1 shadow-md">
                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleCompare(attempt.id);
                                  setOpenMenuAttemptId(null);
                                }}
                                className="text-brand-ink hover:bg-brand-cream/60 flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition"
                              >
                                <ScaleIcon className="text-brand-secondary h-3.5 w-3.5" />
                                <span>
                                  {isSelected
                                    ? "Deselect for comparison"
                                    : "Select for custom comparison"}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAttemptToDelete(attempt);
                                  setOpenMenuAttemptId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-600 transition hover:bg-red-50"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                                <span>Delete attempt</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {attemptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="border-brand-peach/60 w-full max-w-sm rounded-2xl border bg-white p-6 shadow-xl">
            <h3 className="font-heading text-brand-ink text-base font-bold">
              Delete Practice Attempt?
            </h3>
            <p className="text-brand-secondary mt-2 text-xs leading-relaxed">
              Are you sure you want to delete Attempt{" "}
              {attemptNumberMap.get(attemptToDelete.id) || 1}? This action
              cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAttemptToDelete(null)}
                disabled={isDeleting}
                className="border-brand-peach/60 hover:bg-brand-cream/60 text-brand-ink rounded-xl border bg-white px-3.5 py-2 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
