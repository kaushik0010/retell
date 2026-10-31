"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  savePracticeAttempt,
  saveSemanticAuditResult,
} from "@/lib/storage/study-store";
import { AudioCaptureController } from "@/lib/audio/capture";
import { TranscribeClient } from "@/lib/audio/transcribe-client";
import { TranscriptAccumulator } from "@/lib/audio/transcript-accumulator";
import { generateRecallHint } from "@/lib/domain/recall-hints";
import { resolvePracticeScope } from "@/lib/domain/paragraph-scope";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { LiveTranscript } from "./LiveTranscript";
import { ContextualHint } from "./ContextualHint";

interface PracticeRoomViewProps {
  studySet: StudySet;
  initialQuestionId?: string;
}

export function PracticeRoomView({
  studySet,
  initialQuestionId,
}: PracticeRoomViewProps) {
  const router = useRouter();

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

  // Split reference answer into paragraphs for paragraph-level practice
  const activeReference = activeQuestion?.referenceAnswer;
  const paragraphs = useMemo(() => {
    if (!activeReference) return [];
    return activeReference
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [activeReference]);

  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState<
    number | null
  >(null);

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
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);
  const [lastSavedAttempt, setLastSavedAttempt] =
    useState<PracticeAttempt | null>(null);
  const [isRetryingAudit, setIsRetryingAudit] = useState(false);

  // Authoritative transcript accumulator and session refs
  const accumulatorRef = useRef<TranscriptAccumulator>(
    new TranscriptAccumulator()
  );
  const isFinishingRef = useRef<boolean>(false);
  const durationSecondsRef = useRef<number>(0);
  const previousHintsRef = useRef<string[]>([]);
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
    if (
      sessionState === "listening" ||
      sessionState === "connecting" ||
      sessionState === "auditing"
    ) {
      const confirmSwitch = window.confirm(
        "You have an active practice attempt in progress. Stop and switch questions?"
      );
      if (!confirmSwitch) return;
      handleCancelPractice();
    }
    setSelectedQuestionId(questionId);
    setSelectedParagraphIndex(null);
    setSessionState("idle");
    accumulatorRef.current.reset();
    isFinishingRef.current = false;
    previousHintsRef.current = [];
    setCurrentHint(null);
    setTranscript("");
    setInterimText("");
    setDurationSeconds(0);
    durationSecondsRef.current = 0;
    setLastSavedAttempt(null);
    setErrorMessage(null);
    setAuditNotice(null);
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
    isFinishingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    captureControllerRef.current?.stop();
    transcribeClientRef.current?.close();
  };

  // Start practicing
  const handleStartPractice = async () => {
    try {
      setErrorMessage(null);
      setSessionState("requesting_permission");
      accumulatorRef.current.reset();
      isFinishingRef.current = false;
      previousHintsRef.current = [];
      setCurrentHint(null);
      setTranscript("");
      setInterimText("");
      setDurationSeconds(0);
      durationSecondsRef.current = 0;
      setIsPaused(false);
      setLastSavedAttempt(null);

      // 1. Initialize server-relay transcribe client
      const client = new TranscribeClient({
        onTranscriptDelta: (text, isFinal) => {
          // Reject any late events if finishing or completed
          if (
            isFinishingRef.current ||
            sessionState === "finishing" ||
            sessionState === "completed"
          ) {
            return;
          }
          // Notify capture controller to debounce silence / reset pause timer when student is speaking
          captureControllerRef.current?.notifySpeechActivity();
          setIsPaused(false);
          setCurrentHint(null);

          accumulatorRef.current.update(text, isFinal);
          setTranscript(accumulatorRef.current.finalizedText);
          setInterimText(accumulatorRef.current.interimText);
        },
        onAudioProgress: () => {},
        onProviderChange: (provider, details) => {
          // Internal diagnostic logging only (never student-facing)
          console.info(
            "[PracticeRoom] Transcribe provider:",
            provider,
            details
          );
        },
        onError: (errText) => {
          console.warn("Transcribe streaming notice:", errText);
        },
        onStateChange: (st) => {
          if (st === "listening" && !isFinishingRef.current) {
            setSessionState("listening");
          }
        },
      });

      await client.start();
      transcribeClientRef.current = client;

      // Authoritatively resolve scoped reference answer and criteria for hints
      const isParagraphScope = selectedParagraphIndex !== null;
      const resolvedScope = resolvePracticeScope({
        referenceAnswer: activeQuestion?.referenceAnswer || "",
        criteria: activeRubric?.criteria || [],
        scope: isParagraphScope
          ? {
              type: "paragraph",
              paragraphIndex: selectedParagraphIndex,
            }
          : undefined,
      });

      const targetHintReference = resolvedScope.paragraphText;
      const targetHintCriteria = resolvedScope.criteria;

      // 2. Start browser audio capture using browser-provided default microphone (with quiet-voice threshold 0.008)
      const capture = new AudioCaptureController(
        {
          onAudioChunk: (chunk) => {
            client.sendAudioChunk(chunk);
          },
          onVolumeChange: (vol) => {
            setVolume(vol);
          },
          onDeviceDisconnected: (deviceLabel) => {
            setErrorMessage(
              `Microphone "${deviceLabel}" was disconnected. Your spoken words are preserved. You can finish your attempt or reconnect your device.`
            );
          },
          onPauseStateChange: (paused) => {
            if (
              isFinishingRef.current ||
              sessionState === "finishing" ||
              sessionState === "completed"
            ) {
              return;
            }
            setIsPaused(paused);

            if (paused) {
              // Generate source-grounded recall hint from scoped reference answer and criteria
              // No arbitrary 3-hint ceiling: hints continue sequentially throughout the attempt
              const currentFullText =
                accumulatorRef.current.getFullTranscript();
              const hint = generateRecallHint({
                referenceAnswer: targetHintReference,
                criteria: targetHintCriteria,
                currentTranscript: currentFullText,
                previousHints: previousHintsRef.current,
                scopedParagraphIndex:
                  selectedParagraphIndex !== null
                    ? selectedParagraphIndex
                    : undefined,
              });

              if (hint) {
                setCurrentHint(hint.cue);
                previousHintsRef.current.push(hint.cue);
              } else {
                setCurrentHint(null);
              }
            } else {
              // Student resumed speaking -> hide hint immediately
              setCurrentHint(null);
            }
          },
          onError: (err) => {
            handleAudioError(err);
          },
        },
        {
          sampleRate: 24000,
          silenceThresholdRms: 0.008,
        }
      );

      await capture.start();
      captureControllerRef.current = capture;

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        durationSecondsRef.current += 1;
        setDurationSeconds(durationSecondsRef.current);
      }, 1000);

      setSessionState("listening");
    } catch (err: unknown) {
      handleAudioError(err);
    }
  };

  // Finish practice attempt with monotonic transcript preservation and automated semantic audit
  const handleFinishPractice = async () => {
    if (!activeQuestion) return;

    // Prevent duplicate saves from repeated clicks or concurrent triggers
    if (
      isFinishingRef.current ||
      sessionState === "finishing" ||
      sessionState === "auditing" ||
      sessionState === "completed"
    ) {
      return;
    }
    isFinishingRef.current = true;
    setSessionState("finishing");
    setIsPaused(false);
    setCurrentHint(null);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // 1. Stop recording capture immediately (releases microphone hardware)
    captureControllerRef.current?.stop();
    captureControllerRef.current = null;

    // 2. Capture pre-final snapshot of authoritative transcript before async flush
    const preFinalSnapshot = accumulatorRef.current.getFullTranscript();

    // 3. Flush & finalize transcribe client (with bounded timeout)
    let serverFinal = "";
    try {
      if (transcribeClientRef.current) {
        serverFinal = await transcribeClientRef.current.finish();
      }
    } catch (err) {
      console.warn("Notice finalizing transcribe session on server:", err);
    }
    transcribeClientRef.current = null;

    // 4. Finalize accumulator monotonically
    const finalizedText = accumulatorRef.current.finalize(serverFinal);
    // Absolute safety guard: never replace non-empty spoken words with empty string
    const fullTranscript = (
      finalizedText.trim() || preFinalSnapshot.trim()
    ).trim();

    setTranscript(fullTranscript);
    setInterimText("");

    const finalDuration = durationSecondsRef.current;
    const finalWordCount = calculateWordCount(fullTranscript);

    // 5. Persist attempt record to IndexedDB FIRST so student speech is guaranteed safe
    const isParagraphScope = selectedParagraphIndex !== null;
    const resolvedScope = resolvePracticeScope({
      referenceAnswer: activeQuestion.referenceAnswer,
      criteria: activeRubric?.criteria || [],
      scope: isParagraphScope
        ? {
            type: "paragraph",
            paragraphIndex: selectedParagraphIndex,
          }
        : undefined,
    });

    const attempt: PracticeAttempt = {
      id: createAttemptId(),
      studySetId: studySet.id,
      questionId: activeQuestion.id,
      transcript: fullTranscript,
      wordCount: finalWordCount,
      durationSeconds: finalDuration,
      status: "completed",
      scope: isParagraphScope ? "paragraph" : "whole_answer",
      paragraphIndex:
        selectedParagraphIndex !== null ? selectedParagraphIndex : undefined,
      paragraphText: isParagraphScope ? resolvedScope.paragraphText : undefined,
      totalParagraphs: resolvedScope.totalParagraphs,
      createdAt: new Date().toISOString(),
    };

    try {
      await savePracticeAttempt(attempt);
      setLastSavedAttempt(attempt);
    } catch (saveErr) {
      console.error("Failed to save practice attempt to IndexedDB:", saveErr);
      setErrorMessage(
        "Your spoken words are preserved below, but could not be saved to browser storage."
      );
      setLastSavedAttempt(attempt);
    }

    // 6. Transition to auditing state and call semantic audit engine
    setSessionState("auditing");

    try {
      const auditRes = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          studySetId: studySet.id,
          questionId: activeQuestion.id,
          question: activeQuestion.question,
          referenceAnswer: resolvedScope.paragraphText,
          transcript: fullTranscript,
          criteria: resolvedScope.criteria,
          scope: {
            type: attempt.scope,
            paragraphIndex: attempt.paragraphIndex,
            totalParagraphs: resolvedScope.totalParagraphs,
            targetText: resolvedScope.paragraphText,
          },
        }),
      });

      const auditData = await auditRes.json();
      if (auditRes.ok && auditData.success && auditData.audit) {
        // Save audit result alongside attempt in IndexedDB
        await saveSemanticAuditResult(auditData.audit);
        attempt.auditId = auditData.audit.id;
        await savePracticeAttempt(attempt);

        // 7. Seamlessly navigate to Answer Review page
        router.push(`/study/${studySet.id}/attempts/${attempt.id}`);
        return;
      } else {
        throw new Error(auditData.error || "Evaluation returned an error.");
      }
    } catch (auditErr: unknown) {
      console.warn("Semantic audit notice:", auditErr);
      // Attempt is safely stored; render completed state with review/retry option
      setSessionState("completed");
      setAuditNotice(
        "Your spoken response has been recorded and safely saved to your device."
      );
    } finally {
      isFinishingRef.current = false;
    }
  };

  // Retry semantic audit if initial attempt timed out or failed
  const handleRetryAudit = async () => {
    if (!lastSavedAttempt || !activeQuestion) return;

    try {
      setIsRetryingAudit(true);
      setAuditNotice(null);

      const isParagraphScope =
        lastSavedAttempt.scope === "paragraph" &&
        typeof lastSavedAttempt.paragraphIndex === "number";
      const resolvedScope = resolvePracticeScope({
        referenceAnswer: activeQuestion.referenceAnswer,
        criteria: activeRubric?.criteria || [],
        scope: isParagraphScope
          ? {
              type: "paragraph",
              paragraphIndex: lastSavedAttempt.paragraphIndex,
            }
          : undefined,
      });

      const auditRes = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: lastSavedAttempt.id,
          studySetId: studySet.id,
          questionId: activeQuestion.id,
          question: activeQuestion.question,
          referenceAnswer: resolvedScope.paragraphText,
          transcript: lastSavedAttempt.transcript,
          criteria: resolvedScope.criteria,
          scope: {
            type: lastSavedAttempt.scope || "whole_answer",
            paragraphIndex: lastSavedAttempt.paragraphIndex,
            totalParagraphs: resolvedScope.totalParagraphs,
            targetText: resolvedScope.paragraphText,
          },
        }),
      });

      const auditData = await auditRes.json();
      if (auditRes.ok && auditData.success && auditData.audit) {
        await saveSemanticAuditResult(auditData.audit);
        const updatedAttempt: PracticeAttempt = {
          ...lastSavedAttempt,
          auditId: auditData.audit.id,
        };
        await savePracticeAttempt(updatedAttempt);
        setLastSavedAttempt(updatedAttempt);
        router.push(`/study/${studySet.id}/attempts/${updatedAttempt.id}`);
      } else {
        throw new Error(auditData.error || "Could not complete evaluation.");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Evaluation could not be completed.";
      setAuditNotice(`Evaluation retry notice: ${msg}`);
    } finally {
      setIsRetryingAudit(false);
    }
  };

  // Cancel attempt without saving
  const handleCancelPractice = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    captureControllerRef.current?.stop();
    captureControllerRef.current = null;
    transcribeClientRef.current?.close();
    transcribeClientRef.current = null;

    accumulatorRef.current.reset();
    isFinishingRef.current = false;
    previousHintsRef.current = [];
    setCurrentHint(null);
    setSessionState("idle");
    setTranscript("");
    setInterimText("");
    setDurationSeconds(0);
    durationSecondsRef.current = 0;
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

            {/* Paragraph-level practice selector when multi-paragraph answer exists */}
            {paragraphs.length > 1 && sessionState === "idle" && (
              <div className="border-brand-peach/60 bg-brand-cream/50 mt-4 rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-brand-secondary text-[11px] font-bold tracking-wider uppercase">
                    Practice Scope
                  </span>
                  <span className="text-brand-secondary text-[10px]">
                    {selectedParagraphIndex === null
                      ? "Practising full answer"
                      : `Practising Paragraph ${selectedParagraphIndex + 1} of ${paragraphs.length}`}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedParagraphIndex(null)}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      selectedParagraphIndex === null
                        ? "bg-brand-tomato text-white shadow-2xs"
                        : "border-brand-peach/80 text-brand-ink border bg-white hover:bg-stone-50"
                    }`}
                  >
                    Whole answer ({paragraphs.length} paragraphs)
                  </button>
                  {paragraphs.map((_, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      onClick={() => setSelectedParagraphIndex(pIdx)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        selectedParagraphIndex === pIdx
                          ? "bg-brand-tomato text-white shadow-2xs"
                          : "border-brand-peach/80 text-brand-ink border bg-white hover:bg-stone-50"
                      }`}
                    >
                      Paragraph {pIdx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                  {selectedParagraphIndex !== null &&
                  paragraphs[selectedParagraphIndex] ? (
                    <div className="mt-2 space-y-2">
                      <div className="border-brand-tomato/30 rounded-lg border bg-white p-3 shadow-2xs">
                        <span className="text-brand-tomato block text-[10px] font-bold tracking-wider uppercase">
                          Selected Paragraph {selectedParagraphIndex + 1}
                        </span>
                        <p className="mt-1 font-medium whitespace-pre-wrap">
                          {paragraphs[selectedParagraphIndex]}
                        </p>
                      </div>
                      <p className="text-brand-secondary text-[11px] italic">
                        Tip: You are practicing only this paragraph. Your
                        evaluation will be based solely on this section.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap">
                      {activeQuestion.referenceAnswer}
                    </p>
                  )}
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

                {/* Quiet voice practice note */}
                <p className="text-brand-secondary/80 mt-4 flex items-center justify-center gap-1.5 text-[11px]">
                  <span>🎧</span>
                  <span>
                    Practise in a quiet voice. Headphones with a microphone may
                    help in noisy places.
                  </span>
                </p>
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

                {/* Contextual Recall Hint */}
                <ContextualHint
                  isVisible={
                    isPaused &&
                    sessionState === "listening" &&
                    Boolean(currentHint)
                  }
                  hintText={currentHint}
                  onDismiss={() => setCurrentHint(null)}
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

                {/* Quiet voice practice note */}
                <p className="text-brand-secondary/70 text-center text-[11px]">
                  Practise in a quiet voice. Headphones with a microphone may
                  help in noisy places.
                </p>
              </div>
            )}

            {/* Auditing State */}
            {sessionState === "auditing" && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="border-brand-tomato h-10 w-10 animate-spin rounded-full border-3 border-t-transparent" />
                <h3 className="font-heading text-brand-ink mt-4 text-base font-bold">
                  Evaluating your conceptual understanding...
                </h3>
                <p className="text-brand-secondary mt-1 max-w-sm text-xs leading-relaxed">
                  Comparing your explanation with the reference answer to
                  identify which key concepts were covered, partially explained,
                  or missed.
                </p>
                {lastSavedAttempt && (
                  <p className="text-brand-secondary/70 mt-3 text-[11px]">
                    Your spoken answer ({lastSavedAttempt.wordCount} words) is
                    safely saved locally.
                  </p>
                )}
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

                {/* Audit notice banner if evaluation failed or required attention */}
                {auditNotice && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">{auditNotice}</p>
                  </div>
                )}

                {/* Attempt Metrics Card */}
                <div className="bg-brand-cream/70 border-brand-peach/60 grid grid-cols-2 gap-3 rounded-xl border p-4 text-center">
                  <div>
                    <span className="text-brand-secondary text-[11px] font-semibold tracking-wider uppercase">
                      Spoken Words
                    </span>
                    <p className="font-heading text-brand-ink text-xl font-bold">
                      {lastSavedAttempt?.wordCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-brand-secondary text-[11px] font-semibold tracking-wider uppercase">
                      Duration
                    </span>
                    <p className="font-heading text-brand-ink text-xl font-bold">
                      {lastSavedAttempt?.durationSeconds ?? 0}s
                    </p>
                  </div>
                </div>

                {/* Saved Spoken Transcript */}
                <div>
                  <h4 className="font-heading text-brand-ink mb-1 text-xs font-bold tracking-wider uppercase">
                    What you said:
                  </h4>
                  <div className="bg-brand-cream/40 border-brand-peach/60 text-brand-ink max-h-48 overflow-y-auto rounded-xl border p-4 text-xs leading-relaxed whitespace-pre-wrap">
                    {lastSavedAttempt?.transcript ||
                      "No words captured in this attempt."}
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

                  <div className="flex flex-wrap items-center gap-2">
                    {lastSavedAttempt && (
                      <>
                        {lastSavedAttempt.auditId ? (
                          <Link
                            href={`/study/${studySet.id}/attempts/${lastSavedAttempt.id}`}
                            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition"
                          >
                            <span>View Answer Review</span>
                            <span>&rarr;</span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRetryAudit}
                            disabled={isRetryingAudit}
                            className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition disabled:opacity-75"
                          >
                            {isRetryingAudit ? (
                              <>
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                <span>Evaluating...</span>
                              </>
                            ) : (
                              <>
                                <span>Evaluate answer</span>
                                <span>&rarr;</span>
                              </>
                            )}
                          </button>
                        )}
                      </>
                    )}

                    {activeQuestionIndex < studySet.questions.length - 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleSwitchQuestion(
                            studySet.questions[activeQuestionIndex + 1]!.id
                          )
                        }
                        className="border-brand-peach/80 hover:bg-brand-cream/60 text-brand-ink inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-xs font-semibold transition"
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
