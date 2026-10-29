"useclient";

import React, { useEffect, useRef } from "react";

interface LiveTranscriptProps {
  transcript: string;
  interimText?: string;
  isListening: boolean;
  wordCount: number;
  isFinishing?: boolean;
}

export function LiveTranscript({
  transcript,
  interimText = "",
  isListening,
  wordCount,
  isFinishing,
}: LiveTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new speech arrives
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcript, interimText]);

  const hasWords = Boolean(
    transcript.trim().length > 0 || interimText.trim().length > 0
  );

  return (
    <div className="border-brand-peach/80 bg-brand-white flex min-h-[180px] w-full flex-col justify-between rounded-2xl border p-5 shadow-xs">
      <div className="mb-2 flex items-center justify-between border-b border-stone-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-heading text-brand-ink text-xs font-bold tracking-wider uppercase">
            Live Spoken Transcript
          </span>
          {isListening && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-500" />
              Live
            </span>
          )}
          {isFinishing && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Finalizing...
            </span>
          )}
        </div>

        <span className="text-brand-secondary text-xs font-medium">
          {wordCount} {wordCount === 1 ? "word" : "words"} spoken
        </span>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        aria-label="Spoken transcript"
        className="max-h-[220px] min-h-[110px] overflow-y-auto pr-1 text-sm leading-relaxed"
      >
        {!hasWords ? (
          <div className="text-brand-secondary flex h-full min-h-[110px] flex-col items-center justify-center text-center text-xs italic">
            <p>Your spoken words will appear here in real time.</p>
            <p className="mt-1 text-[11px] opacity-75">
              Press &ldquo;Start speaking&rdquo; and explain the concept aloud.
            </p>
          </div>
        ) : (
          <div className="text-brand-ink break-words whitespace-pre-wrap">
            <span>{transcript}</span>
            {interimText && (
              <span className="text-brand-tomato/80 ml-1 italic">
                {interimText}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
