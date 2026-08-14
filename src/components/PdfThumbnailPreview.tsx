import React, { useState, useEffect, useRef, useMemo } from "react";
import { FileText, Loader2 } from "lucide-react";
import { getAbsoluteAttachmentUrl } from "../lib/utils";

interface PdfThumbnailPreviewProps {
  url?: string | null;
  file?: File | null;
  title?: string;
  className?: string;
  showOverlayBadge?: boolean;
}

// Global script loader helper for PDF.js CDN
let pdfjsLoadPromise: Promise<any> | null = null;

// Global memory cache for PDF thumbnail Data URIs for instant zero-latency rendering
export const pdfThumbnailDataUriCache = new Map<string, string>();

// Hydrate from session storage on startup if available
if (typeof window !== "undefined") {
  try {
    const stored = sessionStorage.getItem("stands_pdf_thumbnails_cache");
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === "string") pdfThumbnailDataUriCache.set(k, v);
      });
    }
  } catch (e) {}
}

function persistThumbnailCache(key: string, dataUrl: string) {
  pdfThumbnailDataUriCache.set(key, dataUrl);
  if (typeof window !== "undefined") {
    try {
      // Keep most recent 50 entries in session storage to avoid storage quota overflow
      const entries: Record<string, string> = {};
      let count = 0;
      for (const [k, v] of pdfThumbnailDataUriCache.entries()) {
        if (count++ > 50) break;
        // Don't store oversized entries in sessionStorage
        if (v.length < 150000) entries[k] = v;
      }
      sessionStorage.setItem("stands_pdf_thumbnails_cache", JSON.stringify(entries));
    } catch (e) {}
  }
}

// Concurrency Queue for PDF Rasterization: Prevents 20 parallel PDF.js workers from choking the main UI thread
interface RenderTask {
  absUrl: string;
  resolve: (res: string | null) => void;
  reject: (err: any) => void;
}

const renderQueue: RenderTask[] = [];
let activeRendersCount = 0;
const MAX_CONCURRENT_PDF_RENDERS = 2;

function processNextInQueue() {
  if (activeRendersCount >= MAX_CONCURRENT_PDF_RENDERS || renderQueue.length === 0) {
    return;
  }

  const nextTask = renderQueue.shift();
  if (!nextTask) return;

  activeRendersCount++;
  executePdfRasterization(nextTask.absUrl)
    .then((result) => {
      nextTask.resolve(result);
    })
    .catch((err) => {
      nextTask.reject(err);
    })
    .finally(() => {
      activeRendersCount--;
      processNextInQueue();
    });
}

function queuePdfRasterization(absUrl: string): Promise<string | null> {
  if (pdfThumbnailDataUriCache.has(absUrl)) {
    return Promise.resolve(pdfThumbnailDataUriCache.get(absUrl)!);
  }

  return new Promise((resolve, reject) => {
    renderQueue.push({ absUrl, resolve, reject });
    processNextInQueue();
  });
}

function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("SSR");
  if ((window as any).pdfjsLib) {
    return Promise.resolve((window as any).pdfjsLib);
  }
  if (pdfjsLoadPromise) {
    return pdfjsLoadPromise;
  }

  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.onload = () => {
      const pdfjs = (window as any).pdfjsLib;
      if (pdfjs) {
        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(pdfjs);
      } else {
        reject(new Error("PDF.js failed to load"));
      }
    };
    script.onerror = () => reject(new Error("PDF.js script load error"));
    document.head.appendChild(script);
  });

  return pdfjsLoadPromise;
}

// Eagerly initiate PDF.js loading on module import
if (typeof window !== "undefined") {
  loadPdfJs().catch(() => {});
}

/**
 * Execute PDF Page 1 Rasterization with memory cleanup
 */
async function executePdfRasterization(absUrl: string): Promise<string | null> {
  try {
    const pdfjs = await loadPdfJs();
    let pdfData: any;
    if (absUrl.startsWith("data:application/pdf;base64,")) {
      const base64Str = absUrl.replace("data:application/pdf;base64,", "");
      const binaryStr = window.atob(base64Str);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      pdfData = { data: bytes };
    } else {
      pdfData = { url: absUrl };
    }

    const loadingTask = pdfjs.getDocument(pdfData);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const canvas = document.createElement("canvas");
    const unscaledViewport = page.getViewport({ scale: 1 });
    const desiredWidth = 280; // Compact thumbnail resolution
    const scale = desiredWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return null;

    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport }).promise;

    let dataUrl = canvas.toDataURL("image/webp", 0.80);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.80);
    }

    // Clean up canvas memory immediately
    canvas.width = 1;
    canvas.height = 1;

    persistThumbnailCache(absUrl, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn("PDF.js rasterization notice:", err);
    return null;
  }
}

