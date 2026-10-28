"use client";

import React, { Suspense, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SAMPLE_STUDY_MATERIALS,
  SampleStudyMaterial,
} from "@/features/library/sample-materials";
import {
  ExtractedQuestion,
  QuestionRubric,
  StudyMaterial,
  StudySet,
} from "@/lib/domain/study-set";
import { saveStudySet } from "@/lib/storage/study-store";
import { validateStudyFile, formatFileSize } from "@/lib/files";
import {
  SparklesIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  AlertCircleIcon,
  CameraIcon,
  PhotoIcon,
  TrashIcon,
  PencilSquareIcon,
  ArrowsUpDownIcon,
  ArrowsRightLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@/components/icons";

export function NewMaterialView() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <ArrowPathIcon className="text-brand-tomato h-6 w-6 animate-spin" />
        </div>
      }
    >
      <NewMaterialContent />
    </Suspense>
  );
}

function NewMaterialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetParam = searchParams.get("preset");

  const presetMatch = presetParam
    ? SAMPLE_STUDY_MATERIALS.find((s) => s.id === presetParam)
    : undefined;

  // Tab State
  const [activeTab, setActiveTab] = useState<"upload" | "photo" | "paste">(
    presetParam ? "paste" : "upload"
  );

  // File Upload / Photo State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<{
    name: string;
    sizeFormatted: string;
    pageCount?: number;
    type: "pdf" | "image";
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Text Paste State
  const [title, setTitle] = useState(presetMatch?.title || "");
  const [sourceText, setSourceText] = useState(presetMatch?.sourceText || "");

  // Missing question / answer recovery state
  const [missingQuestionPrompt, setMissingQuestionPrompt] = useState<
    string | null
  >(null);
  const [studentInputQuestion, setStudentInputQuestion] = useState("");
  const [missingAnswerPrompt, setMissingAnswerPrompt] = useState<string | null>(
    null
  );
  const [studentInputAnswer, setStudentInputAnswer] = useState("");

  // Extraction & Processing State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStep, setExtractionStep] = useState<string>("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparingStep, setPreparingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Detected Questions State (Master-Detail review)
  const [detectedQuestions, setDetectedQuestions] = useState<
    ExtractedQuestion[]
  >([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [currentMaterial, setCurrentMaterial] = useState<StudyMaterial | null>(
    null
  );

  // Text counts
  const characterCount = sourceText.length;
  const wordCount = sourceText.trim()
    ? sourceText.trim().split(/\s+/).length
    : 0;

  // Active question for detail editing
  const activeQuestion = detectedQuestions[selectedQuestionIndex] || null;

  // Handle Preset Selection
  const handleSelectSample = (sample: SampleStudyMaterial) => {
    setTitle(sample.title);
    setSourceText(sample.sourceText);
    setError(null);
    setMissingQuestionPrompt(null);
    setMissingAnswerPrompt(null);
    setDetectedQuestions([]);
    setCurrentMaterial(null);
  };

  const handleClearAll = () => {
    setTitle("");
    setSourceText("");
    setSelectedFile(null);
    setFileMeta(null);
    setDetectedQuestions([]);
    setCurrentMaterial(null);
    setError(null);
    setMissingQuestionPrompt(null);
    setMissingAnswerPrompt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Process File Selection (from Upload or Camera)
  const handleFileChosen = async (file: File) => {
    setError(null);
    setDetectedQuestions([]);
    setCurrentMaterial(null);

    try {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const validation = validateStudyFile(buffer, file.name);

      if (!validation.valid) {
        setError(validation.error || "Unsupported file format.");
        return;
      }

      setSelectedFile(file);
      setFileMeta({
        name: file.name,
        sizeFormatted: formatFileSize(file.size),
        pageCount: validation.pageCount,
        type: validation.type === "pdf" ? "pdf" : "image",
      });

      // Automatically trigger extraction for seamless student UX
      await executeFileExtraction(file);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to read the selected file."
      );
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file) await handleFileChosen(file);
    }
  };

  // Extract from uploaded file using multipart/form-data
  const executeFileExtraction = async (file: File) => {
    setIsExtracting(true);
    setError(null);

    try {
      setExtractionStep("Uploading and scanning document...");

      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) {
        formData.append("title", title.trim());
      }

      setExtractionStep("Analyzing document with Meta multimodal reasoning...");

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const extractData = await extractRes.json();

      if (!extractRes.ok || !extractData.success) {
        throw new Error(
          extractData.error ||
            "Could not extract exam questions from this document. Please verify the file has clear, legible text."
        );
      }

      const material: StudyMaterial = extractData.studyMaterial;
      const questions: ExtractedQuestion[] = extractData.questions;

      if (!questions || questions.length === 0) {
        throw new Error(
          "No question-answer pairs could be detected in this file. Please verify the document contains study questions and answers."
        );
      }

      setCurrentMaterial(material);
      setDetectedQuestions(questions);
      setSelectedQuestionIndex(0);
      if (!title && material.title) {
        setTitle(material.title);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while analyzing the file.";
      setError(msg);
    } finally {
      setIsExtracting(false);
      setExtractionStep("");
    }
  };

  // Extract from pasted text using JSON
  const executeTextExtraction = async (customQuestion?: string) => {
    if (characterCount < 20) {
      setError("Please paste at least 20 characters of study material.");
      return;
    }

    if (characterCount > 20000) {
      setError("Study material exceeds the 20,000 character limit.");
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      setExtractionStep(
        "Finding authentic questions and answers in your material..."
      );

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          sourceText,
          studentQuestion: customQuestion?.trim() || undefined,
        }),
      });

      const extractData = await extractRes.json();

      if (!extractRes.ok || !extractData.success) {
        throw new Error(
          extractData.error ||
            "Could not find questions and answers in this material."
        );
      }

      // Handle Missing Question Case: student pasted notes without question
      if (extractData.status === "missing_question") {
        setMissingQuestionPrompt(
          extractData.message ||
            "We found your study notes, but couldn't find your exam questions. What question will your exam ask about this material?"
        );
        setIsExtracting(false);
        setExtractionStep("");
        return;
      }

      // Handle Missing Answer Case: student pasted question without answer
      if (extractData.status === "missing_answer") {
        setMissingAnswerPrompt(
          extractData.message ||
            "We found your question, but couldn't find the answer in your material. Please paste the answer you want to study from."
        );
        setIsExtracting(false);
        setExtractionStep("");
        return;
      }

      const material: StudyMaterial = extractData.studyMaterial;
      const questions: ExtractedQuestion[] = extractData.questions;

      if (!questions || questions.length === 0) {
        throw new Error(
          "No question-answer pairs could be extracted. Please paste text with at least one question and answer."
        );
      }

      setCurrentMaterial(material);
      setDetectedQuestions(questions);
      setSelectedQuestionIndex(0);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while processing your material.";
      setError(msg);
    } finally {
      setIsExtracting(false);
      setExtractionStep("");
    }
  };

  // Update Question in Detected Questions
  const handleUpdateDetectedQuestion = (
    index: number,
    field: "question" | "referenceAnswer",
    value: string
  ) => {
    setDetectedQuestions((prev) => {
      const copy = [...prev];
      const item = copy[index];
      if (item) {
        copy[index] = { ...item, [field]: value };
      }
      return copy;
    });
  };

  // Delete Question from Detected Questions
  const handleDeleteDetectedQuestion = (index: number) => {
    if (detectedQuestions.length <= 1) {
      setError("At least one question is required to prepare a study set.");
      return;
    }

    setDetectedQuestions((prev) => prev.filter((_, i) => i !== index));
    if (selectedQuestionIndex >= index && selectedQuestionIndex > 0) {
      setSelectedQuestionIndex(selectedQuestionIndex - 1);
    }
  };

  // Split Active Question into two
  const handleSplitQuestion = () => {
    if (!activeQuestion) return;

    // Check if question or answer has natural split point (newline or sentences)
    const qParts = activeQuestion.question.split(/\n+/).filter(Boolean);
    const aParts = activeQuestion.referenceAnswer
      .split(/\n\n+/)
      .filter(Boolean);

    let firstQ = activeQuestion.question;
    let secondQ = "Part 2";
    let firstA = activeQuestion.referenceAnswer;
    let secondA = "Reference answer for part 2";

    if (qParts.length >= 2) {
      firstQ = qParts[0]!;
      secondQ = qParts.slice(1).join("\n");
    } else {
      firstQ = `${activeQuestion.question} (Part 1)`;
      secondQ = `${activeQuestion.question} (Part 2)`;
    }

    if (aParts.length >= 2) {
      firstA = aParts[0]!;
      secondA = aParts.slice(1).join("\n\n");
    }

    const updatedCurrent: ExtractedQuestion = {
      ...activeQuestion,
      question: firstQ,
      referenceAnswer: firstA,
    };

    const newQuestion: ExtractedQuestion = {
      id: `q_${Date.now()}_split`,
      studyMaterialId: activeQuestion.studyMaterialId,
      orderIndex: activeQuestion.orderIndex + 1,
      question: secondQ,
      referenceAnswer: secondA,
      sourceExcerpt: activeQuestion.sourceExcerpt || secondA.slice(0, 100),
      pageNumber: activeQuestion.pageNumber,
    };

    const updated = [...detectedQuestions];
    updated[selectedQuestionIndex] = updatedCurrent;
    updated.splice(selectedQuestionIndex + 1, 0, newQuestion);

    // Reindex orders
    const reindexed = updated.map((q, idx) => ({ ...q, orderIndex: idx + 1 }));
    setDetectedQuestions(reindexed);
    setSelectedQuestionIndex(selectedQuestionIndex + 1);
  };

  // Merge Active Question with Next Question
  const handleMergeQuestion = () => {
    if (!activeQuestion) return;
    if (selectedQuestionIndex >= detectedQuestions.length - 1) {
      setError(
        "Select a question that has a subsequent question to merge with."
      );
      return;
    }

    const nextQuestion = detectedQuestions[selectedQuestionIndex + 1];
    if (!nextQuestion) return;

    const mergedQuestionText = `${activeQuestion.question}\n${nextQuestion.question}`;
    const mergedAnswerText = `${activeQuestion.referenceAnswer}\n\n${nextQuestion.referenceAnswer}`;

    const merged: ExtractedQuestion = {
      ...activeQuestion,
      question: mergedQuestionText,
      referenceAnswer: mergedAnswerText,
    };

    const updated = detectedQuestions.filter(
      (_, i) => i !== selectedQuestionIndex + 1
    );
    updated[selectedQuestionIndex] = merged;

    const reindexed = updated.map((q, idx) => ({ ...q, orderIndex: idx + 1 }));
    setDetectedQuestions(reindexed);
    setError(null);
  };

  // Add a blank question manually
  const handleAddQuestion = () => {
    const matId = currentMaterial?.id || `mat_${Date.now()}`;
    const newQ: ExtractedQuestion = {
      id: `q_${Date.now()}_manual`,
      studyMaterialId: matId,
      question: "New Exam Question",
      referenceAnswer: "Answer from your notes...",
      sourceExcerpt: "",
      orderIndex: detectedQuestions.length + 1,
    };
    setDetectedQuestions([...detectedQuestions, newQ]);
    setSelectedQuestionIndex(detectedQuestions.length);
  };

  // Save and Prepare Points (calls /api/rubric and saves to IndexedDB)
  const handleSaveAndPrepare = async () => {
    if (detectedQuestions.length === 0) {
      setError("Please add at least one question and answer pair.");
      return;
    }

    // Validate questions
    for (let i = 0; i < detectedQuestions.length; i++) {
      const q = detectedQuestions[i]!;
      if (!q.question.trim()) {
        setError(`Question ${i + 1} has an empty question prompt.`);
        setSelectedQuestionIndex(i);
        return;
      }
      if (!q.referenceAnswer.trim()) {
        setError(`Question ${i + 1} has an empty reference answer.`);
        setSelectedQuestionIndex(i);
        return;
      }
    }

    setIsPreparing(true);
    setError(null);

    try {
      const rawText =
        sourceText.trim() ||
        detectedQuestions
          .map((q) => `Question: ${q.question}\nAnswer: ${q.referenceAnswer}`)
          .join("\n\n");

      const materialToSave: StudyMaterial = currentMaterial || {
        id: `mat_${Date.now()}`,
        title: title.trim() || "Untitled Study Set",
        sourceText: rawText,
        characterCount: rawText.length,
        sourceType: fileMeta?.type || "text",
        fileName: fileMeta?.name,
        fileSize: selectedFile?.size,
        pageCount: fileMeta?.pageCount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Step: Generate rubrics for each question
      const rubrics: Record<string, QuestionRubric> = {};

      for (let i = 0; i < detectedQuestions.length; i++) {
        const q = detectedQuestions[i]!;
        setPreparingStep(
          `Finding important points to remember for Question ${i + 1} of ${detectedQuestions.length}...`
        );

        const rubricRes = await fetch("/api/rubric", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: q.id,
            question: q.question,
            referenceAnswer: q.referenceAnswer,
            sourceText: materialToSave.sourceText,
            studyMaterialId: materialToSave.id,
          }),
        });

        const rubricData = await rubricRes.json();

        if (!rubricRes.ok || !rubricData.success) {
          throw new Error(
            rubricData.error ||
              `Could not find key points for Question ${i + 1}`
          );
        }

        rubrics[q.id] = rubricData.rubric;
      }

      // Step: Save to IndexedDB
      setPreparingStep("Saving study set to your local browser storage...");

      const studySet: StudySet = {
        id: materialToSave.id,
        material: materialToSave,
        questions: detectedQuestions,
        rubrics,
        createdAt: materialToSave.createdAt,
        updatedAt: materialToSave.updatedAt,
      };

      await saveStudySet(studySet);

      // Navigate to Review Points screen
      router.push(`/review/${studySet.id}`);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while preparing your study set.";
      setError(msg);
      setIsPreparing(false);
      setPreparingStep("");
    }
  };

  const handleResolveMissingQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInputQuestion.trim()) return;
    setMissingQuestionPrompt(null);
    executeTextExtraction(studentInputQuestion);
  };

  const handleResolveMissingAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInputAnswer.trim()) return;
    const combined = `${sourceText}\n\nAnswer:\n${studentInputAnswer}`;
    setSourceText(combined);
    setMissingAnswerPrompt(null);
  };

  // Helper to extract clean short title for question
  const getQuestionShortTitle = (q: ExtractedQuestion, idx: number) => {
    const clean = q.question
      .replace(/^(question\s*\d*[:.-]?\s*|\d+[:.-]\s*)/i, "")
      .trim();
    if (clean.length > 32) {
      return `${clean.slice(0, 32)}...`;
    }
    return clean || `Question ${idx + 1}`;
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Stepper Header (responsive, never exceeds mobile viewport) */}
      <div className="flex w-full items-center justify-center gap-1.5 py-1 sm:gap-3">
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="bg-brand-tomato flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-2xs sm:h-6 sm:w-6 sm:text-xs">
            1
          </div>
          <span className="text-brand-ink text-[11px] font-bold whitespace-nowrap sm:text-xs">
            Upload
          </span>
        </div>
        <div className="bg-brand-peach h-0.5 w-4 shrink sm:w-10" />
        <div className="flex shrink-0 items-center gap-1.5 opacity-60">
          <div className="border-brand-peach bg-brand-cream text-brand-secondary flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold sm:h-6 sm:w-6 sm:text-xs">
            2
          </div>
          <span className="text-brand-secondary text-[11px] font-medium whitespace-nowrap sm:text-xs">
            Review &amp; Edit
          </span>
        </div>
        <div className="bg-brand-peach h-0.5 w-4 shrink sm:w-10" />
        <div className="flex shrink-0 items-center gap-1.5 opacity-60">
          <div className="border-brand-peach bg-brand-cream text-brand-secondary flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold sm:h-6 sm:w-6 sm:text-xs">
            3
          </div>
          <span className="text-brand-secondary text-[11px] font-medium whitespace-nowrap sm:text-xs">
            Save
          </span>
        </div>
      </div>

      {/* Page Header with Decorative Illustration matching reference */}
      <div className="border-brand-peach/60 relative flex w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border bg-white/80 p-5 shadow-xs sm:flex-row sm:items-center sm:p-7">
        <div className="max-w-xl">
          <h1 className="font-heading text-brand-ink text-xl font-bold sm:text-2xl">
            Add your study material
          </h1>
          <p className="text-brand-secondary mt-1.5 text-xs leading-relaxed sm:text-sm">
            Upload a photo, PDF or paste text. We&apos;ll extract and organise
            the questions and answers for you to review.
          </p>
        </div>

        {/* Decorative Notes Illustration on Desktop */}
        <div className="hidden shrink-0 items-center justify-center sm:flex sm:pl-4">
          <div className="relative flex h-24 w-28 items-center justify-center">
            {/* Background Paper */}
            <div className="bg-brand-peach/50 absolute h-18 w-18 rotate-12 rounded-xl shadow-xs" />
            {/* Main Note Sheet */}
            <div className="border-brand-peach/80 bg-brand-cream absolute h-20 w-16 -rotate-6 rounded-xl border p-2 shadow-sm">
              <div className="bg-brand-peach/70 mb-1.5 h-1.5 w-8 rounded-full" />
              <div className="bg-brand-peach/50 mb-1 h-1 w-10 rounded-full" />
              <div className="bg-brand-peach/50 mb-1 h-1 w-11 rounded-full" />
              <div className="bg-brand-peach/50 mb-1 h-1 w-7 rounded-full" />
            </div>
            {/* Sparkles */}
            <SparklesIcon className="text-brand-tomato absolute -top-1 right-2 h-5 w-5 animate-pulse" />
            <div className="bg-brand-tomato/80 absolute bottom-1 -left-1 h-2 w-2 rounded-full" />
          </div>
        </div>
      </div>

      {/* Input Mode Tabs (responsive horizontal scroll without widening page) */}
      <div className="border-brand-peach/60 flex w-full min-w-0 scrollbar-thin overflow-x-auto border-b">
        <button
          type="button"
          onClick={() => {
            setActiveTab("upload");
            setError(null);
          }}
          className={`flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-xs whitespace-nowrap transition sm:px-6 ${
            activeTab === "upload"
              ? "border-brand-tomato text-brand-tomato font-bold"
              : "text-brand-secondary hover:text-brand-ink border-transparent font-medium"
          }`}
        >
          <DocumentTextIcon className="h-4 w-4" />
          <span>Upload File</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("photo");
            setError(null);
          }}
          className={`flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-xs whitespace-nowrap transition sm:px-6 ${
            activeTab === "photo"
              ? "border-brand-tomato text-brand-tomato font-bold"
              : "text-brand-secondary hover:text-brand-ink border-transparent font-medium"
          }`}
        >
          <CameraIcon className="h-4 w-4" />
          <span>Take Photo</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("paste");
            setError(null);
          }}
          className={`flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-4 py-3 text-xs whitespace-nowrap transition sm:px-6 ${
            activeTab === "paste"
              ? "border-brand-tomato text-brand-tomato font-bold"
              : "text-brand-secondary hover:text-brand-ink border-transparent font-medium"
          }`}
        >
          <DocumentTextIcon className="h-4 w-4" />
          <span>Paste Text</span>
        </button>
      </div>

      {/* Error notification banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="flex-1">
              <span className="font-bold">Error: </span>
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="cursor-pointer font-bold text-red-700 hover:text-red-900"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Selected File Card (matches design reference) */}
      {fileMeta && (
        <div className="border-brand-peach/80 flex w-full min-w-0 items-center justify-between rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-brand-peach/50 text-brand-tomato flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
              {fileMeta.type === "pdf" ? (
                <DocumentTextIcon className="h-6 w-6" />
              ) : (
                <PhotoIcon className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-heading text-brand-ink truncate text-sm font-bold">
                {fileMeta.name}
              </h3>
              <p className="text-brand-secondary mt-0.5 text-xs">
                {fileMeta.pageCount
                  ? `${fileMeta.pageCount} ${
                      fileMeta.pageCount === 1 ? "page" : "pages"
                    } · ${fileMeta.sizeFormatted}`
                  : `${fileMeta.sizeFormatted} · Scanned image`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (fileMeta.type === "pdf" || activeTab === "upload") {
                  fileInputRef.current?.click();
                } else {
                  cameraInputRef.current?.click();
                }
              }}
              className="border-brand-peach bg-brand-cream/80 text-brand-ink hover:bg-brand-peach/40 hidden h-9 cursor-pointer items-center justify-center rounded-xl border px-3.5 text-xs font-semibold transition sm:inline-flex"
            >
              Change file
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              title="Remove file"
              className="text-brand-secondary hover:text-brand-tomato flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl transition hover:bg-red-50"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: Upload File Area */}
      {activeTab === "upload" && !selectedFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-brand-peach/80 bg-brand-cream/30 rounded-2xl border-2 border-dashed p-6 transition sm:p-10 ${
            isDragging ? "border-brand-tomato bg-brand-peach/20" : ""
          }`}
        >
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileChosen(file);
            }}
          />

          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12 md:gap-8">
            {/* Left Upload Drag/Drop Box */}
            <div className="flex flex-col items-center justify-center text-center md:col-span-6">
              <div className="bg-brand-peach/50 text-brand-tomato mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl">
                <DocumentTextIcon className="h-7 w-7" />
              </div>
              <h3 className="font-heading text-brand-ink text-sm font-bold sm:text-base">
                <span className="hidden sm:inline">
                  Drag and drop a file here
                </span>
                <span className="sm:hidden">Tap to choose a file</span>
              </h3>
              <p className="text-brand-secondary mt-1 text-xs">
                PDF, JPG, PNG (Max 20MB)
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-brand-tomato hover:bg-brand-tomato-hover mt-4 inline-flex h-10 cursor-pointer items-center justify-center rounded-xl px-6 text-xs font-bold text-white shadow-xs transition"
              >
                Choose File
              </button>
            </div>

            {/* Divider */}
            <div className="text-brand-secondary/60 flex items-center justify-center text-xs font-medium md:col-span-1">
              <span>or</span>
            </div>

            {/* Right Supported Formats Panel */}
            <div className="border-brand-peach/60 rounded-xl border bg-white/70 p-4 md:col-span-5">
              <h4 className="font-heading text-brand-ink text-xs font-bold tracking-wider uppercase">
                Supported formats
              </h4>
              <ul className="mt-3 space-y-2.5 text-xs">
                <li className="text-brand-secondary flex items-start gap-2.5">
                  <DocumentTextIcon className="text-brand-tomato mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong className="text-brand-ink">PDF files</strong>{" "}
                    (notes, assignments, question banks)
                  </span>
                </li>
                <li className="text-brand-secondary flex items-start gap-2.5">
                  <PhotoIcon className="text-brand-tomato mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong className="text-brand-ink">Images</strong> (photos
                    of handwritten or printed notes)
                  </span>
                </li>
                <li className="text-brand-secondary flex items-start gap-2.5">
                  <PencilSquareIcon className="text-brand-tomato mt-0.5 h-4 w-4 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setActiveTab("paste")}
                    className="cursor-pointer text-left hover:underline"
                  >
                    <strong className="text-brand-ink">Paste text</strong>{" "}
                    directly from your notes
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Take Photo Area */}
      {activeTab === "photo" && !selectedFile && (
        <div className="border-brand-peach/80 bg-brand-cream/30 rounded-2xl border-2 border-dashed p-6 text-center sm:p-10">
          {/* Hidden Camera Input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileChosen(file);
            }}
          />

          <div className="mx-auto flex max-w-md flex-col items-center">
            <div className="bg-brand-peach/50 text-brand-tomato mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <CameraIcon className="h-7 w-7" />
            </div>
            <h3 className="font-heading text-brand-ink text-base font-bold">
              Take a photo of your study material
            </h3>
            <p className="text-brand-secondary mt-1 text-xs leading-relaxed">
              Snap a clear photo of your textbook, printed assignment, or
              handwritten notes.
            </p>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="bg-brand-tomato hover:bg-brand-tomato-hover mt-5 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-xs font-bold text-white shadow-xs transition"
            >
              <CameraIcon className="h-4 w-4" />
              <span>Open Camera</span>
            </button>

            <p className="text-brand-secondary/70 mt-3 text-[11px]">
              On desktop or laptop devices, you can also select an existing
              photo file.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: Paste Text Area */}
      {activeTab === "paste" && (
        <div className="w-full min-w-0 space-y-5">
          {/* Curated Sample Presets: Dedicated Section with Required Accessibility Attributes */}
          <section className="border-brand-peach/60 w-full min-w-0 rounded-2xl border bg-white/80 p-3.5 shadow-xs sm:p-4">
            <div className="text-brand-secondary flex items-center justify-between text-xs font-bold tracking-wider uppercase">
              <div className="flex items-center gap-2">
                <SparklesIcon className="text-brand-tomato h-4 w-4 shrink-0" />
                <span className="truncate">Or load a curated exam topic:</span>
              </div>
              <span className="text-brand-secondary/70 hidden shrink-0 text-[10px] font-medium lowercase sm:inline-block">
                scroll horizontally &rarr;
              </span>
            </div>

            {/* Dedicated Inner Horizontal Scroll Container */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Curated exam topics"
              className="mt-3 flex w-full min-w-0 scrollbar-thin flex-nowrap items-stretch gap-3 overflow-x-auto pt-0.5 pb-2"
            >
              {SAMPLE_STUDY_MATERIALS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  disabled={isExtracting || isPreparing}
                  onClick={() => handleSelectSample(sample)}
                  className="group border-brand-peach/80 bg-brand-cream/60 hover:border-brand-tomato/60 focus-visible:outline-brand-tomato flex w-[230px] max-w-[260px] min-w-[210px] shrink-0 cursor-pointer flex-col justify-between rounded-xl border p-3 text-left shadow-2xs transition hover:bg-white focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="w-full min-w-0">
                    <span className="text-brand-tomato text-[10px] font-bold tracking-wider uppercase">
                      {sample.category}
                    </span>
                    <h4 className="font-heading text-brand-ink group-hover:text-brand-tomato mt-0.5 line-clamp-1 text-xs font-bold">
                      {sample.title.split(":")[1]?.trim() || sample.title}
                    </h4>
                    <p className="text-brand-secondary mt-1 line-clamp-2 text-[11px] leading-relaxed">
                      {sample.sourceText.slice(0, 85)}...
                    </p>
                  </div>
                  <div className="text-brand-tomato mt-2 text-[10px] font-bold opacity-80 group-hover:opacity-100">
                    Load topic &rarr;
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Missing Question Resolution Card */}
          {missingQuestionPrompt && (
            <form
              onSubmit={handleResolveMissingQuestion}
              className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="font-heading text-sm font-bold text-amber-900">
                    What question does this material answer?
                  </h3>
                  <p className="mt-0.5 text-xs text-amber-800">
                    {missingQuestionPrompt}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-amber-900">
                  Your Exam Question:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={studentInputQuestion}
                  onChange={(e) => setStudentInputQuestion(e.target.value)}
                  placeholder="e.g. Explain how DNS translates domain names into IP addresses."
                  className="text-brand-ink focus:border-brand-tomato w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-4 text-xs font-bold text-white shadow-xs transition"
                >
                  Confirm Question &amp; Find Key Points
                </button>
                <button
                  type="button"
                  onClick={() => setMissingQuestionPrompt(null)}
                  className="cursor-pointer text-xs text-amber-800 hover:text-amber-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Missing Answer Resolution Card */}
          {missingAnswerPrompt && (
            <form
              onSubmit={handleResolveMissingAnswer}
              className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/80 p-5 shadow-xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="font-heading text-sm font-bold text-amber-900">
                    Please paste the answer for this question
                  </h3>
                  <p className="mt-0.5 text-xs text-amber-800">
                    {missingAnswerPrompt}
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-amber-900">
                  Answer from your notes or textbook:
                </label>
                <textarea
                  rows={4}
                  required
                  autoFocus
                  value={studentInputAnswer}
                  onChange={(e) => setStudentInputAnswer(e.target.value)}
                  placeholder="Paste the answer you are studying from..."
                  className="text-brand-ink focus:border-brand-tomato w-full rounded-xl border border-amber-300 bg-white p-3 text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-4 text-xs font-bold text-white shadow-xs transition"
                >
                  Add Answer &amp; Continue
                </button>
                <button
                  type="button"
                  onClick={() => setMissingAnswerPrompt(null)}
                  className="cursor-pointer text-xs text-amber-800 hover:text-amber-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Text Input Card */}
          <div className="border-brand-peach/80 rounded-2xl border bg-white p-6 shadow-xs sm:p-8">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-heading text-brand-ink text-base font-bold sm:text-lg">
                  Paste your study questions and answers
                </h2>
                <p className="text-brand-secondary text-xs">
                  Include questions and their answers. Retell preserves your
                  exact framing and finds key points.
                </p>
              </div>
              {(title || sourceText) && !isExtracting && !isPreparing && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-brand-secondary hover:text-brand-ink mt-2 cursor-pointer text-xs font-medium sm:mt-0"
                >
                  Clear form
                </button>
              )}
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="material-title"
                  className="text-brand-ink block text-xs font-semibold"
                >
                  Subject or topic title{" "}
                  <span className="text-brand-secondary font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  id="material-title"
                  type="text"
                  value={title}
                  disabled={isExtracting || isPreparing}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Operating Systems: Page Replacement or Biology: Respiration"
                  className="border-brand-peach/80 bg-brand-cream/30 text-brand-ink placeholder:text-brand-secondary/60 focus:border-brand-tomato focus:ring-brand-tomato mt-1.5 w-full rounded-xl border px-3.5 py-2.5 text-sm focus:bg-white focus:ring-1 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="material-source"
                    className="text-brand-ink block text-xs font-semibold"
                  >
                    Questions and Answers{" "}
                    <span className="text-brand-tomato">*</span>
                  </label>
                  <div className="text-brand-secondary flex items-center gap-2 text-[11px]">
                    <span>{wordCount} words</span>
                    <span>•</span>
                    <span
                      className={
                        characterCount > 20000
                          ? "font-bold text-red-600"
                          : characterCount < 20 && characterCount > 0
                            ? "text-amber-600"
                            : "text-brand-secondary"
                      }
                    >
                      {characterCount.toLocaleString()} / 20,000 chars
                    </span>
                  </div>
                </div>

                <textarea
                  id="material-source"
                  rows={8}
                  value={sourceText}
                  disabled={isExtracting || isPreparing}
                  onChange={(e) => setSourceText(e.target.value)}
                  placeholder={`Paste your questions and answers here. For example:\n\nQuestion:\nExplain the different page replacement algorithms and compare their advantages.\n\nAnswer (from your material):\nPage replacement algorithms decide which page to remove from memory when a page fault occurs. Common algorithms include FIFO, LRU, and Optimal...`}
                  className="border-brand-peach/80 bg-brand-cream/30 text-brand-ink placeholder:text-brand-secondary/60 focus:border-brand-tomato focus:ring-brand-tomato mt-1.5 w-full rounded-xl border p-3.5 font-sans text-sm leading-relaxed focus:bg-white focus:ring-1 focus:outline-none disabled:opacity-50"
                />
              </div>

              {detectedQuestions.length === 0 && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={
                      isExtracting ||
                      characterCount < 20 ||
                      characterCount > 20000
                    }
                    onClick={() => executeTextExtraction()}
                    className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>Extract questions &amp; answers</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Progress State (honest status indicator) */}
      {(isExtracting || isPreparing) && (
        <div className="border-brand-peach/80 bg-brand-cream/60 rounded-2xl border p-5 shadow-xs">
          <div className="flex items-center gap-3.5">
            <ArrowPathIcon className="text-brand-tomato h-6 w-6 shrink-0 animate-spin" />
            <div>
              <p className="text-brand-ink text-sm font-bold">
                {isExtracting ? extractionStep : preparingStep}
              </p>
              <p className="text-brand-secondary mt-0.5 text-xs">
                {isExtracting
                  ? "Extracting grounded questions without hallucinating • Preserving your authentic notes"
                  : "Identifying Main ideas, Key terms, Sequences & Mistakes to avoid"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DETECTED QUESTIONS AND ANSWERS MASTER-DETAIL VIEW (matching reference image) */}
      {detectedQuestions.length > 0 && (
        <div className="space-y-4">
          {/* Section Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-brand-ink text-base font-bold sm:text-lg">
                  Detected questions and answers
                </h2>
                <span className="bg-brand-peach/60 text-brand-tomato rounded-full px-2 py-0.5 text-xs font-bold sm:hidden">
                  {detectedQuestions.length} found
                </span>
              </div>
              <p className="text-brand-secondary hidden text-xs sm:block">
                We&apos;ve extracted {detectedQuestions.length} question-answer
                pairs. Review and edit them before saving.
              </p>
            </div>

            {/* Split / Merge / Add Question Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSplitQuestion}
                disabled={!activeQuestion || isPreparing}
                className="border-brand-peach/80 text-brand-ink hover:bg-brand-cream/70 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                title="Split question into two parts"
              >
                <ArrowsUpDownIcon className="text-brand-tomato h-3.5 w-3.5" />
                <span>Split</span>
              </button>

              <button
                type="button"
                onClick={handleMergeQuestion}
                disabled={
                  !activeQuestion ||
                  selectedQuestionIndex >= detectedQuestions.length - 1 ||
                  isPreparing
                }
                className="border-brand-peach/80 text-brand-ink hover:bg-brand-cream/70 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                title="Merge with next question"
              >
                <ArrowsRightLeftIcon className="text-brand-tomato h-3.5 w-3.5" />
                <span>Merge</span>
              </button>

              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={isPreparing}
                className="border-brand-peach/80 text-brand-ink hover:bg-brand-cream/70 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                title="Add an additional question"
              >
                <PlusIcon className="text-brand-tomato h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Question</span>
              </button>
            </div>
          </div>

          {/* Master-Detail Layout */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            {/* Left Column: Master List of Questions (Col 1-5) */}
            <div className="space-y-2 lg:col-span-5">
              {detectedQuestions.map((q, idx) => {
                const isSelected = idx === selectedQuestionIndex;
                const shortTitle = getQuestionShortTitle(q, idx);

                return (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => setSelectedQuestionIndex(idx)}
                    className={`flex w-full cursor-pointer items-center justify-between rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-brand-tomato/80 bg-brand-peach/25 border-l-brand-tomato border-l-4 shadow-xs"
                        : "border-brand-peach/60 hover:bg-brand-cream/40 bg-white"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <h4
                        className={`font-heading truncate text-xs ${
                          isSelected
                            ? "text-brand-ink font-bold"
                            : "text-brand-ink/90 font-semibold"
                        }`}
                      >
                        {idx + 1}. {shortTitle}
                      </h4>
                      <p className="text-brand-secondary mt-0.5 text-[11px]">
                        {q.pageNumber ? `Page ${q.pageNumber} · ` : ""}
                        Question and answer detected
                      </p>
                    </div>
                    <ChevronRightIcon
                      className={`h-4 w-4 shrink-0 transition ${
                        isSelected
                          ? "text-brand-tomato"
                          : "text-brand-secondary/60"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Right Column: Detail Editor for Active Question (Col 6-12) */}
            {activeQuestion && (
              <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
                {/* Detail Header */}
                <div className="border-brand-peach/40 flex items-center justify-between border-b pb-3">
                  <h3 className="font-heading text-brand-ink truncate text-sm font-bold">
                    {selectedQuestionIndex + 1}.{" "}
                    {getQuestionShortTitle(
                      activeQuestion,
                      selectedQuestionIndex
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteDetectedQuestion(selectedQuestionIndex)
                    }
                    title="Delete this question"
                    className="text-brand-secondary hover:text-brand-tomato flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg transition hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Question Editor */}
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-brand-ink flex items-center gap-1.5 text-xs font-bold">
                        <span>Question</span>
                        <PencilSquareIcon className="text-brand-secondary/60 h-3 w-3" />
                      </label>
                      {activeQuestion.pageNumber && (
                        <span className="bg-brand-peach/50 text-brand-tomato rounded px-2 py-0.5 text-[10px] font-bold">
                          Page {activeQuestion.pageNumber}
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={activeQuestion.question}
                      onChange={(e) =>
                        handleUpdateDetectedQuestion(
                          selectedQuestionIndex,
                          "question",
                          e.target.value
                        )
                      }
                      className="border-brand-peach/60 bg-brand-cream/20 text-brand-ink focus:border-brand-tomato focus:ring-brand-tomato mt-1.5 w-full rounded-xl border p-3 text-xs leading-relaxed focus:bg-white focus:ring-1 focus:outline-none"
                    />
                  </div>

                  {/* Reference Answer Editor */}
                  <div>
                    <label className="text-brand-ink flex items-center gap-1.5 text-xs font-bold">
                      <span>Answer (from your material)</span>
                      <PencilSquareIcon className="text-brand-secondary/60 h-3 w-3" />
                    </label>
                    <textarea
                      rows={6}
                      value={activeQuestion.referenceAnswer}
                      onChange={(e) =>
                        handleUpdateDetectedQuestion(
                          selectedQuestionIndex,
                          "referenceAnswer",
                          e.target.value
                        )
                      }
                      className="border-brand-peach/60 bg-brand-cream/20 text-brand-ink focus:border-brand-tomato focus:ring-brand-tomato mt-1.5 w-full rounded-xl border p-3 text-xs leading-relaxed focus:bg-white focus:ring-1 focus:outline-none"
                    />
                  </div>

                  <p className="text-brand-secondary/80 text-[11px]">
                    Grounded in your notes • You can edit the text to adjust
                    questions before generating points to remember.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action: Save and prepare / Continue to review */}
          <div className="flex flex-col items-center justify-end pt-3 sm:flex-row">
            <button
              type="button"
              disabled={isPreparing || isExtracting}
              onClick={handleSaveAndPrepare}
              className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-7 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isPreparing ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  <span>Preparing Important Points...</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Save and prepare</span>
                  <span className="sm:hidden">Continue to review</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
