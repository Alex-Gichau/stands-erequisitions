/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { numberToWords } from "../utils/numberUtils";
import { formatCurrency, cn, uploadAttachmentsToLocalServer, getAttachmentFileName, getAbsoluteAttachmentUrl } from "../lib/utils";
import { processFileToAttachmentStrings } from "../lib/pdfUtils";
import { X, Loader2, DollarSign, FileText, FileSpreadsheet, Repeat, Users, PlusCircle, Save, Activity, Mail, Check, UserPlus, Info, Trash2, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RecurrenceType, Requisition, RequisitionStatus, UserRole } from "../types";
import { ApprovalSparkline } from "./ApprovalSparkline";
import { PdfThumbnailPreview } from "./PdfThumbnailPreview";

interface EditRequisitionModalProps {
  req: Requisition;
  onClose: () => void;
  isPage?: boolean;
}

export const EditRequisitionModal: React.FC<EditRequisitionModalProps> = ({ req, onClose, isPage = true }) => {
  const { updateRequisition, projects, churchGroups, addChurchGroup, currentUser, triggerToast, users, startBackgroundUploadTask } = useRequisitions();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
  
  const [title, setTitle] = useState(req.title);
  const [description, setDescription] = useState(req.description);
  const [amount, setAmount] = useState(req.amount.toString());
  const [amountWords, setAmountWords] = useState(req.amountWords || "");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(req.recurrence || RecurrenceType.NONE);
  const [selectedGroup, setSelectedGroup] = useState(req.groupName);
  const [projectId, setProjectId] = useState(req.projectId || "");
  
  const [notificationEmails, setNotificationEmails] = useState<string[]>(
    Array.isArray(req.notificationEmails) ? req.notificationEmails : []
  );
  const [customNotifyEmail, setCustomNotifyEmail] = useState("");
  
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitAction, setSubmitAction] = useState<"save" | "submit">("save");

  const [uploadCompletedCount, setUploadCompletedCount] = useState(0);
  const [uploadTotalCount, setUploadTotalCount] = useState(0);
  const [uploadCurrentFile, setUploadCurrentFile] = useState("");

  const [existingAttachments, setExistingAttachments] = useState<string[]>(
    Array.isArray(req.attachments) 
      ? req.attachments 
      : (typeof req.attachments === "string" && req.attachments ? [req.attachments] : [])
  );

  useEffect(() => {
    if (req.attachments) {
      const norm = Array.isArray(req.attachments)
        ? req.attachments
        : (typeof req.attachments === "string" && req.attachments ? [req.attachments] : []);
      setExistingAttachments(norm);
    }
  }, [req.attachments]);
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const limit = 2 * 1024 * 1024; // 2MB

      const allowedFormatFiles: File[] = [];
      const unsupportedFiles: File[] = [];

      for (const file of selectedFiles) {
        const name = file.name.toLowerCase();
        const type = file.type.toLowerCase();

        const isPdf = type === "application/pdf" || name.endsWith(".pdf");
        const isImage = type.startsWith("image/") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".gif") || name.endsWith(".webp");
        const isDocx = type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                       type === "application/msword" || 
                       name.endsWith(".docx") || 
                       name.endsWith(".doc");
        const isXlsx = type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                       type === "application/vnd.ms-excel" ||
                       type === "text/csv" ||
                       name.endsWith(".xlsx") ||
                       name.endsWith(".xls") ||
                       name.endsWith(".csv");

        if (isPdf || isImage || isDocx || isXlsx) {
          allowedFormatFiles.push(file);
        } else {
          unsupportedFiles.push(file);
        }
      }

      if (unsupportedFiles.length > 0) {
        alert(`Unsupported format error: Only PDF, Image, DOCX, and Excel files are allowed. The following file(s) were rejected:\n${unsupportedFiles.map(f => f.name).join("\n")}`);
        if (triggerToast) {
          triggerToast({
            type: "SYSTEM_INFO",
            message: "Unsupported format error: Only PDF, Image, DOCX, and Excel files are allowed.",
            severity: "HIGH",
            timestamp: new Date().toISOString()
          });
        }
      }

      const oversizedFiles = allowedFormatFiles.filter(file => file.size > limit);
      if (oversizedFiles.length > 0) {
        alert(`The following file(s) exceed the 2MB size limit and were rejected:\n${oversizedFiles.map(f => `${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`).join("\n")}`);
      }
      const allowedFiles = allowedFormatFiles.filter(file => file.size <= limit);
      setNewAttachments(prev => [...prev, ...allowedFiles]);
    }
  };

  const removeExistingAttachment = (idx: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const removeNewAttachment = (idx: number) => {
    setNewAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const ministryMembers = React.useMemo(() => {
    if (!selectedGroup || !users) return [];
    const selGrp = selectedGroup.trim().toLowerCase();
    return users.filter(u => {
      if (!u.email) return false;
      const uGrp = (u.group || "").trim().toLowerCase();
      if (uGrp === selGrp) return true;
      if (u.groups && Array.isArray(u.groups)) {
        if (u.groups.some(g => (g || "").trim().toLowerCase() === selGrp)) return true;
      }
      if (u.department && (u.department || "").trim().toLowerCase() === selGrp) return true;
      return false;
    });
  }, [users, selectedGroup]);

  const toggleNotifyEmail = (email: string) => {
    const norm = email.trim().toLowerCase();
    if (!norm) return;
    setNotificationEmails(prev =>
      prev.includes(norm) ? prev.filter(e => e !== norm) : [...prev, norm]
    );
  };

  const handleAddCustomNotifyEmail = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const norm = customNotifyEmail.trim().toLowerCase();
    if (!norm) return;
    if (!norm.includes("@") || !norm.includes(".")) {
      alert("Please enter a valid email address.");
      return;
    }
    if (!notificationEmails.includes(norm)) {
      setNotificationEmails(prev => [...prev, norm]);
    }
    setCustomNotifyEmail("");
  };

  useEffect(() => {
    const val = parseFloat(amount);
    if (!isNaN(val)) {
      setAmountWords(numberToWords(val));
    } else {
      setAmountWords("");
    }
  }, [amount]);

  const handleAddNewGroup = async () => {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      await addChurchGroup(newGroupName.trim(), newGroupDescription.trim() || undefined);
      setSelectedGroup(newGroupName.trim());
      setNewGroupName("");
      setNewGroupDescription("");
      setShowNewGroupInput(false);
    } catch (err) {
      console.error("Failed to add group:", err);
    } finally {
      setAddingGroup(false);
    }
  };

  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !amount.trim()) return;
    setSaving(true);
    setUploadSuccessMessage(null);

    try {
      // Process and encode any new attachments to base64 Data URIs
      const readPromises = newAttachments.map((file) => processFileToAttachmentStrings(file));
      const nestedEncoded = await Promise.all(readPromises);
      const encodedNew = nestedEncoded.flat();

      // Upload base64 payloads to VPS server storage (/uploads/...)
      const uploadedNewUrls = encodedNew.length > 0
        ? await uploadAttachmentsToLocalServer(encodedNew)
        : [];
      
      const matchingProject = projects.find(p => p.groupId === selectedGroup || p.name === selectedGroup);
      const finalProjectId = projectId || (matchingProject ? matchingProject.id : "");

      const isReqDraft = req.status === RequisitionStatus.DRAFT;
      const finalStatus = (isReqDraft && submitAction === "submit") 
        ? RequisitionStatus.SUBMITTED 
        : req.status;

      let finalNotificationEmails = [...notificationEmails];
      const pendingCustom = customNotifyEmail.trim().toLowerCase();
      if (pendingCustom && pendingCustom.includes("@") && pendingCustom.includes(".")) {
        if (!finalNotificationEmails.includes(pendingCustom)) {
          finalNotificationEmails.push(pendingCustom);
        }
      }

      const combinedAttachments = [...existingAttachments, ...uploadedNewUrls];

      // Save requisition form details & all attachments synchronously
      await updateRequisition(req.id, {
        title: title.trim(),
        description: description.trim(),
        amount: Number(amount),
        amountWords,
        recurrence,
        groupId: selectedGroup,
        groupName: selectedGroup,
        projectId: finalProjectId,
        attachments: combinedAttachments,
        notificationEmails: finalNotificationEmails,
        status: finalStatus
      });

      setExistingAttachments(combinedAttachments);
      setNewAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      const successMsg = "Requisition updated successfully. All changes are saved.";

      setUploadSuccessMessage(successMsg);

      if (triggerToast) {
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "LOW",
          message: successMsg,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error("Failed to update requisition:", error);
      if (triggerToast) {
        triggerToast({
          type: "SECURITY_UPDATE",
          severity: "HIGH",
          message: error?.message || "Failed to update requisition.",
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const containerClass = isPage
    ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-full shadow-sm flex flex-col min-h-[600px] select-text overflow-hidden"
    : "bg-white dark:bg-slate-900 rounded-none md:rounded-2xl w-full max-w-4xl h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 dark:border-slate-800 flex flex-col max-w-full";

  if (req.status === RequisitionStatus.REJECTED) {
    const rejectedContent = (
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-4 mx-auto"
      >
        <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 rounded-full flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
          <X size={24} />
        </div>
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Access Restricted</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Rejected requisitions cannot be edited. Please submit a new requisition instead.
        </p>
        <button 
          type="button" 
          onClick={onClose}
          className="w-full py-2.5 bg-slate-950 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
        >
          Go Back
        </button>
      </motion.div>
    );

    if (isPage) {
      return (
        <div className="p-6 flex items-center justify-center min-h-[500px]">
          {rejectedContent}
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        {rejectedContent}
      </div>
    );
  }

  const mainContent = (
    <motion.div 
      initial={{ y: 15, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 15, opacity: 0 }}
      className={containerClass}
    >
      <div className={cn(
        "px-3 sm:px-6 md:px-8 py-3.5 md:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm gap-2 min-w-0 max-w-full",
        isPage ? "rounded-t-2xl" : "rounded-t-none md:rounded-t-2xl"
      )}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <span className="p-1.5 md:p-2 rounded-xl border shrink-0 bg-primary/5 text-primary border-primary/10 dark:bg-primary/10 dark:border-primary/20">
            <Pencil size={18} className="md:w-5 md:h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap">
              <h3 className="text-[12px] md:text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.05em] sm:tracking-[0.1em] truncate min-w-0 flex-1">
                Edit Requisition: {title || req.title}
              </h3>
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0">
                {req.status}
              </span>
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
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-full transition-all font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20 border border-rose-500/50 backdrop-blur-md"
          >
            <X size={16} className="stroke-[2.5]" />
            <span className="hidden sm:inline">Close & Go Back</span>
            <span className="sm:hidden">Close</span>
          </motion.button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 flex-1">
          {/* Section 1: Desginated Group & Quick Add */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 w-full justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users size={16} className="text-primary" />
                </div>
                <h4 className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-widest">Ownership & Affiliations</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGroupInput(!showNewGroupInput)}
                className="text-[9px] font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10"
              >
                <PlusCircle size={12} />
                <span>Quick Add Group</span>
              </button>
            </div>

            {showNewGroupInput && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Church Group Name</label>
                    <input 
                      type="text" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. St Andrews Choir"
                      className="input-field bg-white h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Optional Scope / Description</label>
                    <input 
                      type="text" 
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      placeholder="e.g. Traditional Choir Ministry"
                      className="input-field bg-white h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewGroupInput(false)}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 text-[9px] font-bold uppercase tracking-wider rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={addingGroup || !newGroupName.trim()}
                    onClick={handleAddNewGroup}
                    className="px-3.5 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 hover:bg-primary/95 shadow-sm"
                  >
                    {addingGroup ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    <span>Save Group entry</span>
                  </button>
                </div>
              </motion.div>
            )}

            <div className="space-y-1.5 p-4 bg-slate-50 rounded-2xl border border-slate-150">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 block mb-1">
                Designated Team / Department / Group
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="input-field cursor-pointer h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold uppercase tracking-widest text-[11px]"
              >
                {churchGroups && churchGroups.length > 0 ? (
                  churchGroups.map((g) => (
                    <option key={g.id} value={g.name} className="font-sans text-xs">
                      {g.name}
                    </option>
                  ))
                ) : (
                  <option value={selectedGroup}>{selectedGroup}</option>
                )}
              </select>
            </div>

            {/* Requisition Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Requisition Title</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required 
                className="input-field text-xs md:text-sm font-semibold"
                placeholder="Briefly describe the request"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Detailed Log / Purpose</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required 
                rows={4}
                className="input-field resize-none py-3 text-xs md:text-sm leading-relaxed"
                placeholder="Provide a comprehensive breakdown of requirements..."
              />
            </div>

            {/* Recurrence protocol */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Recurrence Protocol</label>
              <div className="relative">
                <Repeat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select 
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                  className="input-field pl-12 cursor-pointer font-bold uppercase tracking-widest text-[11px]"
                >
                  <option value={RecurrenceType.NONE}>NO RECURRENCE</option>
                  <option value={RecurrenceType.MONTHLY}>MONTHLY PROTOCOL</option>
                  <option value={RecurrenceType.QUARTERLY}>QUARTERLY PROTOCOL</option>
                </select>
              </div>
            </div>

            {/* Funding breakdown */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Total Authorized Amount (KES)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required 
                    min="1"
                    className="input-field pl-12 font-mono font-bold text-xs md:text-sm"
                    placeholder="Enter budget requirement amount..."
                  />
                </div>
              </div>

              {amountWords && (
                <div className="p-4 bg-white/80 border border-slate-200/60 rounded-xl space-y-1 animate-in fade-in duration-300">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-mono">AUTHORIZED WORDS OF CERTIFICATION</span>
                  <p className="text-[11px] font-bold text-slate-700 italic">{amountWords} shillings only.</p>
                </div>
              )}
            </div>
            
            {/* Attachment Management Section */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-150 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-widest font-sans">Requisition Documents & Attachments</h4>
                    <p className="text-[9px] text-slate-400">Manage receipts, invoices, and other supporting evidence files</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[9px] font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10 cursor-pointer"
                >
                  <PlusCircle size={12} />
                  <span>Upload More Files</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.xlsb,.csv,.ods,.tsv,.txt"
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                />
              </div>

              {/* Existing file list */}
              {existingAttachments.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-sans">Current Registered Attachments</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {existingAttachments.map((att, idx) => {
                      const name = getAttachmentFileName(att);
                      const url = getAbsoluteAttachmentUrl(att);
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || (typeof url === 'string' && (url.startsWith('data:image/') || url.startsWith('blob:')));
                      const isPdf = !isImage && (/\.(pdf)$/i.test(name) || /\.(pdf)$/i.test(url) || (typeof url === 'string' && url.startsWith('data:application/pdf')));
                      const isXlsx = !isImage && !isPdf && (/\.(xlsx|xls|csv)$/i.test(name) || /\.(xlsx|xls|csv)$/i.test(url) || (typeof url === 'string' && (url.startsWith('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || url.startsWith('data:application/vnd.ms-excel') || url.startsWith('data:text/csv') || url.startsWith('data:application/csv'))));

                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-in fade-in">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400">
                              {isImage ? (
                                <img src={url} alt={name} className="w-full h-full object-cover" />
                              ) : isPdf ? (
                                <PdfThumbnailPreview url={url} title={name} />
                              ) : isXlsx ? (
                                <div className="w-full h-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <FileSpreadsheet size={18} />
                                </div>
                              ) : (
                                <FileText size={16} className="text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate block" title={name}>{name}</span>
                              <span className="text-[9px] font-mono text-slate-400 uppercase">{isPdf ? "PDF Document" : isImage ? "Image" : isXlsx ? "Excel / CSV Sheet" : "Document"}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExistingAttachment(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer shrink-0"
                            title="Remove attachment"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New file staging area */}
              {newAttachments.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block font-sans">New Files Staged for Upload</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {newAttachments.map((file, idx) => {
                      const isImage = file.type.startsWith("image/");
                      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                      const isXlsx = file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel" || file.type === "text/csv" || /\.(xlsx|xls|csv)$/i.test(file.name);

                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl animate-in fade-in">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/20 shrink-0 bg-emerald-950/20 flex items-center justify-center text-emerald-600">
                              {isImage ? (
                                <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                              ) : isPdf ? (
                                <PdfThumbnailPreview file={file} title={file.name} />
                              ) : isXlsx ? (
                                <div className="w-full h-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <FileSpreadsheet size={18} />
                                </div>
                              ) : (
                                <FileText size={16} className="text-emerald-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 truncate block" title={file.name}>{file.name}</span>
                              <span className="text-[9px] text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeNewAttachment(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer shrink-0"
                            title="Remove staged attachment"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {existingAttachments.length === 0 && newAttachments.length === 0 && (
                <div className="p-6 bg-slate-100/50 border border-dashed border-slate-200 rounded-xl text-center text-slate-300">
                  <p className="text-[10px] font-black uppercase tracking-widest">No Documents Attached</p>
                </div>
              )}
            </div>
          </div>

          {/* Ministry Notification Recipients Section */}
          <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Mail size={14} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h5 className="text-[10px] md:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                    Ministry Update Recipients
                  </h5>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Add or remove members assigned to <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedGroup || "this ministry"}</span> to receive email notifications when status changes.
                  </p>
                </div>
              </div>
              {notificationEmails.length > 0 && (
                <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full whitespace-nowrap">
                  {notificationEmails.length} selected
                </span>
              )}
            </div>

            {/* Assigned Ministry Members Quick Select Pills */}
            {ministryMembers.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                    Assigned Ministry Members ({ministryMembers.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = ministryMembers.every(m => notificationEmails.includes(m.email.toLowerCase()));
                      if (allSelected) {
                        const memberEmails = ministryMembers.map(m => m.email.toLowerCase());
                        setNotificationEmails(prev => prev.filter(e => !memberEmails.includes(e)));
                      } else {
                        const memberEmails = ministryMembers.map(m => m.email.toLowerCase()).filter(Boolean);
                        setNotificationEmails(prev => Array.from(new Set([...prev, ...memberEmails])));
                      }
                    }}
                    className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline uppercase tracking-wider"
                  >
                    {ministryMembers.every(m => notificationEmails.includes(m.email.toLowerCase())) ? "Unselect All" : "Select All Members"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  {ministryMembers.map((member) => {
                    const isSelected = notificationEmails.includes(member.email.toLowerCase());
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleNotifyEmail(member.email)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border text-left",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                        )}
                      >
                        <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0", isSelected ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500")}>
                          {isSelected ? <Check size={10} /> : <PlusCircle size={10} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold leading-none">{member.name || member.email}</span>
                          <span className={cn("text-[9px] leading-tight opacity-80 mt-0.5", isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400")}>
                            {member.email}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-800 dark:text-amber-300 font-medium">
                No individual members currently assigned to group "{selectedGroup}". You can manually add member emails below.
              </div>
            )}

            {/* Manual Custom Recipient Email Input */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                Add External or Additional Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={customNotifyEmail}
                  onChange={(e) => setCustomNotifyEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomNotifyEmail();
                    }
                  }}
                  placeholder="e.g. member@church.org"
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddCustomNotifyEmail}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <PlusCircle size={14} />
                  <span>Add Email</span>
                </button>
              </div>
            </div>

            {/* Selected Recipients Chips */}
            {notificationEmails.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  Active Email Notification List ({notificationEmails.length})
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl max-h-28 overflow-y-auto">
                  {notificationEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60"
                    >
                      <Mail size={11} className="text-indigo-500" />
                      <span>{email}</span>
                      <button
                        type="button"
                        onClick={() => toggleNotifyEmail(email)}
                        className="p-0.5 hover:bg-indigo-200/50 dark:hover:bg-indigo-800/50 rounded text-indigo-500 hover:text-rose-600 transition-colors"
                        title="Remove email"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Visual upload progress bar */}
          {saving && uploadTotalCount > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-2.5 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-sky-50 dark:bg-sky-950/50 rounded-lg text-sky-600 dark:text-sky-400 animate-pulse">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                      Uploading Attachments & Saving
                    </h4>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                      Transferring to local server storage
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 font-mono bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-md border border-sky-100 dark:border-sky-900/50">
                  {uploadCompletedCount} / {uploadTotalCount} ({uploadTotalCount > 0 ? Math.round((uploadCompletedCount / uploadTotalCount) * 100) : 0}%)
                </span>
              </div>
              
              {/* Progress Track */}
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadTotalCount > 0 ? Math.round((uploadCompletedCount / uploadTotalCount) * 100) : 0}%` }}
                />
              </div>

              {/* Current File Info */}
              {uploadCurrentFile && (
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-medium">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Active:</span>
                  <span className="truncate max-w-[400px] font-mono text-slate-600 dark:text-slate-300">{uploadCurrentFile}</span>
                </div>
              )}
            </div>
          )}

          {/* Success Banner when upload and save complete */}
          {uploadSuccessMessage && !saving && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Changes & Uploads Saved
                  </h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                    {uploadSuccessMessage}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadSuccessMessage(null)}
                className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="px-3 sm:px-6 md:px-8 py-3 md:py-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-3 md:gap-4 justify-end items-center max-w-full overflow-hidden">
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer uppercase tracking-widest"
              >
                Cancel Edit
              </button>
              {req.status === RequisitionStatus.DRAFT ? (
                <>
                  <button
                    type="submit"
                    onClick={() => setSubmitAction("save")}
                    disabled={saving || !title.trim() || !amount.trim()}
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {saving && submitAction === "save" ? <Loader2 size={12} className="animate-spin" /> : null}
                    <span>Apply Changes</span>
                  </button>
                  <button
                    type="submit"
                    onClick={() => setSubmitAction("submit")}
                    disabled={saving || !title.trim() || !amount.trim()}
                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {saving && submitAction === "submit" ? <Loader2 size={12} className="animate-spin" /> : null}
                    <span>Submit Requisition</span>
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  onClick={() => setSubmitAction("save")}
                  disabled={saving || !title.trim() || !amount.trim()}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 dark:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>Apply Changes</span>
                </button>
              )}
            </div>
          </div>
        </form>
    </motion.div>
  );

  if (isPage) {
    return mainContent;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-x-hidden overflow-y-auto">
      {mainContent}
    </div>
  );
};
