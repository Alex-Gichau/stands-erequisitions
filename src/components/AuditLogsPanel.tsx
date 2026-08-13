import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldAlert, 
  Search, 
  Calendar, 
  User, 
  Filter, 
  Download, 
  History,
  Info,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  Database,
  Activity,
  Zap,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { SystemLog, UserRole } from "../types";
import { cn } from "../lib/utils";
import { getTimeUntilMidnightPT } from "../lib/errorMonitor";
import { getFirestoreWriteCount } from "../lib/quotaMonitor";
import { AuditSummaryWidget } from "./AuditSummaryWidget";
import { EmailHistoryAuditPanel } from "./EmailHistoryAuditPanel";

export const AuditLogsPanel: React.FC = () => {
  const { systemLogs, currentUser, systemLogLimit, setSystemLogLimit, syncingTargets } = useRequisitions();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActionFilter, setSelectedActionFilter] = useState("ALL");
  const [selectedLevelFilter, setSelectedLevelFilter] = useState("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS'>('ALL');
  const [activeTab, setActiveTab] = useState<'LOGS' | 'EMAILS'>('LOGS');
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ROWS_PER_PAGE = 15;

  const uniqueActions = useMemo(() => {
    const actions = new Set(systemLogs.map(log => log.action));
    return ["ALL", ...Array.from(actions)];
  }, [systemLogs]);

  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return systemLogs.filter(log => {
      const matchesSearch = 
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesAction = selectedActionFilter === "ALL" || log.action === selectedActionFilter;
      const matchesLevel = selectedLevelFilter === "ALL" || (log.metadata?.level === selectedLevelFilter);

      let matchesDate = true;
      const logTime = new Date(log.timestamp).getTime();
      if (!isNaN(logTime)) {
        if (dateRangeFilter === 'TODAY') {
          matchesDate = (now - logTime) <= oneDayMs;
        } else if (dateRangeFilter === '7DAYS') {
          matchesDate = (now - logTime) <= 7 * oneDayMs;
        } else if (dateRangeFilter === '30DAYS') {
          matchesDate = (now - logTime) <= 30 * oneDayMs;
        }
      }

      return matchesSearch && matchesAction && matchesLevel && matchesDate;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [systemLogs, searchTerm, selectedActionFilter, selectedLevelFilter, dateRangeFilter]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedActionFilter, selectedLevelFilter, dateRangeFilter, systemLogLimit]);

  const totalPages = Math.ceil(filteredLogs.length / ROWS_PER_PAGE) || 1;

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredLogs.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredLogs, currentPage, ROWS_PER_PAGE]);

  if (currentUser?.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <ShieldAlert className="text-rose-500 w-16 h-16" />
        <h2 className="text-2xl font-black uppercase">Access Restricted</h2>
        <p className="text-slate-500 max-w-md font-medium">The System Audit Trail is only accessible to Super Admins. Please contact your administrator if you believe this is an error.</p>
      </div>
    );
  }

  const exportLogsCsv = () => {
    const headers = ["Timestamp", "Action", "Details", "Performed By"];
    const content = filteredLogs.map(l => [
      l.timestamp,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.performedBy.replace(/"/g, '""')}"`
    ].join(",")).join("\n");
    
    const blob = new Blob([headers.join(",") + "\n" + content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "system_audit_logs.csv";
    link.click();
  };

  const getLogIcon = (action: string) => {
    if (action.includes("Login") || action.includes("Auth") || action.includes("USER")) return <User size={18} className="text-indigo-500" />;
    if (action.includes("Delete") || action.includes("Remove")) return <AlertTriangle size={18} className="text-rose-500" />;
    if (action.includes("Update") || action.includes("Edit")) return <History size={18} className="text-amber-500" />;
    if (action.includes("SYNC_MEMORY") || action.includes("SYNC_RENDER")) return <Activity size={18} className="text-amber-500" />;
    return <Info size={18} className="text-slate-400" />;
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="text-primary w-6 h-6" />
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">System Audit Trail</h1>
          </div>
          <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest pl-8">Optimized real-time ledger of system transactions & security events</p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('LOGS')}
            className={cn("px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer", activeTab === 'LOGS' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
          >
            System Logs
          </button>
          <button 
            onClick={() => setActiveTab('EMAILS')}
            className={cn("px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer", activeTab === 'EMAILS' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}
          >
            Email History
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQuotaModal(true)}
            className="flex items-center gap-2 px-5 py-3 border-2 border-indigo-100 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm cursor-pointer bg-white"
          >
            <Activity size={14} />
            Quota Monitor
          </button>
          <button
            onClick={exportLogsCsv}
            className="flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm cursor-pointer"
          >
            <Download size={14} />
            Export Trail
          </button>
          <div className="flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">
            <Zap size={14} className="text-emerald-400" />
            Bounded Sync ({systemLogLimit} limit)
          </div>
        </div>
      </div>

      {showQuotaModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Activity className="text-indigo-600" size={20} />
                <h3 className="text-sm font-black uppercase text-slate-900 tracking-wider">System Quota & Performance Monitor</h3>
              </div>
              <button 
                onClick={() => setShowQuotaModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4 text-xs font-sans">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950">
                  <span>Current Fetch Limit</span>
                  <span className="font-mono text-indigo-600 font-black">{systemLogLimit} Records</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950">
                  <span>Tracked Writes (Session)</span>
                  <span className="font-mono text-emerald-600 font-black">{getFirestoreWriteCount().toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950">
                  <span>Daily Quota Reset</span>
                  <span className="font-mono text-slate-600">{getTimeUntilMidnightPT()}</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Performance Strategy</span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Audit queries use bounded limits (<strong className="text-slate-800">limit(N)</strong>) and indexed timestamp sorting to guarantee low latency without downloading large historical datasets on startup.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowQuotaModal(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Monitor
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'LOGS' ? (
      <div className="space-y-6">
        <AuditSummaryWidget logs={systemLogs} />
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="sticky top-4 self-start space-y-6">
            <div className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search Ledger</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                <input 
                  type="text"
                  placeholder="Filter by keyword..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-bold tracking-tight focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Window</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'ALL', label: 'All Time' },
                  { key: 'TODAY', label: 'Last 24h' },
                  { key: '7DAYS', label: 'Last 7 Days' },
                  { key: '30DAYS', label: 'Last 30 Days' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setDateRangeFilter(item.key as any)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer text-center",
                      dateRangeFilter === item.key ? "bg-slate-900 text-white shadow-xs" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetch Limit</label>
                <span className="text-[10px] font-mono font-bold text-indigo-600">{systemLogLimit} logs</span>
              </div>
              <div className="flex items-center gap-2">
                {[50, 100, 250, 500].map(limitVal => (
                  <button
                    key={limitVal}
                    onClick={() => setSystemLogLimit(limitVal)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer text-center border",
                      systemLogLimit === limitVal ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {limitVal}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Action Filter</label>
              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {uniqueActions.map(action => (
                  <button
                    key={action}
                    onClick={() => setSelectedActionFilter(action)}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-left transition-all cursor-pointer",
                      selectedActionFilter === action ? "bg-primary text-white shadow-md" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {action.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
               <div className="flex items-center gap-2 mb-2">
                 <CheckCircle2 className="text-emerald-600" size={14} />
                 <span className="text-[10px] font-black text-emerald-800 uppercase">Fast Sync Enabled</span>
               </div>
               <p className="text-[9px] font-bold text-emerald-700 leading-relaxed uppercase tracking-widest">
                 Log stream is bounded to {systemLogLimit} recent entries to maintain instant UI responsiveness.
               </p>
            </div>
           </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                    <th className="px-8 py-5">Event Details & Logic</th>
                    <th className="px-8 py-5">Performed By</th>
                    <th className="px-8 py-5">Timestamp (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedLogs.map((log, idx) => (
                    <motion.tr 
                      layout
                      key={`audit-trail-log-${log.id || idx}-${idx}`} 
                      className="group hover:bg-indigo-50/30 transition-colors"
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:border-primary/20 transition-all">
                             {getLogIcon(log.action)}
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{log.action}</div>
                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed tracking-tight max-w-md">{log.details}</p>
                            {log.metadata && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {Object.entries(log.metadata).map(([key, value]: [string, any]) => (
                                  <span key={key} className="px-2 py-0.5 bg-slate-100 rounded text-[8px] font-mono text-slate-400 font-bold uppercase">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-[10px] font-black">
                            {log.performedBy.charAt(0)}
                          </div>
                          <div>
                            <div className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{log.performedBy}</div>
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">System User</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                           <div className="text-[10px] font-black text-slate-900 tabular-nums">
                             {new Date(log.timestamp).toLocaleDateString()}
                           </div>
                           <div className="text-[10px] font-bold text-slate-400 tabular-nums">
                             {new Date(log.timestamp).toLocaleTimeString()}
                           </div>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              
              {filteredLogs.length === 0 && syncingTargets.has("system_logs") && (
                <div className="py-8 w-full flex flex-col gap-3 px-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="w-full h-16 bg-slate-100 rounded-2xl animate-pulse" />
                  ))}
                </div>
              )}

              {filteredLogs.length === 0 && !syncingTargets.has("system_logs") && (
                <div className="py-32 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                    <History size={40} />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase text-slate-600">No logs found</h3>
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">The trail is empty for current filter criteria</p>
                  </div>
                </div>
              )}
            </div>

            {filteredLogs.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-t border-slate-100 bg-slate-50/50 gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                    Showing <span className="font-mono text-slate-900 font-black">{(currentPage - 1) * ROWS_PER_PAGE + 1}</span> to <span className="font-mono text-slate-900 font-black">{Math.min(currentPage * ROWS_PER_PAGE, filteredLogs.length)}</span> of <span className="font-mono text-slate-900 font-black">{filteredLogs.length}</span> audit logs
                  </span>

                  {systemLogs.length >= systemLogLimit && (
                    <button
                      onClick={() => setSystemLogLimit(systemLogLimit + 100)}
                      className="px-3 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[9px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <History size={11} className="text-indigo-500" />
                      Load +100 Logs
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft size={14} />
                    <span>Prev</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                      .reduce<(number | string)[]>((acc, page, idx, arr) => {
                        if (idx > 0 && (page as number) - (arr[idx - 1] as number) > 1) {
                          acc.push("...");
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((p, i) => 
                        typeof p === "number" ? (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={cn(
                              "w-7 h-7 rounded-lg text-[10px] font-black font-mono transition-all cursor-pointer flex items-center justify-center border",
                              currentPage === p 
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs" 
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {p}
                          </button>
                        ) : (
                          <span key={`ellipsis-${i}`} className="text-slate-400 text-xs px-1 font-mono">...</span>
                        )
                      )
                    }
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      ) : (
        <EmailHistoryAuditPanel systemLogs={systemLogs} />
      )}
    </div>
  );
};

const PlusCircle = ({ size, className }: { size: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);
