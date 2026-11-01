"use client";

import React, { useState } from "react";
import Link from "next/link";
import { StudySet, ExtractedQuestion } from "@/lib/domain/study-set";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import {
  SemanticAuditResult,
  CRITERION_STATUS_META,
} from "@/lib/domain/semantic-audit";
import {
  compareAttempts,
  ConceptTransitionType,
} from "@/lib/domain/attempt-comparison";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
} from "@/components/icons";

interface AttemptComparisonViewProps {
  studySet: StudySet;
  attemptA: PracticeAttempt;
  attemptB: PracticeAttempt;
  auditA: SemanticAuditResult | null;
  auditB: SemanticAuditResult | null;
}

const TRANSITION_BADGE_STYLE: Record<
  ConceptTransitionType,
  { label: string; badge: string; icon: string }
> = {
  improved: {
    label: "Improved",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: "▲",
  },
  partial_progress: {
    label: "Partial Progress",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    icon: "◐",
  },
  retained: {
    label: "Maintained",
    badge: "bg-blue-50 text-blue-800 border-blue-200",
    icon: "✓",
  },
  still_missing: {
    label: "Still to Practise",
    badge: "bg-stone-100 text-stone-700 border-stone-200",
    icon: "○",
  },
  regressed: {
    label: "Missed This Time",
    badge: "bg-orange-50 text-orange-800 border-orange-200",
    icon: "▼",
  },
  new_misconception: {
    label: "Needs Correction",
    badge: "bg-rose-50 text-rose-800 border-rose-200",
    icon: "✕",
  },
  still_incorrect: {
    label: "Needs Correction",
    badge: "bg-rose-50 text-rose-800 border-rose-200",
    icon: "✕",
  },
  still_partial: {
    label: "Needs More Detail",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    icon: "◐",
  },
  not_evaluated: {
    label: "Not Evaluated",
    badge: "bg-stone-50 text-stone-600 border-stone-200",
    icon: "-",
  },
};

