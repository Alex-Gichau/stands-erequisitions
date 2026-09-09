/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { 
  Images, 
  Search, 
  Filter, 
  Grid, 
  List, 
  Download, 
  ExternalLink, 
  Cast, 
  Copy, 
  Check, 
  Upload, 
  Plus, 
  Trash2, 
  RefreshCw, 
  FileText, 
  FileSpreadsheet, 
  Calendar, 
  Tag, 
  Building2, 
  Layers, 
  Maximize2, 
  Share2, 
  Printer, 
  SlidersHorizontal, 
  CheckSquare, 
  Square, 
  X, 
  Camera, 
  AlertCircle,
  FileCheck2,
  FolderOpen,
  ArrowUpDown,
  Sparkles,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { Requisition, UserRole, RequisitionStatus } from "../types";
import { 
  cn, 
  normalizeAttachmentUrl, 
  getAttachmentFileName, 
  getAbsoluteAttachmentUrl,
  formatCurrency, 
  formatDate,
  handleImageError
} from "../lib/utils";
import { CachedImage } from "./CachedImage";
import { PdfThumbnailPreview } from "./PdfThumbnailPreview";
import { AttachmentProjectionModal } from "./AttachmentProjectionModal";
import { CameraCapture } from "./CameraCapture";
import { processFileToAttachmentStrings } from "../lib/pdfUtils";

export type UploadCategory = "ALL" | "RECEIPT" | "INVOICE" | "QUOTATION" | "DELIVERY" | "MEMO" | "OTHER";
export type FileFormatFilter = "ALL" | "IMAGE" | "PDF" | "SPREADSHEET" | "DOCUMENT";
export type SortOption = "NEWEST" | "OLDEST" | "TITLE_AZ" | "GROUP_AZ" | "AMOUNT_HIGH";

export interface GalleryItem {
  id: string;
  url: string;
  fileName: string;
  fileType: "image" | "pdf" | "spreadsheet" | "document" | "other";
  category: UploadCategory;
  date: string;
  sourceType: "REQUISITION_ATTACHMENT" | "REQUISITION_RECEIPT" | "DIRECT_UPLOAD" | "COMMENT_ATTACHMENT";
  requisition?: Requisition | null;
  requisitionId?: string;
  requisitionTitle?: string;
  groupName?: string;
  amount?: number;
  status?: RequisitionStatus;
  notes?: string;
  rawSize?: string;
}

interface UploadsGalleryPanelProps {
  onViewRequisition?: (req: Requisition) => void;
  onClose?: () => void;
}

export const UploadsGalleryPanel: React.FC<UploadsGalleryPanelProps> = ({
  onViewRequisition,
  onClose
}) => {
  const { 
    requisitions, 
    churchGroups, 
    currentUser, 
    triggerToast,
    setSelectedRequisition
  } = useRequisitions();

  // View & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<UploadCategory>("ALL");
  const [selectedFormat, setSelectedFormat] = useState<FileFormatFilter>("ALL");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  
  // Selection & Projection State
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isProjectionOpen, setIsProjectionOpen] = useState(false);
  const [projectionInitialIndex, setProjectionInitialIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Direct Upload & Camera Staging State
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<UploadCategory>("RECEIPT");
  const [uploadTargetRequisitionId, setUploadTargetRequisitionId] = useState<string>("");
  const [localDirectUploads, setLocalDirectUploads] = useState<GalleryItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("stands_uploads_gallery_custom");
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync direct uploads to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("stands_uploads_gallery_custom", JSON.stringify(localDirectUploads));
      } catch (e) {
        console.warn("Could not sync direct uploads to localStorage", e);
      }
    }
  }, [localDirectUploads]);

  // Helper to deduce category from filename and source
  const inferCategory = (fileName: string, isReceiptSource: boolean): UploadCategory => {
    if (isReceiptSource) return "RECEIPT";
    const lower = fileName.toLowerCase();
    if (lower.includes("receipt") || lower.includes("rcpt") || lower.includes("mpesa") || lower.includes("slip") || lower.includes("payment")) return "RECEIPT";
    if (lower.includes("invoice") || lower.includes("tax") || lower.includes("bill") || lower.includes("kra") || lower.includes("etims")) return "INVOICE";
    if (lower.includes("quote") || lower.includes("quotation") || lower.includes("lpo") || lower.includes("proforma") || lower.includes("bid")) return "QUOTATION";
    if (lower.includes("delivery") || lower.includes("dispatch") || lower.includes("waybill") || lower.includes("grn")) return "DELIVERY";
    if (lower.includes("memo") || lower.includes("approval") || lower.includes("minute") || lower.includes("letter") || lower.includes("resolution")) return "MEMO";
    return "OTHER";
  };

  // Helper to deduce file format type
  const inferFormat = (url: string, fileName: string): "image" | "pdf" | "spreadsheet" | "document" | "other" => {
    const lower = (fileName || url).toLowerCase();
    if (lower.endsWith(".pdf") || url.startsWith("data:application/pdf")) return "pdf";
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || url.startsWith("data:image/")) return "image";
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv") || url.includes("spreadsheet") || url.includes("csv")) return "spreadsheet";
    if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "document";
    return "other";
  };

  // Build Master Aggregation of all uploads across the system
  const masterUploadsList = useMemo<GalleryItem[]>(() => {
    const items: GalleryItem[] = [];
    const seenUrls = new Set<string>();

    // 1. Process Requisition Attachments and Receipts
    (requisitions || []).forEach((req) => {
      // (a) Main Attachments
      const rawAttachments = Array.isArray(req.attachments) 
        ? req.attachments 
        : (req.attachments ? [req.attachments] : []);

      rawAttachments.forEach((att, idx) => {
        if (!att || typeof att !== "string") return;
        const normalized = normalizeAttachmentUrl(att);
        if (!normalized || seenUrls.has(normalized)) return;
        seenUrls.add(normalized);

        const fileName = getAttachmentFileName(normalized);
        const category = inferCategory(fileName, false);
        const fileType = inferFormat(normalized, fileName);

        items.push({
          id: `req-${req.id}-att-${idx}`,
          url: normalized,
          fileName: fileName || `${req.id}_doc_${idx + 1}`,
          fileType,
          category,
          date: req.createdAt || new Date().toISOString(),
          sourceType: "REQUISITION_ATTACHMENT",
          requisition: req,
          requisitionId: req.id,
          requisitionTitle: req.title,
          groupName: req.groupName || "Diocese Ministry",
          amount: req.amount,
          status: req.status
        });
      });

      // (b) Audited Receipts
      const rawReceipts = Array.isArray(req.receipts) 
        ? req.receipts 
        : (req.receipts ? [req.receipts] : []);

      rawReceipts.forEach((rcpt, idx) => {
        if (!rcpt || typeof rcpt !== "string") return;
        const normalized = normalizeAttachmentUrl(rcpt);
        if (!normalized || seenUrls.has(normalized)) return;
        seenUrls.add(normalized);

        const fileName = getAttachmentFileName(normalized);
        const fileType = inferFormat(normalized, fileName);

        items.push({
          id: `req-${req.id}-rcpt-${idx}`,
          url: normalized,
          fileName: fileName || `${req.id}_receipt_${idx + 1}`,
          fileType,
          category: "RECEIPT",
          date: req.updatedAt || req.createdAt || new Date().toISOString(),
          sourceType: "REQUISITION_RECEIPT",
          requisition: req,
          requisitionId: req.id,
          requisitionTitle: req.title,
          groupName: req.groupName || "Diocese Ministry",
          amount: req.amount,
          status: req.status
        });
      });

      // (c) Comments attachments if any
      (req.comments || []).forEach((c, cIdx) => {
        if (Array.isArray(c.attachments)) {
          c.attachments.forEach((cAtt, cAttIdx) => {
            if (!cAtt) return;
            const normalized = normalizeAttachmentUrl(typeof cAtt === "string" ? cAtt : (cAtt.url || ""));
            if (normalized && !seenUrls.has(normalized)) {
              seenUrls.add(normalized);
              const fileName = getAttachmentFileName(normalized);
              items.push({
                id: `req-${req.id}-comment-${cIdx}-${cAttIdx}`,
                url: normalized,
                fileName: fileName || `${req.id}_comment_doc`,
                fileType: inferFormat(normalized, fileName),
                category: inferCategory(fileName, false),
                date: c.createdAt || req.createdAt || new Date().toISOString(),
                sourceType: "COMMENT_ATTACHMENT",
                requisition: req,
                requisitionId: req.id,
                requisitionTitle: req.title,
                groupName: req.groupName || "Diocese Ministry",
                amount: req.amount,
                status: req.status
              });
            }
          });
        }
      });
    });

    // 2. Process Local Direct Uploads
    localDirectUploads.forEach((directItem) => {
      if (directItem.url && !seenUrls.has(directItem.url)) {
        seenUrls.add(directItem.url);
        items.push(directItem);
      }
    });

    return items;
  }, [requisitions, localDirectUploads]);

  // Filter and Search Logic
  const filteredUploads = useMemo(() => {
    return masterUploadsList.filter((item) => {
      // Category filter
      if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
        return false;
      }

      // File format filter
      if (selectedFormat !== "ALL") {
        if (selectedFormat === "IMAGE" && item.fileType !== "image") return false;
        if (selectedFormat === "PDF" && item.fileType !== "pdf") return false;
        if (selectedFormat === "SPREADSHEET" && item.fileType !== "spreadsheet") return false;
        if (selectedFormat === "DOCUMENT" && item.fileType !== "document") return false;
      }

      // Group filter
      if (selectedGroup !== "ALL" && item.groupName !== selectedGroup) {
        return false;
      }

      // Status filter
      if (selectedStatus !== "ALL" && item.status !== selectedStatus) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.fileName.toLowerCase().includes(query);
        const matchReqId = item.requisitionId?.toLowerCase().includes(query) || false;
        const matchReqTitle = item.requisitionTitle?.toLowerCase().includes(query) || false;
        const matchGroup = item.groupName?.toLowerCase().includes(query) || false;
        const matchCategory = item.category.toLowerCase().includes(query);
        if (!matchName && !matchReqId && !matchReqTitle && !matchGroup && !matchCategory) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "NEWEST") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === "OLDEST") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === "TITLE_AZ") {
        return a.fileName.localeCompare(b.fileName);
      }
      if (sortBy === "GROUP_AZ") {
        return (a.groupName || "").localeCompare(b.groupName || "");
      }
      if (sortBy === "AMOUNT_HIGH") {
        return (b.amount || 0) - (a.amount || 0);
      }
      return 0;
    });
  }, [masterUploadsList, selectedCategory, selectedFormat, selectedGroup, selectedStatus, searchQuery, sortBy]);

  // Distinct groups for filter dropdown
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    masterUploadsList.forEach((item) => {
      if (item.groupName) groups.add(item.groupName);
    });
    return Array.from(groups).sort();
  }, [masterUploadsList]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = masterUploadsList.length;
    const images = masterUploadsList.filter(i => i.fileType === "image").length;
    const pdfs = masterUploadsList.filter(i => i.fileType === "pdf").length;
    const receipts = masterUploadsList.filter(i => i.category === "RECEIPT").length;
    const invoices = masterUploadsList.filter(i => i.category === "INVOICE").length;
    const quotations = masterUploadsList.filter(i => i.category === "QUOTATION").length;
    return { total, images, pdfs, receipts, invoices, quotations };
  }, [masterUploadsList]);

  // Handle Multi-selection
  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    if (selectedItemIds.size === filteredUploads.length && filteredUploads.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredUploads.map(i => i.id)));
    }
  };

  // Launch Projection Modal
  const handleOpenProjection = (initialIndex: number = 0) => {
    setProjectionInitialIndex(initialIndex);
    setIsProjectionOpen(true);
  };

  // Projection attachment URLs list
  const projectionAttachmentsList = useMemo(() => {
    if (selectedItemIds.size > 0) {
      return filteredUploads.filter(i => selectedItemIds.has(i.id)).map(i => i.url);
    }
    return filteredUploads.map(i => i.url);
  }, [filteredUploads, selectedItemIds]);

  // Copy URI Helper
  const handleCopyUri = (item: GalleryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const uri = item.url;
    navigator.clipboard.writeText(uri);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
    triggerToast?.({
      type: "SYSTEM_INFO",
      message: `Copied link for "${item.fileName}"`,
      severity: "LOW",
      timestamp: new Date().toISOString()
    });
  };

  // Trigger File Download
  const handleDownload = (item: GalleryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const a = document.createElement("a");
      a.href = item.url;
      a.download = item.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      triggerToast?.({
        type: "SYSTEM_INFO",
        message: `Starting download of ${item.fileName}`,
        severity: "LOW",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  // Batch Download
  const handleBatchDownload = () => {
    const itemsToDownload = filteredUploads.filter(i => selectedItemIds.has(i.id));
    if (itemsToDownload.length === 0) return;
    
    itemsToDownload.forEach((item, idx) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = item.url;
        a.download = item.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 300);
    });

    triggerToast?.({
      type: "SYSTEM_INFO",
      message: `Downloading ${itemsToDownload.length} selected files`,
      severity: "LOW",
      timestamp: new Date().toISOString()
    });
  };

  // Handle Direct File Uploads
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processUploadedFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processUploadedFiles = async (fileList: File[]) => {
    setIsUploading(true);
    const newItems: GalleryItem[] = [];

    for (const file of fileList) {
      try {
        const formattedArray = await processFileToAttachmentStrings(file);
        const formattedStr = formattedArray[0] || "";
        let dataUrl = formattedStr;

        // Attempt server upload
        try {
          const res = await fetch("/api/attachments/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: formattedStr,
              fileName: file.name,
              fileType: file.type
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.url) dataUrl = data.url;
          }
        } catch (serverErr) {
          console.warn("Direct upload fallback to client storage:", serverErr);
        }

        const linkedReq = uploadTargetRequisitionId 
          ? requisitions?.find(r => r.id === uploadTargetRequisitionId) 
          : null;

        const newItem: GalleryItem = {
          id: `direct-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          url: dataUrl,
          fileName: file.name,
          fileType: inferFormat(dataUrl, file.name),
          category: uploadCategory,
          date: new Date().toISOString(),
          sourceType: "DIRECT_UPLOAD",
          requisition: linkedReq,
          requisitionId: linkedReq?.id,
          requisitionTitle: linkedReq?.title,
          groupName: linkedReq?.groupName || currentUser?.group || "General Parish Uploads",
          amount: linkedReq?.amount,
          status: linkedReq?.status,
          rawSize: `${(file.size / 1024).toFixed(1)} KB`
        };

        newItems.push(newItem);
      } catch (err) {
        console.error("Failed to process file:", file.name, err);
      }
    }

    if (newItems.length > 0) {
      setLocalDirectUploads(prev => [...newItems, ...prev]);
      setIsUploadDrawerOpen(false);
      triggerToast?.({
        type: "SYSTEM_INFO",
        message: `Successfully added ${newItems.length} document(s) to Uploads Gallery`,
        severity: "LOW",
        timestamp: new Date().toISOString()
      });
    }

    setIsUploading(false);
  };

  const handleCameraCapture = async (file: File) => {
    setIsCameraActive(false);
    await processUploadedFiles([file]);
  };

  return (
    <div id="uploads-gallery-panel" className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-inner">
            <Images className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Uploads Gallery
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                {masterUploadsList.length} Uploads
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Central repository of all receipts, tax invoices, vouchers, and requisition attachments with built-in theater projection.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <button
            type="button"
            onClick={() => handleOpenProjection(0)}
            disabled={filteredUploads.length === 0}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            title="Launch full-screen projection / slideshow of all files"
          >
            <Cast className="w-4 h-4" />
            <span>Projector View</span>
          </button>

          <button
            type="button"
            onClick={() => setIsUploadDrawerOpen(true)}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 border border-slate-700/50 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Documents</span>
          </button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Uploads</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.total}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider block">Scanned Receipts</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.receipts}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-wider block">Tax Invoices</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.invoices}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black text-purple-500 uppercase tracking-wider block">PDF Documents</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.pdfs}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider block">Image Vouchers</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.images}</div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block">Quotations & LPOs</span>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{metrics.quotations}</div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & View Toggle */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search uploads by file name, requisition ID, ministry, category..."
              className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Group & Sorting Dropdowns */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {/* Ministry Group */}
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="ALL">All Groups</option>
              {availableGroups.map((grp) => (
                <option key={grp} value={grp}>{grp}</option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="TITLE_AZ">File Name (A-Z)</option>
              <option value="GROUP_AZ">Ministry (A-Z)</option>
              <option value="AMOUNT_HIGH">Amount (Highest)</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded-xl transition-all cursor-pointer",
                  viewMode === "grid" 
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                )}
                title="Bento Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-1.5 rounded-xl transition-all cursor-pointer",
                  viewMode === "table" 
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                )}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category & Format Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL", label: "All Categories" },
              { id: "RECEIPT", label: "Receipts" },
              { id: "INVOICE", label: "Invoices" },
              { id: "QUOTATION", label: "Quotations / LPOs" },
              { id: "DELIVERY", label: "Delivery Notes" },
              { id: "MEMO", label: "Memos" },
              { id: "OTHER", label: "Other" }
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as UploadCategory)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  selectedCategory === cat.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Format Chips */}
          <div className="flex items-center gap-1">
            {[
              { id: "ALL", label: "All Formats" },
              { id: "IMAGE", label: "Images" },
              { id: "PDF", label: "PDFs" },
              { id: "SPREADSHEET", label: "Excel" }
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setSelectedFormat(fmt.id as FileFormatFilter)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
                  selectedFormat === fmt.id
                    ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Selection Action Toolbar */}
      <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={selectAllFiltered}
            className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
          >
            {selectedItemIds.size > 0 && selectedItemIds.size === filteredUploads.length ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            <span>
              {selectedItemIds.size > 0 ? `Selected (${selectedItemIds.size})` : "Select All"}
            </span>
          </button>
          <span>•</span>
          <span>Showing {filteredUploads.length} of {masterUploadsList.length} files</span>
        </div>

        {selectedItemIds.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenProjection(0)}
              className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <Cast className="w-3.5 h-3.5" />
              <span>Project Selected ({selectedItemIds.size})</span>
            </button>
            <button
              type="button"
              onClick={handleBatchDownload}
              className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Selected</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedItemIds(new Set())}
              className="text-xs text-rose-500 hover:underline cursor-pointer ml-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {filteredUploads.length === 0 ? (
        <div className="w-full py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex flex-col items-center justify-center text-center p-6 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No uploads found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchQuery || selectedCategory !== "ALL" || selectedFormat !== "ALL"
                ? "Try clearing filters or search terms to see all documents."
                : "No files have been uploaded yet. Upload receipts or attachments to populate the gallery."}
            </p>
          </div>
          {(searchQuery || selectedCategory !== "ALL" || selectedFormat !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("ALL");
                setSelectedFormat("ALL");
                setSelectedGroup("ALL");
              }}
              className="px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Bento Grid Layout */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredUploads.map((item, idx) => {
            const isSelected = selectedItemIds.has(item.id);
            const isPdf = item.fileType === "pdf";
            const isImage = item.fileType === "image";

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                className={cn(
                  "group relative bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col shadow-sm hover:shadow-md",
                  isSelected 
                    ? "border-indigo-500 ring-2 ring-indigo-500/20 shadow-indigo-500/10" 
                    : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                {/* Media Preview Container */}
                <div 
                  onClick={() => handleOpenProjection(idx)}
                  className="relative aspect-4/3 w-full bg-slate-100 dark:bg-slate-950/80 overflow-hidden cursor-pointer flex items-center justify-center"
                >
                  {isPdf ? (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <PdfThumbnailPreview
                        url={item.url}
                        title={item.fileName}
                        className="w-full h-full object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-300"
                        showOverlayBadge={false}
                      />
                    </div>
                  ) : isImage ? (
                    <CachedImage
                      src={item.url}
                      alt={item.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-slate-400 bg-slate-100 dark:bg-slate-900">
                      {item.fileType === "spreadsheet" ? (
                        <FileSpreadsheet className="w-12 h-12 text-emerald-500 mb-2" />
                      ) : (
                        <FileText className="w-12 h-12 text-indigo-500 mb-2" />
                      )}
                      <span className="text-[11px] font-bold text-slate-500 truncate max-w-full px-2">
                        {item.fileName}
                      </span>
                    </div>
                  )}

                  {/* Top Overlay Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm pointer-events-auto",
                      item.category === "RECEIPT" && "bg-emerald-500/90 text-white",
                      item.category === "INVOICE" && "bg-blue-500/90 text-white",
                      item.category === "QUOTATION" && "bg-indigo-500/90 text-white",
                      item.category === "DELIVERY" && "bg-amber-500/90 text-white",
                      item.category === "MEMO" && "bg-purple-500/90 text-white",
                      item.category === "OTHER" && "bg-slate-800/90 text-white"
                    )}>
                      {item.category}
                    </span>

                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => toggleSelectItem(item.id, e)}
                      className={cn(
                        "w-7 h-7 rounded-xl flex items-center justify-center transition-all backdrop-blur-md pointer-events-auto cursor-pointer shadow-sm",
                        isSelected 
                          ? "bg-indigo-600 text-white" 
                          : "bg-black/30 hover:bg-black/50 text-white opacity-0 group-hover:opacity-100"
                      )}
                    >
                      {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : <Square className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Hover Quick Project Action Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                    <span className="px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <Cast className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Project View</span>
                    </span>
                  </div>
                </div>

                {/* Card Information Footer */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={item.fileName}>
                        {item.fileName}
                      </h4>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0 uppercase">
                        {item.fileType}
                      </span>
                    </div>

                    {/* Linked Requisition / Group Info */}
                    {item.requisition ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.requisition) {
                            setSelectedRequisition(item.requisition);
                            onViewRequisition?.(item.requisition);
                          }
                        }}
                        className="text-left group/req flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer w-full truncate"
                      >
                        <Building2 className="w-3 h-3 shrink-0 text-slate-400 group-hover/req:text-indigo-500" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {item.requisition.id}
                        </span>
                        <span className="text-slate-400 truncate">
                          • {item.groupName}
                        </span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
                        <Tag className="w-3 h-3 shrink-0" />
                        <span className="truncate">{item.groupName || "Parish Document"}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions & Timestamp Strip */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{formatDate(item.date)}</span>

                    <div className="flex items-center gap-1">
                      {/* Copy URI */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyUri(item, e)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title="Copy Attachment URI"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* Download */}
                      <button
                        type="button"
                        onClick={(e) => handleDownload(item, e)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title="Download File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Direct Project Trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProjection(idx);
                        }}
                        className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                        title="Launch Projector for this document"
                      >
                        <Cast className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Detailed Table List Layout */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <button onClick={selectAllFiltered} className="cursor-pointer">
                      {selectedItemIds.size > 0 && selectedItemIds.size === filteredUploads.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Preview</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Linked Requisition</th>
                  <th className="py-3 px-4">Ministry Group</th>
                  <th className="py-3 px-4">Date Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredUploads.map((item, idx) => {
                  const isSelected = selectedItemIds.has(item.id);
                  const isPdf = item.fileType === "pdf";
                  const isImage = item.fileType === "image";

                  return (
                    <tr 
                      key={item.id}
                      className={cn(
                        "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors",
                        isSelected && "bg-indigo-50/50 dark:bg-indigo-950/20"
                      )}
                    >
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => toggleSelectItem(item.id, e)}
                          className="cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Thumbnail */}
                      <td className="py-3 px-4">
                        <div 
                          onClick={() => handleOpenProjection(idx)}
                          className="w-12 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer flex items-center justify-center shrink-0"
                        >
                          {isPdf ? (
                            <PdfThumbnailPreview url={item.url} title={item.fileName} className="w-full h-full object-contain" />
                          ) : isImage ? (
                            <CachedImage src={item.url} alt={item.fileName} className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>

                      {/* File Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white max-w-xs truncate">
                          {item.fileName}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">
                          {item.fileType}
                        </span>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider",
                          item.category === "RECEIPT" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                          item.category === "INVOICE" && "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                          item.category === "QUOTATION" && "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
                          item.category === "DELIVERY" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                          item.category === "MEMO" && "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
                          item.category === "OTHER" && "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        )}>
                          {item.category}
                        </span>
                      </td>

                      {/* Requisition */}
                      <td className="py-3 px-4">
                        {item.requisition ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (item.requisition) {
                                setSelectedRequisition(item.requisition);
                                onViewRequisition?.(item.requisition);
                              }
                            }}
                            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                          >
                            {item.requisition.id}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Standalone</span>
                        )}
                      </td>

                      {/* Ministry Group */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {item.groupName || "Diocese Ministry"}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-500">
                        {formatDate(item.date)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenProjection(idx)}
                            className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 cursor-pointer"
                            title="Projector View"
                          >
                            <Cast className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDownload(item, e)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopyUri(item, e)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                            title="Copy URI"
                          >
                            {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Projection Modal */}
      {isProjectionOpen && projectionAttachmentsList.length > 0 && (
        <AttachmentProjectionModal
          attachments={projectionAttachmentsList}
          initialIndex={projectionInitialIndex}
          onClose={() => setIsProjectionOpen(false)}
          title="Parish Uploads Master Gallery"
          groupName="All Diocese Ministry Uploads"
        />
      )}

      {/* Upload Documents Modal Drawer */}
      <AnimatePresence>
        {isUploadDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">Upload New Documents</h3>
                    <p className="text-xs text-slate-400">Add receipts, invoices, or vouchers directly to the gallery</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadDrawerOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Upload Form Details */}
              <div className="space-y-4">
                {/* Category Selection */}
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
                    Document Category
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "RECEIPT", label: "Receipt" },
                      { id: "INVOICE", label: "Invoice" },
                      { id: "QUOTATION", label: "Quotation / LPO" },
                      { id: "DELIVERY", label: "Delivery Note" },
                      { id: "MEMO", label: "Memo / Approval" },
                      { id: "OTHER", label: "Other Document" }
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setUploadCategory(c.id as UploadCategory)}
                        className={cn(
                          "px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center",
                          uploadCategory === c.id
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Link to Requisition */}
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">
                    Link to Requisition (Optional)
                  </label>
                  <select
                    value={uploadTargetRequisitionId}
                    onChange={(e) => setUploadTargetRequisitionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                  >
                    <option value="">-- Standalone Parish Document --</option>
                    {(requisitions || []).map((req) => (
                      <option key={req.id} value={req.id}>
                        {req.id} - {req.title} ({req.groupName || "Parish"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dropzone Container */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-800/30 hover:bg-indigo-50/20 flex flex-col items-center justify-center space-y-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.xlsx,.xls,.csv,.docx"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      Click to choose files
                    </span>
                    <span className="text-xs text-slate-400"> or drag and drop</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Supports PDF, PNG, JPG, WEBP, XLSX, CSV, DOCX (Up to 25MB each)
                  </span>
                </div>

                {/* Camera Trigger */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCameraActive(true)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-indigo-500" />
                    <span>Scan with Camera / Webcam</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Camera Capture Modal */}
      {isCameraActive && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraActive(false)}
        />
      )}
    </div>
  );
};
