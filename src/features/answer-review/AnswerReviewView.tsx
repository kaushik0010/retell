"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  StudySet,
  ExtractedQuestion,
  RUBRIC_CATEGORY_META,
} from "@/lib/domain/study-set";
import { PracticeAttempt } from "@/lib/domain/practice-session";
import {
  SemanticAuditResult,
  CRITERION_STATUS_META,
} from "@/lib/domain/semantic-audit";
import {
  saveSemanticAuditResult,
  getPreviousPracticeAttempt,
} from "@/lib/storage/study-store";
import { checkScopeCompatibility } from "@/lib/domain/attempt-comparison";
import {
  extractParagraphs,
  resolvePracticeScope,
} from "@/lib/domain/paragraph-scope";

interface AnswerReviewViewProps {
  studySet: StudySet;
  attempt: PracticeAttempt;
  initialAudit: SemanticAuditResult | null;
}

export function AnswerReviewView({
  studySet,
  attempt,
  initialAudit,
}: AnswerReviewViewProps) {
  const [audit, setAudit] = useState<SemanticAuditResult | null>(initialAudit);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [showReferenceAnswer, setShowReferenceAnswer] = useState(false);
  const [previousAttempt, setPreviousAttempt] =
    useState<PracticeAttempt | null>(null);

  // Check for previous attempt to enable progress comparison
  React.useEffect(() => {
    let mounted = true;
    getPreviousPracticeAttempt(attempt.id)
      .then((prev) => {
        if (mounted) setPreviousAttempt(prev);
      })
      .catch((err) => {
        console.warn("Failed to check for previous attempt:", err);
      });

    return () => {
      mounted = false;
    };
  }, [attempt.id]);

  // Identify active question
  const questionIndex = studySet.questions.findIndex(
    (q) => q.id === attempt.questionId
  );
  const activeQuestion: ExtractedQuestion | undefined =
    studySet.questions[questionIndex >= 0 ? questionIndex : 0];
  const activeRubric = activeQuestion
    ? studySet.rubrics[activeQuestion.id]
    : undefined;

  // Handle on-demand retry or initial audit if not yet computed
  const handleRunAudit = async () => {
    if (!activeQuestion) return;

    try {
      setIsAuditing(true);
      setAuditError(null);

      const resolvedScope = resolvePracticeScope({
        referenceAnswer: activeQuestion.referenceAnswer,
        criteria: activeRubric?.criteria || [],
        scope: attempt.scope
          ? {
              type: attempt.scope,
              paragraphIndex: attempt.paragraphIndex,
            }
          : undefined,
      });

      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          studySetId: studySet.id,
          questionId: activeQuestion.id,
          question: activeQuestion.question,
          referenceAnswer: resolvedScope.paragraphText,
          transcript: attempt.transcript,
          criteria: resolvedScope.criteria,
          scope: {
            type: attempt.scope || "whole_answer",
            paragraphIndex: attempt.paragraphIndex,
            totalParagraphs: resolvedScope.totalParagraphs,
            targetText: resolvedScope.paragraphText,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.audit) {
        throw new Error(data.error || "Could not complete answer evaluation.");
      }

      await saveSemanticAuditResult(data.audit);
      setAudit(data.audit);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during evaluation.";
      setAuditError(msg);
    } finally {
      setIsAuditing(false);
    }
  };

  const coveredCriteria =
    audit?.criteriaEvaluations.filter((c) => c.status === "covered") || [];
  const needsAttentionCriteria =
    audit?.criteriaEvaluations.filter(
      (c) => c.status === "partially_covered" || c.status === "missing"
    ) || [];
  const incorrectCriteria =
    audit?.criteriaEvaluations.filter((c) => c.status === "incorrect") || [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3 text-xs">
            <Link
              href={`/study/${studySet.id}/practice?questionId=${attempt.questionId}`}
              className="text-brand-tomato hover:text-brand-tomato-hover inline-flex items-center gap-1 font-bold"
            >
              <span>&larr;</span>
              <span>Back to Practice Room</span>
            </Link>
            <span className="text-brand-secondary/40">•</span>
            <Link
              href={`/review/${studySet.id}`}
              className="text-brand-secondary hover:text-brand-ink"
            >
              Study set points
            </Link>
          </div>
          <h1 className="font-heading text-brand-ink mt-1.5 text-2xl font-bold tracking-tight">
            Answer Review
          </h1>
          <p className="text-brand-secondary text-xs">
            Evaluate what you explained well and identify concepts to strengthen
            for your exams.
          </p>
        </div>

        {/* Quick Attempt Info Badge */}
        <div className="border-brand-peach/80 flex items-center gap-3 rounded-xl border bg-white px-3.5 py-2 text-xs shadow-2xs">
          <div>
            <span className="text-brand-secondary block text-[10px] font-bold tracking-wider uppercase">
              Words Spoken
            </span>
            <span className="font-heading text-brand-ink font-bold">
              {attempt.wordCount} words
            </span>
          </div>
          <div className="border-brand-peach/60 h-6 border-r" />
          <div>
            <span className="text-brand-secondary block text-[10px] font-bold tracking-wider uppercase">
              Duration
            </span>
            <span className="font-heading text-brand-ink font-bold">
              {attempt.durationSeconds}s
            </span>
          </div>
        </div>
      </div>

      {/* Question Context Card */}
      {activeQuestion && (
        <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-brand-butter text-brand-ink rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                Question {questionIndex >= 0 ? questionIndex + 1 : 1}
              </span>
              {attempt.scope === "paragraph" &&
                typeof attempt.paragraphIndex === "number" && (
                  <span className="border-brand-peach/80 bg-brand-cream text-brand-ink rounded-md border px-2 py-0.5 text-[10px] font-semibold">
                    Paragraph {attempt.paragraphIndex + 1} Practice
                  </span>
                )}
            </div>
            {activeQuestion.pageNumber && (
              <span className="text-brand-secondary text-[11px]">
                Page {activeQuestion.pageNumber}
              </span>
            )}
          </div>

          <h2 className="font-heading text-brand-ink mt-2 text-base font-bold">
            {activeQuestion.question}
          </h2>

          {/* Paragraph Practice Scope Explanation */}
          {attempt.scope === "paragraph" &&
            typeof attempt.paragraphIndex === "number" && (
              <p className="border-brand-peach/60 bg-brand-cream/60 text-brand-secondary mt-3 rounded-xl border p-2.5 text-xs">
                ℹ️ <strong>Paragraph-Level Practice:</strong> You practiced
                explaining Paragraph {attempt.paragraphIndex + 1}. Only concepts
                from this paragraph were evaluated; concepts from other
                paragraphs were not marked missing.
              </p>
            )}
        </div>
      )}

      {/* Evaluating / Error / Retry Banner */}
      {auditError && (
        <div className="animate-in fade-in rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-base">⚠️</span>
            <div className="flex-1">
              <p className="font-bold">Could not complete evaluation</p>
              <p className="mt-0.5 text-red-800">{auditError}</p>
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isAuditing}
                className="bg-brand-tomato hover:bg-brand-tomato-hover mt-2.5 inline-flex cursor-pointer items-center rounded-lg px-3.5 py-1.5 font-bold text-white shadow-2xs transition disabled:opacity-50"
              >
                {isAuditing ? "Evaluating..." : "↻ Retry evaluation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* On-demand evaluate trigger if attempt has no audit yet */}
      {!audit && !isAuditing && !auditError && (
        <div className="border-brand-peach/80 bg-brand-cream/60 rounded-2xl border p-6 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-2xs">
            ✨
          </div>
          <h3 className="font-heading text-brand-ink mt-3 text-base font-bold">
            Ready to evaluate your answer?
          </h3>
          <p className="text-brand-secondary mx-auto mt-1 max-w-md text-xs">
            Retell will analyze your spoken explanation against the reference
            material to check which key concepts you remembered.
          </p>
          <button
            type="button"
            onClick={handleRunAudit}
            className="bg-brand-tomato hover:bg-brand-tomato-hover mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-xs transition"
          >
            <span>Evaluate understanding</span>
            <span>&rarr;</span>
          </button>
        </div>
      )}

      {/* In-Flight Auditing Loading State */}
      {isAuditing && (
        <div className="border-brand-peach/80 rounded-2xl border bg-white p-8 text-center shadow-xs">
          <div className="border-brand-tomato mx-auto h-10 w-10 animate-spin rounded-full border-3 border-t-transparent" />
          <h3 className="font-heading text-brand-ink mt-4 text-base font-bold">
            Evaluating your explanation...
          </h3>
          <p className="text-brand-secondary mt-1 text-xs">
            Comparing your spoken words against the reference material to check
            understanding.
          </p>
        </div>
      )}

      {/* Complete Audit Results */}
      {audit && !isAuditing && (
        <div className="space-y-6">
          {/* Section A: Overall Assessment Card */}
          <div className="border-brand-peach/80 bg-brand-cream/50 rounded-2xl border p-6 shadow-xs">
            <span className="text-brand-tomato text-[10px] font-bold tracking-wider uppercase">
              Overall Assessment
            </span>
            <h3 className="font-heading text-brand-ink mt-1 text-lg font-bold">
              {audit.overall.summary}
            </h3>

            {/* Concept Coverage Transparent Breakdown */}
            <div className="border-brand-peach/60 bg-brand-cream/80 mt-4 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-heading text-brand-ink text-xs font-bold">
                  Concept Coverage
                </span>
                <span className="text-brand-secondary text-xs font-semibold">
                  {audit.overall.coveredCount} of {audit.overall.totalCriteria}{" "}
                  concepts covered
                </span>
              </div>

              {/* Coverage Meter Bar */}
              <div className="bg-brand-peach/40 mt-2 h-2.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-brand-tomato h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (audit.overall.coveredCount /
                        Math.max(audit.overall.totalCriteria, 1)) *
                        100
                    )}%`,
                  }}
                />
              </div>

              {/* Status Breakdown Pills */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  <span>✓</span>
                  <span>{audit.overall.coveredCount} Covered</span>
                </span>
                {audit.overall.partiallyCoveredCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                    <span>◐</span>
                    <span>
                      {audit.overall.partiallyCoveredCount} Partially covered
                    </span>
                  </span>
                )}
                {audit.overall.missingCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-700">
                    <span>○</span>
                    <span>{audit.overall.missingCount} Missing</span>
                  </span>
                )}
                {audit.overall.incorrectCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                    <span>✕</span>
                    <span>{audit.overall.incorrectCount} Needs correction</span>
                  </span>
                )}
              </div>
            </div>

            {/* Uncertainty Warning if Audio was cut off or muffled */}
            {audit.hasUncertainty && (
              <div className="mt-3 flex items-start gap-2 text-xs text-amber-800">
                <span className="shrink-0 font-bold">⚠️</span>
                <p>
                  {audit.uncertaintyNotes ||
                    "Audio quality or transcript was brief; evaluations reflect the audible portions."}
                </p>
              </div>
            )}
          </div>

          {/* Section B: What You Covered */}
          {coveredCriteria.length > 0 && (
            <div className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700">
                  ✓
                </div>
                <div>
                  <h3 className="font-heading text-brand-ink text-base font-bold">
                    What you covered ({coveredCriteria.length})
                  </h3>
                  <p className="text-brand-secondary text-xs">
                    Concepts you explained accurately in your own words.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {coveredCriteria.map((item) => {
                  const catMeta = RUBRIC_CATEGORY_META[item.category];
                  return (
                    <div
                      key={item.criterionId}
                      className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-heading text-brand-ink text-sm font-bold">
                          {item.criterionName}
                        </span>
                        {catMeta && (
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${catMeta.badgeBg} ${catMeta.badgeText} ${catMeta.badgeBorder}`}
                          >
                            {catMeta.studentLabel}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-stone-700">
                        {item.explanation}
                      </p>

                      {item.transcriptEvidence && (
                        <div className="border-brand-peach/40 bg-brand-cream/60 mt-2.5 rounded-lg border px-3 py-1.5 text-xs text-stone-800">
                          <span className="text-brand-secondary text-[11px] font-semibold">
                            What you said:{" "}
                          </span>
                          <span className="italic">
                            &ldquo;{item.transcriptEvidence}&rdquo;
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section C: What Needs More Attention (Partially Covered & Missing) */}
          {needsAttentionCriteria.length > 0 && (
            <div className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-800">
                  ◐
                </div>
                <div>
                  <h3 className="font-heading text-brand-ink text-base font-bold">
                    What needs more attention ({needsAttentionCriteria.length})
                  </h3>
                  <p className="text-brand-secondary text-xs">
                    Concepts that were omitted or need more explanation.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {needsAttentionCriteria.map((item) => {
                  const catMeta = RUBRIC_CATEGORY_META[item.category];
                  const statusMeta = CRITERION_STATUS_META[item.status];
                  return (
                    <div
                      key={item.criterionId}
                      className="border-brand-peach/60 bg-brand-cream/30 rounded-xl border p-4 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-heading text-brand-ink text-sm font-bold">
                          {item.criterionName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {catMeta && (
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${catMeta.badgeBg} ${catMeta.badgeText} ${catMeta.badgeBorder}`}
                            >
                              {catMeta.studentLabel}
                            </span>
                          )}
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.badgeBorder}`}
                          >
                            {statusMeta.studentLabel}
                          </span>
                        </div>
                      </div>

                      <p className="mt-1 text-xs text-stone-700">
                        {item.explanation}
                      </p>

                      {/* What was missing */}
                      {item.missingOrInaccurate && (
                        <p className="mt-1.5 text-xs font-medium text-amber-900">
                          <strong>Missing detail:</strong>{" "}
                          {item.missingOrInaccurate}
                        </p>
                      )}

                      {/* How to improve */}
                      <div className="bg-brand-cream/80 border-brand-peach/50 mt-2.5 rounded-lg border p-2.5 text-xs text-stone-800">
                        <span className="text-brand-tomato font-bold">
                          💡 How to improve:{" "}
                        </span>
                        <span>{item.improvementSuggestion}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section D: What Needs Correction (Factual Contradictions strictly separated) */}
          {incorrectCriteria.length > 0 && (
            <div className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-sm font-bold text-rose-800">
                  ✕
                </div>
                <div>
                  <h3 className="font-heading text-brand-ink text-base font-bold">
                    What needs correction ({incorrectCriteria.length})
                  </h3>
                  <p className="text-brand-secondary text-xs">
                    Explanations that conflicted with the reference material.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {incorrectCriteria.map((item) => {
                  const catMeta = RUBRIC_CATEGORY_META[item.category];
                  return (
                    <div
                      key={item.criterionId}
                      className="rounded-xl border border-rose-200 bg-rose-50/30 p-4 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-heading text-brand-ink text-sm font-bold">
                          {item.criterionName}
                        </span>
                        {catMeta && (
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${catMeta.badgeBg} ${catMeta.badgeText} ${catMeta.badgeBorder}`}
                          >
                            {catMeta.studentLabel}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-stone-800">
                        {item.explanation}
                      </p>

                      {item.transcriptEvidence && (
                        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-1.5 text-xs text-rose-950">
                          <span className="text-[11px] font-semibold text-rose-800">
                            What you said:{" "}
                          </span>
                          <span className="italic">
                            &ldquo;{item.transcriptEvidence}&rdquo;
                          </span>
                        </div>
                      )}

                      {/* Accurate Correction Guidance */}
                      <div className="bg-brand-cream/80 border-brand-peach/60 mt-2.5 rounded-lg border p-2.5 text-xs text-stone-800">
                        <span className="text-brand-tomato font-bold">
                          💡 Correction:{" "}
                        </span>
                        <span>{item.improvementSuggestion}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section E: Your Spoken Answer (Transcript & Reference Answer toggle) */}
          <div className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs">
            <h3 className="font-heading text-brand-ink mb-1 text-sm font-bold tracking-wider uppercase">
              Your spoken answer
            </h3>
            <p className="text-brand-secondary mb-3 text-xs">
              Here is the finalized transcript of what you said during your
              practice session.
            </p>

            <div className="bg-brand-cream/40 border-brand-peach/60 text-brand-ink max-h-48 overflow-y-auto rounded-xl border p-4 text-xs leading-relaxed whitespace-pre-wrap">
              {attempt.transcript || "No words captured in this attempt."}
            </div>

            {/* Collapsible Source Reference Answer Toggle */}
            {activeQuestion && (
              <div className="border-brand-peach/40 mt-4 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowReferenceAnswer(!showReferenceAnswer)}
                  className="text-brand-tomato hover:text-brand-tomato-hover flex cursor-pointer items-center gap-1.5 text-xs font-semibold"
                >
                  <span>
                    {showReferenceAnswer ? "Hide" : "Show"} reference answer
                  </span>
                  <span>{showReferenceAnswer ? "▲" : "▼"}</span>
                </button>

                {showReferenceAnswer && (
                  <div className="bg-brand-cream/60 text-brand-ink border-brand-peach/60 mt-3 rounded-xl border p-4 text-xs leading-relaxed">
                    <p className="font-semibold text-stone-700">
                      {attempt.scope === "paragraph" &&
                      typeof attempt.paragraphIndex === "number"
                        ? `Reference Answer for Paragraph ${attempt.paragraphIndex + 1}:`
                        : "Original Reference Answer from Notes:"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {attempt.scope === "paragraph" &&
                      typeof attempt.paragraphIndex === "number"
                        ? attempt.paragraphText ||
                          audit?.scope.targetText ||
                          extractParagraphs(activeQuestion.referenceAnswer)[
                            attempt.paragraphIndex
                          ] ||
                          activeQuestion.referenceAnswer
                        : activeQuestion.referenceAnswer}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comparison with Previous Attempt Card */}
          {previousAttempt &&
            checkScopeCompatibility(previousAttempt, attempt).compatible && (
              <div className="border-brand-peach/80 bg-brand-cream/50 flex flex-col gap-3 rounded-2xl border p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-brand-tomato rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                      Learning Progress
                    </span>
                    <span className="text-brand-secondary text-xs">
                      Earlier attempt found
                    </span>
                  </div>
                  <h4 className="font-heading text-brand-ink mt-1 text-sm font-bold">
                    Compare this attempt with your previous response
                  </h4>
                  <p className="text-brand-secondary mt-0.5 text-xs">
                    See which concepts you maintained, improved, or still need
                    to review.
                  </p>
                </div>

                <Link
                  href={`/study/${studySet.id}/compare?a=${previousAttempt.id}&b=${attempt.id}`}
                  className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
                >
                  <span>Compare progress &rarr;</span>
                </Link>
              </div>
            )}

          {/* Section F: Suggested Next Improvement */}
          {audit.overall.suggestedNextImprovement && (
            <div className="border-brand-peach/80 bg-brand-cream/40 rounded-2xl border p-5 shadow-xs">
              <span className="text-brand-tomato text-[10px] font-bold tracking-wider uppercase">
                Suggested Next Step
              </span>
              <p className="font-heading text-brand-ink mt-1 text-sm font-bold">
                {audit.overall.suggestedNextImprovement}
              </p>
            </div>
          )}

          {/* Bottom Action Controls */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={`/study/${studySet.id}/practice?questionId=${attempt.questionId}`}
              className="border-brand-peach/80 hover:bg-brand-cream/60 text-brand-ink inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-5 py-2.5 text-xs font-bold shadow-2xs transition"
            >
              <span>↻ Practise this question again</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/study/${studySet.id}/history?questionId=${attempt.questionId}`}
                className="border-brand-peach/80 text-brand-secondary hover:text-brand-ink inline-flex cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-xs font-semibold transition"
              >
                <span>Attempt history</span>
              </Link>

              <Link
                href={`/review/${studySet.id}`}
                className="border-brand-peach/80 text-brand-secondary hover:text-brand-ink inline-flex cursor-pointer items-center justify-center rounded-xl border px-4 py-2.5 text-xs font-semibold transition"
              >
                <span>Back to study set</span>
              </Link>

              {activeQuestion &&
                questionIndex >= 0 &&
                questionIndex < studySet.questions.length - 1 && (
                  <Link
                    href={`/study/${studySet.id}/practice?questionId=${studySet.questions[questionIndex + 1]?.id}`}
                    className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-xs transition"
                  >
                    <span>Next question &rarr;</span>
                  </Link>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
