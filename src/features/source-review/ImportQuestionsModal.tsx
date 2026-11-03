"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ExtractedQuestion,
  QuestionRubric,
  StudySet,
} from "@/lib/domain/study-set";
import {
  validateStudyFile,
  formatFileSize,
  MAX_BATCH_FILES,
  optimizeSingleImage,
  assessUploadPayloadBudget,
  CLIENT_UPLOAD_BUDGET_BYTES,
} from "@/lib/files";
import { getStudentFriendlyErrorMessage } from "@/lib/errors";
import {
  ArrowPathIcon,
  DocumentTextIcon,
  AlertCircleIcon,
  TrashIcon,
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
} from "@/components/icons";

interface StagedImportFile {
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

interface CandidateQuestion {
  tempId: string;
  question: string;
  referenceAnswer: string;
  sourceExcerpt?: string;
  pageNumber?: number;
  isUncertain?: boolean;
  selected: boolean;
}

interface ImportQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  studySet: StudySet;
  onImportSuccess: (
    importedQuestions: ExtractedQuestion[],
    importedRubrics: Record<string, QuestionRubric>,
    appendedSource: string
  ) => Promise<void>;
}

export function ImportQuestionsModal({
  isOpen,
  onClose,
  studySet,
  onImportSuccess,
}: ImportQuestionsModalProps) {
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [stagedFiles, setStagedFiles] = useState<StagedImportFile[]>([]);
  const [candidates, setCandidates] = useState<CandidateQuestion[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStep, setExtractionStep] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount or file changes
  useEffect(() => {
    return () => {
      stagedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [stagedFiles]);

  if (!isOpen) return null;

  const handleFilesSelected = async (
    files: File[],
    mode: "replace" | "append"
  ) => {
    setError(null);
    if (!files || files.length === 0) return;

    try {
      const pdf = files.find(
        (f) =>
          f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf"
      );

      if (pdf) {
        // PDF replaces staged files as a single document
        const buffer = new Uint8Array(await pdf.arrayBuffer());
        const validation = validateStudyFile(buffer, pdf.name);
        if (!validation.valid) {
          setError(validation.error || "Unsupported PDF file.");
          return;
        }

        stagedFiles.forEach((f) => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });

        setStagedFiles([
          {
            id: `import_${crypto.randomUUID()}`,
            file: pdf,
            originalFile: pdf,
            name: pdf.name,
            size: pdf.size,
            sizeFormatted: formatFileSize(pdf.size),
            originalSize: pdf.size,
            originalSizeFormatted: formatFileSize(pdf.size),
            type: "pdf",
            pageCount: validation.pageCount,
            isOptimizing: false,
          },
        ]);
        return;
      }

      // Process images
      const newStaged: StagedImportFile[] = [];
      for (const file of files) {
        const buffer = new Uint8Array(await file.arrayBuffer());
        const validation = validateStudyFile(buffer, file.name);
        const previewUrl = URL.createObjectURL(file);

        newStaged.push({
          id: `import_${crypto.randomUUID()}`,
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

      let updated: StagedImportFile[] = [];
      if (mode === "append") {
        const existingImages = stagedFiles.filter((f) => f.type === "image");
        updated = [...existingImages, ...newStaged];
      } else {
        stagedFiles.forEach((f) => {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        });
        updated = newStaged;
      }

      if (updated.length > MAX_BATCH_FILES) {
        setError(`You can stage up to ${MAX_BATCH_FILES} images at a time.`);
        setStagedFiles(updated.slice(0, MAX_BATCH_FILES));
        return;
      }

      setStagedFiles(updated);

      // Asynchronously optimize valid newly staged images in background
      const validItemsToOptimize = newStaged.filter((i) => !i.error);
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
      setError(getStudentFriendlyErrorMessage(err, "extraction"));
    }
  };

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

  const removeStaged = (index: number) => {
    setStagedFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Upload payload budget assessment
  const payloadBudget = assessUploadPayloadBudget(
    stagedFiles.map((s) => ({ file: s.file, name: s.name, size: s.size })),
    CLIENT_UPLOAD_BUDGET_BYTES,
    { title: studySet.material.title }
  );
  const isAnyImageOptimizing = stagedFiles.some((f) => f.isOptimizing);

  // Execute extraction on staged files
  const handleExtractQuestions = async () => {
    if (stagedFiles.length === 0 || isExtracting) return;

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
      setExtractionStep(
        stagedFiles[0]?.type === "pdf"
          ? "Reading assignment PDF..."
          : `Reading and ordering ${stagedFiles.length} image page(s)...`
      );

      const formData = new FormData();
      for (const item of stagedFiles) {
        formData.append("files", item.file);
      }
      formData.append("title", studySet.material.title);

      setExtractionStep("Extracting questions and answers...");

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Failed to extract questions from uploaded files."
        );
      }

      if (!data.questions || data.questions.length === 0) {
        throw new Error(
          data.message ||
            "No questions and answers could be extracted from these files."
        );
      }

      const extractedItems: CandidateQuestion[] = data.questions.map(
        (q: ExtractedQuestion, idx: number) => ({
          tempId: `cand_${idx}_${Date.now()}`,
          question: q.question,
          referenceAnswer: q.referenceAnswer,
          sourceExcerpt: q.sourceExcerpt,
          pageNumber: q.pageNumber,
          isUncertain: q.isUncertain,
          selected: true,
        })
      );

      setCandidates(extractedItems);
      setStep("preview");
    } catch (err) {
      setError(getStudentFriendlyErrorMessage(err, "extraction"));
    } finally {
      setIsExtracting(false);
      setExtractionStep("");
    }
  };

  // Toggle selection for candidate question
  const toggleCandidateSelection = (index: number) => {
    setCandidates((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index]!, selected: !copy[index]!.selected };
      }
      return copy;
    });
  };

  const updateCandidateField = (
    index: number,
    field: "question" | "referenceAnswer",
    value: string
  ) => {
    setCandidates((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index]!, [field]: value };
      }
      return copy;
    });
  };

  // Confirm import and generate rubrics
  const handleConfirmImport = async () => {
    const selectedList = candidates.filter((c) => c.selected);
    if (selectedList.length === 0) {
      setError("Please select at least one question to import.");
      return;
    }

    if (isImporting) return; // Prevent duplicate clicks

    // Validate fields
    for (let i = 0; i < selectedList.length; i++) {
      const c = selectedList[i]!;
      if (!c.question.trim()) {
        setError(`Question ${i + 1} has an empty question prompt.`);
        return;
      }
      if (!c.referenceAnswer.trim()) {
        setError(`Question ${i + 1} has an empty reference answer.`);
        return;
      }
    }

    setIsImporting(true);
    setError(null);

    try {
      const importedQuestions: ExtractedQuestion[] = [];
      const importedRubrics: Record<string, QuestionRubric> = {};
      const appendedSourceParts: string[] = [];

      for (let i = 0; i < selectedList.length; i++) {
        const item = selectedList[i]!;
        const newQId = `q_${crypto.randomUUID()}`;
        const orderIdx = studySet.questions.length + i;

        const newQuestion: ExtractedQuestion = {
          id: newQId,
          studyMaterialId: studySet.material.id,
          orderIndex: orderIdx,
          question: item.question.trim(),
          referenceAnswer: item.referenceAnswer.trim(),
          sourceExcerpt: item.sourceExcerpt || "",
          pageNumber: item.pageNumber,
          isUncertain: item.isUncertain,
        };

        importedQuestions.push(newQuestion);
        appendedSourceParts.push(
          `Question: ${newQuestion.question}\nAnswer: ${newQuestion.referenceAnswer}`
        );

        setImportProgress(
          `Finding important points for imported Question ${i + 1} of ${selectedList.length}...`
        );

        try {
          const rubricRes = await fetch("/api/rubric", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: newQId,
              question: newQuestion.question,
              referenceAnswer: newQuestion.referenceAnswer,
              sourceText:
                studySet.material.sourceText || newQuestion.referenceAnswer,
              studyMaterialId: studySet.material.id,
            }),
          });

          const rubricData = await rubricRes.json();
          if (rubricRes.ok && rubricData.success && rubricData.rubric) {
            importedRubrics[newQId] = rubricData.rubric;
          } else {
            // Safe fallback criterion so question is never lost
            importedRubrics[newQId] = {
              id: `rub_${crypto.randomUUID()}`,
              questionId: newQId,
              studyMaterialId: studySet.material.id,
              criteria: [
                {
                  id: `crit_${crypto.randomUUID()}`,
                  category: "essential_concept",
                  name: "Main Idea",
                  description: "Central idea explaining this concept.",
                  satisfactoryDemonstration:
                    "Explain the core concept accurately in your own words.",
                  isMandatory: true,
                  orderIndex: 0,
                },
              ],
              updatedAt: new Date().toISOString(),
            };
          }
        } catch {
          // Safe fallback rubric
          importedRubrics[newQId] = {
            id: `rub_${crypto.randomUUID()}`,
            questionId: newQId,
            studyMaterialId: studySet.material.id,
            criteria: [
              {
                id: `crit_${crypto.randomUUID()}`,
                category: "essential_concept",
                name: "Main Idea",
                description: "Central idea explaining this concept.",
                satisfactoryDemonstration:
                  "Explain the core concept accurately in your own words.",
                isMandatory: true,
                orderIndex: 0,
              },
            ],
            updatedAt: new Date().toISOString(),
          };
        }
      }

      setImportProgress("Saving updated study set...");
      await onImportSuccess(
        importedQuestions,
        importedRubrics,
        appendedSourceParts.join("\n\n")
      );

      // Reset and close
      setStep("upload");
      setStagedFiles([]);
      setCandidates([]);
      onClose();
    } catch (err) {
      setError(getStudentFriendlyErrorMessage(err, "extraction"));
    } finally {
      setIsImporting(false);
      setImportProgress("");
    }
  };

  const isPdfStaged =
    stagedFiles.length === 1 && stagedFiles[0]?.type === "pdf";
  const selectedCount = candidates.filter((c) => c.selected).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="border-brand-peach/80 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="border-brand-peach/50 flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand-peach/50 text-brand-tomato flex h-9 w-9 items-center justify-center rounded-xl">
              <DocumentTextIcon className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="import-modal-title"
                className="font-heading text-brand-ink text-base font-bold sm:text-lg"
              >
                Import Questions into Study Set
              </h2>
              <p className="text-brand-secondary max-w-md truncate text-xs">
                Add questions to &quot;{studySet.material.title}&quot; from PDF
                or images
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isExtracting || isImporting}
            className="text-brand-secondary hover:text-brand-ink hover:bg-brand-cream flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-lg font-bold transition disabled:opacity-40"
          >
            &times;
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <div className="flex items-start gap-2">
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="flex-1 font-medium">{error}</div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="cursor-pointer font-bold text-red-700"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "upload" ? (
            <div className="space-y-4">
              {stagedFiles.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-brand-peach hover:border-brand-tomato/70 bg-brand-cream/30 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition"
                >
                  <DocumentTextIcon className="text-brand-tomato mb-2.5 h-10 w-10" />
                  <h3 className="font-heading text-brand-ink text-sm font-bold sm:text-base">
                    Select a PDF or multiple note photos
                  </h3>
                  <p className="text-brand-secondary mt-1 text-xs">
                    Choose assignment files to extract questions and answers
                    from
                  </p>
                  <button
                    type="button"
                    className="bg-brand-tomato hover:bg-brand-tomato-hover mt-4 inline-flex h-9 items-center justify-center rounded-xl px-5 text-xs font-bold text-white shadow-xs"
                  >
                    Browse Files
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border-brand-peach/40 flex items-center justify-between border-b pb-2.5">
                    <span className="font-heading text-brand-ink text-xs font-bold">
                      {isPdfStaged
                        ? "Selected PDF Document"
                        : `Selected Image Pages (${stagedFiles.length})`}
                    </span>
                    {!isPdfStaged && (
                      <button
                        type="button"
                        onClick={() => addMoreInputRef.current?.click()}
                        className="text-brand-tomato inline-flex items-center gap-1 text-xs font-bold hover:underline"
                      >
                        <PlusIcon className="h-3 w-3" />
                        <span>Add more pages</span>
                      </button>
                    )}
                  </div>

                  {/* Staged file cards */}
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {stagedFiles.map((item, idx) => (
                      <div
                        key={item.id}
                        className="border-brand-peach/60 bg-brand-cream/20 flex items-center justify-between rounded-xl border p-2.5 text-xs"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {item.previewUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={item.previewUrl}
                              alt={item.name}
                              className="h-10 w-10 shrink-0 rounded-md border object-cover"
                            />
                          ) : (
                            <DocumentTextIcon className="text-brand-tomato h-7 w-7 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <span className="bg-brand-tomato py-0.2 rounded px-1.5 text-[9px] font-bold text-white">
                              {item.type === "pdf" ? "PDF" : `Page ${idx + 1}`}
                            </span>
                            <h4 className="font-heading text-brand-ink truncate text-xs font-bold">
                              {item.name}
                            </h4>
                            <span className="text-brand-secondary text-[10px]">
                              {item.pageCount
                                ? `${item.pageCount} pages · ${item.sizeFormatted}`
                                : item.sizeFormatted}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {stagedFiles.length > 1 && (
                            <>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveFileUp(idx)}
                                className="text-brand-secondary hover:text-brand-ink p-1 disabled:opacity-30"
                                title="Move earlier"
                              >
                                <ArrowUpIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === stagedFiles.length - 1}
                                onClick={() => moveFileDown(idx)}
                                className="text-brand-secondary hover:text-brand-ink p-1 disabled:opacity-30"
                                title="Move later"
                              >
                                <ArrowDownIcon className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => removeStaged(idx)}
                            className="text-brand-secondary hover:text-brand-tomato p-1"
                            title="Remove"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!payloadBudget.withinBudget && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                      <p className="font-bold">{payloadBudget.warning}</p>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        {payloadBudget.actionGuidance}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Extraction progress indicator */}
              {isExtracting && (
                <div className="border-brand-peach/80 bg-brand-cream/60 flex items-center gap-3 rounded-xl border p-4">
                  <ArrowPathIcon className="text-brand-tomato h-5 w-5 shrink-0 animate-spin" />
                  <div className="text-xs">
                    <p className="text-brand-ink font-bold">{extractionStep}</p>
                    <p className="text-brand-secondary mt-0.5 text-[11px]">
                      Extracting grounded questions and reference answers
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Step: Preview extracted questions */
            <div className="space-y-4">
              <div className="border-brand-peach/40 flex items-center justify-between border-b pb-2">
                <span className="font-heading text-brand-ink text-xs font-bold">
                  Extracted Questions ({selectedCount} of {candidates.length}{" "}
                  selected)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCandidates((prev) =>
                        prev.map((c) => ({ ...c, selected: true }))
                      )
                    }
                    className="text-brand-tomato font-semibold hover:underline"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCandidates((prev) =>
                        prev.map((c) => ({ ...c, selected: false }))
                      )
                    }
                    className="text-brand-secondary hover:text-brand-ink"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {candidates.map((cand, idx) => (
                  <div
                    key={cand.tempId}
                    className={`rounded-xl border p-3.5 transition ${
                      cand.selected
                        ? "border-brand-tomato/70 bg-brand-peach/10"
                        : "border-brand-peach/50 bg-white opacity-70"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={cand.selected}
                        onChange={() => toggleCandidateSelection(idx)}
                        className="text-brand-tomato focus:ring-brand-tomato mt-1 h-4 w-4 cursor-pointer rounded"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-heading text-brand-ink text-xs font-bold">
                            Question {idx + 1}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {cand.pageNumber && (
                              <span className="bg-brand-cream text-brand-secondary py-0.2 rounded px-1.5 text-[10px]">
                                Page {cand.pageNumber}
                              </span>
                            )}
                            {cand.isUncertain && (
                              <span className="py-0.2 rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900">
                                ⚠️ Review wording
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="text-brand-secondary mb-0.5 block text-[10px] font-bold tracking-wider uppercase">
                            Question Prompt
                          </label>
                          <textarea
                            rows={2}
                            value={cand.question}
                            onChange={(e) =>
                              updateCandidateField(
                                idx,
                                "question",
                                e.target.value
                              )
                            }
                            className="border-brand-peach/60 text-brand-ink focus:border-brand-tomato w-full rounded-lg border bg-white p-2 text-xs focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-brand-secondary mb-0.5 block text-[10px] font-bold tracking-wider uppercase">
                            Reference Answer
                          </label>
                          <textarea
                            rows={3}
                            value={cand.referenceAnswer}
                            onChange={(e) =>
                              updateCandidateField(
                                idx,
                                "referenceAnswer",
                                e.target.value
                              )
                            }
                            className="border-brand-peach/60 text-brand-ink focus:border-brand-tomato w-full rounded-lg border bg-white p-2 text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Import progress indicator */}
              {isImporting && (
                <div className="border-brand-peach/80 bg-brand-cream/60 flex items-center gap-3 rounded-xl border p-4">
                  <ArrowPathIcon className="text-brand-tomato h-5 w-5 shrink-0 animate-spin" />
                  <div className="text-xs">
                    <p className="text-brand-ink font-bold">{importProgress}</p>
                    <p className="text-brand-secondary mt-0.5 text-[11px]">
                      Generating points to remember and persisting to your study
                      set
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFilesSelected(Array.from(e.target.files), "replace");
            }
          }}
        />
        <input
          ref={addMoreInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFilesSelected(Array.from(e.target.files), "append");
            }
          }}
        />

        {/* Modal Footer Actions */}
        <div className="border-brand-peach/50 flex items-center justify-between border-t p-4 sm:p-5">
          {step === "upload" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isExtracting}
                className="text-brand-secondary hover:text-brand-ink cursor-pointer text-xs font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  stagedFiles.length === 0 ||
                  isExtracting ||
                  isAnyImageOptimizing ||
                  !payloadBudget.withinBudget
                }
                onClick={handleExtractQuestions}
                className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <span>Extract questions</span>
                    <span>&rarr;</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isImporting}
                onClick={() => setStep("upload")}
                className="text-brand-secondary hover:text-brand-ink cursor-pointer text-xs font-medium disabled:opacity-40"
              >
                &larr; Back to files
              </button>

              <button
                type="button"
                disabled={selectedCount === 0 || isImporting}
                onClick={handleConfirmImport}
                className="bg-brand-tomato hover:bg-brand-tomato-hover inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-xs font-bold text-white shadow-xs transition disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    <span>
                      Import {selectedCount} Selected Question
                      {selectedCount === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
