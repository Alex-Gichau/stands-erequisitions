/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  X, 
  Maximize2, 
  Minimize2, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  RotateCcw, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Cast, 
  Sun, 
  Moon, 
  Contrast, 
  FileText, 
  FileSpreadsheet, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  ExternalLink, 
  Printer, 
  Sparkles,
  Layers,
  Grid,
  Search,
  Crosshair,
  Sliders,
  Share2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  cn, 
  normalizeAttachmentUrl, 
  getAttachmentFileName, 
  getAbsoluteAttachmentUrl, 
  formatCurrency, 
  formatDate 
} from "../lib/utils";
import { CachedImage } from "./CachedImage";
import { PdfThumbnailPreview } from "./PdfThumbnailPreview";
import { Requisition, UserRole, RequisitionStatus } from "../types";

export type ProjectionTheme = "cinema" | "daylight" | "inverted" | "blueprint";

export interface AttachmentProjectionModalProps {
  attachments: string[];
  initialIndex?: number;
  onClose: () => void;
  requisition?: Requisition | null;
  title?: string;
  groupName?: string;
  amount?: number;
  amountWords?: string;
  requesterName?: string;
  status?: string;
}

export const AttachmentProjectionModal: React.FC<AttachmentProjectionModalProps> = ({
  attachments: rawAttachments = [],
  initialIndex = 0,
  onClose,
  requisition,
  title: customTitle,
  groupName: customGroupName,
  amount: customAmount,
  amountWords: customAmountWords,
  requesterName: customRequesterName,
  status: customStatus
}) => {
  // Normalize attachments array
  const attachments = useMemo(() => {
    if (!rawAttachments) return [];
    if (Array.isArray(rawAttachments)) return rawAttachments.filter(Boolean);
    if (typeof rawAttachments === "string" && rawAttachments) return [rawAttachments];
    return [];
  }, [rawAttachments]);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (initialIndex >= 0 && initialIndex < attachments.length) return initialIndex;
    return 0;
  });

  // Projection Viewport State
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [theme, setTheme] = useState<ProjectionTheme>("cinema");
  const [showMetadataOverlay, setShowMetadataOverlay] = useState<boolean>(true);
  const [showThumbnailsStrip, setShowThumbnailsStrip] = useState<boolean>(true);
  const [isLaserActive, setIsLaserActive] = useState<boolean>(false);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number }>({ x: -100, y: -100 });
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Active attachment resolution
  const currentAttachment = attachments[currentIndex] || "";
  const currentUrl = useMemo(() => normalizeAttachmentUrl(currentAttachment), [currentAttachment]);
  const currentFileName = useMemo(() => getAttachmentFileName(currentAttachment) || `Document_${currentIndex + 1}`, [currentAttachment, currentIndex]);

  const fileExt = useMemo(() => {
    const ext = currentFileName.split(".").pop()?.toLowerCase() || "";
    return ext;
  }, [currentFileName]);

  const isImage = useMemo(() => {
    return (
      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(currentFileName) ||
      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(currentUrl) ||
      currentUrl.startsWith("data:image/") ||
      currentUrl.startsWith("blob:")
    );
  }, [currentFileName, currentUrl]);

  const isPdf = useMemo(() => {
    return (
      !isImage &&
      (fileExt === "pdf" ||
        /\.(pdf)$/i.test(currentFileName) ||
        /\.(pdf)$/i.test(currentUrl) ||
        currentUrl.startsWith("data:application/pdf"))
    );
  }, [isImage, fileExt, currentFileName, currentUrl]);

  const isExcel = useMemo(() => {
    return (
      fileExt === "xlsx" ||
      fileExt === "xls" ||
      fileExt === "csv" ||
      /\.(xlsx|xls|csv)$/i.test(currentFileName)
    );
  }, [fileExt, currentFileName]);

  const isDoc = useMemo(() => {
    return fileExt === "docx" || fileExt === "doc" || /\.(docx|doc)$/i.test(currentFileName);
  }, [fileExt, currentFileName]);

  // Derived Requisition Info
  const displayTitle = customTitle || requisition?.title || "Requisition Supporting Document";
  const displayGroupName = customGroupName || requisition?.groupName || "Diocese Ministry";
  const displayAmount = customAmount !== undefined ? customAmount : requisition?.amount;
  const displayAmountWords = customAmountWords || requisition?.amountWords;
  const displayRequester = customRequesterName || requisition?.requesterName || "Authorized Member";
  const displayStatus = customStatus || requisition?.status || RequisitionStatus.SUBMITTED;
  const reqId = requisition?.id || "";

  // Reset viewport when navigating attachments
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentIndex]);

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          if (currentIndex < attachments.length - 1) {
            setCurrentIndex((prev) => prev + 1);
          }
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
          }
          break;
        case "+":
        case "=":
          e.preventDefault();
          setZoom((prev) => Math.min(prev + 0.25, 4));
          break;
        case "-":
        case "_":
          e.preventDefault();
          setZoom((prev) => Math.max(prev - 0.25, 0.5));
          break;
        case "0":
          e.preventDefault();
          setZoom(1);
          setOffset({ x: 0, y: 0 });
          setRotation(0);
          break;
        case "r":
        case "R":
          e.preventDefault();
          setRotation((prev) => (prev + 90) % 360);
          break;
        case "l":
        case "L":
          e.preventDefault();
          setIsLaserActive((prev) => !prev);
          break;
        case "h":
        case "H":
          e.preventDefault();
          setShowMetadataOverlay((prev) => !prev);
          break;
        case "t":
        case "T":
          e.preventDefault();
          setShowThumbnailsStrip((prev) => !prev);
          break;
        case "i":
        case "I":
          e.preventDefault();
          setTheme((prev) => (prev === "inverted" ? "cinema" : "inverted"));
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, attachments.length, onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Drag & Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isLaserActive && stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      setLaserPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    if (!isDragging || zoom <= 1) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(prev + 0.15, 4));
    } else {
      setZoom((prev) => Math.max(prev - 0.15, 0.5));
    }
  };

  // Pop-out Projector Window for Dual Displays / HDMI Projectors
  const openExternalProjectorWindow = () => {
    const projectorData = {
      url: currentUrl,
      title: displayTitle,
      fileName: currentFileName,
      amount: displayAmount,
      group: displayGroupName,
      status: displayStatus,
    };

    const newWin = window.open(
      "",
      `StAndrewsProjector_${Date.now()}`,
      "width=1280,height=800,menubar=no,toolbar=no,location=no,status=no"
    );

    if (newWin) {
      newWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Projector — ${displayTitle}</title>
            <style>
              body { margin: 0; background: #07090e; color: #fff; font-family: system-ui, sans-serif; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
              .header { padding: 12px 24px; background: #0f1422; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
              .content { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; }
              img { max-width: 95vw; max-height: 85vh; object-fit: contain; border-radius: 8px; box-shadow: 0 20px 50px rgba(0,0,0,0.8); }
              iframe { width: 95vw; height: 85vh; border: none; border-radius: 8px; }
              .badge { background: #3b82f6; color: white; padding: 4px 10px; border-radius: 999px; font-weight: bold; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <strong style="font-size: 16px;">${displayTitle}</strong>
                <div style="font-size: 12px; color: #94a3b8;">${displayGroupName} &bull; ${displayRequester}</div>
              </div>
              <div>
                <span class="badge">${displayStatus}</span>
              </div>
            </div>
            <div class="content">
              ${
                isPdf
                  ? `<iframe src="${currentUrl}"></iframe>`
                  : `<img src="${currentUrl}" alt="${currentFileName}" />`
              }
            </div>
          </body>
        </html>
      `);
      newWin.document.close();
    }
  };

  const downloadCurrentAttachment = () => {
    const link = document.createElement("a");
    link.href = currentUrl;
    link.download = currentFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Attachment — ${currentFileName}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: sans-serif; text-align: center; }
              img { max-width: 100%; height: auto; }
              .header { margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; text-align: left; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>St. Andrew's PCEA eRequisitions — Document Audit Printout</h2>
              <p><strong>Requisition:</strong> ${displayTitle} | <strong>Group:</strong> ${displayGroupName} | <strong>File:</strong> ${currentFileName}</p>
            </div>
            ${
              isPdf
                ? `<iframe src="${currentUrl}" style="width:100%; height:90vh; border:none;"></iframe>`
                : `<img src="${currentUrl}" onload="window.print();" />`
            }
          </body>
        </html>
      `);
      printWindow.document.close();
      if (isPdf) {
        setTimeout(() => printWindow.print(), 1000);
      }
    }
  };

  // Theme styling helpers
  const themeClasses = {
    cinema: "bg-slate-950 text-slate-100",
    daylight: "bg-slate-100 text-slate-900",
    inverted: "bg-black text-amber-300 filter invert contrast-125",
    blueprint: "bg-slate-900 text-cyan-400 font-mono",
  };

  if (attachments.length === 0) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center text-white shadow-2xl">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <FileText size={32} />
          </div>
          <h3 className="text-lg font-bold">No Attachments to Project</h3>
          <p className="text-xs text-slate-400 mt-2 mb-6">
            There are no supporting vouchers, receipts, or documents attached to this record.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all w-full"
          >
            Close Projector
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed inset-0 z-[160] flex flex-col select-none overflow-hidden transition-colors duration-300",
        themeClasses[theme]
      )}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Laser Pointer Spotlight */}
      {isLaserActive && laserPos.x >= 0 && (
        <div
          className="pointer-events-none fixed z-[200] -translate-x-1/2 -translate-y-1/2"
          style={{ left: laserPos.x, top: laserPos.y }}
        >
          <div className="w-4 h-4 rounded-full bg-rose-500 shadow-[0_0_20px_6px_rgba(244,63,94,0.9)] animate-pulse" />
          <div className="absolute inset-0 w-4 h-4 rounded-full bg-white scale-50" />
        </div>
      )}

      {/* TOP PROJECTION CONTROL BAR */}
      <header className="px-6 py-3.5 bg-slate-950/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-4 z-40 shrink-0">
        {/* Left: Branding & Current Attachment Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
            <Cast size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black uppercase tracking-wider font-mono">
                ATTACHMENT PROJECTOR
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[9px] font-bold uppercase font-mono">
                {currentIndex + 1} OF {attachments.length}
              </span>
              {reqId && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-bold font-mono">
                  #{reqId}
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold text-white truncate mt-0.5 max-w-md md:max-w-xl">
              {currentFileName}
            </h2>
          </div>
        </div>

        {/* Center: Stage Tools (Zoom, Rotate, Laser, Stamp, Presets) */}
        <div className="hidden lg:flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10">
          <button
            onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
            className="p-2 hover:bg-white/10 text-white rounded-xl transition-all"
            title="Zoom Out (-)"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[11px] font-mono font-bold text-white px-2 w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((prev) => Math.min(prev + 0.25, 4))}
            className="p-2 hover:bg-white/10 text-white rounded-xl transition-all"
            title="Zoom In (+)"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
              setRotation(0);
            }}
            className="px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            title="Reset Zoom & Rotation (0)"
          >
            Reset
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            className="p-2 hover:bg-white/10 text-white rounded-xl transition-all"
            title="Rotate 90° Clockwise (R)"
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={() => setIsLaserActive((prev) => !prev)}
            className={cn(
              "p-2 rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold",
              isLaserActive ? "bg-rose-600 text-white shadow-lg shadow-rose-950" : "hover:bg-white/10 text-white"
            )}
            title="Toggle Laser Pointer Spotlight (L)"
          >
            <Crosshair size={16} />
            <span className="hidden xl:inline">Laser</span>
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          {/* Theme Selector */}
          <button
            onClick={() => setTheme("cinema")}
            className={cn(
              "px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
              theme === "cinema" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            Cinema
          </button>
          <button
            onClick={() => setTheme("daylight")}
            className={cn(
              "px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
              theme === "daylight" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
            )}
          >
            Daylight
          </button>
          <button
            onClick={() => setTheme("inverted")}
            className={cn(
              "px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
              theme === "inverted" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
            )}
            title="Invert High-Contrast for thermal receipts (I)"
          >
            Invert
          </button>
        </div>

        {/* Right: Actions (Pop-out, Overlay Toggle, Fullscreen, Print, Download, Close) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMetadataOverlay((prev) => !prev)}
            className={cn(
              "p-2.5 rounded-xl border transition-all text-xs font-bold flex items-center gap-1.5",
              showMetadataOverlay
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            )}
            title="Toggle Financial Header Banner (H)"
          >
            {showMetadataOverlay ? <Eye size={15} /> : <EyeOff size={15} />}
            <span className="hidden md:inline">Header</span>
          </button>

          <button
            onClick={openExternalProjectorWindow}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all"
            title="Open in Dedicated Projector Window / Secondary Screen"
          >
            <ExternalLink size={16} />
          </button>

          <button
            onClick={handlePrint}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all"
            title="Print Document"
          >
            <Printer size={16} />
          </button>

          <button
            onClick={downloadCurrentAttachment}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all"
            title="Download File"
          >
            <Download size={16} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            onClick={onClose}
            className="p-2.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl transition-all ml-2"
            title="Exit Projector (ESC)"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* MAIN PROJECTION CANVAS STAGE */}
      <main
        ref={stageRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing p-4 md:p-8"
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        {/* Floating Presentation Info Overlay Banner */}
        <AnimatePresence>
          {showMetadataOverlay && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-6 left-6 z-30 max-w-xl w-full bg-slate-900/90 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl text-white pointer-events-auto"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-bold">
                      {displayGroupName}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase">
                      {displayStatus}
                    </span>
                    {displayAmount !== undefined && (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                        {formatCurrency(displayAmount)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1.5 truncate">
                    {displayTitle}
                  </h3>
                  {displayAmountWords && (
                    <p className="text-[11px] text-slate-300 italic truncate mt-0.5">
                      "{displayAmountWords}"
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                    <span>
                      Requester: <strong className="text-white">{displayRequester}</strong>
                    </span>
                    {requisition?.payableTo && (
                      <span>
                        Payee: <strong className="text-white">{requisition.payableTo}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Stamp Tag Button */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    onClick={() => setSelectedStamp((prev) => (prev ? null : "APPROVED L2"))}
                    className={cn(
                      "px-3 py-1 rounded-xl text-[9px] font-black tracking-wider uppercase border transition-all",
                      selectedStamp
                        ? "bg-emerald-600 border-emerald-400 text-white shadow-lg"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                    )}
                  >
                    {selectedStamp ? `STAMP: ${selectedStamp}` : "+ AUDIT STAMP"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Projection Stage Media Content */}
        <div
          className="transition-transform duration-75 flex items-center justify-center max-w-full max-h-full"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
        >
          {isImage ? (
            <div className="relative group shadow-2xl rounded-xl overflow-hidden max-h-[82vh] max-w-[90vw]">
              <img
                src={currentUrl}
                alt={currentFileName}
                className="max-h-[82vh] max-w-[90vw] object-contain rounded-xl select-none"
                draggable={false}
              />
              {selectedStamp && (
                <div className="absolute top-10 right-10 rotate-[-12deg] pointer-events-none">
                  <div className="border-4 border-emerald-500 text-emerald-500 font-black text-2xl px-6 py-2 rounded-2xl tracking-widest uppercase bg-slate-950/70 backdrop-blur-sm shadow-2xl">
                    {selectedStamp}
                  </div>
                </div>
              )}
            </div>
          ) : isPdf ? (
            <div className="w-[85vw] h-[82vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
              <iframe
                src={`${currentUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                title={currentFileName}
                className="w-full h-full border-none"
              />
            </div>
          ) : isExcel ? (
            <div className="p-12 bg-slate-900 border border-slate-700 rounded-3xl text-center max-w-md shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-lg">
                <FileSpreadsheet size={40} />
              </div>
              <h4 className="text-lg font-bold text-white">{currentFileName}</h4>
              <p className="text-xs text-slate-400 mt-2 mb-6">
                Excel Spreadsheet Attachment &bull; Download to inspect detailed budget sheets and formulas.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={downloadCurrentAttachment}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2"
                >
                  <Download size={16} />
                  <span>Download Spreadsheet</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-12 bg-slate-900 border border-slate-700 rounded-3xl text-center max-w-md shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30 shadow-lg">
                <FileText size={40} />
              </div>
              <h4 className="text-lg font-bold text-white">{currentFileName}</h4>
              <p className="text-xs text-slate-400 mt-2 mb-6">
                Document File &bull; Download or inspect using system office suite.
              </p>
              <button
                onClick={downloadCurrentAttachment}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 mx-auto"
              >
                <Download size={16} />
                <span>Download Document</span>
              </button>
            </div>
          )}
        </div>

        {/* Carousel Slide Left / Right Arrows */}
        {attachments.length > 1 && (
          <>
            <button
              onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
              disabled={currentIndex === 0}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full backdrop-blur-md border border-white/20 transition-all shadow-2xl disabled:opacity-30 disabled:pointer-events-none hover:scale-110 active:scale-95 z-30"
              title="Previous Attachment (Left Arrow)"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, attachments.length - 1))}
              disabled={currentIndex === attachments.length - 1}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full backdrop-blur-md border border-white/20 transition-all shadow-2xl disabled:opacity-30 disabled:pointer-events-none hover:scale-110 active:scale-95 z-30"
              title="Next Attachment (Right Arrow)"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </main>

      {/* BOTTOM THUMBNAILS CAROUSEL & KEYBOARD HINTS */}
      {showThumbnailsStrip && attachments.length > 1 && (
        <footer className="px-6 py-3 bg-slate-950/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-between gap-4 z-40 shrink-0 overflow-x-auto">
          {/* Thumbnails strip */}
          <div className="flex items-center gap-3 overflow-x-auto py-1">
            {attachments.map((att, idx) => {
              const url = normalizeAttachmentUrl(att);
              const name = getAttachmentFileName(att) || `Doc ${idx + 1}`;
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={`thumb-${idx}`}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "relative w-16 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 group flex items-center justify-center bg-slate-900",
                    isSelected
                      ? "border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)] scale-105"
                      : "border-white/10 hover:border-white/40 opacity-60 hover:opacity-100"
                  )}
                  title={name}
                >
                  <CachedImage src={url} alt={name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                    <span className="text-[9px] font-black text-white px-1 py-0.5 rounded bg-slate-950/80 font-mono">
                      #{idx + 1}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Shortcuts Helper */}
          <div className="hidden xl:flex items-center gap-3 text-[10px] text-slate-400 shrink-0 font-mono">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-bold">&larr; &rarr;</kbd> Slides
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-bold">+/-</kbd> Zoom
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-bold">R</kbd> Rotate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-bold">L</kbd> Laser
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-bold">F</kbd> Fullscreen
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-bold">ESC</kbd> Exit
            </span>
          </div>
        </footer>
      )}
    </div>
  );
};