export function AttemptComparisonView({
  studySet,
  attemptA,
  attemptB,
  auditA,
  auditB,
}: AttemptComparisonViewProps) {
  const [expandedConceptId, setExpandedConceptId] = useState<string | null>(
    null
  );

  const question: ExtractedQuestion | undefined = studySet.questions.find(
    (q) => q.id === attemptA.questionId
  );
  const rubric = question ? studySet.rubrics[question.id] : undefined;
  const criteria = rubric?.criteria || [];

  const comparison = compareAttempts({
    attemptA,
    attemptB,
    auditA,
    auditB,
    criteria,
  });

  const { earlierAttempt, laterAttempt, summary } = comparison;

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
      {/* Top Navigation */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/study/${studySet.id}/history?questionId=${attemptA.questionId}`}
          className="text-brand-secondary hover:text-brand-ink inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold transition"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <span>Back to attempt history</span>
        </Link>

        <span className="bg-brand-peach/50 text-brand-secondary self-start rounded-full px-3 py-1 text-xs font-semibold sm:self-auto">
          Scope: {comparison.scopeDescription}
        </span>
      </div>

      {/* Header Card */}
      <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs sm:p-6">
        <div className="flex items-center gap-2">
          <span className="bg-brand-cream text-brand-tomato rounded-lg px-2.5 py-1 text-xs font-bold">
            Attempt Comparison
          </span>
          <span className="text-brand-secondary text-xs">
            {studySet.material.title}
          </span>
        </div>

        <h1 className="font-heading text-brand-ink mt-2 text-lg font-bold sm:text-xl">
          {question?.question || "Question Comparison"}
        </h1>

        {/* If Incompatible */}
        {!comparison.isComparable && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <p className="font-bold">Cannot compare these attempts</p>
            <p className="mt-1 leading-relaxed">
              {comparison.incompatibilityReason}
            </p>
            <div className="mt-3">
              <Link
                href={`/study/${studySet.id}/history?questionId=${attemptA.questionId}`}
                className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex cursor-pointer items-center gap-1 rounded-xl px-4 py-2 text-xs font-bold text-white transition"
              >
                <span>Select compatible attempts from history</span>
              </Link>
            </div>
          </div>
        )}

        {/* If Comparable: Progress Summary Banner */}
        {comparison.isComparable && (
          <div className="bg-brand-cream/50 border-brand-peach/70 mt-5 rounded-2xl border p-5">
            <div className="flex items-start gap-3">
              <div className="bg-brand-tomato text-brand-cream mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold">
                <SparklesIcon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <h2 className="font-heading text-brand-ink text-base font-bold">
                  {summary.headline}
                </h2>
                <p className="text-brand-secondary mt-1 text-xs leading-relaxed">
                  {summary.studentFeedback}
                </p>

                {/* Stat Badges */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                    <span className="text-brand-secondary">
                      Conceptual Progress:{" "}
                    </span>
                    <span
                      className={`font-bold ${
                        summary.netProgress > 0
                          ? "text-emerald-700"
                          : summary.netProgress < 0
                            ? "text-rose-700"
                            : "text-stone-800"
                      }`}
                    >
                      {summary.netProgress > 0
                        ? `+${summary.netProgress}`
                        : summary.netProgress}{" "}
                      {Math.abs(summary.netProgress) === 1
                        ? "concept"
                        : "concepts"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                    <span className="text-brand-secondary">Words Spoken: </span>
                    <span className="text-brand-ink font-bold">
                      {summary.wordsSpokenChange >= 0
                        ? `+${summary.wordsSpokenChange}`
                        : summary.wordsSpokenChange}{" "}
                      words
                    </span>
                  </div>

                  <div className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
                    <span className="text-brand-secondary">Duration: </span>
                    <span className="text-brand-ink font-bold">
                      {summary.durationSecondsChange >= 0
                        ? `+${summary.durationSecondsChange}s`
                        : `${summary.durationSecondsChange}s`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {comparison.isComparable && (
        <>
          {/* Side-by-Side Attempt Overviews */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Earlier Attempt Card */}
            <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-brand-secondary text-xs font-bold tracking-wider uppercase">
                  Attempt 1 (Baseline)
                </span>
                <span className="text-brand-secondary text-xs">
                  {formatDate(earlierAttempt.createdAt)}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-heading text-brand-ink text-2xl font-bold">
                  {summary.conceptsCoveredEarlier} of {summary.mandatoryTotal}
                </span>
                <span className="text-brand-secondary text-xs">
                  concepts covered
                </span>
              </div>

              <div className="text-brand-secondary mt-2 flex items-center gap-3 text-xs">
                <span>{earlierAttempt.wordCount} words</span>
                <span>•</span>
                <span>{formatDuration(earlierAttempt.durationSeconds)}</span>
              </div>

              <div className="mt-4 border-t border-stone-100 pt-3">
                <Link
                  href={`/study/${studySet.id}/attempts/${earlierAttempt.id}`}
                  className="text-brand-tomato hover:text-brand-tomato-hover inline-flex cursor-pointer items-center gap-1 text-xs font-bold"
                >
                  <span>Open full Answer Review</span>
                  <ChevronRightIcon className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Later Attempt Card */}
            <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-brand-tomato text-xs font-bold tracking-wider uppercase">
                  Attempt 2 (Follow-up)
                </span>
                <span className="text-brand-secondary text-xs">
                  {formatDate(laterAttempt.createdAt)}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-heading text-brand-ink text-2xl font-bold">
                  {summary.conceptsCoveredLater} of {summary.mandatoryTotal}
                </span>
                <span className="text-brand-secondary text-xs">
                  concepts covered
                </span>
              </div>

              <div className="text-brand-secondary mt-2 flex items-center gap-3 text-xs">
                <span>{laterAttempt.wordCount} words</span>
                <span>•</span>
                <span>{formatDuration(laterAttempt.durationSeconds)}</span>
              </div>

              <div className="mt-4 border-t border-stone-100 pt-3">
                <Link
                  href={`/study/${studySet.id}/attempts/${laterAttempt.id}`}
                  className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex cursor-pointer items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-white transition"
                >
                  <span>Open full Answer Review</span>
                  <ChevronRightIcon className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Concept-by-Concept Transition Breakdown */}
          <div className="border-brand-peach/80 space-y-4 rounded-2xl border bg-white p-5 shadow-xs sm:p-6">
            <div>
              <h3 className="font-heading text-brand-ink text-base font-bold">
                Conceptual Progress by Point
              </h3>
              <p className="text-brand-secondary mt-0.5 text-xs">
                See which points you retained, improved, or still need to
                review.
              </p>
            </div>

            <div className="space-y-3">
              {comparison.concepts.map((concept) => {
                const style = TRANSITION_BADGE_STYLE[concept.transition];
                const earlierMeta =
                  concept.earlierStatus !== "not_evaluated"
                    ? CRITERION_STATUS_META[concept.earlierStatus]
                    : null;
                const laterMeta =
                  concept.laterStatus !== "not_evaluated"
                    ? CRITERION_STATUS_META[concept.laterStatus]
                    : null;
                const isExpanded = expandedConceptId === concept.criterionId;

                return (
                  <div
                    key={concept.criterionId}
                    className="border-brand-peach/60 rounded-xl border bg-stone-50/50 p-4 transition hover:bg-stone-50"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${style.badge}`}
                        >
                          <span>{style.icon}</span>
                          <span>{style.label}</span>
                        </span>
                        <h4 className="font-heading text-brand-ink text-sm font-bold">
                          {concept.criterionName}
                        </h4>
                      </div>

                      {/* Status Flow Indicator */}
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                            earlierMeta
                              ? `${earlierMeta.badgeBg} ${earlierMeta.badgeText} ${earlierMeta.badgeBorder}`
                              : "border-stone-200 bg-stone-100 text-stone-600"
                          }`}
                        >
                          <span>{earlierMeta?.icon || "-"}</span>
                          <span>
                            {earlierMeta?.studentLabel || "Not evaluated"}
                          </span>
                        </span>

                        <span className="text-brand-secondary font-bold">
                          &rarr;
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold ${
                            laterMeta
                              ? `${laterMeta.badgeBg} ${laterMeta.badgeText} ${laterMeta.badgeBorder}`
                              : "border-stone-200 bg-stone-100 text-stone-600"
                          }`}
                        >
                          <span>{laterMeta?.icon || "-"}</span>
                          <span>
                            {laterMeta?.studentLabel || "Not evaluated"}
                          </span>
                        </span>
                      </div>
                    </div>

                    <p className="text-brand-secondary mt-2 text-xs leading-relaxed">
                      {concept.studentMessage}
                    </p>

                    {/* Expandable Evidence Comparison */}
                    <div className="mt-3 border-t border-stone-200/60 pt-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedConceptId(
                            isExpanded ? null : concept.criterionId
                          )
                        }
                        className="text-brand-secondary hover:text-brand-ink inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold transition"
                      >
                        <span>
                          {isExpanded
                            ? "Hide transcript comparison"
                            : "Compare spoken evidence"}
                        </span>
                        <span>{isExpanded ? "▲" : "▼"}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs">
                            <span className="text-brand-secondary text-[10px] font-bold tracking-wider uppercase">
                              Attempt 1 Evidence
                            </span>
                            <p className="text-brand-ink mt-1 leading-relaxed italic">
                              {concept.earlierEvidence
                                ? `"${concept.earlierEvidence}"`
                                : "No spoken evidence captured."}
                            </p>
                          </div>

                          <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs">
                            <span className="text-brand-tomato text-[10px] font-bold tracking-wider uppercase">
                              Attempt 2 Evidence
                            </span>
                            <p className="text-brand-ink mt-1 leading-relaxed italic">
                              {concept.laterEvidence
                                ? `"${concept.laterEvidence}"`
                                : "No spoken evidence captured."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/study/${studySet.id}/practice?questionId=${attemptA.questionId}`}
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-xs font-bold text-white shadow-xs transition"
            >
              <span>Practise this question again &rarr;</span>
            </Link>

            <Link
              href={`/study/${studySet.id}/history?questionId=${attemptA.questionId}`}
              className="border-brand-peach/80 hover:bg-brand-cream/60 text-brand-ink inline-flex cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-xs font-semibold transition"
            >
              <span>Back to attempt history</span>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
