import React, { useMemo } from "react";
import { motion } from "motion/react";
import { CalendarRange, TrendingUp, Wallet, Banknote } from "lucide-react";
import { Project, RequisitionStatus } from "../types";
import { formatCurrency, cn } from "../lib/utils";
import { useRequisitions } from "../contexts/RequisitionContext";

interface GlobalFiscalOverviewProps {
  projects: Project[];
  activeYear: number;
  status?: string;
  className?: string;
}

export const GlobalFiscalOverview: React.FC<GlobalFiscalOverviewProps> = ({ 
  projects, 
  activeYear,
  status = "OPEN",
  className
}) => {
  const { requisitions, churchGroups } = useRequisitions();

  const fiscalStats = useMemo(() => {
    const activeProjects = projects.filter(p => p.fiscalYear === activeYear || (!p.fiscalYear && activeYear === 2026));
    const totalAllocated = activeProjects.reduce((sum, p) => sum + p.allocatedBudget, 0);
    
    const committedRequisitions = requisitions.filter(r => {
      const rYear = r.fiscalYear || (r.submittedAt ? new Date(r.submittedAt).getFullYear() : (r.createdAt ? new Date(r.createdAt).getFullYear() : 2026));
      return rYear === activeYear && [
        RequisitionStatus.SUBMITTED, 
        RequisitionStatus.APPROVED_L1, 
        RequisitionStatus.ESCALATED, 
        RequisitionStatus.APPROVED_L2, 
        RequisitionStatus.DISBURSED
      ].includes(r.status);
    });

    const totalSpentAndCommitted = committedRequisitions.reduce((sum, r) => sum + r.amount, 0);
    const utilizationRate = totalAllocated > 0 ? (totalSpentAndCommitted / totalAllocated) * 100 : 0;
    const requisitionsCount = committedRequisitions.length;
    const projectsCount = Math.max(activeProjects.length, churchGroups.length);
    const totalRemaining = Math.max(0, totalAllocated - totalSpentAndCommitted);

    return {
      totalAllocated,
      totalSpentAndCommitted,
      utilizationRate,
      requisitionsCount,
      projectsCount,
      totalRemaining
    };
  }, [projects, churchGroups, requisitions, activeYear]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden",
        className
      )}
    >
      <div className="absolute right-[-20px] top-[-20px] opacity-5 text-indigo-950 pointer-events-none">
        <Banknote size={200} strokeWidth={1} />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
        <div className="space-y-3 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-indigo-100">
              <CalendarRange size={14} />
              Church Financial Year {activeYear}
            </span>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest leading-none border",
              status === "ARCHIVED" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}>
              {status}
            </span>
          </div>
          
          <h2 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-tight">
            STANDS MINISTRIES<br />
            <span className="text-primary">FINANCIAL OVERVIEW</span>
          </h2>
          
          <p className="text-slate-500 text-xs md:text-sm leading-relaxed max-w-md">
            This requisitions data runs across {fiscalStats.projectsCount} ministry groups. 
            The data is monitored and updated displayed in realtime.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
              <Wallet size={16} className="text-slate-400" />
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Headroom</p>
                <p className="text-xs font-bold text-slate-700">{formatCurrency(fiscalStats.totalRemaining)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
              <TrendingUp size={16} className="text-slate-400" />
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Links</p>
                <p className="text-xs font-bold text-slate-700">{fiscalStats.requisitionsCount} Requisitions</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full lg:max-w-xl space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Total Allocated</span>
              <span className="font-mono font-black text-slate-950 text-base md:text-xl">
                {formatCurrency(fiscalStats.totalAllocated)}
              </span>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Spent & Committed</span>
              <span className="font-mono font-black text-primary text-base md:text-xl">
                {formatCurrency(fiscalStats.totalSpentAndCommitted)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">YTD Spending Progress</span>
              <span className={cn(
                "text-sm font-black font-mono",
                fiscalStats.utilizationRate >= 95 ? "text-rose-600" : fiscalStats.utilizationRate >= 85 ? "text-amber-600" : "text-emerald-600"
              )}>
                {fiscalStats.utilizationRate.toFixed(1)}%
              </span>
            </div>
            
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-[3px] shadow-inner relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(fiscalStats.utilizationRate, 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full transition-all duration-1000 relative z-10",
                  fiscalStats.utilizationRate >= 95 
                    ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]" 
                    : fiscalStats.utilizationRate >= 85 
                      ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]" 
                      : "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                )}
              />
              {/* Markers */}
              <div className="absolute inset-0 flex justify-between px-2 py-1 items-center pointer-events-none overflow-hidden opacity-20">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="w-px h-full bg-slate-300" />
                ))}
              </div>
            </div>

            <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest pt-1">
              <span>Fiscal Floor $0.00</span>
              <span>Ceiling reached at 100% Limit</span>
            </div>
          </div>

          {fiscalStats.utilizationRate >= 90 && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-center gap-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-rose-600" />
              <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest">
                CRITICAL WARNING: Aggregated budget reserves have crossed 90% utilization threshold.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
