/**
 * Client-Side Image Compression Utility
 * Rescales and compresses image files (JPEG, PNG, WebP, HEIC/camera) before base64 encoding or upload.
 * Preserves high visual fidelity for invoices, receipts, and vouchers while reducing payload by 70%-90%.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.82,
  mimeType: "image/webp",
};

/**
 * Check if a file is an image based on MIME type and file extension
 */
export function isImageFile(file: File | string): boolean {
  if (typeof file === "string") {
    const lower = file.toLowerCase();
    return (
      lower.startsWith("data:image/") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif") ||
      lower.endsWith(".bmp")
    );
  }
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
}

/**
 * Compress an HTML5 File object to an RFC 2397 compliant Data URI string.
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // If not an image or SVG, read as regular Data URI without canvas conversion
    if (!isImageFile(file) || file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        reject(new Error("Empty image file read"));
        return;
      }

      compressDataUri(rawDataUrl, opts)
        .then(resolve)
        .catch(() => resolve(rawDataUrl)); // Graceful fallback to original Data URI
    };
    reader.onerror = () => reject(reader.error || new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an existing Data URI image string using Canvas resampling
 */
export async function compressDataUri(
  dataUri: string,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!dataUri || !dataUri.startsWith("data:image/")) {
    return dataUri;
  }

  // SVG images are vector-based and should not be raster-compressed
  if (dataUri.startsWith("data:image/svg+xml")) {
    return dataUri;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        let { width, height } = img;
        const maxW = opts.maxWidth || 1600;
        const maxH = opts.maxHeight || 1600;

        // Calculate proportional scale
        if (width > maxW || height > maxH) {
          if (width / maxW > height / maxH) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) {
          resolve(dataUri);
          return;
        }

        // Fill white background for transparent images when converting to JPEG/WebP
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        // High quality bicubic smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Check if WebP is supported by trying to encode
        let outputMime = opts.mimeType || "image/webp";
        let compressed = canvas.toDataURL(outputMime, opts.quality);

        if (!compressed.startsWith(`data:${outputMime}`)) {
          // Fallback to JPEG if WebP encoding unsupported by browser canvas
          outputMime = "image/jpeg";
          compressed = canvas.toDataURL(outputMime, opts.quality);
        }

        // Clean up canvas memory
        canvas.width = 1;
        canvas.height = 1;

        // If compressed version is somehow larger than original (e.g. tiny thumbnail), keep original
        if (compressed.length < dataUri.length || dataUri.length > 500000) {
          resolve(compressed);
        } else {
          resolve(dataUri);
        }
      } catch (err) {
        console.warn("[Image Compression Notice]: Canvas compression fallback used", err);
        resolve(dataUri);
      }
    };

    img.onerror = () => {
      resolve(dataUri);
    };

    img.src = dataUri;
  });
}

/**
 * Batch compress an array of File objects with progress notifications
 */
export async function batchCompressFiles(
  files: File[],
  options?: CompressionOptions
): Promise<{ file: File; dataUri: string; originalSize: number; compressedSize: number }[]> {
  const results: { file: File; dataUri: string; originalSize: number; compressedSize: number }[] = [];

  for (const file of files) {
    const originalSize = file.size;
    const dataUri = await compressImageFile(file, options);
    const compressedSize = Math.round((dataUri.length * 3) / 4); // Approximate base64 byte size

    results.push({
      file,
      dataUri,
      originalSize,
      compressedSize,
    });
  }

  return results;
}
