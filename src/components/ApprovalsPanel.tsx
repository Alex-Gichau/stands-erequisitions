/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  ShieldCheck, 
  Fingerprint, 
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Info,
  Loader2,
  Search,
  XCircle,
  X,
  FileText,
  Flag,
  History,
  Layers,
  Split,
  CalendarClock
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, formatDate, cn, formatRequisitionAge } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export const ApprovalsPanel: React.FC = () => {
  const { requisitions, updateRequisitionStatus, currentUser, globalSearchTerm, canPerform, systemSettings } = useRequisitions();
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approvalStep, setApprovalStep] = useState<"DETAILS" | "CODE" | "SUCCESS">("DETAILS");
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (selectedReq && approvalStep === "DETAILS" && noteRef.current) {
      setTimeout(() => {
        noteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        noteRef.current?.focus();
      }, 300);
    }
  }, [selectedReq, approvalStep]);

  const pendingApprovals = requisitions.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(globalSearchTerm.toLowerCase()) || 
                          req.groupName.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                          req.id.toLowerCase().includes(globalSearchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const canDoL1 = canPerform('canApproveL1');
    const canDoL2 = canPerform('canApproveL2');

    if (canDoL1 && req.status === RequisitionStatus.SUBMITTED) return true;
    if (canDoL2 && (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED)) return true;
    
    return false;
  });

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === pendingApprovals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingApprovals.map(r => r.id)));
    }
  };

  const handleApprove = async () => {
    if (!selectedReq && !isBulkMode) return;
    setLoading(true);
    try {
      if (isBulkMode) {
        const promises = Array.from(selectedIds).map(async (id) => {
          const req = requisitions.find(r => r.id === id);
          if (!req) return;
          
          const nextStatus = req.status === RequisitionStatus.SUBMITTED 
            ? RequisitionStatus.APPROVED_L1 
            : RequisitionStatus.APPROVED_L2;
            
          return updateRequisitionStatus(
            id, 
            nextStatus, 
            "APPROVE", 
            "Bulk authorization signature applied.", 
            "CODE", 
            undefined, 
            authCode
          );
        });
        await Promise.all(promises);
        setSelectedIds(new Set());
      } else if (selectedReq) {
        const nextStatus = selectedReq.status === RequisitionStatus.SUBMITTED 
          ? RequisitionStatus.APPROVED_L1 
          : RequisitionStatus.APPROVED_L2;
        
        await updateRequisitionStatus(
          selectedReq.id, 
          nextStatus, 
          "APPROVE", 
          decisionNote, 
          "CODE", 
          undefined, 
          authCode
        );
      }
      setApprovalStep("SUCCESS");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      await updateRequisitionStatus(
        selectedReq.id, 
        RequisitionStatus.REJECTED, 
        "REJECT", 
        decisionNote, 
        "CODE", 
        decisionNote
      );
      setSelectedReq(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Authorization Hub</h2>
          <p className="text-[10px] md:text-sm text-slate-500">Authenticated verification stream for pending ledger transactions.</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {pendingApprovals.length > 0 && (
            <button
              onClick={toggleAll}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <CheckCircle2 size={14} className={cn(selectedIds.size === pendingApprovals.length ? "text-primary" : "text-slate-300")} />
              {selectedIds.size === pendingApprovals.length ? "Deselect All" : "Select All"}
            </button>
          )}
          <div className="px-3 py-1.5 md:px-4 md:py-2 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary md:w-4 md:h-4" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-primary">
              {currentUser?.role === UserRole.SUPER_ADMIN ? "SUDO OVERSEER" : currentUser?.role === UserRole.APPROVER_L2 ? "L2 KEYMASTER" : currentUser?.role === UserRole.ADMIN ? "GLOBAL ADMIN" : "L1 VERIFIER"}
            </span>
          </div>
        </div>
      </div>

      {systemSettings?.fiscalYearStatus === "ARCHIVED" && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-400">
          <div className="p-2 bg-amber-500/15 rounded-xl">
            <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-black uppercase tracking-wider">ARCHIVED EXPENSES VIEWPORT</p>
            <p className="text-[10px] opacity-90 leading-relaxed">
              This financial period ({systemSettings?.currentFiscalYear}) has been **ARCHIVED**. Approvals, decisions, and payment triggers are suspended.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6">
        <AnimatePresence mode="popLayout">
          {pendingApprovals.map((req) => (
            <motion.div 
              key={req.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => {
                setSelectedReq(req);
                setIsBulkMode(false);
                setApprovalStep("DETAILS");
                setAuthCode("");
                setDecisionNote("");
              }}
              className={cn(
                "bg-white rounded-xl md:rounded-2xl border transition-all cursor-pointer group flex flex-col md:flex-row overflow-hidden relative shadow-sm",
                selectedIds.has(req.id) ? "border-primary bg-primary/5 shadow-md" : "border-slate-200 hover:shadow-xl hover:border-primary/30"
              )}
            >
              <div className="flex items-center justify-center px-4 border-r border-slate-100 bg-slate-50/50" onClick={(e) => toggleSelection(e, req.id)}>
                <div className={cn(
                  "w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center",
                  selectedIds.has(req.id) ? "bg-primary border-primary" : "bg-white border-slate-200 group-hover:border-primary/50"
                )}>
                  {selectedIds.has(req.id) && <CheckCircle2 size={12} className="text-white" />}
                </div>
              </div>

              <div className={cn(
                "w-1 md:w-1.5 self-stretch shrink-0",
                req.status === RequisitionStatus.SUBMITTED ? "bg-amber-500" : "bg-primary"
              )} />
              
              <div className="flex-1 p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                <div className="space-y-1 md:space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <FileText size={14} className="md:w-4 md:h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-[13px] md:text-base tracking-tight group-hover:text-primary transition-colors truncate">{req.title}</h3>
                        {req.flaggedForAudit && (
                          <span title="Flagged for Audit" className="inline-flex shrink-0">
                            <Flag size={11} className="text-rose-500 fill-rose-500" />
                          </span>
                        )}
                        <span className="text-[7.5px] md:text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">#{req.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-[9px] md:text-[11px] text-slate-500 line-clamp-1 italic font-medium">"{req.description}"</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 pl-[38px] md:pl-[46px]">
                    {formatRequisitionAge(req.submittedAt, req.status) && (
                      <div className="flex items-center gap-1">
                        <Clock size={9} className="text-slate-400 md:w-2.5 md:h-2.5" />
                        <span className="text-[8.5px] md:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">
                          {formatRequisitionAge(req.submittedAt, req.status)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                       <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-slate-100 flex items-center justify-center text-[7.5px] md:text-[8.5px] font-bold text-slate-500 border border-white">
                        {req.requesterName.charAt(0)}
                      </div>
                      <span className="text-[8.5px] md:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[70px] md:max-w-none">{req.requesterName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-1">
                  <div className="md:hidden">
                    <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">Value</p>
                    <p className="text-base font-black text-slate-900 font-mono">{formatCurrency(req.amount)}</p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-0.5">Impact Value</p>
                    <p className="text-xl font-black text-slate-900 leading-none font-mono tracking-tighter">{formatCurrency(req.amount)}</p>
                  </div>
                  {req.status === RequisitionStatus.APPROVED_L1 && (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 text-[7.5px] md:text-[8px] font-black uppercase tracking-widest">
                      <CheckCircle2 size={8} /> L1 VERIFIED
                    </div>
                  )}
                </div>
              </div>
              
              <div className="md:w-12 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 flex md:flex-col items-center justify-center gap-2 py-1.5 md:py-3">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:scale-110 group-hover:border-primary/20 transition-all">
                  <ArrowRight size={14} className="md:w-4 md:h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {pendingApprovals.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed animate-in fade-in transition-all">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 relative">
                <CheckCircle2 size={40} className="text-emerald-500/30" />
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <CheckCircle2 size={40} className="text-emerald-500" />
                </motion.div>
             </div>
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Authorization Queue Clear</h3>
             <p className="text-xs text-slate-400 mt-2">All financial entities have been authenticated or rejected.</p>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4"
          >
            <div className="bg-slate-900 text-white rounded-[2rem] p-4 md:p-6 shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-xl">
              <div className="flex items-center gap-4 pl-2">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Selected Entities</div>
                  <div className="text-lg font-black">{selectedIds.size} Requisitions</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    setIsBulkMode(true);
                    handleApprove();
                  }}
                  disabled={loading}
                  className="px-8 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                >
                  {loading ? "Authorizing..." : "Bulk Authorize"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Authorization Modal */}
      <AnimatePresence>
        {(selectedReq || isBulkMode) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-none md:rounded-3xl w-full max-w-xl h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 flex flex-col"
            >
              {approvalStep === "DETAILS" && selectedReq && (
                <div className="flex flex-col h-full">
                  <div className="px-5 md:px-8 py-4 md:py-6 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10">
                    <h3 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Detailed Review</h3>
                    <button onClick={() => setSelectedReq(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <X size={20} className="text-slate-500 md:w-5 md:h-5" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-5 md:space-y-6">
                    <div className="bg-slate-50 rounded-xl md:rounded-2xl p-4 md:p-6 border border-slate-100">
                      <div className="flex justify-between items-start mb-4">
                        <div className="min-w-0 flex-1 pr-2">
                          <h4 className="text-base md:text-lg font-bold text-slate-900 tracking-tight truncate">{selectedReq.title}</h4>
                          <p className="text-[9px] md:text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1 truncate">SYS_ID: {selectedReq.id.slice(-8)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Amount</p>
                          <p className="text-lg md:text-xl font-black text-primary font-mono">{formatCurrency(selectedReq.amount)}</p>
                        </div>
                      </div>
                      <div className="p-3 md:p-4 bg-white rounded-lg md:rounded-xl border border-slate-200 text-[11px] md:text-xs text-slate-600 italic leading-relaxed max-h-32 overflow-y-auto scrollbar-hide">
                        "{selectedReq.description}"
                      </div>

                      {selectedReq.enableInstallments && Array.isArray(selectedReq.installments) && selectedReq.installments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                            <span className="flex items-center gap-1.5 uppercase tracking-wider text-indigo-700">
                              <Split size={12} /> Phased Milestone Schedule ({selectedReq.installments.length} Installments)
                            </span>
                            <span className="font-mono text-slate-500">
                              {formatCurrency(selectedReq.disbursedAmount || 0)} / {formatCurrency(selectedReq.amount)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto">
                            {selectedReq.installments.map((inst) => (
                              <div key={inst.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px]">
                                <div className="flex items-center gap-2">
                                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-[9px]">
                                    {inst.installmentNumber}
                                  </span>
                                  <span className="font-semibold text-slate-800">{inst.title}</span>
                                  {inst.dueDate && (
                                    <span className="text-slate-400 font-mono text-[9px] flex items-center gap-0.5">
                                      <CalendarClock size={9} /> {new Date(inst.dueDate).toLocaleDateString('en-GB')}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-slate-900">{formatCurrency(inst.amount)}</span>
                                  <span className="text-[8px] text-slate-400 font-mono ml-1">({inst.percentage}%)</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 md:space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Decision Commentary (Optional)</label>
                        <textarea 
                          ref={noteRef}
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                          placeholder="Provide reasoning if any (optional for approval)..."
                          className="input-field py-2.5 md:py-3 min-h-[80px] md:min-h-[100px] resize-none text-[11px] md:text-xs"
                        />
                      </div>
                      
                      <div className="p-3 md:p-4 bg-amber-50 rounded-xl md:rounded-2xl border border-amber-100 flex gap-2.5 md:gap-3 items-start">
                        <Info size={14} className="text-amber-500 shrink-0 mt-0.5 md:w-4 md:h-4" />
                        <p className="text-[10px] md:text-[11px] text-amber-800 leading-relaxed font-medium">
                          Commitment will trigger subsequent protocol stages.
                        </p>
                      </div>
                    </div>
                  </div>

                  {systemSettings?.fiscalYearStatus === "ARCHIVED" ? (
                    <div className="px-5 md:px-8 py-4 md:py-6 border-t border-slate-100 bg-amber-500/5 flex justify-center text-amber-700 dark:text-amber-400 text-xs font-black uppercase tracking-wider">
                       🚫 Approval actions are completely disabled for archived periods
                    </div>
                  ) : (
                    <div className="px-5 md:px-8 py-4 md:py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2 md:gap-3">
                      {(!selectedReq || selectedReq.status !== RequisitionStatus.DISBURSED) && (
                        <button 
                          onClick={handleReject}
                          disabled={loading}
                          className="px-4 md:px-6 py-2 md:py-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] md:text-xs font-black uppercase hover:bg-rose-50 transition-all cursor-pointer shadow-sm shadow-rose-100 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      )}
                      <button 
                        onClick={handleApprove}
                        disabled={loading}
                        className="btn-primary px-5 md:px-8 py-2 md:py-3 text-[10px] md:text-xs flex items-center gap-2 cursor-pointer"
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                        Approve Requisition
                      </button>
                    </div>
                  )}
                </div>
              )}

              {approvalStep === "CODE" && (
                <div className="p-8 md:p-12 text-center space-y-6 md:space-y-8 relative flex-1 flex flex-col justify-center">
                   <button 
                    onClick={() => {
                      if (isBulkMode) setIsBulkMode(false);
                      else setSelectedReq(null);
                    }} 
                    className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-all border border-transparent hover:border-slate-200 text-slate-400 hover:text-rose-500"
                  >
                    <X size={20} />
                  </button>

                  <div className="mx-auto w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center text-primary relative">
                    <Fingerprint size={30} className="md:w-10 md:h-10 animate-pulse" />
                    <motion.div 
                      className="absolute inset-0 rounded-2xl md:rounded-3xl border-2 border-primary"
                      animate={{ scale: [1, 1.1, 1], opacity: [0, 0.5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">
                      {isBulkMode ? "Bulk Authorization" : "Security Protocol"}
                    </h3>
                    <p className="text-[9px] md:text-xs text-slate-400 mt-2 uppercase font-black tracking-widest">
                      {isBulkMode ? `Signing ${selectedIds.size} transactions` : `Input unique ${currentUser?.role === UserRole.APPROVER_L2 ? "7" : "6"}-digit signature key`}
                    </p>
                  </div>
                  
                  <div className="relative max-w-[240px] md:max-w-[280px] mx-auto">
                    <input 
                      type="password"
                      maxLength={7}
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, ''))}
                      autoFocus
                      placeholder="•••••••"
                      className="w-full text-center text-2xl md:text-4xl tracking-[0.4em] md:tracking-[0.6em] font-black border-none bg-slate-50 py-4 md:py-6 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-200"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2.5 md:gap-3">
                    <button 
                      disabled={loading || authCode.length < (currentUser?.role === UserRole.APPROVER_L2 ? 7 : 6)}
                      onClick={handleApprove}
                      className="w-full py-3 md:py-4 bg-primary text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                      Verify Signature
                    </button>
                    <button 
                      onClick={() => setApprovalStep("DETAILS")}
                      className="w-full py-2.5 bg-white text-slate-400 rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:text-slate-600 transition-all"
                    >
                      Return to details
                    </button>
                  </div>
                </div>
              )}

              {approvalStep === "SUCCESS" && (
                <div className="p-10 md:p-16 text-center space-y-8 md:space-y-10">
                  <div className="mx-auto w-20 h-20 md:w-24 md:h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-200">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 12 }}
                    >
                      <CheckCircle2 size={40} className="md:w-12 md:h-12" />
                    </motion.div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">
                      {isBulkMode ? "Batch Ledger Written" : "Ledger Written"}
                    </h3>
                    <p className="text-[10px] md:text-xs text-slate-400 uppercase font-black tracking-widest px-4 md:px-8">
                      {isBulkMode ? `${selectedIds.size} requisitions authorized.` : "Requisition has been successfully authorized."}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedReq(null);
                      setIsBulkMode(false);
                      setApprovalStep("DETAILS");
                    }}
                    className="w-full py-3.5 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    CONTINUE HUB OPS
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