/**
 * Pre-render a PDF thumbnail into global memory cache ahead of user interaction
 */
export async function preloadPdfThumbnail(url: string): Promise<string | null> {
  if (!url) return null;
  const absUrl = getAbsoluteAttachmentUrl(url) || url;
  if (pdfThumbnailDataUriCache.has(absUrl)) {
    return pdfThumbnailDataUriCache.get(absUrl)!;
  }
  return queuePdfRasterization(absUrl);
}

export const PdfThumbnailPreview: React.FC<PdfThumbnailPreviewProps> = ({
  url,
  file,
  title,
  className = "",
  showOverlayBadge = true,
}) => {
  const [renderedCanvas, setRenderedCanvas] = useState(false);
  const [cachedImgUri, setCachedImgUri] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  // Maintain blob URL for local File objects
  useEffect(() => {
    if (file) {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        try {
          const created = URL.createObjectURL(file);
          setObjectUrl(created);
          return () => {
            URL.revokeObjectURL(created);
          };
        } catch (e) {
          console.warn("Failed to create object URL for PDF file:", e);
        }
      }
    } else {
      setObjectUrl(null);
    }
  }, [file]);

  // Resolve target PDF URL string
  const targetPdfUrl = useMemo(() => {
    if (objectUrl) return objectUrl;
    if (!url) return "";
    let rawUrl = url;
    if (typeof url === "string" && url.includes("::")) {
      const parts = url.split("::");
      rawUrl = parts[1] || parts[0];
    }
    const absUrl = getAbsoluteAttachmentUrl(rawUrl) || rawUrl;
    return absUrl || "";
  }, [url, objectUrl]);

  // Fallback iframe URL with page=1 parameters
  const iframeSource = useMemo(() => {
    if (!targetPdfUrl) return "";
    if (targetPdfUrl.startsWith("data:") || targetPdfUrl.startsWith("blob:") || targetPdfUrl.startsWith("http") || targetPdfUrl.startsWith("/")) {
      if (!targetPdfUrl.includes("#")) {
        return `${targetPdfUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
      }
    }
    return targetPdfUrl;
  }, [targetPdfUrl]);

  // Attempt to render First Page with PDF.js via Concurrency Queue
  useEffect(() => {
    let isCancelled = false;

    if (!targetPdfUrl) {
      setRendering(false);
      return;
    }

    // Instant zero-latency memory cache hit
    if (pdfThumbnailDataUriCache.has(targetPdfUrl)) {
      setCachedImgUri(pdfThumbnailDataUriCache.get(targetPdfUrl)!);
      setRendering(false);
      setRenderedCanvas(true);
      return;
    }

    setRendering(true);
    setRenderedCanvas(false);
    setHasError(false);

    queuePdfRasterization(targetPdfUrl)
      .then((dataUri) => {
        if (isCancelled) return;
        if (dataUri) {
          setCachedImgUri(dataUri);
          setRenderedCanvas(true);
        } else {
          setRenderedCanvas(false);
        }
        setRendering(false);
      })
      .catch(() => {
        if (isCancelled) return;
        setRenderedCanvas(false);
        setRendering(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [targetPdfUrl]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center select-none group ${className}`}
    >
      {/* 1. Instant cached thumbnail render */}
      {cachedImgUri ? (
        <img
          src={cachedImgUri}
          alt={title || "PDF Thumbnail"}
          loading="lazy"
          className="w-full h-full object-cover transition-opacity duration-200"
        />
      ) : null}

      {/* 2. Secondary Fallback: High-density Iframe Preview */}
      {!cachedImgUri && iframeSource && !hasError && (
        <iframe
          src={iframeSource}
          title={title || "PDF Document First Page Preview"}
          onError={() => setHasError(true)}
          className="w-[200%] h-[200%] origin-top-left scale-50 border-0 pointer-events-none select-none bg-white dark:bg-slate-950"
          tabIndex={-1}
        />
      )}

      {/* 3. Loading Indicator Overlay */}
      {rendering && !cachedImgUri && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/10 dark:bg-slate-950/20 backdrop-blur-[1px]">
          <Loader2 size={16} className="text-rose-600 dark:text-rose-400 animate-spin" />
        </div>
      )}

      {/* 4. Ultimate Error / Placeholder State */}
      {hasError && !cachedImgUri && (
        <div className="flex flex-col items-center justify-center p-2 text-center w-full h-full bg-gradient-to-b from-rose-50/90 to-rose-100/40 dark:from-rose-950/40 dark:to-slate-900">
          <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-0.5 shadow-sm">
            <FileText size={16} />
          </div>
          <span className="text-[8px] font-mono font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            PDF DOC
          </span>
        </div>
      )}

      {/* Transparent overlay for click events */}
      <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
    </div>
  );
};
