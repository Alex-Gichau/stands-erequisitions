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
  Eye, 
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
  Info,
  Save,
  Globe,
  ShieldCheck,
  Users
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
export type ScopeVisibilityFilter = "ALL_EVER" | "MY_ALLOCATED";

export interface StagedUploadFile {
  id: string;
  file: File;
  name: string;
  size: string;
  previewUrl: string;
  formattedData: string;
}

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
    setSelectedRequisition,
    updateRequisition
  } = useRequisitions();

  // Role permissions check
  const isAdminOrFinance = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.role === UserRole.SUPER_ADMIN ||
      currentUser.role === UserRole.ADMIN ||
      currentUser.role === UserRole.FINANCE ||
      currentUser.role === UserRole.APPROVER_L1 ||
      currentUser.role === UserRole.APPROVER_L2
    );
  }, [currentUser]);

  // User allocated ministry groups
  const userAllocatedGroups = useMemo<string[]>(() => {
    if (!currentUser) return [];
    const groups: string[] = [];
    if (currentUser.group) groups.push(currentUser.group);
    if (Array.isArray(currentUser.groups)) {
      currentUser.groups.forEach(g => {
        if (g && !groups.includes(g)) groups.push(g);
      });
    }
    return groups;
  }, [currentUser]);

  // View & Scope Filter States
  const [scopeFilter, setScopeFilter] = useState<ScopeVisibilityFilter>(() => {
    return isAdminOrFinance ? "ALL_EVER" : "MY_ALLOCATED";
  });

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

  // Direct Upload & Staged Files Drawer State
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<UploadCategory>("RECEIPT");
  const [uploadTargetRequisitionId, setUploadTargetRequisitionId] = useState<string>("");
  const [stagedFiles, setStagedFiles] = useState<StagedUploadFile[]>([]);
  
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

  // Build Master Aggregation of ALL uploads ever uploaded across the system
  const allMasterUploadsList = useMemo<GalleryItem[]>(() => {
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

      // (c) Comments attachments
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

  // Role and Allocated Group Filtering
  const scopedUploadsList = useMemo<GalleryItem[]>(() => {
    // If scope is ALL_EVER, or user is Super Admin / Finance / Admin / Approver, show all
    if (scopeFilter === "ALL_EVER" || isAdminOrFinance) {
      return allMasterUploadsList;
    }

    // Otherwise filter for documents belonging to user's allocated group/ministry or submitted by user
    return allMasterUploadsList.filter((item) => {
      const isMyGroup = userAllocatedGroups.some(g => 
        (item.groupName && item.groupName.toLowerCase() === g.toLowerCase()) ||
        (item.requisition?.groupName && item.requisition.groupName.toLowerCase() === g.toLowerCase()) ||
        (item.requisition?.groupId && item.requisition.groupId.toLowerCase() === g.toLowerCase())
      );

      const isMySubmission = 
        (currentUser?.email && item.requisition?.requesterEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser?.name && item.requisition?.requesterName?.toLowerCase() === currentUser.name.toLowerCase());

      const isDirectUpload = item.sourceType === "DIRECT_UPLOAD";

      return isMyGroup || isMySubmission || isDirectUpload;
    });
  }, [allMasterUploadsList, scopeFilter, isAdminOrFinance, userAllocatedGroups, currentUser]);

  // Filter and Search Logic
  const filteredUploads = useMemo(() => {
    return scopedUploadsList.filter((item) => {
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
  }, [scopedUploadsList, selectedCategory, selectedFormat, selectedGroup, selectedStatus, searchQuery, sortBy]);

  // Distinct groups for filter dropdown
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    allMasterUploadsList.forEach((item) => {
      if (item.groupName) groups.add(item.groupName);
    });
    return Array.from(groups).sort();
  }, [allMasterUploadsList]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = scopedUploadsList.length;
    const images = scopedUploadsList.filter(i => i.fileType === "image").length;
    const pdfs = scopedUploadsList.filter(i => i.fileType === "pdf").length;
    const receipts = scopedUploadsList.filter(i => i.category === "RECEIPT").length;
    const invoices = scopedUploadsList.filter(i => i.category === "INVOICE").length;
    const quotations = scopedUploadsList.filter(i => i.category === "QUOTATION").length;
    return { total, images, pdfs, receipts, invoices, quotations };
  }, [scopedUploadsList]);

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

  // Projection items list mapping
  const projectionItemsList = useMemo(() => {
    const sourceList = selectedItemIds.size > 0 
      ? filteredUploads.filter(i => selectedItemIds.has(i.id))
      : filteredUploads;

    return sourceList.map(item => ({
      url: item.url,
      fileName: item.fileName,
      requisition: item.requisition,
      requisitionId: item.requisitionId,
      requisitionTitle: item.requisitionTitle,
      groupName: item.groupName,
      amount: item.amount,
      status: item.status,
      category: item.category
    }));
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

  // Staging files when selected
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newStaged: StagedUploadFile[] = [];
    for (const file of Array.from(files)) {
      try {
        const formattedArray = await processFileToAttachmentStrings(file);
        const formattedStr = formattedArray[0] || "";
        const previewUrl = formattedStr.includes("::") ? formattedStr.split("::").slice(1).join("::") : formattedStr;
        
        newStaged.push({
          id: `staged-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          previewUrl,
          formattedData: formattedStr
        });
      } catch (err) {
        console.error("Error reading file for staging:", file.name, err);
      }
    }

    setStagedFiles(prev => [...prev, ...newStaged]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Commit & Save Staged Documents
  const handleSaveStagedDocuments = async () => {
    if (stagedFiles.length === 0) return;
    setIsUploading(true);

    const newGalleryItems: GalleryItem[] = [];
    const newAttachmentUrlsForRequisition: string[] = [];

    for (const staged of stagedFiles) {
      let dataUrl = staged.previewUrl;

      // Attempt server upload
      try {
        const res = await fetch("/api/attachments/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: staged.formattedData,
            fileName: staged.name,
            fileType: staged.file.type
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

      const formattedAttachmentStr = `${staged.name}::${dataUrl}`;
      newAttachmentUrlsForRequisition.push(formattedAttachmentStr);

      const newItem: GalleryItem = {
        id: `direct-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        url: dataUrl,
        fileName: staged.name,
        fileType: inferFormat(dataUrl, staged.name),
        category: uploadCategory,
        date: new Date().toISOString(),
        sourceType: "DIRECT_UPLOAD",
        requisition: linkedReq,
        requisitionId: linkedReq?.id,
        requisitionTitle: linkedReq?.title,
        groupName: linkedReq?.groupName || currentUser?.group || "General Parish Uploads",
        amount: linkedReq?.amount,
        status: linkedReq?.status,
        rawSize: staged.size
      };

      newGalleryItems.push(newItem);
    }

    // If linked to a requisition, permanently update requisition's attachments
    if (uploadTargetRequisitionId && updateRequisition) {
      const targetReq = requisitions?.find(r => r.id === uploadTargetRequisitionId);
      if (targetReq) {
        try {
          if (uploadCategory === "RECEIPT") {
            const existingReceipts = Array.isArray(targetReq.receipts) ? targetReq.receipts : [];
            await updateRequisition(targetReq.id, {
              receipts: [...existingReceipts, ...newAttachmentUrlsForRequisition],
              updatedAt: new Date().toISOString()
            });
          } else {
            const existingAtts = Array.isArray(targetReq.attachments) ? targetReq.attachments : [];
            await updateRequisition(targetReq.id, {
              attachments: [...existingAtts, ...newAttachmentUrlsForRequisition],
              updatedAt: new Date().toISOString()
            });
          }
        } catch (updateErr) {
          console.error("Failed to link uploaded document to requisition:", updateErr);
        }
      }
    }

    if (newGalleryItems.length > 0) {
      setLocalDirectUploads(prev => [...newGalleryItems, ...prev]);
      setStagedFiles([]);
      setIsUploadDrawerOpen(false);
      triggerToast?.({
        type: "SYSTEM_INFO",
        message: `Saved ${newGalleryItems.length} document(s) successfully${uploadTargetRequisitionId ? ` & linked to requisition #${uploadTargetRequisitionId}` : ""}`,
        severity: "LOW",
        timestamp: new Date().toISOString()
      });
    }

    setIsUploading(false);
  };

  const handleCameraCapture = async (file: File) => {
    setIsCameraActive(false);
    try {
      const formattedArray = await processFileToAttachmentStrings(file);
      const formattedStr = formattedArray[0] || "";
      const previewUrl = formattedStr.includes("::") ? formattedStr.split("::").slice(1).join("::") : formattedStr;
      
      setStagedFiles(prev => [
        ...prev,
        {
          id: `staged-cam-${Date.now()}`,
          file,
          name: `Camera_Scan_${formatDate(new Date().toISOString()).replace(/[^a-zA-Z0-9]/g, "_")}.jpg`,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          previewUrl,
          formattedData: formattedStr
        }
      ]);
    } catch (e) {
      console.error("Camera staging error:", e);
    }
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
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Uploads & Documents Gallery
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                {scopedUploadsList.length} Uploads
              </span>
              {isAdminOrFinance && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1">
                  <ShieldCheck size={13} />
                  <span>Finance & Admin Master Access</span>
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Central parish repository for receipts, tax invoices, quotations, and requisition attachments.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <button
            type="button"
            onClick={() => {
              setStagedFiles([]);
              setIsUploadDrawerOpen(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Documents</span>
          </button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Scope Visibility Segmented Pill (Show all documents ever uploaded vs My Allocated Ministry) */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-indigo-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Document Scope:</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setScopeFilter("ALL_EVER")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              scopeFilter === "ALL_EVER"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Globe size={13} />
            <span>All Documents Ever Uploaded ({allMasterUploadsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setScopeFilter("MY_ALLOCATED")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              scopeFilter === "MY_ALLOCATED"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Users size={13} />
            <span>
              My Allocated Ministry {userAllocatedGroups.length > 0 ? `(${userAllocatedGroups[0]})` : ""}
            </span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Scope Total</span>
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
              <option value="ALL">All Ministries</option>
              {availableGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="NEWEST">Newest Uploads</option>
              <option value="OLDEST">Oldest First</option>
              <option value="TITLE_AZ">File Name (A-Z)</option>
              <option value="GROUP_AZ">Ministry (A-Z)</option>
              <option value="AMOUNT_HIGH">Highest Amount</option>
            </select>

            {/* Grid / Table View Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  viewMode === "grid" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                )}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "p-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  viewMode === "table" ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                )}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          {[
            { id: "ALL", label: "All Types" },
            { id: "RECEIPT", label: "Receipts" },
            { id: "INVOICE", label: "Tax Invoices" },
            { id: "QUOTATION", label: "Quotations / LPOs" },
            { id: "DELIVERY", label: "Delivery Notes" },
            { id: "MEMO", label: "Approvals & Memos" },
            { id: "OTHER", label: "Other Attachments" }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id as UploadCategory)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer border",
                selectedCategory === cat.id
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-750"
              )}
            >
              {cat.label}
            </button>
          ))}

          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 mx-1 shrink-0" />

          {/* Format Chips */}
          {[
            { id: "ALL", label: "All Formats" },
            { id: "IMAGE", label: "Images" },
            { id: "PDF", label: "PDFs" },
            { id: "SPREADSHEET", label: "Excel" },
            { id: "DOCUMENT", label: "Docs" }
          ].map((fmt) => (
            <button
              key={`fmt-${fmt.id}`}
              type="button"
              onClick={() => setSelectedFormat(fmt.id as FileFormatFilter)}
              className={cn(
                "px-3 py-1 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer border",
                selectedFormat === fmt.id
                  ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent shadow-sm"
                  : "bg-transparent border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Actions Strip (When files selected) */}
      {selectedItemIds.size > 0 && (
        <div className="bg-indigo-600 text-white px-5 py-3 rounded-2xl flex items-center justify-between shadow-lg shadow-indigo-600/30">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider bg-indigo-700 px-2.5 py-1 rounded-lg">
              {selectedItemIds.size} Selected
            </span>
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-xs font-bold hover:underline cursor-pointer"
            >
              {selectedItemIds.size === filteredUploads.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenProjection(0)}
              className="px-3 py-1.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Eye size={14} />
              <span>View Selected ({selectedItemIds.size})</span>
            </button>
            <button
              type="button"
              onClick={handleBatchDownload}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Download size={14} />
              <span>Download Batch</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedItemIds(new Set())}
              className="p-1.5 hover:bg-indigo-700 rounded-lg text-white/80 hover:text-white cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {filteredUploads.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No documents matched your criteria</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {scopeFilter === "MY_ALLOCATED" 
              ? "No documents found for your allocated ministry. Try switching to 'All Documents Ever Uploaded' to view parish archives."
              : "Try adjusting your search query, format filters, or document category."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {scopeFilter === "MY_ALLOCATED" && (
              <button
                type="button"
                onClick={() => setScopeFilter("ALL_EVER")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Show All Documents Ever Uploaded
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("ALL");
                setSelectedFormat("ALL");
                setSelectedGroup("ALL");
                setSelectedStatus("ALL");
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredUploads.map((item, idx) => {
            const isSelected = selectedItemIds.has(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  "bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden shadow-sm transition-all group hover:shadow-md flex flex-col relative",
                  isSelected
                    ? "border-indigo-500 ring-2 ring-indigo-500/20"
                    : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                {/* Media Preview Box */}
                <div 
                  className="aspect-video bg-slate-100 dark:bg-slate-950 relative overflow-hidden flex items-center justify-center cursor-pointer"
                  onClick={() => handleOpenProjection(idx)}
                >
                  {item.fileType === "image" ? (
                    <CachedImage
                      src={item.url}
                      alt={item.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : item.fileType === "pdf" ? (
                    <div className="w-full h-full p-2 flex items-center justify-center">
                      <PdfThumbnailPreview
                        url={item.url}
                        title={item.fileName}
                        className="w-full h-full max-h-32 object-contain shadow-sm rounded-lg"
                      />
                    </div>
                  ) : item.fileType === "spreadsheet" ? (
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                      <FileSpreadsheet size={28} />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                      <FileText size={28} />
                    </div>
                  )}

                  {/* Multi-select checkbox overlay */}
                  <div 
                    onClick={(e) => toggleSelectItem(item.id, e)}
                    className="absolute top-2 left-2 z-10 p-1 rounded-lg bg-slate-950/60 backdrop-blur-md text-white hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    {isSelected ? <CheckSquare size={16} className="text-indigo-400" /> : <Square size={16} className="text-slate-400" />}
                  </div>

                  {/* Category Pill Overlay */}
                  <div className="absolute top-2 right-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider backdrop-blur-md",
                      item.category === "RECEIPT" && "bg-emerald-500/90 text-white",
                      item.category === "INVOICE" && "bg-blue-500/90 text-white",
                      item.category === "QUOTATION" && "bg-amber-500/90 text-white",
                      item.category === "DELIVERY" && "bg-cyan-500/90 text-white",
                      item.category === "MEMO" && "bg-purple-500/90 text-white",
                      item.category === "OTHER" && "bg-slate-800/90 text-slate-200"
                    )}>
                      {item.category}
                    </span>
                  </div>

                  {/* Hover Overlay Button to Open Document */}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProjection(idx);
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer"
                    >
                      <Eye size={14} />
                      <span>Open File</span>
                    </button>
                  </div>
                </div>

                {/* Details Footer */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 
                      className="text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400" 
                      title={item.fileName}
                      onClick={() => handleOpenProjection(idx)}
                    >
                      {item.fileName}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.groupName || "Diocese Ministry"}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    {item.requisition ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (item.requisition) {
                            setSelectedRequisition(item.requisition);
                            onViewRequisition?.(item.requisition);
                          }
                        }}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer truncate max-w-[120px]"
                      >
                        #{item.requisition.id}
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Direct Upload</span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenProjection(idx)}
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="View Document"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDownload(item, e)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Download file"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleCopyUri(item, e)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Copy URL"
                      >
                        {copiedId === item.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <button type="button" onClick={selectAllFiltered} className="cursor-pointer">
                      {selectedItemIds.size === filteredUploads.length && filteredUploads.length > 0 ? (
                        <CheckSquare size={15} className="text-indigo-600" />
                      ) : (
                        <Square size={15} />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-4">Document File</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Requisition</th>
                  <th className="py-3 px-4">Ministry Group</th>
                  <th className="py-3 px-4">Upload Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUploads.map((item, idx) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <tr 
                      key={item.id}
                      className={cn(
                        "hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors",
                        isSelected && "bg-indigo-50/50 dark:bg-indigo-950/30"
                      )}
                    >
                      <td className="py-3 px-4">
                        <button type="button" onClick={(e) => toggleSelectItem(item.id, e)} className="cursor-pointer">
                          {isSelected ? <CheckSquare size={15} className="text-indigo-600" /> : <Square size={15} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div 
                          className="flex items-center gap-2.5 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          onClick={() => handleOpenProjection(idx)}
                        >
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            {item.fileType === "pdf" ? <FileText size={14} /> : item.fileType === "spreadsheet" ? <FileSpreadsheet size={14} /> : <Images size={14} />}
                          </div>
                          <span className="truncate max-w-xs">{item.fileName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                          item.category === "RECEIPT" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                          item.category === "INVOICE" && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
                          item.category === "QUOTATION" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
                          item.category === "DELIVERY" && "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
                          item.category === "MEMO" && "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
                          item.category === "OTHER" && "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                        )}>
                          {item.category}
                        </span>
                      </td>
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
                            #{item.requisition.id}
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Standalone</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {item.groupName || "Diocese Ministry"}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {formatDate(item.date)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenProjection(idx)}
                            className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 cursor-pointer"
                            title="View Document"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDownload(item, e)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                            title="Download"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopyUri(item, e)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                            title="Copy URI"
                          >
                            {copiedId === item.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
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
      {isProjectionOpen && projectionItemsList.length > 0 && (
        <AttachmentProjectionModal
          attachments={projectionItemsList.map(i => i.url)}
          items={projectionItemsList}
          initialIndex={projectionInitialIndex}
          onClose={() => setIsProjectionOpen(false)}
          onViewRequisition={(req) => {
            setIsProjectionOpen(false);
            if (req) {
              setSelectedRequisition(req);
              onViewRequisition?.(req);
            }
          }}
          title="Parish Uploads Master Gallery"
          groupName="All Diocese Ministry Uploads"
        />
      )}

      {/* Upload Documents Modal Drawer with Staged Files & Save Button */}
      <AnimatePresence>
        {isUploadDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-6 space-y-5"
            >
              {/* Drawer Header */}
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
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
                        #{req.id} - {req.title} ({req.groupName || "Parish"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dropzone Container */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-2xl p-5 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-800/30 hover:bg-indigo-50/20 flex flex-col items-center justify-center space-y-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.xlsx,.xls,.csv,.docx"
                    onChange={handleFilesSelected}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
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
                <button
                  type="button"
                  onClick={() => setIsCameraActive(true)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-indigo-500" />
                  <span>Scan with Camera / Webcam</span>
                </button>

                {/* Staged Files Preview List */}
                {stagedFiles.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
                        Staged Documents ({stagedFiles.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setStagedFiles([])}
                        className="text-[10px] text-rose-500 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {stagedFiles.map((staged) => (
                        <div
                          key={staged.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <FileText size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[240px]">
                                {staged.name}
                              </p>
                              <span className="text-[10px] text-slate-400">{staged.size}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveStagedFile(staged.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons with Prominent Save Button */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setStagedFiles([]);
                    setIsUploadDrawerOpen(false);
                  }}
                  disabled={isUploading}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveStagedDocuments}
                  disabled={stagedFiles.length === 0 || isUploading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isUploading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>
                    {isUploading 
                      ? "Saving Documents..." 
                      : stagedFiles.length > 0 
                        ? `Save ${stagedFiles.length} Document${stagedFiles.length > 1 ? "s" : ""}` 
                        : "Save Documents"}
                  </span>
                </button>
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
