"useclient";

import React from "react";

interface PauseNudgeProps {
  isVisible: boolean;
  pauseDurationSec: number;
  onDismiss?: () => void;
  hint?: string;
}

export function PauseNudge({
  isVisible,
  pauseDurationSec,
  onDismiss,
  hint,
}: PauseNudgeProps) {
  if (!isVisible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-in fade-in slide-in-from-top-2 border-brand-peach/80 bg-brand-cream/80 w-full rounded-2xl border p-4 shadow-xs transition duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="bg-brand-butter text-brand-ink flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base font-bold">
          💡
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-heading text-brand-ink text-xs font-bold tracking-wider uppercase">
              Take your time
            </span>
            {pauseDurationSec > 0 && (
              <span className="text-brand-secondary text-[11px]">
                ({pauseDurationSec}s pause)
              </span>
            )}
          </div>
          <p className="text-brand-ink mt-0.5 text-xs leading-relaxed">
            {hint ||
              "There's no rush! Think about the key steps and explain them naturally in your own words. Retell will keep listening."}
          </p>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-brand-secondary hover:text-brand-ink -mt-1 -mr-1 p-1 text-xs"
            aria-label="Dismiss hint"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
