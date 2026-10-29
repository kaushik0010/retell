"use client";

import React from "react";

interface ContextualHintProps {
  isVisible: boolean;
  hintText?: string | null;
  onDismiss?: () => void;
}

export function ContextualHint({
  isVisible,
  hintText,
  onDismiss,
}: ContextualHintProps) {
  if (!isVisible || !hintText) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-in fade-in slide-in-from-top-1 border-brand-peach/80 bg-brand-cream flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 shadow-2xs transition"
    >
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <span className="shrink-0 text-sm" aria-hidden="true">
          💡
        </span>
        <span className="font-heading text-brand-secondary shrink-0 text-[11px] font-bold tracking-wider uppercase">
          Recall cue:
        </span>
        <span className="font-heading text-brand-ink truncate font-semibold">
          {hintText}
        </span>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-brand-secondary hover:text-brand-ink -mr-1 shrink-0 cursor-pointer p-1 text-xs"
          aria-label="Dismiss hint"
        >
          ✕
        </button>
      )}
    </div>
  );
}
