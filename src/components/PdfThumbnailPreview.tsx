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
 * Pre-render a PDF thumbnail into global memory cache ahead of user interaction
 */
export async function preloadPdfThumbnail(url: string): Promise<string | null> {
  if (!url) return null;
  const absUrl = getAbsoluteAttachmentUrl(url) || url;
  if (pdfThumbnailDataUriCache.has(absUrl)) {
    return pdfThumbnailDataUriCache.get(absUrl)!;
  }

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
    const desiredWidth = 300;
    const scale = desiredWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/webp", 0.85);
    pdfThumbnailDataUriCache.set(absUrl, dataUrl);
    return dataUrl;
  } catch (err) {
    return null;
  }
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
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  // Attempt to render First Page with PDF.js on HTML5 Canvas or load from memory cache
  useEffect(() => {
    let isCancelled = false;

    if (!targetPdfUrl) {
      setRendering(false);
      return;
    }

    // Check instant memory cache
    if (pdfThumbnailDataUriCache.has(targetPdfUrl)) {
      setCachedImgUri(pdfThumbnailDataUriCache.get(targetPdfUrl)!);
      setRendering(false);
      setRenderedCanvas(true);
      return;
    }

    setRendering(true);
    setRenderedCanvas(false);
    setHasError(false);

    async function renderPdfPageOne() {
      try {
        const pdfjs = await loadPdfJs();
        if (isCancelled) return;

        let pdfData: any;
        if (targetPdfUrl.startsWith("data:application/pdf;base64,")) {
          const base64Str = targetPdfUrl.replace("data:application/pdf;base64,", "");
          const binaryStr = window.atob(base64Str);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          pdfData = { data: bytes };
        } else {
          pdfData = { url: targetPdfUrl };
        }

        const loadingTask = pdfjs.getDocument(pdfData);
        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        const page = await pdf.getPage(1);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const desiredWidth = 300;
        const scale = desiredWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext("2d");
        if (!context) return;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        if (!isCancelled) {
          try {
            const dataUrl = canvas.toDataURL("image/webp", 0.85);
            pdfThumbnailDataUriCache.set(targetPdfUrl, dataUrl);
            setCachedImgUri(dataUrl);
          } catch (e) {}
          setRenderedCanvas(true);
          setRendering(false);
        }
      } catch (err) {
        console.warn("PDF.js canvas rendering notice (falling back to embedded preview):", err);
        if (!isCancelled) {
          setRenderedCanvas(false);
          setRendering(false);
        }
      }
    }

    renderPdfPageOne();

    return () => {
      isCancelled = true;
    };
  }, [targetPdfUrl]);

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-slate-100 dark:bg-slate-900 flex items-center justify-center select-none group ${className}`}
    >
      {/* Instant cached thumbnail render */}
      {cachedImgUri ? (
        <img
          src={cachedImgUri}
          alt={title || "PDF Thumbnail"}
          className="w-full h-full object-cover transition-opacity duration-200"
        />
      ) : (
        /* 1. Primary Render: PDF.js First Page Canvas */
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            renderedCanvas ? "opacity-100 block" : "opacity-0 hidden"
          }`}
        />
      )}

      {/* 2. Secondary Fallback: High-density Iframe Preview */}
      {!renderedCanvas && iframeSource && !hasError && (
        <iframe
          src={iframeSource}
          title={title || "PDF Document First Page Preview"}
          onError={() => setHasError(true)}
          className="w-[200%] h-[200%] origin-top-left scale-50 border-0 pointer-events-none select-none bg-white dark:bg-slate-950"
          tabIndex={-1}
        />
      )}

      {/* 3. Loading Indicator Overlay */}
      {rendering && !renderedCanvas && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/10 dark:bg-slate-950/20 backdrop-blur-[1px]">
          <Loader2 size={16} className="text-rose-600 dark:text-rose-400 animate-spin" />
        </div>
      )}

      {/* 4. Ultimate Error / Placeholder State */}
      {hasError && !renderedCanvas && (
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

      {/* Optional PDF Badge (Removed as requested) */}
    </div>
  );
};
