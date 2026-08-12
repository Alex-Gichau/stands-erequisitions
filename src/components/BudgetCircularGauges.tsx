import React, { useMemo, useState, useCallback } from "react";
import { Project, RequisitionStatus, UserRole } from "../types";
import { formatCurrency, cn } from "../lib/utils";
import { Wallet, CheckCircle, AlertTriangle, PiggyBank, ArrowDownRight, TrendingDown } from "lucide-react";
import { motion } from "motion/react";
import { useRequisitions, useActiveFiscalYear } from "../contexts/RequisitionContext";
import { calculateProjectUtilization } from "../utils/budgetUtils";

interface BudgetCircularGaugesProps {
  projects: Project[];
}

interface BudgetCircularGaugeItemProps {
  project: Project;
  isAssigned?: boolean;
}

const BudgetCircularGaugeItem: React.FC<BudgetCircularGaugeItemProps> = ({ project, isAssigned }) => {
  const { requisitions } = useRequisitions();
  const { name, allocatedBudget } = project;

  // Calculate actual spent using centralized budget util helper
  const { 
    usedAmount: spentAmount, 
    spentAmount: actualDisbursed, 
    remainingAmount, 
    percentage: spentPct 
  } = calculateProjectUtilization(project, requisitions);

  const remainingPct = Math.max(0, 100 - spentPct);

  // SVG parameters
  const radius = 40;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  // If remaining percentage is 80%, we want 80% filled
  const strokeDashoffset = circumference - (remainingPct / 100) * circumference;

  // Visual cues/colors based on budget left
  let progressColor = "stroke-indigo-600";
  let bgGradient = "from-indigo-50/20 to-violet-50/10";
  let textColor = "text-indigo-600";
  let alertIcon = null;

  if (remainingPct <= 10) {
    // 90%+ spent -> Critical (Red)
    progressColor = "stroke-rose-500";
    bgGradient = "from-rose-50/40 to-red-50/20 dark:from-rose-950/10 dark:to-red-950/5";
    textColor = "text-rose-600";
    alertIcon = <AlertTriangle size={12} className="text-rose-500 animate-pulse" />;
  } else if (remainingPct <= 25) {
    // 75%+ spent -> Warning (Amber)
    progressColor = "stroke-amber-500";
    bgGradient = "from-amber-50/40 to-yellow-50/20 dark:from-amber-950/10 dark:to-yellow-950/5";
    textColor = "text-amber-600";
    alertIcon = <AlertTriangle size={12} className="text-amber-500" />;
  } else {
    // Good remaining -> Safe (Emerald)
    progressColor = "stroke-emerald-500";
    bgGradient = "from-emerald-50/40 to-teal-50/20 dark:from-emerald-950/10 dark:to-teal-950/5";
    textColor = "text-emerald-600";
  }

  return (
    <motion.div
      id={`gauge-card-${project.id}`}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={cn(
        "bg-gradient-to-br p-5 rounded-3xl border shadow-xs flex flex-col items-center text-center justify-between min-h-[270px] relative overflow-hidden transition-all group",
        isAssigned ? "border-indigo-300 ring-2 ring-indigo-500/20" : "border-slate-200/80",
        bgGradient
      )}
    >
      {/* Assigned badge if applicable */}
      {isAssigned && (
        <span className="absolute top-2 left-2 bg-indigo-600 text-white text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full z-10 shadow-sm">
          Your Ministry
        </span>
      )}

      {/* Decorative subtle pulse border for low budget */}
      {remainingPct <= 10 && (
        <span className="absolute inset-x-0 top-0 h-[3px] bg-rose-500 animate-pulse" />
      )}

      {/* Top Header line of card */}
      <div className="w-full space-y-1 pt-2">
        <div className="flex items-center justify-center gap-1">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">MINISTRY BUDGET</span>
          {alertIcon}
        </div>
        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider line-clamp-1 group-hover:text-primary transition-colors pr-1 pl-1" title={name}>
          {name}
        </h4>
      </div>

      {/* Gauge Visual circle wrapper */}
      <div className="relative w-28 h-28 flex items-center justify-center my-3 select-none">
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle track */}
          <circle
            cx="56"
            cy="56"
            r={radius}
            strokeWidth={strokeWidth}
            stroke="#f1f5f9"
            fill="transparent"
            className="dark:stroke-slate-800"
          />
          {/* Animated Gauge foreground indicator */}
          <motion.circle
            cx="56"
            cy="56"
            r={radius}
            strokeWidth={strokeWidth}
            className={progressColor}
            strokeLinecap="round"
            fill="transparent"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeDasharray={circumference}
          />
        </svg>

        {/* Inner Text elements */}
        <div className="absolute flex flex-col items-center">
          <span className={cn("text-lg font-black font-sans leading-none tracking-tighter", textColor)}>
            {remainingPct.toFixed(0)}%
          </span>
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
            AVAILABLE
          </span>
        </div>
      </div>

      {/* Numeric facts layout */}
      <div className="w-full border-t border-slate-150/60 dark:border-slate-800/80 pt-3 mt-1 space-y-1 bg-white/60 dark:bg-black/15 p-2 rounded-2xl">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 leading-none">
          <span className="font-sans font-bold text-[8px] uppercase tracking-wider">Remaining:</span>
          <span className="font-black text-slate-800 font-sans text-[10px]">Ksh {remainingAmount.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 leading-none">
          <span className="font-sans">Spent ({spentPct.toFixed(0)}%):</span>
          <span>Ksh {spentAmount.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono text-slate-400 leading-none">
          <span className="font-sans">Allocated:</span>
          <span>Ksh {allocatedBudget.toLocaleString()}</span>
        </div>
      </div>
    </motion.div>
  );
};

export const BudgetCircularGauges: React.FC<BudgetCircularGaugesProps> = ({ projects }) => {
  const { requisitions, churchGroups, currentUser, ledgerBooks } = useRequisitions();
  const { year: activeYear } = useActiveFiscalYear();
  const [showAllGauges, setShowAllGauges] = useState(false);
  const [filterMode, setFilterMode] = useState<"MY_MINISTRIES" | "ALL">("MY_MINISTRIES");

  // User assigned group names (clean lower-case set)
  const assignedGroupsList = useMemo(() => {
    if (!currentUser) return [];
    const list: string[] = [];
    if (currentUser.group) list.push(currentUser.group.trim());
    if (Array.isArray(currentUser.groups)) {
      currentUser.groups.forEach(g => {
        if (g && !list.includes(g.trim())) list.push(g.trim());
      });
    }
    return list;
  }, [currentUser]);

  // Combine DB projects for active fiscal year with any active church groups missing explicit project rows
  const activeYearProjects = useMemo(() => {
    const existing = projects.filter(p => p.fiscalYear === activeYear || (!p.fiscalYear && activeYear === 2026));
    const existingGroupNames = new Set(existing.map(p => (p.groupId || p.name).toLowerCase().trim()));

    const synthesized: Project[] = [];
    churchGroups.forEach(cg => {
      const cgClean = cg.name.toLowerCase().trim();
      if (!existingGroupNames.has(cgClean)) {
        // Find if there is a ledger book with budget limit for this group
        const matchingLedger = ledgerBooks.find(lb => lb.ministryName.toLowerCase().trim() === cgClean || lb.ministryId.toLowerCase().trim() === cgClean);
        const allocatedBudget = matchingLedger ? matchingLedger.budgetLimit : 0;

        synthesized.push({
          id: `cg-synth-${cg.id || cg.name}`,
          name: cg.name,
          groupId: cg.name,
          allocatedBudget,
          spentAmount: 0,
          status: "ACTIVE",
          color: "bg-indigo-500",
          fiscalYear: activeYear
        });
      }
    });

    return [...existing, ...synthesized];
  }, [projects, churchGroups, ledgerBooks, activeYear]);

  // Check if project belongs to assigned groups
  const isProjectAssigned = useCallback((p: Project) => {
    if (assignedGroupsList.length === 0) return false;
    const pGroup = (p.groupId || p.name).toLowerCase().trim();
    return assignedGroupsList.some(ag => {
      const cleanAg = ag.toLowerCase().trim();
      return pGroup === cleanAg || pGroup.includes(cleanAg) || cleanAg.includes(pGroup);
    });
  }, [assignedGroupsList]);

  const assignedProjects = useMemo(() => {
    return activeYearProjects.filter(p => isProjectAssigned(p));
  }, [activeYearProjects, isProjectAssigned]);

  const isRestrictedRole = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.role === UserRole.CHURCH_GROUP ||
      currentUser.role === UserRole.APPROVER_L1 ||
      currentUser.role === UserRole.APPROVER_L2
    );
  }, [currentUser]);

  const displayedProjectsList = useMemo(() => {
    if (isRestrictedRole) {
      return assignedProjects;
    }
    if (filterMode === "MY_MINISTRIES" && assignedGroupsList.length > 0 && assignedProjects.length > 0) {
      return assignedProjects;
    }
    return activeYearProjects;
  }, [isRestrictedRole, filterMode, assignedGroupsList, assignedProjects, activeYearProjects]);

  // Total Summary values for displayed stats
  const summary = useMemo(() => {
    let totalBudget = 0;
    let totalSpent = 0;

    displayedProjectsList.forEach(p => {
      totalBudget += p.allocatedBudget;
      const { usedAmount } = calculateProjectUtilization(p, requisitions);
      totalSpent += usedAmount;
    });

    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const overallRemainingPct = totalBudget > 0 ? (totalRemaining / totalBudget) * 100 : 0;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overallRemainingPct,
      count: displayedProjectsList.length
    };
  }, [displayedProjectsList, requisitions]);

  const displayedProjects = showAllGauges ? displayedProjectsList : displayedProjectsList.slice(0, 5);
  const hasMore = displayedProjectsList.length > 5;

  return (
    <div 
      id="budget-circular-gauges-container"
      className="bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 shadow-sm space-y-6"
    >
      {/* Header Info Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="p-1 px-1.5 bg-indigo-50 text-indigo-600 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 w-fit border border-indigo-100">
              <PiggyBank size={12} />
              Ministry Available Budget
            </span>
            {assignedGroupsList.length > 0 && (
              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-emerald-200">
                {assignedGroupsList.length} Assigned {assignedGroupsList.length === 1 ? "Ministry" : "Ministries"}
              </span>
            )}
          </div>
          <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">
            Ministry Available Budget Safe-To-Spend
          </h3>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            Realtime available calculation showing uncommitted cash balances for active church group categories
          </p>
        </div>

        {/* Global remaining Summary card */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-4 shrink-0 transition-all hover:bg-slate-100/50">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <ArrowDownRight size={20} className="animate-bounce" />
          </div>
          <div>
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">AGGREGATE FREE HEADROOM</div>
            <div className="text-base font-black text-slate-900 font-sans tracking-tight leading-none mb-1">
              Ksh {summary.totalRemaining.toLocaleString()}
            </div>
            <div className="text-[9px] font-bold text-indigo-600 leading-none">
              Over {summary.overallRemainingPct.toFixed(1)}% safe balance unspent
            </div>
          </div>
          <div className="ml-auto text-right pl-4 border-l border-slate-200">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">TOTAL ACTUAL SPENT</div>
            <div className="text-base font-black text-emerald-600 font-sans tracking-tight leading-none mb-1">
              Ksh {summary.totalSpent.toLocaleString()}
            </div>
            <div className="text-[9px] font-bold text-slate-400 leading-none">
              Physical cash outflow recorded
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toggle for Users with assigned groups - hidden for restricted roles (approvers & church groups) who only see assigned ministries */}
      {!isRestrictedRole && assignedGroupsList.length > 0 && assignedProjects.length > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Display Scope:</span>
          <button
            onClick={() => setFilterMode("MY_MINISTRIES")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border",
              filterMode === "MY_MINISTRIES"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            )}
          >
            My Assigned Ministries ({assignedProjects.length})
          </button>
          <button
            onClick={() => setFilterMode("ALL")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border",
              filterMode === "ALL"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            )}
          >
            All Organization Ministries ({activeYearProjects.length})
          </button>
        </div>
      )}

      {displayedProjectsList.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {displayedProjects.map(project => (
              <BudgetCircularGaugeItem 
                key={project.id} 
                project={project} 
                isAssigned={isProjectAssigned(project)}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setShowAllGauges(!showAllGauges)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-6 py-2.5 rounded-full border border-slate-200 transition-colors cursor-pointer"
              >
                {showAllGauges ? "Show Less" : `See All ${displayedProjectsList.length} Categories`}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400">
          <Wallet size={36} />
          <p className="text-[10px] font-black uppercase tracking-widest mt-2">No active group budget items found</p>
          {!isRestrictedRole && filterMode === "MY_MINISTRIES" && (
            <button
              onClick={() => setFilterMode("ALL")}
              className="mt-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline cursor-pointer"
            >
              View All Organization Ministries ({activeYearProjects.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
};
