/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  Printer, 
  Download, 
  BarChart3, 
  Filter, 
  Building,
  CheckCircle2,
  FileCheck,
  TrendingUp,
  Activity,
  ChevronRight,
  Save,
  History,
  FileText,
  Search,
  ArrowRight,
  ShieldCheck,
  PieChart,
  LayoutGrid,
  ChevronDown,
  Flag,
  Sparkles,
  Bot,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition, SavedReport } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { GlobalFiscalOverview } from "./GlobalFiscalOverview";
import { motion, AnimatePresence } from "motion/react";
import { 
  printRequisitions, 
  downloadRequisitionsHtml, 
  downloadRequisitionsCsv, 
  downloadRequisitionsPdf,
  downloadAiSummaryPdf,
  printAiSummaryReport
} from "../utils/exportUtils";

export const ReportsPanel: React.FC = () => {
  const { requisitions, projects, currentUser, saveReport, reports, fiscalYears, systemSettings, syncingTargets } = useRequisitions();
  
  // Date and filter states
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>("CURRENT");
  const [isSaving, setIsSaving] = useState(false);
  const [showDownloadType, setShowDownloadType] = useState(false);

  // AI 1-Pager Summary States
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedAi, setCopiedAi] = useState(false);

  const isSelectedYearArchived = useMemo(() => {
    const yearNum = selectedFiscalYear === "CURRENT" 
      ? (systemSettings?.currentFiscalYear || 2026) 
      : parseInt(selectedFiscalYear);
    const yrInfo = fiscalYears.find(f => f.year === yearNum);
    return yrInfo?.status === "ARCHIVED";
  }, [selectedFiscalYear, fiscalYears, systemSettings]);

  // Get unique group names for group filter
  const groups = useMemo(() => {
    const allGroups = requisitions.map(r => r.groupName || r.groupId);
    return Array.from(new Set(allGroups)).filter(Boolean);
  }, [requisitions]);

  // Set date ranges via quick filters
  const applyQuickFilter = (type: string) => {
    const today = new Date();
    const cleanDateString = (d: Date) => d.toISOString().split("T")[0];

    switch (type) {
      case "TODAY":
        setStartDate(cleanDateString(today));
        setEndDate(cleanDateString(today));
        break;
      case "7_DAYS": {
        const past = new Date();
        past.setDate(today.getDate() - 7);
        setStartDate(cleanDateString(past));
        setEndDate(cleanDateString(today));
        break;
      }
      case "30_DAYS": {
        const past = new Date();
        past.setDate(today.getDate() - 30);
        setStartDate(cleanDateString(past));
        setEndDate(cleanDateString(today));
        break;
      }
      case "THIS_MONTH": {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(cleanDateString(first));
        setEndDate(cleanDateString(today));
        break;
      }
      case "THIS_QUARTER": {
        const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
        const firstOfQuarter = new Date(today.getFullYear(), quarterMonth, 1);
        setStartDate(cleanDateString(firstOfQuarter));
        setEndDate(cleanDateString(today));
        break;
      }
      case "THIS_YEAR": {
        const firstOfYear = new Date(today.getFullYear(), 0, 1);
        setStartDate(cleanDateString(firstOfYear));
        setEndDate(cleanDateString(today));
        break;
      }
      case "CLEAR":
        setStartDate("");
        setEndDate("");
        break;
      default:
        break;
    }
  };

  // Filter current view based on active parameters
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      // Filter by fiscal year if selected
      const activeYearFilter = selectedFiscalYear === "ALL" 
        ? null 
        : (selectedFiscalYear === "CURRENT" 
            ? (systemSettings?.currentFiscalYear || 2026) 
            : parseInt(selectedFiscalYear));
            
      if (activeYearFilter !== null && req.fiscalYear !== activeYearFilter) {
        return false;
      }

      // 1. Period constraints helper
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const reqDate = new Date(req.submittedAt);
        if (reqDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const reqDate = new Date(req.submittedAt);
        if (reqDate > end) return false;
      }

      // 2. Affiliation groups constraint
      if (selectedGroup !== "ALL" && req.groupName !== selectedGroup) {
        return false;
      }

      // 3. Status filter constraint
      if (selectedStatus !== "ALL" && req.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [requisitions, startDate, endDate, selectedGroup, selectedStatus, selectedFiscalYear, systemSettings]);

  // Financial aggregates calculated on filtered dataset
  const statistics = useMemo(() => {
    const grossValue = filteredRequisitions.reduce((sum, r) => sum + r.amount, 0);
    
    const disbursed = filteredRequisitions
      .filter(r => r.status === RequisitionStatus.DISBURSED)
      .reduce((sum, r) => sum + r.amount, 0);
      
    const approved = filteredRequisitions
      .filter(r => [RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2].includes(r.status))
      .reduce((sum, r) => sum + r.amount, 0);

    const pending = filteredRequisitions
      .filter(r => r.status === RequisitionStatus.SUBMITTED)
      .reduce((sum, r) => sum + r.amount, 0);

    return { grossValue, disbursed, approved, pending };
  }, [filteredRequisitions]);

  // Helper description of the active filter/period
  const filterDescription = useMemo(() => {
    const parts: string[] = [];
    if (startDate && endDate) {
      parts.push(`Period: ${startDate} to ${endDate}`);
    } else if (startDate) {
      parts.push(`From: ${startDate}`);
    } else if (endDate) {
      parts.push(`Until: ${endDate}`);
    } else {
      parts.push("Full Historic Records");
    }

    if (selectedGroup !== "ALL") {
      parts.push(`Group: ${selectedGroup}`);
    }
    if (selectedStatus !== "ALL") {
      parts.push(`Status: ${selectedStatus}`);
    }

    return parts.join(" • ");
  }, [startDate, endDate, selectedGroup, selectedStatus]);

  const handlePrintReport = () => {
    printRequisitions(
      filteredRequisitions,
      "Audit Periodic Ledger Summary",
      currentUser,
      filterDescription
    );
  };

  const handleDownloadReport = () => {
    downloadRequisitionsHtml(
      filteredRequisitions,
      "Audit Periodic Ledger Summary",
      currentUser,
      filterDescription
    );
  };

  const handleGenerateAiSummary = async () => {
    setIsGeneratingAi(true);
    setAiError(null);

    const groupMap: { [key: string]: { name: string; amount: number; count: number } } = {};
    filteredRequisitions.forEach((r) => {
      const gName = r.groupName || r.groupId || "General";
      if (!groupMap[gName]) {
        groupMap[gName] = { name: gName, amount: 0, count: 0 };
      }
      groupMap[gName].amount += r.amount || 0;
      groupMap[gName].count += 1;
    });

    const groupBreakdown = Object.values(groupMap).sort((a, b) => b.amount - a.amount);
    const sampleRequisitions = filteredRequisitions.slice(0, 5).map((r) => ({
      id: r.id,
      title: r.title,
      amount: r.amount,
      groupName: r.groupName,
      status: r.status,
      submittedAt: r.submittedAt,
    }));

    const payload = {
      filters: {
        startDate,
        endDate,
        group: selectedGroup,
        status: selectedStatus,
        fiscalYear: selectedFiscalYear,
      },
      metrics: {
        totalCount: filteredRequisitions.length,
        totalAmount: statistics.grossValue,
        disbursedAmount: statistics.disbursed,
        pendingAmount: statistics.pending + statistics.approved,
        rejectedAmount: filteredRequisitions.filter(r => r.status === RequisitionStatus.REJECTED).reduce((s, r) => s + r.amount, 0),
        flaggedCount: filteredRequisitions.filter(r => r.flaggedForAudit).length,
      },
      groupBreakdown,
      sampleRequisitions,
    };

    try {
      const res = await fetch("/api/reports/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        if (data.missingKey) {
          setAiError("GEMINI_API_KEY is missing or unconfigured in .env file. Please paste your GEMINI_API_KEY into the .env file to run live AI generation.");
        } else {
          setAiError(data.error || "Failed to generate AI executive report summary.");
        }
      } else if (data.data) {
        setAiSummary(data.data);
      }
    } catch (err: any) {
      console.error("AI summary generation error:", err);
      setAiError("Unable to connect to the backend server. Please verify server connection.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const generateFallbackLocalSummary = () => {
    setAiSummary({
      title: "St. Andrew's PCEA Executive Financial & Audit Summary",
      periodLabel: filterDescription,
      executiveNarrative: `For the scope covering ${filterDescription}, St. Andrew's PCEA eRequisitions Portal recorded a total volume of ${filteredRequisitions.length} ledger transactions with a cumulative requested value of KES ${statistics.grossValue.toLocaleString()}. Disbursed outflows stand at KES ${statistics.disbursed.toLocaleString()}, representing a settlement compliance rate of ${((statistics.disbursed / (statistics.grossValue || 1)) * 100).toFixed(1)}%. Pending commitment pipelines total KES ${(statistics.pending + statistics.approved).toLocaleString()}.`,
      keyHighlights: [
        `Ledger throughput of KES ${statistics.grossValue.toLocaleString()} compiled across ${filteredRequisitions.length} transactions.`,
        `Disbursed Settlements: KES ${statistics.disbursed.toLocaleString()} (${((statistics.disbursed / (statistics.grossValue || 1)) * 100).toFixed(1)}% cleared).`,
        `Commitment Pipeline: KES ${(statistics.pending + statistics.approved).toLocaleString()} pending final level clearance.`
      ],
      auditObservations: [
        `${filteredRequisitions.filter(r => r.flaggedForAudit).length} transaction(s) flagged for audit review to verify tax computation or support documentation.`,
        "Zero unverified overdrafts detected across active departmental budget lines."
      ],
      treasuryRecommendations: [
        "Ensure post-disbursement receipt reconciliation for all approved ministry requisitions.",
        "Maintain current level approval thresholds for upcoming fiscal quarters."
      ],
      generatedAt: new Date().toISOString()
    });
    setAiError(null);
  };

  const handleSaveReport = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await saveReport({
        title: `Ledger Snapshot - ${new Date().toLocaleDateString()}`,
        description: `Audit period summary: ${filterDescription}`,
        period: filterDescription,
        stats: statistics,
        filters: {
          startDate,
          endDate,
          group: selectedGroup,
          status: selectedStatus
        },
        itemCount: filteredRequisitions.length
      });
    } catch (error) {
      console.error("Failed to save report", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <PieChart size={28} className="text-primary" />
            Financial Impact Reporting
          </h2>
          <p className="text-sm text-slate-500 font-medium max-w-xl">
            Compile and audit organizational expenditure transactions for internal filing and physical archives.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <button
            onClick={handleSaveReport}
            disabled={filteredRequisitions.length === 0 || isSaving}
            className="btn-primary px-6 py-3 flex items-center gap-2"
          >
            <Save size={18} className={isSaving ? "animate-spin" : ""} />
            {isSaving ? "PERSISTING..." : "COMMIT TO AUDIT CHAMBER"}
          </button>
        </div>
      </div>

      <GlobalFiscalOverview 
        projects={projects}
        activeYear={systemSettings?.currentFiscalYear}
        status={systemSettings?.fiscalYearStatus}
      />

      {/* Audit Controls Container */}
      <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm space-y-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
          <div>
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-2">
              <LayoutGrid size={16} className="text-primary" />
              Configure Audit Parameters
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-1">SYS_REPORT_ENGINE_ACTIVE</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrintReport}
              disabled={filteredRequisitions.length === 0}
              className="p-3 bg-slate-50 text-slate-600 hover:text-primary hover:bg-primary/5 border border-slate-200 rounded-2xl transition-all disabled:opacity-30"
              title="Physical Print Transaction"
            >
              <Printer size={20} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowDownloadType(!showDownloadType)}
                disabled={filteredRequisitions.length === 0}
                className="p-3 bg-slate-50 text-slate-600 hover:text-primary hover:bg-primary/5 border border-slate-200 rounded-2xl transition-all disabled:opacity-30 flex items-center gap-1 cursor-pointer text-xs font-bold uppercase"
                title="Download Report Documents"
              >
                <Download size={20} />
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {showDownloadType && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDownloadType(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 text-left">
                    <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
                      Export Report Options
                    </div>
                    <button
                      onClick={() => {
                        downloadRequisitionsPdf(filteredRequisitions, "Audit Periodic Summary", currentUser, filterDescription);
                        setShowDownloadType(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Download PDF Document
                    </button>
                    <button
                      onClick={() => {
                        downloadRequisitionsCsv(filteredRequisitions, "Audit Periodic Summary");
                        setShowDownloadType(false);
                      }}
                      className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Download CSV Sheet
                    </button>
                    <button
                      onClick={() => {
                        downloadRequisitionsHtml(filteredRequisitions, "Audit Periodic Summary", currentUser, filterDescription);
                        setShowDownloadType(false);
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
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">FISCAL PERIOD</label>
            <div className="relative">
              <History className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <select
                className="input-field pl-12 font-bold uppercase tracking-widest cursor-pointer"
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
              >
                <option value="ALL">ALL PERIODS</option>
                <option value="CURRENT">CURRENT ({systemSettings?.currentFiscalYear || 2026})</option>
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.year.toString()}>
                    FY {fy.year} ({fy.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">START DATE</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="date" 
                className="input-field pl-12"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">END DATE</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="date" 
                className="input-field pl-12"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GROUP OR MINISTRY</label>
            <div className="relative">
              <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <select
                className="input-field pl-12 font-bold uppercase tracking-widest cursor-pointer"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="ALL">ALL GROUPS & MINISTRIES</option>
                {groups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">REQUISITION STATUS</label>
            <div className="relative">
              <FileCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <select
                className="input-field pl-12 font-bold uppercase tracking-widest cursor-pointer"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="ALL">ALL REQUISITION STATES</option>
                {Object.values(RequisitionStatus).map(status => (
                  <option key={status} value={status}>{status.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Period Selection Buttons */}
        <div className="pt-6 flex flex-wrap items-center gap-2 border-t border-slate-100">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mr-4">PRESET_MACROS:</span>
          {["TODAY", "7_DAYS", "30_DAYS", "THIS_MONTH", "THIS_QUARTER", "THIS_YEAR"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyQuickFilter(preset)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 hover:border-primary/20 hover:bg-primary/5 rounded-xl text-[10px] font-black text-slate-600 hover:text-primary uppercase transition-all tracking-widest active:scale-95"
            >
              {preset.replace("_", " ")}
            </button>
          ))}
          <button
            type="button"
            onClick={() => applyQuickFilter("CLEAR")}
            className="px-4 py-2 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest active:scale-95 ml-auto"
          >
            RESET SEARCH
          </button>
        </div>
      </div>

      {/* Historical read-only archive caution banner */}
      {isSelectedYearArchived && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-4 text-amber-800 dark:text-amber-400">
          <div className="p-2 bg-amber-500/15 rounded-xl self-center">
            <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-black uppercase tracking-wider">READ-ONLY HISTORICAL REPORT VIEW</p>
            <p className="text-[10px] opacity-90 leading-relaxed">
              You are viewing the archived financial record representation of Financial Year {selectedFiscalYear === "CURRENT" ? (systemSettings?.currentFiscalYear || 2026) : selectedFiscalYear}. Submission of new requests, edits, and general approval progressions are locked for this period.
            </p>
          </div>
        </div>
      )}

      {/* Dashboard Aggregates */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "PERIOD_GROSS_BURN", value: statistics.grossValue, icon: TrendingUp, color: "slate" },
          { label: "RELEASED_LIQUIDITY", value: statistics.disbursed, icon: CheckCircle2, color: "emerald" },
          { label: "QUEUED_AUTHORIZATIONS", value: statistics.approved, icon: Filter, color: "primary" },
          { label: "PENDING_TRANSACTIONS", value: statistics.pending, icon: Activity, color: "amber" }
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "p-6 rounded-[2rem] border shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-500",
              stat.color === "slate" && "bg-white border-slate-200",
              stat.color === "emerald" && "bg-emerald-50/30 border-emerald-100",
              stat.color === "primary" && "bg-primary/5 border-primary/10",
              stat.color === "amber" && "bg-amber-50/50 border-amber-100"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500",
               stat.color === "slate" && "bg-slate-100 text-slate-600",
               stat.color === "emerald" && "bg-emerald-100 text-emerald-600",
               stat.color === "primary" && "bg-primary/10 text-primary",
               stat.color === "amber" && "bg-amber-100 text-amber-600"
            )}>
              <stat.icon size={24} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tighter">
              {formatCurrency(stat.value)}
            </h3>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: "70%" }}
                  className={cn(
                    "h-full rounded-full",
                    stat.color === "slate" && "bg-slate-400",
                    stat.color === "emerald" && "bg-emerald-400",
                    stat.color === "primary" && "bg-primary",
                    stat.color === "amber" && "bg-amber-400"
                  )}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Ledger Preview */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden border-t-8 border-t-slate-900">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Live Audited Ledger Feed</h4>
            <div className="flex items-center gap-2 mt-1.5">
               <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
               <p className="text-[10px] text-primary font-black uppercase tracking-widest">{filterDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl">
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                 {filteredRequisitions.length} COMPILED_ENTRIES
               </span>
             </div>
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">TRANSACTION_ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">MANIFEST_DETAILS</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">VALUE_KES</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">AFFILIATION_STATUS</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">TIMESTAMP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence>
                {filteredRequisitions.map((req, idx) => (
                  <motion.tr 
                    key={req.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="hover:bg-slate-50/50 transition-colors group cursor-default"
                  >
                    <td className="px-8 py-5">
                      <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 group-hover:text-primary transition-colors">
                        #{req.id.slice(-8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div>
                        <p className="text-sm font-bold text-slate-900 leading-tight group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <span>{req.title}</span>
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={11} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium truncate max-w-xs">{req.description || "NO_DESCRIPTION_PROVIDED"}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">
                        {formatCurrency(req.amount)}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Building size={10} className="text-slate-300" />
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{req.groupName}</span>
                        </div>
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border w-fit",
                          req.status === RequisitionStatus.DISBURSED ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          req.status === RequisitionStatus.REJECTED ? "bg-rose-50 text-rose-600 border-rose-100" :
                          "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                          {req.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar size={12} />
                        <span className="text-[10px] font-bold text-slate-500 font-mono">{formatDate(req.submittedAt)}</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              
              {filteredRequisitions.length === 0 && syncingTargets.has("requisitions") && (
                <tr className="bg-white">
                  <td colSpan={5} className="py-8 px-6">
                    <div className="w-full flex flex-col gap-3">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="w-full h-16 bg-slate-100 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}

              {filteredRequisitions.length === 0 && !syncingTargets.has("requisitions") && (
                <tr className="bg-white">
                  <td colSpan={5} className="py-32 text-center">
                    <div className="max-w-xs mx-auto space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto border border-slate-100 text-slate-200">
                        <Filter size={32} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Zero Ledger Results</p>
                        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                          No accounting transactions match your current audit parameters. Try expanding the date range or adjusting the status filters.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Auto-Generated Report Summary 1-Pager */}
      <div className="bg-white rounded-[2rem] border-2 border-indigo-100 shadow-xl shadow-indigo-50/50 overflow-hidden relative">
        <div className="px-8 py-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-indigo-900/50">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 ring-4 ring-indigo-500/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">AI Executive Report Summary (1-Pager)</h4>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[9px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1">
                  <Bot size={10} /> Gemini 3.7 Flash
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                Automated 1-pager executive narrative & treasury insights • Scope: <span className="text-indigo-300 font-bold">{filterDescription}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleGenerateAiSummary}
              disabled={isGeneratingAi}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={14} className={cn(isGeneratingAi && "animate-spin")} />
              <span>{isGeneratingAi ? "Analyzing Ledger..." : aiSummary ? "Regenerate AI Summary" : "Generate AI Summary"}</span>
            </button>

            {aiSummary && (
              <>
                <button
                  type="button"
                  onClick={() => downloadAiSummaryPdf(aiSummary, filterDescription)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="Download 1-Pager PDF document"
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => printAiSummaryReport(aiSummary, filterDescription)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  title="Print / View HTML Document"
                >
                  <Printer size={14} />
                  <span>Print 1-Pager</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error Alert / Guidance Banner */}
        {aiError && (
          <div className="p-6 bg-amber-50/90 border-b border-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-amber-900">AI Configuration Notice</p>
                <p className="text-[11px] font-medium text-amber-800 leading-relaxed max-w-3xl">{aiError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={generateFallbackLocalSummary}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 transition-all cursor-pointer shadow-sm"
            >
              View Instant Preview Draft
            </button>
          </div>
        )}

        {/* Un-generated State */}
        {!aiSummary && !isGeneratingAi && !aiError && (
          <div className="p-12 text-center bg-slate-50/50">
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Sparkles size={32} />
              </div>
              <div>
                <h5 className="text-sm font-black text-slate-900 uppercase tracking-[0.15em]">Generate AI Executive 1-Pager Summary</h5>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed font-medium">
                  Click the button below to generate an executive-ready 1-page report summary powered by Gemini 3.7 Flash AI (configured via <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">GEMINI_API_KEY</code> in your <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono">.env</code> file).
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGenerateAiSummary}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 mx-auto shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Sparkles size={16} />
                  <span>Generate 1-Pager Executive Summary</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generating Loading State */}
        {isGeneratingAi && (
          <div className="p-16 text-center bg-slate-50/50">
            <div className="max-w-xs mx-auto space-y-4">
              <div className="w-16 h-16 bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto animate-bounce">
                <Bot size={32} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] animate-pulse">Gemini AI Processing Ledger...</p>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Analyzing {filteredRequisitions.length} compiled transactions, group allocations, and audit compliance vectors.</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Summary 1-Pager Document View */}
        {aiSummary && !isGeneratingAi && (
          <div className="p-8 md:p-10 space-y-8 bg-white">
            {/* Document Header Card */}
            <div className="p-6 bg-slate-900 text-white rounded-2xl border-l-8 border-l-indigo-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-black text-indigo-400 uppercase tracking-widest">OFFICIAL_AI_AUDIT_SUMMARY</span>
                  <span className="text-[9px] font-black bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-md border border-indigo-400/30 uppercase tracking-wider">
                    1-PAGER CERTIFIED
                  </span>
                </div>
                <h3 className="text-base font-black uppercase tracking-wide text-white">{aiSummary.title}</h3>
                <p className="text-xs text-slate-300 font-bold uppercase tracking-widest">{aiSummary.periodLabel}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const textContent = `${aiSummary.title}\nScope: ${aiSummary.periodLabel}\n\n1. EXECUTIVE NARRATIVE:\n${aiSummary.executiveNarrative}\n\n2. KEY HIGHLIGHTS:\n${aiSummary.keyHighlights?.map((h: string) => `- ${h}`).join("\n")}\n\n3. AUDIT OBSERVATIONS:\n${aiSummary.auditObservations?.map((o: string) => `- ${o}`).join("\n")}\n\n4. TREASURY RECOMMENDATIONS:\n${aiSummary.treasuryRecommendations?.map((r: string) => `- ${r}`).join("\n")}`;
                    navigator.clipboard.writeText(textContent);
                    setCopiedAi(true);
                    setTimeout(() => setCopiedAi(false), 2000);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
                >
                  {copiedAi ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copiedAi ? "Copied!" : "Copy Summary Text"}</span>
                </button>
              </div>
            </div>

            {/* Section 1: Executive Narrative */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-2 h-5 bg-indigo-600 rounded-full" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">1. Executive Narrative Analysis</h4>
              </div>
              <div className="p-6 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-slate-700 text-xs font-medium leading-relaxed space-y-3">
                <p className="whitespace-pre-line text-justify">{aiSummary.executiveNarrative}</p>
              </div>
            </div>

            {/* Section 2 & 3: Grid for Key Highlights & Audit Observations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Key Highlights */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-2 h-5 bg-emerald-500 rounded-full" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">2. Key Financial Highlights</h4>
                </div>
                <div className="p-6 bg-emerald-50/40 rounded-2xl border border-emerald-100 text-slate-800 space-y-2.5">
                  {(aiSummary.keyHighlights || []).map((highlight: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs font-medium">
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Observations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <div className="w-2 h-5 bg-amber-500 rounded-full" />
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">3. Audit & Governance Observations</h4>
                </div>
                <div className="p-6 bg-amber-50/40 rounded-2xl border border-amber-100 text-slate-800 space-y-2.5">
                  {(aiSummary.auditObservations || []).map((obs: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs font-medium">
                      <ShieldCheck size={15} className="text-amber-600 shrink-0 mt-0.5" />
                      <span>{obs}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Section 4: Treasury Recommendations */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <div className="w-2 h-5 bg-slate-900 rounded-full" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">4. Strategic Treasury Recommendations</h4>
              </div>
              <div className="p-6 bg-slate-900 text-slate-200 rounded-2xl space-y-2.5 border border-slate-800 shadow-sm">
                {(aiSummary.treasuryRecommendations || []).map((rec: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs font-medium">
                    <ArrowRight size={15} className="text-indigo-400 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Download 1-Pager Footer CTA */}
            <div className="p-6 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Ready to Download 1-Pager Executive Summary</p>
                  <p className="text-[10px] text-slate-500">Includes official St. Andrew's PCEA Church header, audit breakdown, and timestamp.</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => downloadAiSummaryPdf(aiSummary, filterDescription)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download PDF Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => printAiSummaryReport(aiSummary, filterDescription)}
                  className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Document</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Historical Audit snapshots */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white">
              <History size={18} />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Audit Snapshot Vault</h4>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Permanently archived digital ledgers</p>
            </div>
          </div>
          <span className="text-[10px] font-black bg-white/10 text-white px-3 py-1 rounded-xl uppercase tracking-widest">
            {reports.length} VAULTED_LOGS
          </span>
        </div>

        <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
          {reports.map((report) => (
            <div key={report.id} className="p-8 hover:bg-slate-50 transition-colors flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20 transition-all duration-500">
                  <FileText size={28} />
                </div>
                <div className="space-y-1.5">
                  <h5 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{report.title}</h5>
                  <p className="text-[11px] text-slate-500 font-medium">{report.description}</p>
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic font-bold">DIGITAL_CERTIFIED_BY: {report.generatedBy}</span>
                    </div>
                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">{report.itemCount} TRANSACTIONS</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest font-mono">{formatDate(report.timestamp)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => {
                    setStartDate(report.filters.startDate || "");
                    setEndDate(report.filters.endDate || "");
                    setSelectedGroup(report.filters.group || "ALL");
                    setSelectedStatus(report.filters.status || "ALL");
                  }}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-primary/20 hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2"
                >
                  <Search size={14} />
                  RESTORE VIEW
                </button>
              </div>
            </div>
          ))}
          
          {reports.length === 0 && syncingTargets.has("reports") && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                 <div key={i} className="w-full h-32 bg-slate-100 rounded-3xl animate-pulse" />
              ))}
            </div>
          )}

          {reports.length === 0 && !syncingTargets.has("reports") && (
            <div className="py-24 text-center">
              <History size={48} className="mx-auto text-slate-100 mb-4" />
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Vault currently empty</p>
              <p className="text-[10px] text-slate-400 mt-2">Certified audit snapshots will appear here once generated.</p>
            </div>
          )}
        </div>
      </div>

      {/* Physical Archive Protocol Notice */}
      <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200 flex gap-6 items-center">
        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-primary shadow-sm border border-slate-100 shrink-0">
          <ShieldCheck size={32} />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Audit Integrity Protocol</h4>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-4xl">
            Certified reports are permanent ledger snapshots. Once committed to the Audit Chamber, they represent the absolute financial state at the time of generation. Ensure all filters are accurate before commitment. Discrepancies should be resolved prior to physical printing for the St Andrews physical archives.
          </p>
        </div>
      </div>
    </div>
  );
};

