/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  X,
  Trash2, 
  Pencil,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Paperclip,
  Printer,
  Download,
  ArrowUpDown,
  History,
  ShieldCheck,
  CalendarDays,
  MoreVertical,
  Loader2,
  Repeat,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Users,
  Flag,
  TrendingUp,
  Check,
  User,
  FileSignature,
  Fingerprint,
  KeyRound,
  Coins,
  ArrowRight,
  Activity,
  Camera,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  Copy,
  Share2,
  Store,
  ExternalLink,
  Maximize2,
  Minimize2,
  Lock,
  ArrowLeft
} from "lucide-react";
import { Info, HardDrive, Mail, UserPlus, MessageSquare, Send } from "lucide-react";
import { useRequisitions, getActiveFiscalYear, safeNormalizeAttachments } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, formatDate, cn, getDaysSinceSubmission, formatRequisitionAge, isFinalStage, normalizeAttachmentUrl, getAttachmentFileName, getAbsoluteAttachmentUrl, handleImageError } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { PdfThumbnailPreview, preloadPdfThumbnail } from "./PdfThumbnailPreview";

// Robust, zero-crash AttachmentViewer replacing external DocViewer
const AttachmentViewer = ({ uri, fileName }: { uri: string; fileName: string }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string>("");
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);

  const cleanUri = getAbsoluteAttachmentUrl(uri) || uri?.trim() || "";
  const lowerName = (fileName || cleanUri).toLowerCase();

  // Check if data URI payload is HTML
  const isDataUri = cleanUri.startsWith("data:");
  const isHtmlPayload = isDataUri && (
    cleanUri.includes("PCFkb2N0") || // <!doctype
    cleanUri.includes("PGh0bW") ||   // <html
    cleanUri.includes("PEhUTU") ||   // <HTML
    cleanUri.includes("PCFET0")      // <!DO
  );

  const isImage = !isHtmlPayload && (
    cleanUri.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(lowerName) ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(cleanUri.toLowerCase())
  );

  const isHtml = isHtmlPayload ||
    cleanUri.startsWith("data:text/html") ||
    /\.(html|htm)(\?.*)?$/i.test(lowerName) ||
    /\.(html|htm)(\?.*)?$/i.test(cleanUri.toLowerCase());

  const isPdf = !isHtml && (
    cleanUri.startsWith("data:application/pdf") ||
    (isDataUri && cleanUri.includes("JVBERi0")) || // %PDF-
    /\.pdf(\?.*)?$/i.test(lowerName) ||
    /\.pdf(\?.*)?$/i.test(cleanUri.toLowerCase())
  );

  const isXlsx = !isHtml && !isPdf && !isImage && (
    cleanUri.startsWith("data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
    cleanUri.startsWith("data:application/vnd.ms-excel") ||
    cleanUri.startsWith("data:text/csv") ||
    cleanUri.startsWith("data:application/csv") ||
    /\.(xlsx|xls|csv)(\?.*)?$/i.test(lowerName) ||
    /\.(xlsx|xls|csv)(\?.*)?$/i.test(cleanUri.toLowerCase())
  );

  const isText = !isHtml && !isPdf && !isImage && !isXlsx && (
    cleanUri.startsWith("data:text/") ||
    /\.(txt|json|log|md|xml)(\?.*)?$/i.test(lowerName) ||
    /\.(txt|json|log|md|xml)(\?.*)?$/i.test(cleanUri.toLowerCase())
  );

  const isAudioVideo = !isHtml && !isPdf && !isImage && !isText && (
    cleanUri.startsWith("data:audio/") || cleanUri.startsWith("data:video/") ||
    /\.(mp3|wav|ogg|mp4|webm|mov)(\?.*)?$/i.test(lowerName)
  );

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setHasError(false);
    setTextContent(null);
    setHtmlContent(null);
    setPdfDataUri("");

    if (isHtml && isDataUri) {
      try {
        const parts = cleanUri.split(",");
        if (parts[1]) {
          const decoded = window.atob(parts[1]);
          setHtmlContent(decoded);
        }
      } catch (e) {
        // Fall back to cleanUri iframe
      }
    }

    if (isPdf && cleanUri) {
      if (cleanUri.startsWith("data:")) {
        if (cleanUri.includes("JVBERi0") || cleanUri.startsWith("data:application/pdf")) {
          setPdfDataUri(cleanUri);
        } else {
          setHasError(true);
        }
      } else {
        setIsLoadingPdf(true);
        fetch(cleanUri)
          .then((res) => {
            if (!res.ok) throw new Error("HTTP error " + res.status);
            const contentType = (res.headers.get("content-type") || "").toLowerCase();
            if (contentType.includes("text/html")) {
              throw new Error("Server returned HTML page instead of PDF file");
            }
            return res.blob();
          })
          .then(async (blob) => {
            const textSample = await blob.slice(0, 100).text();
            if (textSample.includes("<!DOCTYPE") || textSample.includes("<html")) {
              throw new Error("Blob content is HTML, not PDF");
            }
            const reader = new FileReader();
            reader.onload = () => {
              let resStr = reader.result as string;
              if (resStr && (resStr.includes("JVBERi0") || resStr.startsWith("data:application/pdf"))) {
                if (!resStr.startsWith("data:application/pdf")) {
                  resStr = resStr.replace(/^data:[^;]+;/, "data:application/pdf;");
                }
                setPdfDataUri(resStr);
              } else {
                setHasError(true);
              }
              setIsLoadingPdf(false);
            };
            reader.onerror = () => {
              setHasError(true);
              setIsLoadingPdf(false);
            };
            reader.readAsDataURL(blob);
          })
          .catch((err) => {
            console.warn("PDF fetch/load error:", err);
            setHasError(true);
            setIsLoadingPdf(false);
          });
      }
    }
  }, [uri, isPdf, isHtml, isDataUri, cleanUri]);

  useEffect(() => {
    if (isText && cleanUri && !cleanUri.startsWith("data:")) {
      setIsLoadingText(true);
      fetch(cleanUri)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load file text");
          return res.text();
        })
        .then((text) => setTextContent(text))
        .catch(() => setHasError(true))
        .finally(() => setIsLoadingText(false));
    } else if (isText && cleanUri.startsWith("data:")) {
      try {
        const parts = cleanUri.split(",");
        if (parts[1]) {
          const decoded = window.atob(parts[1]);
          setTextContent(decoded);
        }
      } catch (e) {
        setHasError(true);
      }
    }
  }, [isText, cleanUri]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[350px] bg-slate-900/80 rounded-2xl border border-slate-800">
        <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mb-4 border border-rose-500/20">
          <AlertTriangle size={32} />
        </div>
        <h4 className="text-base font-bold text-slate-100 mb-1">Preview Unavailable</h4>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          The file format could not be rendered directly in preview. You can open it in a new window or download it to view.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={cleanUri}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950"
          >
            <Download size={14} /> Download File
          </a>
        </div>
      </div>
    );
  }

  if (isHtml) {
    return (
      <div className="flex flex-col h-full w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative min-h-[500px]">
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
          <a
            href={cleanUri}
            download={fileName.endsWith(".html") ? fileName : `${fileName}.html`}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Download size={13} /> Download HTML
          </a>
        </div>
        <iframe
          srcDoc={htmlContent || undefined}
          src={!htmlContent ? cleanUri : undefined}
          title={fileName}
          className="w-full h-full min-h-[500px] border-none bg-white rounded-xl"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="flex flex-col h-full w-full relative overflow-hidden bg-slate-950 rounded-2xl border border-slate-800">
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[11px] font-mono font-bold text-slate-300 px-1 min-w-[42px] text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-4 bg-slate-800 my-auto mx-0.5" />
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Rotate Clockwise"
          >
            <Repeat size={16} />
          </button>
          <button
            onClick={() => { setZoom(1); setRotation(0); }}
            className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer font-mono"
            title="Reset View"
          >
            1:1
          </button>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-6 min-h-[400px]">
          <img
            src={cleanUri}
            alt={fileName}
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: "transform 0.2s ease-out",
              maxHeight: zoom === 1 ? "80vh" : "none",
              maxWidth: zoom === 1 ? "100%" : "none",
              objectFit: "contain",
            }}
            className="rounded-lg shadow-2xl select-none"
          />
        </div>
      </div>
    );
  }

  if (isPdf) {
    const activeUri = pdfDataUri || cleanUri;
    return (
      <div className="flex flex-col h-full w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative min-h-[500px]">
        {isLoadingPdf && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm gap-2 text-slate-300">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading PDF...</span>
          </div>
        )}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
          <a
            href={activeUri}
            download={fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Download size={13} /> Download
          </a>
        </div>
        <iframe
          src={`${activeUri}#toolbar=1`}
          title={fileName}
          className="w-full h-full min-h-[500px] border-none bg-slate-900"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  if (isText) {
    return (
      <div className="flex flex-col h-full w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden p-4">
        {isLoadingText ? (
          <div className="flex items-center justify-center h-full min-h-[300px] text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin text-indigo-400" />
            <span className="text-xs">Loading document text...</span>
          </div>
        ) : (
          <pre className="w-full h-full min-h-[400px] overflow-auto p-4 bg-slate-900 rounded-xl font-mono text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed border border-slate-800/80">
            {textContent || "No text content available."}
          </pre>
        )}
      </div>
    );
  }

  if (isXlsx) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[400px] bg-slate-900/90 rounded-2xl border border-slate-800">
        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mb-5 border border-emerald-500/20 shadow-xl">
          <FileSpreadsheet size={40} />
        </div>
        <h4 className="text-lg font-extrabold text-slate-100 mb-1 max-w-md truncate">{fileName}</h4>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          Excel Spreadsheet Document ({fileName.split('.').pop()?.toUpperCase() || "XLSX"}). Click below to download or view in Excel.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={cleanUri}
            download={fileName}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50"
          >
            <Download size={15} /> Download Excel Spreadsheet
          </a>
        </div>
      </div>
    );
  }

  if (isAudioVideo) {
    const isVid = cleanUri.startsWith("data:video/") || /\.(mp4|webm|mov)(\?.*)?$/i.test(lowerName);
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] w-full bg-slate-950 rounded-2xl border border-slate-800 p-6">
        {isVid ? (
          <video src={cleanUri} controls className="max-h-[70vh] max-w-full rounded-xl border border-slate-800 shadow-2xl" />
        ) : (
          <div className="w-full max-w-md p-6 bg-slate-900 rounded-2xl border border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20">
              <Activity size={32} />
            </div>
            <p className="text-sm font-bold text-slate-200 truncate">{fileName}</p>
            <audio src={cleanUri} controls className="w-full mt-2" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[400px] bg-slate-900/90 rounded-2xl border border-slate-800">
      <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-3xl flex items-center justify-center mb-5 border border-indigo-500/20 shadow-xl">
        <FileText size={40} />
      </div>
      <h4 className="text-lg font-extrabold text-slate-100 mb-1 max-w-md truncate">{fileName}</h4>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        This document type can be viewed by downloading or opening directly in a new tab.
      </p>
      <div className="flex items-center gap-3">
        <a
          href={cleanUri}
          download={fileName}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
        >
          <Download size={15} /> Download Document
        </a>
      </div>
    </div>
  );
};
import { printRequisitions, downloadRequisitionsHtml, downloadRequisitionsCsv, downloadRequisitionsPdf, printRequisitionVoucher, printRequisitionReceipt } from "../utils/exportUtils";
import { NewRequisitionForm } from "./NewRequisitionForm";
import { ReceiptTemplateGenerator } from "./ReceiptTemplateGenerator";
import { EditRequisitionModal } from "./EditRequisitionModal";
import { ReceiptGallery } from "./ReceiptGallery";
import { CameraCapture } from "./CameraCapture";
import { ConfirmationModal } from "./ConfirmationModal";
import { CachedImage } from "./CachedImage";
import { getCachedMediaUrl, preloadMediaBatch } from "../lib/mediaCache";



