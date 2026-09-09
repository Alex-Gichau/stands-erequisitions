/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo } from "react";
import { 
  Upload, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Camera, 
  Trash2, 
  Download, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  ExternalLink, 
  Tag, 
  Layers, 
  FolderPlus, 
  Copy, 
  Check, 
  RefreshCw,
  Sparkles,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  cn, 
  normalizeAttachmentUrl, 
  getAttachmentFileName, 
  handleImageError, 
  formatCurrency 
} from "../lib/utils";
import { processFileToAttachmentStrings } from "../lib/pdfUtils";
import { useRequisitions } from "../contexts/RequisitionContext";
import { CameraCapture } from "./CameraCapture";
import { AttachmentProjectionModal } from "./AttachmentProjectionModal";
import { PdfThumbnailPreview } from "./PdfThumbnailPreview";
import { Requisition } from "../types";

export interface FileUploadItem {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: string;
  dataUrl: string; // RFC 2397 Data URI or server URL
  category: "RECEIPT" | "INVOICE" | "QUOTATION" | "DELIVERY_NOTE" | "LPO" | "PAYMENT_SLIP" | "OTHER";
  uploadedToServer?: boolean;
  serverUrl?: string;
  error?: string;
}

export const ATTACHMENT_CATEGORIES = [
  { id: "RECEIPT", label: "Official Receipt", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  { id: "INVOICE", label: "Tax Invoice", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { id: "QUOTATION", label: "Quotation / Proforma", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  { id: "DELIVERY_NOTE", label: "Delivery Note", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { id: "LPO", label: "LPO / Purchase Order", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20" },
  { id: "PAYMENT_SLIP", label: "Payment Slip / M-Pesa", color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20" },
  { id: "OTHER", label: "General Supporting Doc", color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
] as const;

interface FileUploadProjectionCenterProps {
  onAttachToRequisition?: (attachments: string[]) => void;
  targetRequisition?: Requisition;
  onClose?: () => void;
}

export const FileUploadProjectionCenter: React.FC<FileUploadProjectionCenterProps> = ({
  onAttachToRequisition,
  targetRequisition,
  onClose
}) => {
  const { requisitions, triggerToast, currentUser } = useRequisitions();
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Projection Modal State
  const [projectorOpen, setProjectorOpen] = useState<boolean>(false);
  const [projectorInitialIndex, setProjectorInitialIndex] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Process incoming files
  const processFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    for (const file of fileList) {
      try {
        const formattedArray = await processFileToAttachmentStrings(file);
        const formattedStr = formattedArray[0] || "";
        let dataUrl = formattedStr;
        let name = file.name;

        if (formattedStr.includes("::")) {
          const parts = formattedStr.split("::");
          name = parts[0];
          dataUrl = parts.slice(1).join("::");
        }

        // Detect default category from filename
        let defaultCategory: FileUploadItem["category"] = "OTHER";
        const lower = name.toLowerCase();
        if (lower.includes("receipt") || lower.includes("rcpt")) defaultCategory = "RECEIPT";
        else if (lower.includes("invoice") || lower.includes("inv")) defaultCategory = "INVOICE";
        else if (lower.includes("quote") || lower.includes("proforma")) defaultCategory = "QUOTATION";
        else if (lower.includes("delivery") || lower.includes("dn")) defaultCategory = "DELIVERY_NOTE";
        else if (lower.includes("lpo") || lower.includes("po")) defaultCategory = "LPO";
        else if (lower.includes("mpesa") || lower.includes("slip") || lower.includes("bank")) defaultCategory = "PAYMENT_SLIP";

        const newItem: FileUploadItem = {
          id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          name,
          size: file.size,
          type: file.type || "application/octet-stream",
          dataUrl,
          category: defaultCategory,
          uploadedToServer: false,
        };

        setItems((prev) => [...prev, newItem]);
      } catch (err: any) {
        console.error("Error processing uploaded file:", err);
        triggerToast?.({
          type: "SYSTEM_INFO",
          message: "Failed to process " + file.name,
          severity: "HIGH",
          timestamp: new Date().toISOString()
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCameraCapture = (file: File) => {
    setIsCameraOpen(false);
    processFiles([file]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateCategory = (id: string, category: FileUploadItem["category"]) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, category } : item))
    );
  };

  // Upload all items to backend storage (/api/attachments/upload)
  const uploadAllToServer = async () => {
    if (items.length === 0) return;
    setIsUploading(true);

    try {
      let successCount = 0;
      const updatedItems = await Promise.all(
        items.map(async (item) => {
          if (item.uploadedToServer && item.serverUrl) return item;

          try {
            // Post to existing upload endpoint: /api/attachments/upload without changing data upload path
            const payload = {
              fileName: item.name,
              dataUrl: item.dataUrl,
            };

            const response = await fetch("/api/attachments/upload", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });

            if (response.ok) {
              const resData = await response.json();
              successCount++;
              return {
                ...item,
                uploadedToServer: true,
                serverUrl: resData.url,
                error: undefined,
              };
            } else {
              const err = await response.text();
              return {
                ...item,
                error: `Upload failed (${response.status})`,
              };
            }
          } catch (e: any) {
            return {
              ...item,
              error: e.message || "Network upload error",
            };
          }
        })
      );

      setItems(updatedItems);
      if (successCount > 0) {
        triggerToast?.({
          type: "SYSTEM_INFO",
          message: `Successfully uploaded ${successCount} file(s) to server disk`,
          severity: "LOW",
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const copyDataUrl = (item: FileUploadItem) => {
    const textToCopy = item.serverUrl || `${item.name}::${item.dataUrl}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
    triggerToast?.({
      type: "SYSTEM_INFO",
      message: "Attachment URI copied to clipboard",
      severity: "LOW",
      timestamp: new Date().toISOString()
    });
  };

  // Prepare projection attachments
  const projectionAttachments = useMemo(() => {
    return items.map((item) => {
      const url = item.serverUrl || item.dataUrl;
      return `${item.name}::${url}`;
    });
  }, [items]);

  const openProjectorForIndex = (index: number) => {
    setProjectorInitialIndex(index);
    setProjectorOpen(true);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-950 dark:to-indigo-950/20 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Upload size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                File Upload & Document Processing Hub
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase font-mono border border-indigo-200 dark:border-indigo-800/40">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Upload invoices, vouchers, receipts, and spreadsheets with instant document preview support
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <>
              <button
                onClick={() => openProjectorForIndex(0)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                title="View uploaded files"
              >
                <Eye size={15} />
                <span>View All ({items.length})</span>
              </button>

              <button
                onClick={uploadAllToServer}
                disabled={isUploading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                {isUploading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>Sync to Server</span>
              </button>
            </>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* DRAG & DROP UPLOAD ZONE */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center relative overflow-hidden group",
            isDragging
              ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[0.99]"
              : "border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 bg-slate-50/50 dark:bg-slate-950/40"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.docx,.doc,.txt,image/*,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
            <Upload size={28} />
          </div>

          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Drag & drop files here, or <span className="text-indigo-600 dark:text-indigo-400 underline">browse</span>
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md">
            Supports PDF receipts, PNG/JPG scans, Excel budget spreadsheets (.xlsx, .csv), and Word documents
          </p>

          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCameraOpen(true);
              }}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Camera size={14} className="text-indigo-500" />
              <span>Camera Scan</span>
            </button>
            <span className="text-[10px] text-slate-400">Strict RFC 2397 & VPS Disk Compliant</span>
          </div>
        </div>

        {/* UPLOADED ITEMS QUEUE */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>Staged Documents ({items.length})</span>
                <span className="text-[10px] font-normal text-slate-400">
                  Total Size: {formatBytes(items.reduce((acc, i) => acc + i.size, 0))}
                </span>
              </label>
              <button
                onClick={() => setItems([])}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
              >
                <Trash2 size={13} />
                <span>Clear All</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((item, idx) => {
                const isImg = item.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(item.name);
                const isPdf = item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf");
                const isXls = /\.(xlsx|xls|csv)$/i.test(item.name);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex items-start gap-3 relative group hover:border-indigo-400 transition-all shadow-sm"
                  >
                    {/* Visual Thumbnail */}
                    <div 
                      onClick={() => openProjectorForIndex(idx)}
                      className="w-14 h-14 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer relative group/thumb shadow-sm"
                      title="Click to View Document"
                    >
                      {isImg ? (
                        <img
                          src={item.dataUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform"
                        />
                      ) : isPdf ? (
                        <PdfThumbnailPreview url={item.dataUrl} title={item.name} />
                      ) : isXls ? (
                        <div className="text-emerald-500">
                          <FileSpreadsheet size={24} />
                        </div>
                      ) : (
                        <div className="text-indigo-500">
                          <FileText size={24} />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye size={16} />
                      </div>
                    </div>

                    {/* Metadata & Category Controls */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h5 
                          className="text-xs font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                          onClick={() => openProjectorForIndex(idx)}
                        >
                          {item.name}
                        </h5>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors"
                          title="Remove file"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatBytes(item.size)}
                        </span>
                        {item.uploadedToServer && (
                          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Synced to Disk
                          </span>
                        )}
                        {item.error && (
                          <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                            {item.error}
                          </span>
                        )}
                      </div>

                      {/* Category Tag Selector */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <select
                          value={item.category}
                          onChange={(e) => updateCategory(item.id, e.target.value as any)}
                          className="text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          {ATTACHMENT_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>

                        {/* Quick View Button */}
                        <button
                          onClick={() => openProjectorForIndex(idx)}
                          className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="View Document"
                        >
                          <Eye size={11} />
                          <span>View</span>
                        </button>

                        <button
                          onClick={() => copyDataUrl(item)}
                          className="px-2 py-1 bg-slate-200/60 dark:bg-slate-700/60 hover:bg-slate-300 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                          title="Copy file URI"
                        >
                          {copiedId === item.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          <span>{copiedId === item.id ? "Copied" : "URI"}</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Integration Footer with Requisitions */}
        {onAttachToRequisition && items.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ready to attach <strong>{items.length} document(s)</strong> to requisition record.
            </p>
            <button
              onClick={() => {
                const attStrings = items.map((i) => i.serverUrl || `${i.name}::${i.dataUrl}`);
                onAttachToRequisition(attStrings);
              }}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all w-full sm:w-auto"
            >
              Attach to Requisition Form
            </button>
          </div>
        )}
      </div>

      {/* Camera Capture Modal */}
      {isCameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Attachment Projection Modal */}
      {projectorOpen && (
        <AttachmentProjectionModal
          attachments={projectionAttachments}
          initialIndex={projectorInitialIndex}
          onClose={() => setProjectorOpen(false)}
          requisition={targetRequisition}
          title={targetRequisition?.title || "Uploaded Document Projection"}
          groupName={targetRequisition?.groupName || "Diocese Committee Review"}
          amount={targetRequisition?.amount}
          amountWords={targetRequisition?.amountWords}
          requesterName={targetRequisition?.requesterName || currentUser?.name}
          status={targetRequisition?.status}
        />
      )}
    </div>
  );
};
