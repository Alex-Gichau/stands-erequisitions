/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Download, 
  ExternalLink,
  Activity,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  Briefcase,
  Trash2,
  RefreshCw,
  Building2,
  User,
  FileText,
  X,
  ShieldCheck,
  Database,
  Calendar,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { Transaction, TransactionType, TransactionStatus, RequisitionStatus } from "../types";
import { cn } from "../lib/utils";

export const TransactionsPanel: React.FC = () => {
  const { 
    transactions, 
    requisitions, 
    syncingTargets, 
    clearWebTransactions, 
    syncRealDisbursedTransactions,
    isDbSaving
  } = useRequisitions();

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "ALL">("ALL");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Pagination state (15 rows per page)
  const [txPage, setTxPage] = useState(1);
  const TX_PER_PAGE = 15;

  useEffect(() => {
    setTxPage(1);
  }, [searchTerm, typeFilter, statusFilter]);

  const disbursedReqs = useMemo(() => {
    return requisitions
      .filter(r => r.status === RequisitionStatus.DISBURSED)
      .sort((a, b) => {
        const dateA = new Date(a.disbursedAt || a.updatedAt || a.submittedAt).getTime();
        const dateB = new Date(b.disbursedAt || b.updatedAt || b.submittedAt).getTime();
        return dateB - dateA;
      });
  }, [requisitions]);

  const filteredTransactions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const numericTerm = term.replace(/[^0-9.]/g, "");

    return transactions
      .filter(t => {
        let matchesSearch = true;
        if (term) {
          const refMatch = t.externalRef.toLowerCase().includes(term) || t.id.toLowerCase().includes(term);
          const vendorMatch = 
            (t.metadata?.payableTo && t.metadata.payableTo.toLowerCase().includes(term)) ||
            (t.performedBy && t.performedBy.toLowerCase().includes(term)) ||
            t.description.toLowerCase().includes(term) ||
            (t.category && t.category.toLowerCase().includes(term));
          const amountMatch = 
            t.amount.toString().includes(term) ||
            t.amount.toLocaleString().toLowerCase().includes(term) ||
            (numericTerm.length > 0 && t.amount.toString().includes(numericTerm));
          const systemMatch = t.sourceSystem.toLowerCase().includes(term);

          matchesSearch = refMatch || vendorMatch || amountMatch || systemMatch;
        }

        const matchesType = typeFilter === "ALL" || t.type === typeFilter;
        const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;

        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [transactions, searchTerm, typeFilter, statusFilter]);

  const totalTxPages = Math.ceil(filteredTransactions.length / TX_PER_PAGE) || 1;

  const paginatedTransactions = useMemo(() => {
    const safePage = Math.min(Math.max(1, txPage), totalTxPages);
    const start = (safePage - 1) * TX_PER_PAGE;
    return filteredTransactions.slice(start, start + TX_PER_PAGE);
  }, [filteredTransactions, txPage, totalTxPages]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todays = transactions.filter(t => t.timestamp.startsWith(today));
    
    return {
      totalVolume: transactions.reduce((acc, t) => acc + t.amount, 0),
      todaysCount: todays.length,
      disbursedCount: disbursedReqs.length,
      disbursedTotal: disbursedReqs.reduce((acc, r) => acc + r.amount, 0),
      pendingCount: transactions.filter(t => t.status === TransactionStatus.PENDING).length,
      failedCount: transactions.filter(t => t.status === TransactionStatus.FAILED).length,
    };
  }, [transactions, disbursedReqs]);

  const handleClearWeb = async () => {
    try {
      if (clearWebTransactions) {
        await clearWebTransactions();
      }
      setShowClearConfirm(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = ["ID", "External Ref", "Description", "Amount (KES)", "Type", "Status", "Source System", "Category / Group", "Date/Time", "Performed By"];
    const rows = filteredTransactions.map(t => [
      t.id,
      t.externalRef,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount,
      t.type,
      t.status,
      `"${t.sourceSystem}"`,
      `"${t.category || ""}"`,
      new Date(t.timestamp).toLocaleString('en-KE'),
      `"${t.performedBy || ""}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Real_Disbursed_Transactions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 p-4 md:p-8 bg-slate-50 space-y-8">
      {/* Header Title Banner with Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[2rem] p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-widest">
              <Database className="w-4 h-4" />
              <span>PCEA St. Andrew's Disbursed Ledger</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Disbursed Funds & Transactions
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl font-normal">
              Official ledger of all verified, settled, and disbursed treasury funds. Transactions are automatically created and updated in real-time as disbursements occur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Trash2 size={15} />
              <span>Clear Web Transactions</span>
            </button>
          </div>
        </div>
      </div>

      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { 
            label: "Total Ledger Volume", 
            value: `KES ${stats.totalVolume.toLocaleString()}`, 
            icon: Briefcase, 
            color: "text-indigo-600", 
            bg: "bg-indigo-50",
            sub: `${transactions.length} records stored`
          },
          { 
            label: "Disbursed Funds", 
            value: `KES ${stats.disbursedTotal.toLocaleString()}`, 
            icon: ShieldCheck, 
            color: "text-emerald-600", 
            bg: "bg-emerald-50",
            sub: `${stats.disbursedCount} requisition approvals`
          },
          { 
            label: "Pending Settlement", 
            value: stats.pendingCount, 
            icon: Clock, 
            color: "text-amber-600", 
            bg: "bg-amber-50",
            sub: "Pending bank/M-Pesa sync"
          },
          { 
            label: "Flagged / Anomalies", 
            value: stats.failedCount, 
            icon: AlertCircle, 
            color: "text-rose-600", 
            bg: "bg-rose-50",
            sub: "Requires audit review"
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white border-2 border-slate-100 p-4 md:p-5 rounded-2xl md:rounded-[2rem] shadow-sm flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
              <div className={cn("p-2 rounded-xl shrink-0", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
            </div>
            <div>
              <p className="text-base md:text-xl font-black text-slate-900 truncate">
                {stat.value}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 mt-0.5">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Ledger Section */}
      <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {/* Controls Toolbar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-lg group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-sky-600 transition-colors" />
              <input
                type="text"
                placeholder="Search history by Reference ID, Vendor, or Amount (e.g. MPESA-123, John, 5000)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setTimeout(() => setSearchTerm(""), 1000);
                  }
                }}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl py-2.5 pl-11 pr-10 text-sm focus:outline-none focus:ring-4 focus:ring-sky-50 focus:border-sky-600 transition-all font-medium text-slate-800 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-sky-600 cursor-pointer"
              >
                <option value="ALL">ALL TYPES</option>
                {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-sky-600 cursor-pointer"
              >
                <option value="ALL">ALL STATUS</option>
                {Object.values(TransactionStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-40"
          >
            <Download size={14} />
            <span>Export Statement</span>
          </button>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/40">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Disbursements</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ministry / Group</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount (KES)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source System</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Disbursed Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {paginatedTransactions.map((tx) => {
                  const isReal = tx.metadata?.isRealDisbursed || tx.id.startsWith("tx-disb-");
                  return (
                    <motion.tr
                      key={tx.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedTx(tx)}
                      className="group hover:bg-sky-50/40 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors flex items-center gap-2">
                            <span>{tx.description}</span>
                            {isReal && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase rounded-md border border-emerald-200 shrink-0">
                                Disbursed
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-slate-500">
                            <span className="font-semibold text-slate-400 uppercase">REF: {tx.externalRef}</span>
                            {tx.metadata?.payableTo && (
                              <span className="text-slate-600 font-sans font-medium flex items-center gap-1">
                                <User size={10} className="text-slate-400" />
                                {tx.metadata.payableTo}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-lg border border-slate-200/60 inline-block">
                          {tx.category || "General Treasury"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                          tx.type === TransactionType.CREDIT ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          tx.type === TransactionType.DEBIT ? "bg-rose-50 text-rose-600 border border-rose-100" :
                          "bg-indigo-50 text-indigo-600 border border-indigo-100"
                        )}>
                          {tx.type === TransactionType.CREDIT ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                          {tx.type}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "text-sm font-black",
                          tx.type === TransactionType.CREDIT ? "text-emerald-600" : "text-slate-900"
                        )}>
                          {tx.type === TransactionType.CREDIT ? "+" : "-"}KES {tx.amount.toLocaleString()}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                            <ExternalLink size={10} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 truncate max-w-[140px]">{tx.sourceSystem}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {tx.status === TransactionStatus.COMPLETED ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                              <CheckCircle2 size={12} className="text-emerald-600" />
                              <span>Disbursed</span>
                            </div>
                          ) : tx.status === TransactionStatus.PENDING ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase">
                              <Clock size={12} className="text-amber-600" />
                              <span>In Progress</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase">
                              <AlertCircle size={12} className="text-rose-600" />
                              <span>Flagged</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-bold text-slate-900">
                            {new Date(tx.timestamp).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(tx.timestamp).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredTransactions.length === 0 && syncingTargets.has("transactions") && (
            <div className="py-8 w-full flex flex-col gap-3 px-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-full h-[76px] bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {filteredTransactions.length === 0 && !syncingTargets.has("transactions") && (
            <div className="p-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-300">
                <History className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">No disbursed transactions recorded yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Once a requisition is approved and marked as disbursed by Finance, the official disbursement transaction will automatically appear here.
                </p>
              </div>
            </div>
          )}

          {filteredTransactions.length > 0 && (
            <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-500">
              <div className="text-[11px] font-bold text-slate-500">
                Showing <span className="font-extrabold text-slate-800">{((txPage - 1) * TX_PER_PAGE) + 1}</span> to <span className="font-extrabold text-slate-800">{Math.min(txPage * TX_PER_PAGE, filteredTransactions.length)}</span> of <span className="font-extrabold text-slate-800">{filteredTransactions.length}</span> transactions
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTxPage(p => Math.max(1, p - 1))}
                  disabled={txPage === 1}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1 px-2 font-mono text-[11px] font-extrabold">
                  <span className="text-sky-600">{txPage}</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-500">{totalTxPages}</span>
                </div>

                <button
                  onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))}
                  disabled={txPage >= totalTxPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider cursor-pointer"
                  title="Next Page"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Clearing Web Transactions */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 space-y-6"
            >
              <div className="flex items-center gap-4 text-rose-600 bg-rose-50 p-4 rounded-2xl border border-rose-100">
                <Trash2 className="w-8 h-8 shrink-0" />
                <div>
                  <h3 className="text-base font-black text-slate-900">Clear Web Transactions</h3>
                  <p className="text-xs text-slate-600 font-medium">Clear mock and web transaction records</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                This action will remove current simulated web transactions from the database ledger view. Official disbursed funds transactions can be re-synchronized and stored at any time using the <strong>Store Disbursed Funds</strong> action.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearWeb}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors shadow-lg shadow-rose-600/20 cursor-pointer"
                >
                  Confirm & Clear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Modal for Selected Transaction */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6 relative overflow-hidden"
            >
              <button
                onClick={() => setSelectedTx(null)}
                className="absolute right-6 top-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disbursement Record</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-black rounded-md uppercase">
                      Official Disbursed Ledger
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{selectedTx.description}</h3>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200/60">
                  <span className="text-xs font-semibold text-slate-500">Total Disbursed Amount</span>
                  <span className="text-xl font-black text-slate-900">KES {selectedTx.amount.toLocaleString()}</span>
                </div>

                {selectedTx.metadata?.amountWords && (
                  <div className="text-xs italic text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                    "{selectedTx.metadata.amountWords}"
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Reference Ref</span>
                    <span className="font-mono font-bold text-slate-800">{selectedTx.externalRef}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Ministry / Group</span>
                    <span className="font-bold text-slate-800">{selectedTx.category || "General Treasury"}</span>
                  </div>
                  {selectedTx.metadata?.payableTo && (
                    <div className="col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Payee / Beneficiary</span>
                      <span className="font-bold text-sky-700 flex items-center gap-1.5 mt-0.5">
                        <User size={12} className="text-sky-500" />
                        {selectedTx.metadata.payableTo}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Source System</span>
                    <span className="font-semibold text-slate-700">{selectedTx.sourceSystem}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Settlement Date</span>
                    <span className="font-semibold text-slate-700">{new Date(selectedTx.timestamp).toLocaleString('en-KE')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <Check size={14} />
                  <span>Stored on Website Database</span>
                </div>
                <button
                  onClick={() => setSelectedTx(null)}
                  className="px-5 py-2.5 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionsPanel;
