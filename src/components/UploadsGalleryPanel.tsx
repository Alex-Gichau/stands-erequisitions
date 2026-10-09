/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from "react";
import { 
  FolderOpen,
  Search, 
  Grid, 
  List, 
  Columns2,
  Download, 
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
  Building2, 
  Maximize2, 
  CheckSquare, 
  Square, 
  X, 
  Camera, 
  Sparkles,
  Info,
  Save,
  Globe,
  Users,
  ChevronRight,
  ChevronLeft,
  Folder,
  File,
  Clock,
  HardDrive,
  FilePlus,
  Coins,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  FolderCheck,
  Tag,
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { Requisition, UserRole, RequisitionStatus, Project } from "../types";
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
import { AttachmentProjectionModal, ProjectorGalleryItem } from "./AttachmentProjectionModal";
import { CameraCapture } from "./CameraCapture";
import { processFileToAttachmentStrings } from "../lib/pdfUtils";

export type FileFormatFilter = "ALL" | "IMAGE" | "PDF" | "SPREADSHEET" | "DOCUMENT";
export type SortOption = "NEWEST" | "OLDEST" | "TITLE_AZ" | "GROUP_AZ" | "AMOUNT_HIGH" | "FILE_TYPE";
export type ScopeVisibilityFilter = "ALL_EVER" | "MY_ALLOCATED";
export type ExplorerViewMode = "grid" | "table" | "split";

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
  date: string;
  sourceType: "REQUISITION_ATTACHMENT" | "REQUISITION_RECEIPT" | "PROJECT_DOCUMENT" | "DIRECT_UPLOAD" | "COMMENT_ATTACHMENT";
  requisition?: Requisition | null;
  project?: Project | null;
  requisitionId?: string;
  requisitionTitle?: string;
  projectId?: string;
  projectTitle?: string;
  groupName?: string;
  amount?: number;
  status?: RequisitionStatus | string;
  notes?: string;
  rawSize?: string;
  tags?: string[];
}

interface UploadsGalleryPanelProps {
  onViewRequisition?: (req: Requisition) => void;
  onClose?: () => void;
}

// Helper to resolve Requisition Title in place of raw file name
export const getItemDisplayTitle = (item?: GalleryItem | null): string => {
  if (!item) return "Document";
  if (item.requisitionTitle && item.requisitionTitle.trim()) {
    return item.requisitionTitle;
  }
  if (item.requisition?.title && item.requisition.title.trim()) {
    return item.requisition.title;
  }
  if (item.projectTitle && item.projectTitle.trim()) {
    return item.projectTitle;
  }
  if (item.project?.name && item.project.name.trim()) {
    return item.project.name;
  }
  return item.fileName || "Document";
};

