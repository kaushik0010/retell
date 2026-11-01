import imageCompression from "browser-image-compression";

/**
 * Client-Side Adaptive Image Optimization for Retell Study Materials.
 *
 * Runs strictly in the browser using Web Workers to prevent UI thread blocking.
 * Optimizes for optical character recognition, handwriting legibility, mathematical notation,
 * and diagram fidelity rather than aggressive, destructive compression.
 */

export interface ImageOptimizationConfig {
  /** Maximum file size in megabytes. Default: 0.9 MB */
  maxSizeMB?: number;
  /** Maximum width or height in pixels. Default: 2048 px */
  maxWidthOrHeight?: number;
  /** Initial compression quality ratio (0 to 1). Default: 0.86 */
  initialQuality?: number;
  /** Execute compression in background Web Worker. Default: true */
  useWebWorker?: boolean;
  /** Skip compression if file is already below this threshold in bytes. Default: 200 KB */
  minCompressibleSizeBytes?: number;
  /** Preserve EXIF orientation. Default: false (normalizes orientation right-side up) */
  preserveExif?: boolean;
}

export const DEFAULT_OPTIMIZATION_CONFIG: Required<ImageOptimizationConfig> = {
  maxSizeMB: 0.9, // 900 KB target keeps multi-image batches comfortably under 3.5 MB
  maxWidthOrHeight: 2048, // 2048px maintains crisp 8pt handwriting, indices, and formulas
  initialQuality: 0.86, // High visual fidelity for diagrams and printed textbooks
  useWebWorker: true, // Off-main-thread processing keeps animations at 60 FPS
  minCompressibleSizeBytes: 200 * 1024, // 200 KB: already-compact images are not re-compressed
  preserveExif: false, // Normalizes rotated smartphone photos to correct orientation
};

export interface OptimizedImageResult {
  /** The final file to be uploaded (optimized file or original fallback) */
  file: File;
  /** The untouched original file */
  originalFile: File;
  /** Original file size in bytes */
  originalSize: number;
  /** Optimized (or retained) file size in bytes */
  optimizedSize: number;
  /** True if compression successfully reduced file size */
  wasOptimized: boolean;
  /** True if optimization encountered an issue and safely fell back to original */
  isFallback: boolean;
  /** Size ratio: optimizedSize / originalSize */
  compressionRatio: number;
  /** Human-readable status note (e.g. "4.2 MB → 680 KB (84% saved)") */
  note: string;
  /** Optional error or warning message */
  error?: string;
}

/**
 * Determines whether a file is an image eligible for optimization.
 */
export function isOptimizableImage(file: File): boolean {
  if (!file) return false;
  const mime = (file.type || "").toLowerCase();
  if (
    mime.startsWith("image/jpeg") ||
    mime.startsWith("image/png") ||
    mime.startsWith("image/webp")
  ) {
    return true;
  }
  const name = (file.name || "").toLowerCase();
  return (
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

/**
 * Formats a byte number into a concise human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Optimizes a single image file adaptively in the browser.
 * Guaranteed to never mutate the original File reference.
 */
export async function optimizeSingleImage(
  file: File,
  userConfig: ImageOptimizationConfig = {},
  onProgress?: (progressPercent: number) => void
): Promise<OptimizedImageResult> {
  const originalSize = file.size;

  // 1. Guard against non-image inputs (e.g. PDF files passed into optimizer)
  if (!isOptimizableImage(file)) {
    return {
      file,
      originalFile: file,
      originalSize,
      optimizedSize: originalSize,
      wasOptimized: false,
      isFallback: false,
      compressionRatio: 1.0,
      note: "Non-image format retained",
    };
  }

  const config = { ...DEFAULT_OPTIMIZATION_CONFIG, ...userConfig };

  // 2. Bypass optimization for already-small images to avoid quality degradation
  if (originalSize <= config.minCompressibleSizeBytes) {
    return {
      file,
      originalFile: file,
      originalSize,
      optimizedSize: originalSize,
      wasOptimized: false,
      isFallback: false,
      compressionRatio: 1.0,
      note: `Already optimal (${formatBytes(originalSize)})`,
    };
  }

  // 3. Determine target MIME type preserving transparency for PNGs
  let targetMime = file.type || "image/jpeg";
  if (file.name.toLowerCase().endsWith(".png") || targetMime.includes("png")) {
    // Preserve PNG format so diagrams and notes with transparent backgrounds do not render black
    targetMime = "image/png";
  } else if (
    file.name.toLowerCase().endsWith(".webp") ||
    targetMime.includes("webp")
  ) {
    targetMime = "image/webp";
  } else {
    targetMime = "image/jpeg";
  }

  try {
    const compressionOptions = {
      maxSizeMB: config.maxSizeMB,
      maxWidthOrHeight: config.maxWidthOrHeight,
      initialQuality: config.initialQuality,
      useWebWorker: config.useWebWorker,
      fileType: targetMime,
      preserveExif: config.preserveExif,
      onProgress: onProgress,
    };

    const compressedBlob = await imageCompression(file, compressionOptions);

    // 4. Fallback if compressed output ended up larger than original (e.g. dense vector charts)
    if (!compressedBlob || compressedBlob.size >= originalSize) {
      return {
        file,
        originalFile: file,
        originalSize,
        optimizedSize: originalSize,
        wasOptimized: false,
        isFallback: false,
        compressionRatio: 1.0,
        note: `Original retained (${formatBytes(originalSize)})`,
      };
    }

    // 5. Ensure output File retains original filename and valid MIME type
    const outputFileName =
      file.name || `page_${Date.now()}.${targetMime.split("/")[1] || "jpg"}`;
    const optimizedFile = new File([compressedBlob], outputFileName, {
      type: compressedBlob.type || targetMime,
      lastModified: Date.now(),
    });

    const savedPercent = Math.round(
      ((originalSize - optimizedFile.size) / originalSize) * 100
    );

    return {
      file: optimizedFile,
      originalFile: file,
      originalSize,
      optimizedSize: optimizedFile.size,
      wasOptimized: true,
      isFallback: false,
      compressionRatio: optimizedFile.size / originalSize,
      note: `${formatBytes(originalSize)} → ${formatBytes(optimizedFile.size)} (${savedPercent}% saved)`,
    };
  } catch (err: unknown) {
    // 6. Resilient fallback: retain original file if Web Worker or Canvas fails
    const errorMessage =
      err instanceof Error ? err.message : "Compression unavailable";
    console.warn(
      `[ImageOptimizer] Optimization failed for "${file.name}", using original:`,
      err
    );

    return {
      file,
      originalFile: file,
      originalSize,
      optimizedSize: originalSize,
      wasOptimized: false,
      isFallback: true,
      compressionRatio: 1.0,
      note: `Original retained (${formatBytes(originalSize)})`,
      error: errorMessage,
    };
  }
}

/**
 * Optimizes an array of images sequentially with bounded memory consumption.
 * Preserves exact selection order and isolates individual file errors.
 */
export async function optimizeImageBatch(
  files: File[],
  userConfig: ImageOptimizationConfig = {},
  onBatchProgress?: (
    currentIndex: number,
    totalFiles: number,
    latestResult: OptimizedImageResult
  ) => void
): Promise<OptimizedImageResult[]> {
  const results: OptimizedImageResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const result = await optimizeSingleImage(file, userConfig);
    results.push(result);
    onBatchProgress?.(i + 1, files.length, result);
  }

  return results;
}
