"use client";

import React from "react";
import { ContextualHint } from "./ContextualHint";

interface PauseNudgeProps {
  isVisible: boolean;
  pauseDurationSec?: number;
  onDismiss?: () => void;
  hint?: string | null;
}

/**
 * Contextual Pause Recall Hint component.
 * Replaces the generic motivational pause card with an answer-grounded cue.
 */
export function PauseNudge({ isVisible, onDismiss, hint }: PauseNudgeProps) {
  return (
    <ContextualHint
      isVisible={isVisible}
      hintText={hint}
      onDismiss={onDismiss}
    />
  );
}