const DocumentPreviewModal = ({ 
  attachments: rawAttachments = [], 
  initialIndex = 0, 
  onClose,
  requisition
}: { 
  attachments: string[]; 
  initialIndex: number; 
  onClose: () => void;
  requisition?: any;
}) => {
  const attachments = Array.isArray(rawAttachments) 
    ? rawAttachments 
    : (typeof rawAttachments === "string" && rawAttachments ? [rawAttachments] : []);

  const [activeDocIndex, setActiveDocIndex] = useState(initialIndex);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Prepare document objects for react-doc-viewer
  const docs = useMemo(() => {
    return attachments.map((att: any, idx: number) => {
      const absUrl = getAbsoluteAttachmentUrl(att);
      const name = getAttachmentFileName(att) || `Attachment-${idx + 1}`;
      return {
        uri: absUrl,
        fileName: name,
      };
    });
  }, [attachments]);

  if (!attachments || attachments.length === 0) return null;

  const currentDoc = docs[activeDocIndex] || docs[0];

  // Requester information
  const requesterName = requisition?.requesterName || "System User / Requester";
  const requesterEmail = requisition?.requesterEmail || "";
  const groupName = requisition?.groupName || "Ministry Group";
  const submittedAt = requisition?.submittedAt ? formatDate(requisition.submittedAt) : (requisition?.createdAt ? formatDate(requisition.createdAt) : null);
  const amountStr = requisition?.amount !== undefined ? formatCurrency(requisition.amount) : null;
  const title = requisition?.title || "Requisition Attachment";
  const reqId = requisition?.id || "";

  // Approvers information
  const approvalHistory: any[] = requisition?.approvalHistory || [];
  
  // Find L1, L2, and Disbursing approver notes if available
  const l1Note = approvalHistory.find((h: any) => 
    h.role === UserRole.APPROVER_L1 || h.role === UserRole.CHURCH_GROUP || h.role === "GROUP_LEADER" || h.role === "APPROVER_L1"
  );
  const l2Note = approvalHistory.find((h: any) => 
    h.role === UserRole.APPROVER_L2 || h.role === UserRole.FINANCE || h.role === "TREASURER" || h.role === "FINANCE" || h.role === "APPROVER_L2"
  );
  const disburseNote = approvalHistory.find((h: any) => h.decision === "DISBURSED" || h.note?.toLowerCase().includes("disbursed"));

  const isL1Approved = Boolean(requisition?.approvedAtL1 || l1Note?.decision === "APPROVE");
  const isL2Approved = Boolean(requisition?.approvedAtL2 || l2Note?.decision === "APPROVE");
  const isDisbursed = Boolean(requisition?.disbursedAt || disburseNote);

  // Unique list of all members involved/updated in this requisition
  const membersInvolved = useMemo(() => {
    const map = new Map<string, { name: string; role?: string; email?: string; action?: string; timestamp?: string }>();
    
    if (requesterName) {
      map.set("requester", {
        name: requesterName,
        email: requesterEmail,
        role: "Requester",
        action: "Created & Submitted Requisition",
        timestamp: submittedAt || undefined,
      });
    }

    approvalHistory.forEach((note: any) => {
      const key = note.approverId || note.approverName;
      if (key) {
        map.set(key, {
          name: note.approverName || "Approver",
          role: note.role || "Approver",
          action: note.decision === "APPROVE" ? "Approved Request" : note.decision === "REJECT" ? "Rejected Request" : note.decision === "ESCALATE" ? "Escalated Request" : "Reviewed & Updated Note",
          timestamp: note.timestamp ? formatDate(note.timestamp) : undefined,
        });
      }
    });

    return Array.from(map.values());
  }, [requesterName, requesterEmail, submittedAt, approvalHistory]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-3 bg-slate-950/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className={cn(
          "bg-slate-900 w-full h-full shadow-2xl overflow-hidden border border-slate-800 flex flex-col relative text-slate-100 transition-all duration-300",
          isFullscreen 
            ? "fixed inset-0 z-[200] rounded-none max-w-none max-h-none p-0" 
            : "max-w-[98vw] max-h-[96vh] md:rounded-3xl"
        )}
      >
        {/* Header bar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 select-none shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] bg-indigo-950 text-indigo-300 font-bold px-2 py-0.5 rounded-full font-mono uppercase border border-indigo-800/40">
                  {reqId ? `#${reqId}` : "REQUISITION ATTACHMENT"}
                </span>
                <span className="text-[9px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full font-mono uppercase">
                  FILE {activeDocIndex + 1} OF {attachments.length}
                </span>
              </div>
              <h3 className="text-xs md:text-sm font-bold text-slate-100 truncate mt-0.5">
                {currentDoc?.fileName || title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Info / Members Details Drawer */}
            <button
              onClick={() => setShowDetailsPanel(!showDetailsPanel)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                showDetailsPanel 
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-950" 
                  : "bg-slate-850 border-slate-750 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
              title="Toggle Requester & Approvers Details Panel"
            >
              <Users size={15} />
              <span className="hidden sm:inline">Details & Members</span>
              {membersInvolved.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-slate-900 font-mono">
                  {membersInvolved.length}
                </span>
              )}
            </button>



            {/* Download */}
            {currentDoc?.uri && (
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = currentDoc.uri;
                  link.download = currentDoc.fileName;
                  link.click();
                }}
                className="p-2 bg-slate-850 border border-slate-750 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Download Document"
              >
                <Download size={16} />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-slate-850 border border-slate-750 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer hidden md:flex"
              title={isFullscreen ? "Exit Fullscreen" : "Maximize Modal"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 bg-slate-850 border border-slate-750 hover:bg-rose-950/40 hover:border-rose-800 hover:text-rose-400 rounded-xl text-slate-300 transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Main Area */}
        <div className="flex-1 flex overflow-hidden relative bg-slate-950">
          {/* Main Document Area using react-doc-viewer */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative p-2 md:p-4">
            {/* File Selector Tabs if multiple attachments */}
            {docs.length > 1 && (
              <div className="mb-2 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {docs.map((d, idx) => (
                  <button
                    key={`doc-tab-${idx}`}
                    onClick={() => setActiveDocIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all flex items-center gap-1.5 border ${
                      idx === activeDocIndex
                        ? "bg-indigo-600 border-indigo-500 text-white font-bold shadow-md"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200"
                    }`}
                  >
                    <FileText size={13} />
                    <span className="truncate max-w-[160px]">{d.fileName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Attachment preview container */}
            <div className="flex-1 w-full h-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/90 relative flex flex-col">
              <AttachmentViewer
                uri={currentDoc?.uri || ""}
                fileName={currentDoc?.fileName || "Attachment"}
              />
            </div>
          </div>

          {/* Right Sidebar Details Panel: Requester, Approvers, Updated Members */}
          <AnimatePresence>
            {showDetailsPanel && (
              <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-full md:w-80 lg:w-96 bg-slate-900/95 border-l border-slate-800 flex flex-col h-full overflow-y-auto shrink-0 z-10 shadow-2xl"
              >
                {/* Sidebar Title */}
                <div className="p-4 border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-indigo-400" />
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                      Requisition Members & Approvals
                    </h4>
                  </div>
                  <button
                    onClick={() => setShowDetailsPanel(false)}
                    className="text-slate-500 hover:text-slate-300 p-1 md:hidden cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-4 space-y-6">
                  {/* Requisition Meta Summary Card */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 block font-bold">
                          Title
                        </span>
                        <p className="text-xs font-bold text-slate-200 mt-0.5">{title}</p>
                      </div>
                      {amountStr && (
                        <div className="text-right">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-500 block font-bold">
                            Amount
                          </span>
                          <p className="text-xs font-black text-emerald-400 font-mono mt-0.5">{amountStr}</p>
                        </div>
                      )}
                    </div>
                    {requisition?.description && (
                      <p className="text-[11px] text-slate-400 border-t border-slate-850 pt-2 leading-relaxed">
                        {requisition.description}
                      </p>
                    )}
                  </div>

                  {/* Requester Details Card */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono block">
                      1. Requester Info
                    </span>
                    <div className="bg-slate-950/80 border border-indigo-950/60 rounded-2xl p-3.5 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 font-bold">
                        <User size={18} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-bold text-slate-100 truncate">{requesterName}</p>
                        {requesterEmail && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">{requesterEmail}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1 flex-wrap text-[10px]">
                          <span className="px-2 py-0.5 bg-slate-850 text-indigo-300 rounded-md font-medium border border-slate-800">
                            {groupName}
                          </span>
                          {submittedAt && (
                            <span className="text-slate-500 font-mono">
                              Submitted: {submittedAt}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Approvers Clearance Cards */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono block">
                      2. Approvers Clearance Level
                    </span>
                    <div className="space-y-2.5">
                      {/* Level 1 Approver */}
                      <div className={`border rounded-2xl p-3.5 space-y-2 transition-all ${
                        isL1Approved ? "bg-emerald-950/20 border-emerald-800/40" : "bg-slate-950/60 border-slate-800"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1">
                            <ShieldCheck size={13} className={isL1Approved ? "text-emerald-400" : "text-slate-500"} />
                            Level 1 (Group Leader)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black font-mono uppercase ${
                            isL1Approved ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {isL1Approved ? "Verified & Endorsed" : "Pending L1"}
                          </span>
                        </div>
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-slate-200">
                            {l1Note?.approverName || (requisition?.approvedAtL1 ? "Level 1 Official" : "Presbytery Official")}
                          </p>
                          {requisition?.approvedAtL1 && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Approved: {formatDate(requisition.approvedAtL1)}
                            </p>
                          )}
                          {l1Note?.note && (
                            <p className="text-[11px] text-slate-400 italic bg-slate-900/80 p-2 rounded-lg mt-1 border border-slate-800/60">
                              "{l1Note.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Level 2 Approver */}
                      <div className={`border rounded-2xl p-3.5 space-y-2 transition-all ${
                        isL2Approved ? "bg-emerald-950/20 border-emerald-800/40" : "bg-slate-950/60 border-slate-800"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1">
                            <ShieldCheck size={13} className={isL2Approved ? "text-emerald-400" : "text-slate-500"} />
                            Level 2 (Finance / Treasurer)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black font-mono uppercase ${
                            isL2Approved ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}>
                            {isL2Approved ? "Authorized for Payout" : "Pending L2"}
                          </span>
                        </div>
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-slate-200">
                            {l2Note?.approverName || (requisition?.approvedAtL2 ? "Finance Treasurer" : "Finance Officer")}
                          </p>
                          {requisition?.approvedAtL2 && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Authorized: {formatDate(requisition.approvedAtL2)}
                            </p>
                          )}
                          {l2Note?.note && (
                            <p className="text-[11px] text-slate-400 italic bg-slate-900/80 p-2 rounded-lg mt-1 border border-slate-800/60">
                              "{l2Note.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Disbursing Status */}
                      {isDisbursed && (
                        <div className="border bg-sky-950/20 border-sky-800/40 rounded-2xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-sky-400 uppercase font-mono flex items-center gap-1">
                              <Coins size={13} />
                              Payout Settlement
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-black font-mono uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                              Disbursed
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-200">
                            {disburseNote?.approverName || "PCE St. Andrews Treasury"}
                          </p>
                          {requisition?.disbursedAt && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Settlement Date: {formatDate(requisition.disbursedAt)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Updated Members & Audit History */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono block">
                      3. Involved Members & History Log ({membersInvolved.length})
                    </span>
                    <div className="space-y-2">
                      {membersInvolved.map((m, idx) => (
                        <div key={`member-${idx}`} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0 mt-0.5">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-slate-200 truncate">{m.name}</p>
                              <span className="text-[8px] font-mono px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded uppercase font-bold shrink-0">
                                {m.role}
                              </span>
                            </div>
                            <p className="text-[10px] text-indigo-400 font-medium mt-0.5">{m.action}</p>
                            {m.timestamp && (
                              <p className="text-[9px] text-slate-500 font-mono mt-0.5">{m.timestamp}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() 
          ? <mark key={i} className="bg-amber-200 text-amber-900 rounded-px px-px font-bold underline decoration-amber-500/30 decoration-2">{part}</mark> 
          : part
      )}
    </>
  );
};

export const RequisitionsPanel: React.FC = () => {
  const { 
    requisitions, 
    projects,
    deleteRequisition, 
    currentUser, 
    globalSearchTerm, 
    setGlobalSearchTerm,
    searchFilter,
    canPerform,
    loading,
    systemSettings,
    advancedSearchActive,
    advancedDateRangePreset,
    advancedCustomStartDate,
    advancedCustomEndDate,
    advancedBudgetLine,
    triggerToast
  } = useRequisitions();

  const handleCopyShareLinkForReq = async (req: Requisition) => {
    const rawUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${rawUrl}?reqId=${req.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Direct shareable link for Requisition "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy share link: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy shareable link to clipboard.",
        timestamp: new Date().toISOString()
      });
    }
  };

  // Budget logic
  const activeYear = getActiveFiscalYear();
  const projectSummaries = projects.filter(p => p.fiscalYear === activeYear || (!p.fiscalYear && activeYear === activeYear)).map(proj => {
    const reqs = requisitions.filter(r => 
      r.groupName === proj.groupId && 
      (r.fiscalYear === activeYear || (!r.fiscalYear && activeYear === activeYear))
    );
    const usedAmount = reqs
      .filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED].includes(r.status))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const spentAmount = reqs
      .filter(r => r.status === RequisitionStatus.DISBURSED)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return {
      ...proj,
      usedAmount,
      spentAmount,
      percentage: proj.allocatedBudget > 0 ? (usedAmount / proj.allocatedBudget) * 100 : 0
    };
  }).sort((a,b) => b.percentage - a.percentage);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { selectedRequisition: viewingReq, setSelectedRequisition: setViewingReq } = useRequisitions();
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<Requisition | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPreset, setFilterPreset] = useState<"ALL" | "URGENT" | "FLAGGED" | "OVERDUE" | "L1_APPROVED">("ALL");
  const [dateRangePreset, setDateRangePreset] = useState<"ALL" | "WEEK" | "MONTH" | "CUSTOM">("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
  const [editingReq, setEditingReq] = useState<Requisition | null>(null);
  const [requisitionToDelete, setRequisitionToDelete] = useState<Requisition | null>(null);
  const [isDeletingReq, setIsDeletingReq] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [now, setNow] = useState(Date.now());
  
  // Trending Searches Logic
  const [trendingSearches, setTrendingSearches] = useState<{term: string, count: number}[]>([]);
  const [showTrending, setShowTrending] = useState(false);

  useEffect(() => {
    // Load trending from localStorage on mount
    const saved = localStorage.getItem('trending_requisition_searches');
    if (saved) {
      try {
        setTrendingSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse trending searches", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!globalSearchTerm || globalSearchTerm.length < 3) return;

    const timer = setTimeout(() => {
      setTrendingSearches(prev => {
        const term = globalSearchTerm.trim().toLowerCase();
        const existing = prev.find(t => t.term === term);
        let updated;
        if (existing) {
          updated = prev.map(t => t.term === term ? { ...t, count: t.count + 1 } : t);
        } else {
          updated = [...prev, { term, count: 1 }];
        }
        
        const sorted = updated.sort((a, b) => b.count - a.count).slice(0, 5);
        localStorage.setItem('trending_requisition_searches', JSON.stringify(sorted));
        return sorted;
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [globalSearchTerm]);

  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [disbursedPage, setDisbursedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const ITEMS_PER_PAGE = 15;

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const projectMap = useMemo(() => {
    const map = new Map<string, typeof projects[0]>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  const filtered = requisitions.filter(req => {
    const term = globalSearchTerm.toLowerCase();
    
    let matchesSearch = false;
    if (!term) {
      matchesSearch = true;
    } else {
      const inTitle = req.title.toLowerCase().includes(term);
      const inGroup = req.groupName.toLowerCase().includes(term);
      const inRequester = req.requesterName?.toLowerCase().includes(term);
      const inId = req.id.toLowerCase().includes(term);

      if (searchFilter === "ALL") {
        matchesSearch = inTitle || inGroup || inRequester || inId;
      } else if (searchFilter === "TITLE") {
        matchesSearch = inTitle;
      } else if (searchFilter === "GROUP") {
        matchesSearch = inGroup;
      } else if (searchFilter === "REQUESTER") {
        matchesSearch = inRequester;
      }
    }

    const matchesStatus = filterStatus === "ALL" || req.status === filterStatus;
    
    const matchesDateRange = () => {
      const activePreset = advancedSearchActive ? advancedDateRangePreset : dateRangePreset;
      const activeStart = advancedSearchActive ? advancedCustomStartDate : customStartDate;
      const activeEnd = advancedSearchActive ? advancedCustomEndDate : customEndDate;

      if (activePreset === "ALL") return true;
      const submittedTime = req.submittedAt ? new Date(req.submittedAt).getTime() : (req.updatedAt ? new Date(req.updatedAt).getTime() : 0);
      const nowTime = Date.now();
      
      if (activePreset === "WEEK") {
        const oneWeekAgo = nowTime - 7 * 24 * 60 * 60 * 1000;
        return submittedTime >= oneWeekAgo;
      }
      if (activePreset === "MONTH") {
        const oneMonthAgo = nowTime - 30 * 24 * 60 * 60 * 1000;
        return submittedTime >= oneMonthAgo;
      }
      if (activePreset === "CUSTOM") {
        let matches = true;
        if (activeStart) {
          const start = new Date(activeStart + "T00:00:00").getTime();
          matches = matches && submittedTime >= start;
        }
        if (activeEnd) {
          const end = new Date(activeEnd + "T23:59:59").getTime();
          matches = matches && submittedTime <= end;
        }
        return matches;
      }
      return true;
    };

    const matchesPreset = () => {
      if (filterPreset === "ALL") return true;
      if (filterPreset === "FLAGGED") return req.flaggedForAudit === true;
      if (filterPreset === "L1_APPROVED") return req.status === RequisitionStatus.APPROVED_L1;
      if (filterPreset === "OVERDUE") {
        const days = Math.ceil(Math.abs(Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
        return days > 3 && (req.status === RequisitionStatus.SUBMITTED || req.status === RequisitionStatus.APPROVED_L1);
      }
      if (filterPreset === "URGENT") {
        const hoursRemaining = req.expiresAt ? (new Date(req.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60) : null;
        return (hoursRemaining !== null && hoursRemaining < 48 && hoursRemaining > 0) || req.amount > 20000;
      }
      return true;
    };

    const matchesBudgetLine = () => {
      if (!advancedSearchActive || advancedBudgetLine === "ALL" || !advancedBudgetLine.trim()) return true;
      const budgetLineLower = advancedBudgetLine.toLowerCase();
      const inGroupName = req.groupName.toLowerCase().includes(budgetLineLower);
      const inGroupId = req.groupId?.toLowerCase().includes(budgetLineLower);
      const project = req.projectId ? projectMap.get(req.projectId) : undefined;
      const inProjectName = project ? project.name.toLowerCase().includes(budgetLineLower) : false;
      const inProjectId = req.projectId?.toLowerCase().includes(budgetLineLower);
      return inGroupName || inGroupId || inProjectName || inProjectId;
    };

    const canSee = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN || req.groupId === currentUser?.group;
    
    return matchesSearch && matchesStatus && matchesDateRange() && matchesPreset() && matchesBudgetLine() && canSee;
  }).sort((a, b) => {
    // Priority: submittedAt, then updatedAt, then 0
    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
    return sortDirection === "desc" ? timeB - timeA : timeA - timeB;
  });

  // Split into active, disbursed, and rejected/cancelled
  const activeList = filtered.filter(r => r.status !== RequisitionStatus.DISBURSED && r.status !== RequisitionStatus.REJECTED && r.status !== RequisitionStatus.CANCELLED);
  const disbursedList = filtered.filter(r => r.status === RequisitionStatus.DISBURSED);
  const rejectedList = filtered.filter(r => r.status === RequisitionStatus.REJECTED || r.status === RequisitionStatus.CANCELLED);

  // Paginated slices
  const activeItems = activeList.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);
  const disbursedItems = disbursedList.slice((disbursedPage - 1) * ITEMS_PER_PAGE, disbursedPage * ITEMS_PER_PAGE);
  const rejectedItems = rejectedList.slice((rejectedPage - 1) * ITEMS_PER_PAGE, rejectedPage * ITEMS_PER_PAGE);

  const activeTotalPages = Math.max(1, Math.ceil(activeList.length / ITEMS_PER_PAGE));
  const disbursedTotalPages = Math.max(1, Math.ceil(disbursedList.length / ITEMS_PER_PAGE));
  const rejectedTotalPages = Math.max(1, Math.ceil(rejectedList.length / ITEMS_PER_PAGE));

  // Reset pages when filters change
  React.useEffect(() => {
    setActivePage(1);
    setDisbursedPage(1);
    setRejectedPage(1);
  }, [globalSearchTerm, filterStatus, dateRangePreset, customStartDate, customEndDate]);

  const Pagination = ({ current, total, onChange }: { current: number, total: number, onChange: (p: number) => void }) => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 sm:px-6">
      <div className="flex justify-between flex-1 sm:hidden">
        <button
          onClick={() => onChange(Math.max(1, current - 1))}
          disabled={current === 1}
          className="relative inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(Math.min(total, current + 1))}
          disabled={current === total}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className="text-slate-900">{Math.min(total === 0 ? 0 : (current - 1) * ITEMS_PER_PAGE + 1, activeList.length + disbursedList.length)}</span> to <span className="text-slate-900">{Math.min(current * ITEMS_PER_PAGE, total === 0 ? 0 : 99999)}</span> of <span className="text-slate-900">{total * ITEMS_PER_PAGE > 0 ? "..." : 0}</span> results
          </p>
        </div>
        <div>
          <nav className="inline-flex -space-x-px rounded-md shadow-sm isolate" aria-label="Pagination">
            <button
              onClick={() => onChange(Math.max(1, current - 1))}
              disabled={current === 1}
              className="relative inline-flex items-center px-2 py-2 text-slate-400 border border-slate-300 rounded-l-md hover:bg-slate-50 focus:z-20 disabled:opacity-30"
            >
              <span className="sr-only">Previous</span>
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            {[...Array(total)].map((_, i) => (
              <button
                key={i}
                onClick={() => onChange(i + 1)}
                className={cn(
                  "relative inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest border focus:z-20",
                  current === i + 1
                    ? "z-10 bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-300 text-slate-500 hover:bg-slate-50"
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => onChange(Math.min(total, current + 1))}
              disabled={current === total}
              className="relative inline-flex items-center px-2 py-2 text-slate-400 border border-slate-300 rounded-r-md hover:bg-slate-50 focus:z-20 disabled:opacity-30"
            >
              <span className="sr-only">Next</span>
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

  const getStatusColor = (status: RequisitionStatus) => {
    switch (status) {
      case RequisitionStatus.APPROVED_L2: return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case RequisitionStatus.DISBURSED: return "bg-blue-50 text-blue-600 border-blue-100";
      case RequisitionStatus.SUBMITTED: return "bg-amber-50 text-amber-600 border-amber-100";
      case RequisitionStatus.REJECTED: return "bg-rose-50 text-rose-600 border-rose-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkPrint = () => {
    const selectedReqs = requisitions.filter(r => selectedIds.has(r.id));
    printRequisitions(selectedReqs, "Consolidated Transaction Report", currentUser);
  };

  const handleBulkExportCsv = () => {
    const selectedReqs = requisitions.filter(r => selectedIds.has(r.id));
    downloadRequisitionsCsv(selectedReqs, "Bulk_Export_Transactions");
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || isBulkDeleting) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} requisition(s)?`)) {
      setIsBulkDeleting(true);
      try {
        const count = selectedIds.size;
        const ids = Array.from(selectedIds);
        for (const id of ids) {
          await deleteRequisition(id);
        }
        setSelectedIds(new Set());
        if (triggerToast) {
          triggerToast({
            type: "SYSTEM_INFO",
            severity: "LOW",
            message: `Successfully deleted ${count} requisition(s).`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err: any) {
        console.error("Bulk delete failed:", err);
        if (triggerToast) {
          triggerToast({
            type: "SECURITY_UPDATE",
            severity: "HIGH",
            message: err?.message || "Failed to delete selected requisitions.",
            timestamp: new Date().toISOString()
          });
        }
      } finally {
        setIsBulkDeleting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8 animate-pulse p-4 md:p-8">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-48 bg-slate-100 rounded-md"></div>
          </div>
          <div className="flex gap-2">
             <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
             <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
             <div className="h-10 w-32 bg-slate-200 rounded-xl"></div>
          </div>
        </div>

        {/* Filter bar skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 flex-1 bg-slate-200 rounded-xl border border-slate-100"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl hidden md:block"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl hidden md:block"></div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
           <div className="h-8 bg-slate-100/50 rounded-xl mb-6"></div>
           {[...Array(6)].map((_, i) => (
             <div key={i} className="h-16 bg-slate-100/50 rounded-2xl border border-slate-100/80"></div>
           ))}
        </div>
      </div>
    );
  }

  if (viewingReq) {
    return (
      <RequisitionDetailModal 
        req={viewingReq} 
        onClose={() => setViewingReq(null)} 
        onDelete={() => {
          setRequisitionToDelete(viewingReq);
          setViewingReq(null);
        }}
        onGenerateReceipt={() => {
          setIsGeneratingReceipt(viewingReq);
        }}
        onEdit={() => {
          setEditingReq(viewingReq);
          setViewingReq(null);
        }}
        isPage={true}
      />
    );
  }

  if (editingReq) {
    return (
      <EditRequisitionModal 
        req={editingReq} 
        onClose={() => setEditingReq(null)} 
        isPage={true}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in transition-all duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Requisitions</h2>
          <p className="text-sm text-slate-500">Master ledger for all ministry group funding requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex bg-white border border-slate-200 rounded-xl shadow-sm">
             <button 
              onClick={() => printRequisitions(filtered, "Requisition Ledger", currentUser)}
              className="p-2.5 hover:bg-slate-50 border-r border-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Print Ledger"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="p-2.5 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
              title="Download Data"
            >
              <Download size={16} />
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 text-left">
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
                    Export Filtered Table ({filtered.length} transactions)
                  </div>
                  <button
                    onClick={() => {
                      downloadRequisitionsPdf(filtered, "Requisitions List Ledger", currentUser);
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Download PDF Document
                  </button>
                  <button
                    onClick={() => {
                      downloadRequisitionsCsv(filtered, "Requisitions List Ledger");
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Download CSV Sheet
                  </button>
                  <button
                    onClick={() => {
                      downloadRequisitionsHtml(filtered, "Requisitions List Ledger", currentUser);
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Download Classic HTML
                  </button>
                </div>
              </>
            )}
          </div>
          
          {canPerform('canCreateRequisition') && (
            systemSettings?.fiscalYearStatus === "ARCHIVED" ? (
              <button 
                onClick={() => alert("This financial period is ARCHIVED. Creation of new requisitions is disabled.")}
                className="opacity-50 btn-primary flex items-center gap-2 cursor-not-allowed bg-slate-400 hover:bg-slate-400 border-none"
              >
                <Plus size={18} />
                ARCHIVED PERIOD
              </button>
            ) : (
              <button 
                onClick={() => setIsAdding(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                NEW REQUISITION
              </button>
            )
          )}
        </div>
      </div>

      {systemSettings?.fiscalYearStatus === "ARCHIVED" && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-400 animate-in slide-in-from-top duration-300">
          <div className="p-2 bg-amber-500/15 rounded-xl">
            <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-0.5 animate-in fade-in">
            <p className="text-xs font-black uppercase tracking-wider">ARCHIVED FINANCIAL PERIOD VIEW</p>
            <p className="text-[10px] opacity-90 leading-relaxed">
              This financial period ({systemSettings?.currentFiscalYear}) has been **ARCHIVED**. All historical transactions are preserved in a read-only ledger. Editing, deletions, and operational state changes are suspended.
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterPreset("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer",
              filterPreset === "ALL" 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            )}
          >
            Show All
          </button>
          <button
            onClick={() => setFilterPreset("URGENT")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "URGENT" 
                ? "bg-amber-500 text-white border-amber-500 shadow-sm" 
                : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50"
            )}
          >
            <AlertTriangle size={12} />
            Urgent
          </button>
          <button
            onClick={() => setFilterPreset("FLAGGED")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "FLAGGED" 
                ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                : "bg-white text-rose-600 border-rose-200 hover:bg-rose-50"
            )}
          >
            <Flag size={12} />
            Flagged
          </button>
          <button
            onClick={() => setFilterPreset("OVERDUE")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "OVERDUE" 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            )}
          >
            <History size={12} />
            Approvals Overdue
          </button>
          <button
            onClick={() => setFilterPreset("L1_APPROVED")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "L1_APPROVED" 
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            )}
          >
            <CheckCircle size={12} />
            L1 Approved
          </button>
        </div>

        <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search documents..." 
            className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
            onFocus={() => setShowTrending(true)}
            onBlur={() => setTimeout(() => setShowTrending(false), 200)}
          />
          
          {/* Trending Searches Dropdown */}
          <AnimatePresence>
            {showTrending && trendingSearches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
              >
                <div className="p-3 border-bottom border-slate-50 flex items-center gap-2">
                  <TrendingUp size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trending Searches</span>
                </div>
                <div className="flex flex-col p-1">
                  {trendingSearches.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setGlobalSearchTerm(item.term);
                        setShowTrending(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between group"
                    >
                      <span className="font-medium">"{item.term}"</span>
                      <span className="text-[9px] text-slate-400 group-hover:text-primary transition-colors bg-slate-50 px-1.5 py-0.5 rounded uppercase font-bold">
                        {item.count} searches
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[130px]">
            <Filter size={12} className="text-slate-400" />
            <select 
              className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">ALL STATUSES</option>
              {Object.values(RequisitionStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Date Range Preset Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[150px]">
            <CalendarDays size={12} className="text-slate-400" />
            <select 
              className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
            >
              <option value="ALL">ALL TIME</option>
              <option value="WEEK">LAST WEEK</option>
              <option value="MONTH">LAST MONTH</option>
              <option value="CUSTOM">CUSTOM RANGE</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {dateRangePreset === "CUSTOM" && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 animate-fadeIn">
              <input 
                type="date"
                title="Start Date"
                className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer border-none p-0 focus:ring-0 w-24"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span className="text-[9px] text-slate-400 font-black uppercase">to</span>
              <input 
                type="date"
                title="End Date"
                className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer border-none p-0 focus:ring-0 w-24"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Clear Custom Dates"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            Active Requisitions 
            <span className="text-[10px] text-slate-400 normal-case font-medium ml-2">({activeList.length} total)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                    checked={activeList.length > 0 && activeList.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allActiveInSelected = activeList.every(r => selectedIds.has(r.id));
                      const newSelected = new Set(selectedIds);
                      activeList.forEach(r => {
                        if (allActiveInSelected) newSelected.delete(r.id);
                        else newSelected.add(r.id);
                      });
                      setSelectedIds(newSelected);
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2">
                    ID & Title
                    <button 
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 group text-primary whitespace-nowrap cursor-pointer"
                      title={sortDirection === "desc" ? "Switch to Newest Last" : "Switch to Newest First"}
                    >
                      <ArrowUpDown size={12} className={cn("transition-transform", sortDirection === "asc" && "rotate-180")} />
                      <span className="text-[7px] text-slate-400 font-bold group-hover:text-primary">{sortDirection === "desc" ? "DESC" : "ASC"}</span>
                    </button>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Requisition Ownership</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Days Old</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {activeItems.map((req, i) => {
                  const updateAge = now - new Date(req.updatedAt).getTime();
                  const isRecentlyApprovedOrDisbursed = (req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) && updateAge < 8000;
                  const formattedAge = formatRequisitionAge(req.submittedAt || req.createdAt, req.status);
                  const compactAge = formatRequisitionAge(req.submittedAt || req.createdAt, req.status, { compact: true });

                  return (
                    <motion.tr 
                      key={req.id} 
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ 
                        opacity: 1,
                        y: 0,
                        backgroundColor: isRecentlyApprovedOrDisbursed ? "rgba(16, 185, 129, 0.08)" : undefined
                      }}
                      exit={{ opacity: 0, scale: 0.95, y: -15 }}
                      transition={{ 
                        opacity: { duration: 0.2 },
                        layout: { type: "spring", stiffness: 300, damping: 30 },
                        y: { type: "spring", stiffness: 300, damping: 30 }
                      }}
                      onClick={() => setViewingReq(req)}
                      className={cn(
                        "transition-colors group cursor-pointer border-l-2",
                        selectedIds.has(req.id) ? "bg-primary/5 border-l-primary" :
                        isRecentlyApprovedOrDisbursed
                          ? "border-l-emerald-500 shadow-[inset_4px_0_0_0_#10b981]" 
                          : "hover:bg-slate-50/80 border-l-transparent"
                      )}
                    >
                      <td className="px-4 md:px-6 py-2.5 md:py-4" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                        />
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4">
                        <div className="flex flex-col min-w-0 max-w-full md:max-w-none space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                            <span className="font-bold text-slate-900 text-xs md:text-sm break-words leading-snug">
                              <HighlightText text={req.title} highlight={globalSearchTerm} />
                            </span>
                            {compactAge && (
                              <span className="text-[8px] md:text-[9px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0">
                                {compactAge}
                              </span>
                            )}
                            {req.flaggedForAudit && (
                              <span title="Flagged for Audit" className="inline-flex shrink-0">
                                <Flag size={11} className="text-rose-500 fill-rose-500" />
                              </span>
                            )}
                            {req.inProcurement && (
                              <span className="text-[8px] md:text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0">
                                PROCUREMENT
                              </span>
                            )}
                            {req.requiresMoreInfo && (
                              <span className="text-[8px] md:text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0">
                                INFO REQ
                              </span>
                            )}
                            {req.recurrence && req.recurrence !== "NONE" && (
                              <Repeat size={10} className="text-primary animate-pulse shrink-0" />
                            )}
                            {req.attachments && req.attachments.length > 0 && (
                              <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                <Paperclip size={10} />
                                {req.attachments.length}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[8px] md:text-[10px]">
                            <span className="font-mono text-slate-400 uppercase tracking-wider shrink-0">{req.id}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50/80 border border-indigo-200/50 text-indigo-700 rounded-md font-extrabold uppercase tracking-wider leading-none shrink-0">
                              💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                            </span>
                            <span className="inline-block lg:hidden text-slate-500 font-semibold truncate max-w-[140px]">
                              • {req.requesterName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold text-[11px] md:text-xs">
                            {req.requesterName}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-[8px]">
                            {req.groupName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                        <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] shrink-0",
                            getStatusColor(req.status)
                          )}>
                            {req.status}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                        {formattedAge ? (
                          <div className="flex items-center gap-1.5">
                            <Clock size={11} className="text-slate-400" />
                            <span className="text-[10px] md:text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {formattedAge}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingReq(req);
                            }}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyShareLinkForReq(req);
                            }}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                            title="Copy Shareable Link"
                          >
                            <Share2 size={16} />
                          </button>
                          {/* Edit button: Drafts can be edited by requester or admin/super-admin, others only if admin, rejected can NEVER be edited */}
                          {req.status !== RequisitionStatus.REJECTED && (
                            canPerform('canDeleteRequisition') || 
                            (req.status === RequisitionStatus.DRAFT && (req.requesterId === currentUser?.id || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN))
                          ) && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingReq(req);
                              }}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-amber-500 transition-all"
                              title="Edit Requisition"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {/* Delete button: only admins */}
                          {canPerform('canDeleteRequisition') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setRequisitionToDelete(req);
                              }}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-rose-500 transition-all"
                              title="Delete Permanently"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
            {activeList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Total Active Requisitions
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-rose-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(activeList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({activeList.length} items total)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Mobile Cards View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {activeItems.map((req) => {
              const updateAge = now - new Date(req.updatedAt).getTime();
              const isRecentlyApprovedOrDisbursed = (req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) && updateAge < 8000;
              const formattedAge = formatRequisitionAge(req.submittedAt || req.createdAt, req.status);
              const compactAge = formatRequisitionAge(req.submittedAt || req.createdAt, req.status, { compact: true });
              
              const canEdit = req.status !== RequisitionStatus.REJECTED && (
                canPerform('canDeleteRequisition') || 
                (req.status === RequisitionStatus.DRAFT && (req.requesterId === currentUser?.id || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN))
              );

              return (
                <div 
                  key={req.id}
                  onClick={() => setViewingReq(req)}
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-3 relative border-l-4",
                    selectedIds.has(req.id) ? "bg-primary/5 border-l-primary" : 
                    isRecentlyApprovedOrDisbursed ? "border-l-emerald-500 bg-emerald-50/10" : "border-l-transparent hover:border-l-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                          checked={selectedIds.has(req.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(req.id);
                          }}
                        />
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          {req.id}
                        </span>
                        {req.flaggedForAudit && (
                          <Flag size={11} className="text-rose-500 fill-rose-500" />
                        )}
                        {req.attachments && req.attachments.length > 0 && (
                          <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            <Paperclip size={10} />
                            {req.attachments.length}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        <HighlightText text={req.title} highlight={globalSearchTerm} />
                      </h4>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-[0.1em] shrink-0",
                      getStatusColor(req.status)
                    )}>
                      {req.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[9px] font-extrabold uppercase tracking-wider w-fit">
                        💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold truncate">
                        By {req.requesterName}
                      </span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatCurrency(req.amount)}
                      </span>
                      {compactAge && (
                        <span className="text-[9px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {compactAge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Actions block */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setViewingReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                    <button 
                      onClick={() => handleCopyShareLinkForReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Share2 size={12} />
                      <span>Share</span>
                    </button>
                    {canEdit && (
                      <button 
                        onClick={() => setEditingReq(req)}
                        className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-amber-650 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                      >
                        <Pencil size={12} />
                        <span>Edit</span>
                      </button>
                    )}
                    {canPerform('canDeleteRequisition') && (
                      <button 
                        onClick={() => setRequisitionToDelete(req)}
                        className="p-2 bg-slate-50 border border-slate-200 hover:bg-rose-50 rounded-xl text-slate-600 hover:text-rose-650 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Card List Summary Block */}
          {activeList.length > 0 && (
            <div className="block md:hidden p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between font-bold text-slate-800 text-xs">
              <span className="font-black uppercase tracking-wider">Total Active Requisitions</span>
              <div className="text-right">
                <p className="font-mono text-rose-600 font-extrabold text-sm">{formatCurrency(activeList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">{activeList.length} items total</p>
              </div>
            </div>
          )}

          {activeList.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search size={24} className="text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No matching active requisitions</h3>
              <p className="text-xs text-slate-400 mt-2">Adjust your filters or initiate a new request transaction.</p>
            </div>
          )}
        </div>
        {activeTotalPages > 1 && (
          <Pagination 
            current={activePage} 
            total={activeTotalPages} 
            onChange={setActivePage} 
          />
        )}
      </div>

      {/* Disbursed Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/30">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle size={16} className="text-blue-600" />
            Disbursed History
            <span className="text-[10px] text-slate-400 normal-case font-medium ml-2">({disbursedList.length} total)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer"
                    checked={disbursedList.length > 0 && disbursedList.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allDisbursedInSelected = disbursedList.every(r => selectedIds.has(r.id));
                      const newSelected = new Set(selectedIds);
                      disbursedList.forEach(r => {
                        if (allDisbursedInSelected) newSelected.delete(r.id);
                        else newSelected.add(r.id);
                      });
                      setSelectedIds(newSelected);
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2">
                    ID & Title
                    <button 
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 group text-blue-600 whitespace-nowrap cursor-pointer"
                      title={sortDirection === "desc" ? "Switch to Newest Last" : "Switch to Newest First"}
                    >
                      <ArrowUpDown size={12} className={cn("transition-transform", sortDirection === "asc" && "rotate-180")} />
                      <span className="text-[7px] text-slate-400 font-bold group-hover:text-blue-600">{sortDirection === "desc" ? "DESC" : "ASC"}</span>
                    </button>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Requisition Ownership</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Date Disbursed</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {disbursedItems.map((req, i) => (
                  <motion.tr 
                    key={req.id} 
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -15 }}
                    transition={{ 
                      opacity: { duration: 0.2 },
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                      y: { type: "spring", stiffness: 300, damping: 30 }
                    }}
                    onClick={() => setViewingReq(req)}
                    className={cn(
                      "transition-colors group cursor-pointer border-l-2",
                      selectedIds.has(req.id) ? "bg-blue-50/50 border-l-blue-600" : "hover:bg-slate-50/80 border-l-transparent"
                    )}
                  >
                    <td className="px-4 md:px-6 py-2.5 md:py-4" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                        />
                      </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-none">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-[11px] md:text-sm truncate">
                            <HighlightText text={req.title} highlight={globalSearchTerm} />
                          </span>
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={11} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                          {req.attachments && req.attachments.length > 0 && (
                            <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                              <Paperclip size={10} />
                              {req.attachments.length}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                          <span className="text-[7.5px] md:text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate shrink-0">{req.id}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50/80 border border-blue-200/50 text-blue-700 rounded-md text-[7.5px] md:text-[9px] font-extrabold uppercase tracking-wider leading-none w-fit">
                            💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-bold text-[11px] md:text-xs">
                          {req.requesterName}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-[8px]">
                          {req.groupName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                      <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex justify-center">
                        <span className="px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-600 text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] shrink-0">
                          {req.status}
                        </span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                      <span className="text-[9px] md:text-[10px] font-mono font-bold text-slate-500">
                        {formatDate(req.updatedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingReq(req);
                          }}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyShareLinkForReq(req);
                          }}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                          title="Copy Shareable Link"
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
            {disbursedList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Total Disbursed Funds
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-blue-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(disbursedList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({disbursedList.length} items history)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Mobile Cards View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {disbursedItems.map((req) => {
              return (
                <div 
                  key={req.id}
                  onClick={() => setViewingReq(req)}
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-3 relative border-l-4",
                    selectedIds.has(req.id) ? "bg-blue-50/50 border-l-blue-600" : "border-l-transparent hover:border-l-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer shrink-0"
                          checked={selectedIds.has(req.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(req.id);
                          }}
                        />
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          {req.id}
                        </span>
                        {req.flaggedForAudit && (
                          <Flag size={11} className="text-rose-500 fill-rose-500" />
                        )}
                        {req.attachments && req.attachments.length > 0 && (
                          <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            <Paperclip size={10} />
                            {req.attachments.length}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        <HighlightText text={req.title} highlight={globalSearchTerm} />
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full border border-blue-100 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-[0.1em] shrink-0">
                      {req.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50/80 border border-blue-200/50 text-blue-700 rounded-md text-[9px] font-extrabold uppercase tracking-wider w-fit">
                        💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold truncate">
                        By {req.requesterName}
                      </span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatCurrency(req.amount)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                        Disbursed: {formatDate(req.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Actions block */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setViewingReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                    <button 
                      onClick={() => handleCopyShareLinkForReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Share2 size={12} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Card List Summary Block */}
          {disbursedList.length > 0 && (
            <div className="block md:hidden p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between font-bold text-slate-800 text-xs">
              <span className="font-black uppercase tracking-wider">Total Disbursed Funds</span>
              <div className="text-right">
                <p className="font-mono text-blue-600 font-extrabold text-sm">{formatCurrency(disbursedList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">{disbursedList.length} items history</p>
              </div>
            </div>
          )}

          {disbursedList.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <History size={24} className="text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No disbursed requisitions</h3>
              <p className="text-xs text-slate-400 mt-2">Disbursed items will appear here for historical archiving.</p>
            </div>
          )}
        </div>
        {disbursedTotalPages > 1 && (
          <Pagination 
            current={disbursedPage} 
            total={disbursedTotalPages} 
            onChange={setDisbursedPage} 
          />
        )}
      </div>

      {/* Rejected & Cancelled Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/30">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <XCircle size={16} className="text-rose-600" />
            Rejected & Cancelled Requisitions
            <span className="text-[10px] text-slate-400 normal-case font-medium ml-2">({rejectedList.length} total)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 accent-rose-600 cursor-pointer"
                    checked={rejectedList.length > 0 && rejectedList.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allRejectedInSelected = rejectedList.every(r => selectedIds.has(r.id));
                      const newSelected = new Set(selectedIds);
                      rejectedList.forEach(r => {
                        if (allRejectedInSelected) newSelected.delete(r.id);
                        else newSelected.add(r.id);
                      });
                      setSelectedIds(newSelected);
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2">
                    ID & Title
                    <button 
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 group text-rose-600 whitespace-nowrap cursor-pointer"
                      title={sortDirection === "desc" ? "Switch to Newest Last" : "Switch to Newest First"}
                    >
                      <ArrowUpDown size={12} className={cn("transition-transform", sortDirection === "asc" && "rotate-180")} />
                      <span className="text-[7px] text-slate-400 font-bold group-hover:text-rose-600">{sortDirection === "desc" ? "DESC" : "ASC"}</span>
                    </button>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Requisition Ownership</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Date Updated</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {rejectedItems.map((req) => (
                  <motion.tr 
                    key={req.id} 
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -15 }}
                    transition={{ 
                      opacity: { duration: 0.2 },
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                      y: { type: "spring", stiffness: 300, damping: 30 }
                    }}
                    onClick={() => setViewingReq(req)}
                    className={cn(
                      "transition-colors group cursor-pointer border-l-2",
                      selectedIds.has(req.id) ? "bg-rose-50/50 border-l-rose-600" : "hover:bg-slate-50/80 border-l-transparent"
                    )}
                  >
                    <td className="px-4 md:px-6 py-2.5 md:py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 accent-rose-600 cursor-pointer"
                        checked={selectedIds.has(req.id)}
                        onChange={() => toggleSelect(req.id)}
                      />
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-none">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-[11px] md:text-sm truncate">
                            <HighlightText text={req.title} highlight={globalSearchTerm} />
                          </span>
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={11} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                          <span className="text-[7.5px] md:text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate shrink-0">{req.id}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-rose-50/80 border border-rose-200/50 text-rose-700 rounded-md text-[7.5px] md:text-[9px] font-extrabold uppercase tracking-wider leading-none w-fit">
                            💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                          </span>
                        </div>
                        {req.rejectionReason && (
                          <p className="text-[10px] text-rose-600 mt-1 italic truncate max-w-xs">
                            Reason: {req.rejectionReason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-bold text-[11px] md:text-xs">
                          {req.requesterName}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                          {req.groupName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                      <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex justify-center">
                        <span className="px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border border-rose-100 bg-rose-50 text-rose-600 text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] shrink-0">
                          {req.status}
                        </span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                      <span className="text-[9px] md:text-[10px] font-mono font-bold text-slate-500">
                        {formatDate(req.updatedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingReq(req);
                          }}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyShareLinkForReq(req);
                          }}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                          title="Copy Shareable Link"
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
            {rejectedList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Total Rejected / Cancelled Value
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-rose-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(rejectedList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({rejectedList.length} items rejected/cancelled)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Mobile Cards View for Rejected */}
          <div className="block md:hidden divide-y divide-slate-100">
            {rejectedItems.map((req) => {
              return (
                <div 
                  key={req.id}
                  onClick={() => setViewingReq(req)}
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-3 relative border-l-4",
                    selectedIds.has(req.id) ? "bg-rose-50/50 border-l-rose-600" : "border-l-transparent hover:border-l-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 accent-rose-600 cursor-pointer shrink-0"
                          checked={selectedIds.has(req.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(req.id);
                          }}
                        />
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          {req.id}
                        </span>
                        {req.flaggedForAudit && (
                          <Flag size={11} className="text-rose-500 fill-rose-500" />
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        <HighlightText text={req.title} highlight={globalSearchTerm} />
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full border border-rose-100 bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-[0.1em] shrink-0">
                      {req.status}
                    </span>
                  </div>

                  {req.rejectionReason && (
                    <p className="text-[10px] text-rose-600 italic bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                      Reason: {req.rejectionReason}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50/80 border border-rose-200/50 text-rose-700 rounded-md text-[9px] font-extrabold uppercase tracking-wider w-fit">
                        💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold truncate">
                        By {req.requesterName}
                      </span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatCurrency(req.amount)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                        Updated: {formatDate(req.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setViewingReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                    <button 
                      onClick={() => handleCopyShareLinkForReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Share2 size={12} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {rejectedList.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100">
                <XCircle size={20} className="text-slate-300" />
              </div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">No rejected or cancelled requisitions</h3>
              <p className="text-[11px] text-slate-400 mt-1">Rejected and cancelled items will appear here.</p>
            </div>
          )}
        </div>
        {rejectedTotalPages > 1 && (
          <Pagination 
            current={rejectedPage} 
            total={rejectedTotalPages} 
            onChange={setRejectedPage} 
          />
        )}
      </div>

      {/* Budget Status Summaries */}
      {projectSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-6 mt-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} className="text-indigo-500" />
            Budget Allocations FY {activeYear}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectSummaries.map((proj) => {
              const capHit = proj.percentage >= 100;
              const nearCap = proj.percentage > 85 && !capHit;
              
              return (
                <div key={proj.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 transition-colors hover:bg-slate-100/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-bold text-slate-900 truncate pr-2">{proj.groupId}</p>
                    <div className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider",
                      capHit ? "bg-rose-100 text-rose-700" :
                      nearCap ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {proj.percentage.toFixed(0)}% Used
                    </div>
                  </div>
                  <div className="flex justify-between items-end mb-1">
                    <div className="flex flex-col">
                      <p className="text-lg font-black text-slate-900 tracking-tight leading-none">{formatCurrency(proj.usedAmount)}</p>
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                        Spent: {formatCurrency(proj.spentAmount)}
                      </p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">/ {formatCurrency(proj.allocatedBudget)}</p>
                  </div>
                  
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-3">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(proj.percentage, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        capHit ? "bg-rose-500" :
                        nearCap ? "bg-amber-500" :
                        "bg-emerald-500"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-4 pr-6 border-r border-white/10">
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center font-black text-lg border border-primary/20">
                {selectedIds.size}
              </div>
              <div className="hidden md:block">
                <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-white/90">Items Selected</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Consolidated Batch Ready</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkPrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95"
              >
                <Printer size={16} />
                Download PDF Reports
              </button>
              <button
                onClick={handleBulkExportCsv}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 border border-white/5"
              >
                <Download size={16} className="text-emerald-400" />
                Export Table
              </button>
              {canPerform('canDeleteRequisition') && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50"
                >
                  {isBulkDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  <span>{isBulkDeleting ? `Deleting (${selectedIds.size})...` : "Delete Selected"}</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              title="Clear Selection"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal for Adding */}
      <AnimatePresence>
        {isAdding && <NewRequisitionForm onClose={() => setIsAdding(false)} />}
      </AnimatePresence>

      {/* Modal for Details */}
      <AnimatePresence>
        {viewingReq && (
          <RequisitionDetailModal 
            req={viewingReq} 
            onClose={() => setViewingReq(null)} 
            onDelete={() => {
              setRequisitionToDelete(viewingReq);
              setViewingReq(null);
            }}
            onGenerateReceipt={() => {
              setIsGeneratingReceipt(viewingReq);
            }}
            onEdit={() => {
              setEditingReq(viewingReq);
              setViewingReq(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal for Editing */}
      <AnimatePresence>
        {editingReq && (
          <EditRequisitionModal 
            req={editingReq} 
            onClose={() => setEditingReq(null)} 
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {requisitionToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-6"
            >
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 rounded-full flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Confirm Deletion</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to permanently delete requisition <strong className="text-slate-800 dark:text-slate-200 font-bold">{requisitionToDelete.title}</strong>? This action is irreversible and will erase the financial ledger entry.
                </p>
              </div>

              {isDeletingReq && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold animate-pulse">
                  <Loader2 size={16} className="animate-spin text-rose-600 dark:text-rose-400" />
                  <span>Deleting requisition record from database...</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  disabled={isDeletingReq}
                  onClick={() => setRequisitionToDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={isDeletingReq}
                  onClick={async () => {
                    if (isDeletingReq) return;
                    setIsDeletingReq(true);
                    try {
                      const deletedTitle = requisitionToDelete.title;
                      await deleteRequisition(requisitionToDelete.id);
                      if (triggerToast) {
                        triggerToast({
                          type: "SYSTEM_INFO",
                          severity: "LOW",
                          message: `Requisition "${deletedTitle}" deleted successfully.`,
                          timestamp: new Date().toISOString()
                        });
                      }
                      setRequisitionToDelete(null);
                    } catch (err: any) {
                      console.error("Delete failed:", err);
                      if (triggerToast) {
                        triggerToast({
                          type: "SECURITY_UPDATE",
                          severity: "HIGH",
                          message: err?.message || "Failed to delete requisition.",
                          timestamp: new Date().toISOString()
                        });
                      }
                    } finally {
                      setIsDeletingReq(false);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 dark:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeletingReq ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>{isDeletingReq ? "Deleting..." : "Confirm Delete"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Receipt Generator */}
      <AnimatePresence>
        {isGeneratingReceipt && (
          <ReceiptTemplateGenerator 
            req={isGeneratingReceipt} 
            onClose={() => setIsGeneratingReceipt(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export interface DetailModalProps {
  req: Requisition;
  onClose: () => void;
  onDelete: () => void;
  onGenerateReceipt: () => void;
  onEdit?: () => void;
  isPage?: boolean;
}

export const RequisitionDetailModal: React.FC<DetailModalProps> = ({ req: initialReq, onClose, onDelete, onGenerateReceipt, onEdit, isPage }) => {
  const { currentUser, updateRequisitionStatus, updateRequisition, sendEmailNotification, uploadReceipts, globalSearchTerm, projects, triggerToast, vendors, requisitions, users, addAlert } = useRequisitions();
  const req = requisitions.find(r => r.id === initialReq.id) || initialReq;
  const normalizedAttachments = React.useMemo(() => safeNormalizeAttachments(req.attachments), [req.attachments]);
  const [decisionNote, setDecisionNote] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [showDecisionForm, setShowDecisionForm] = useState<"APPROVE" | "REJECT" | "ESCALATE" | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [isGroupVerified, setIsGroupVerified] = useState(false);
  const [isAmountVerified, setIsAmountVerified] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [lastAddedEmail, setLastAddedEmail] = useState<string | null>(null);
  const decisionFormRef = useRef<HTMLDivElement>(null);

  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Eagerly pre-warm PDF attachment thumbnails into global memory cache
  useEffect(() => {
    if (req && Array.isArray(req.attachments)) {
      req.attachments.forEach((att: any) => {
        const attUrl = typeof att === "string" ? att : (att?.url || "");
        if (attUrl && (attUrl.toLowerCase().includes(".pdf") || attUrl.startsWith("data:application/pdf"))) {
          preloadPdfThumbnail(attUrl).catch(() => {});
        }
      });
    }
  }, [req]);

  const filteredMentionUsers = React.useMemo(() => {
    if (mentionSearch === null) return [];
    const searchLower = mentionSearch.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(searchLower) || 
      u.email.toLowerCase().includes(searchLower)
    ).slice(0, 5);
  }, [mentionSearch, users]);

  const insertMention = (user: any) => {
    if (mentionIndex === -1) return;
    
    const beforeMention = commentText.substring(0, mentionIndex);
    const mentionText = `@${user.name} `;
    const afterCursor = commentText.substring(mentionIndex + (mentionSearch?.length || 0) + 1);
    
    setCommentText(beforeMention + mentionText + afterCursor);
    setMentionSearch(null);
    setMentionIndex(-1);
    
    if (commentTextareaRef.current) {
      commentTextareaRef.current.focus();
    }
  };

  const handleCommentTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const selectionStart = e.target.selectionStart || 0;
    const textBeforeCursor = val.substring(0, selectionStart);
    const words = textBeforeCursor.split(/[\s\n]/);
    const lastWord = words[words.length - 1];

    if (lastWord && lastWord.startsWith("@")) {
      const search = lastWord.substring(1);
      setMentionSearch(search);
      setMentionIndex(textBeforeCursor.lastIndexOf("@"));
    } else {
      setMentionSearch(null);
      setMentionIndex(-1);
    }
  };

  const renderFormattedCommentText = (text: string) => {
    if (!text) return null;
    const mentionRegex = /(@[A-Za-z0-9._-]+(?:\s+[A-Za-z0-9._-]+)?)/g;
    const parts = text.split(mentionRegex);

    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-indigo-100/90 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] border border-indigo-200/60 dark:border-indigo-800/60 mx-0.5 shadow-2xs"
          >
            {part}
          </span>
        );
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = commentText.trim();
    if (!trimmed) return;

    // Resolve author name cleanly
    const calculatedAuthorName = currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : "Church Officer");

    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      authorId: currentUser?.id || "anonymous",
      authorName: calculatedAuthorName,
      authorEmail: currentUser?.email || "",
      authorRole: currentUser?.role || "USER",
      text: trimmed,
      timestamp: new Date().toISOString()
    };
    
    const currentComments = Array.isArray(req.comments) ? req.comments : [];
    const updatedComments = [...currentComments, newComment];

    // Optimistically update local UI & reset form fields instantly (0ms delay)
    req.comments = updatedComments;
    setCommentText("");
    setMentionSearch(null);
    setMentionIndex(-1);
    setIsSubmittingComment(false);

    // Execute database save & notifications in background task
    (async () => {
      try {
        await updateRequisition(req.id, { comments: updatedComments });

        const authorEmail = currentUser?.email?.toLowerCase() || "";
        const authorId = currentUser?.id || "";

        const mentionedUsers = users.filter(user => {
          if (user.id === authorId || user.email?.toLowerCase() === authorEmail) return false;
          
          const nameMention = `@${user.name.toLowerCase()}`;
          const emailMention = `@${user.email?.toLowerCase()}`;
          const cleanText = trimmed.toLowerCase();
          
          return cleanText.includes(nameMention) || (user.email && cleanText.includes(emailMention));
        });

        for (const u of mentionedUsers) {
          addAlert({
            type: "SYSTEM_INFO",
            severity: "MEDIUM",
            message: `${calculatedAuthorName} mentioned you in a comment on Requisition "${req.title}" (ID: ${req.id}): "${trimmed.length > 55 ? trimmed.substring(0, 55) + '...' : trimmed}"`,
            targetUserId: u.id
          }).catch(() => {});

          if (u.email) {
            sendEmailNotification(
              req,
              "Comment Mention",
              `"${trimmed}"`,
              calculatedAuthorName,
              u.email,
              u.name
            ).catch(err => console.error("Failed to send mention email to", u.email, err));
          }
        }

        let requesterEmail = req.requesterEmail;
        let requesterName = req.requesterName;
        if (!requesterEmail) {
          const rUser = users.find(usr => usr.id === req.requesterId || usr.name === req.requesterName);
          if (rUser) {
            requesterEmail = rUser.email;
            requesterName = rUser.name;
          }
        }

        const receiversMap = new Map<string, string>();
        
        if (
          requesterEmail && 
          requesterEmail.toLowerCase() !== authorEmail && 
          !mentionedUsers.some(mu => mu.email?.toLowerCase() === requesterEmail?.toLowerCase())
        ) {
          receiversMap.set(requesterEmail.toLowerCase(), requesterName || "Requester");
        }

        const notificationEmailsList = req.notificationEmails || (req as any).notification_emails || [];
        if (Array.isArray(notificationEmailsList)) {
          notificationEmailsList.forEach(emailStr => {
            if (emailStr && typeof emailStr === "string") {
              const cleanEmail = emailStr.trim().toLowerCase();
              if (
                cleanEmail && 
                cleanEmail !== authorEmail && 
                !mentionedUsers.some(mu => mu.email?.toLowerCase() === cleanEmail)
              ) {
                const matchedUser = users.find(usr => usr.email?.toLowerCase() === cleanEmail);
                receiversMap.set(cleanEmail, matchedUser?.name || "Subscriber");
              }
            }
          });
        }

        for (const [recEmail, recName] of receiversMap.entries()) {
          sendEmailNotification(
            req,
            "New Comment Thread Activity",
            `"${trimmed}"`,
            calculatedAuthorName,
            recEmail,
            recName
          ).catch(err => console.error("Failed to send comment update email to", recEmail, err));
        }
      } catch (err) {
        console.error("Failed to persist comment in background:", err);
      }
    })();
  };

  const handleUpdateComment = async (commentId: string, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    try {
      const currentComments = Array.isArray(req.comments) ? req.comments : [];
      const updatedComments = currentComments.map(c => 
        c.id === commentId ? { ...c, text: trimmed, isEdited: true, editedAt: new Date().toISOString() } : c
      );
      await updateRequisition(req.id, { comments: updatedComments });
      setEditingCommentId(null);
      setEditingCommentText("");
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: "Comment updated.",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to update comment:", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to update comment.",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const currentComments = Array.isArray(req.comments) ? req.comments : [];
      const updatedComments = currentComments.filter(c => c.id !== commentId);
      await updateRequisition(req.id, { comments: updatedComments });
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: "Comment deleted.",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50";
      case "ADMIN":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50";
      case "APPROVER_L2":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50";
      case "APPROVER_L1":
        return "bg-teal-100 text-teal-850 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50";
      case "FINANCE":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const handleAddMember = async (emailToAdd: string) => {
    const norm = emailToAdd.trim().toLowerCase();
    if (!norm || !norm.includes("@") || !norm.includes(".")) {
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Please enter a valid email address.",
        timestamp: new Date().toISOString()
      });
      return;
    }

    const currentList = Array.isArray(req.notificationEmails) ? req.notificationEmails : [];
    if (currentList.some(e => (e || "").trim().toLowerCase() === norm)) {
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: "This email is already receiving updates.",
        timestamp: new Date().toISOString()
      });
      return;
    }

    setIsSavingMember(true);
    try {
      const updated = [...currentList, norm];
      await updateRequisition(req.id, { notificationEmails: updated });
      setLastAddedEmail(norm);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Added ${norm} to update recipients.`,
        timestamp: new Date().toISOString()
      });
      setNewMemberEmail("");
      setIsInputFocused(false);
    } catch (err) {
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to add member to recipients.",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleRemoveMember = async (emailToRemove: string) => {
    const norm = emailToRemove.trim().toLowerCase();
    const currentList = Array.isArray(req.notificationEmails) ? req.notificationEmails : [];
    const updated = currentList.filter(e => (e || "").trim().toLowerCase() !== norm);

    setIsSavingMember(true);
    try {
      await updateRequisition(req.id, { notificationEmails: updated });
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Removed ${norm} from update recipients.`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to remove recipient.",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSavingMember(false);
    }
  };

  const updateRecipients = React.useMemo(() => {
    const rawEmails = new Set<string>();

    if (req.requesterEmail) {
      rawEmails.add(req.requesterEmail.trim().toLowerCase());
    }

    if (Array.isArray(req.notificationEmails)) {
      req.notificationEmails.forEach((email) => {
        const norm = (email || "").trim().toLowerCase();
        if (norm) rawEmails.add(norm);
      });
    }

    if (rawEmails.size === 0 && req.groupName && users) {
      const grpLower = req.groupName.trim().toLowerCase();
      users.forEach((u) => {
        if (!u.email) return;
        const uGrp = (u.group || "").trim().toLowerCase();
        const inGroups = Array.isArray(u.groups) && u.groups.some(g => (g || "").trim().toLowerCase() === grpLower);
        const inDept = (u.department || "").trim().toLowerCase() === grpLower;
        if (uGrp === grpLower || inGroups || inDept) {
          rawEmails.add(u.email.trim().toLowerCase());
        }
      });
    }

    const result: Array<{
      email: string;
      name: string;
      roleOrGroup: string;
      isRequester: boolean;
    }> = [];

    rawEmails.forEach((email) => {
      const matchedUser = users?.find(
        (u) => u.email && u.email.trim().toLowerCase() === email
      );
      const isRequester =
        (req.requesterEmail && req.requesterEmail.trim().toLowerCase() === email) ||
        (matchedUser && matchedUser.name === req.requesterName) ||
        (!matchedUser && email.includes(req.requesterName.toLowerCase()));

      if (matchedUser) {
        result.push({
          email: matchedUser.email,
          name: matchedUser.name || email,
          roleOrGroup: matchedUser.group || matchedUser.department || matchedUser.role || "Member",
          isRequester: Boolean(isRequester)
        });
      } else {
        result.push({
          email,
          name: isRequester ? req.requesterName : email.split("@")[0],
          roleOrGroup: isRequester ? `${req.groupName} (Requester)` : "Notification Recipient",
          isRequester: Boolean(isRequester)
        });
      }
    });

    return result;
  }, [req, users]);

  const emailSuggestions = React.useMemo(() => {
    const search = newMemberEmail.trim().toLowerCase();
    if (!search) return [];

    const existingEmails = new Set(
      updateRecipients.map(r => (r.email || "").trim().toLowerCase())
    );

    return (users || [])
      .filter((u) => {
        if (!u.email) return false;
        const em = u.email.trim().toLowerCase();
        const nm = (u.name || "").trim().toLowerCase();
        return em.includes(search) || nm.includes(search);
      })
      .map((u) => ({
        user: u,
        alreadyAdded: existingEmails.has(u.email.trim().toLowerCase())
      }))
      .slice(0, 6);
  }, [newMemberEmail, users, updateRecipients]);

  useEffect(() => {
    if (showDecisionForm && decisionFormRef.current) {
      decisionFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showDecisionForm]);

  const handleCopyDetails = async () => {
    const formattedAmount = formatCurrency(req.amount);
    const timelineEvents = getConsolidatedTimeline();
    
    let text = `=========================================\n`;
    text += `REQUISITION: ${req.title}\n`;
    text += `=========================================\n`;
    text += `ID: ${req.id}\n`;
    text += `Status: ${req.status}\n`;
    text += `Amount: ${formattedAmount} (${req.amountWords || "N/A"})\n`;
    text += `Group: ${req.groupName || "N/A"}\n`;
    text += `Requester: ${req.requesterName}\n`;
    text += `Submitted At: ${formatDate(req.submittedAt)}\n`;
    text += `Expiry Date: ${req.expiresAt ? formatDate(req.expiresAt) : "N/A"}\n`;
    if (req.recurrence && req.recurrence !== "NONE") {
      text += `Recurrence: ${req.recurrence}\n`;
    }
    text += `\nDescription:\n${req.description}\n\n`;
    
    text += `=========================================\n`;
    text += `TIMELINE & AUDIT HISTORY\n`;
    text += `=========================================\n`;
    
    timelineEvents.forEach((event, idx) => {
      text += `${idx + 1}. ${formatDate(event.timestamp)} - [${event.type}] ${event.title}\n`;
      text += `   Operator: ${event.actorName}${event.role ? ` (${event.role})` : ""}\n`;
      if (event.note) {
        text += `   Note: "${event.note}"\n`;
      }
      text += `-----------------------------------------\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Requisition details for "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy clipboard text: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy requisition details to clipboard. Please try again.",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleCopyShareLink = async () => {
    const rawUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${rawUrl}?reqId=${req.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Direct shareable link for Requisition "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy share link: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy shareable link to clipboard.",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleCaptureReceipt = async (file: File) => {
    if (req.status !== RequisitionStatus.DISBURSED) {
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "MEDIUM",
        message: "Receipts can only be attached after all approvals are confirmed and disbursement is done.",
        timestamp: new Date().toISOString()
      });
      return;
    }
    setIsUploadingReceipt(true);
    try {
      const base64data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read captured image as data URL"));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      await uploadReceipts(req.id, [base64data]);
    } catch (error) {
      console.error("Error saving captured receipt physical photo:", error);
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const getConsolidatedTimeline = () => {
    interface TimelineEvent {
      id: string;
      timestamp: string;
      title: string;
      subtitle: string;
      type: "CREATED" | "L1_APPROVED" | "L2_APPROVED" | "DISBURSED" | "REJECTED" | "ESCALATED" | "GENERIC";
      actorName: string;
      role?: string;
      note?: string;
      method?: string;
      approvalCode?: string;
    }

    const timeline: TimelineEvent[] = [];

    // 1. Initial Submission
    timeline.push({
      id: "submission",
      timestamp: req.submittedAt,
      title: "Requisition Created",
      subtitle: "Entry logged into the ledger system",
      type: "CREATED",
      actorName: req.requesterName,
      role: "Church Group 代表 (General Rep)"
    });

    // 2. Map existing approvalHistory entries
    const historyArr = Array.isArray(req.approvalHistory) ? req.approvalHistory : [];
    if (historyArr.length > 0) {
      historyArr.forEach((note, idx) => {
        let type: TimelineEvent["type"] = "GENERIC";
        let title = "Process Step Documented";
        let subtitle = `Validated by ${note.approverName}`;

        const decision = note.decision;
        const roleStr = note.role || "";
        
        if (decision === "APPROVE") {
          if (roleStr.includes("L1") || roleStr.includes("APPROVER_L1") || roleStr.toLowerCase().includes("compliance")) {
            type = "L1_APPROVED";
            title = "L1 Approved";
            subtitle = "First level verification & audit clearance";
          } else if (roleStr.includes("L2") || roleStr.includes("APPROVER_L2") || roleStr.toLowerCase().includes("keymaster")) {
            type = "L2_APPROVED";
            title = "L2 Approved";
            subtitle = "Second level consensus consent";
          } else if (roleStr.toLowerCase().includes("finance") || (note.note || "").toLowerCase().includes("disburs") || (note.note || "").toLowerCase().includes("payment")) {
            type = "DISBURSED";
            title = "Requisition Funds Disbursed";
            subtitle = "Financial transaction settled and paid";
          } else {
            type = "GENERIC";
            title = "Validated & Approved";
          }
        } else if (decision === "REJECT") {
          type = "REJECTED";
          title = "Requisition Returned / Rejected";
          subtitle = "Process halted by reviewer";
        } else if (decision === "ESCALATE") {
          type = "ESCALATED";
          title = "Transaction Escalated";
          subtitle = "Review forwarded to higher authority";
        }

        timeline.push({
          id: note.id || `hist-${idx}`,
          timestamp: note.timestamp,
          title,
          subtitle,
          type,
          actorName: note.approverName,
          role: note.role,
          note: note.note,
          method: note.method,
          approvalCode: note.approvalCode
        });
      });
    }

    // 3. Robust checks for explicit timestamps to ensure no missed milestones
    if (req.approvedAtL1 && !timeline.some(t => t.type === "L1_APPROVED")) {
      timeline.push({
        id: "legacy-l1",
        timestamp: req.approvedAtL1,
        title: "L1 Compliance Clearance Granted",
        subtitle: "First level verification & audit clearance",
        type: "L1_APPROVED",
        actorName: "Compliance Verifier L1"
      });
    }

    if (req.approvedAtL2 && !timeline.some(t => t.type === "L2_APPROVED")) {
      timeline.push({
        id: "legacy-l2",
        timestamp: req.approvedAtL2,
        title: "L2 Keymaster Signing Certified",
        subtitle: "Second level consensus consent",
        type: "L2_APPROVED",
        actorName: "Keymaster L2 Leader"
      });
    }

    if (req.disbursedAt && !timeline.some(t => t.type === "DISBURSED")) {
      timeline.push({
        id: "legacy-disbursal",
        timestamp: req.disbursedAt,
        title: "Requisition Funds Disbursed",
        subtitle: "Financial transaction settled and paid",
        type: "DISBURSED",
        actorName: "Finance Auditor"
      });
    }

    // Sort chronologically (oldest to newest)
    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const handleToggleAuditFlag = async () => {
    try {
      await updateRequisition(req.id, {
        flaggedForAudit: !req.flaggedForAudit
      });
    } catch (error) {
      console.error("Failed to toggle audit flag:", error);
    }
  };

  const canAct = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN) return true;
    if (currentUser.role === UserRole.APPROVER_L1 && req.status === RequisitionStatus.SUBMITTED) return true;
    if (currentUser.role === UserRole.APPROVER_L2 && (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED)) return true;
    return false;
  };

  const handleDecision = async (decision: "APPROVE" | "REJECT" | "ESCALATE") => {
    setLoading(true);
    try {
      let nextStatus = req.status;
      if (decision === "APPROVE") {
        nextStatus = req.status === RequisitionStatus.SUBMITTED ? RequisitionStatus.APPROVED_L1 : RequisitionStatus.APPROVED_L2;
      } else if (decision === "REJECT") {
        nextStatus = RequisitionStatus.REJECTED;
      } else if (decision === "ESCALATE") {
        nextStatus = RequisitionStatus.ESCALATED;
      }

      await updateRequisitionStatus(
        req.id, 
        nextStatus, 
        decision, 
        decisionNote, 
        "CODE", 
        decision === "REJECT" ? decisionNote : undefined,
        approvalCode
      );
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const containerClass = isPage
    ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-full shadow-sm flex flex-col min-h-[600px] select-text relative"
    : "bg-white dark:bg-slate-900 rounded-none md:rounded-2xl w-full max-w-4xl h-full md:h-[90vh] md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 dark:border-slate-800 flex flex-col max-w-full relative";

  const mainContent = (
    <motion.div 
      initial={isPage ? { opacity: 0, y: 15 } : { scale: 0.95, opacity: 0 }}
      animate={isPage ? { opacity: 1, y: 0 } : { scale: 1, opacity: 1 }}
      exit={isPage ? { opacity: 0, y: 15 } : { scale: 0.95, opacity: 0 }}
      className={containerClass}
    >
      <div className={cn(
        "px-3 sm:px-6 md:px-8 py-3.5 md:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md gap-2 min-w-0 max-w-full shrink-0 shadow-xs",
        isPage ? "rounded-t-2xl" : "rounded-t-none md:rounded-t-2xl"
      )}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <span className={cn(
            "p-1.5 md:p-2 rounded-xl border shrink-0",
            req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50" : "bg-primary/5 text-primary border-primary/10"
          )}>
            <ShieldCheck size={18} className="md:w-5 md:h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap">
              <h3 className="text-[12px] md:text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.05em] sm:tracking-[0.1em] truncate min-w-0 flex-1">
                <HighlightText text={req.title} highlight={globalSearchTerm || ""} />
              </h3>
              {req.flaggedForAudit && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] shrink-0">
                  <Flag size={10} className="fill-current" />
                  Audit Flagged
                </span>
              )}
            </div>
            <p className="text-[8px] md:text-[10px] font-mono text-slate-400 uppercase tracking-widest truncate">{req.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 relative z-50">
          <motion.button 
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={onClose} 
            title="Close and go back (Esc)"
            className="flex sticky items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-full transition-all font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20 border border-rose-500/50 backdrop-blur-md"
          >
            <X size={16} className="stroke-[2.5]" />
            <span className="hidden sm:inline">Close & Go Back</span>
            <span className="sm:hidden">Close</span>
          </motion.button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top workflow progress timeline component */}
          {(() => {
            const isRejected = req.status === RequisitionStatus.REJECTED;
            const isCancelled = req.status === RequisitionStatus.CANCELLED;
            const isEscalated = req.status === RequisitionStatus.ESCALATED;

            let currentStep = 0;
            if (req.status === RequisitionStatus.SUBMITTED) {
              currentStep = 0;
            } else if (req.status === RequisitionStatus.APPROVED_L1 || isEscalated) {
              currentStep = 1;
            } else if (req.status === RequisitionStatus.APPROVED_L2) {
              currentStep = 2;
            } else if (req.status === RequisitionStatus.DISBURSED) {
              currentStep = 3;
            }

            const steps = [
              {
                title: "Submitted",
                desc: "Entry logged",
                icon: User,
                status: currentStep > 0 ? "completed" : currentStep === 0 ? "current" : "upcoming"
              },
              {
                title: "L1 Approved",
                desc: "Leader Verify",
                icon: ShieldCheck,
                status: isRejected && req.rejectionReason?.includes("L1") ? "rejected" : (currentStep > 1 ? "completed" : currentStep === 1 ? "active" : "upcoming")
              },
              {
                title: "L2 Approved",
                desc: "Board Consent",
                icon: ShieldCheck,
                status: isEscalated ? "escalated" : (isRejected && !req.rejectionReason?.includes("L1") ? "rejected" : (currentStep > 2 ? "completed" : currentStep === 2 ? "active" : "upcoming"))
              },
              {
                title: "Disbursed",
                desc: "Funds Paid",
                icon: Coins,
                status: currentStep === 3 ? "completed" : "upcoming"
              }
            ];

            return (
              <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 md:p-8 shrink-0">
                <div className="max-w-4xl mx-auto">
                  <div className="relative grid grid-cols-4 gap-1 sm:gap-2 md:gap-0 items-start">
                    
                    {/* Horizontal connection line */}
                    <div className="absolute left-6 right-6 top-4 sm:top-5 md:top-6 -translate-y-1/2 h-1 bg-slate-200 z-0 rounded-full">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${
                            isRejected || isCancelled ? (currentStep * 33.33) :
                            currentStep === 3 ? 100 : (currentStep * 33.33 + 16.66)
                          }%` 
                        }}
                        className={cn(
                          "h-full transition-all duration-700 rounded-full",
                          isRejected || isCancelled ? "bg-rose-400" : isEscalated ? "bg-amber-400" : "bg-emerald-500"
                        )}
                      />
                    </div>

                    {steps.map((step, idx) => {
                      const StepIcon = step.icon;
                      const isUpcoming = step.status === "upcoming";
                      const isActive = step.status === "active" || step.status === "current";
                      const isCompleted = step.status === "completed";
                      const isError = step.status === "rejected";
                      const isWarning = step.status === "escalated";

                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5 sm:gap-3 z-10 w-full relative text-center">
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                              "w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-sm shrink-0",
                              isCompleted ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-200" :
                              isActive ? "bg-white border-primary text-primary shadow-primary/20 ring-4 ring-primary/10" :
                              isError ? "bg-rose-500 border-rose-600 text-white shadow-rose-200" :
                              isWarning ? "bg-amber-500 border-amber-600 text-white shadow-amber-200" :
                              "bg-slate-50 border-slate-200 text-slate-300"
                            )}
                          >
                            {isCompleted ? (
                              <Check size={16} className="stroke-[3] md:w-5 md:h-5" />
                            ) : (
                              <StepIcon size={16} className={cn("md:w-5 md:h-5", isActive && "animate-pulse")} />
                            )}
                          </motion.div>
                          
                          <div className="text-center space-y-0.5">
                            <h4 className={cn(
                              "text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-wider leading-tight",
                              isCompleted ? "text-emerald-700" :
                              isActive ? "text-primary" :
                              isError ? "text-rose-700" :
                              isWarning ? "text-amber-700" :
                              "text-slate-400"
                            )}>
                              {step.title}
                            </h4>
                            <p className="text-[7px] sm:text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-tighter hidden xs:block sm:block">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(isRejected || isCancelled) && (
                    <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                        <XCircle size={18} className="text-rose-600" />
                      </div>
                      <div className="space-y-0.5">
                         <p className="text-[10px] md:text-xs font-black uppercase tracking-wider">
                           Process Terminated: {req.status}
                         </p>
                         <p className="text-[9px] font-bold text-rose-600/70 uppercase">Requisition removed from active ledger workflow</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-3 overflow-y-auto lg:overflow-hidden">
            {/* Left Content */}
            <div className="lg:col-span-2 p-4 md:p-8 space-y-5 md:space-y-8 border-b lg:border-b-0 lg:border-r border-slate-100 lg:h-full lg:overflow-y-auto h-auto overflow-visible">
              <section className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em]">Requisition Description</h4>
                </div>
                <div className="bg-slate-50 rounded-xl md:rounded-2xl p-3 md:p-6 border border-slate-100 space-y-4 text-[10px] md:text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                  <HighlightText text={req.description} highlight={globalSearchTerm || ""} />
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                <section className="space-y-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested Amount</h4>
                  <div className="space-y-1">
                    <p className="text-xl md:text-2xl font-bold text-slate-900 font-mono">{formatCurrency(req.amount)}</p>
                    <p className="text-[9px] md:text-[11px] text-slate-500 italic font-medium">{req.amountWords}</p>
                  </div>
                </section>
                <section className="space-y-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Individual Requestor</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs md:text-base shrink-0">
                      {req.requesterName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-bold text-slate-900 truncate">{req.requesterName}</p>
                      <p className="text-[8px] md:text-[10px] text-slate-500 uppercase tracking-wider truncate">{req.groupName}</p>
                    </div>
                  </div>
                </section>
                <section className="space-y-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</h4>
                  {(() => {
                    const vendorName = req.payableTo || "";
                    if (!vendorName.trim()) {
                      return (
                        <div className="text-xs text-slate-400 italic py-1">
                          No vendor specified
                        </div>
                      );
                    }
                    const matchedVendor = vendors.find(
                      v => v.name.trim().toLowerCase() === vendorName.trim().toLowerCase()
                    );
                    const vendorContact = matchedVendor?.contact || "N/A";
                    const reqCount = requisitions.filter(
                      r => r.payableTo && r.payableTo.trim().toLowerCase() === vendorName.trim().toLowerCase()
                    ).length;

                    return (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold shrink-0">
                          <Store size={16} className="md:w-5 md:h-5" />
                        </div>
                        <div className="min-w-0 space-y-0.5 animate-in fade-in duration-200">
                          <p className="text-xs md:text-sm font-bold text-slate-900 truncate" title={vendorName}>{vendorName}</p>
                          <p className="text-[8px] md:text-[10px] text-slate-500 font-semibold truncate">
                            Contact: <span className="font-extrabold text-slate-755">{vendorContact}</span>
                          </p>
                          <div className="pt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-indigo-700/80 rounded font-black uppercase tracking-wider font-mono text-[7px] md:text-[8px] border border-indigo-100/30">
                              Appeared in {reqCount} {reqCount === 1 ? "requisition" : "requisitions"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </section>
              </div>

              {/* Members Receiving Updates Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail size={12} className="text-indigo-500" />
                    Members Receiving Updates ({updateRecipients.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}
                    disabled={isSavingMember}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer border border-indigo-200/50 dark:border-indigo-800/50 shrink-0 shadow-sm"
                  >
                    <UserPlus size={13} className="text-indigo-600 dark:text-indigo-400" />
                    <span>{isAddMemberOpen ? "Cancel" : "Add Members"}</span>
                  </button>
                </div>

                <AnimatePresence>
                  {isAddMemberOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-indigo-50/60 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3 relative overflow-visible"
                    >
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <UserPlus size={14} className="text-indigo-500" />
                          <span>Add Member to Receive Updates</span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400">Type email or name to search</span>
                      </div>

                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Email Address
                        </label>
                        <div className="flex gap-2 relative">
                          <input
                            type="email"
                            value={newMemberEmail}
                            onChange={(e) => {
                              setNewMemberEmail(e.target.value);
                              setIsInputFocused(true);
                            }}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
                            placeholder="Type email or search member name..."
                            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddMember(newMemberEmail);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddMember(newMemberEmail)}
                            disabled={isSavingMember || !newMemberEmail.trim()}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            {isSavingMember ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Plus size={13} />
                            )}
                            Add Email
                          </button>
                        </div>

                        {/* Dropdown Suggestions */}
                        {isInputFocused && emailSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                              <span>Matching Church Members ({emailSuggestions.length})</span>
                              <span>Click to select</span>
                            </div>
                            {emailSuggestions.map(({ user, alreadyAdded }) => (
                              <button
                                key={user.id || user.email}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  if (alreadyAdded) {
                                    triggerToast({
                                      type: "SYSTEM_INFO",
                                      severity: "LOW",
                                      message: `${user.email} is already in the recipient list.`,
                                      timestamp: new Date().toISOString()
                                    });
                                  } else {
                                    handleAddMember(user.email);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 transition-colors flex items-center justify-between gap-2 text-xs group cursor-pointer"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6.5 h-6.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-indigo-200/40">
                                    {(user.name || user.email).charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                      {user.name || user.email.split("@")[0]}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                      {user.email}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {(user.group || user.department || user.role) && (
                                    <span className="text-[8.5px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                                      {user.group || user.department || user.role}
                                    </span>
                                  )}
                                  {alreadyAdded ? (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded flex items-center gap-1">
                                      <Check size={9} /> Added
                                    </span>
                                  ) : (
                                    <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                      + Add
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {updateRecipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    {updateRecipients.map((rec) => {
                      const isRemoveable = Array.isArray(req.notificationEmails) &&
                        req.notificationEmails.some(e => (e || "").trim().toLowerCase() === rec.email.toLowerCase());
                      const isJustAdded = rec.email.toLowerCase() === lastAddedEmail?.toLowerCase();

                      return (
                        <div
                          key={rec.email}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl border shadow-sm text-xs transition-all",
                            isJustAdded
                              ? "bg-emerald-50/90 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700/80 ring-2 ring-emerald-500/40"
                              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs shrink-0 border",
                            isJustAdded
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40"
                          )}>
                            {rec.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[140px]">
                                {rec.name}
                              </span>
                              {rec.isRequester && (
                                <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[8px] font-black uppercase rounded tracking-wider">
                                  Requester
                                </span>
                              )}
                              {isJustAdded && (
                                <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[8px] font-black uppercase rounded tracking-wider flex items-center gap-0.5">
                                  <Check size={9} /> Added
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
                              {rec.email}
                            </span>
                          </div>
                          {rec.roleOrGroup && (
                            <span className="ml-1 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800/50 shrink-0">
                              {rec.roleOrGroup}
                            </span>
                          )}
                          {isRemoveable && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(rec.email)}
                              disabled={isSavingMember}
                              title="Remove from update recipients"
                              className="ml-1 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 italic">
                    No members currently configured to receive updates for this requisition.
                  </div>
                )}
              </section>

              <section className="space-y-3 md:space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Attachments (Documents)
                    </h4>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[9px] font-bold">
                      {normalizedAttachments.length}
                    </span>
                  </div>
                </div>

                {/* Main Visual Thumbnail Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                   {/* Attachment Visual Cards */}
                   {normalizedAttachments.map((attachment: any, i: number) => {
                      let name = typeof attachment === 'string' ? attachment : (attachment?.name || 'Attachment');
                      let url = typeof attachment === 'string' ? attachment : (attachment?.url || '');
                      
                      if (typeof attachment === 'string' && attachment.includes("::")) {
                        const parts = attachment.split("::");
                        name = parts[0];
                        url = parts[1];
                      } else if (typeof attachment === 'string' && (attachment.startsWith("http") || attachment.startsWith("/"))) {
                        const parts = attachment.split("/");
                        const last = parts[parts.length - 1];
                        if (last && last.includes(".")) {
                          name = last;
                        }
                      }
                      
                      url = normalizeAttachmentUrl(url);
                      
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || (typeof url === 'string' && (url.startsWith('data:image/') || url.startsWith('blob:')));
                      const fileExt = name.split('.').pop()?.toUpperCase() || "DOC";
                      const isDocx = fileExt === "DOCX" || /\.(docx)$/i.test(name) || /\.(docx)$/i.test(url);
                      const isXlsx = fileExt === "XLSX" || fileExt === "XLS" || fileExt === "CSV" || /\.(xlsx|xls|csv)$/i.test(name) || /\.(xlsx|xls|csv)$/i.test(url);
                      const isPdf = !isImage && !isDocx && !isXlsx && (fileExt === "PDF" || /\.(pdf)$/i.test(name) || /\.(pdf)$/i.test(url) || (typeof url === 'string' && url.startsWith('data:application/pdf')));

                      return (
                        <div 
                          key={`doc-${i}`} 
                          onClick={() => setPreviewIndex(i)}
                          className="aspect-[4/3] sm:aspect-square w-full bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl hover:border-indigo-500/50 dark:hover:border-indigo-400/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between overflow-hidden relative shadow-sm"
                          title={name}
                        >
                          {/* Card Content Header / Media */}
                          {isImage ? (
                            <CachedImage 
                              src={url} 
                              alt={name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : isPdf ? (
                            <PdfThumbnailPreview url={url} title={name} />
                          ) : isXlsx ? (
                            <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-gradient-to-b from-emerald-50/80 to-emerald-100/30 dark:from-emerald-950/30 dark:to-slate-900">
                              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform">
                                <FileSpreadsheet size={20} />
                              </div>
                              <span className="text-[9px] font-mono font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                {fileExt === "CSV" ? "CSV SHEET" : "EXCEL SHEET"}
                              </span>
                            </div>
                          ) : isDocx ? (
                            <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-gradient-to-b from-blue-50/80 to-blue-100/30 dark:from-blue-950/30 dark:to-slate-900">
                              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform">
                                <FileText size={20} />
                              </div>
                              <span className="text-[9px] font-mono font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                WORD DOC
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-900">
                              <div className="w-10 h-10 rounded-2xl bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform">
                                <FileText size={20} />
                              </div>
                              <span className="text-[9px] font-mono font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                                {fileExt}
                              </span>
                            </div>
                          )}

                          {/* File Format Badge */}
                          <div className="absolute top-2 left-2 z-10">
                            <span className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-wider rounded-lg border border-white/10 shadow-sm">
                              {isImage ? "IMAGE" : fileExt}
                            </span>
                          </div>

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 backdrop-blur-[2px]">
                            <span className="p-2.5 bg-white text-slate-900 rounded-xl shadow-lg hover:bg-slate-100 transition-transform active:scale-95 flex items-center gap-1.5 text-[10px] font-bold">
                              <Eye size={14} />
                              <span>{isPdf ? "Open Document" : "Preview"}</span>
                            </span>
                          </div>

                          {/* Bottom Title Bar */}
                          <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent">
                            <div className="text-[9px] font-bold text-white truncate drop-shadow-sm">
                              {name}
                            </div>
                          </div>
                        </div>
                      );
                   })}
                </div>

                {/* Empty State */}
                {normalizedAttachments.length === 0 && (
                  <div className="w-full py-8 flex flex-col items-center justify-center text-slate-300 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl gap-1">
                    <FileText size={24} className="text-slate-300 dark:text-slate-700" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Attachments Provided</p>
                  </div>
                )}
              </section>

              {/* Discussion & Feedback Thread */}
              <section className="space-y-4 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MessageSquare size={12} className="text-indigo-500" />
                    Discussion & Feedback ({Array.isArray(req.comments) ? req.comments.length : 0})
                  </h4>
                </div>
                
                <div className="space-y-4">
                  {/* Comments List */}
                  {Array.isArray(req.comments) && req.comments.length > 0 ? (
                    <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                      {req.comments.map((comment: any) => {
                        const isAuthor = comment.authorId === currentUser?.id || comment.authorEmail?.toLowerCase() === currentUser?.email?.toLowerCase();
                        const canDelete = isAuthor || currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";
                        
                        // Can edit if author and within 15 minutes of posting
                        const diffMs = Date.now() - new Date(comment.timestamp).getTime();
                        const canEdit = isAuthor && (diffMs / 60000 <= 15);
                        
                        const commentUser = users.find(u => 
                          (u.id && u.id === comment.authorId) || 
                          (u.email && comment.authorEmail && u.email.toLowerCase() === comment.authorEmail.toLowerCase())
                        );

                        let displayName = "";
                        if (isAuthor && currentUser?.name) {
                          displayName = currentUser.name;
                        } else if (commentUser?.name) {
                          displayName = commentUser.name;
                        } else if (comment.authorName && comment.authorName !== "Member" && comment.authorName !== "System User") {
                          displayName = comment.authorName;
                        } else if (comment.authorEmail) {
                          const emailPrefix = comment.authorEmail.split('@')[0];
                          displayName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1).replace(/[._-]/g, ' ');
                        } else if (currentUser?.name) {
                          displayName = currentUser.name;
                        } else {
                          displayName = "Church Officer";
                        }

                        const initials = displayName ? displayName.charAt(0).toUpperCase() : "C";

                        return (
                          <div 
                            key={comment.id}
                            className="flex items-start gap-3 bg-slate-50/50 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-150 dark:border-slate-800/80 group transition-all"
                          >
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900 font-bold text-xs flex items-center justify-center shrink-0 animate-in zoom-in duration-200">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                                    {isAuthor ? `You (${displayName})` : displayName}
                                  </span>
                                  {comment.authorRole && (
                                    <span className={cn(
                                      "px-1.5 py-0.2 rounded text-[7.5px] font-extrabold uppercase tracking-wider border",
                                      getRoleBadgeColor(comment.authorRole)
                                    )}>
                                      {comment.authorRole.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-slate-400 font-medium">
                                    {formatDate(comment.timestamp)}
                                  </span>
                                  {comment.isEdited && (
                                    <span className="text-[8px] text-slate-400 dark:text-slate-500 italic bg-slate-100/80 dark:bg-slate-800/50 px-1 py-0.2 rounded border border-slate-200/50 dark:border-slate-700/40">
                                      edited
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {editingCommentId === comment.id ? (
                                <div className="space-y-2 w-full mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                                  <textarea
                                    value={editingCommentText}
                                    onChange={(e) => setEditingCommentText(e.target.value)}
                                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100"
                                    rows={2}
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setEditingCommentText("");
                                      }}
                                      className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-750 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                    >
                                      <X size={10} />
                                      <span>Cancel</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateComment(comment.id, editingCommentText)}
                                      className="px-2.5 py-1 text-[10px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-sm hover:shadow"
                                    >
                                      <Check size={10} />
                                      <span>Save</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap pr-4">
                                  {renderFormattedCommentText(comment.text)}
                                </p>
                              )}
                            </div>
                            
                            {/* Action Button Controls */}
                            {editingCommentId !== comment.id && (canEdit || canDelete) && (
                              <div className="flex items-center gap-0.5 shrink-0 select-none opacity-60 group-hover:opacity-100 transition-opacity">
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setEditingCommentText(comment.text);
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center"
                                    title="Edit comment (First 15m)"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer flex items-center justify-center"
                                    title="Delete comment"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                      <MessageSquare size={20} className="mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest leading-none">No comments posted yet</p>
                      <p className="text-[9px] text-slate-400/80 mt-1 uppercase">Leave a comment or ask for info below.</p>
                    </div>
                  )}

                  {/* Add Comment Input Form */}
                  <div className="relative">
                    {/* Mention Suggestions Popover */}
                    {mentionSearch !== null && filteredMentionUsers.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl z-50 overflow-hidden max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/45 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                          <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">Mention User</span>
                          <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded uppercase">Matching: {mentionSearch}</span>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
                          {filteredMentionUsers.map(u => {
                            const initials = (u.name || u.email || "?").charAt(0).toUpperCase();
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => insertMention(u)}
                                className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group cursor-pointer"
                              >
                                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-250 dark:border-slate-700/80 font-bold text-xs flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-150 dark:group-hover:bg-indigo-950/40 dark:group-hover:text-indigo-300 dark:group-hover:border-indigo-900/60 transition-all shrink-0">
                                  {initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate">
                                      {u.name}
                                    </p>
                                    <span className="text-[7.5px] px-1 py-0.2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-extrabold uppercase shrink-0">
                                      {u.role}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                    {u.email}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2.5 items-end bg-white dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                      <textarea
                        ref={commentTextareaRef}
                        value={commentText}
                        onChange={handleCommentTextareaChange}
                        placeholder="Discuss this requisition, leave feedback, or use @name to tag a team member..."
                        rows={2}
                        className="flex-1 px-3 py-2 text-xs bg-transparent border-0 focus:outline-none resize-none text-slate-800 dark:text-slate-100 placeholder-slate-450 focus:ring-0 min-h-[42px]"
                        onKeyDown={(e) => {
                          if (e.key === "Escape" && mentionSearch !== null) {
                            e.preventDefault();
                            setMentionSearch(null);
                            setMentionIndex(-1);
                          } else if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleAddComment();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddComment()}
                        disabled={isSubmittingComment || !commentText.trim()}
                        className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 dark:disabled:bg-indigo-950 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-sm hover:shadow cursor-pointer"
                      >
                        {isSubmittingComment ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Decision Form integration */}
              {showDecisionForm && (
                <motion.div 
                  ref={decisionFormRef}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={cn(
                    "p-4 md:p-6 rounded-2xl border bg-slate-50",
                    showDecisionForm === "APPROVE" ? "border-emerald-100" : showDecisionForm === "REJECT" ? "border-rose-100" : "border-amber-100"
                  )}
                >
                  <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest mb-4">
                    {showDecisionForm === "APPROVE" ? "Approve Transaction" : showDecisionForm === "REJECT" ? "Reject Transaction" : "Escalate Transaction"}
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        {showDecisionForm === "REJECT" ? "Reason For Rejection (Optional)" : showDecisionForm === "APPROVE" ? "Reason For Approval (Optional)" : "Reason For Escalation (Optional)"}
                      </label>
                      <textarea 
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        className="input-field bg-white text-xs"
                        placeholder={showDecisionForm === "REJECT" ? "Enter reason for rejection if any..." : "Provide reasoning if any..."}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                       <button 
                        onClick={() => setShowDecisionForm(null)}
                        className="px-4 md:px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button 
                        disabled={loading}
                        onClick={() => handleDecision(showDecisionForm)}
                        className={cn(
                          "btn-primary px-5 md:px-8 flex items-center gap-2",
                          showDecisionForm === "REJECT" ? "bg-rose-600 hover:bg-rose-700" : 
                          showDecisionForm === "ESCALATE" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : ""
                        )}
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span className="text-[10px] md:text-xs">CONFIRM</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Sidebar - History & Status */}
            <div className="bg-slate-50/50 p-6 md:p-8 space-y-6 md:space-y-8 lg:h-full lg:overflow-y-auto h-auto overflow-visible">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] md:text-[11px] font-black text-slate-800 uppercase tracking-widest">History & Audit Timeline</h4>
                  <span className="text-[8px] font-mono font-bold bg-slate-200/50 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider">{getConsolidatedTimeline().length} events</span>
                </div>
                <div className="space-y-6 relative ml-1">
                  {/* Vertical Timeline Connector Line */}
                  <div className="absolute left-3.5 top-3.5 bottom-3.5 w-[2px] bg-slate-200 rounded-full" />
                  
                  {getConsolidatedTimeline().map((event) => {
                    let StepIcon = Activity;
                    let cardColor = "blue";
                    
                    if (event.type === "CREATED") {
                      StepIcon = User;
                      cardColor = "blue";
                    } else if (event.type === "L1_APPROVED") {
                      StepIcon = ShieldCheck;
                      cardColor = "teal";
                    } else if (event.type === "L2_APPROVED") {
                      StepIcon = ShieldCheck;
                      cardColor = "indigo";
                    } else if (event.type === "DISBURSED") {
                      StepIcon = Coins;
                      cardColor = "emerald";
                    } else if (event.type === "REJECTED") {
                      StepIcon = XCircle;
                      cardColor = "rose";
                    } else if (event.type === "ESCALATED") {
                      StepIcon = AlertTriangle;
                      cardColor = "amber";
                    } else {
                      StepIcon = Activity;
                      cardColor = "slate";
                    }

                    // Security Method details
                    let methodLabel = "System authorization protocol";
                    let MethodIcon = Activity;
                    if (event.method === "CODE") {
                      methodLabel = "Secure passcode verified";
                      MethodIcon = KeyRound;
                    } else if (event.method === "FINGERPRINT") {
                      methodLabel = "Biometric authenticated";
                      MethodIcon = Fingerprint;
                    } else if (event.method === "SIGNATURE") {
                      methodLabel = "Cryptographic signature signed";
                      MethodIcon = FileSignature;
                    }

                    return (
                      <div key={event.id} className="relative pl-9 group">
                        {/* Circle badge marker with icon */}
                        <div className={cn(
                          "absolute left-0 top-1 w-7.5 h-7.5 rounded-full border-2 border-white flex items-center justify-center ring-4 transition-transform group-hover:scale-105 shadow-sm z-10",
                          cardColor === "blue" ? "bg-blue-50 text-blue-650 border-blue-200 ring-blue-50/50" :
                          cardColor === "teal" ? "bg-teal-50 text-teal-650 border-teal-200 ring-teal-50/50" :
                          cardColor === "indigo" ? "bg-indigo-50 text-indigo-650 border-indigo-200 ring-indigo-50/50" :
                          cardColor === "emerald" ? "bg-emerald-50 text-emerald-650 border-emerald-250 ring-emerald-50/50" :
                          cardColor === "rose" ? "bg-rose-50 text-rose-650 border-rose-200 ring-rose-50/50" :
                          cardColor === "amber" ? "bg-amber-50 text-amber-650 border-amber-200 ring-amber-50/50" :
                          "bg-slate-50 text-slate-500 border-slate-200 ring-slate-50/50"
                        )}>
                          <StepIcon size={13} className="stroke-[2.5]" />
                        </div>
                        
                        <div>
                          <p className="text-[9px] md:text-[10px] font-semibold text-slate-400 mb-0.5">{formatDate(event.timestamp)}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <h5 className="text-[11px] font-extrabold text-slate-900 leading-tight uppercase tracking-tight">{event.title}</h5>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                              cardColor === "blue" ? "bg-blue-100 text-blue-850" :
                              cardColor === "teal" ? "bg-teal-100 text-teal-855" :
                              cardColor === "indigo" ? "bg-indigo-100 text-indigo-855" :
                              cardColor === "emerald" ? "bg-emerald-100 text-emerald-855" :
                              cardColor === "rose" ? "bg-rose-100 text-rose-855" :
                              cardColor === "amber" ? "bg-amber-100 text-amber-855" :
                              "bg-slate-100 text-slate-855"
                            )}>
                              {event.type}
                            </span>
                            {event.role && (
                              <span className="px-1 py-0.5 bg-slate-100 text-slate-500 rounded text-[6.5px] font-black uppercase tracking-wider">
                                {event.role.split('_').pop()?.replace(')', '')}
                              </span>
                            )}
                          </div>

                          <div className={cn(
                            "p-3 rounded-xl border space-y-2 bg-white transition-all shadow-sm",
                            cardColor === "blue" ? "hover:border-blue-200" :
                            cardColor === "teal" ? "hover:border-teal-200" :
                            cardColor === "indigo" ? "hover:border-indigo-200" :
                            cardColor === "emerald" ? "hover:border-emerald-200" :
                            cardColor === "rose" ? "hover:border-rose-200" :
                            cardColor === "amber" ? "hover:border-amber-200" :
                            "hover:border-slate-200"
                          )}>
                            <div className="flex items-center justify-between text-[9px] border-b border-slate-50 pb-1.5">
                              <span className="font-medium text-slate-405">Operator:</span>
                              <span className="font-extrabold text-slate-800">{event.actorName}</span>
                            </div>

                            {/* Authentication and security info (only for non-created, non-legacy generic steps) */}
                            {event.type !== "CREATED" && (event.method || event.approvalCode) && (
                              <div className="flex items-center justify-between text-[8px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <MethodIcon size={10} className="text-slate-400" />
                                  {methodLabel}
                                </span>
                                {event.approvalCode && (
                                  <span className="font-mono bg-slate-50 px-1 py-0.5 rounded text-slate-500 font-extrabold uppercase tracking-wide">
                                    Auth block verified
                                  </span>
                                )}
                              </div>
                            )}

                            {event.type === "CREATED" && (
                              <div className="flex items-center justify-between text-[8px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Activity size={10} className="text-slate-400" />
                                  Requisition initiated and ready for approvals
                                </span>
                              </div>
                            )}

                            {/* Event text note or comments */}
                            {event.note && (
                              <div className="pt-2 border-t border-slate-50">
                                <p className="text-[9px] md:text-[9.5px] text-slate-600 leading-relaxed italic bg-emerald-50/15 p-2 rounded-lg border border-slate-100">
                                  "{event.note}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="pt-6 md:pt-8 border-t border-slate-200/60 space-y-4">
                 <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata</h4>
                 <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><Users size={13} className="text-primary shrink-0" /> Church Group</span>
                      <span className="font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded transition-all uppercase tracking-wider text-[9px] truncate max-w-[150px]">{req.groupName || "N/A"}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><CalendarDays size={13} /> Submitted</span>
                      <span className="font-bold text-slate-700">{formatDate(req.submittedAt)}</span>
                    </div>
                    {formatRequisitionAge(req.submittedAt || req.createdAt, req.status) && (
                      <div className="flex items-center justify-between text-[10px] md:text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5"><Clock size={13} /> Days Old</span>
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                          {formatRequisitionAge(req.submittedAt || req.createdAt, req.status)}
                        </span>
                      </div>
                    )}
                    {req.recurrence && req.recurrence !== "NONE" && (
                      <div className="flex items-center justify-between text-[10px] md:text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5"><Repeat size={13} /> Recurrence</span>
                        <span className="font-black text-primary uppercase tracking-widest">{req.recurrence}</span>
                      </div>
                    )}
                 </div>
              </section>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-6 md:px-8 py-3 md:py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row gap-3 md:gap-4 justify-between items-center max-w-full overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-start overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-none shrink-0">
            <button 
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="p-2 sm:p-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-500 rounded-xl transition-all border border-slate-100 dark:border-slate-800 md:border-0 shrink-0"
              title="Delete Document"
            >
              <Trash2 size={16} />
            </button>
            {onEdit && req.status !== RequisitionStatus.REJECTED && (
              currentUser?.role === UserRole.ADMIN ||
              currentUser?.role === UserRole.SUPER_ADMIN ||
              (req.status === RequisitionStatus.DRAFT && req.requesterId === currentUser?.id)
            ) && (
              <button 
                onClick={onEdit}
                className="p-2 sm:p-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-slate-400 hover:text-amber-500 rounded-xl transition-all border border-slate-100 dark:border-slate-800 md:border-0 shrink-0"
                title="Edit Requisition details"
              >
                <Pencil size={16} />
              </button>
            )}
            {currentUser?.role === UserRole.ADMIN && (
              <button 
                onClick={handleToggleAuditFlag}
                className={cn(
                  "p-2 sm:p-2.5 rounded-xl transition-all border border-slate-100 dark:border-slate-800 md:border-0 flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider shrink-0",
                  req.flaggedForAudit 
                    ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100" 
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                )}
                title={req.flaggedForAudit ? "Remove Flag for Audit" : "Flag for Audit"}
              >
                <Flag size={16} className={req.flaggedForAudit ? "fill-rose-600" : ""} />
                <span className="hidden sm:inline">{req.flaggedForAudit ? "Flagged" : "Audit"}</span>
              </button>
            )}
            <button 
              onClick={onGenerateReceipt}
              className="p-2 sm:p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary rounded-xl transition-all border border-slate-100 dark:border-slate-800 md:border-0 shrink-0" 
              title="Generate Receipt Template"
            >
              <FileText size={16} />
            </button>
            <button 
              onClick={() => printRequisitionReceipt(req)}
              className="p-2 sm:p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-primary rounded-xl transition-all border border-slate-100 dark:border-slate-800 md:border-0 shrink-0" 
              title="Print Formal Receipt"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={handleCopyDetails}
              className="p-2 sm:p-2.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-primary rounded-xl transition-all border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider shrink-0" 
              title="Copy Requisition Details"
            >
              <Copy size={16} />
              <span className="hidden sm:inline">Copy Details</span>
            </button>
            <button 
              onClick={handleCopyShareLink}
              className="p-2 sm:p-2.5 bg-indigo-50/50 dark:bg-indigo-950/40 hover:bg-indigo-100/80 text-indigo-600 dark:text-indigo-400 hover:text-primary rounded-xl transition-all border border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider shrink-0" 
              title="Copy Direct Shareable Link"
            >
              <Share2 size={16} />
              <span className="hidden sm:inline">Share Link</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto shrink-0 justify-end flex-wrap sm:flex-nowrap">
             <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-3.5 md:px-8 py-2.5 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[9px] md:text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer uppercase tracking-widest"
            >
              EXIT
            </button>
            
            {!showDecisionForm && canAct() && (
              <div className="flex flex-1 md:flex-none items-center gap-1.5 md:gap-2">
                {req.status !== RequisitionStatus.DISBURSED && (
                  <button 
                    onClick={() => setShowDecisionForm("REJECT")}
                    className="flex-1 md:flex-none px-2.5 sm:px-6 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 rounded-xl text-[9px] md:text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer uppercase tracking-widest"
                  >
                    REJECT
                  </button>
                )}
                {req.status === RequisitionStatus.SUBMITTED && (
                  <>
                    <button 
                      onClick={() => setShowDecisionForm("ESCALATE")}
                      className="flex-1 md:flex-none px-2.5 sm:px-6 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 rounded-xl text-[9px] md:text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer uppercase tracking-widest"
                    >
                      ESCALATE
                    </button>
                    <button 
                      disabled={loading}
                      onClick={() => handleDecision("APPROVE")}
                      className="flex-1 md:flex-none px-2.5 sm:px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none disabled:opacity-50"
                    >
                      APPROVE
                    </button>
                  </>
                )}
                {(req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED) && (
                   <button 
                     disabled={loading}
                     onClick={() => handleDecision("APPROVE")}
                     className="flex-1 md:flex-none px-2.5 sm:px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none disabled:opacity-50"
                   >
                     APPROVE L2
                   </button>
                )}
              </div>
            )}

            {req.status === RequisitionStatus.APPROVED_L2 && (
               <button 
                 onClick={() => {
                   setIsGroupVerified(false);
                   setIsAmountVerified(false);
                   setShowAssignConfirm(true);
                 }}
                 className="flex-1 md:flex-none px-4 sm:px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none"
               >
                ASSIGN TO BUDGET
              </button>
            )}
          </div>
        </div>

        <ConfirmationModal
          isOpen={showAssignConfirm}
          title="Verify Budget Assignment"
          message={`Are you sure you want to assign and move this requisition to the active budget pool? This will deduct the funds from the group's active allocation.`}
          confirmText="YES, ASSIGN NOW"
          confirmDisabled={!isGroupVerified || !isAmountVerified}
          onConfirm={async () => {
             setShowAssignConfirm(false);
             try {
               // Assign to matching budget project if missing
               let targetProjectId = req.projectId;
               if (!targetProjectId) {
                 const match = projects.find(p => p.groupId === req.groupName || p.name === req.groupName);
                 if (match) {
                   targetProjectId = match.id;
                   await updateRequisition(req.id, { projectId: match.id });
                 }
               }

               await updateRequisitionStatus(req.id, RequisitionStatus.DISBURSED, "APPROVE");
               
               alert(`Requisition successfully assigned to Budget Pool${targetProjectId ? ' and allocations deducted.' : '.'}`);
             } catch (err: any) {
               alert("Failed to assign to budget: " + err.message);
             }
          }}
          onCancel={() => setShowAssignConfirm(false)}
        >
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Double-Verification Safety Check</p>
            
            <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={isGroupVerified}
                onChange={(e) => setIsGroupVerified(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 mt-0.5 shrink-0"
              />
              <span>I verify destination Ministry/Group is: <strong className="text-indigo-600 block text-[11px] uppercase tracking-wide">{req.groupName}</strong></span>
            </label>

            <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none border-t border-slate-200/60 pt-2">
              <input 
                type="checkbox"
                checked={isAmountVerified}
                onChange={(e) => setIsAmountVerified(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 mt-0.5 shrink-0"
              />
              <span>I verify transaction amount is correct: <strong className="text-indigo-600 block text-[11px] font-mono">KES {req.amount.toLocaleString()}</strong></span>
            </label>
          </div>
        </ConfirmationModal>

        {/* Document Preview Overlay */}
        <AnimatePresence>
          {previewIndex !== null && normalizedAttachments.length > 0 && (
            <DocumentPreviewModal 
              attachments={normalizedAttachments}
              initialIndex={previewIndex}
              onClose={() => setPreviewIndex(null)} 
              requisition={req}
            />
          )}
          {isCameraOpen && (
            <CameraCapture 
              onCapture={handleCaptureReceipt} 
              onClose={() => setIsCameraOpen(false)} 
            />
          )}
        </AnimatePresence>
      </motion.div>
    );

    if (isPage) {
      return mainContent;
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
        {mainContent}
      </div>
    );
  };
