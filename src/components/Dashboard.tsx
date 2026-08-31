/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useCallback } from "react";
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useRequisitions, useActiveFiscalYear } from "../contexts/RequisitionContext";
import { COMMITTED_REQUISITION_STATUSES, calculateProjectUtilization, getProjectRequisitions } from "../utils/budgetUtils";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, cn, getDaysSinceSubmission, formatRequisitionAge, isFinalStage } from "../lib/utils";
import { AlertTriangle, TrendingUp, Layout, Activity, ClipboardList, CheckCircle, Wallet, Users, X, Eye, Repeat, Clock, ArrowUpRight, Search, Trash2, Printer, FileText, ShieldCheck, CalendarRange, Flag, HelpCircle, Moon, Sun, Plus, Calendar, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ReceiptTemplateGenerator } from "./ReceiptTemplateGenerator";
import { printSystemLogs } from "../utils/exportUtils";
import { BudgetCircularGauges } from "./BudgetCircularGauges";
import { RecentCommentsAndReactionsFeed } from "./RecentCommentsAndReactionsFeed";
import { GlobalFiscalOverview } from "./GlobalFiscalOverview";
import { NewRequisitionForm } from "./NewRequisitionForm";

// Custom high-detail chart tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const approvalRate = data.requested > 0 ? Math.round((data.approved / data.requested) * 100) : 0;
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-4 rounded-2xl shadow-xl space-y-2 text-xs text-slate-750 min-w-[245px]">
        <div className="font-black text-slate-900 border-b border-slate-100 pb-1.5 flex justify-between items-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-extrabold">{label} Statistics</span>
          <span className="text-[8px] font-mono bg-slate-100 px-1.5 py-0.5 rounded-md uppercase text-slate-400">Ledger Metrics</span>
        </div>
        <div className="space-y-1.5 pt-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              Requested Volume:
            </span>
            <span className="font-bold text-slate-900 font-mono">Ksh {Number(data.requested).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Approved / Settled:
            </span>
            <span className="font-bold text-slate-900 font-mono">Ksh {Number(data.approved).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-dashed border-slate-100 pt-1.5 mt-0.5">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              Avg Request Size:
            </span>
            <span className="font-bold text-indigo-950 font-mono">Ksh {Number(data.average).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              Submission Count:
            </span>
            <span className="font-bold text-slate-900 font-mono">{data.count} Requisitions</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[10px] bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-100 mt-2">
            <span className="text-slate-500 font-black uppercase tracking-wider text-[8px]">Approval Conversion:</span>
            <span className={`font-black font-mono text-[10px] ${approvalRate >= 80 ? "text-emerald-600" : approvalRate >= 50 ? "text-amber-600" : "text-slate-600"}`}>
              {approvalRate}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const PIE_COLORS = [
  "#4f46e5", // Indigo-600
  "#06b6d4", // Cyan-500
  "#10b981", // Emerald-500
  "#f59e0b", // Amber-500
  "#ec4899", // Pink-500
  "#8b5cf6", // Violet-500
  "#f43f5e", // Rose-500
  "#64748b", // Slate-500
];

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3.5 rounded-2xl shadow-xl space-y-1.5 text-xs text-slate-700 min-w-[220px]">
        <div className="font-extrabold text-slate-900 border-b border-slate-100 pb-1 flex justify-between items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 truncate max-w-[150px]">
            {data.groupName}
          </span>
          <span className="text-[8px] font-mono bg-indigo-50 px-1.5 py-0.5 rounded-md uppercase text-indigo-500 font-bold font-sans">
            Ledger Share
          </span>
        </div>
        <div className="pt-1 text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Submitted count:</span>
            <span className="font-mono font-bold text-slate-900">{data.count} reqs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Value (KES):</span>
            <span className="font-mono font-black text-slate-900">Ksh {data.totalAmount?.toLocaleString()}</span>
          </div>
          {data.disbursedAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Disbursed (KES):</span>
              <span className="font-mono font-bold">Ksh {data.disbursedAmount?.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<{ 
  onViewChange?: (view: string) => void; 
  darkMode?: boolean; 
  setDarkMode?: (dark: boolean) => void; 
}> = ({ onViewChange, darkMode, setDarkMode }) => {
  const { 
    requisitions, 
    projects, 
    churchGroups,
    ledgerBooks,
    alerts, 
    currentUser, 
    seedAllEcosystemData, 
    deleteRequisition, 
    systemLogs, 
    canAccess, 
    systemSettings, 
    loading, 
    supplementaryRequests, 
    applySupplementaryBudget,
    customCalendarEvents,
    addCustomCalendarEvent,
    updateCustomCalendarEvent,
    deleteCustomCalendarEvent,
    setSelectedRequisition
  } = useRequisitions();

  const canEditCalendar = useMemo(() => {
    return currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
  }, [currentUser]);

  // Calendar Event Editor states
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [editingCalendarEvent, setEditingCalendarEvent] = useState<any | null>(null);
  const [calTitle, setCalTitle] = useState("");
  const [calDescription, setCalDescription] = useState("");
  const [calDate, setCalDate] = useState("");
  const [calTime, setCalTime] = useState("");
  const [calCategory, setCalCategory] = useState<"MEETING" | "DEADLINE" | "AUDIT" | "EVENT" | "MAINTENANCE" | "OTHER">("MEETING");
  const [calBadge, setCalBadge] = useState("");
  const [calSaving, setCalSaving] = useState(false);

  const hasAuditTrail = useMemo(() => {
    return canAccess("auditTrail");
  }, [canAccess]);

  const [seeding, setSeeding] = useState(false);
  const handleOpenRequisitionPage = (req: Requisition) => {
    setSelectedRequisition(req);
    onViewChange?.("requisitions");
  };
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<Requisition | null>(null);
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<any | null>(null);

  const [velocityTimeframe, setVelocityTimeframe] = useState<"DAILY" | "MONTHLY" | "ANNUAL">("DAILY");

  const [showRequested, setShowRequested] = useState(true);
  const [showApproved, setShowApproved] = useState(true);
  const [showAverage, setShowAverage] = useState(false);
  const [showCount, setShowCount] = useState(false);

  // Supplementary Budget states
  const [isSupplementaryModalOpen, setIsSupplementaryModalOpen] = useState(false);
  const [isNewRequisitionModalOpen, setIsNewRequisitionModalOpen] = useState(false);
  const [supProjectId, setSupProjectId] = useState("");
  const [supAmount, setSupAmount] = useState("");
  const [supJustification, setSupJustification] = useState("");
  const [supSubmitting, setSupSubmitting] = useState(false);
  const [supError, setSupError] = useState<string | null>(null);
  const [supSuccess, setSupSuccess] = useState<string | null>(null);

  const { year: activeYear } = useActiveFiscalYear();

  const isRequisitionInFiscalYear = useCallback((r: Requisition, targetYear: number): boolean => {
    if (r.fiscalYear) {
      return Number(r.fiscalYear) === targetYear;
    }
    const dateStr = r.submittedAt || r.createdAt || r.updatedAt;
    if (dateStr) {
      const parsedYear = new Date(dateStr).getFullYear();
      if (!isNaN(parsedYear)) {
        return parsedYear === targetYear;
      }
    }
    return targetYear === 2026;
  }, []);

  const activeFiscalYearRequisitions = useMemo(() => {
    const targetYear = activeYear || 2026;
    return requisitions.filter(r => isRequisitionInFiscalYear(r, targetYear));
  }, [requisitions, activeYear, isRequisitionInFiscalYear]);

  const activeFiscalYearProjects = useMemo(() => {
    const targetYear = activeYear || 2026;
    return projects.filter(p => p.fiscalYear === targetYear || (!p.fiscalYear && targetYear === 2026));
  }, [projects, activeYear]);

  const dailyData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const sumByDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const approvedByDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const countByDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    
    activeFiscalYearRequisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const dayName = days[d.getDay()];
        if (dayName) {
          sumByDay[dayName] += req.amount;
          if (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) {
            approvedByDay[dayName] += req.amount;
          }
          countByDay[dayName] += 1;
        }
      }
    });

    return days.map(day => {
      const requested = sumByDay[day];
      const approved = approvedByDay[day];
      const count = countByDay[day];
      const average = count > 0 ? Math.round(requested / count) : 0;

      return {
        name: day,
        value: requested, // For legacy fallback
        requested,
        approved,
        count,
        average
      };
    });
  }, [activeFiscalYearRequisitions]);

  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sumByMonth: Record<string, number> = {};
    const approvedByMonth: Record<string, number> = {};
    const countByMonth: Record<string, number> = {};
    
    months.forEach(m => { 
      sumByMonth[m] = 0; 
      approvedByMonth[m] = 0;
      countByMonth[m] = 0;
    });

    activeFiscalYearRequisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const monthName = months[d.getMonth()];
        if (monthName) {
          sumByMonth[monthName] += req.amount;
          if (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) {
            approvedByMonth[monthName] += req.amount;
          }
          countByMonth[monthName] += 1;
        }
      }
    });

    return months.map(m => {
      const requested = sumByMonth[m];
      const approved = approvedByMonth[m];
      const count = countByMonth[m];
      const average = count > 0 ? Math.round(requested / count) : 0;

      return {
        name: m,
        value: requested,
        requested,
        approved,
        count,
        average
      };
    });
  }, [activeFiscalYearRequisitions]);

  const annualData = useMemo(() => {
    const years = ["2024", "2025", "2026", "2027"];
    const sumByYear: Record<string, number> = {};
    const approvedByYear: Record<string, number> = {};
    const countByYear: Record<string, number> = {};
    
    years.forEach(y => { 
      sumByYear[y] = 0; 
      approvedByYear[y] = 0;
      countByYear[y] = 0;
    });

    requisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const yStr = (req.fiscalYear ? String(req.fiscalYear) : d.getFullYear().toString());
        if (years.includes(yStr)) {
          sumByYear[yStr] += req.amount;
          if (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) {
            approvedByYear[yStr] += req.amount;
          }
          countByYear[yStr] += 1;
        }
      }
    });

    return years.map(y => {
      const requested = sumByYear[y];
      const approved = approvedByYear[y];
      const count = countByYear[y];
      const average = count > 0 ? Math.round(requested / count) : 0;

      return {
        name: y,
        value: requested,
        requested,
        approved,
        count,
        average
      };
    });
  }, [requisitions]);

  const currentVelocityData = useMemo(() => {
    if (velocityTimeframe === "DAILY") return dailyData;
    if (velocityTimeframe === "MONTHLY") return monthlyData;
    return annualData;
  }, [velocityTimeframe, dailyData, monthlyData, annualData]);

  const formatYAxis = (val: number) => {
    if (val >= 1000000) {
      return `Ksh ${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `Ksh ${Math.round(val / 1000)}k`;
    }
    return `Ksh ${val}`;
  };

  const recentRequisitions = useMemo(() => {
    return activeFiscalYearRequisitions.length > 0 
      ? activeFiscalYearRequisitions.slice(0, 5) 
      : requisitions.slice(0, 5);
  }, [activeFiscalYearRequisitions, requisitions]);

  const activeAlerts = alerts.filter(a => {
    if (a.isRead) return false;
    if (a.targetRole && currentUser?.role !== a.targetRole && currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.SUPER_ADMIN) return false;
    return true;
  });

  // Unified timeline derived from unread alerts and system logs
  const combinedTimeline = useMemo(() => {
    const items: Array<{
      id: string;
      message: string;
      timestamp: string;
      type: "ALERT" | "LOG";
      severity?: "LOW" | "MEDIUM" | "HIGH";
      action?: string;
    }> = [];

    // Filter active alerts
    activeAlerts.forEach(a => {
      items.push({
        id: a.id,
        message: a.message,
        timestamp: a.timestamp,
        type: "ALERT",
        severity: a.severity
      });
    });

    // Share system logs, optimization: only process the top 30 to prevent memory blow up
    const recentLogs = systemLogs.slice(0, 30);
    recentLogs.forEach(l => {
      items.push({
        id: l.id,
        message: `${l.details}`,
        timestamp: l.timestamp,
        type: "LOG",
        action: l.action
      });
    });

    // Sort descending by timestamp, take top 15
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
  }, [activeAlerts, systemLogs]);

  const findRequisitionForLog = (text: string) => {
    if (!text) return null;
    const cleanText = text.toLowerCase();

    // 1. Try matching by ID directly
    const idMatch = requisitions.find(r => r.id && cleanText.includes(r.id.toLowerCase()));
    if (idMatch) return idMatch;

    // 2. Try quoted matches to avoid false positives
    const quoted = text.match(/['"`]([^'"`]+)['"`]/);
    if (quoted && quoted[1]) {
      const cleanQuote = quoted[1].trim().toLowerCase();
      const match = requisitions.find(r => r.title && r.title.toLowerCase() === cleanQuote);
      if (match) return match;
    }

    // 3. Substring match
    const sortedReqs = [...requisitions].sort((a, b) => b.title.length - a.title.length);
    return sortedReqs.find(r => r.title && r.title.length > 3 && cleanText.includes(r.title.toLowerCase())) || null;
  };

  const handleTimelineItemClick = (text: string) => {
    const matched = findRequisitionForLog(text);
    if (matched) {
      handleOpenRequisitionPage(matched);
    }
  };

  const stats = useMemo(() => {
    const totalValue = activeFiscalYearRequisitions.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const pending = activeFiscalYearRequisitions.filter(r => r.status === RequisitionStatus.SUBMITTED || r.status === RequisitionStatus.APPROVED_L1).length;
    const approved = activeFiscalYearRequisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2 || r.status === RequisitionStatus.DISBURSED).length;
    const disbursed = activeFiscalYearRequisitions.filter(r => r.status === RequisitionStatus.DISBURSED).reduce((acc, r) => acc + (Number(r.amount) || 0), 0);

    return [
      { label: "Total Req Value", value: formatCurrency(totalValue), icon: Wallet, color: "text-primary", bg: "bg-primary/5" },
      { label: "Pending Approvals", value: `${pending} Pending`, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Status Approved", value: `${approved} Approved`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Total Req Disbursed", value: formatCurrency(disbursed), icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    ];
  }, [activeFiscalYearRequisitions]);

  const assignedMinistries = useMemo(() => {
    if (!currentUser) return [];
    const list: string[] = [];
    if (currentUser.group && currentUser.group.trim()) list.push(currentUser.group.trim());
    if (Array.isArray(currentUser.groups)) {
      currentUser.groups.forEach(g => {
        if (g && g.trim() && !list.includes(g.trim())) list.push(g.trim());
      });
    }
    return list;
  }, [currentUser]);

  const [activeMinistryView, setActiveMinistryView] = useState<string>("ALL");

  const { currentProjectForBanner, totalAllocatedForBanner, totalUsedForBanner, totalRequisitionsForBanner } = useMemo(() => {
    if (assignedMinistries.length === 0) {
      return { currentProjectForBanner: null, totalAllocatedForBanner: 0, totalUsedForBanner: 0, totalRequisitionsForBanner: 0 };
    }

    const selectedMinistries = activeMinistryView === "ALL" ? assignedMinistries : [activeMinistryView];

    let allocated = 0;
    let used = 0;
    let reqCount = 0;

    selectedMinistries.forEach(min => {
      const cleanMin = min.toLowerCase().trim();
      
      const minProjects = activeFiscalYearProjects.filter(p => {
        const cleanGroup = (p.groupId || "").toLowerCase().trim();
        const cleanName = (p.name || "").toLowerCase().trim();
        return cleanGroup === cleanMin || cleanName === cleanMin || cleanGroup.includes(cleanMin) || cleanMin.includes(cleanGroup);
      });

      let minAllocated = minProjects.reduce((sum, p) => sum + (Number(p.allocatedBudget) || 0), 0);
      
      if (minAllocated === 0) {
        const matchingLedger = ledgerBooks.find(lb => {
          const lbName = (lb.ministryName || "").toLowerCase().trim();
          const lbId = (lb.ministryId || "").toLowerCase().trim();
          return lbName === cleanMin || lbId === cleanMin || lbName.includes(cleanMin) || cleanMin.includes(lbName);
        });
        if (matchingLedger && matchingLedger.budgetLimit) {
          minAllocated = matchingLedger.budgetLimit;
        }
      }

      const minReqs = activeFiscalYearRequisitions.filter(r => {
        if (!COMMITTED_REQUISITION_STATUSES.includes(r.status)) return false;
        const cleanReqGroup = (r.groupName || r.groupId || "").toLowerCase().trim();
        const matchesGroup = cleanReqGroup === cleanMin || cleanReqGroup.includes(cleanMin) || cleanMin.includes(cleanReqGroup);
        const matchesProject = minProjects.some(p => p.id === r.projectId);
        return matchesGroup || matchesProject;
      });

      const minUsed = minReqs.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      allocated += minAllocated;
      used += minUsed;
      reqCount += minReqs.length;
    });

    return {
      currentProjectForBanner: null,
      totalAllocatedForBanner: allocated,
      totalUsedForBanner: used,
      totalRequisitionsForBanner: reqCount
    };
  }, [assignedMinistries, activeMinistryView, activeFiscalYearProjects, ledgerBooks, activeFiscalYearRequisitions]);

  const fiscalSummary = useMemo(() => {
    const activeProjects = activeFiscalYearProjects;
    const totalAllocated = activeProjects.reduce((sum, p) => sum + (Number(p.allocatedBudget) || 0), 0);
    
    const committedRequisitions = activeFiscalYearRequisitions.filter(r => 
      COMMITTED_REQUISITION_STATUSES.includes(r.status)
    );
    const totalSpentAndCommitted = committedRequisitions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const absorptionRate = totalAllocated > 0 ? (totalSpentAndCommitted / totalAllocated) * 100 : 0;
    const requisitionsCount = committedRequisitions.length;

    return {
      activeYear: activeYear || 2026,
      totalAllocated,
      totalSpentAndCommitted,
      absorptionRate,
      requisitionsCount
    };
  }, [activeFiscalYearProjects, activeFiscalYearRequisitions, activeYear]);

  const requestedPerGroup = useMemo(() => {
    const groupTotals: Record<string, { groupId: string, groupName: string, count: number, totalAmount: number, pendingCount: number, disbursedAmount: number, requisitions: Requisition[] }> = {};
    
    // Optimization: Create a O(1) lookup map for projects in active fiscal year
    const projectMap = new Map<string, typeof projects[0]>();
    activeFiscalYearProjects.forEach(p => projectMap.set(p.id, p));

    activeFiscalYearRequisitions.forEach(req => {
      const project = req.projectId ? projectMap.get(req.projectId) : undefined;
      const pid = project ? project.id : (req.groupId || req.groupName || "OTHER");
      const pname = project ? project.name : (req.groupName || "Other / Non-affine");
      const gid = project ? project.groupId : (req.groupId || "OTHER");
      
      if (!groupTotals[pid]) {
        groupTotals[pid] = {
          groupId: gid,
          groupName: pname,
          count: 0,
          totalAmount: 0,
          pendingCount: 0,
          disbursedAmount: 0,
          requisitions: []
        };
      }
      
      groupTotals[pid].count += 1;
      groupTotals[pid].totalAmount += req.amount;
      groupTotals[pid].requisitions.push(req);
      
      if (req.status === RequisitionStatus.SUBMITTED || req.status === RequisitionStatus.APPROVED_L1) {
        groupTotals[pid].pendingCount += 1;
      }
      if (req.status === RequisitionStatus.DISBURSED) {
        groupTotals[pid].disbursedAmount += req.amount;
      }
    });

    return Object.values(groupTotals).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [activeFiscalYearRequisitions, activeFiscalYearProjects]);

  const budgetVariances = useMemo(() => {
    // Optimization: Pre-calculate project utilizations and create a lookup map
    const projectUtilizations = new Map<string, { usedAmount: number, remainingAmount: number }>();
    const projectMap = new Map<string, typeof projects[0]>();
    
    projects.forEach(p => {
      projectMap.set(p.id, p);
      projectUtilizations.set(p.id, calculateProjectUtilization(p, requisitions));
    });

    return requisitions
      .filter(req => req.status !== RequisitionStatus.DRAFT)
      .map(req => {
        const project = req.projectId ? projectMap.get(req.projectId) : undefined;
        if (!project) return null;
        
        const utilization = projectUtilizations.get(project.id);
        if (!utilization) return null;
        
        const { usedAmount, remainingAmount } = utilization;

        const exceedsRemaining = req.amount > remainingAmount && req.status !== RequisitionStatus.DISBURSED && req.status !== RequisitionStatus.APPROVED_L2 && req.status !== RequisitionStatus.APPROVED_L1 && req.status !== RequisitionStatus.ESCALATED && req.status !== RequisitionStatus.SUBMITTED;
        const exceedsTotal = req.amount > project.allocatedBudget;
        
        const isVariance = exceedsRemaining || exceedsTotal || (usedAmount > project.allocatedBudget);
        
        if (!isVariance) return null;
        
        return {
          requisition: req,
          project,
          remainingBudget: remainingAmount,
          exceedsRemaining,
          exceedsTotal,
          varianceAmount: req.amount > remainingAmount ? req.amount - remainingAmount : 0
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [requisitions, projects]);

  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<{ day: number, month: number, year: number }>(() => {
    const today = new Date();
    return { day: today.getDate(), month: today.getMonth(), year: today.getFullYear() };
  });

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startOfWeek = firstDay.getDay(); // 0 = Sunday, ..., 6 = Saturday
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const cells = [];
    
    // Fill previous month's trailing days
    for (let i = startOfWeek - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        month: month === 0 ? 11 : month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
      });
    }
    
    // Fill current month's days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      cells.push({
        day: i,
        month,
        year,
        isCurrentMonth: true,
      });
    }
    
    // Fill next month's leading days to make a complete grid (multiple of 7, e.g. 35 or 42)
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        day: i,
        month: month === 11 ? 0 : month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
      });
    }
    
    return cells;
  }, [calendarDate]);

  const getEventsForDate = useCallback((cellYear: number, cellMonth: number, cellDay: number) => {
    const cellDate = new Date(cellYear, cellMonth, cellDay);
    const cellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDay).padStart(2, '0')}`;
    const events: any[] = [];
    
    // 1. System deadlines
    const isQuarterEnd = (cellMonth === 2 && cellDay === 31) || 
                         (cellMonth === 5 && cellDay === 30) || 
                         (cellMonth === 8 && cellDay === 30) || 
                         (cellMonth === 11 && cellDay === 31);
    if (isQuarterEnd) {
      events.push({
        id: `sys-quarterly-${cellYear}-${cellMonth}-${cellDay}`,
        title: "Quarterly Audit Deadline",
        description: "Final deadline for major fiscal realignment and ledger adjustment.",
        type: "SYSTEM_QUARTERLY",
        badge: "Quarterly Review"
      });
    }

    const matchDate = (dateString?: string) => {
      if (!dateString) return false;
      const d = new Date(dateString);
      return d.getFullYear() === cellYear && d.getMonth() === cellMonth && d.getDate() === cellDay;
    };

    // 2. Custom Admin Events
    (customCalendarEvents || []).forEach(evt => {
      if (evt.date === cellDateStr) {
        events.push({
          id: evt.id,
          title: evt.title,
          description: evt.description,
          type: "CUSTOM_ADMIN",
          badge: evt.badge || evt.category,
          time: evt.time,
          category: evt.category,
          createdBy: evt.createdBy,
          customEvent: evt
        });
      }
    });

    // 3. Auto-updated Requisitions (Created, Approved, Disbursed, Expiring)
    requisitions.forEach(r => {
      // Created / Submitted
      if (matchDate(r.submittedAt || r.updatedAt)) {
        events.push({
          id: `req-created-${r.id}`,
          title: `Created: ${r.title}`,
          description: `Requisition created by ${r.requesterName || "Requester"} (${r.groupName})`,
          type: "REQ_ADDED",
          requisition: r,
          amount: r.amount,
          badge: "Req Created",
          groupName: r.groupName
        });
      }

      // Approved (L1 or L2)
      if ((r.status === RequisitionStatus.APPROVED_L1 || r.status === RequisitionStatus.APPROVED_L2) && matchDate(r.approvedAtL2 || r.approvedAtL1 || r.updatedAt)) {
        events.push({
          id: `req-approved-${r.id}`,
          title: `Approved: ${r.title}`,
          description: `Requisition approved for ${r.groupName} - Ksh ${r.amount.toLocaleString()}`,
          type: "REQ_APPROVED",
          requisition: r,
          amount: r.amount,
          badge: "Req Approved",
          groupName: r.groupName
        });
      }

      // Disbursed
      if (r.status === RequisitionStatus.DISBURSED && matchDate(r.disbursedAt || r.updatedAt)) {
        events.push({
          id: `req-disbursed-${r.id}`,
          title: `Disbursed: ${r.title}`,
          description: `Funds disbursed to ${r.requesterName} (${r.groupName})`,
          type: "REQ_DISBURSED",
          requisition: r,
          amount: r.amount,
          badge: "Req Disbursed",
          groupName: r.groupName
        });
      }

      // Expiring
      if (r.expiresAt && matchDate(r.expiresAt)) {
        events.push({
          id: `req-expiry-${r.id}`,
          title: `Expiring: ${r.title}`,
          description: `Requisition submission deadline window expiring.`,
          type: "REQ_DEADLINE",
          requisition: r,
          amount: r.amount,
          badge: "Req Expiring",
          groupName: r.groupName
        });
      }
    });
    
    return events;
  }, [requisitions, customCalendarEvents]);

  const upcomingDeadlines = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const list: any[] = [];
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = getEventsForDate(year, month, day);
      if (dayEvents.length > 0) {
        list.push(...dayEvents);
      }
    }
    return list;
  }, [calendarDate, getEventsForDate]);

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8 animate-pulse p-4 md:p-8">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-48 bg-slate-100 rounded-md"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-32 bg-slate-200 rounded-xl"></div>
            <div className="h-12 w-12 bg-slate-200 rounded-xl"></div>
          </div>
        </div>

        {/* Highlight Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-32 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
             <div className="space-y-3">
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
             </div>
             <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          </div>
          <div className="h-32 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
             <div className="space-y-3">
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
             </div>
             <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          </div>
          <div className="h-32 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 items-center justify-between hidden lg:flex">
             <div className="space-y-3">
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
             </div>
             <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          </div>
        </div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 h-[450px] bg-white rounded-[2rem] border border-slate-200 shadow-sm"></div>
          <div className="h-[450px] bg-white rounded-[2rem] border border-slate-200 shadow-sm"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in transition-all duration-700">
      {/* Role-aware Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mb-2">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight">System Dashboard</h1>
          <p className="text-slate-500 text-[9px] md:text-sm">Welcome, {currentUser?.name} • <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest">{currentUser?.role} Mode</span></p>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group"
          >
            <div className={cn("absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-125 transition-transform duration-500", stat.color)}>
              <stat.icon size={50} className="md:w-[80px] md:h-[80px]" />
            </div>
            <div className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-2">{stat.label}</div>
            <div className="text-base md:text-2xl font-bold text-slate-900 mb-0.5 md:mb-1">{stat.value}</div>
            
          </motion.div>
        ))}
      </div>

      {/* Global Fiscal Overview */}
      <GlobalFiscalOverview 
        projects={projects}
        activeYear={fiscalSummary.activeYear}
        status={systemSettings?.fiscalYearStatus}
      />

      {/* Role-Based Recent Comments & Reactions Feed (Social Tweet-Style Activity Cards) */}
      <RecentCommentsAndReactionsFeed onViewChange={onViewChange} />

      {/* Scoped Budget Banner for assigned ministries */}
      {assignedMinistries.length > 0 && (
        <div className="space-y-4">
          {/* Multi-Ministry View Switcher Toggle */}
          {assignedMinistries.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-150/50 p-2 rounded-2xl border border-slate-200">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-2">
                Selected Ministry View:
              </span>
              <button
                onClick={() => setActiveMinistryView("ALL")}
                className={cn(
                  "px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                  activeMinistryView === "ALL" 
                    ? "bg-primary text-white shadow-md shadow-primary/20 animate-in zoom-in-95" 
                    : "text-slate-600 hover:bg-slate-200"
                )}
              >
                All Assigned ({assignedMinistries.length})
              </button>
              {assignedMinistries.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveMinistryView(m)}
                  className={cn(
                    "px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer truncate max-w-[150px] sm:max-w-none",
                    activeMinistryView === m 
                      ? "bg-primary text-white shadow-md shadow-primary/20 animate-in zoom-in-95" 
                      : "text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          <motion.div 
            key={activeMinistryView}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-primary text-white rounded-2xl p-4 md:p-8 shadow-xl shadow-primary/20 relative overflow-hidden"
          >
            <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-white/25 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10 backdrop-blur-sm">
                    {activeMinistryView === "ALL" ? "AGGREGATED PORTFOLIO" : "SINGLE VIEW"}
                  </span>
                  {totalRequisitionsForBanner > 0 && (
                    <span className="bg-white/20 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10 backdrop-blur-sm">
                      {totalRequisitionsForBanner} Linked Requisitions
                    </span>
                  )}
                </div>
                <h3 className="text-xl md:text-3xl font-bold uppercase tracking-tight">
                  {activeMinistryView === "ALL" ? "All Assigned Ministries" : activeMinistryView}
                </h3>
                <p className="opacity-80 text-xs md:text-sm max-w-md">
                  {activeMinistryView === "ALL" 
                    ? "Combined budget absorption rate and live cash reserves across all your assigned portfolios." 
                    : `Live fiscal monitoring for your specific project allocation: ${activeMinistryView}.`}
                </p>
              </div>
              <div className="flex-1 w-full md:max-w-lg space-y-4">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] md:text-sm font-bold opacity-80 uppercase tracking-wider">Utilization</span>
                  <span className="text-lg md:text-2xl font-bold">
                    {totalAllocatedForBanner > 0 ? ((totalUsedForBanner / totalAllocatedForBanner) * 100).toFixed(1) : "0.0"}%
                  </span>
                </div>
                <div className="h-3 md:h-4 bg-white/20 rounded-full overflow-hidden border border-white/10">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${totalAllocatedForBanner > 0 ? Math.min((totalUsedForBanner / totalAllocatedForBanner) * 100, 100) : 0}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      totalAllocatedForBanner > 0 && (totalUsedForBanner / totalAllocatedForBanner) > 0.9 ? "bg-rose-400" : "bg-amber-400"
                    )}
                  />
                </div>
                <div className="flex justify-between text-[8px] md:text-xs font-mono opacity-80">
                  <span>{formatCurrency(totalUsedForBanner)} spent / committed</span>
                  <span>{formatCurrency(totalAllocatedForBanner)} total allocation</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Budget Circular Gauges for different Church Group categories */}
      <BudgetCircularGauges projects={projects} />

      {/* Side-by-Side: Quick Action Panel & Calendar Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Left Side: Quick Action Panel with New Requisition */}
        <div className="lg:col-span-1 flex flex-col justify-between bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 space-y-6 relative overflow-hidden group">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Activity size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Requisitions Calendar</h2>
                <p className="text-[10px] text-slate-400 uppercase font-mono tracking-tight mt-0.5">Control & submission center</p>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Check requisition submissions and monitor disbursement dates from one calendar. Create events and timelines for various church financial events. 
            </p>

            {/* Quick Tips or Guidelines */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 font-mono block">What you can see :</span>
              <ul className="space-y-2 text-[10px] text-slate-600 font-sans">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                  <span>When requisitions were submitted and approved</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                  <span>When funds were disbursed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                  <span>Financial Reporting and events added by the Finance Team</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setIsNewRequisitionModalOpen(true)}
              className="w-full py-4 px-4 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-550 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg hover:shadow-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer group-hover:scale-[1.01]"
            >
              <Plus size={16} strokeWidth={3} />
              <span>New Requisition</span>
            </button>
          </div>
        </div>

        {/* Right Side: Requisition Submission Deadlines Calendar Widget */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/15 rounded-xl text-primary">
                <CalendarRange size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Requisitions & Disbursements Calendar</h2>
                <p className="text-[10px] text-slate-400 uppercase font-mono tracking-tight mt-0.5">TRACKING REQUISITIONS PROGRESS BY DATE</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              {canEditCalendar && (
                <button
                  onClick={() => {
                    setEditingCalendarEvent(null);
                    setCalTitle("");
                    setCalDescription("");
                    const monthStr = String(selectedDay.month + 1).padStart(2, '0');
                    const dayStr = String(selectedDay.day).padStart(2, '0');
                    setCalDate(`${selectedDay.year}-${monthStr}-${dayStr}`);
                    setCalTime("09:00 AM");
                    setCalCategory("MEETING");
                    setCalBadge("Admin Event");
                    setIsCalendarModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  <span>Add Event</span>
                </button>
              )}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/60 p-1 rounded-xl">
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                  className="p-1.5 hover:bg-white hover:text-primary hover:shadow-sm rounded-lg text-slate-500 transition-all cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-black text-slate-800 uppercase tracking-widest px-3 min-w-[100px] text-center font-sans">
                  {calendarDate.toLocaleString("default", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                  className="p-1.5 hover:bg-white hover:text-primary hover:shadow-sm rounded-lg text-slate-500 transition-all cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Side: Calendar Grid */}
            <div className="lg:col-span-2 space-y-3">
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-100 pb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <span key={d} className="text-[10px] font-black text-slate-400 uppercase tracking-widest py-1">
                    {d}
                  </span>
                ))}
              </div>

              {/* Grid Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, idx) => {
                  const dayEvents = getEventsForDate(cell.year, cell.month, cell.day);
                  const hasWeekly = dayEvents.some(e => e.type === "SYSTEM_WEEKLY");
                  const hasQuarterly = dayEvents.some(e => e.type === "SYSTEM_QUARTERLY");
                  const hasReqs = dayEvents.some(e => e.type === "REQ_DEADLINE");
                  const hasAdded = dayEvents.some(e => e.type === "REQ_ADDED");
                  const hasApproved = dayEvents.some(e => e.type === "REQ_APPROVED");
                  const hasDisbursed = dayEvents.some(e => e.type === "REQ_DISBURSED");
                  const hasCustomAdmin = dayEvents.some(e => e.type === "CUSTOM_ADMIN");
                  
                  const isSelected = selectedDay.day === cell.day && selectedDay.month === cell.month && selectedDay.year === cell.year;
                  const isToday = (() => {
                    const today = new Date();
                    return today.getDate() === cell.day && today.getMonth() === cell.month && today.getFullYear() === cell.year;
                  })();

                  return (
                    <button
                      key={`${cell.year}-${cell.month}-${cell.day}-${idx}`}
                      onClick={() => setSelectedDay({ day: cell.day, month: cell.month, year: cell.year })}
                      className={cn(
                        "min-h-[55px] p-1.5 flex flex-col justify-between rounded-xl border transition-all text-left group cursor-pointer relative",
                        !cell.isCurrentMonth 
                          ? "bg-slate-50/55 border-transparent text-slate-350 hover:bg-slate-50" 
                          : "bg-white border-slate-100 text-slate-700 hover:border-slate-300 hover:bg-slate-50/40",
                        isToday && cell.isCurrentMonth && "border-indigo-600 ring-2 ring-indigo-50/50",
                        isSelected && "bg-primary border-primary text-white hover:bg-primary/95"
                      )}
                    >
                      <span className={cn(
                        "text-[11px] font-bold",
                        isSelected ? "text-white" : cell.isCurrentMonth ? "text-slate-800" : "text-slate-400"
                      )}>
                        {cell.day}
                      </span>

                      {/* Indicators container */}
                      <div className="flex flex-wrap gap-0.5 mt-auto">
                        {hasCustomAdmin && (
                          <span 
                            title="Custom Admin Scheduled Event"
                            className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSelected ? "bg-white" : "bg-purple-600")} 
                          />
                        )}
                        {hasWeekly && (
                          <span 
                            title="Weekly Cut-off Cycle"
                            className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSelected ? "bg-white" : "bg-emerald-500")} 
                          />
                        )}
                        {hasQuarterly && (
                          <span 
                            title="Quarterly Alignment"
                            className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSelected ? "bg-white" : "bg-amber-500")} 
                          />
                        )}
                        {hasDisbursed && (
                          <span 
                            title="Requisition Disbursed"
                            className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSelected ? "bg-white" : "bg-teal-500")} 
                          />
                        )}
                        {hasApproved && (
                          <span 
                            title="Requisition Approved"
                            className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSelected ? "bg-white" : "bg-sky-500")} 
                          />
                        )}
                        {hasReqs && (
                          <span 
                            title={`${dayEvents.filter(e => e.type === "REQ_DEADLINE").length} Requisition Expiration(s)`}
                            className={cn("w-1.5 h-1.5 rounded-full shrink-0 animate-pulse", isSelected ? "bg-white" : "bg-rose-500")} 
                          />
                        )}
                        {hasAdded && (
                          <span 
                            title={`${dayEvents.filter(e => e.type === "REQ_ADDED").length} Requisition(s) Added`}
                            className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSelected ? "bg-white" : "bg-indigo-600")} 
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Legend indicators descriptive panel */}
              <div className="flex flex-wrap gap-3 pt-2 text-[9px] text-slate-400 border-t border-slate-100 uppercase font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" /> Scheduled Events
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Disbursed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" /> Created
                </span>
              </div>
            </div>

            {/* Right Side: selected day details / Month deadlines Overview panel */}
            <div className="bg-slate-50/50 border border-slate-200/50 rounded-2xl p-4 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="border-b border-slate-200/60 pb-2 flex justify-between items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">
                    Events for {new Date(selectedDay.year, selectedDay.month, selectedDay.day).toLocaleDateString("default", { month: "short", day: "numeric" })}
                  </span>
                  {canEditCalendar ? (
                    <button
                      onClick={() => {
                        setEditingCalendarEvent(null);
                        setCalTitle("");
                        setCalDescription("");
                        const monthStr = String(selectedDay.month + 1).padStart(2, '0');
                        const dayStr = String(selectedDay.day).padStart(2, '0');
                        setCalDate(`${selectedDay.year}-${monthStr}-${dayStr}`);
                        setCalTime("09:00 AM");
                        setCalCategory("MEETING");
                        setCalBadge("Admin Event");
                        setIsCalendarModalOpen(true);
                      }}
                      className="text-[8px] font-black bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shrink-0"
                    >
                      <Plus size={10} /> + Add
                    </button>
                  ) : (
                    <span className="text-[8px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md uppercase font-bold shrink-0">
                      Auto-Synced
                    </span>
                  )}
                </div>

                {/* Day events render */}
                <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                  {(() => {
                    const dayEvents = getEventsForDate(selectedDay.year, selectedDay.month, selectedDay.day);
                    if (dayEvents.length === 0) {
                      return (
                        <div className="py-8 text-center text-slate-400 space-y-1">
                          <Clock size={16} className="mx-auto text-slate-300" />
                          <p className="text-[10px] font-bold uppercase tracking-wider">No scheduled events</p>
                          <p className="text-[9px] lowercase font-normal italic text-slate-400">Regular ledger rules apply</p>
                        </div>
                      );
                    }
                    
                    return dayEvents.map((e, index) => (
                      <div 
                        key={`${e.id}-${index}`}
                        className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm space-y-1.5 transition-all hover:shadow hover:border-slate-300 relative group/card"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest text-white shrink-0",
                            e.type === "CUSTOM_ADMIN" ? "bg-purple-600" :
                            e.type === "REQ_DISBURSED" ? "bg-teal-600" :
                            e.type === "REQ_APPROVED" ? "bg-sky-600" :
                            e.type.startsWith("SYSTEM") 
                              ? (e.type === "SYSTEM_WEEKLY" ? "bg-emerald-500" : e.type === "SYSTEM_MONTHLY" ? "bg-blue-500" : "bg-amber-500") 
                              : e.type === "REQ_ADDED" ? "bg-indigo-600" : "bg-rose-500"
                          )}>
                            {e.badge}
                          </span>
                          
                          {e.type === "CUSTOM_ADMIN" && canEditCalendar && e.customEvent && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingCalendarEvent(e.customEvent);
                                  setCalTitle(e.customEvent.title || "");
                                  setCalDescription(e.customEvent.description || "");
                                  setCalDate(e.customEvent.date || "");
                                  setCalTime(e.customEvent.time || "");
                                  setCalCategory(e.customEvent.category || "MEETING");
                                  setCalBadge(e.customEvent.badge || "");
                                  setIsCalendarModalOpen(true);
                                }}
                                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
                                title="Edit Event"
                              >
                                <FileText size={12} />
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Delete calendar event '${e.customEvent.title}'?`)) {
                                    await deleteCustomCalendarEvent(e.customEvent.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                title="Delete Event"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}

                          {e.amount && (
                            <span className="font-mono text-[10px] font-black text-slate-900 shrink-0">
                              Ksh {e.amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                        
                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-tight line-clamp-1">
                          {e.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 leading-snug">
                          {e.description}
                        </p>

                        {e.time && (
                          <div className="text-[8.5px] font-mono text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded w-max">
                            🕒 {e.time}
                          </div>
                        )}

                        {e.requisition && (
                          <button
                            onClick={() => handleOpenRequisitionPage(e.requisition)}
                            className="mt-1 flex items-center gap-1 text-[8px] text-primary hover:text-primary/80 font-black uppercase tracking-widest cursor-pointer self-start transition-all"
                          >
                            <Eye size={10} /> Inspect Requisition
                          </button>
                        )}
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Month Summary Feed Footer */}
              <div className="border-t border-slate-200/60 pt-3 space-y-2">
                <h3 className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Bell size={10} className="text-amber-500" /> Upcoming This Month ({upcomingDeadlines.length})
                </h3>
                <div className="max-h-[105px] overflow-y-auto space-y-1.5 pr-1 text-[10px]">
                  {upcomingDeadlines.slice(0, 3).map((u, i) => (
                    <div key={`${u.id}-up-${i}`} className="flex items-center justify-between gap-2 p-1.5 bg-white/40 hover:bg-white border border-slate-100 hover:border-slate-200/80 rounded-lg transition-all">
                      <span className="font-bold text-slate-700 uppercase tracking-tight text-[9px] truncate max-w-[150px]">
                        {u.title}
                      </span>
                      <span className="text-[8px] font-mono text-slate-400 shrink-0 uppercase">
                        {u.badge}
                      </span>
                    </div>
                  ))}
                  {upcomingDeadlines.length === 0 && (
                    <p className="text-[9px] text-slate-400 italic">No scheduled upcoming events.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Volume Chart */}
        <div className={cn(
          hasAuditTrail ? "lg:col-span-2" : "lg:col-span-3",
          "bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm"
        )}>
          <div className="px-4 md:px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest text-center">Requisitions Velocity</h2>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
              <button
                type="button"
                onClick={() => setVelocityTimeframe("DAILY")}
                className={cn(
                  "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer",
                  velocityTimeframe === "DAILY" 
                    ? "bg-white text-primary shadow-sm" 
                    : "text-slate-500 hover:text-slate-850"
                )}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setVelocityTimeframe("MONTHLY")}
                className={cn(
                  "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer",
                  velocityTimeframe === "MONTHLY" 
                    ? "bg-white text-primary shadow-sm" 
                    : "text-slate-500 hover:text-slate-850"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setVelocityTimeframe("ANNUAL")}
                className={cn(
                  "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer",
                  velocityTimeframe === "ANNUAL" 
                    ? "bg-white text-primary shadow-sm" 
                    : "text-slate-500 hover:text-slate-850"
                )}
              >
                Annual
              </button>
            </div>
          </div>
          
          {/* Detailed Metric Toggle Layer */}
          <div className="px-4 md:px-6 py-2.5 border-b border-slate-100 bg-slate-50/30 flex flex-wrap gap-2 items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Overlay Parameters:</span>
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <button
                type="button"
                onClick={() => setShowRequested(prev => !prev)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer",
                  showRequested 
                    ? "bg-blue-500/10 text-blue-700 border-blue-500/20 shadow-sm"
                    : "bg-transparent text-slate-400 border-slate-200/60"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showRequested ? "bg-blue-600 animate-pulse" : "bg-slate-300")} />
                Requested
              </button>
              
              <button
                type="button"
                onClick={() => setShowApproved(prev => !prev)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer",
                  showApproved 
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 shadow-sm"
                    : "bg-transparent text-slate-400 border-slate-200/60"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showApproved ? "bg-emerald-600 animate-pulse" : "bg-slate-300")} />
                Approved
              </button>
              
              <button
                type="button"
                onClick={() => setShowAverage(prev => !prev)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer",
                  showAverage 
                    ? "bg-purple-500/10 text-purple-700 border-purple-500/20 shadow-sm"
                    : "bg-transparent text-slate-400 border-slate-200/60"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showAverage ? "bg-purple-600" : "bg-slate-300")} />
                Avg Size
              </button>
              
              <button
                type="button"
                onClick={() => setShowCount(prev => !prev)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer",
                  showCount 
                    ? "bg-orange-500/10 text-orange-700 border-orange-500/20 shadow-sm"
                    : "bg-transparent text-slate-400 border-slate-200/60"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showCount ? "bg-orange-600" : "bg-slate-300")} />
                Count ({velocityTimeframe === "DAILY" ? "Day" : velocityTimeframe === "MONTHLY" ? "Month" : "Year"})
              </button>
            </div>
          </div>

          <div className="p-2 md:p-6 h-[270px] md:h-[320px]">
             <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
               <ComposedChart data={currentVelocityData} margin={{ top: 10, right: showCount ? 5 : 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRequested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                />
                
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  tickFormatter={formatYAxis}
                />

                {showCount && (
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#f97316', fontSize: 9, fontWeight: 700 }}
                    tickFormatter={(val) => `${val} req`}
                  />
                )}

                <Tooltip content={<CustomTooltip />} />
                
                {showRequested && (
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="requested" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRequested)" 
                    name="Requested"
                  />
                )}

                {showApproved && (
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="approved" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorApproved)" 
                    name="Approved"
                  />
                )}

                {showAverage && (
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="average" 
                    stroke="#8b5cf6" 
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 1 }}
                    activeDot={{ r: 6 }}
                    name="Average Size"
                  />
                )}

                {showCount && (
                  <Bar 
                    yAxisId="right"
                    dataKey="count" 
                    fill="#f97316" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                    opacity={0.45}
                    name="Submissions"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Feed */}
        {hasAuditTrail && (
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-indigo-600" />
                <h2 className="text-[10px] md:text-xs font-bold text-slate-800 uppercase tracking-widest">Audit Trail</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden md:inline text-[8px] md:text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">LIVE</span>
                <button 
                  onClick={() => printSystemLogs(systemLogs, "System Audit Ledger", currentUser)}
                  className="flex items-center gap-1.5 text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-widest hover:text-primary transition-all group"
                >
                  <Printer size={12} className="group-hover:scale-110 transition-transform" />
                  Print Logs
                </button>
                <button className="text-[8px] md:text-[10px] text-primary font-black uppercase tracking-widest hover:underline transition-all">
                  View All
                </button>
              </div>
            </div>
            <div className="p-2 md:p-4 space-y-2 md:space-y-4 flex-1 overflow-y-auto max-h-[280px] scrollbar-hide">
              {combinedTimeline.length > 0 ? (
                combinedTimeline.map((item, idx) => {
                  const associatedRequisition = findRequisitionForLog(item.message);
                  
                  return (
                    <div 
                      key={`dashboard-timeline-${item.type}-${item.id || idx}-${idx}`} 
                      onClick={() => {
                        if (associatedRequisition) {
                          handleOpenRequisitionPage(associatedRequisition);
                        }
                      }}
                      className={cn(
                        "relative pl-6 pb-3 md:pb-4 border-l-2 border-slate-100 last:pb-0 group transition-colors",
                        associatedRequisition ? "hover:bg-slate-50 cursor-pointer p-1.5 -ml-1.5 rounded-r-xl" : ""
                      )}
                    >
                      <div className={cn(
                        "absolute left-[-5px] top-1.5 md:top-2 w-2 h-2 rounded-full border border-white ring-4 ring-white",
                        item.type === "ALERT" 
                          ? (item.severity === "HIGH" ? "bg-rose-500" : "bg-amber-500")
                          : (item.action?.includes("CREATE") ? "bg-blue-500" : item.action?.includes("APPROVE") ? "bg-emerald-500" : "bg-slate-400")
                      )} />
                      
                      <p className="text-[10px] md:text-[11px] font-bold text-slate-800 leading-snug group-hover:text-indigo-950 transition-colors">
                        {item.message}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                        <span className="text-[8px] md:text-[9px] text-slate-400 font-mono uppercase">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={cn(
                          "px-1 py-0.5 rounded text-[7px] md:text-[8px] font-black tracking-widest uppercase border",
                          item.type === "ALERT" ? "bg-rose-50/50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {item.type === "ALERT" ? `Alert (${item.severity})` : item.action?.replace(/_/g, " ") || "AUDIT"}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10 opacity-50">
                  <Activity size={24} />
                  <p className="text-[8px] font-bold uppercase tracking-widest mt-2">No activity logs</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Group Requests Breakdown Ledger & Dashboard Pie Chart Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table representation (Ministry Group Requests) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between font-sans">
            <div>
              <h2 className="text-[10px] md:text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                Ministry Group Requests
              </h2>
              <p className="text-[8px] md:text-[10px] text-slate-400 mt-0.5 uppercase font-mono">Consolidated Financials</p>
            </div>
            <span className="text-[8px] md:text-[10px] font-mono text-slate-400">TOTAL: {requestedPerGroup.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="px-4 md:px-6 py-2 md:py-3 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Ministry Group</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Requisitions</th>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-2 md:py-3 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pending</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Sum (Ksh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requestedPerGroup.map((val, i) => (
                  <tr 
                    key={`dashboard-group-row-${val.groupId}-${i}`} 
                    onClick={() => setSelectedGroupDetails(val)}
                    className="hover:bg-indigo-50/20 transition-all cursor-pointer group"
                  >
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-[11px] md:text-sm uppercase group-hover:text-indigo-600 transition-colors truncate max-w-[100px] md:max-w-none">{val.groupName}</span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4 text-center">
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] md:text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                        {val.count}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] md:text-[11px] font-mono font-bold",
                        val.pendingCount > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"
                      )}>
                        {val.pendingCount}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4 text-right font-mono font-black text-slate-900 text-[11px] md:text-sm">
                      {formatCurrency(val.totalAmount)}
                    </td>
                  </tr>
                ))}
                {requestedPerGroup.length > 0 && (
                  <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                    <td className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black uppercase text-slate-800">
                      Grand Total
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center font-mono text-[10px] md:text-xs text-slate-500">
                      {requestedPerGroup.reduce((acc, x) => acc + x.count, 0)}
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-center font-mono text-[10px] md:text-xs text-slate-500">
                      {requestedPerGroup.reduce((acc, x) => acc + x.pendingCount, 0)}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right font-mono text-xs md:text-sm text-primary">
                      {formatCurrency(requestedPerGroup.reduce((acc, x) => acc + x.totalAmount, 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual value distribution chart */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col font-sans">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-[10px] md:text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={16} className="text-primary" />
              Requisitions Breakdown
            </h2>
            <span className="text-[8px] md:text-[10px] font-black bg-primary/10 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-widest">Share %</span>
          </div>

          <div className="p-4 flex flex-col items-center justify-center flex-1 space-y-4">
            {requestedPerGroup.length > 0 ? (
              <>
                <div className="w-full h-[185px] relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie
                        data={requestedPerGroup}
                        nameKey="groupName"
                        dataKey="totalAmount"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {requestedPerGroup.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Center metrics summary overlay */}
                  <div className="absolute text-center flex flex-col items-center pointer-events-none">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Value</span>
                    <span className="text-sm font-black text-slate-900 font-mono mt-0.5">
                      Ksh {(requestedPerGroup.reduce((acc, x) => acc + x.totalAmount, 0) / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>

                {/* Highly readable color-coded descriptive legends */}
                <div className="w-full space-y-1 overflow-y-auto max-h-[155px] pr-1">
                  {(() => {
                    const totalVal = requestedPerGroup.reduce((acc, x) => acc + x.totalAmount, 0);
                    return requestedPerGroup.map((g, idx) => {
                      const color = PIE_COLORS[idx % PIE_COLORS.length];
                      const pct = totalVal > 0 ? ((g.totalAmount / totalVal) * 100).toFixed(1) : "0";
                      return (
                        <div 
                          key={`dashboard-legend-item-${g.groupId}-${idx}`} 
                          onClick={() => setSelectedGroupDetails(g)}
                          className="flex items-center justify-between text-[11px] p-2 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group/item"
                        >
                          <div className="flex items-center gap-2 truncate max-w-[65%]">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="font-bold text-slate-700 uppercase tracking-tight truncate group-hover/item:text-primary transition-colors text-[10px]">
                              {g.groupName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-slate-800 shrink-0">
                            <span>{pct}%</span>
                            <span className="text-slate-400">|</span>
                            <span>Ksh {g.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-slate-300 py-10 opacity-50">
                <TrendingUp size={30} />
                <p className="text-[8px] font-bold uppercase tracking-widest mt-2">No allocation available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Budget Variance Summary Widget Removed */}

      {/* Transaction Summary Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Recent Approval Activity</h2>
          <span className="text-[10px] font-mono text-slate-400">LAST_UPDATE: {new Date().toLocaleTimeString()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Requisition</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Group</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested Value</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRequisitions.map((req, i) => (
                <motion.tr 
                  key={req.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleOpenRequisitionPage(req)}
                  className="hover:bg-indigo-50/20 active:bg-indigo-50/40 transition-all cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-1.5 flex-wrap">
                          <span>{req.title}</span>
                          {formatRequisitionAge(req.submittedAt, req.status, { compact: true }) && (
                            <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                              {formatRequisitionAge(req.submittedAt, req.status, { compact: true })}
                            </span>
                          )}
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={11} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                          {req.inProcurement && (
                            <span className="text-[8px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                              PROCUREMENT
                            </span>
                          )}
                          {req.requiresMoreInfo && (
                            <span className="text-[8px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                              INFO REQ
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">#{req.id.slice(-8).toUpperCase()}</div>
                      </div>
                      <span className="text-[9px] text-indigo-600 bg-indigo-50 opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded font-black tracking-widest uppercase transition-all">
                        INSPECT
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded uppercase tracking-wider">
                      {req.groupName}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">{formatCurrency(req.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase",
                      req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600" :
                      req.status === RequisitionStatus.SUBMITTED ? "bg-amber-50 text-amber-600" :
                      req.status === RequisitionStatus.REJECTED ? "bg-rose-50 text-rose-600" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {req.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Generator Modal */}
      <AnimatePresence>
        {isGeneratingReceipt && (
          <ReceiptTemplateGenerator 
            req={isGeneratingReceipt} 
            onClose={() => setIsGeneratingReceipt(null)} 
          />
        )}
      </AnimatePresence>

      {/* Ministry Group requests detailed list Modal */}
      <AnimatePresence>
        {selectedGroupDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-none md:rounded-3xl w-full max-w-5xl h-full md:h-auto md:max-h-[85vh] shadow-2xl overflow-hidden border border-slate-200 flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">{selectedGroupDetails.groupName}</h3>
                    <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mt-0.5">All Group Account Requisitions</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedGroupDetails(null)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Req sent</span>
                    <p className="text-lg md:text-2xl font-bold text-slate-950 font-mono mt-1">{selectedGroupDetails.count}</p>
                  </div>
                  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</span>
                    <p className="text-lg md:text-2xl font-bold text-amber-600 font-mono mt-1">{selectedGroupDetails.pendingCount}</p>
                  </div>
                  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disbursed</span>
                    <p className="text-lg md:text-2xl font-bold text-emerald-600 font-mono mt-1">{formatCurrency(selectedGroupDetails.disbursedAmount)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exposure</span>
                    <p className="text-lg md:text-2xl font-bold text-indigo-600 font-mono mt-1">{formatCurrency(selectedGroupDetails.totalAmount)}</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">List of Requisitions</span>
                    <span className="text-[10px] font-mono text-slate-400">COUNT: {selectedGroupDetails.requisitions.length} ENTRIES</span>
                  </div>
                  <div className="overflow-x-auto max-h-[40vh]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/55 border-b border-slate-100">
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Req ID</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Requisition Title</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted Date</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Digital Status</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Fund Value (KES)</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Inspect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedGroupDetails.requisitions.map((req: Requisition, idx: number) => (
                          <tr 
                            key={req.id} 
                            onClick={(e) => {
                              handleOpenRequisitionPage(req);
                              setSelectedGroupDetails(null);
                            }}
                            className="hover:bg-indigo-50/20 transition-colors cursor-pointer group"
                          >
                            <td className="px-6 py-4 font-mono text-xs text-slate-500 font-bold uppercase">
                              #{req.id.substr(0, 8).toUpperCase()}
                            </td>
                            <td className="px-6 py-4 border-slate-100">
                              <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                                <span>{req.title}</span>
                                {req.flaggedForAudit && (
                                  <span title="Flagged for Audit" className="inline-flex shrink-0">
                                    <Flag size={11} className="text-rose-500 fill-rose-500" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-sm mt-0.5">{req.description}</div>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-medium font-mono">
                              {new Date(req.submittedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase",
                                req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                req.status === RequisitionStatus.SUBMITTED ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                req.status === RequisitionStatus.REJECTED ? "bg-rose-50 text-rose-600 border border-rose-100" :
                                "bg-slate-100 text-slate-500 border border-slate-200"
                              )}>
                                {req.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-xs">
                              {formatCurrency(req.amount)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex px-2.5 py-1.5 bg-slate-50 text-slate-500 border border-slate-200 group-hover:border-indigo-500 group-hover:text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all items-center gap-1 mx-auto font-sans">
                                <Eye size={11} strokeWidth={2.5} />
                                VIEW
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end">
                <button 
                  onClick={() => setSelectedGroupDetails(null)}
                  className="px-8 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer font-sans"
                >
                  DISMISS VIEW
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isSupplementaryModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-none md:rounded-3xl w-full max-w-xl h-full md:h-auto shadow-2xl overflow-hidden border border-slate-200 flex flex-col"
            >
              <div className="px-6 py-4.5 border-b border-rose-100 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-amber-900 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <TrendingUp size={16} className="text-amber-600" />
                    Apply for Supplementary Budget
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono tracking-wide mt-1">SYS_LEDGER_INCREASE_V1</p>
                </div>
                <button 
                  onClick={() => setIsSupplementaryModalOpen(false)}
                  className="p-2 hover:bg-slate-200/50 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto max-h-[75vh] space-y-6">
                {supError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 items-center text-xs text-rose-600 font-bold">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{supError}</span>
                  </div>
                )}
                {supSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 items-center text-xs text-emerald-600 font-bold">
                    <CheckCircle size={14} className="shrink-0" />
                    <span>{supSuccess}</span>
                  </div>
                )}

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!supProjectId) {
                      setSupError("Please select a target allocation project");
                      return;
                    }
                    const amt = Number(supAmount);
                    if (isNaN(amt) || amt <= 0) {
                      setSupError("Please specify a positive supplementary budget amount");
                      return;
                    }
                    if (!supJustification.trim()) {
                      setSupError("Please provide a business justification for this supplement");
                      return;
                    }

                    setSupSubmitting(true);
                    setSupError(null);
                    setSupSuccess(null);
                    try {
                      await applySupplementaryBudget(supProjectId, amt, supJustification.trim());
                      setSupSuccess("Supplementary budget request logged and transmitted to the oversight board successfully.");
                      setSupAmount("");
                      setSupJustification("");
                      setSupProjectId("");
                    } catch (err: any) {
                      setSupError(err?.message || "Failed to submit request.");
                    } finally {
                      setSupSubmitting(false);
                    }
                  }} 
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Project Allocation</label>
                    <select
                      required
                      value={supProjectId}
                      onChange={(e) => setSupProjectId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all cursor-pointer"
                    >
                      <option value="">SELECT TARGET LEDGER PROJECT</option>
                      {projects.map(p => {
                        const projectReqs = getProjectRequisitions(p, requisitions);
                        const usedAmount = projectReqs
                          .filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED].includes(r.status))
                          .reduce((sum, r) => sum + r.amount, 0);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.name.toUpperCase()} (Allocated: KES {p.allocatedBudget.toLocaleString()} / Used: KES {usedAmount.toLocaleString()})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Required Supplementary Amount (KES)</label>
                    <input 
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 150000"
                      value={supAmount}
                      onChange={(e) => setSupAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm font-semibold outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detailed Justification & Purpose</label>
                    <textarea 
                      required
                      rows={3}
                      placeholder="Provide high-integrity justification details. Highlight emergency expenditures, scope expansions, or unforeseen logistics."
                      value={supJustification}
                      onChange={(e) => setSupJustification(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all font-medium resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={supSubmitting}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {supSubmitting ? "TRANSMITTING LEDGER REQUEST..." : "SUBMIT SUPPLEMENTARY APPLICATION"}
                  </button>
                </form>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Recent Applications Status Feed</h4>
                  
                  {supplementaryRequests.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs text-slate-400 font-medium font-sans">No previous supplementary requests registered in ledger.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {supplementaryRequests.map((req) => (
                        <div key={req.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{req.projectName}</span>
                              <span className="text-[8px] font-mono text-slate-300">#{req.id}</span>
                            </div>
                            <p className="text-[10.5px] text-slate-400 font-medium italic truncate max-w-sm">"{req.justification}"</p>
                            <p className="text-[8px] text-slate-400 font-mono">{new Date(req.submittedAt).toLocaleString()} • {req.requesterName}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                            <span className="text-[10.5px] font-bold text-slate-800 font-mono">KES {req.amount.toLocaleString()}</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider",
                              req.status === "APPROVED" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                              req.status === "REJECTED" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                              "bg-amber-50 text-amber-600 border border-amber-100"
                            )}>
                              {req.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {/* Admin/Super Admin Calendar Event Modal */}
        {isCalendarModalOpen && canEditCalendar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full border border-slate-100 shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-md">
                    <CalendarRange size={20} className="text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      {editingCalendarEvent ? "Edit Calendar Event" : "Schedule Calendar Event"}
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase font-mono tracking-tight">
                      Admin & Super Admin Privilege
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsCalendarModalOpen(false)} 
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!calTitle.trim() || !calDate || !calDescription.trim()) {
                    alert("Please fill in Title, Date, and Description.");
                    return;
                  }

                  setCalSaving(true);
                  try {
                    if (editingCalendarEvent) {
                      await updateCustomCalendarEvent(editingCalendarEvent.id, {
                        title: calTitle.trim(),
                        description: calDescription.trim(),
                        date: calDate,
                        time: calTime.trim() || undefined,
                        category: calCategory,
                        badge: calBadge.trim() || undefined
                      });
                    } else {
                      await addCustomCalendarEvent({
                        title: calTitle.trim(),
                        description: calDescription.trim(),
                        date: calDate,
                        time: calTime.trim() || undefined,
                        category: calCategory,
                        badge: calBadge.trim() || undefined
                      });
                    }
                    setIsCalendarModalOpen(false);
                    setEditingCalendarEvent(null);
                  } catch (err: any) {
                    alert(err?.message || "Failed to save calendar event.");
                  } finally {
                    setCalSaving(false);
                  }
                }}
                className="p-6 space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Event Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Finance Board Quarterly Sync"
                    value={calTitle}
                    onChange={(e) => setCalTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Event Date *</label>
                    <input
                      type="date"
                      required
                      value={calDate}
                      onChange={(e) => setCalDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Time (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 10:30 AM"
                      value={calTime}
                      onChange={(e) => setCalTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                    <select
                      value={calCategory}
                      onChange={(e: any) => setCalCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all cursor-pointer"
                    >
                      <option value="MEETING">Meeting</option>
                      <option value="DEADLINE">Deadline</option>
                      <option value="AUDIT">Audit</option>
                      <option value="EVENT">Event</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Badge Tag</label>
                    <input
                      type="text"
                      placeholder="e.g. Board Cut-off"
                      value={calBadge}
                      onChange={(e) => setCalBadge(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description & Agenda *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide event overview, instructions, or meeting agenda notes..."
                    value={calDescription}
                    onChange={(e) => setCalDescription(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm text-slate-800 outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCalendarModalOpen(false)}
                    className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={calSaving}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
                  >
                    {calSaving ? "Saving..." : editingCalendarEvent ? "Update Event" : "Save Event"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isNewRequisitionModalOpen && <NewRequisitionForm onClose={() => setIsNewRequisitionModalOpen(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
