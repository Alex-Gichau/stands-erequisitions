/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  Building2, 
  Users, 
  Wallet, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  X, 
  Download, 
  ChevronRight, 
  Calendar, 
  TrendingUp, 
  PieChart, 
  Search, 
  Filter, 
  ArrowUpRight, 
  XCircle, 
  UserCheck, 
  BadgeCheck,
  Edit,
  DollarSign,
  Info,
  Shield,
  Phone,
  Mail,
  Check,
  Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { ChurchGroup, UserProfile, UserRole, RequisitionStatus, Requisition, Project, LedgerBook } from "../types";
import { UserAvatar } from "./UserAvatar";
import { cn } from "../lib/utils";

interface ChurchGroupDetailsModalProps {
  group: ChurchGroup | null;
  onClose: () => void;
  onManageUser?: (user: UserProfile) => void;
}

type ModalTab = "financials" | "requisitions" | "members" | "approvers" | "info";

export const ChurchGroupDetailsModal: React.FC<ChurchGroupDetailsModalProps> = ({
  group,
  onClose,
  onManageUser
}) => {
  const { 
    users, 
    requisitions, 
    projects, 
    ledgerBooks, 
    currentUser 
  } = useRequisitions();

  const [activeTab, setActiveTab] = useState<ModalTab>("financials");
  const [reqSearchTerm, setReqSearchTerm] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState<string>("ALL");
  const [memberSearchTerm, setMemberSearchTerm] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState<string>("ALL");
  const [copiedId, setCopiedId] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!group) return null;

  // 1. Group Members & Affiliated Users
  const isUserInGroup = (user: UserProfile) => {
    if (!user) return false;
    if (user.group === group.name || user.group === group.id) return true;
    if (Array.isArray(user.groups)) {
      return user.groups.includes(group.name) || user.groups.includes(group.id);
    }
    return false;
  };

  const groupMembers = useMemo(() => {
    return users.filter(isUserInGroup);
  }, [users, group]);

  const activeMembersCount = groupMembers.filter(u => u.isApproved && !u.isSuspended).length;
  const pendingMembersCount = groupMembers.filter(u => !u.isApproved && !u.isSuspended).length;
  const suspendedMembersCount = groupMembers.filter(u => u.isSuspended).length;

  // 2. Approvers for this group
  // Specific approvers directly associated with this group
  const groupL1Approvers = useMemo(() => {
    return users.filter(u => u.role === UserRole.APPROVER_L1 && isUserInGroup(u));
  }, [users, group]);

  const groupL2Approvers = useMemo(() => {
    return users.filter(u => u.role === UserRole.APPROVER_L2 && isUserInGroup(u));
  }, [users, group]);

  // Global / Church-wide approvers available if group has no assigned approver
  const allL1Approvers = useMemo(() => {
    return users.filter(u => u.role === UserRole.APPROVER_L1);
  }, [users]);

  const allL2Approvers = useMemo(() => {
    return users.filter(u => u.role === UserRole.APPROVER_L2);
  }, [users]);

  // 3. Requisitions for this group
  const groupRequisitions = useMemo(() => {
    return requisitions.filter(r => {
      const gId = (r.groupId || "").trim().toLowerCase();
      const gName = (r.groupName || "").trim().toLowerCase();
      const targetId = group.id.trim().toLowerCase();
      const targetName = group.name.trim().toLowerCase();
      return gId === targetId || gName === targetName || gId === targetName;
    });
  }, [requisitions, group]);

  // Requisitions breakdown
  const totalRequestedAmount = useMemo(() => {
    return groupRequisitions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [groupRequisitions]);

  const disbursedRequisitions = useMemo(() => {
    return groupRequisitions.filter(r => r.status === RequisitionStatus.DISBURSED || r.status === RequisitionStatus.PARTIALLY_DISBURSED);
  }, [groupRequisitions]);

  const disbursedAmount = useMemo(() => {
    return disbursedRequisitions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [disbursedRequisitions]);

  const pendingRequisitions = useMemo(() => {
    return groupRequisitions.filter(r => 
      r.status === RequisitionStatus.SUBMITTED || 
      r.status === RequisitionStatus.APPROVED_L1 || 
      r.status === RequisitionStatus.ESCALATED
    );
  }, [groupRequisitions]);

  const pendingAmount = useMemo(() => {
    return pendingRequisitions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [pendingRequisitions]);

  const approvedL2Requisitions = useMemo(() => {
    return groupRequisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2);
  }, [groupRequisitions]);

  const approvedL2Amount = useMemo(() => {
    return approvedL2Requisitions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [approvedL2Requisitions]);

  const rejectedRequisitions = useMemo(() => {
    return groupRequisitions.filter(r => r.status === RequisitionStatus.REJECTED);
  }, [groupRequisitions]);

  // 4. Budget & Projects linked to this group
  const groupProjects = useMemo(() => {
    return projects.filter(p => {
      const pGroupId = (p.groupId || "").trim().toLowerCase();
      const targetId = group.id.trim().toLowerCase();
      const targetName = group.name.trim().toLowerCase();
      const pName = (p.name || "").trim().toLowerCase();
      return pGroupId === targetId || pGroupId === targetName || pName.includes(targetName);
    });
  }, [projects, group]);

  const totalAllocatedBudget = useMemo(() => {
    return groupProjects.reduce((sum, p) => sum + (Number(p.allocatedBudget) || 0), 0);
  }, [groupProjects]);

  const totalSpentFromProjects = useMemo(() => {
    return groupProjects.reduce((sum, p) => sum + (Number(p.spentAmount) || 0), 0);
  }, [groupProjects]);

  // Actual spent: use higher of recorded project spent or recorded disbursed requisitions
  const actualSpentBudget = Math.max(totalSpentFromProjects, disbursedAmount);
  const remainingBudget = Math.max(0, totalAllocatedBudget - actualSpentBudget);
  const utilizationPercentage = totalAllocatedBudget > 0 
    ? Math.min(100, Math.round((actualSpentBudget / totalAllocatedBudget) * 100))
    : 0;

  // 5. Ledger Books linked to this group
  const groupLedgerBooks = useMemo(() => {
    return ledgerBooks.filter(lb => {
      const ministryId = (lb.ministryId || "").trim().toLowerCase();
      const ministryName = (lb.ministryName || "").trim().toLowerCase();
      const targetId = group.id.trim().toLowerCase();
      const targetName = group.name.trim().toLowerCase();
      return ministryId === targetId || ministryName === targetName;
    });
  }, [ledgerBooks, group]);

  // Filtered Requisitions for Tab View
  const filteredRequisitions = useMemo(() => {
    return groupRequisitions.filter(req => {
      const matchesSearch = 
        !reqSearchTerm ||
        req.title.toLowerCase().includes(reqSearchTerm.toLowerCase()) ||
        (req.description && req.description.toLowerCase().includes(reqSearchTerm.toLowerCase())) ||
        (req.requesterName && req.requesterName.toLowerCase().includes(reqSearchTerm.toLowerCase())) ||
        req.id.toLowerCase().includes(reqSearchTerm.toLowerCase());

      const matchesStatus = 
        reqStatusFilter === "ALL" || 
        req.status === reqStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [groupRequisitions, reqSearchTerm, reqStatusFilter]);

  // Filtered Members for Tab View
  const filteredMembers = useMemo(() => {
    return groupMembers.filter(member => {
      const matchesSearch = 
        !memberSearchTerm ||
        member.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
        (member.phone && member.phone.toLowerCase().includes(memberSearchTerm.toLowerCase()));

      const matchesRole = 
        memberRoleFilter === "ALL" || 
        member.role === memberRoleFilter;

      return matchesSearch && matchesRole;
    });
  }, [groupMembers, memberSearchTerm, memberRoleFilter]);

  // Export Members CSV
  const handleExportMembersCSV = () => {
    if (groupMembers.length === 0) {
      alert(`No registered members to export for ${group.name}.`);
      return;
    }

    const headers = ["User ID", "Full Name", "Email Address", "Phone", "Role", "Group", "Approval Status", "Suspended"];
    const rows = groupMembers.map(u => [
      `"${u.id}"`,
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.email}"`,
      `"${u.phone || 'N/A'}"`,
      `"${u.role}"`,
      `"${group.name}"`,
      `"${u.isApproved ? 'APPROVED' : 'PENDING'}"`,
      `"${u.isSuspended ? 'YES' : 'NO'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${group.name.replace(/[^a-zA-Z0-9]/g, "_")}_members_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Requisitions CSV
  const handleExportRequisitionsCSV = () => {
    if (groupRequisitions.length === 0) {
      alert(`No requisitions found to export for ${group.name}.`);
      return;
    }

    const headers = ["Requisition ID", "Title", "Amount (KES)", "Status", "Requester", "Requester Email", "Submitted At", "Project ID"];
    const rows = groupRequisitions.map(r => [
      `"${r.id}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.amount}"`,
      `"${r.status}"`,
      `"${r.requesterName?.replace(/"/g, '""') || 'N/A'}"`,
      `"${r.requesterEmail || 'N/A'}"`,
      `"${r.submittedAt || ''}"`,
      `"${r.projectId || 'N/A'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${group.name.replace(/[^a-zA-Z0-9]/g, "_")}_requisitions_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyGroupId = () => {
    navigator.clipboard.writeText(group.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col w-screen h-screen overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.18 }}
        className="bg-slate-50 dark:bg-slate-950 w-full h-full flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 lg:px-10 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary dark:bg-blue-500/10 dark:text-blue-400 flex items-center justify-center shrink-0 border border-primary/20">
                <Building2 size={24} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    {group.name}
                  </h2>
                  <button 
                    onClick={copyGroupId}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
                    title="Click to copy Group ID"
                  >
                    <span>#{group.id.toUpperCase().substring(0, 8)}</span>
                    {copiedId ? <Check size={10} className="text-emerald-500" /> : null}
                  </button>
                  {totalAllocatedBudget === 0 ? (
                    <span 
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 shadow-2xs"
                      title="No active project budget line assigned to this church group"
                    >
                      <AlertTriangle size={10} className="text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>No Allocated Budget</span>
                    </span>
                  ) : (
                    <span 
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 shadow-2xs"
                      title={`Allocated Budget: KES ${totalAllocatedBudget.toLocaleString()}`}
                    >
                      <Wallet size={10} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>KES {(totalAllocatedBudget / 1000).toFixed(0)}k Budget</span>
                    </span>
                  )}
                  <span className="hidden md:inline-flex items-center gap-1 text-[9px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    FULL SCREEN (ESC TO CLOSE)
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {group.description || "Church ministry and expense group of St. Andrew's PCEA."}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleExportMembersCSV}
                  className="px-2.5 py-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                  title="Export members as CSV"
                >
                  <Download size={12} className="text-primary dark:text-blue-400" />
                  <span className="hidden sm:inline">Members</span> CSV
                </button>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={handleExportRequisitionsCSV}
                  className="px-2.5 py-1.5 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                  title="Export requisitions as CSV"
                >
                  <Download size={12} className="text-emerald-500" />
                  <span className="hidden sm:inline">Requisitions</span> CSV
                </button>
              </div>

              <button 
                onClick={onClose} 
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Close modal (Esc)"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
            {/* Allocated Budget */}
            <div className={cn(
              "p-2.5 rounded-xl border transition-all",
              totalAllocatedBudget === 0
                ? "bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/80"
                : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800"
            )}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                {totalAllocatedBudget === 0 ? (
                  <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
                ) : (
                  <Wallet size={12} className="text-emerald-500" />
                )}
                <span className={totalAllocatedBudget === 0 ? "text-amber-800 dark:text-amber-300 font-bold" : "text-slate-400 dark:text-slate-500"}>
                  Allocated Budget
                </span>
              </div>
              <div className={cn(
                "text-xs sm:text-sm font-black mt-1 truncate",
                totalAllocatedBudget === 0 ? "text-amber-900 dark:text-amber-200" : "text-slate-900 dark:text-slate-100"
              )}>
                {totalAllocatedBudget === 0 ? "No Budget Allocated" : `KES ${totalAllocatedBudget.toLocaleString()}`}
              </div>
              <div className={cn(
                "text-[10px] mt-0.5",
                totalAllocatedBudget === 0 ? "text-amber-700 dark:text-amber-400 font-medium" : "text-slate-400"
              )}>
                {totalAllocatedBudget === 0 ? "0 assigned project lines" : `${groupProjects.length} project(s)`}
              </div>
            </div>

            {/* Disbursed / Expended */}
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <TrendingUp size={12} className="text-primary dark:text-blue-400" />
                <span>Disbursed Funds</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
                KES {actualSpentBudget.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {utilizationPercentage}% utilized
              </div>
            </div>

            {/* Remaining Balance */}
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <PieChart size={12} className="text-amber-500" />
                <span>Remaining</span>
              </div>
              <div className={cn(
                "text-xs sm:text-sm font-black mt-1",
                remainingBudget <= 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"
              )}>
                KES {remainingBudget.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {100 - utilizationPercentage}% available
              </div>
            </div>

            {/* Total Requisitions */}
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <FileText size={12} className="text-indigo-500" />
                <span>Requisitions</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
                {groupRequisitions.length} Requested
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                KES {totalRequestedAmount.toLocaleString()}
              </div>
            </div>

            {/* Members & Approvers */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <Users size={12} className="text-purple-500" />
                <span>Personnel</span>
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
                {groupMembers.length} Members
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {groupL1Approvers.length + groupL2Approvers.length} assigned approvers
              </div>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-4 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("financials")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0",
                activeTab === "financials"
                  ? "bg-slate-900 text-white dark:bg-primary dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Wallet size={14} />
              <span>Budget & Projects</span>
              {groupProjects.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700/50 text-slate-200">
                  {groupProjects.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("requisitions")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0",
                activeTab === "requisitions"
                  ? "bg-slate-900 text-white dark:bg-primary dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <FileText size={14} />
              <span>Requisitions Requested</span>
              {groupRequisitions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700/50 text-slate-200">
                  {groupRequisitions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("members")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0",
                activeTab === "members"
                  ? "bg-slate-900 text-white dark:bg-primary dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Users size={14} />
              <span>Members</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700/50 text-slate-200">
                {groupMembers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("approvers")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0",
                activeTab === "approvers"
                  ? "bg-slate-900 text-white dark:bg-primary dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <ShieldCheck size={14} />
              <span>Approvers</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700/50 text-slate-200">
                {groupL1Approvers.length + groupL2Approvers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("info")}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0",
                activeTab === "info"
                  ? "bg-slate-900 text-white dark:bg-primary dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              <Info size={14} />
              <span>Details & Purview</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* TAB 1: FINANCIALS & BUDGET */}
            {activeTab === "financials" && (
            <div className="space-y-6">
              {/* Unbudgeted Notice Banner if no allocated budget */}
              {totalAllocatedBudget === 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl flex items-start gap-3 shadow-xs">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl text-amber-700 dark:text-amber-300 shrink-0">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                        No Dedicated Budget Line Allocated
                      </h4>
                      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-mono">
                        GENERAL POOL
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                      This church group does not currently have a dedicated project budget allocation (KES 0.00 allocated). Expenses and requisitions submitted under this group route through General Church Operations or require supplementary budget assignment by Treasury.
                    </p>
                  </div>
                </div>
              )}

              {/* Financial Utilization Overview */}
              <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <TrendingUp size={16} className="text-primary" />
                      Budget Utilization & Financial Health
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Overview of allocated funds, disbursed expenditures, and pending approvals.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1",
                      totalAllocatedBudget === 0
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : utilizationPercentage > 90 
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                        : utilizationPercentage > 70
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                    )}>
                      {totalAllocatedBudget === 0 ? "No Allocated Cap" : `${utilizationPercentage}% Utilized`}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-emerald-500 transition-all duration-500" 
                      style={{ width: `${Math.min(100, utilizationPercentage)}%` }}
                      title={`Disbursed: KES ${actualSpentBudget.toLocaleString()}`}
                    />
                    {totalAllocatedBudget > 0 && pendingAmount > 0 && (
                      <div 
                        className="bg-amber-500 transition-all duration-500" 
                        style={{ width: `${Math.min(100 - utilizationPercentage, Math.round((pendingAmount / totalAllocatedBudget) * 100))}%` }}
                        title={`Pending Approvals: KES ${pendingAmount.toLocaleString()}`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Disbursed: KES {actualSpentBudget.toLocaleString()}</span>
                    </div>
                    {pendingAmount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Pending Pipeline: KES {pendingAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
                      <span>Available: {totalAllocatedBudget === 0 ? "KES 0 (Unallocated)" : `KES ${remainingBudget.toLocaleString()}`}</span>
                    </div>
                  </div>
                </div>

                {/* Micro Metric Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Allocated</div>
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">KES {totalAllocatedBudget.toLocaleString()}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Disbursed Funds</div>
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">KES {actualSpentBudget.toLocaleString()}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">In Approval Pipeline</div>
                    <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">KES {pendingAmount.toLocaleString()}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Remaining Uncommitted</div>
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100 mt-0.5">KES {remainingBudget.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Linked Projects Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Briefcase size={16} className="text-primary" />
                    Linked Budget Projects ({groupProjects.length})
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Governs allowable expense limits
                  </span>
                </div>

                {groupProjects.length === 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center">
                    <Briefcase size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Projects Directly Assigned to this Group</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                      Expenditures for this group are accounted for under church general operations. Administrators can assign dedicated project budget lines in the Projects & Budgets panel.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {groupProjects.map(project => {
                      const pSpent = Number(project.spentAmount) || 0;
                      const pAlloc = Number(project.allocatedBudget) || 0;
                      const pRem = Math.max(0, pAlloc - pSpent);
                      const pUtil = pAlloc > 0 ? Math.min(100, Math.round((pSpent / pAlloc) * 100)) : 0;

                      return (
                        <div 
                          key={project.id}
                          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-primary/40 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                                {project.name}
                              </div>
                              {project.accountNumber && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  GL A/C: {project.accountNumber}
                                </div>
                              )}
                            </div>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                              project.status === "ACTIVE" 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                              {project.status}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Allocated:</span>
                              <span className="font-bold text-slate-900 dark:text-slate-100">KES {pAlloc.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Spent:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">KES {pSpent.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-400">Balance:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">KES {pRem.toLocaleString()}</span>
                            </div>

                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
                              <div 
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${pUtil}%` }}
                              />
                            </div>
                          </div>

                          {project.requisitionLimit && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                              <span>Max Per Requisition:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">KES {project.requisitionLimit.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Linked Ledger Books Section */}
              {groupLedgerBooks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Wallet size={16} className="text-emerald-500" />
                    Ministry Ledger Books ({groupLedgerBooks.length})
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {groupLedgerBooks.map(book => (
                      <div 
                        key={book.id}
                        className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{book.bookName || "Main Group Ledger"}</span>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {book.status || "ACTIVE"}
                          </span>
                        </div>
                        {book.budgetLimit && (
                          <div className="text-[11px] text-slate-500">
                            Budget Ceiling: <strong className="text-slate-900 dark:text-slate-100">KES {book.budgetLimit.toLocaleString()}</strong>
                          </div>
                        )}
                        {book.notes && (
                          <p className="text-[10px] text-slate-400 italic">{book.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REQUISITIONS REQUESTED */}
          {activeTab === "requisitions" && (
            <div className="space-y-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={reqSearchTerm}
                    onChange={(e) => setReqSearchTerm(e.target.value)}
                    placeholder="Search requisitions by title, requester, or ID..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {reqSearchTerm && (
                    <button 
                      onClick={() => setReqSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                  {["ALL", RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED, RequisitionStatus.REJECTED].map((status) => (
                    <button
                      key={status}
                      onClick={() => setReqStatusFilter(status)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shrink-0",
                        reqStatusFilter === status
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      )}
                    >
                      {status === "ALL" ? "All Statuses" : status.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Stats Row */}
              <div className="flex items-center justify-between text-xs px-1 text-slate-500">
                <span>Showing <strong>{filteredRequisitions.length}</strong> of <strong>{groupRequisitions.length}</strong> requisitions</span>
                <span>Filtered Total: <strong className="text-slate-900 dark:text-slate-100">KES {filteredRequisitions.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString()}</strong></span>
              </div>

              {/* Requisitions List */}
              {filteredRequisitions.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6">
                  <FileText size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Requisitions Found</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    {reqSearchTerm || reqStatusFilter !== "ALL"
                      ? "Try clearing or modifying your search keyword or status filter."
                      : "No requisitions have been requested under this church group yet."}
                  </p>
                  {(reqSearchTerm || reqStatusFilter !== "ALL") && (
                    <button
                      onClick={() => {
                        setReqSearchTerm("");
                        setReqStatusFilter("ALL");
                      }}
                      className="mt-3 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  {filteredRequisitions.map((req) => {
                    const statusColorMap: Record<string, string> = {
                      [RequisitionStatus.SUBMITTED]: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
                      [RequisitionStatus.APPROVED_L1]: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
                      [RequisitionStatus.APPROVED_L2]: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                      [RequisitionStatus.PARTIALLY_DISBURSED]: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
                      [RequisitionStatus.DISBURSED]: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                      [RequisitionStatus.REJECTED]: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
                    };

                    const statusStyle = statusColorMap[req.status] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                    return (
                      <div 
                        key={req.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              #{req.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-md border", statusStyle)}>
                              {req.status.replace("_", " ")}
                            </span>
                          </div>

                          <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                            {req.title}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
                            <span>Requested by: <strong className="text-slate-600 dark:text-slate-300">{req.requesterName}</strong></span>
                            {req.submittedAt && (
                              <span>• {new Date(req.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            )}
                            {req.installments && req.installments.length > 0 && (
                              <span className="text-primary dark:text-blue-400 font-bold">
                                • {req.installments.filter(i => i.status === "DISBURSED").length}/{req.installments.length} Installments
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</div>
                          <div className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                            KES {(Number(req.amount) || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MEMBERS DIRECTORY */}
          {activeTab === "members" && (
            <div className="space-y-4">
              {/* Member Search & Filters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                    placeholder="Search members by name, email, or phone..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                  {memberSearchTerm && (
                    <button 
                      onClick={() => setMemberSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {["ALL", UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2].map(role => (
                    <button
                      key={role}
                      onClick={() => setMemberRoleFilter(role)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
                        memberRoleFilter === role
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      )}
                    >
                      {role === "ALL" ? "All Roles" : role.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status summary pills */}
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-black">
                  {activeMembersCount} Active
                </span>
                {pendingMembersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-black">
                    {pendingMembersCount} Pending Approval
                  </span>
                )}
                {suspendedMembersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-black">
                    {suspendedMembersCount} Suspended
                  </span>
                )}
                <span className="text-slate-400 ml-auto">
                  {filteredMembers.length} member(s) listed
                </span>
              </div>

              {/* Members List */}
              {filteredMembers.length === 0 ? (
                <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6">
                  <Users size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Members Match Search</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    {memberSearchTerm || memberRoleFilter !== "ALL"
                      ? "No registered members found matching your search or role filters."
                      : "No users are currently registered under this church group. To assign users, open the Users Directory tab."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  {filteredMembers.map((user) => (
                    <div 
                      key={user.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar 
                          user={user} 
                          size="lg" 
                          rounded="xl" 
                          ring="ring-1 ring-slate-200 dark:ring-slate-700" 
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                              {user.name}
                            </span>
                            {user.role === UserRole.APPROVER_L1 && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[8px] font-black uppercase">
                                Approver L1
                              </span>
                            )}
                            {user.role === UserRole.APPROVER_L2 && (
                              <span className="px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 text-[8px] font-black uppercase">
                                Approver L2
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail size={10} />
                              {user.email}
                            </span>
                            {user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={10} />
                                {user.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                          {user.role.replace("_", " ")}
                        </span>

                        {user.isSuspended ? (
                          <span className="text-[8px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 rounded-md border border-rose-200 dark:border-rose-900">
                            SUSPENDED
                          </span>
                        ) : !user.isApproved ? (
                          <span className="text-[8px] font-black px-2 py-0.5 bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-900">
                            PENDING
                          </span>
                        ) : (
                          <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-900">
                            ACTIVE
                          </span>
                        )}

                        {onManageUser && (
                          <button
                            onClick={() => onManageUser(user)}
                            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-primary dark:text-blue-400 hover:bg-primary/5 dark:hover:bg-blue-500/10 rounded-lg border border-primary/20 dark:border-blue-500/30 transition-all flex items-center gap-1"
                            title="Manage user roles & permissions in Users Directory"
                          >
                            <Edit size={10} />
                            <span>MANAGE</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: APPROVERS HIERARCHY */}
          {activeTab === "approvers" && (
            <div className="space-y-6">
              {/* Financial Governance Workflow Explainer */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <ShieldCheck size={20} className="text-primary dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Dual-Tier Approval Governance for {group.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Requisitions submitted under this church group proceed through Level 1 (operational review and quotation accuracy) before escalating to Level 2 (Treasury budget line clearance and fund release authorization).
                  </p>
                </div>
              </div>

              {/* Level 1 Approvers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Shield size={16} className="text-indigo-500" />
                    Level 1 Approvers (Operational Review)
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {groupL1Approvers.length > 0 
                      ? `${groupL1Approvers.length} group-assigned approver(s)`
                      : `Church-wide approvers (${allL1Approvers.length})`}
                  </span>
                </div>

                {(groupL1Approvers.length > 0 ? groupL1Approvers : allL1Approvers).length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No Level 1 Approvers registered in the system.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(groupL1Approvers.length > 0 ? groupL1Approvers : allL1Approvers).map(approver => {
                      const isDirectlyAssigned = isUserInGroup(approver);

                      return (
                        <div 
                          key={approver.id}
                          className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <UserAvatar user={approver} size="md" rounded="xl" />
                            <div>
                              <div className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase">
                                {approver.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {approver.email}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-md",
                              isDirectlyAssigned 
                                ? "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                              {isDirectlyAssigned ? "Direct Group L1" : "Church-Wide L1"}
                            </span>
                            <div className="text-[9px] text-slate-400 mt-1">
                              {approver.approverCode ? "PIN Configured" : "Code Pending"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Level 2 Approvers */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-purple-500" />
                    Level 2 Approvers (Treasury & Finance Clearance)
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {groupL2Approvers.length > 0 
                      ? `${groupL2Approvers.length} group-assigned approver(s)`
                      : `Church-wide Treasury (${allL2Approvers.length})`}
                  </span>
                </div>

                {(groupL2Approvers.length > 0 ? groupL2Approvers : allL2Approvers).length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No Level 2 Approvers registered in the system.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(groupL2Approvers.length > 0 ? groupL2Approvers : allL2Approvers).map(approver => {
                      const isDirectlyAssigned = isUserInGroup(approver);

                      return (
                        <div 
                          key={approver.id}
                          className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <UserAvatar user={approver} size="md" rounded="xl" />
                            <div>
                              <div className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase">
                                {approver.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {approver.email}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-md",
                              isDirectlyAssigned 
                                ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                              {isDirectlyAssigned ? "Direct Group L2" : "Treasury L2"}
                            </span>
                            <div className="text-[9px] text-slate-400 mt-1">
                              {approver.approverCode ? "PIN Configured" : "Code Pending"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: GROUP DETAILS & PURVIEW */}
          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Building2 size={16} className="text-primary" />
                  Group Profile & Mandate
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {group.description || "No specific charter description has been documented for this group yet. You can update this by editing the church group details."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Identifier</div>
                  <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 break-all">{group.id}</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Registered</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {group.createdAt 
                      ? new Date(group.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                      : "Pre-existing ministry record"}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lifetime Disbursed</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    KES {disbursedAmount.toLocaleString()}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Requisitions Volume</div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {groupRequisitions.length} requests (KES {totalRequestedAmount.toLocaleString()})
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 lg:px-10 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportMembersCSV}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-primary text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
            >
              <Download size={12} className="text-primary dark:text-blue-400" />
              <span>Export Members</span>
            </button>
            <button
              type="button"
              onClick={handleExportRequisitionsCSV}
              className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
            >
              <Download size={12} className="text-emerald-500" />
              <span>Export Requisitions</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Close Details
          </button>
        </div>
      </motion.div>
    </div>
  );
};
