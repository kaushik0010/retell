"use client";

import React from "react";
import Link from "next/link";
import { ProgressSummaryData } from "@/lib/domain/attempt-comparison";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowsUpDownIcon,
  CheckIcon,
  SparklesIcon,
} from "@/components/icons";

interface ProgressSummaryCardProps {
  data: ProgressSummaryData;
  studySetId: string;
}

export function ProgressSummaryCard({
  data,
  studySetId,
}: ProgressSummaryCardProps) {
  const { outcome } = data;

  // Outcome-driven color configurations adhering to Retell's Butter & Tomato system
  const themeConfig = {
    improvement: {
      cardBg: "bg-emerald-50/70 border-emerald-200/80",
      iconBox: "bg-emerald-100 text-emerald-700",
      statusBadge: "bg-emerald-100 text-emerald-800",
      currentBar: "bg-emerald-600",
      currentPercentText: "text-emerald-700",
      divider: "border-emerald-200/70",
      sparkleText: "text-emerald-600",
      renderIcon: () => <ArrowTrendingUpIcon className="h-5 w-5" />,
    },
    regression: {
      cardBg: "bg-rose-50/70 border-rose-200/80",
      iconBox: "bg-rose-100 text-rose-700",
      statusBadge: "bg-rose-100 text-rose-800",
      currentBar: "bg-rose-500",
      currentPercentText: "text-rose-700",
      divider: "border-rose-200/70",
      sparkleText: "text-rose-600",
      renderIcon: () => <ArrowTrendingDownIcon className="h-5 w-5" />,
    },
    mixed_progress: {
      cardBg: "bg-amber-50/70 border-amber-200/80",
      iconBox: "bg-amber-100 text-amber-800",
      statusBadge: "bg-amber-100 text-amber-800",
      currentBar: "bg-amber-500",
      currentPercentText: "text-amber-800",
      divider: "border-amber-200/70",
      sparkleText: "text-amber-600",
      renderIcon: () => <ArrowsUpDownIcon className="h-5 w-5" />,
    },
    no_change: {
      cardBg: "bg-brand-cream/60 border-brand-peach/80",
      iconBox: "bg-white border border-brand-peach/80 text-brand-secondary",
      statusBadge: "bg-stone-100 text-stone-700",
      currentBar: "bg-brand-tomato",
      currentPercentText: "text-brand-secondary",
      divider: "border-brand-peach/60",
      sparkleText: "text-brand-tomato",
      renderIcon: () => <CheckIcon className="h-5 w-5" />,
    },
  }[outcome];

  return (
    <section
      aria-label="Progress summary"
      className={`rounded-2xl border p-5 shadow-xs transition sm:p-6 ${themeConfig.cardBg}`}
    >
      {/* Top row: Status header, headline & full comparison CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${themeConfig.iconBox}`}
          >
            {themeConfig.renderIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-brand-ink text-xs font-bold sm:text-sm">
                Your progress
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${themeConfig.statusBadge}`}
              >
                {data.statusLabel}
              </span>
            </div>
            <div className="font-heading text-brand-ink mt-0.5 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {data.headline}
            </div>
            <p className="text-brand-secondary mt-0.5 text-xs sm:text-sm">
              {data.subheadline}
            </p>
          </div>
        </div>

        <Link
          href={`/study/${studySetId}/compare?a=${data.earlierAttempt.id}&b=${data.laterAttempt.id}`}
          className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition sm:self-start"
        >
          <span>View full comparison</span>
          <span>&rarr;</span>
        </Link>
      </div>

      {/* Middle row: Visual Attempt-to-Attempt comparison cards */}
      <div className="mt-5 grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        {/* Previous attempt card */}
        <div className="border-brand-peach/60 rounded-xl border bg-white p-3.5 shadow-2xs sm:p-4">
          <span className="text-brand-secondary block text-[11px] font-semibold tracking-wider uppercase">
            Previous attempt
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-heading text-brand-ink text-lg font-bold sm:text-xl">
              {data.earlierCovered} of {data.totalCriteria}
            </span>
            <span className="text-brand-secondary text-xs font-medium">
              concepts
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, data.earlierPercentage))}%`,
              }}
            />
          </div>
          <span className="text-brand-secondary mt-1.5 block text-xs font-medium">
            {data.earlierPercentage}% covered
          </span>
        </div>

        {/* Directional arrow (desktop only) */}
        <div className="text-brand-secondary/60 hidden items-center justify-center px-1 text-base font-bold sm:flex">
          &rarr;
        </div>

        {/* This attempt (current) card */}
        <div className="border-brand-peach/60 rounded-xl border bg-white p-3.5 shadow-2xs sm:p-4">
          <span className="text-brand-secondary block text-[11px] font-semibold tracking-wider uppercase">
            This attempt (current)
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-heading text-brand-ink text-lg font-bold sm:text-xl">
              {data.laterCovered} of {data.totalCriteria}
            </span>
            <span className="text-brand-secondary text-xs font-medium">
              concepts
            </span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${themeConfig.currentBar}`}
              style={{
                width: `${Math.min(100, Math.max(0, data.laterPercentage))}%`,
              }}
            />
          </div>
          <span
            className={`mt-1.5 block text-xs font-semibold ${themeConfig.currentPercentText}`}
          >
            {data.laterPercentage}% covered
          </span>
        </div>
      </div>

      {/* Bottom row: What changed explanation */}
      {data.mostMeaningfulChange && (
        <div
          className={`mt-4 flex items-start gap-2 border-t pt-3 text-xs sm:text-sm ${themeConfig.divider}`}
        >
          <SparklesIcon
            className={`mt-0.5 h-4 w-4 shrink-0 ${themeConfig.sparkleText}`}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-heading text-brand-ink font-bold">
              What changed?
            </span>
            <span className="text-brand-ink font-medium">
              {data.mostMeaningfulChange}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