export const UploadsGalleryPanel: React.FC<UploadsGalleryPanelProps> = ({
  onViewRequisition,
  onClose
}) => {
  const { 
    requisitions = [], 
    projects = [],
    churchGroups = [], 
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
  const [scopeFilter, setScopeFilter] = useState<ScopeVisibilityFilter>("ALL_EVER");
  // Default category on navbar: All Ministries directory
  const [activeFolder, setActiveFolder] = useState<string>("MINISTRY_ALL");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<FileFormatFilter>("ALL");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");

  // Default view: "split" on large screens (>= 1024px / lg), "grid" on small screens
  const [viewMode, setViewMode] = useState<ExplorerViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stands_file_manager_view_mode_v2");
      if (saved === "split" || saved === "grid" || saved === "table") {
        return saved;
      }
      if (window.innerWidth >= 1024) {
        return "split";
      }
      return "grid";
    }
    return "split";
  });
  
  // Selection & Inspector & Projection State
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [inspectorItem, setInspectorItem] = useState<GalleryItem | null>(null);
  const [selectedMinistryFolder, setSelectedMinistryFolder] = useState<string>("");
  const [isProjectionOpen, setIsProjectionOpen] = useState(false);
  const [projectionInitialIndex, setProjectionInitialIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [mobileSplitTab, setMobileSplitTab] = useState<"list" | "details">("list");
  const [mobileMinistrySplitTab, setMobileMinistrySplitTab] = useState<"list" | "details">("list");

  // Direct Upload & Staged Files Drawer State
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMinistryGroup, setUploadMinistryGroup] = useState<string>(() => {
    return userAllocatedGroups[0] || (churchGroups[0]?.name || "Administration");
  });
  const [uploadTargetRequisitionId, setUploadTargetRequisitionId] = useState<string>("");
  const [uploadNotes, setUploadNotes] = useState<string>("");
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

  // Helper to deduce file format type
  const inferFormat = (url: string, fileName: string): "image" | "pdf" | "spreadsheet" | "document" | "other" => {
    const lower = (fileName || url || "").toLowerCase();
    if (lower.endsWith(".pdf") || url?.startsWith("data:application/pdf")) return "pdf";
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif") || url?.startsWith("data:image/")) return "image";
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv") || url?.includes("spreadsheet") || url?.includes("csv")) return "spreadsheet";
    if (lower.endsWith(".docx") || lower.endsWith(".doc") || lower.endsWith(".txt") || lower.endsWith(".rtf")) return "document";
    return "other";
  };

  // Build Master Aggregation of ALL uploads ever uploaded across the system
  const allMasterUploadsList = useMemo<GalleryItem[]>(() => {
    const items: GalleryItem[] = [];
    const seenUrls = new Set<string>();

    // 1. Process Requisition Attachments, Receipts, and Comments
    (requisitions || []).forEach((req) => {
      const groupName = req.groupName || (req as any).department || "Parish Council";

      // (a) Main Attachments
      const rawAttachments = Array.isArray(req.attachments) 
        ? req.attachments 
        : (req.attachments ? [req.attachments] : []);

      rawAttachments.forEach((att, idx) => {
        if (!att || typeof att !== "string") return;
        const normalized = normalizeAttachmentUrl(att);
        if (!normalized || seenUrls.has(normalized)) return;
        seenUrls.add(normalized);

        const fileName = getAttachmentFileName(normalized) || `${req.id}_document_${idx + 1}`;
        const fileType = inferFormat(normalized, fileName);

        items.push({
          id: `req-${req.id}-att-${idx}`,
          url: normalized,
          fileName,
          fileType,
          date: (req as any).createdAt || req.submittedAt || new Date().toISOString(),
          sourceType: "REQUISITION_ATTACHMENT",
          requisition: req,
          requisitionId: req.id,
          requisitionTitle: req.title,
          groupName,
          amount: req.amount,
          status: req.status,
          notes: req.description || req.title
        });
      });

      // (b) Audited Post-Disbursement Receipts
      const rawReceipts = Array.isArray(req.receipts) 
        ? req.receipts 
        : (req.receipts ? [req.receipts] : []);

      rawReceipts.forEach((rcpt, idx) => {
        if (!rcpt || typeof rcpt !== "string") return;
        const normalized = normalizeAttachmentUrl(rcpt);
        if (!normalized || seenUrls.has(normalized)) return;
        seenUrls.add(normalized);

        const fileName = getAttachmentFileName(normalized) || `${req.id}_receipt_${idx + 1}`;
        const fileType = inferFormat(normalized, fileName);

        items.push({
          id: `req-${req.id}-rcpt-${idx}`,
          url: normalized,
          fileName,
          fileType,
          date: req.updatedAt || req.submittedAt || new Date().toISOString(),
          sourceType: "REQUISITION_RECEIPT",
          requisition: req,
          requisitionId: req.id,
          requisitionTitle: req.title,
          groupName,
          amount: req.amount,
          status: req.status,
          notes: "Proof of expenditure / disbursement settlement"
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
              const fileName = getAttachmentFileName(normalized) || `${req.id}_comment_doc_${cIdx + 1}`;
              items.push({
                id: `req-${req.id}-comment-${cIdx}-${cAttIdx}`,
                url: normalized,
                fileName,
                fileType: inferFormat(normalized, fileName),
                date: c.createdAt || req.submittedAt || new Date().toISOString(),
                sourceType: "COMMENT_ATTACHMENT",
                requisition: req,
                requisitionId: req.id,
                requisitionTitle: req.title,
                groupName,
                amount: req.amount,
                status: req.status,
                notes: `Uploaded in conversation thread by ${c.authorName || "User"}`
              });
            }
          });
        }
      });
    });

    // 2. Process Project Documents & Blueprints
    (projects || []).forEach((proj) => {
      const rawAttachments = Array.isArray((proj as any).attachments)
        ? (proj as any).attachments
        : ((proj as any).attachments ? [(proj as any).attachments] : []);

      rawAttachments.forEach((pAtt: any, idx: number) => {
        if (!pAtt) return;
        const urlStr = typeof pAtt === "string" ? pAtt : (pAtt.url || "");
        const normalized = normalizeAttachmentUrl(urlStr);
        if (!normalized || seenUrls.has(normalized)) return;
        seenUrls.add(normalized);

        const fileName = (typeof pAtt === "object" && pAtt.name) 
          ? pAtt.name 
          : (getAttachmentFileName(normalized) || `${proj.id}_blueprint_${idx + 1}`);

        items.push({
          id: `proj-${proj.id}-att-${idx}`,
          url: normalized,
          fileName,
          fileType: inferFormat(normalized, fileName),
          date: (proj as any).createdAt || new Date().toISOString(),
          sourceType: "PROJECT_DOCUMENT",
          project: proj,
          projectId: proj.id,
          projectTitle: proj.name,
          groupName: proj.groupId || (proj as any).groupName || "Parish Projects",
          amount: proj.allocatedBudget,
          status: proj.status || "ACTIVE",
          notes: `Capital project documentation for ${proj.name}`
        });
      });
    });

    // 3. Process Local Direct Uploads
    localDirectUploads.forEach((directItem) => {
      if (directItem.url && !seenUrls.has(directItem.url)) {
        seenUrls.add(directItem.url);
        items.push(directItem);
      }
    });

    return items;
  }, [requisitions, projects, localDirectUploads]);

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

  // Comprehensive list of all distinct Parish Ministries (from churchGroups and all records)
  const allAvailableMinistries = useMemo(() => {
    const map = new Map<string, { name: string; count: number; totalAmount: number }>();

    // 1. Seed with registered churchGroups
    (churchGroups || []).forEach(cg => {
      if (cg && cg.name) {
        const key = cg.name.trim();
        if (!map.has(key)) {
          map.set(key, { name: key, count: 0, totalAmount: 0 });
        }
      }
    });

    // 2. Aggregate counts and values from scoped uploads
    scopedUploadsList.forEach(item => {
      const gName = (item.groupName || item.requisition?.groupName || "Parish Council").trim();
      if (!map.has(gName)) {
        map.set(gName, { name: gName, count: 0, totalAmount: 0 });
      }
      const entry = map.get(gName)!;
      entry.count += 1;
      entry.totalAmount += (item.amount || 0);
    });

    return Array.from(map.values()).sort((a, b) => {
      // Sort by file count descending, then alphabetically
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [churchGroups, scopedUploadsList]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Search-filtered Parish Ministries
  const filteredMinistries = useMemo(() => {
    if (!deferredSearchQuery.trim()) return allAvailableMinistries;
    const q = deferredSearchQuery.toLowerCase().trim();
    return allAvailableMinistries.filter(m => m.name.toLowerCase().includes(q));
  }, [allAvailableMinistries, deferredSearchQuery]);

  // Parish Ministries Directory 15-row pagination
  const MINISTRIES_PER_PAGE = 15;
  const [ministriesPage, setMinistriesPage] = useState<number>(1);
  const totalMinistriesPages = Math.ceil(filteredMinistries.length / MINISTRIES_PER_PAGE) || 1;
  const paginatedMinistries = useMemo(() => {
    const safePage = Math.min(Math.max(1, ministriesPage), totalMinistriesPages);
    const start = (safePage - 1) * MINISTRIES_PER_PAGE;
    return filteredMinistries.slice(start, start + MINISTRIES_PER_PAGE);
  }, [filteredMinistries, ministriesPage, totalMinistriesPages]);

  // Reset ministries page on search or active folder change
  useEffect(() => {
    setMinistriesPage(1);
  }, [deferredSearchQuery, activeFolder]);

  // Filter and Search Logic
  const filteredUploads = useMemo(() => {
    return scopedUploadsList.filter((item) => {
      // 1. Folder Tree Filtering
      if (activeFolder !== "ALL") {
        if (activeFolder === "MINISTRY_ALL") {
          // Shows all files from all ministries
          // No group restriction, displays parish ministries directory
        } else if (activeFolder.startsWith("MINISTRY:")) {
          const targetMin = activeFolder.replace("MINISTRY:", "").trim().toLowerCase();
          const itemGroup = (item.groupName || item.requisition?.groupName || "").trim().toLowerCase();
          if (itemGroup !== targetMin) return false;
        } else if (activeFolder.startsWith("FMT:")) {
          const targetFmt = activeFolder.replace("FMT:", "");
          if (item.fileType !== targetFmt) return false;
        } else if (activeFolder.startsWith("STATUS:")) {
          const targetStatus = activeFolder.replace("STATUS:", "");
          if (item.status !== targetStatus) return false;
        } else if (activeFolder.startsWith("YEAR:")) {
          const targetYear = activeFolder.replace("YEAR:", "");
          const fileYear = new Date(item.date).getFullYear().toString();
          if (fileYear !== targetYear) return false;
        } else if (activeFolder === "RECENT") {
          const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          if (new Date(item.date).getTime() < thirtyDaysAgo) return false;
        } else if (activeFolder === "DIRECT_UPLOADS") {
          if (item.sourceType !== "DIRECT_UPLOAD") return false;
        }
      }

      // 2. File format filter
      if (selectedFormat !== "ALL") {
        if (selectedFormat === "IMAGE" && item.fileType !== "image") return false;
        if (selectedFormat === "PDF" && item.fileType !== "pdf") return false;
        if (selectedFormat === "SPREADSHEET" && item.fileType !== "spreadsheet") return false;
        if (selectedFormat === "DOCUMENT" && item.fileType !== "document") return false;
      }

      // 3. Group filter
      if (selectedGroup !== "ALL" && item.groupName !== selectedGroup) {
        return false;
      }

      // 4. Status filter
      if (selectedStatus !== "ALL" && item.status !== selectedStatus) {
        return false;
      }

      // 5. Search Query
      if (deferredSearchQuery.trim()) {
        const query = deferredSearchQuery.toLowerCase().trim();
        const displayTitle = getItemDisplayTitle(item).toLowerCase();
        const matchTitle = displayTitle.includes(query);
        const matchName = item.fileName.toLowerCase().includes(query);
        const matchReqId = item.requisitionId?.toLowerCase().includes(query) || false;
        const matchReqTitle = item.requisitionTitle?.toLowerCase().includes(query) || false;
        const matchGroup = item.groupName?.toLowerCase().includes(query) || false;
        const matchNotes = item.notes?.toLowerCase().includes(query) || false;
        if (!matchTitle && !matchName && !matchReqId && !matchReqTitle && !matchGroup && !matchNotes) {
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
        return getItemDisplayTitle(a).localeCompare(getItemDisplayTitle(b));
      }
      if (sortBy === "GROUP_AZ") {
        return (a.groupName || "").localeCompare(b.groupName || "");
      }
      if (sortBy === "AMOUNT_HIGH") {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortBy === "FILE_TYPE") {
        return a.fileType.localeCompare(b.fileType);
      }
      return 0;
    });
  }, [scopedUploadsList, activeFolder, selectedFormat, selectedGroup, selectedStatus, deferredSearchQuery, sortBy]);

  // Auto-select first item for split view inspector if none selected
  useEffect(() => {
    if (viewMode === "split" && !inspectorItem && filteredUploads.length > 0) {
      setInspectorItem(filteredUploads[0]);
    }
  }, [viewMode, inspectorItem, filteredUploads]);

  // Document Files 15-row pagination
  const FILES_PER_PAGE = 15;
  const [filesPage, setFilesPage] = useState<number>(1);
  const totalFilesPages = Math.ceil(filteredUploads.length / FILES_PER_PAGE) || 1;
  const paginatedUploads = useMemo(() => {
    const safePage = Math.min(Math.max(1, filesPage), totalFilesPages);
    const start = (safePage - 1) * FILES_PER_PAGE;
    return filteredUploads.slice(start, start + FILES_PER_PAGE);
  }, [filteredUploads, filesPage, totalFilesPages]);

  // Reset files page on filter, folder, search, or sort change
  useEffect(() => {
    setFilesPage(1);
  }, [activeFolder, deferredSearchQuery, selectedFormat, selectedGroup, selectedStatus, sortBy, scopeFilter]);

  // Reusable 15-row pagination bar
  const renderPaginationControls = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    pageSize: number,
    onPageChange: (p: number) => void,
    itemLabel: string
  ) => {
    if (totalItems === 0) return null;
    const startNum = ((currentPage - 1) * pageSize) + 1;
    const endNum = Math.min(currentPage * pageSize, totalItems);

    return (
      <div className="px-4 sm:px-6 py-3.5 bg-slate-50/70 dark:bg-[#121214]/70 border-t border-slate-200/80 dark:border-[#27272a] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
          Showing <span className="font-bold text-slate-900 dark:text-white">{startNum}</span> to <span className="font-bold text-slate-900 dark:text-white">{endNum}</span> of <span className="font-bold text-slate-900 dark:text-white">{totalItems}</span> {itemLabel}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#222227] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer shadow-2xs"
            title="Previous Page"
          >
            <ChevronLeft size={13} />
            <span>Prev</span>
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                return (
                  <React.Fragment key={p}>
                    {prev && p - prev > 1 && (
                      <span className="px-1 text-slate-400 text-xs">...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onPageChange(p)}
                      className={cn(
                        "w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer",
                        currentPage === p
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-white dark:bg-[#18181b] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#222227] border border-slate-200 dark:border-[#27272a]"
                      )}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#27272a] bg-white dark:bg-[#18181b] text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-[#222227] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-bold cursor-pointer shadow-2xs"
            title="Next Page"
          >
            <span>Next</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    );
  };

  // Metric counts and total valuation
  const metrics = useMemo(() => {
    const total = scopedUploadsList.length;
    const images = scopedUploadsList.filter(i => i.fileType === "image").length;
    const pdfs = scopedUploadsList.filter(i => i.fileType === "pdf").length;
    const spreadsheets = scopedUploadsList.filter(i => i.fileType === "spreadsheet").length;
    const documents = scopedUploadsList.filter(i => i.fileType === "document").length;
    const activeMinistriesCount = allAvailableMinistries.filter(m => m.count > 0).length;
    
    // Total financial value backed by documents
    const totalValue = scopedUploadsList.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    return { 
      total, 
      images, 
      pdfs, 
      spreadsheets,
      documents,
      activeMinistriesCount,
      totalMinistries: allAvailableMinistries.length,
      totalValue
    };
  }, [scopedUploadsList, allAvailableMinistries]);

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

  // Convert Gallery items to Projection Modal items
  const projectionItemsList = useMemo<ProjectorGalleryItem[]>(() => {
    const sourceList = selectedItemIds.size > 0 
      ? filteredUploads.filter(i => selectedItemIds.has(i.id))
      : filteredUploads;

    return sourceList.map((item) => ({
      id: item.id,
      url: item.url,
      title: getItemDisplayTitle(item),
      fileName: item.fileName,
      category: item.fileType.toUpperCase(),
      groupName: item.groupName,
      amount: item.amount,
      requisitionRef: item.requisitionId ? `#${item.requisitionId}` : undefined,
      requisitionTitle: item.requisitionTitle,
      date: item.date,
      requisition: item.requisition || undefined
    }));
  }, [filteredUploads, selectedItemIds]);

  const handleOpenProjection = (index: number) => {
    setProjectionInitialIndex(index);
    setIsProjectionOpen(true);
  };

  // Copy Direct File Link to Clipboard
  const handleCopyUri = (item: GalleryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const absUrl = getAbsoluteAttachmentUrl(item.url);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(absUrl).then(() => {
        setCopiedId(item.id);
        triggerToast({
          type: "SYSTEM_INFO",
          message: `Copied direct link for "${item.fileName}"`,
          severity: "LOW",
          timestamp: new Date().toISOString()
        });
        setTimeout(() => setCopiedId(null), 2500);
      });
    }
  };

  // Trigger File Download
  const handleDownload = (item: GalleryItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.fileName || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast({
      type: "SYSTEM_INFO",
      message: `Downloading "${item.fileName}"`,
      severity: "LOW",
      timestamp: new Date().toISOString()
    });
  };

  // Batch Download Selected
  const handleBatchDownload = () => {
    const selectedItems = filteredUploads.filter(i => selectedItemIds.has(i.id));
    if (selectedItems.length === 0) return;

    selectedItems.forEach((item, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = item.url;
        link.download = item.fileName || `document_${index + 1}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 250);
    });

    triggerToast({
      type: "SYSTEM_INFO",
      message: `Starting download of ${selectedItems.length} documents...`,
      severity: "LOW",
      timestamp: new Date().toISOString()
    });
  };

  // Batch Copy Selected Links
  const handleBatchCopyLinks = () => {
    const selectedItems = filteredUploads.filter(i => selectedItemIds.has(i.id));
    if (selectedItems.length === 0) return;

    const urlsText = selectedItems
      .map(i => `${i.fileName}: ${getAbsoluteAttachmentUrl(i.url)}`)
      .join("\n");

    if (navigator.clipboard) {
      navigator.clipboard.writeText(urlsText).then(() => {
        triggerToast({
          type: "SYSTEM_INFO",
          message: `Copied ${selectedItems.length} document URLs to clipboard`,
          severity: "LOW",
          timestamp: new Date().toISOString()
        });
      });
    }
  };

  // Export File Catalog to CSV
  const handleExportCatalogCsv = () => {
    const targetItems = selectedItemIds.size > 0
      ? filteredUploads.filter(i => selectedItemIds.has(i.id))
      : filteredUploads;

    if (targetItems.length === 0) {
      triggerToast({
        type: "SYSTEM_INFO",
        message: "No documents to export.",
        severity: "LOW",
        timestamp: new Date().toISOString()
      });
      return;
    }

    const headers = ["File Name", "Type", "Ministry / Group", "Requisition Ref", "Financial Amount (KES)", "Date Uploaded", "Direct URL"];
    const rows = targetItems.map(item => [
      `"${item.fileName.replace(/"/g, '""')}"`,
      item.fileType.toUpperCase(),
      `"${(item.groupName || 'Parish').replace(/"/g, '""')}"`,
      item.requisitionId ? `"#${item.requisitionId}"` : '"Standalone"',
      item.amount || 0,
      `"${formatDate(item.date)}"`,
      `"${getAbsoluteAttachmentUrl(item.url)}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `St_Andrews_Parish_File_Catalog_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    triggerToast({
      type: "SYSTEM_INFO",
      message: `Exported ${targetItems.length} document records to CSV`,
      severity: "LOW",
      timestamp: new Date().toISOString()
    });
  };

  // Direct Upload: Staging Files Handler
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null } }) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newStaged: StagedUploadFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formattedArray = await processFileToAttachmentStrings(file);
        const formatted = formattedArray && formattedArray.length > 0 ? formattedArray[0] : "";
        if (formatted) {
          const sizeKb = (file.size / 1024).toFixed(1);
          const formattedSize = file.size > 1024 * 1024 
            ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` 
            : `${sizeKb} KB`;

          newStaged.push({
            id: `staged-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            file,
            name: file.name,
            size: formattedSize,
            previewUrl: formatted,
            formattedData: formatted
          });
        }
      } catch (err) {
        console.error("Error staging file:", err);
      }
    }

    if (newStaged.length > 0) {
      setStagedFiles(prev => [...prev, ...newStaged]);
    }
  };

  // Direct Upload: Camera Capture Staging
  const handleCameraCaptureFile = async (capturedFile: File) => {
    try {
      const formattedArray = await processFileToAttachmentStrings(capturedFile);
      const formatted = formattedArray && formattedArray.length > 0 ? formattedArray[0] : "";
      if (formatted) {
        const sizeKb = (capturedFile.size / 1024).toFixed(1);
        const fileName = capturedFile.name || `Scan_Capture_${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
        const staged: StagedUploadFile = {
          id: `staged-cam-${Date.now()}`,
          file: capturedFile,
          name: fileName,
          size: capturedFile.size > 0 ? `${sizeKb} KB` : "High Res Scan",
          previewUrl: formatted,
          formattedData: formatted
        };
        setStagedFiles(prev => [...prev, staged]);
        setIsCameraActive(false);
      }
    } catch (err) {
      console.error("Camera process error:", err);
    }
  };

  // Remove single staged file
  const handleRemoveStagedFile = (stagedId: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== stagedId));
  };

  // Save Staged Files to Master Gallery
  const handleSaveStagedFiles = async () => {
    if (stagedFiles.length === 0) {
      triggerToast({
        type: "SYSTEM_INFO",
        message: "Please choose or capture at least one file to upload.",
        severity: "LOW",
        timestamp: new Date().toISOString()
      });
      return;
    }

    setIsUploading(true);

    try {
      const newGalleryItems: GalleryItem[] = [];

      for (const staged of stagedFiles) {
        const fileType = inferFormat(staged.formattedData, staged.name);
        
        let linkedReq: Requisition | null = null;
        if (uploadTargetRequisitionId) {
          linkedReq = requisitions.find(r => r.id === uploadTargetRequisitionId) || null;
        }

        const newItem: GalleryItem = {
          id: `direct-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          url: staged.formattedData,
          fileName: staged.name,
          fileType,
          date: new Date().toISOString(),
          sourceType: "DIRECT_UPLOAD",
          requisition: linkedReq,
          requisitionId: linkedReq?.id,
          requisitionTitle: linkedReq?.title,
          groupName: uploadMinistryGroup || linkedReq?.groupName || "Diocese Ministry",
          amount: linkedReq?.amount,
          status: linkedReq?.status,
          notes: uploadNotes,
          rawSize: staged.size
        };

        newGalleryItems.push(newItem);

        // If target requisition specified, attach it to the requisition too
        if (linkedReq && updateRequisition) {
          try {
            const currentAttachments = Array.isArray(linkedReq.attachments) ? linkedReq.attachments : [];
            await updateRequisition(linkedReq.id, {
              attachments: [...currentAttachments, staged.formattedData]
            });
          } catch (linkErr) {
            console.warn("Could not append attachment directly to requisition:", linkErr);
          }
        }
      }

      if (newGalleryItems.length > 0) {
        setLocalDirectUploads(prev => [...newGalleryItems, ...prev]);
        setStagedFiles([]);
        setIsUploadDrawerOpen(false);
        setUploadNotes("");
        setUploadTargetRequisitionId("");

        triggerToast({
          type: "SYSTEM_INFO",
          message: `Saved ${newGalleryItems.length} document(s) successfully${uploadTargetRequisitionId ? ` & linked to requisition #${uploadTargetRequisitionId}` : ""}`,
          severity: "HIGH",
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error("Save staged files error:", err);
      triggerToast({
        type: "SYSTEM_INFO",
        message: `Failed to save files: ${err.message || "Unknown error"}`,
        severity: "HIGH",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Helper to format folder display name
  const getActiveFolderLabel = () => {
    if (activeFolder === "ALL") return "All Documents & Archives";
    if (activeFolder === "ANALYTICS") return "Analytics & Storage Metrics";
    if (activeFolder === "RECENT") return "Recent Uploads (Past 30 Days)";
    if (activeFolder === "DIRECT_UPLOADS") return "Direct Staged Uploads";
    if (activeFolder === "MINISTRY_ALL") return "Parish Ministries / All Folders";
    if (activeFolder.startsWith("MINISTRY:")) {
      const ministryName = activeFolder.replace("MINISTRY:", "");
      return `Parish Ministries / ${ministryName}`;
    }
    if (activeFolder.startsWith("FMT:")) return `Format: ${activeFolder.replace("FMT:", "").toUpperCase()}`;
    if (activeFolder.startsWith("STATUS:")) return `Status: ${activeFolder.replace("STATUS:", "").replace(/_/g, " ")}`;
    if (activeFolder.startsWith("YEAR:")) return `Fiscal Year: ${activeFolder.replace("YEAR:", "")}`;
    return activeFolder;
  };

  const isBrowsingMinistries = activeFolder === "MINISTRY_ALL" || activeFolder.startsWith("MINISTRY:");
  const currentMinistryName = activeFolder.startsWith("MINISTRY:") ? activeFolder.replace("MINISTRY:", "") : null;

  return (
    <div id="uploads-gallery-panel" className="w-full min-h-screen text-slate-900 dark:text-slate-100 p-2.5 sm:p-5 lg:p-7 space-y-4 sm:space-y-5 transition-colors">
      
      {/* Mobile Screen Category & Scope Quick Navigator (< md) */}
      <div className="md:hidden w-full overflow-x-auto pb-1 no-scrollbar -mx-0.5 px-0.5">
        <div className="flex items-center gap-1.5 min-w-max">
          <button
            type="button"
            onClick={() => {
              setScopeFilter("ALL_EVER");
              setActiveFolder("ALL");
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border shadow-2xs",
              scopeFilter === "ALL_EVER" && activeFolder === "ALL"
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white dark:bg-[#18181b] border-slate-200/80 dark:border-[#27272a] text-slate-700 dark:text-zinc-300"
            )}
          >
            <Globe size={13} />
            <span>All Parish ({allMasterUploadsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setScopeFilter("MY_ALLOCATED");
              setActiveFolder("ALL");
            }}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border shadow-2xs",
              scopeFilter === "MY_ALLOCATED" && activeFolder === "ALL"
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white dark:bg-[#18181b] border-slate-200/80 dark:border-[#27272a] text-slate-700 dark:text-zinc-300"
            )}
          >
            <Users size={13} />
            <span>My Ministry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFolder("MINISTRY_ALL")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border shadow-2xs",
              activeFolder === "MINISTRY_ALL"
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white dark:bg-[#18181b] border-slate-200/80 dark:border-[#27272a] text-slate-700 dark:text-zinc-300"
            )}
          >
            <FolderCheck size={13} />
            <span>All Ministries ({allAvailableMinistries.length})</span>
          </button>

          {[
            { id: "FMT:pdf", label: `PDFs (${metrics.pdfs})`, icon: FileText },
            { id: "FMT:image", label: `Images (${metrics.images})`, icon: ImageIcon },
            { id: "FMT:spreadsheet", label: `Excel (${metrics.spreadsheets})`, icon: FileSpreadsheet },
            { id: "FMT:document", label: `Docs (${metrics.documents})`, icon: File }
          ].map(fmt => {
            const Icon = fmt.icon;
            const isActive = activeFolder === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setActiveFolder(fmt.id)}
                className={cn(
                  "px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border shadow-2xs",
                  isActive
                    ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900"
                    : "bg-white dark:bg-[#18181b] border-slate-200/80 dark:border-[#27272a] text-slate-600 dark:text-zinc-300"
                )}
              >
                <Icon size={13} />
                <span>{fmt.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setActiveFolder("ANALYTICS")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer border shadow-2xs",
              activeFolder === "ANALYTICS"
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white dark:bg-[#18181b] border-slate-200/80 dark:border-[#27272a] text-slate-700 dark:text-zinc-300"
            )}
          >
            <BarChart3 size={13} />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* Main File Explorer Layout with Collapsible Folder Sidebar */}
      <div className="flex flex-row gap-3 sm:gap-4 lg:gap-5 items-start w-full">
        
        {/* UNIFIED COMPACT ICON-DOCK SIDEBAR (DESKTOP SCREENS >= md) */}
        {isSidebarOpen && (
          <div className="hidden md:flex sticky top-4 sm:top-6 z-20 self-start flex-col items-center gap-2.5 w-12 sm:w-14 lg:w-16 bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-[#27272a] p-2 py-3.5 shadow-md dark:shadow-xl shrink-0 transition-all animate-in fade-in duration-200">
            {/* Scope Icons */}
            <div className="flex flex-col items-center gap-1.5 w-full">
              <button
                type="button"
                title={`All Parish Documents (${allMasterUploadsList.length})`}
                onClick={() => {
                  setScopeFilter("ALL_EVER");
                  setActiveFolder("ALL");
                }}
                className={cn(
                  "w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                  scopeFilter === "ALL_EVER" && activeFolder !== "ANALYTICS"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272a]"
                )}
              >
                <Globe size={17} />
                <span className="sr-only">All Parish Documents</span>
              </button>

              <button
                type="button"
                title={`My Ministry Only (${userAllocatedGroups[0] || "Allocated"})`}
                onClick={() => {
                  setScopeFilter("MY_ALLOCATED");
                  setActiveFolder("ALL");
                }}
                className={cn(
                  "w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                  scopeFilter === "MY_ALLOCATED" && activeFolder !== "ANALYTICS"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272a]"
                )}
              >
                <Users size={17} />
                <span className="sr-only">My Ministry Only</span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-6 sm:w-8 h-px bg-slate-200 dark:bg-[#27272a] my-1" />

            {/* Ministries Master Icon */}
            <div className="flex flex-col items-center gap-1.5 w-full">
              <button
                type="button"
                title={`All Ministries Directory (${allAvailableMinistries.length} Ministries, ${metrics.total} files)`}
                onClick={() => setActiveFolder("MINISTRY_ALL")}
                className={cn(
                  "w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                  activeFolder === "MINISTRY_ALL"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272a]"
                )}
              >
                <FolderCheck size={17} />
                <span className="sr-only">All Ministries Directory</span>
              </button>
            </div>

            {/* Divider */}
            <div className="w-6 sm:w-8 h-px bg-slate-200 dark:bg-[#27272a] my-1" />

            {/* Format Filter Icons */}
            <div className="flex flex-col items-center gap-1.5 w-full">
              {[
                { id: "FMT:pdf", label: `PDF Documents (${metrics.pdfs})`, icon: FileText },
                { id: "FMT:image", label: `Images & Photos (${metrics.images})`, icon: ImageIcon },
                { id: "FMT:spreadsheet", label: `Spreadsheets (Excel/CSV) (${metrics.spreadsheets})`, icon: FileSpreadsheet },
                { id: "FMT:document", label: `Word Documents (${metrics.documents})`, icon: File }
              ].map((fmt) => {
                const Icon = fmt.icon;
                const isActive = activeFolder === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    title={fmt.label}
                    onClick={() => setActiveFolder(fmt.id)}
                    className={cn(
                      "w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                      isActive
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272a]"
                    )}
                  >
                    <Icon size={15} />
                    <span className="sr-only">{fmt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="w-6 sm:w-8 h-px bg-slate-200 dark:bg-[#27272a] my-1" />

            {/* Analytics Sidenav Button */}
            <div className="flex flex-col items-center gap-1.5 w-full">
              <button
                type="button"
                title="Repository Analytics & Storage Metrics"
                onClick={() => setActiveFolder("ANALYTICS")}
                className={cn(
                  "w-9 h-9 sm:w-10 sm:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative",
                  activeFolder === "ANALYTICS"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#27272a]"
                )}
              >
                <BarChart3 size={17} />
                <span className="sr-only">Analytics</span>
              </button>
            </div>
          </div>
        )}

        {/* RIGHT MAIN EXPLORER AREA */}
        <div className="flex-1 w-full min-w-0 space-y-3 sm:space-y-4">
          
          {/* Controls Bar: Search, Breadcrumb, Sort, View Toggle */}
          <div className="bg-white dark:bg-[#18181b] p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs space-y-3 sm:space-y-4 transition-colors">
            
            {/* Header Title & Subtitle */}
            <div className="flex items-center gap-3 sm:gap-4 relative z-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-inner">
                <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 stroke-[2]" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white truncate sm:whitespace-normal">
                  Requisitions & Receipts File Manager
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                  Quickly locate specific photos, receipts, and documents using smart category filters.
                </p>
              </div>
            </div>

            {/* Search Input & Action Toolbar */}
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {/* Search Input */}
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search ministry, file, or requisition..."
                    className="w-full pl-10 pr-9 py-2 sm:py-2.5 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#27272a] rounded-xl sm:rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Export Catalog CSV */}
                  <button
                    type="button"
                    onClick={handleExportCatalogCsv}
                    className="p-2 sm:px-3 sm:py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] dark:hover:bg-[#323238] text-slate-700 dark:text-zinc-200 dark:hover:text-white rounded-xl text-xs font-bold border border-slate-200 dark:border-[#3f3f46] transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    title="Export catalog list of documents to CSV"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                  </button>

                  {/* Camera Scanner Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setStagedFiles([]);
                      setIsCameraActive(true);
                      setIsUploadDrawerOpen(true);
                    }}
                    className="flex-1 sm:flex-initial px-3 sm:px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Scan</span>
                  </button>

                  {/* Primary Upload Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setStagedFiles([]);
                      setIsCameraActive(false);
                      setIsUploadDrawerOpen(true);
                    }}
                    className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Upload</span>
                  </button>
                </div>
              </div>

              {/* View Mode & Sorting Row */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-[#27272a]">
                {/* Sort Option */}
                <div className="flex-1 min-w-0 max-w-[190px] sm:max-w-[240px]">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full px-2.5 sm:px-3 py-1.5 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#27272a] rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer truncate"
                  >
                    <option value="NEWEST">Sort: Newest First</option>
                    <option value="OLDEST">Sort: Oldest First</option>
                    <option value="TITLE_AZ">Requisition Title (A-Z)</option>
                    <option value="GROUP_AZ">Ministry (A-Z)</option>
                    <option value="AMOUNT_HIGH">Highest Financial Value</option>
                    <option value="FILE_TYPE">File Format</option>
                  </select>
                </div>

                {/* View Mode Switcher: Grid vs Table vs Split Inspector */}
                <div className="flex items-center bg-slate-100 dark:bg-[#121214] p-1 rounded-xl border border-slate-200 dark:border-[#27272a] shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeFolder === "ANALYTICS") setActiveFolder("MINISTRY_ALL");
                      setViewMode("grid");
                      try { localStorage.setItem("stands_file_manager_view_mode_v2", "grid"); } catch (e) {}
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      viewMode === "grid" && activeFolder !== "ANALYTICS"
                        ? "bg-white dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 shadow-2xs" 
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                    title="Grid Card View"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeFolder === "ANALYTICS") setActiveFolder("MINISTRY_ALL");
                      setViewMode("table");
                      try { localStorage.setItem("stands_file_manager_view_mode_v2", "table"); } catch (e) {}
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      viewMode === "table" && activeFolder !== "ANALYTICS"
                        ? "bg-white dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 shadow-2xs" 
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                    title="Row Table Explorer View"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline sm:inline">Rows</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeFolder === "ANALYTICS") setActiveFolder("MINISTRY_ALL");
                      setViewMode("split");
                      try { localStorage.setItem("stands_file_manager_view_mode_v2", "split"); } catch (e) {}
                      if (!inspectorItem && filteredUploads.length > 0) {
                        setInspectorItem(filteredUploads[0]);
                      }
                      if (!selectedMinistryFolder && filteredMinistries.length > 0) {
                        setSelectedMinistryFolder(filteredMinistries[0].name);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      viewMode === "split" && activeFolder !== "ANALYTICS"
                        ? "bg-white dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 shadow-2xs" 
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                    title="Split Inspector View"
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline sm:inline">Split</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Row: Active Breadcrumb & Quick Filter Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-[#27272a]">
              {/* Breadcrumb Indicator */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 flex-wrap min-w-0">
                {currentMinistryName && (
                  <button
                    type="button"
                    onClick={() => setActiveFolder("MINISTRY_ALL")}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all border border-indigo-200 dark:border-indigo-800/80 cursor-pointer shadow-2xs group shrink-0 active:scale-95 mr-0.5"
                    title="Back to all ministry folders"
                  >
                    <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
                    <span className="text-[11px]">Back</span>
                  </button>
                )}

                <span className="font-bold text-slate-400 dark:text-zinc-500 shrink-0">Location:</span>
                
                {isBrowsingMinistries ? (
                  <div className="flex items-center gap-1 min-w-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setActiveFolder("MINISTRY_ALL")}
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Folder size={13} className="fill-indigo-500/20" />
                      <span>Ministries</span>
                    </button>
                    {currentMinistryName && (
                      <>
                        <ChevronRight size={13} className="text-slate-300 dark:text-zinc-600 shrink-0" />
                        <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
                          <FolderOpen size={13} className="text-indigo-500 shrink-0" />
                          <span className="truncate">{currentMinistryName}</span>
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate max-w-[180px] sm:max-w-none">
                    {getActiveFolderLabel()}
                  </span>
                )}
                
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono shrink-0">({filteredUploads.length})</span>
              </div>

              {/* Format Filter Quick Switcher */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar scroll-smooth">
                {[
                  { id: "ALL", label: "All Formats" },
                  { id: "PDF", label: "PDFs" },
                  { id: "IMAGE", label: "Images / Scans" },
                  { id: "SPREADSHEET", label: "Excel / Data" },
                  { id: "DOCUMENT", label: "Word / Docs" }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormat(fmt.id as FileFormatFilter)}
                    className={cn(
                      "px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer border shrink-0",
                      selectedFormat === fmt.id
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-2xs"
                        : "bg-slate-50 dark:bg-[#121214] border-slate-200 dark:border-[#27272a] text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-[#222227] hover:text-slate-900 dark:hover:text-zinc-200"
                    )}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Parish Ministries Folders Hub (When viewing Ministries Directory) */}
          {activeFolder === "MINISTRY_ALL" && (
            <div className="space-y-4 animate-in fade-in duration-200">

              {filteredMinistries.length === 0 ? (
                <div className="bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] p-10 text-center shadow-2xs space-y-3">
                  <FolderOpen size={32} className="mx-auto text-slate-400 dark:text-zinc-500" />
                  <p className="text-xs text-slate-500 dark:text-zinc-400">No ministry folders match "{searchQuery}".</p>
                </div>
              ) : viewMode === "grid" ? (
                /* 1. MINISTRIES GRID VIEW */
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
                    {paginatedMinistries.map((ministry) => (
                      <div
                        key={ministry.name}
                        onClick={() => setActiveFolder(`MINISTRY:${ministry.name}`)}
                        className="p-4 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-[#222227] rounded-2xl border border-slate-200/80 dark:border-[#27272a] hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center transition-colors border border-indigo-500/20">
                            <Folder className="w-5 h-5 fill-indigo-500/20" />
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#27272a] text-slate-700 dark:text-zinc-300 border border-slate-200/60 dark:border-transparent shadow-2xs">
                            {ministry.count} {ministry.count === 1 ? "file" : "files"}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                            {ministry.name}
                          </h4>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-[#27272a] flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-0.5 transition-transform">
                          <span>Open Folder</span>
                          <ChevronRight size={13} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs overflow-hidden">
                    {renderPaginationControls(ministriesPage, totalMinistriesPages, filteredMinistries.length, MINISTRIES_PER_PAGE, setMinistriesPage, "ministry folders")}
                  </div>
                </div>
              ) : viewMode === "table" ? (
                /* 2. MINISTRIES ROWS / TABLE VIEW */
                <div className="bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs overflow-hidden transition-colors">
                  {/* Desktop Wide Table */}
                  <div className="overflow-x-auto hidden lg:block">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-[#121214] border-b border-slate-200 dark:border-[#27272a] text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Ministry Folder</th>
                          <th className="py-3 px-4">Document Count</th>
                          <th className="py-3 px-4">Total Financial Value</th>
                          <th className="py-3 px-4">Archive Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#27272a]">
                        {paginatedMinistries.map((ministry) => (
                          <tr
                            key={ministry.name}
                            onClick={() => setActiveFolder(`MINISTRY:${ministry.name}`)}
                            className="hover:bg-slate-50/80 dark:hover:bg-[#222227] transition-colors cursor-pointer group"
                          >
                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                              <div className="flex items-center gap-2.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800/40">
                                  <Folder size={14} className="fill-indigo-500/20" />
                                </div>
                                <span>{ministry.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-zinc-300">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#27272a] text-[11px]">
                                {ministry.count} {ministry.count === 1 ? "file" : "files"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {ministry.totalAmount > 0 ? formatCurrency(ministry.totalAmount) : "—"}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase",
                                ministry.count > 0 ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "bg-slate-100 text-slate-500 dark:bg-[#27272a] dark:text-zinc-500"
                              )}>
                                {ministry.count > 0 ? "Active Archive" : "Empty"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveFolder(`MINISTRY:${ministry.name}`);
                                }}
                                className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                              >
                                <span>Open</span>
                                <ChevronRight size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Medium & Small Screens Card Rows */}
                  <div className="block lg:hidden divide-y divide-slate-100 dark:divide-[#27272a]">
                    {paginatedMinistries.map((ministry) => (
                      <div
                        key={ministry.name}
                        onClick={() => setActiveFolder(`MINISTRY:${ministry.name}`)}
                        className="p-4 hover:bg-slate-50/80 dark:hover:bg-[#222227] transition-colors cursor-pointer space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800/40">
                              <Folder size={15} className="fill-indigo-500/20" />
                            </div>
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {ministry.name}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#27272a] text-slate-700 dark:text-zinc-300 shrink-0">
                            {ministry.count} files
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-xs">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {ministry.totalAmount > 0 ? formatCurrency(ministry.totalAmount) : "No linked expenses"}
                          </span>
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                            <span>Open Folder</span>
                            <ChevronRight size={12} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 15-Row Pagination for Ministries Table */}
                  {renderPaginationControls(ministriesPage, totalMinistriesPages, filteredMinistries.length, MINISTRIES_PER_PAGE, setMinistriesPage, "ministry folders")}
                </div>
              ) : (
                /* 3. MINISTRIES SPLIT INSPECTOR VIEW */
                <div className="space-y-3">
                  {/* Mobile Tab Switcher (< lg) */}
                  <div className="flex lg:hidden items-center bg-slate-100 dark:bg-[#121214] p-1 rounded-2xl border border-slate-200 dark:border-[#27272a]">
                    <button
                      type="button"
                      onClick={() => setMobileMinistrySplitTab("list")}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        mobileMinistrySplitTab === "list"
                          ? "bg-white dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 shadow-2xs"
                          : "text-slate-500 dark:text-zinc-400"
                      )}
                    >
                      <Folder size={14} />
                      <span>Ministries ({filteredMinistries.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileMinistrySplitTab("details")}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        mobileMinistrySplitTab === "details"
                          ? "bg-white dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 shadow-2xs"
                          : "text-slate-500 dark:text-zinc-400"
                      )}
                    >
                      <Info size={14} />
                      <span>Folder Inspector</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left Ministries List (7 Cols) */}
                    <div className={cn(
                      "lg:col-span-7 bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs overflow-hidden transition-colors",
                      mobileMinistrySplitTab === "details" ? "hidden lg:block" : "block"
                    )}>
                      <div className="p-3.5 bg-slate-50 dark:bg-[#121214] border-b border-slate-200 dark:border-[#27272a] text-xs font-bold text-slate-700 dark:text-zinc-400 flex items-center justify-between">
                        <span>Ministries ({filteredMinistries.length})</span>
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500">Select to inspect folder</span>
                      </div>
                      <div className="max-h-[620px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#27272a] subtle-scrollbar">
                        {paginatedMinistries.map((ministry) => {
                          const isSelected = (selectedMinistryFolder || paginatedMinistries[0]?.name) === ministry.name;
                          return (
                            <div
                              key={ministry.name}
                              onClick={() => {
                                setSelectedMinistryFolder(ministry.name);
                                setMobileMinistrySplitTab("details");
                              }}
                              className={cn(
                                "p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#222227] transition-all cursor-pointer",
                                isSelected && "bg-slate-100 dark:bg-[#27272a] border-l-4 border-indigo-600 dark:border-indigo-500"
                              )}
                            >
                              <div className="flex items-center gap-3 truncate min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800/40">
                                  <Folder size={15} className="fill-indigo-500/20" />
                                </div>
                                <div className="truncate min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{ministry.name}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                                    {ministry.totalAmount > 0 ? formatCurrency(ministry.totalAmount) : "No linked expenses"}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200/60 dark:bg-[#18181b] text-slate-700 dark:text-zinc-300">
                                  {ministry.count} files
                                </span>
                                <ChevronRight size={14} className="text-slate-400 dark:text-zinc-500" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* 15-Row Pagination for Ministries Split View */}
                      {renderPaginationControls(ministriesPage, totalMinistriesPages, filteredMinistries.length, MINISTRIES_PER_PAGE, setMinistriesPage, "folders")}
                    </div>

                    {/* Right Ministry Inspector Pane (5 Cols) */}
                    {(() => {
                      const activeMinistryName = selectedMinistryFolder || filteredMinistries[0]?.name;
                      const activeMinistry = allAvailableMinistries.find(m => m.name === activeMinistryName);
                      const ministryFiles = scopedUploadsList.filter(item => (item.groupName || item.requisition?.groupName || "").trim().toLowerCase() === (activeMinistryName || "").trim().toLowerCase());
                      const pdfCount = ministryFiles.filter(f => f.fileType === "pdf").length;
                      const imgCount = ministryFiles.filter(f => f.fileType === "image").length;
                      const sheetCount = ministryFiles.filter(f => f.fileType === "spreadsheet").length;
                      const docCount = ministryFiles.filter(f => f.fileType === "document").length;

                      return (
                        <div className={cn(
                          "lg:col-span-5 bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] p-4 sm:p-5 shadow-2xs space-y-4 lg:sticky lg:top-4 transition-colors",
                          mobileMinistrySplitTab === "list" ? "hidden lg:block" : "block"
                        )}>
                          {/* Mobile Back Button */}
                          <div className="lg:hidden">
                            <button
                              type="button"
                              onClick={() => setMobileMinistrySplitTab("list")}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              <ArrowLeft size={14} />
                              <span>Back to Ministries List</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3">
                          <div className="flex items-center gap-2">
                            <Info size={16} className="text-indigo-600 dark:text-indigo-400" />
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">Ministry Folder Inspector</h3>
                          </div>
                          {activeMinistry && (
                            <button
                              type="button"
                              onClick={() => setActiveFolder(`MINISTRY:${activeMinistry.name}`)}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <span>Open Folder</span>
                              <ChevronRight size={12} />
                            </button>
                          )}
                        </div>

                        {activeMinistry ? (
                          <div className="space-y-4">
                            {/* Folder Hero Banner */}
                            <div className="p-4 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent rounded-2xl border border-indigo-500/20 flex items-center gap-3.5">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                                <Folder size={24} className="fill-white/20" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{activeMinistry.name}</h4>
                                <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                                  {activeMinistry.count} documents · {formatCurrency(activeMinistry.totalAmount)}
                                </p>
                              </div>
                            </div>

                            {/* Format Breakdown Badges */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2.5 bg-slate-50 dark:bg-[#121214] rounded-xl border border-slate-200/60 dark:border-[#27272a] flex items-center justify-between">
                                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 font-bold">
                                  <FileText size={13} className="text-purple-500" />
                                  <span>PDFs</span>
                                </span>
                                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{pdfCount}</span>
                              </div>
                              <div className="p-2.5 bg-slate-50 dark:bg-[#121214] rounded-xl border border-slate-200/60 dark:border-[#27272a] flex items-center justify-between">
                                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 font-bold">
                                  <ImageIcon size={13} className="text-amber-500" />
                                  <span>Images</span>
                                </span>
                                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{imgCount}</span>
                              </div>
                              <div className="p-2.5 bg-slate-50 dark:bg-[#121214] rounded-xl border border-slate-200/60 dark:border-[#27272a] flex items-center justify-between">
                                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 font-bold">
                                  <FileSpreadsheet size={13} className="text-emerald-500" />
                                  <span>Excel</span>
                                </span>
                                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{sheetCount}</span>
                              </div>
                              <div className="p-2.5 bg-slate-50 dark:bg-[#121214] rounded-xl border border-slate-200/60 dark:border-[#27272a] flex items-center justify-between">
                                <span className="text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 font-bold">
                                  <File size={13} className="text-blue-500" />
                                  <span>Docs</span>
                                </span>
                                <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{docCount}</span>
                              </div>
                            </div>

                            {/* Recent Ministry Files List */}
                            <div className="space-y-2">
                              <span className="text-xs font-bold uppercase text-slate-400 dark:text-zinc-500 tracking-wider block">
                                Recent Files in {activeMinistry.name}
                              </span>
                              {ministryFiles.length === 0 ? (
                                <p className="text-xs text-slate-400 italic py-2">No documents currently uploaded for this ministry.</p>
                              ) : (
                                <div className="space-y-1.5 max-h-48 overflow-y-auto subtle-scrollbar">
                                  {ministryFiles.slice(0, 4).map((file, fIdx) => (
                                    <div
                                      key={file.id}
                                      onClick={() => handleOpenProjection(filteredUploads.findIndex(i => i.id === file.id))}
                                      className="p-2 bg-slate-50 dark:bg-[#121214] hover:bg-slate-100 dark:hover:bg-[#222227] rounded-xl border border-slate-200/60 dark:border-[#27272a] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                                    >
                                      <div className="flex items-center gap-2 truncate min-w-0">
                                        <div className="w-6 h-6 rounded-md bg-white dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-slate-200 dark:border-[#3f3f46]">
                                          {file.fileType === "pdf" ? <FileText size={12} /> : file.fileType === "spreadsheet" ? <FileSpreadsheet size={12} /> : <ImageIcon size={12} />}
                                        </div>
                                        <div className="min-w-0 truncate">
                                          <div className="text-xs font-medium text-slate-800 dark:text-zinc-200 truncate" title={getItemDisplayTitle(file)}>
                                            {getItemDisplayTitle(file)}
                                          </div>
                                        </div>
                                      </div>
                                      <Eye size={13} className="text-slate-400 shrink-0" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveFolder(`MINISTRY:${activeMinistry.name}`)}
                                className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                              >
                                <FolderOpen size={14} />
                                <span>Browse All ({activeMinistry.count})</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setStagedFiles([]);
                                  setUploadMinistryGroup(activeMinistry.name);
                                  setIsUploadDrawerOpen(true);
                                }}
                                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] dark:hover:bg-[#323238] text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-[#3f3f46]"
                              >
                                <Upload size={14} />
                                <span>Upload</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-12 text-center text-slate-400">
                            <Folder size={32} className="mx-auto text-slate-300 dark:text-zinc-600" />
                            <p className="text-xs mt-2">Select a ministry on the left to inspect details.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

          {/* Batch Actions Strip (When files selected) */}
          {selectedItemIds.size > 0 && (
            <div className="sticky bottom-3 sm:static z-30 bg-indigo-600 text-white p-3 sm:px-5 sm:py-3 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shadow-xl shadow-indigo-600/30 animate-in slide-in-from-bottom-2 duration-200 border border-indigo-400/20">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-indigo-700/80 px-2.5 py-1 rounded-lg">
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

                <button
                  type="button"
                  onClick={() => setSelectedItemIds(new Set())}
                  className="sm:hidden p-1.5 hover:bg-indigo-700 rounded-lg text-white/80 hover:text-white cursor-pointer"
                  title="Clear selection"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => handleOpenProjection(0)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Eye size={14} />
                  <span>Preview ({selectedItemIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchDownload}
                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchCopyLinks}
                  className="flex-1 sm:flex-initial px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Copy size={14} />
                  <span>Copy URLs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemIds(new Set())}
                  className="hidden sm:block p-1.5 hover:bg-indigo-700 rounded-lg text-white/80 hover:text-white cursor-pointer ml-auto"
                  title="Clear selection"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          {activeFolder === "ANALYTICS" ? (
            /* 0. ANALYTICS & METRICS DASHBOARD VIEW */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Top Overview KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#18181b] p-5 rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Total Documents</span>
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <FolderOpen size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {metrics.total}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Across {metrics.activeMinistriesCount} active parish ministries
                  </p>
                </div>

                <div className="bg-white dark:bg-[#18181b] p-5 rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Financial Backing</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Coins size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(metrics.totalValue)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Linked to verified vouchers & receipts
                  </p>
                </div>

                <div className="bg-white dark:bg-[#18181b] p-5 rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Storage Footprint</span>
                    <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <HardDrive size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                    {((metrics.pdfs * 1.2 + metrics.images * 1.8 + metrics.spreadsheets * 0.4 + metrics.documents * 0.6) || 0).toFixed(1)} MB
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Estimated cloud document storage
                  </p>
                </div>

                <div className="bg-white dark:bg-[#18181b] p-5 rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Ministry Coverage</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Building2 size={16} />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {metrics.activeMinistriesCount} / {metrics.totalMinistries}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Ministries with active uploaded records
                  </p>
                </div>
              </div>

              {/* Format Distribution & File Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* File Format Distribution */}
                <div className="bg-white dark:bg-[#18181b] p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">Format Distribution</h3>
                    </div>
                    <span className="text-xs font-mono text-slate-400 dark:text-zinc-500">{metrics.total} files</span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "PDF Documents", count: metrics.pdfs, color: "bg-purple-500", textColor: "text-purple-600 dark:text-purple-400", filterId: "FMT:pdf", icon: FileText },
                      { label: "Images & Photos", count: metrics.images, color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400", filterId: "FMT:image", icon: ImageIcon },
                      { label: "Spreadsheets (Excel/CSV)", count: metrics.spreadsheets, color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400", filterId: "FMT:spreadsheet", icon: FileSpreadsheet },
                      { label: "Word Documents", count: metrics.documents, color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400", filterId: "FMT:document", icon: File }
                    ].map((item) => {
                      const pct = metrics.total > 0 ? Math.round((item.count / metrics.total) * 100) : 0;
                      const Icon = item.icon;
                      return (
                        <div 
                          key={item.label}
                          onClick={() => setActiveFolder(item.filterId)}
                          className="p-3 bg-slate-50 dark:bg-[#121214] hover:bg-slate-100 dark:hover:bg-[#222227] rounded-2xl border border-slate-200/60 dark:border-[#27272a] cursor-pointer transition-all space-y-2 group"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              <Icon size={14} className={item.textColor} />
                              <span>{item.label}</span>
                            </span>
                            <span className="font-mono font-bold text-slate-600 dark:text-zinc-400">
                              {item.count} files ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 dark:bg-[#27272a] rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Ministries by Upload Volume */}
                <div className="bg-white dark:bg-[#18181b] p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">Top Ministries by Volume</h3>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setActiveFolder("MINISTRY_ALL")} 
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      View All
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[290px] overflow-y-auto subtle-scrollbar pr-1">
                    {allAvailableMinistries.slice(0, 7).map((ministry) => {
                      const maxCount = Math.max(...allAvailableMinistries.map(m => m.count), 1);
                      const barPct = Math.round((ministry.count / maxCount) * 100);
                      return (
                        <div 
                          key={ministry.name}
                          onClick={() => setActiveFolder(`MINISTRY:${ministry.name}`)}
                          className="p-3 bg-slate-50 dark:bg-[#121214] hover:bg-slate-100 dark:hover:bg-[#222227] rounded-2xl border border-slate-200/60 dark:border-[#27272a] cursor-pointer transition-all space-y-1.5 group"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-800 dark:text-zinc-200 truncate max-w-[200px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {ministry.name}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                              {ministry.count} files · {formatCurrency(ministry.totalAmount)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-[#27272a] rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${barPct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick Navigation Footer */}
              <div className="p-5 bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white">Ready to explore document files?</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Switch back to any folder or view format anytime from the side navigator.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveFolder("ALL")}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    Browse All Documents
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFolder("MINISTRY_ALL")}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] dark:hover:bg-[#323238] text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-[#3f3f46]"
                  >
                    Browse Ministries
                  </button>
                </div>
              </div>
            </div>
          ) : activeFolder === "MINISTRY_ALL" ? (
            /* Parish Ministries Directory is the full main view for this folder */
            null
          ) : (
            <div className="space-y-4">

              {filteredUploads.length === 0 ? (
                <div className="bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] p-12 text-center shadow-2xs space-y-4 transition-colors">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-[#27272a] text-slate-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
                    <FolderOpen size={32} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">No documents found in this directory</h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                      {searchQuery 
                        ? `No files match your search query "${searchQuery}". Try clearing filters.` 
                        : currentMinistryName 
                          ? `There are currently no uploaded documents or receipts for the "${currentMinistryName}" ministry.`
                          : "There are currently no uploaded documents matching the selected criteria."}
                    </p>
                  </div>
                  <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                    {currentMinistryName && (
                      <button
                        type="button"
                        onClick={() => setActiveFolder("MINISTRY_ALL")}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800/80 flex items-center gap-2 shadow-2xs group"
                      >
                        <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
                        <span>Back to Folders</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFolder("ALL");
                        setSelectedFormat("ALL");
                        setSelectedGroup("ALL");
                        setSelectedStatus("ALL");
                        setSearchQuery("");
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] dark:hover:bg-[#323238] text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-[#3f3f46]"
                    >
                      Reset All Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStagedFiles([]);
                        if (currentMinistryName) {
                          setUploadMinistryGroup(currentMinistryName);
                        }
                        setIsUploadDrawerOpen(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                      Upload New File
                    </button>
                  </div>
                </div>
          ) : viewMode === "grid" ? (
            /* 1. GRID CARDS VIEW */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {paginatedUploads.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  const openThisItem = () => {
                    const pIdx = projectionItemsList.findIndex(p => p.id === item.id);
                    handleOpenProjection(pIdx >= 0 ? pIdx : 0);
                  };
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "bg-white dark:bg-[#18181b] rounded-2xl border overflow-hidden shadow-2xs transition-all group hover:shadow-lg dark:hover:shadow-xl hover:border-slate-300 dark:hover:border-[#3f3f46] flex flex-col relative",
                        isSelected
                          ? "border-indigo-500 ring-2 ring-indigo-500/20"
                          : "border-slate-200/80 dark:border-[#27272a]"
                      )}
                    >
                      {/* Media Thumbnail Box */}
                      <div 
                        className="aspect-[4/3] bg-slate-100 dark:bg-[#121214] relative overflow-hidden flex items-center justify-center cursor-pointer select-none"
                        onClick={openThisItem}
                      >
                        {item.fileType === "image" ? (
                          <CachedImage
                            src={item.url}
                            alt={getItemDisplayTitle(item)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : item.fileType === "pdf" ? (
                          <div className="w-full h-full p-2 flex items-center justify-center">
                            <PdfThumbnailPreview
                              url={item.url}
                              title={getItemDisplayTitle(item)}
                              className="w-full h-full max-h-36 object-contain shadow-2xs rounded-lg"
                            />
                          </div>
                        ) : item.fileType === "spreadsheet" ? (
                          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                            <FileSpreadsheet size={32} />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner">
                            <FileText size={32} />
                          </div>
                        )}

                        {/* Multi-select Checkbox */}
                        <div 
                          onClick={(e) => toggleSelectItem(item.id, e)}
                          className="absolute top-2 left-2 z-10 p-2 sm:p-1.5 rounded-xl bg-white/90 dark:bg-black/70 backdrop-blur-md text-slate-700 dark:text-white border border-slate-200/60 dark:border-transparent hover:bg-white dark:hover:bg-black/90 transition-all cursor-pointer shadow-2xs active:scale-95"
                        >
                          {isSelected ? <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" /> : <Square size={16} className="text-slate-400 dark:text-zinc-400" />}
                        </div>

                        {/* File Format Badge */}
                        <div className="absolute top-2.5 right-2.5 z-10">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider backdrop-blur-md shadow-2xs",
                            item.fileType === "pdf" && "bg-purple-600 text-white",
                            item.fileType === "image" && "bg-amber-600 text-white",
                            item.fileType === "spreadsheet" && "bg-emerald-600 text-white",
                            item.fileType === "document" && "bg-blue-600 text-white",
                            item.fileType === "other" && "bg-slate-700 text-white"
                          )}>
                            {item.fileType}
                          </span>
                        </div>

                        {/* Hover Open Button Overlay */}
                        <div className="absolute inset-0 bg-black/40 dark:bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openThisItem();
                            }}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer transform group-hover:scale-100 scale-95 transition-all"
                          >
                            <Eye size={14} />
                            <span>Inspect File</span>
                          </button>
                        </div>
                      </div>

                      {/* Metadata Body */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                        <div>
                          <h4 
                            className="text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" 
                            title={getItemDisplayTitle(item)}
                            onClick={openThisItem}
                          >
                            {getItemDisplayTitle(item)}
                          </h4>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                            <span 
                              className="truncate max-w-[130px] font-medium text-slate-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer" 
                              title={item.groupName}
                              onClick={() => {
                                if (item.groupName) {
                                  setActiveFolder(`MINISTRY:${item.groupName}`);
                                }
                              }}
                            >
                              {item.groupName || "Parish Ministry"}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                              {formatDate(item.date)}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer with Requisition Link & Direct Actions */}
                        <div className="pt-2 border-t border-slate-100 dark:border-[#27272a] flex items-center justify-between text-[11px]">
                          {item.requisition ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (item.requisition) {
                                  setSelectedRequisition(item.requisition);
                                  onViewRequisition?.(item.requisition);
                                }
                              }}
                              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer truncate max-w-[110px]"
                              title={`Jump to Requisition #${item.requisition.id}`}
                            >
                              #{item.requisition.id}
                            </button>
                          ) : item.project ? (
                            <span className="text-cyan-600 dark:text-cyan-400 font-bold truncate max-w-[110px]" title={item.project.name}>
                              {item.project.id || "Project"}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500 text-[10px] italic">Direct Upload</span>
                          )}

                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <button
                              type="button"
                              onClick={openThisItem}
                              className="p-2 sm:p-1.5 text-slate-400 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-[#27272a] cursor-pointer transition-colors"
                              title="Preview file"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDownload(item, e)}
                              className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#27272a] cursor-pointer transition-colors"
                              title="Download file"
                            >
                              <Download size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleCopyUri(item, e)}
                              className="p-2 sm:p-1.5 text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#27272a] cursor-pointer transition-colors"
                              title="Copy link"
                            >
                              {copiedId === item.id ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 15-Row Pagination for Files Grid View */}
              <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs overflow-hidden">
                {renderPaginationControls(filesPage, totalFilesPages, filteredUploads.length, FILES_PER_PAGE, setFilesPage, "documents")}
              </div>
            </div>
          ) : viewMode === "table" ? (
            /* 2. TABLE EXPLORER VIEW */
            <div className="bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs overflow-hidden transition-colors">
              {/* Large Screen Wide Data Table */}
              <div className="overflow-x-auto hidden lg:block">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#121214] border-b border-slate-200 dark:border-[#27272a] text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <button type="button" onClick={selectAllFiltered} className="cursor-pointer">
                          {selectedItemIds.size === filteredUploads.length && filteredUploads.length > 0 ? (
                            <CheckSquare size={15} className="text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square size={15} className="text-slate-400 dark:text-zinc-500" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4">Requisition Title</th>
                      <th className="py-3 px-4">Format</th>
                      <th className="py-3 px-4">Ministry / Department</th>
                      <th className="py-3 px-4">Requisition / Project</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Date Uploaded</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#27272a]">
                    {paginatedUploads.map((item) => {
                      const isSelected = selectedItemIds.has(item.id);
                      const openThisItem = () => {
                        const pIdx = projectionItemsList.findIndex(p => p.id === item.id);
                        handleOpenProjection(pIdx >= 0 ? pIdx : 0);
                      };
                      return (
                        <tr 
                          key={item.id}
                          className={cn(
                            "hover:bg-slate-50/80 dark:hover:bg-[#222227] transition-colors cursor-pointer",
                            isSelected && "bg-indigo-50/70 dark:bg-indigo-950/20"
                          )}
                          onClick={() => setInspectorItem(item)}
                        >
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={(e) => toggleSelectItem(item.id, e)} className="cursor-pointer">
                              {isSelected ? <CheckSquare size={15} className="text-indigo-600 dark:text-indigo-400" /> : <Square size={15} className="text-slate-400 dark:text-zinc-500" />}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                            <div 
                              className="flex items-center gap-2.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              onClick={openThisItem}
                            >
                              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-slate-200 dark:border-[#3f3f46]">
                                {item.fileType === "pdf" ? <FileText size={14} /> : item.fileType === "spreadsheet" ? <FileSpreadsheet size={14} /> : <ImageIcon size={14} />}
                              </div>
                              <div className="min-w-0">
                                <span className="truncate max-w-xs block font-bold text-xs" title={getItemDisplayTitle(item)}>
                                  {getItemDisplayTitle(item)}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase",
                              item.fileType === "pdf" && "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800/40",
                              item.fileType === "image" && "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/40",
                              item.fileType === "spreadsheet" && "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/40",
                              item.fileType === "document" && "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800/40",
                              item.fileType === "other" && "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
                            )}>
                              {item.fileType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300 font-medium">
                            <span 
                              className="hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.groupName) {
                                  setActiveFolder(`MINISTRY:${item.groupName}`);
                                }
                              }}
                            >
                              {item.groupName || "Parish Ministry"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
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
                            ) : item.project ? (
                              <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                                {item.project.id || "Project"}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-zinc-500 italic">Direct</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-zinc-300">
                            {item.amount ? formatCurrency(item.amount) : "—"}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                            {formatDate(item.date)}
                          </td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={openThisItem}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 dark:hover:bg-[#323238] cursor-pointer transition-colors"
                                title="Open File Preview"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDownload(item, e)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] text-slate-700 dark:text-zinc-300 dark:hover:bg-[#323238] cursor-pointer transition-colors"
                                title="Download File"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleCopyUri(item, e)}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] text-slate-700 dark:text-zinc-300 dark:hover:bg-[#323238] cursor-pointer transition-colors"
                                title="Copy Direct URL"
                              >
                                {copiedId === item.id ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Medium & Small Screens Table Row Cards Layout */}
              <div className="block lg:hidden divide-y divide-slate-100 dark:divide-[#27272a]">
                <div className="p-3 bg-slate-50 dark:bg-[#121214] border-b border-slate-200 dark:border-[#27272a] flex items-center justify-between text-xs font-bold text-slate-500 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={selectAllFiltered} className="cursor-pointer">
                      {selectedItemIds.size === filteredUploads.length && filteredUploads.length > 0 ? (
                        <CheckSquare size={15} className="text-indigo-600 dark:text-indigo-400" />
                      ) : (
                        <Square size={15} className="text-slate-400 dark:text-zinc-500" />
                      )}
                    </button>
                    <span>All Documents ({filteredUploads.length})</span>
                  </div>
                  <span className="text-[11px] font-mono">{selectedItemIds.size} Selected</span>
                </div>

                {paginatedUploads.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  const openThisItem = () => {
                    const pIdx = projectionItemsList.findIndex(p => p.id === item.id);
                    handleOpenProjection(pIdx >= 0 ? pIdx : 0);
                  };
                  return (
                    <div
                      key={item.id}
                      onClick={() => setInspectorItem(item)}
                      className={cn(
                        "p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-[#222227] transition-colors cursor-pointer space-y-3",
                        isSelected && "bg-indigo-50/70 dark:bg-indigo-950/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <button 
                            type="button" 
                            onClick={(e) => toggleSelectItem(item.id, e)} 
                            className="mt-0.5 cursor-pointer shrink-0"
                          >
                            {isSelected ? <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" /> : <Square size={16} className="text-slate-400 dark:text-zinc-500" />}
                          </button>

                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-slate-200 dark:border-[#3f3f46]">
                            {item.fileType === "pdf" ? <FileText size={16} /> : item.fileType === "spreadsheet" ? <FileSpreadsheet size={16} /> : <ImageIcon size={16} />}
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <h4 
                              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                openThisItem();
                              }}
                              title={getItemDisplayTitle(item)}
                            >
                              {getItemDisplayTitle(item)}
                            </h4>
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span 
                                className="font-semibold text-slate-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.groupName) setActiveFolder(`MINISTRY:${item.groupName}`);
                                }}
                              >
                                💒 {item.groupName || "Parish Ministry"}
                              </span>
                              {item.requisition ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRequisition(item.requisition!);
                                    onViewRequisition?.(item.requisition!);
                                  }}
                                  className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                                >
                                  #{item.requisition.id}
                                </button>
                              ) : item.project ? (
                                <span className="text-cyan-600 dark:text-cyan-400 font-bold">
                                  {item.project.id}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase shrink-0",
                          item.fileType === "pdf" && "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800/40",
                          item.fileType === "image" && "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/40",
                          item.fileType === "spreadsheet" && "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/40",
                          item.fileType === "document" && "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800/40",
                          item.fileType === "other" && "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
                        )}>
                          {item.fileType}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#27272a] text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                            {item.amount ? formatCurrency(item.amount) : "—"}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                            {formatDate(item.date)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={openThisItem}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 dark:hover:bg-[#323238] cursor-pointer transition-colors"
                            title="Preview File"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDownload(item, e)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] text-slate-700 dark:text-zinc-300 dark:hover:bg-[#323238] cursor-pointer transition-colors"
                            title="Download File"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopyUri(item, e)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] text-slate-700 dark:text-zinc-300 dark:hover:bg-[#323238] cursor-pointer transition-colors"
                            title="Copy Direct URL"
                          >
                            {copiedId === item.id ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 15-Row Pagination for Files Table View */}
              {renderPaginationControls(filesPage, totalFilesPages, filteredUploads.length, FILES_PER_PAGE, setFilesPage, "documents")}
            </div>
          ) : (
            /* 3. SPLIT INSPECTOR VIEW */
            (() => {
              const activeInspectorItem = inspectorItem || paginatedUploads[0] || filteredUploads[0];
              return (
                <div className="space-y-3">
                  {/* Mobile Tab Switcher (< lg) */}
                  <div className="flex lg:hidden items-center bg-slate-100 dark:bg-[#121214] p-1 rounded-2xl border border-slate-200 dark:border-[#27272a]">
                    <button
                      type="button"
                      onClick={() => setMobileSplitTab("list")}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        mobileSplitTab === "list"
                          ? "bg-white dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 shadow-2xs"
                          : "text-slate-500 dark:text-zinc-400"
                      )}
                    >
                      <List size={14} />
                      <span>Files List ({filteredUploads.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileSplitTab("details")}
                      className={cn(
                        "flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                        mobileSplitTab === "details"
                          ? "bg-white dark:bg-[#27272a] text-indigo-600 dark:text-indigo-400 shadow-2xs"
                          : "text-slate-500 dark:text-zinc-400"
                      )}
                    >
                      <Info size={14} />
                      <span>Document Details</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Files Table (Left 7 Cols) */}
                    <div className={cn(
                      "lg:col-span-7 bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] shadow-2xs overflow-hidden transition-colors",
                      mobileSplitTab === "details" ? "hidden lg:block" : "block"
                    )}>
                      <div className="p-3.5 bg-slate-50 dark:bg-[#121214] border-b border-slate-200 dark:border-[#27272a] text-xs font-bold text-slate-700 dark:text-zinc-400 flex items-center justify-between">
                        <span>Files List ({filteredUploads.length})</span>
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500">Click any row to inspect details</span>
                      </div>
                      <div className="max-h-[650px] overflow-y-auto divide-y divide-slate-100 dark:divide-[#27272a] subtle-scrollbar">
                        {paginatedUploads.map((item) => {
                          const isSelected = activeInspectorItem?.id === item.id;
                          return (
                            <div
                              key={item.id}
                              onClick={() => {
                                setInspectorItem(item);
                                setMobileSplitTab("details");
                              }}
                              className={cn(
                                "p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#222227] transition-all cursor-pointer",
                                isSelected && "bg-slate-100 dark:bg-[#27272a] border-l-4 border-indigo-600 dark:border-indigo-500"
                              )}
                            >
                              <div className="flex items-center gap-3 truncate min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-[#121214] text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-slate-200 dark:border-[#27272a]">
                                  {item.fileType === "pdf" ? <FileText size={15} /> : item.fileType === "spreadsheet" ? <FileSpreadsheet size={15} /> : <ImageIcon size={15} />}
                                </div>
                                <div className="truncate min-w-0">
                                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate" title={getItemDisplayTitle(item)}>
                                    {getItemDisplayTitle(item)}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{item.groupName} · {formatDate(item.date)}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[9px] font-black uppercase",
                                  item.fileType === "pdf" && "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
                                  item.fileType === "image" && "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                                  item.fileType === "spreadsheet" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                                  item.fileType === "document" && "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                                  item.fileType === "other" && "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400"
                                )}>
                                  {item.fileType}
                                </span>
                                <ChevronRight size={14} className="text-slate-400 dark:text-zinc-500" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* 15-Row Pagination for Files Split View */}
                      {renderPaginationControls(filesPage, totalFilesPages, filteredUploads.length, FILES_PER_PAGE, setFilesPage, "files")}
                    </div>

                    {/* Inspector Pane (Right 5 Cols) */}
                    <div className={cn(
                      "lg:col-span-5 bg-white dark:bg-[#18181b] rounded-3xl border border-slate-200/80 dark:border-[#27272a] p-4 sm:p-5 shadow-2xs space-y-4 lg:sticky lg:top-4 transition-colors",
                      mobileSplitTab === "list" ? "hidden lg:block" : "block"
                    )}>
                      {/* Mobile Back Button */}
                      <div className="lg:hidden">
                        <button
                          type="button"
                          onClick={() => setMobileSplitTab("list")}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          <ArrowLeft size={14} />
                          <span>Back to Files List</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3">
                      <div className="flex items-center gap-2">
                        <Info size={16} className="text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-sm font-black text-slate-900 dark:text-white">Document Details</h3>
                      </div>
                    </div>

                    {activeInspectorItem ? (
                      <div className="space-y-4">
                        {/* Preview Thumbnail Box */}
                        <div className="aspect-[16/10] bg-slate-50 dark:bg-[#121214] rounded-2xl border border-slate-200/80 dark:border-[#27272a] overflow-hidden flex items-center justify-center p-2 relative group">
                          {activeInspectorItem.fileType === "image" ? (
                            <CachedImage
                              src={activeInspectorItem.url}
                              alt={getItemDisplayTitle(activeInspectorItem)}
                              className="w-full h-full object-contain"
                            />
                          ) : activeInspectorItem.fileType === "pdf" ? (
                            <PdfThumbnailPreview
                              url={activeInspectorItem.url}
                              title={getItemDisplayTitle(activeInspectorItem)}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-zinc-400">
                              <FileText size={48} className="text-indigo-600 dark:text-indigo-400" />
                              <span className="text-xs font-bold">{activeInspectorItem.fileType.toUpperCase()} Document</span>
                            </div>
                          )}
                        </div>

                        {/* Metadata Specs Table */}
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#27272a]">
                            <span className="text-slate-500 dark:text-zinc-400">Requisition Title</span>
                            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]" title={getItemDisplayTitle(activeInspectorItem)}>
                              {getItemDisplayTitle(activeInspectorItem)}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#27272a]">
                            <span className="text-slate-500 dark:text-zinc-400">File Name</span>
                            <span className="font-mono text-slate-600 dark:text-zinc-300 truncate max-w-[200px]" title={activeInspectorItem.fileName}>
                              {activeInspectorItem.fileName}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#27272a]">
                            <span className="text-slate-500 dark:text-zinc-400">Format Type</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 uppercase">{activeInspectorItem.fileType}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#27272a]">
                            <span className="text-slate-500 dark:text-zinc-400">Ministry / Group</span>
                            <span className="font-bold text-slate-900 dark:text-white">{activeInspectorItem.groupName || "Parish"}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#27272a]">
                            <span className="text-slate-500 dark:text-zinc-400">Upload Date</span>
                            <span className="font-mono text-slate-700 dark:text-zinc-300">{formatDate(activeInspectorItem.date)}</span>
                          </div>
                          {activeInspectorItem.requisition && (
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#27272a]">
                              <span className="text-slate-500 dark:text-zinc-400">Requisition Ref</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (activeInspectorItem.requisition) {
                                    setSelectedRequisition(activeInspectorItem.requisition);
                                    onViewRequisition?.(activeInspectorItem.requisition);
                                  }
                                }}
                                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                #{activeInspectorItem.requisition.id} - {activeInspectorItem.requisition.title?.substring(0, 20)}...
                              </button>
                            </div>
                          )}
                          {activeInspectorItem.amount ? (
                            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-[#27272a]">
                              <span className="text-slate-500 dark:text-zinc-400">Financial Value</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(activeInspectorItem.amount)}</span>
                            </div>
                          ) : null}
                          {activeInspectorItem.notes && (
                            <div className="py-1">
                              <span className="text-slate-500 dark:text-zinc-400 block mb-1">Notes / Description</span>
                              <p className="text-slate-700 dark:text-zinc-300 text-xs bg-slate-50 dark:bg-[#121214] p-2.5 rounded-xl border border-slate-200 dark:border-[#27272a]">
                                {activeInspectorItem.notes}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <button
                            type="button"
                            onClick={(e) => handleDownload(activeInspectorItem, e)}
                            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] dark:hover:bg-[#323238] text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-[#3f3f46]"
                          >
                            <Download size={14} />
                            <span>Download</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleCopyUri(activeInspectorItem, e)}
                            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] dark:hover:bg-[#323238] text-slate-800 dark:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-[#3f3f46]"
                          >
                            {copiedId === activeInspectorItem.id ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
                            <span>Copy Link</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="py-16 text-center text-slate-400 dark:text-zinc-500 space-y-2">
                        <Folder size={32} className="mx-auto text-slate-300 dark:text-zinc-600" />
                        <p className="text-xs">Select any file on the left to inspect its detailed specifications.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  </div>

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
          title="File Manager & Document Hub"
          groupName="St. Andrew's Parish Master Repository"
        />
      )}

      {/* Upload Documents Drawer / Modal with Camera Scanner */}
      <AnimatePresence>
        {isUploadDrawerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-white dark:bg-[#18181b] rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-[#27272a] shadow-2xl overflow-hidden p-4 sm:p-6 space-y-4 sm:space-y-5 transition-colors"
            >
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#27272a] pb-3 sm:pb-4 shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white truncate">Upload New Documents</h3>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 truncate">Add files or scanned receipts to parish ministry folders</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadDrawerOpen(false)}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-[#27272a] cursor-pointer transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto pr-1 subtle-scrollbar space-y-4">
                
                {/* Camera Capture Mode */}
                {isCameraActive ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Camera size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Live Document Scanner</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCameraActive(false)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white underline cursor-pointer"
                      >
                        Switch to File Upload
                      </button>
                    </div>
                    <CameraCapture 
                      onCapture={handleCameraCaptureFile} 
                      onClose={() => setIsCameraActive(false)}
                    />
                  </div>
                ) : (
                  <>
                    {/* Drag and Drop Zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-500/70 dark:border-[#27272a] dark:hover:border-indigo-500/50 bg-slate-50 dark:bg-[#121214] rounded-2xl p-6 text-center cursor-pointer transition-all group"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.xlsx,.xls,.csv,.docx,.doc"
                        onChange={handleFilesSelected}
                        className="hidden"
                      />
                      <div className="w-12 h-12 rounded-2xl bg-slate-200/80 group-hover:bg-indigo-600/10 dark:bg-[#27272a] dark:group-hover:bg-indigo-600/20 text-slate-500 group-hover:text-indigo-600 dark:text-zinc-400 dark:group-hover:text-indigo-400 flex items-center justify-center mx-auto mb-3 transition-colors">
                        <Upload size={24} />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">Click or drag files here to stage</p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">Supports PDF, PNG, JPG, WEBP, Excel, and Word</p>
                    </div>

                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setIsCameraActive(true)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] dark:hover:bg-[#323238] text-emerald-700 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-500/30 transition-all cursor-pointer shadow-2xs"
                      >
                        <Camera size={14} />
                        <span>Use Camera Scanner</span>
                      </button>
                    </div>
                  </>
                )}

                {/* Staged Files Preview List */}
                {stagedFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-wider block">
                      Staged Documents ({stagedFiles.length})
                    </span>
                    <div className="space-y-2 max-h-40 overflow-y-auto subtle-scrollbar">
                      {stagedFiles.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-[#121214] rounded-xl border border-slate-200 dark:border-[#27272a]"
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <FileText size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{f.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">({f.size})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveStagedFile(f.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 rounded cursor-pointer transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Document Metadata Form */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-[#27272a]">
                  {/* Ministry Group Assignment */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-wider block mb-1.5">
                      Parish Ministry / Department Folder
                    </label>
                    <select
                      value={uploadMinistryGroup}
                      onChange={(e) => setUploadMinistryGroup(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#27272a] rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {allAvailableMinistries.map((m) => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Optional Requisition Link */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-wider block mb-1.5">
                      Link to Existing Requisition (Optional)
                    </label>
                    <select
                      value={uploadTargetRequisitionId}
                      onChange={(e) => setUploadTargetRequisitionId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#27272a] rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="">None (Save as Standalone Ministry Document)</option>
                      {requisitions.slice(0, 30).map((r) => (
                        <option key={r.id} value={r.id}>
                          #{r.id} - {r.title} ({r.groupName}) [{formatCurrency(r.amount)}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes / Description */}
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-wider block mb-1.5">
                      Notes / Description (Optional)
                    </label>
                    <textarea
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      rows={2}
                      placeholder="e.g., Sunday service sound equipment repair receipt or ministry project notes"
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#27272a] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Drawer Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#27272a] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsUploadDrawerOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#27272a] dark:hover:bg-[#323238] text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={stagedFiles.length === 0 || isUploading}
                  onClick={handleSaveStagedFiles}
                  className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{isUploading ? "Saving..." : `Save ${stagedFiles.length} File(s)`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
