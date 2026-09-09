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
  Download, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  FileSpreadsheet, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Printer, 
  Layers, 
  CheckCircle2,
  Clock,
  Pin,
  PinOff,
  Building2,
  Tag,
  FolderOpen
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
import { Requisition, RequisitionStatus } from "../types";

export interface ProjectorGalleryItem {
  url: string;
  fileName?: string;
  title?: string;
  requisition?: Requisition | null;
  requisitionId?: string;
  requisitionTitle?: string;
  groupName?: string;
  amount?: number;
  amountWords?: string;
  requesterName?: string;
  status?: string;
  category?: string;
}

export interface AttachmentProjectionModalProps {
  attachments: string[];
  items?: ProjectorGalleryItem[];
  initialIndex?: number;
  onClose: () => void;
  onViewRequisition?: (req: Requisition) => void;
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
  items = [],
  initialIndex = 0,
  onClose,
  onViewRequisition,
  requisition: initialRequisition,
  title: customTitle,
  groupName: customGroupName,
  amount: customAmount,
  amountWords: customAmountWords,
  requesterName: customRequesterName,
  status: customStatus
}) => {
  // Normalize attachments array
  const attachments = useMemo(() => {
    if (rawAttachments && Array.isArray(rawAttachments) && rawAttachments.length > 0) {
      return rawAttachments.filter(Boolean);
    }
    if (items && items.length > 0) {
      return items.map(i => i.url).filter(Boolean);
    }
    if (typeof rawAttachments === "string" && rawAttachments) {
      return [rawAttachments];
    }
    return [];
  }, [rawAttachments, items]);

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
  
  // Side Requisition Details Panel State
  const [showSideDetails, setShowSideDetails] = useState<boolean>(true);
  const [showThumbnailsStrip, setShowThumbnailsStrip] = useState<boolean>(true);
  const [selectedStamp, setSelectedStamp] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Autohide Header State
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);
  const [isHeaderPinned, setIsHeaderPinned] = useState<boolean>(false);
  const hideHeaderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Active item and attachment resolution
  const currentAttachment = attachments[currentIndex] || "";
  const currentUrl = useMemo(() => normalizeAttachmentUrl(currentAttachment), [currentAttachment]);
  
  const currentItem = useMemo<ProjectorGalleryItem | null>(() => {
    if (items && items[currentIndex]) return items[currentIndex];
    return null;
  }, [items, currentIndex]);

  const currentFileName = useMemo(() => {
    return currentItem?.fileName || getAttachmentFileName(currentAttachment) || `Document_${currentIndex + 1}`;
  }, [currentItem, currentAttachment, currentIndex]);

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

  // Dynamically resolve linked Requisition for active document
  const activeRequisition = useMemo<Requisition | null>(() => {
    if (currentItem?.requisition) return currentItem.requisition;
    if (initialRequisition) return initialRequisition;
    return null;
  }, [currentItem, initialRequisition]);

  // Derived Requisition Display Info
  const displayTitle = currentItem?.requisitionTitle || currentItem?.title || customTitle || activeRequisition?.title || currentFileName;
  const displayGroupName = currentItem?.groupName || customGroupName || activeRequisition?.groupName || "Diocese Ministry";
  const displayAmount = currentItem?.amount !== undefined ? currentItem.amount : (customAmount !== undefined ? customAmount : activeRequisition?.amount);
  const displayAmountWords = currentItem?.amountWords || customAmountWords || activeRequisition?.amountWords;
  const displayRequester = currentItem?.requesterName || customRequesterName || activeRequisition?.requesterName || "Authorized Member";
  const displayStatus = currentItem?.status || customStatus || activeRequisition?.status || RequisitionStatus.SUBMITTED;
  const reqId = currentItem?.requisitionId || activeRequisition?.id || "";

  // All attachments for the currently active requisition (for side panel document switcher)
  const requisitionAttachments = useMemo(() => {
    if (!activeRequisition) return [];
    const list: string[] = [];
    const seen = new Set<string>();

    const rawAtts = Array.isArray(activeRequisition.attachments)
      ? activeRequisition.attachments
      : (activeRequisition.attachments ? [activeRequisition.attachments] : []);

    const rawRcpts = Array.isArray(activeRequisition.receipts)
      ? activeRequisition.receipts
      : (activeRequisition.receipts ? [activeRequisition.receipts] : []);

    [...rawAtts, ...rawRcpts].forEach((att) => {
      if (att && typeof att === "string") {
        const norm = normalizeAttachmentUrl(att);
        if (norm && !seen.has(norm)) {
          seen.add(norm);
          list.push(norm);
        }
      }
    });

    return list;
  }, [activeRequisition]);

  // Reset viewport when navigating attachments
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentIndex]);

  // Autohide Header Timer logic
  const resetHeaderTimer = useCallback(() => {
    setIsHeaderVisible(true);
    if (hideHeaderTimeoutRef.current) {
      clearTimeout(hideHeaderTimeoutRef.current);
    }
    if (!isHeaderPinned) {
      hideHeaderTimeoutRef.current = setTimeout(() => {
        setIsHeaderVisible(false);
      }, 3000);
    }
  }, [isHeaderPinned]);

  useEffect(() => {
    if (isHeaderPinned) {
      setIsHeaderVisible(true);
      if (hideHeaderTimeoutRef.current) {
        clearTimeout(hideHeaderTimeoutRef.current);
      }
    } else {
      resetHeaderTimer();
    }
    return () => {
      if (hideHeaderTimeoutRef.current) {
        clearTimeout(hideHeaderTimeoutRef.current);
      }
    };
  }, [isHeaderPinned, resetHeaderTimer]);

  // Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      resetHeaderTimer();

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
        case "d":
        case "D":
          e.preventDefault();
          setShowSideDetails((prev) => !prev);
          break;
        case "t":
        case "T":
          e.preventDefault();
          setShowThumbnailsStrip((prev) => !prev);
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
  }, [currentIndex, attachments.length, onClose, resetHeaderTimer]);

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
    resetHeaderTimer();
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
    resetHeaderTimer();
    if (e.deltaY < 0) {
      setZoom((prev) => Math.min(prev + 0.15, 4));
    } else {
      setZoom((prev) => Math.max(prev - 0.15, 0.5));
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

  // Switch to specific attachment URL
  const handleSelectRequisitionAttachment = (attUrl: string) => {
    const existingIndex = attachments.findIndex(a => normalizeAttachmentUrl(a) === normalizeAttachmentUrl(attUrl));
    if (existingIndex >= 0) {
      setCurrentIndex(existingIndex);
    }
  };

  // Open Requisition Details in main app
  const handleOpenRequisitionDetails = () => {
    if (activeRequisition && onViewRequisition) {
      onClose();
      onViewRequisition(activeRequisition);
    }
  };

  if (attachments.length === 0) {
    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center text-white shadow-2xl">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <FileText size={32} />
          </div>
          <h3 className="text-lg font-bold">No Attachments to Project</h3>
          <p className="text-xs text-slate-400 mt-2 mb-6">
            There are no supporting vouchers, receipts, or documents attached to this record.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all w-full cursor-pointer"
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
      className="fixed inset-0 z-[160] flex flex-col select-none overflow-hidden bg-slate-950 text-slate-100"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Top Edge Trigger Area for Autohide Header */}
      <div 
        className="fixed top-0 left-0 right-0 h-4 z-[170]"
        onMouseEnter={() => setIsHeaderVisible(true)}
      />

      {/* AUTOHIDE TOP PROJECTION CONTROL BAR */}
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: isHeaderVisible ? 0 : -80 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        onMouseEnter={() => {
          if (hideHeaderTimeoutRef.current) clearTimeout(hideHeaderTimeoutRef.current);
          setIsHeaderVisible(true);
        }}
        onMouseLeave={resetHeaderTimer}
        className="fixed top-0 left-0 right-0 px-6 py-3 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-4 z-[180] shadow-2xl"
      >
        {/* Left: Current Attachment & Requisition Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black uppercase tracking-wider font-mono">
                DOCUMENT VIEWER
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
            <h2 className="text-xs md:text-sm font-bold text-white truncate mt-0.5 max-w-sm md:max-w-md lg:max-w-lg">
              {currentFileName}
            </h2>
          </div>
        </div>

        {/* Center: Stage Tools (Zoom, Rotate, Stamp) */}
        <div className="hidden lg:flex items-center gap-1.5 bg-white/5 p-1 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
            className="p-2 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[11px] font-mono font-bold text-white px-2 w-14 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(prev + 0.25, 4))}
            className="p-2 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
              setRotation(0);
            }}
            className="px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
            title="Reset Zoom & Rotation (0)"
          >
            Reset
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            type="button"
            onClick={() => setRotation((prev) => (prev + 90) % 360)}
            className="p-2 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
            title="Rotate 90° Clockwise (R)"
          >
            <RotateCw size={16} />
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button
            type="button"
            onClick={() => setSelectedStamp((prev) => (prev ? null : "VERIFIED"))}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
              selectedStamp ? "bg-emerald-600 text-white shadow-md" : "text-slate-300 hover:bg-white/10"
            )}
            title="Toggle Audit Verified Stamp"
          >
            {selectedStamp ? "Stamped" : "+ Stamp"}
          </button>
        </div>

        {/* Right: Actions (Open Requisition Detail, Side Panel Toggle, Fullscreen, Print, Download, Close) */}
        <div className="flex items-center gap-2">
          {/* Open Requisition Details Button */}
          {activeRequisition && (
            <button
              type="button"
              onClick={handleOpenRequisitionDetails}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-950 cursor-pointer"
              title="Open Requisition Details (shows all attachment documents)"
            >
              <FileText size={14} />
              <span className="hidden sm:inline">Open Requisition Detail</span>
            </button>
          )}

          {/* Toggle Side Requisition Details Panel */}
          <button
            type="button"
            onClick={() => setShowSideDetails((prev) => !prev)}
            className={cn(
              "p-2.5 rounded-xl border transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer",
              showSideDetails
                ? "bg-indigo-600 border-indigo-500 text-white shadow-lg"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            )}
            title="Toggle Requisition Details Side Panel (D)"
          >
            <Layers size={15} />
            <span className="hidden md:inline">Requisition Info</span>
          </button>

          {/* Pin/Unpin Header */}
          <button
            type="button"
            onClick={() => setIsHeaderPinned((prev) => !prev)}
            className={cn(
              "p-2.5 rounded-xl border transition-all text-xs font-bold cursor-pointer hidden md:flex",
              isHeaderPinned
                ? "bg-white/20 border-white/30 text-white"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            )}
            title={isHeaderPinned ? "Header Pinned (Always Visible)" : "Autohide Header Enabled"}
          >
            {isHeaderPinned ? <Pin size={15} /> : <PinOff size={15} />}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all cursor-pointer"
            title="Print Document"
          >
            <Printer size={16} />
          </button>

          <button
            type="button"
            onClick={downloadCurrentAttachment}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all cursor-pointer"
            title="Download File"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl transition-all cursor-pointer"
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl transition-all ml-1 cursor-pointer"
            title="Exit Projector (ESC)"
          >
            <X size={18} />
          </button>
        </div>
      </motion.header>

      {/* MAIN PROJECTION BODY (Stage + Right Side Details Panel) */}
      <div className="flex-1 flex overflow-hidden relative pt-14">
        {/* CENTER PROJECTION STAGE */}
        <main
          ref={stageRef}
          className="flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing p-4 md:p-8"
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
        >
          {/* Projection Stage Media Content */}
          <div
            className="transition-transform duration-75 flex items-center justify-center max-w-full max-h-full"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }}
          >
            {isImage ? (
              <div className="relative group shadow-2xl rounded-2xl overflow-hidden max-h-[80vh] max-w-[85vw] border border-white/10 bg-slate-900/60">
                <img
                  src={currentUrl}
                  alt={currentFileName}
                  className="max-h-[80vh] max-w-[85vw] object-contain rounded-2xl select-none"
                  draggable={false}
                />
                {selectedStamp && (
                  <div className="absolute top-8 right-8 rotate-[-12deg] pointer-events-none">
                    <div className="border-4 border-emerald-400 text-emerald-400 font-black text-2xl px-6 py-2 rounded-2xl tracking-widest uppercase bg-slate-950/80 backdrop-blur-md shadow-2xl">
                      {selectedStamp}
                    </div>
                  </div>
                )}
              </div>
            ) : isPdf ? (
              <div className="w-[82vw] md:w-[70vw] lg:w-[60vw] h-[80vh] bg-white rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative">
                <iframe
                  src={`${currentUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                  title={currentFileName}
                  className="w-full h-full border-none"
                />
              </div>
            ) : isExcel ? (
              <div className="p-10 bg-slate-900 border border-slate-700 rounded-3xl text-center max-w-md shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30 shadow-lg">
                  <FileSpreadsheet size={36} />
                </div>
                <h4 className="text-base font-bold text-white truncate">{currentFileName}</h4>
                <p className="text-xs text-slate-400 mt-2 mb-6">
                  Excel Spreadsheet Attachment &bull; Download to inspect detailed budget sheets and formulas.
                </p>
                <button
                  type="button"
                  onClick={downloadCurrentAttachment}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <Download size={15} />
                  <span>Download Spreadsheet</span>
                </button>
              </div>
            ) : (
              <div className="p-10 bg-slate-900 border border-slate-700 rounded-3xl text-center max-w-md shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-500/30 shadow-lg">
                  <FileText size={36} />
                </div>
                <h4 className="text-base font-bold text-white truncate">{currentFileName}</h4>
                <p className="text-xs text-slate-400 mt-2 mb-6">
                  Document Attachment &bull; Download or inspect using system office suite.
                </p>
                <button
                  type="button"
                  onClick={downloadCurrentAttachment}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <Download size={15} />
                  <span>Download Document</span>
                </button>
              </div>
            )}
          </div>

          {/* Carousel Slide Left / Right Arrows */}
          {attachments.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                disabled={currentIndex === 0}
                className="absolute left-6 top-1/2 -translate-y-1/2 p-3.5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full backdrop-blur-md border border-white/20 transition-all shadow-2xl disabled:opacity-30 disabled:pointer-events-none hover:scale-110 active:scale-95 z-30 cursor-pointer"
                title="Previous Attachment (Left Arrow)"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, attachments.length - 1))}
                disabled={currentIndex === attachments.length - 1}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-3.5 bg-slate-900/80 hover:bg-indigo-600 text-white rounded-full backdrop-blur-md border border-white/20 transition-all shadow-2xl disabled:opacity-30 disabled:pointer-events-none hover:scale-110 active:scale-95 z-30 cursor-pointer"
                title="Next Attachment (Right Arrow)"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </main>

        {/* SIDE REQUISITION DETAILS PANEL (Just like Requisition Details) */}
        <AnimatePresence>
          {showSideDetails && (
            <motion.aside
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 240 }}
              className="w-80 sm:w-96 bg-slate-900/95 backdrop-blur-2xl border-l border-white/10 flex flex-col h-full z-40 shrink-0 shadow-2xl overflow-y-auto"
            >
              {/* Side Panel Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2 bg-slate-950/60 sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                    <Layers size={14} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                    Requisition Details
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSideDetails(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close Side Panel"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Side Panel Body */}
              <div className="p-4 space-y-5 text-xs text-slate-300">
                {/* Requisition ID & Status Badges */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {reqId ? (
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold">
                        #{reqId}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-bold">
                        Standalone Upload
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider">
                      {displayStatus}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white leading-snug">
                    {displayTitle}
                  </h4>
                </div>

                {/* Ministry & Financial Info */}
                <div className="bg-slate-950/60 rounded-2xl p-3.5 border border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Ministry / Group</span>
                    <span className="font-bold text-slate-200">{displayGroupName}</span>
                  </div>
                  {displayAmount !== undefined && (
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Requisition Amount</span>
                      <span className="font-mono font-black text-amber-300 text-sm">
                        {formatCurrency(displayAmount)}
                      </span>
                    </div>
                  )}
                  {displayAmountWords && (
                    <p className="text-[10px] text-slate-400 italic pt-1 border-t border-white/5">
                      "{displayAmountWords}"
                    </p>
                  )}
                </div>

                {/* Requester & Payee Details */}
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Requester:</span>
                    <strong className="text-white">{displayRequester}</strong>
                  </div>
                  {activeRequisition?.payableTo && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Payable To:</span>
                      <strong className="text-white">{activeRequisition.payableTo}</strong>
                    </div>
                  )}
                  {activeRequisition?.createdAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Date Created:</span>
                      <span className="text-slate-300">{formatDate(activeRequisition.createdAt)}</span>
                    </div>
                  )}
                  {(activeRequisition?.description || (activeRequisition as any)?.purpose) && (
                    <div className="pt-2 border-t border-white/5">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Expenditure Purpose</span>
                      <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                        {activeRequisition.description || (activeRequisition as any).purpose}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attachments (Documents) Section in Side Panel */}
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <FileText size={13} className="text-indigo-400" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                        Attachment Documents ({requisitionAttachments.length || attachments.length})
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {(requisitionAttachments.length > 0 ? requisitionAttachments : attachments).map((att, idx) => {
                      const url = normalizeAttachmentUrl(att);
                      const name = getAttachmentFileName(att) || `Document_${idx + 1}`;
                      const isCurrent = normalizeAttachmentUrl(currentAttachment) === url;

                      return (
                        <div
                          key={`side-doc-${idx}`}
                          onClick={() => handleSelectRequisitionAttachment(url)}
                          className={cn(
                            "p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 group",
                            isCurrent
                              ? "bg-indigo-600/30 border-indigo-400 text-white shadow-md"
                              : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs",
                              isCurrent ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400 group-hover:text-white"
                            )}>
                              {idx + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold truncate max-w-[160px] text-slate-200">
                                {name}
                              </p>
                              {isCurrent && (
                                <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase block">
                                  Currently Viewing
                                </span>
                              )}
                            </div>
                          </div>
                          <Eye size={13} className={cn("shrink-0", isCurrent ? "text-emerald-400" : "opacity-0 group-hover:opacity-100")} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Action Button: Open Actual Requisition Detail */}
                {activeRequisition && (
                  <div className="pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleOpenRequisitionDetails}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-950 cursor-pointer"
                    >
                      <ExternalLink size={14} />
                      <span>Open Full Requisition Details</span>
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1.5">
                      View full approval ledger, vouchers, and thread discussion
                    </p>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM THUMBNAILS CAROUSEL & KEYBOARD HINTS */}
      {showThumbnailsStrip && attachments.length > 1 && (
        <footer className="px-6 py-2.5 bg-slate-950/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-between gap-4 z-40 shrink-0 overflow-x-auto">
          {/* Thumbnails strip */}
          <div className="flex items-center gap-2.5 overflow-x-auto py-1">
            {attachments.map((att, idx) => {
              const url = normalizeAttachmentUrl(att);
              const name = getAttachmentFileName(att) || `Doc ${idx + 1}`;
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={`thumb-${idx}`}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "relative w-14 h-11 rounded-xl overflow-hidden border-2 transition-all shrink-0 group flex items-center justify-center bg-slate-900 cursor-pointer",
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
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-bold">D</kbd> Details
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
