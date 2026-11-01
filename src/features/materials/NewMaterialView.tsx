"use client";

import React, { Suspense, useState, useRef, useEffect } from "react";
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
import {
  validateStudyFile,
  formatFileSize,
  MAX_BATCH_FILES,
  optimizeSingleImage,
  assessUploadPayloadBudget,
  CLIENT_UPLOAD_BUDGET_BYTES,
  inspectPdf,
} from "@/lib/files";
import { PdfPreview } from "./PdfPreview";
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
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
} from "@/components/icons";

interface StagedFileItem {
  id: string;
  file: File;
  originalFile?: File;
  name: string;
  size: number;
  sizeFormatted: string;
  originalSize?: number;
  originalSizeFormatted?: string;
  type: "pdf" | "image";
  pageCount?: number;
  previewUrl?: string;
  error?: string;
  isOptimizing?: boolean;
  wasOptimized?: boolean;
  isFallback?: boolean;
  optimizationNote?: string;
}

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
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const addMoreImagesInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedFileItem[]>([]);
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

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      stagedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [stagedFiles]);

  // Text counts
  const characterCount = sourceText.length;
  const wordCount = sourceText.trim()
    ? sourceText.trim().split(/\s+/).length
    : 0;

  // Upload payload budget assessment
  const payloadBudget = assessUploadPayloadBudget(
    stagedFiles.map((s) => ({ file: s.file, name: s.name, size: s.size })),
    CLIENT_UPLOAD_BUDGET_BYTES,
    { title: title.trim() || undefined }
  );
  const isAnyImageOptimizing = stagedFiles.some((f) => f.isOptimizing);

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
    stagedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setStagedFiles([]);
    setDetectedQuestions([]);
    setCurrentMaterial(null);
    setError(null);
    setMissingQuestionPrompt(null);
    setMissingAnswerPrompt(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (addMoreImagesInputRef.current) addMoreImagesInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Process single PDF file selection (dedicated to PDF tab)
  const handlePdfChosen = async (file: File) => {
    setError(null);
    if (!file) return;

    try {
      const isPdf =
        file.name.toLowerCase().endsWith(".pdf") ||
        file.type === "application/pdf";

      if (!isPdf) {
        setError(
          "Please select a valid PDF file. For images, please use the 'Take Photo / Upload Images' tab."
        );
        return;
      }

      const buffer = new Uint8Array(await file.arrayBuffer());
      const validation = validateStudyFile(buffer, file.name);

      if (!validation.valid) {
        setError(validation.error || "Unsupported PDF format.");
        return;
      }

      // Clean up previous image URLs
      stagedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });

      const singleItem: StagedFileItem = {
        id: `file_${crypto.randomUUID()}`,
        file,
        originalFile: file,
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
        originalSize: file.size,
        originalSizeFormatted: formatFileSize(file.size),
        type: "pdf",
        pageCount: validation.pageCount,
        isOptimizing: false,
      };

      setStagedFiles([singleItem]);
      setDetectedQuestions([]);
      setCurrentMaterial(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to read the selected PDF."
      );
    }
  };

  // Process image files (from file picker, drag-drop, or camera)
  const handleImagesChosen = async (
    files: File[],
    mode: "replace" | "append"
  ) => {
    setError(null);
    if (!files || files.length === 0) return;

    try {
      const hasPdf = files.some(
        (f) =>
          f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf"
      );
      if (hasPdf) {
        setError(
          "This tab is for image files only. Please switch to the 'Upload File' tab to upload a PDF."
        );
        return;
      }

      const newItems: StagedFileItem[] = [];

      for (const file of files) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const validation = validateStudyFile(buffer, file.name);

        const previewUrl = URL.createObjectURL(file);

        newItems.push({
          id: `file_${crypto.randomUUID()}`,
          file,
          originalFile: file,
          name: file.name,
          size: file.size,
          sizeFormatted: formatFileSize(file.size),
          originalSize: file.size,
          originalSizeFormatted: formatFileSize(file.size),
          type: "image",
          previewUrl,
          error: validation.valid ? undefined : validation.error,
          isOptimizing: validation.valid,
        });
      }

      let updatedList: StagedFileItem[] = [];
      if (mode === "append") {
        const existingImages = stagedFiles.filter((f) => f.type === "image");
        updatedList = [...existingImages, ...newItems];
      } else {
        stagedFiles.forEach((f) => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        updatedList = newItems;
      }

      if (updatedList.length > MAX_BATCH_FILES) {
        setError(`You can stage up to ${MAX_BATCH_FILES} images at a time.`);
        setStagedFiles(updatedList.slice(0, MAX_BATCH_FILES));
        return;
      }

      const firstError = updatedList.find((i) => i.error);
      if (firstError) {
        setError(firstError.error || "One or more images could not be loaded.");
      }

      setStagedFiles(updatedList);
      setDetectedQuestions([]);
      setCurrentMaterial(null);

      // Asynchronously optimize valid newly staged images in background with Web Worker
      const validItemsToOptimize = newItems.filter((i) => !i.error);
      for (const item of validItemsToOptimize) {
        try {
          const res = await optimizeSingleImage(item.file);
          setStagedFiles((prev) =>
            prev.map((f) => {
              if (f.id !== item.id) return f;
              return {
                ...f,
                file: res.file,
                size: res.file.size,
                sizeFormatted: formatFileSize(res.file.size),
                isOptimizing: false,
                wasOptimized: res.wasOptimized,
                isFallback: res.isFallback,
                optimizationNote: res.note,
              };
            })
          );
        } catch {
          setStagedFiles((prev) =>
            prev.map((f) => {
              if (f.id !== item.id) return f;
              return {
                ...f,
                isOptimizing: false,
                isFallback: true,
                optimizationNote: "Original retained (safe fallback)",
              };
            })
          );
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to read the selected files."
      );
    }
  };

  // Move image earlier in page order
  const moveFileUp = (index: number) => {
    if (index <= 0) return;
    setStagedFiles((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1]!;
      copy[index - 1] = copy[index]!;
      copy[index] = temp;
      return copy;
    });
  };

  // Move image later in page order
  const moveFileDown = (index: number) => {
    if (index >= stagedFiles.length - 1) return;
    setStagedFiles((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1]!;
      copy[index + 1] = copy[index]!;
      copy[index] = temp;
      return copy;
    });
  };

  // Remove individual staged file
  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setDetectedQuestions([]);
        setCurrentMaterial(null);
      }
      return updated;
    });
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

  const handlePdfDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files);
      const pdf = dropped.find(
        (f) =>
          f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf"
      );
      if (!pdf) {
        setError(
          "This tab is dedicated to PDF documents. Please drop a PDF file, or switch to 'Take Photo / Upload Images' to upload images."
        );
        return;
      }
      await handlePdfChosen(pdf);
    }
  };

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files);
      await handleImagesChosen(dropped, "replace");
    }
  };

  // Extract from staged files
  const executeExtractionWithFiles = async (filesToExtract?: File[]) => {
    const files = filesToExtract || stagedFiles.map((s) => s.file);

    if (files.length === 0) {
      setError("Please select at least one document or image.");
      return;
    }

    if (isExtracting) return; // Prevent duplicate submit clicks

    if (!payloadBudget.withinBudget) {
      setError(
        payloadBudget.warning
          ? `${payloadBudget.warning} ${payloadBudget.actionGuidance || ""}`.trim()
          : "These pages are too large to add together. Try selecting fewer pages."
      );
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      if (files.length === 1 && files[0]?.type === "application/pdf") {
        setExtractionStep("Reading PDF document...");
        const pdfFile = files[0];
        try {
          const inspection = await inspectPdf(pdfFile);
          if (
            inspection &&
            inspection.classification === "text" &&
            inspection.aggregateText.length >= 20
          ) {
            setExtractionStep("Analyzing your pages...");
            const jsonRes = await fetch("/api/extract", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: title.trim() || undefined,
                sourceText: inspection.aggregateText,
                sourceType: "pdf",
                fileName: pdfFile.name,
                fileSize: pdfFile.size,
                pageCount: inspection.pageCount,
              }),
            });
            const jsonExtractData = await jsonRes.json();
            if (!jsonRes.ok || !jsonExtractData.success) {
              throw new Error(
                jsonExtractData.error ||
                  "Could not extract exam questions from this document. Please verify the file has clear, legible text."
              );
            }

            const material: StudyMaterial = jsonExtractData.studyMaterial;
            const questions: ExtractedQuestion[] = jsonExtractData.questions;
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
            return;
          }
        } catch (inspectErr: unknown) {
          // If text extraction fails, proceed with multipart binary upload fallback
          if (
            inspectErr instanceof Error &&
            inspectErr.message.includes("No question-answer pairs")
          ) {
            throw inspectErr;
          }
        }
      }

      setExtractionStep(
        files.length === 1 && files[0]?.type === "application/pdf"
          ? "Reading PDF document..."
          : `Reading ${files.length} page(s)...`
      );

      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      if (title.trim()) {
        formData.append("title", title.trim());
      }

      setExtractionStep("Analyzing your pages...");

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

    if (isExtracting) return; // Prevent duplicate clicks

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

    if (isPreparing) return; // Prevent double submit

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

      const primaryStaged = stagedFiles[0];
      const totalStagedSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

      const materialToSave: StudyMaterial = currentMaterial || {
        id: `mat_${Date.now()}`,
        title: title.trim() || "Untitled Study Set",
        sourceText: rawText,
        characterCount: rawText.length,
        sourceType: primaryStaged?.type || "text",
        fileName:
          stagedFiles.length > 1
            ? `${stagedFiles.length} pages (${primaryStaged?.name}...)`
            : primaryStaged?.name,
        fileSize: totalStagedSize || undefined,
        pageCount: primaryStaged?.pageCount || stagedFiles.length || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

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

      setPreparingStep("Saving your study set...");

      const studySet: StudySet = {
        id: materialToSave.id,
        material: materialToSave,
        questions: detectedQuestions,
        rubrics,
        createdAt: materialToSave.createdAt,
        updatedAt: materialToSave.updatedAt,
      };

      await saveStudySet(studySet);
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

  const getQuestionShortTitle = (q: ExtractedQuestion, idx: number) => {
    const clean = q.question
      .replace(/^(question\s*\d*[:.-]?\s*|\d+[:.-]\s*)/i, "")
      .trim();
    if (clean.length > 32) {
      return `${clean.slice(0, 32)}...`;
    }
    return clean || `Question ${idx + 1}`;
  };

  const isPdfStaged =
    stagedFiles.length === 1 && stagedFiles[0]?.type === "pdf";
  const stagedImages = stagedFiles.filter((f) => f.type === "image");
  const totalStagedBytes = stagedFiles.reduce((acc, f) => acc + f.size, 0);

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

      {/* Page Header with Decorative Illustration */}
      <div className="border-brand-peach/60 relative flex w-full min-w-0 flex-col justify-between overflow-hidden rounded-2xl border bg-white/80 p-5 shadow-xs sm:flex-row sm:items-center sm:p-7">
        <div className="max-w-xl">
          <h1 className="font-heading text-brand-ink text-xl font-bold sm:text-2xl">
            Add your study material
          </h1>
          <p className="text-brand-secondary mt-1.5 text-xs leading-relaxed sm:text-sm">
            Upload multiple photos, a PDF or paste text. We&apos;ll extract and
            organise the questions and answers for you to review.
          </p>
        </div>

        {/* Decorative Notes Illustration on Desktop */}
        <div className="hidden shrink-0 items-center justify-center sm:flex sm:pl-4">
          <div className="relative flex h-24 w-28 items-center justify-center">
            <div className="bg-brand-peach/50 absolute h-18 w-18 rotate-12 rounded-xl shadow-xs" />
            <div className="border-brand-peach/80 bg-brand-cream absolute h-20 w-16 -rotate-6 rounded-xl border p-2 shadow-sm">
              <div className="bg-brand-peach/70 mb-1.5 h-1.5 w-8 rounded-full" />
              <div className="bg-brand-peach/50 mb-1 h-1 w-10 rounded-full" />
              <div className="bg-brand-peach/50 mb-1 h-1 w-11 rounded-full" />
              <div className="bg-brand-peach/50 mb-1 h-1 w-7 rounded-full" />
            </div>
            <SparklesIcon className="text-brand-tomato absolute -top-1 right-2 h-5 w-5 animate-pulse" />
            <div className="bg-brand-tomato/80 absolute bottom-1 -left-1 h-2 w-2 rounded-full" />
          </div>
        </div>
      </div>

      {/* Input Mode Tabs */}
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
          <span>Upload File (PDF)</span>
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
          <span className="hidden sm:inline">Take Photo / Upload Images</span>
          <span className="sm:hidden">Photo / Images</span>
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

      {/* Hidden File Inputs */}
      {/* 1. Dedicated PDF file input */}
      <input
        ref={pdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handlePdfChosen(e.target.files[0]);
          }
        }}
      />

      {/* 2. Image multi-file input (replace) */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleImagesChosen(Array.from(e.target.files), "replace");
          }
        }}
      />

      {/* 3. Image multi-file input (append) */}
      <input
        ref={addMoreImagesInputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleImagesChosen(Array.from(e.target.files), "append");
          }
        }}
      />

      {/* 4. Camera capture input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleImagesChosen([e.target.files[0]], "append");
          }
        }}
      />

      {/* TAB 1: UPLOAD FILE (Dedicated to PDF Uploads) */}
      {activeTab === "upload" && isPdfStaged && (
        <div className="border-brand-peach/80 w-full min-w-0 space-y-4 rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
          <div className="border-brand-peach/40 flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2.5">
              <span className="font-heading text-brand-ink text-sm font-bold">
                Selected PDF Document
              </span>
              <span className="bg-brand-cream text-brand-tomato border-brand-peach rounded-full border px-2 py-0.5 text-[10px] font-bold">
                {stagedFiles[0]?.pageCount || 1} pages
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="border-brand-peach bg-brand-cream/80 text-brand-ink hover:bg-brand-peach/40 inline-flex h-8 cursor-pointer items-center justify-center rounded-xl border px-3 text-xs font-semibold shadow-2xs transition"
              >
                Change PDF
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="text-brand-secondary hover:text-brand-tomato flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl transition hover:bg-red-50"
                title="Clear file"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="bg-brand-peach/50 text-brand-tomato flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <DocumentTextIcon className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-heading text-brand-ink text-sm font-bold">
                  {stagedFiles[0]?.name}
                </h4>
                <p className="text-brand-secondary text-xs">
                  {stagedFiles[0]?.pageCount} pages ·{" "}
                  {stagedFiles[0]?.sizeFormatted}
                </p>
              </div>
            </div>
          </div>

          {/* Local PDF Preview */}
          {stagedFiles[0]?.file && <PdfPreview file={stagedFiles[0].file} />}

          {detectedQuestions.length === 0 && (
            <div className="border-brand-peach/40 flex flex-col gap-3 border-t pt-3">
              {!payloadBudget.withinBudget && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="flex-1">
                      <p className="font-bold">{payloadBudget.warning}</p>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        {payloadBudget.actionGuidance}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="flex flex-col gap-0.5">
                  <span className="text-brand-secondary text-xs">
                    Extract all authentic exam questions and answers from this
                    PDF.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isExtracting || !payloadBudget.withinBudget}
                  onClick={() => executeExtractionWithFiles()}
                  className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isExtracting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      <span>Extracting questions &amp; answers...</span>
                    </>
                  ) : (
                    <>
                      <span>Extract questions &amp; answers</span>
                      <span>&rarr;</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "upload" && !isPdfStaged && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handlePdfDrop}
          className={`border-brand-peach/80 bg-brand-cream/30 rounded-2xl border-2 border-dashed p-6 transition sm:p-10 ${
            isDragging ? "border-brand-tomato bg-brand-peach/20" : ""
          }`}
        >
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12 md:gap-8">
            <div className="flex flex-col items-center justify-center text-center md:col-span-6">
              <div className="bg-brand-peach/50 text-brand-tomato mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl">
                <DocumentTextIcon className="h-7 w-7" />
              </div>
              <h3 className="font-heading text-brand-ink text-sm font-bold sm:text-base">
                <span className="hidden sm:inline">
                  Drag and drop your PDF here
                </span>
                <span className="sm:hidden">Tap to choose a PDF</span>
              </h3>
              <p className="text-brand-secondary mt-1 text-xs">
                Upload assignment, question bank, or study notes PDF (Max 20MB,
                up to 50 pages)
              </p>
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="bg-brand-tomato hover:bg-brand-tomato-hover mt-4 inline-flex h-10 cursor-pointer items-center justify-center rounded-xl px-6 text-xs font-bold text-white shadow-xs transition"
              >
                Choose PDF File
              </button>
            </div>

            <div className="text-brand-secondary/60 flex items-center justify-center text-xs font-medium md:col-span-1">
              <span>or</span>
            </div>

            <div className="border-brand-peach/60 rounded-xl border bg-white/70 p-4 md:col-span-5">
              <h4 className="font-heading text-brand-ink text-xs font-bold tracking-wider uppercase">
                Dedicated PDF Ingestion
              </h4>
              <ul className="mt-3 space-y-2.5 text-xs">
                <li className="text-brand-secondary flex items-start gap-2.5">
                  <DocumentTextIcon className="text-brand-tomato mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <strong className="text-brand-ink">PDF files</strong>{" "}
                    (notes, assignments, question banks up to 20MB)
                  </span>
                </li>
                <li className="text-brand-secondary flex items-start gap-2.5">
                  <PhotoIcon className="text-brand-tomato mt-0.5 h-4 w-4 shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("photo");
                      setError(null);
                    }}
                    className="cursor-pointer text-left hover:underline"
                  >
                    <span>
                      Have photos of notes? Switch to{" "}
                      <strong className="text-brand-ink">
                        Take Photo / Upload Images
                      </strong>
                    </span>
                  </button>
                </li>
                <li className="text-brand-secondary flex items-start gap-2.5">
                  <PencilSquareIcon className="text-brand-tomato mt-0.5 h-4 w-4 shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("paste");
                      setError(null);
                    }}
                    className="cursor-pointer text-left hover:underline"
                  >
                    <span>
                      Have text? Switch to{" "}
                      <strong className="text-brand-ink">Paste Text</strong>
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TAKE PHOTO / UPLOAD IMAGES */}
      {activeTab === "photo" && stagedImages.length > 0 && (
        <div className="border-brand-peach/80 w-full min-w-0 space-y-4 rounded-2xl border bg-white p-4 shadow-xs sm:p-5">
          {/* Header Bar */}
          <div className="border-brand-peach/40 flex items-center justify-between border-b pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-heading text-brand-ink text-sm font-bold">
                Selected Pages ({stagedImages.length}{" "}
                {stagedImages.length === 1 ? "image" : "images"} ·{" "}
                {formatFileSize(totalStagedBytes)})
              </span>
              <span className="bg-brand-cream text-brand-tomato border-brand-peach rounded-full border px-2 py-0.5 text-[10px] font-bold">
                {stagedImages.length} page(s) ordered
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Laptop & Desktop action: Add more images file picker */}
              <button
                type="button"
                onClick={() => addMoreImagesInputRef.current?.click()}
                className="border-brand-peach bg-brand-cream/80 text-brand-ink hover:bg-brand-peach/40 hidden h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-2xs transition lg:inline-flex"
              >
                <PlusIcon className="text-brand-tomato h-3.5 w-3.5" />
                <span>Add more images</span>
              </button>

              {/* Mobile & Tablet actions: Take another photo (primary) + Add files (secondary) */}
              <div className="inline-flex items-center gap-1.5 lg:hidden">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold text-white shadow-2xs transition"
                >
                  <CameraIcon className="h-3.5 w-3.5" />
                  <span>Add another photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => addMoreImagesInputRef.current?.click()}
                  className="border-brand-peach text-brand-ink hover:bg-brand-cream/80 inline-flex h-8 cursor-pointer items-center justify-center gap-1 rounded-xl border bg-white px-2.5 text-xs font-semibold shadow-2xs transition"
                  title="Select more images from device"
                >
                  <PlusIcon className="text-brand-tomato h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add files</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleClearAll}
                className="text-brand-secondary hover:text-brand-tomato flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl transition hover:bg-red-50"
                title="Clear all images"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Multiple Images List with Ordering Controls & Thumbnails */}
          <div className="space-y-2.5">
            <p className="text-brand-secondary text-[11px]">
              Review page order below. Use arrows to reorder pages before
              extraction so answers spanning pages remain continuous.
            </p>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {stagedImages.map((item, idx) => (
                <div
                  key={item.id}
                  className="border-brand-peach/60 bg-brand-cream/20 flex items-center justify-between rounded-xl border p-2.5 shadow-2xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {item.previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                      />
                    ) : (
                      <div className="bg-brand-peach/50 text-brand-tomato flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                        <PhotoIcon className="h-6 w-6" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="bg-brand-tomato rounded px-1.5 py-0.5 text-[9px] font-bold text-white">
                          Page {idx + 1}
                        </span>
                      </div>
                      <h5 className="font-heading text-brand-ink mt-0.5 truncate text-xs font-bold">
                        {item.name}
                      </h5>
                      <div className="text-brand-secondary flex items-center gap-1.5 text-[10px]">
                        <span>{item.sizeFormatted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ordering Controls & Remove */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || isExtracting}
                      onClick={() => moveFileUp(idx)}
                      title="Move earlier (Page Up)"
                      className="text-brand-secondary hover:text-brand-ink cursor-pointer p-1 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowUpIcon className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      disabled={idx === stagedImages.length - 1 || isExtracting}
                      onClick={() => moveFileDown(idx)}
                      title="Move later (Page Down)"
                      className="text-brand-secondary hover:text-brand-ink cursor-pointer p-1 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDownIcon className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      disabled={isExtracting}
                      onClick={() => removeStagedFile(idx)}
                      title="Remove this image"
                      className="text-brand-secondary hover:text-brand-tomato cursor-pointer p-1 disabled:cursor-not-allowed"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Extract Questions Action Button */}
          {detectedQuestions.length === 0 && (
            <div className="border-brand-peach/40 flex flex-col gap-3 border-t pt-3">
              {!payloadBudget.withinBudget && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="flex-1">
                      <p className="font-bold">{payloadBudget.warning}</p>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        {payloadBudget.actionGuidance}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="flex flex-col gap-0.5">
                  <span className="text-brand-secondary text-xs">
                    Extract all questions across all {stagedImages.length}{" "}
                    page(s) in order.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isExtracting || !payloadBudget.withinBudget}
                  onClick={() => executeExtractionWithFiles()}
                  className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isExtracting ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      <span>Extracting questions &amp; answers...</span>
                    </>
                  ) : (
                    <>
                      <span>Extract questions &amp; answers</span>
                      <span>&rarr;</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "photo" && stagedImages.length === 0 && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleImageDrop}
          className={`border-brand-peach/80 bg-brand-cream/30 rounded-2xl border-2 border-dashed p-6 transition sm:p-10 ${
            isDragging ? "border-brand-tomato bg-brand-peach/20" : ""
          }`}
        >
          {/* LAPTOP & DESKTOP (>= lg): Primary action is "Upload images", no camera primary button */}
          <div className="mx-auto hidden max-w-lg flex-col items-center text-center lg:flex">
            <div className="bg-brand-peach/50 text-brand-tomato mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <PhotoIcon className="h-7 w-7" />
            </div>
            <h3 className="font-heading text-brand-ink text-base font-bold">
              Upload photos of your study notes
            </h3>
            <p className="text-brand-secondary mt-1 max-w-md text-xs leading-relaxed">
              Select multiple JPG, PNG, or WebP photos of your handwritten notes
              or question sheets. You can select up to 15 images at once.
            </p>

            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="bg-brand-tomato hover:bg-brand-tomato-hover mt-5 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-xs font-bold text-white shadow-xs transition"
            >
              <PhotoIcon className="h-4 w-4" />
              <span>Upload images</span>
            </button>

            <p className="text-brand-secondary/70 mt-3 text-[11px]">
              Or drag and drop multiple image files directly here
            </p>
          </div>

          {/* MOBILE & TABLET (< lg): Primary action is "Take photo", with accessible "Select from device" */}
          <div className="mx-auto flex max-w-md flex-col items-center text-center lg:hidden">
            <div className="bg-brand-peach/50 text-brand-tomato mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl">
              <CameraIcon className="h-7 w-7" />
            </div>
            <h3 className="font-heading text-brand-ink text-base font-bold">
              Take photos or upload images
            </h3>
            <p className="text-brand-secondary mt-1 text-xs leading-relaxed">
              Snap clear photos of each page in sequence, or select existing
              images from your device gallery.
            </p>

            <div className="mt-5 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              {/* Primary camera action for phones & tablets */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 text-xs font-bold text-white shadow-xs transition sm:w-auto"
              >
                <CameraIcon className="h-4 w-4" />
                <span>Take photo</span>
              </button>

              {/* Accessible image upload for mobile & tablet */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="border-brand-peach hover:bg-brand-cream/80 text-brand-ink inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white px-5 text-xs font-semibold shadow-2xs transition sm:w-auto"
              >
                <PhotoIcon className="text-brand-tomato h-4 w-4" />
                <span>Select from device</span>
              </button>
            </div>

            <p className="text-brand-secondary/70 mt-3 text-[11px]">
              Supports up to 15 images (Max 25MB total). You can capture
              multiple photos in sequence.
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: Paste Text Area */}
      {activeTab === "paste" && (
        <div className="w-full min-w-0 space-y-5">
          {/* Curated Sample Presets: Dedicated Section */}
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

      {/* Loading Progress State */}
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

      {/* DETECTED QUESTIONS AND ANSWERS MASTER-DETAIL VIEW */}
      {detectedQuestions.length > 0 && (
        <div className="space-y-4">
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
            {/* Left Column: Master List of Questions */}
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
                      <div className="flex items-center gap-1.5">
                        <h4
                          className={`font-heading truncate text-xs ${
                            isSelected
                              ? "text-brand-ink font-bold"
                              : "text-brand-ink/90 font-semibold"
                          }`}
                        >
                          {idx + 1}. {shortTitle}
                        </h4>
                        {q.isUncertain && (
                          <span className="py-0.2 shrink-0 rounded bg-amber-100 px-1.5 text-[9px] font-bold text-amber-800">
                            Check
                          </span>
                        )}
                      </div>
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

            {/* Right Column: Detail Editor for Active Question */}
            {activeQuestion && (
              <div className="border-brand-peach/80 rounded-2xl border bg-white p-5 shadow-xs lg:col-span-7">
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

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-brand-ink flex items-center gap-1.5 text-xs font-bold">
                        <span>Question</span>
                        <PencilSquareIcon className="text-brand-secondary/60 h-3 w-3" />
                      </label>
                      <div className="flex items-center gap-1.5">
                        {activeQuestion.pageNumber && (
                          <span className="bg-brand-peach/50 text-brand-tomato rounded px-2 py-0.5 text-[10px] font-bold">
                            Page {activeQuestion.pageNumber}
                          </span>
                        )}
                        {activeQuestion.isUncertain && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            ⚠️ Review wording
                          </span>
                        )}
                      </div>
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
