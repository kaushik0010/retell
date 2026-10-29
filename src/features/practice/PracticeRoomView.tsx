"useclient";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  StudySet,
  ExtractedQuestion,
  RUBRIC_CATEGORY_META,
} from "@/lib/domain/study-set";
import {
  PracticeAttempt,
  PracticeSessionState,
  calculateWordCount,
  createAttemptId,
} from "@/lib/domain/practice-session";
import { savePracticeAttempt } from "@/lib/storage/study-store";
import { AudioCaptureController } from "@/lib/audio/capture";
import { TranscribeClient } from "@/lib/audio/transcribe-client";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { LiveTranscript } from "./LiveTranscript";
import { PauseNudge } from "./PauseNudge";

interface PracticeRoomViewProps {
  studySet: StudySet;
  initialQuestionId?: string;
}

export function PracticeRoomView({
  studySet,
  initialQuestionId,
}: PracticeRoomViewProps) {
  // Active question selection
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>(() => {
    if (
      initialQuestionId &&
      studySet.questions.some((q) => q.id === initialQuestionId)
    ) {
      return initialQuestionId;
    }
    return studySet.questions[0]?.id || "";
  });

  const activeQuestionIndex = useMemo(() => {
    const idx = studySet.questions.findIndex(
      (q) => q.id === selectedQuestionId
    );
    return idx >= 0 ? idx : 0;
  }, [studySet.questions, selectedQuestionId]);

  const activeQuestion: ExtractedQuestion | undefined =
    studySet.questions[activeQuestionIndex];

  // Associated rubric criteria
  const activeRubric = activeQuestion
    ? studySet.rubrics[activeQuestion.id]
    : undefined;

  // Collapsible sections
  const [showReferenceAnswer, setShowReferenceAnswer] = useState(false);
  const [showPointsChecklist, setShowPointsChecklist] = useState(true);

  // Session state machine
  const [sessionState, setSessionState] =
    useState<PracticeSessionState>("idle");
  const [volume, setVolume] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [pauseDurationSec, setPauseDurationSec] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedAttempt, setLastSavedAttempt] =
    useState<PracticeAttempt | null>(null);

  // Audio refs
  const captureControllerRef = useRef<AudioCaptureController | null>(null);
  const transcribeClientRef = useRef<TranscribeClient | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      captureControllerRef.current?.stop();
      transcribeClientRef.current?.close();
    };
  }, []);

  // Handle question switch
  const handleSwitchQuestion = (questionId: string) => {
    if (sessionState === "listening" || sessionState === "connecting") {
      const confirmSwitch = window.confirm(
        "You have an active practice attempt in progress. Stop and switch questions?"
      );
      if (!confirmSwitch) return;
      handleCancelPractice();
    }
    setSelectedQuestionId(questionId);
    setSessionState("idle");
    setTranscript("");
    setInterimText("");
    setDurationSeconds(0);
    setLastSavedAttempt(null);
    setErrorMessage(null);
  };

  const handleAudioError = (err: unknown) => {
    const msg =
      err instanceof Error
        ? err.message
        : "Could not access your microphone or establish connection.";
    console.error("Practice room audio error:", err);

    let friendlyMessage = msg;
    if (
      msg.includes("Permission denied") ||
      msg.includes("NotAllowedError") ||
      msg.includes("PermissionDismissedError")
    ) {
      friendlyMessage =
        "Microphone access was denied. Please allow microphone permissions in your browser address bar to practise speaking.";
    } else if (
      msg.includes("NotFoundError") ||
      msg.includes("DevicesNotFoundError")
    ) {
      friendlyMessage =
        "No microphone detected on your device. Please plug in a microphone or headset and try again.";
    }

    setErrorMessage(friendlyMessage);
    setSessionState("error");
    if (timerRef.current) clearInterval(timerRef.current);
    captureControllerRef.current?.stop();
    transcribeClientRef.current?.close();
  };

  // Start practicing
  const handleStartPractice = async () => {
    try {
      setErrorMessage(null);
      setSessionState("requesting_permission");
      setTranscript("");
      setInterimText("");
      setDurationSeconds(0);
      setIsPaused(false);
      setLastSavedAttempt(null);

      // 1. Initialize server-relay transcribe client
      const client = new TranscribeClient({
        onTranscriptDelta: (text, isFinal) => {
          if (isFinal) {
            setTranscript(text);
            setInterimText("");
          } else {
            setInterimText(text);
          }
        },
        onAudioProgress: () => {},
        onError: (errText) => {
          console.warn("Transcribe streaming notice:", errText);
        },
        onStateChange: (st) => {
          if (st === "listening") {
            setSessionState("listening");
          }
        },
      });

      await client.start();
      transcribeClientRef.current = client;

      // 2. Start browser audio capture
      const capture = new AudioCaptureController(
        {
          onAudioChunk: (chunk) => {
            client.sendAudioChunk(chunk);
          },
          onVolumeChange: (vol) => {
            setVolume(vol);
          },
          onPauseStateChange: (paused, pauseSec) => {
            setIsPaused(paused);
            setPauseDurationSec(pauseSec);
          },
          onError: (err) => {
            handleAudioError(err);
          },
        },
        { sampleRate: 24000 }
      );

      await capture.start();
      captureControllerRef.current = capture;

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setDurationSeconds((d) => d + 1);
      }, 1000);

      setSessionState("listening");
    } catch (err: unknown) {
      handleAudioError(err);
    }
  };

  // Finish practice attempt
  const handleFinishPractice = async () => {
    if (!activeQuestion) return;
    setSessionState("finishing");
    if (timerRef.current) clearInterval(timerRef.current);

    // Stop recording capture
    captureControllerRef.current?.stop();
    captureControllerRef.current = null;

    // Flush & finalize transcribe client
    let finalWords = transcript;
    try {
      const serverFinal = await transcribeClientRef.current?.finish();
      if (serverFinal && serverFinal.trim().length > 0) {
        finalWords = serverFinal.trim();
      }
    } catch (err) {
      console.warn("Could not retrieve server final transcript:", err);
    }
    transcribeClientRef.current = null;

    const fullTranscript = finalWords.trim() || transcript.trim();
    setTranscript(fullTranscript);
    setInterimText("");

    // Persist attempt to IndexedDB
    const attempt: PracticeAttempt = {
      id: createAttemptId(),
      studySetId: studySet.id,
      questionId: activeQuestion.id,
      transcript: fullTranscript,
      wordCount: calculateWordCount(fullTranscript),
      durationSeconds,
      status: "completed",
      createdAt: new Date().toISOString(),
    };

    try {
      await savePracticeAttempt(attempt);
      setLastSavedAttempt(attempt);
    } catch (saveErr) {
      console.error("Failed to save practice attempt:", saveErr);
    }

    setSessionState("completed");
  };

  // Cancel attempt without saving
  const handleCancelPractice = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    captureControllerRef.current?.stop();
    captureControllerRef.current = null;
    transcribeClientRef.current?.close();
    transcribeClientRef.current = null;

    setSessionState("idle");
    setTranscript("");
    setInterimText("");
    setDurationSeconds(0);
    setIsPaused(false);
  };

  const wordCount = useMemo(() => {
    const combined = `${transcript} ${interimText}`.trim();
    return calculateWordCount(combined);
  }, [transcript, interimText]);

  if (!activeQuestion) {
    return (
      <div className="mx-auto max-w-4xl p-6 text-center">
        <p className="text-brand-secondary">
          No questions found in this study set.
        </p>
        <Link
          href={`/review/${studySet.id}`}
          className="text-brand-tomato hover:text-brand-tomato-hover mt-3 inline-block font-semibold"
        >
          &larr; Return to Study Set
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      {/* Top Header & Breadcrumb Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/review/${studySet.id}`}
            className="text-brand-tomato hover:text-brand-tomato-hover inline-flex items-center gap-1.5 text-xs font-bold"
          >
            <span>&larr;</span>
            <span>Back to points review</span>
          </Link>
          <h1 className="font-heading text-brand-ink mt-1 text-2xl font-bold tracking-tight">
            Practice Room
          </h1>
          <p className="text-brand-secondary text-xs">
            Practise explaining your exam answers aloud. Retell transcribes your
            words in real time.
          </p>
        </div>

        {/* Question Switcher (if multiple questions) */}
        {studySet.questions.length > 1 && (
          <div className="border-brand-peach/80 flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5 shadow-2xs">
            <button
              type="button"
              disabled={
                activeQuestionIndex <= 0 || sessionState === "listening"
              }
              onClick={() =>
                handleSwitchQuestion(
                  studySet.questions[activeQuestionIndex - 1]!.id
                )
              }
              className="text-brand-ink disabled:text-brand-secondary/40 hover:bg-brand-cream/60 cursor-pointer rounded p-1 text-xs font-bold transition disabled:cursor-not-allowed"
              title="Previous question"
            >
              &larr;
            </button>
            <span className="text-brand-ink text-xs font-semibold">
              Question {activeQuestionIndex + 1} of {studySet.questions.length}
            </span>
            <button
              type="button"
              disabled={
                activeQuestionIndex >= studySet.questions.length - 1 ||
                sessionState === "listening"
              }
              onClick={() =>
                handleSwitchQuestion(
                  studySet.questions[activeQuestionIndex + 1]!.id
                )
              }
              className="text-brand-ink disabled:text-brand-secondary/40 hover:bg-brand-cream/60 cursor-pointer rounded p-1 text-xs font-bold transition disabled:cursor-not-allowed"
              title="Next question"
            >
              &rarr;
            </button>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="animate-in fade-in rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 shadow-xs">
          <div className="flex items-start gap-2">
            <span className="font-bold">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold">{errorMessage}</p>
              <button
                type="button"
                onClick={handleStartPractice}
                className="bg-brand-tomato hover:bg-brand-tomato-hover mt-2 inline-flex cursor-pointer items-center rounded-lg px-3 py-1 font-bold text-white shadow-2xs transition"
              >
                Try again
              </button>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Practice Canvas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Question & Speech Capture (8 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Question Card */}
          <div className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="bg-brand-butter text-brand-ink rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                Question {activeQuestionIndex + 1}
              </span>
              {activeQuestion.pageNumber && (
                <span className="text-brand-secondary text-[11px]">
                  Page {activeQuestion.pageNumber}
                </span>
              )}
            </div>

            <h2 className="font-heading text-brand-ink text-lg leading-snug font-bold">
              {activeQuestion.question}
            </h2>

            {/* Collapsible Reference Answer */}
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
                    Source Reference Answer:
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {activeQuestion.referenceAnswer}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Spoken Practice Canvas */}
          <div className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs">
            {/* Idle State */}
            {sessionState === "idle" && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="bg-brand-cream text-brand-tomato border-brand-peach/60 mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner">
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z"
                    />
                  </svg>
                </div>

                <h3 className="font-heading text-brand-ink text-base font-bold">
                  Ready to test your active recall?
                </h3>
                <p className="text-brand-secondary mt-1 max-w-sm text-xs leading-relaxed">
                  Explain the answer aloud in your own words. Retell will
                  listen, transcribe, and keep you on track.
                </p>

                <button
                  type="button"
                  onClick={handleStartPractice}
                  className="bg-brand-tomato hover:bg-brand-tomato-hover mt-5 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 font-bold text-white shadow-xs transition"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3z"
                    />
                  </svg>
                  <span>Start speaking</span>
                </button>
              </div>
            )}

            {/* Requesting Permission / Connecting State */}
            {(sessionState === "requesting_permission" ||
              sessionState === "connecting") && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="border-brand-tomato h-10 w-10 animate-spin rounded-full border-3 border-t-transparent" />
                <p className="font-heading text-brand-ink mt-4 text-sm font-semibold">
                  {sessionState === "requesting_permission"
                    ? "Allow microphone access..."
                    : "Connecting to transcription room..."}
                </p>
                <p className="text-brand-secondary mt-1 text-xs">
                  Please tap &ldquo;Allow&rdquo; if your browser prompts for
                  microphone permission.
                </p>
              </div>
            )}

            {/* Active Listening / Recording State */}
            {(sessionState === "listening" || sessionState === "finishing") && (
              <div className="space-y-5">
                {/* Waveform & Duration */}
                <WaveformVisualizer
                  isListening={sessionState === "listening"}
                  volume={volume}
                  durationSeconds={durationSeconds}
                />

                {/* Pause Nudge */}
                <PauseNudge
                  isVisible={isPaused && sessionState === "listening"}
                  pauseDurationSec={pauseDurationSec}
                  onDismiss={() => setIsPaused(false)}
                />

                {/* Live Transcript Display */}
                <LiveTranscript
                  transcript={transcript}
                  interimText={interimText}
                  isListening={sessionState === "listening"}
                  wordCount={wordCount}
                  isFinishing={sessionState === "finishing"}
                />

                {/* Controls */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleCancelPractice}
                    disabled={sessionState === "finishing"}
                    className="border-brand-peach/80 text-brand-secondary hover:text-brand-ink order-2 cursor-pointer rounded-xl border px-4 py-2.5 text-xs font-semibold transition hover:bg-stone-50 sm:order-1"
                  >
                    Cancel attempt
                  </button>

                  <button
                    type="button"
                    onClick={handleFinishPractice}
                    disabled={sessionState === "finishing"}
                    className="bg-brand-tomato hover:bg-brand-tomato-hover order-1 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-75 sm:order-2"
                  >
                    {sessionState === "finishing" ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Finalizing...</span>
                      </>
                    ) : (
                      <>
                        <span>Finish attempt</span>
                        <span>&rarr;</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Attempt Completed Summary State */}
            {sessionState === "completed" && (
              <div className="space-y-5 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-lg text-emerald-700">
                    ✓
                  </div>
                  <div>
                    <h3 className="font-heading text-brand-ink text-base font-bold">
                      Practice attempt complete!
                    </h3>
                    <p className="text-brand-secondary text-xs">
                      Your spoken response has been recorded and safely saved to
                      your device.
                    </p>
                  </div>
                </div>

                {/* Attempt Metrics Card */}
                <div className="bg-brand-cream/70 border-brand-peach/60 grid grid-cols-2 gap-3 rounded-xl border p-4 text-center">
                  <div>
                    <span className="text-brand-secondary text-[11px] font-semibold tracking-wider uppercase">
                      Spoken Words
                    </span>
                    <p className="font-heading text-brand-ink text-xl font-bold">
                      {lastSavedAttempt?.wordCount || wordCount}
                    </p>
                  </div>
                  <div>
                    <span className="text-brand-secondary text-[11px] font-semibold tracking-wider uppercase">
                      Duration
                    </span>
                    <p className="font-heading text-brand-ink text-xl font-bold">
                      {lastSavedAttempt?.durationSeconds || durationSeconds}s
                    </p>
                  </div>
                </div>

                {/* Saved Spoken Transcript */}
                <div>
                  <h4 className="font-heading text-brand-ink mb-1 text-xs font-bold tracking-wider uppercase">
                    What you said:
                  </h4>
                  <div className="bg-brand-cream/40 border-brand-peach/60 text-brand-ink max-h-48 overflow-y-auto rounded-xl border p-4 text-xs leading-relaxed whitespace-pre-wrap">
                    {transcript || "No words captured in this attempt."}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleStartPractice}
                    className="border-brand-peach/80 hover:bg-brand-cream/60 text-brand-ink inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-bold transition"
                  >
                    <span>↻ Practise again</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Day 4 Semantic Audit Honest Affordance */}
                    <button
                      type="button"
                      onClick={() =>
                        alert(
                          "Day 4: Semantic Answer Auditing, missing concept detection, and attempt comparison will evaluate this transcript in the next milestone!"
                        )
                      }
                      title="Semantic Answer Evaluation arrives in Day 4"
                      className="bg-brand-butter text-brand-ink inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl px-4 py-2.5 text-xs font-bold shadow-2xs transition hover:opacity-90"
                    >
                      <span>Check points</span>
                      <span className="bg-brand-peach/80 rounded px-1 text-[9px] font-bold">
                        Day 4
                      </span>
                    </button>

                    {activeQuestionIndex < studySet.questions.length - 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSwitchQuestion(
                            studySet.questions[activeQuestionIndex + 1]!.id
                          )
                        }
                        className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
                      >
                        <span>Next question &rarr;</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Key Points to Remember Checklist (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="font-heading text-brand-ink text-sm font-bold">
                  Points to Remember
                </h3>
                <p className="text-brand-secondary text-[11px]">
                  Aim to mention these concepts while explaining your answer.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPointsChecklist(!showPointsChecklist)}
                className="text-brand-secondary hover:text-brand-ink text-xs font-semibold"
              >
                {showPointsChecklist ? "Hide" : "Show"}
              </button>
            </div>

            {showPointsChecklist && (
              <div className="mt-3 space-y-2.5">
                {!activeRubric || activeRubric.criteria.length === 0 ? (
                  <p className="text-brand-secondary py-3 text-center text-xs italic">
                    No points generated yet for this question.
                  </p>
                ) : (
                  activeRubric.criteria.map((criterion, idx) => {
                    const meta = RUBRIC_CATEGORY_META[criterion.category];
                    return (
                      <div
                        key={criterion.id || idx}
                        className="border-brand-peach/50 bg-brand-cream/40 rounded-xl border p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-heading text-brand-ink font-semibold">
                            {criterion.name}
                          </span>
                          <span
                            className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                          >
                            {meta.studentLabel}
                          </span>
                        </div>
                        <p className="text-brand-secondary mt-1 text-[11px] leading-relaxed">
                          {criterion.description}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Practice Tips Card */}
          <div className="border-brand-peach/60 bg-brand-cream/50 rounded-2xl border p-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">🎙️</span>
              <span className="font-heading text-brand-ink font-bold">
                Spoken Practice Tip
              </span>
            </div>
            <p className="text-brand-secondary mt-1.5 text-[11px] leading-relaxed">
              Explaining a concept aloud activates recall pathways in your brain
              that passive re-reading cannot. Even if you pause or stumble,
              completing your explanation builds authentic exam confidence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
