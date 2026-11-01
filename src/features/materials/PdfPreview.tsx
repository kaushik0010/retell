"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { ArrowPathIcon, AlertCircleIcon } from "@/components/icons";
import { getPdfJs } from "@/lib/files/pdf-extractor";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export interface PdfPreviewProps {
  file: File;
  className?: string;
  onPageChange?: (page: number, totalPages: number) => void;
}

export function PdfPreview({
  file,
  className = "",
  onPageChange,
}: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [fitMode, setFitMode] = useState<"width" | "custom">("width");
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  // Load PDF Document when file changes
  useEffect(() => {
    let isCancelled = false;

    async function loadDocument() {
      setIsLoadingDoc(true);
      setErrorMessage(null);
      setCurrentPage(1);

      // Clean up previous doc if any
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel error
        }
        renderTaskRef.current = null;
      }

      if (pdfDocRef.current) {
        try {
          await pdfDocRef.current.destroy();
        } catch {
          // ignore
        }
        pdfDocRef.current = null;
      }

      try {
        const pdfjs = await getPdfJs();
        const arrayBuffer = await file.arrayBuffer();

        if (isCancelled) return;

        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          useSystemFonts: true,
          isEvalSupported: false,
        });

        const doc = await loadingTask.promise;

        if (isCancelled) {
          await doc.destroy();
          return;
        }

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setIsLoadingDoc(false);
        onPageChange?.(1, doc.numPages);
      } catch (err: unknown) {
        if (isCancelled) return;
        setIsLoadingDoc(false);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Could not open this PDF document for preview."
        );
      }
    }

    loadDocument();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {}
      }
    };
  }, [file, onPageChange]);

  // Render Page onto Canvas
  const renderPage = useCallback(
    async (pageNumber: number, targetScale: number, isFitWidth: boolean) => {
      const doc = pdfDocRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!doc || !canvas || pageNumber < 1 || pageNumber > doc.numPages)
        return;

      // Cancel ongoing render task before starting a new one
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
        renderTaskRef.current = null;
      }

      setIsRenderingPage(true);

      try {
        const page = await doc.getPage(pageNumber);

        // Calculate scale if fit-to-width
        let effectiveScale = targetScale;
        if (isFitWidth && container) {
          const containerWidth = container.clientWidth - 40; // padding margin
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          if (containerWidth > 0 && unscaledViewport.width > 0) {
            effectiveScale = Math.min(
              Math.max(containerWidth / unscaledViewport.width, 0.4),
              2.0
            );
          }
        }

        const viewport = page.getViewport({ scale: effectiveScale });
        const pixelRatio =
          typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setIsRenderingPage(false);
          return;
        }

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });

        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: unknown) {
        // PDF.js throws RenderingCancelledException when cancelled, which is normal
        if (
          err &&
          typeof err === "object" &&
          "name" in err &&
          err.name === "RenderingCancelledException"
        ) {
          return;
        }
      } finally {
        setIsRenderingPage(false);
      }
    },
    []
  );

  // Trigger render when currentPage, scale, fitMode, or loading finishes
  useEffect(() => {
    if (!isLoadingDoc && pdfDocRef.current && numPages > 0) {
      renderPage(currentPage, scale, fitMode === "width");
    }
  }, [currentPage, scale, fitMode, isLoadingDoc, numPages, renderPage]);

  // Navigation handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      onPageChange?.(prev, numPages);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      onPageChange?.(next, numPages);
    }
  };

  const handleZoomIn = () => {
    setFitMode("custom");
    setScale((prev) => Math.min(Math.round((prev + 0.25) * 100) / 100, 2.5));
  };

  const handleZoomOut = () => {
    setFitMode("custom");
    setScale((prev) => Math.max(Math.round((prev - 0.25) * 100) / 100, 0.5));
  };

  const handleFitWidth = () => {
    setFitMode("width");
    setScale(1.0);
  };

  return (
    <div
      ref={containerRef}
      className={`border-brand-peach/80 bg-brand-cream/30 overflow-hidden rounded-2xl border ${className}`}
    >
      {/* Top Toolbar */}
      <div className="border-brand-peach/50 flex flex-wrap items-center justify-between gap-2 border-b bg-white/95 px-3 py-2 text-xs">
        {/* Page Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1 || isLoadingDoc}
            onClick={handlePrevPage}
            className="border-brand-peach/60 hover:bg-brand-peach/40 text-brand-ink inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border bg-white transition disabled:cursor-not-allowed disabled:opacity-35"
            title="Previous page"
            aria-label="Previous page"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <span className="bg-brand-cream text-brand-ink border-brand-peach/60 rounded-md border px-2.5 py-1 text-[11px] font-bold">
            {isLoadingDoc ? (
              <span className="text-brand-secondary">Loading...</span>
            ) : (
              `Page ${currentPage} of ${numPages}`
            )}
          </span>

          <button
            type="button"
            disabled={currentPage >= numPages || isLoadingDoc}
            onClick={handleNextPage}
            className="border-brand-peach/60 hover:bg-brand-peach/40 text-brand-ink inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border bg-white transition disabled:cursor-not-allowed disabled:opacity-35"
            title="Next page"
            aria-label="Next page"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={isLoadingDoc || (scale <= 0.5 && fitMode === "custom")}
            onClick={handleZoomOut}
            className="border-brand-peach/60 hover:bg-brand-peach/40 text-brand-ink inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border bg-white text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-35"
            title="Zoom out"
            aria-label="Zoom out"
          >
            -
          </button>

          <button
            type="button"
            onClick={handleFitWidth}
            className={`border-brand-peach/60 inline-flex h-7 cursor-pointer items-center justify-center rounded-lg border px-2 text-[11px] font-semibold transition ${
              fitMode === "width"
                ? "bg-brand-peach/50 text-brand-tomato font-bold"
                : "text-brand-ink hover:bg-brand-peach/40 bg-white"
            }`}
            title="Fit to width"
          >
            Fit width
          </button>

          <button
            type="button"
            disabled={isLoadingDoc || (scale >= 2.5 && fitMode === "custom")}
            onClick={handleZoomIn}
            className="border-brand-peach/60 hover:bg-brand-peach/40 text-brand-ink inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border bg-white text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-35"
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas Viewport Area */}
      <div className="relative flex max-h-[520px] min-h-[300px] items-center justify-center overflow-auto bg-stone-100/70 p-4">
        {isLoadingDoc && (
          <div className="flex flex-col items-center gap-2 text-stone-500">
            <ArrowPathIcon className="text-brand-tomato h-6 w-6 animate-spin" />
            <span className="text-xs font-medium">Opening PDF preview...</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex max-w-sm flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <AlertCircleIcon className="h-6 w-6 text-red-600" />
            <p className="text-xs font-semibold text-red-900">{errorMessage}</p>
          </div>
        )}

        {!isLoadingDoc && !errorMessage && (
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="rounded-lg bg-white shadow-md transition-opacity duration-150"
              style={{ opacity: isRenderingPage ? 0.6 : 1.0 }}
            />
            {isRenderingPage && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-white/80 p-2 shadow-xs">
                  <ArrowPathIcon className="text-brand-tomato h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
