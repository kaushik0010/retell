"useclient";

import React, { useMemo } from "react";

interface WaveformVisualizerProps {
  isListening: boolean;
  volume: number; // Normalized 0 to 1
  durationSeconds: number;
}

export function WaveformVisualizer({
  isListening,
  volume,
  durationSeconds,
}: WaveformVisualizerProps) {
  // Format MM:SS
  const timerText = useMemo(() => {
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [durationSeconds]);

  // Compute bar heights based on current volume and pseudo-random offsets for lively visualization
  const barCount = 16;
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => {
      if (!isListening) return 12; // Flat idle height (12%)
      // Create a natural waveform curve centered in the middle
      const centerFactor = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
      const randomOffset = Math.sin(i * 1.5 + durationSeconds * 2) * 0.2;
      const heightPercent = Math.min(
        100,
        Math.max(15, volume * 85 * centerFactor + randomOffset * 25)
      );
      return Math.round(heightPercent);
    });
  }, [isListening, volume, durationSeconds]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Audio Visualizer Bars */}
      <div
        className="flex h-14 w-full max-w-sm items-center justify-center gap-1.5 px-4"
        aria-hidden="true"
      >
        {bars.map((height, idx) => {
          const isHigh = height > 60;
          return (
            <div
              key={idx}
              className={`w-1.5 rounded-full transition-all duration-100 ease-out ${
                !isListening
                  ? "bg-brand-peach/80 h-3"
                  : isHigh
                    ? "bg-brand-tomato"
                    : "bg-brand-butter"
              }`}
              style={{
                height: `${height}%`,
                minHeight: "6px",
              }}
            />
          );
        })}
      </div>

      {/* Recording Status & Timer */}
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isListening
              ? "bg-brand-tomato animate-pulse ring-4 ring-red-100"
              : "bg-brand-secondary/40"
          }`}
        />
        <span className="font-heading text-brand-ink text-sm font-semibold tracking-wider">
          {timerText}
        </span>
        <span className="text-brand-secondary text-xs">
          {isListening ? "Listening aloud" : "Ready"}
        </span>
      </div>
    </div>
  );
}
