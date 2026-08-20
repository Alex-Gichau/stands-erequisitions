/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, cn } from "../lib/utils";
import { 
  Bell, 
  CheckCircle, 
  ArrowRight, 
  ShieldCheck, 
  UserCheck, 
  FileCheck, 
  AlertTriangle, 
  Activity, 
  FileText,
  FilePlus,
  DollarSign,
  Calendar,
  Sparkles,
  Search,
  Eye,
  CheckCircle2,
  Check,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Star,
  Archive,
  Mail,
  MailOpen,
  Reply,
  Forward,
  MoreHorizontal,
  Paperclip,
  Tag,
  ExternalLink,
  Filter,
  User,
  Clock,
  Zap,
  Building2,
  MessageSquare,
  X,
  RotateCcw,
  ArchiveRestore
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NotificationHubProps {
  onSelectRequisition: (req: Requisition) => void;
}

export interface NotificationItem {
  id: string;
  rawId?: string;
  type: "MEMBER_APPROVAL" | "REQ_RECEIVED" | "REQ_APPROVED" | "FINANCE_DISBURSEMENT_REQUIRED" | "BUDGET_ALERT";
  category: "PRIMARY" | "REQUISITIONS" | "APPROVALS" | "PAYOUTS" | "ALERTS";
  senderName: string;
  senderEmail: string;
  avatarGradient: string;
  title: string;
  message: string;
  snippet: string;
  actionLabel: string;
  timestamp: string;
  tags: string[];
  attachments?: Array<{ name: string; size: string; type: string }>;
  requisition?: Requisition;
  action: () => Promise<void> | void;
}

export const NotificationHub: React.FC<NotificationHubProps> = ({ onSelectRequisition }) => {
  const { 
    currentUser, 
    users, 
    requisitions, 
    approveUser,
    alerts,
    readNoticeIds,
    toggleNoticeRead,
    markAllNoticesRead,
    starredNoticeIds,
    archivedNoticeIds,
    deletedNoticeIds,
    toggleNoticeStarred,
    toggleNoticeArchived,
    toggleNoticeDeleted,
    triggerToast,
    deleteAlert
  } = useRequisitions();

  const [activeTab, setActiveTab] = useState<"ALL" | "REQUISITIONS" | "APPROVALS" | "PAYOUTS" | "ALERTS" | "STARRED" | "ARCHIVED" | "TRASH">("ALL");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [successId, setSuccessId] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  // Lookup profile picture from user directory
  const getUserPhoto = (email?: string, name?: string, id?: string) => {
    if (!email && !name && !id) return "";
    const matchedUser = users.find(u => 
      (id && String(u.id).toLowerCase() === String(id).toLowerCase()) ||
      (email && u.email && u.email.toLowerCase().trim() === email.toLowerCase().trim()) ||
      (name && u.name && u.name.toLowerCase().trim() === name.toLowerCase().trim())
    );
    return matchedUser?.photoURL || (matchedUser as any)?.avatarUrl || "";
  };

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleNoticeStarred(id);
  };

  const archiveNotice = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    toggleNoticeArchived(id);
    triggerToast({
      type: "SYSTEM_INFO",
      severity: "LOW",
      message: archivedNoticeIds.includes(id) ? "Restored from archive" : "Notification archived",
      timestamp: new Date().toISOString()
    });
  };

  const toggleSectionCollapse = (sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  const handleDeleteAlert = async (e: React.MouseEvent, itemId: string, rawId?: string) => {
    e.stopPropagation();
    if (!rawId) {
      toggleNoticeRead(itemId, true);
      return;
    }
    
    try {
      await deleteAlert(rawId);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: "Notification deleted successfully",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "HIGH",
        message: "Failed to delete notification",
        timestamp: new Date().toISOString()
      });
    }
  };

  const seenRequisitionsRef = useRef<Set<string>>(new Set());
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    if (isFirstMountRef.current) {
      requisitions.forEach(r => seenRequisitionsRef.current.add(r.id));
      isFirstMountRef.current = false;
      return;
    }

    requisitions.forEach(r => {
      if (!seenRequisitionsRef.current.has(r.id)) {
        seenRequisitionsRef.current.add(r.id);
        if (r.status === RequisitionStatus.SUBMITTED && !r.id.includes("req-seed-")) {
          const isUserAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
          const toastMessage = isUserAdmin
            ? `New Requisition: "${r.title}" for KES ${r.amount.toLocaleString()} submitted by ${r.requesterName}`
            : `New Requisition Submitted: "${r.title}"`;

          triggerToast({
            type: "LARGE_REQUEST",
            severity: "LOW",
            message: toastMessage,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
  }, [requisitions, currentUser, triggerToast]);

  // Compile notification items stream
  const notificationItems = useMemo(() => {
    const items: NotificationItem[] = [];
    const now = new Date().toISOString();

    // 1. Members awaiting approval (ADMIN/SUPER_ADMIN)
    if (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) {
      users.filter(u => !u.isApproved).forEach(u => {
        items.push({
          id: `user-await-${u.id}`,
          type: "MEMBER_APPROVAL",
          category: "APPROVALS",
          senderName: u.name || "User Request",
          senderEmail: u.email || "accounts@pceastandrews.org",
          avatarGradient: "bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500",
          title: "User Pending Authorization",
          message: `${u.name} (${u.email}) requested account activation with role assignment as ${u.role}. Authorization is required to enable portal sign-in.`,
          snippet: `Requested role: ${u.role}. Click to authorize account permissions.`,
          actionLabel: "Authorize Account",
          timestamp: now,
          tags: ["#USER_AUTH", "#ROLE_REQUEST", "Action Required"],
          action: async () => {
            await approveUser(u.id);
            setSuccessId(`user-await-${u.id}`);
            setTimeout(() => setSuccessId(null), 3000);
          }
        });
      });

      // 2. New requisitions received (status === SUBMITTED)
      requisitions.filter(r => r.status === RequisitionStatus.SUBMITTED && !r.id.includes("req-seed-")).forEach(r => {
        const atts = Array.isArray(r.attachments) ? r.attachments.map((att, idx) => ({
          name: typeof att === "string" ? att.split("/").pop() || `Document-${idx+1}.pdf` : `Attachment-${idx+1}.pdf`,
          size: "245 KB",
          type: "application/pdf"
        })) : [];

        items.push({
          id: `req-sub-${r.id}`,
          type: "REQ_RECEIVED",
          category: "REQUISITIONS",
          senderName: r.requesterName || r.groupName || "Ministry Group",
          senderEmail: r.requesterEmail || "requisitions@pceastandrews.org",
          avatarGradient: "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500",
          title: `Decision Required: Requisition #${r.id}`,
          message: `New expense requisition "${r.title}" for KES ${r.amount.toLocaleString()} has been submitted by ${r.groupName} (${r.requesterName}) and is awaiting Level 1 verification.`,
          snippet: `Amount: KES ${r.amount.toLocaleString()} • Group: ${r.groupName}. Needs audit signoff.`,
          actionLabel: "Verify Requisition",
          timestamp: r.submittedAt || r.createdAt || now,
          tags: ["#REQUISITION", `#${r.groupName}`, `KES ${r.amount.toLocaleString()}`],
          attachments: atts,
          requisition: r,
          action: () => {
            onSelectRequisition(r);
          }
        });
      });
    }

    // 3. Approvals done
    requisitions.filter(r => (r.status === RequisitionStatus.APPROVED_L1 || r.status === RequisitionStatus.APPROVED_L2) && !r.id.includes("req-seed-")).forEach(r => {
      const atts = Array.isArray(r.attachments) ? r.attachments.map((att, idx) => ({
        name: typeof att === "string" ? att.split("/").pop() || `Approval-Document-${idx+1}.pdf` : `Document-${idx+1}.pdf`,
        size: "310 KB",
        type: "application/pdf"
      })) : [];

      items.push({
        id: `req-app-${r.id}`,
        type: "REQ_APPROVED",
        category: "APPROVALS",
        senderName: (r.approvalHistory && r.approvalHistory.length > 0 ? r.approvalHistory[r.approvalHistory.length - 1].approverName : "") || "Church Treasury & Governance",
        senderEmail: "treasury@pceastandrews.org",
        avatarGradient: "bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500",
        title: `Requisition Authorized: #${r.id}`,
        message: `Requisition "${r.title}" (${r.groupName}) for KES ${r.amount.toLocaleString()} has successfully cleared status level ${r.status.replace("_", " ")}.`,
        snippet: `Status updated to ${r.status.replace("_", " ")} for KES ${r.amount.toLocaleString()}.`,
        actionLabel: "Inspect Details",
        timestamp: r.approvedAtL2 || r.approvedAtL1 || r.submittedAt || now,
        tags: ["#APPROVED", `#${r.status}`, "Authorized"],
        attachments: atts,
        requisition: r,
        action: () => {
          onSelectRequisition(r);
        }
      });
    });

    // 4. Disbursements needed (FINANCE, ADMIN, SUPER_ADMIN)
    if (currentUser?.role === UserRole.FINANCE || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) {
      requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2 && !r.id.includes("req-seed-")).forEach(r => {
        items.push({
          id: `finance-disb-req-${r.id}`,
          type: "FINANCE_DISBURSEMENT_REQUIRED",
          category: "PAYOUTS",
          senderName: "Finance Payout Directives",
          senderEmail: "finance@pceastandrews.org",
          avatarGradient: "bg-gradient-to-tr from-blue-500 via-indigo-600 to-violet-600",
          title: `Payout Directive Ready: #${r.id}`,
          message: `Requisition "${r.title}" (${r.groupName}) is L2 APPROVED and ready for immediate fund disbursement of KES ${r.amount.toLocaleString()}.`,
          snippet: `Disbursement pending for KES ${r.amount.toLocaleString()}. Click to execute payout.`,
          actionLabel: "Execute Payout",
          timestamp: r.approvedAtL2 || r.submittedAt || now,
          tags: ["#DISBURSEMENT", "#PAYOUT_READY", `KES ${r.amount.toLocaleString()}`],
          requisition: r,
          action: () => {
            onSelectRequisition(r);
          }
        });
      });
    }

    // 5. Budget Alerts
    alerts.filter(a => {
      if (a.isRead) return false;
      if (a.targetUserId) return currentUser?.id === a.targetUserId;
      if (a.targetRole && currentUser?.role !== a.targetRole && currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.SUPER_ADMIN) return false;
      return true;
    }).forEach(a => {
      const cleanText = a.message.toLowerCase();
      const associatedReq = requisitions.find(r => 
        (r.id && cleanText.includes(r.id.toLowerCase())) || 
        (r.title && cleanText.includes(r.title.toLowerCase()))
      );

      items.push({
        id: `budget-alert-${a.id}`,
        rawId: a.id,
        type: "BUDGET_ALERT",
        category: "ALERTS",
        senderName: "System Health & Budget Monitor",
        senderEmail: "alerts@pceastandrews.org",
        avatarGradient: "bg-gradient-to-tr from-rose-500 via-red-500 to-amber-500",
        title: a.type === "OVERSHOOT" ? "Budget Overshoot Trigger" : "System Audit Notification",
        message: a.message,
        snippet: a.message.length > 90 ? `${a.message.slice(0, 90)}...` : a.message,
        actionLabel: associatedReq ? "Inspect Requisition" : "Dismiss Alert",
        timestamp: a.timestamp,
        tags: ["#BUDGET_ALERT", "#AUDIT_FLAG", "High Priority"],
        requisition: associatedReq,
        action: () => {
          if (associatedReq) {
            onSelectRequisition(associatedReq);
          }
        }
      });
    });

    return items;
  }, [requisitions, users, alerts, currentUser, onSelectRequisition, approveUser]);

  // Real-time unread counts calculation across active non-deleted items
  const categoryUnreadCounts = useMemo(() => {
    const counts = {
      ALL: 0,
      REQUISITIONS: 0,
      APPROVALS: 0,
      PAYOUTS: 0,
      ALERTS: 0,
      STARRED: 0,
      ARCHIVED: 0,
      TRASH: 0,
    };

    notificationItems.forEach(item => {
      const isUnread = !readNoticeIds.includes(item.id);
      const isDeleted = deletedNoticeIds.includes(item.id);
      const isArchived = archivedNoticeIds.includes(item.id);
      const isStarred = starredNoticeIds.includes(item.id);

      if (isDeleted) {
        if (isUnread) counts.TRASH += 1;
        return;
      }

      if (isArchived) {
        if (isUnread) counts.ARCHIVED += 1;
        return;
      }

      if (isUnread) {
        counts.ALL += 1;
        if (item.category && counts[item.category] !== undefined) {
          counts[item.category] += 1;
        }
        if (isStarred) {
          counts.STARRED += 1;
        }
      }
    });

    return counts;
  }, [notificationItems, readNoticeIds, deletedNoticeIds, archivedNoticeIds, starredNoticeIds]);

  // Filter items based on active tab, unread toggle, and search query
  const filteredItems = useMemo(() => {
    let result = notificationItems;

    if (activeTab === "TRASH") {
      result = result.filter(i => deletedNoticeIds.includes(i.id));
    } else {
      // Exclude deleted items for non-trash views
      result = result.filter(i => !deletedNoticeIds.includes(i.id));

      if (activeTab === "STARRED") {
        result = result.filter(i => starredNoticeIds.includes(i.id));
      } else if (activeTab === "ARCHIVED") {
        result = result.filter(i => archivedNoticeIds.includes(i.id));
      } else {
        // Exclude archived items for main primary & category views
        result = result.filter(i => !archivedNoticeIds.includes(i.id));

        if (activeTab === "REQUISITIONS") {
          result = result.filter(i => i.category === "REQUISITIONS");
        } else if (activeTab === "APPROVALS") {
          result = result.filter(i => i.category === "APPROVALS");
        } else if (activeTab === "PAYOUTS") {
          result = result.filter(i => i.category === "PAYOUTS");
        } else if (activeTab === "ALERTS") {
          result = result.filter(i => i.category === "ALERTS");
        }
      }
    }

    if (showUnreadOnly) {
      result = result.filter(i => !readNoticeIds.includes(i.id));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => 
        i.title.toLowerCase().includes(q) ||
        i.message.toLowerCase().includes(q) ||
        i.senderName.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q)) ||
        (i.requisition && i.requisition.title.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notificationItems, activeTab, showUnreadOnly, searchQuery, readNoticeIds, starredNoticeIds, archivedNoticeIds, deletedNoticeIds]);

  // Allow a state where user can have no selected notification (only clear selection if selected item is no longer in filtered view)
  useEffect(() => {
    if (selectedItemId && !filteredItems.some(i => i.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [filteredItems, selectedItemId]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return filteredItems.find(i => i.id === selectedItemId) || null;
  }, [filteredItems, selectedItemId]);

  // Automatically mark selected item as read when opened/active
  useEffect(() => {
    if (selectedItem?.id && !readNoticeIds.includes(selectedItem.id)) {
      toggleNoticeRead(selectedItem.id, true);
    }
  }, [selectedItem?.id, readNoticeIds, toggleNoticeRead]);

  // Group notifications into Unread & Read Sections with muted headers
  const groupedSections = useMemo(() => {
    const unreadItems: NotificationItem[] = [];
    const readItems: NotificationItem[] = [];

    filteredItems.forEach(item => {
      if (!readNoticeIds.includes(item.id)) {
        unreadItems.push(item);
      } else {
        readItems.push(item);
      }
    });

    const sections: Array<{ key: string; label: string; isUnreadSection: boolean; items: NotificationItem[] }> = [];

    if (unreadItems.length > 0) {
      sections.push({
        key: "unread-section",
        label: "Unread Notifications",
        isUnreadSection: true,
        items: unreadItems
      });
    }

    if (readItems.length > 0) {
      sections.push({
        key: "read-section",
        label: "Read Notifications",
        isUnreadSection: false,
        items: readItems
      });
    }

    return sections;
  }, [filteredItems, readNoticeIds]);

  const unreadTotal = categoryUnreadCounts.ALL;

  const handleMarkAllRead = () => {
    const unreadIds = notificationItems.filter(i => !readNoticeIds.includes(i.id)).map(i => i.id);
    if (unreadIds.length > 0) {
      markAllNoticesRead(unreadIds);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Marked ${unreadIds.length} notification${unreadIds.length > 1 ? 's' : ''} as read`,
        timestamp: new Date().toISOString()
      });
    }
  };

  const formatTimeString = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "12:00";
    }
  };

  const formatDateFull = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ", " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] min-h-[600px] w-full bg-slate-50/70 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden text-slate-900 dark:text-slate-100 select-text">
      
      {/* Top Header & Category Tabs Navigation Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 md:px-6 py-3 shrink-0 flex flex-col gap-3">
        {/* Main Title & Utility Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-black text-sm shadow-sm shrink-0">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                  All Inbox
                </h1>
                {unreadTotal > 0 ? (
                  <span className="text-[10px] font-black font-mono bg-indigo-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    {unreadTotal} UNREAD
                  </span>
                ) : (
                  <span className="text-[10px] font-black font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                    <CheckCircle2 size={10} /> ALL READ
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 hidden xs:block">
                Real-time activity logs, approvals & financial directives
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Unread Only Toggle */}
            <button
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border select-none",
                showUnreadOnly
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-200/70"
              )}
              title="Toggle unread notifications filter"
            >
              <Filter size={13} />
              <span>Unread Only</span>
              {showUnreadOnly && (
                <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
              )}
            </button>

            {unreadTotal > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCircle2 size={14} />
                <span>Mark All Read ({unreadTotal})</span>
              </button>
            )}

            <button 
              onClick={() => {
                triggerToast({
                  type: "SYSTEM_INFO",
                  severity: "LOW",
                  message: "Inbox re-synchronized with user directory",
                  timestamp: new Date().toISOString()
                });
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Refresh Inbox"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <button
            onClick={() => setActiveTab("ALL")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "ALL" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <span>Primary</span>
            {categoryUnreadCounts.ALL > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-indigo-500 text-white">
                {categoryUnreadCounts.ALL}
              </span>
            ) : (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black",
                activeTab === "ALL" ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}>
                {notificationItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("REQUISITIONS")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "REQUISITIONS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <span>Requisitions</span>
            {categoryUnreadCounts.REQUISITIONS > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-indigo-500 text-white">
                {categoryUnreadCounts.REQUISITIONS}
              </span>
            ) : (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black",
                activeTab === "REQUISITIONS" ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}>
                {notificationItems.filter(i => i.category === "REQUISITIONS").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("APPROVALS")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "APPROVALS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <span>Approvals</span>
            {categoryUnreadCounts.APPROVALS > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-indigo-500 text-white">
                {categoryUnreadCounts.APPROVALS}
              </span>
            ) : (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black",
                activeTab === "APPROVALS" ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}>
                {notificationItems.filter(i => i.category === "APPROVALS").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("PAYOUTS")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "PAYOUTS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <span>Payouts</span>
            {categoryUnreadCounts.PAYOUTS > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-indigo-500 text-white">
                {categoryUnreadCounts.PAYOUTS}
              </span>
            ) : (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black",
                activeTab === "PAYOUTS" ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}>
                {notificationItems.filter(i => i.category === "PAYOUTS").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ALERTS")}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "ALERTS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <span>Updates & Alerts</span>
            {categoryUnreadCounts.ALERTS > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-indigo-500 text-white">
                {categoryUnreadCounts.ALERTS}
              </span>
            ) : (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black",
                activeTab === "ALERTS" ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              )}>
                {notificationItems.filter(i => i.category === "ALERTS").length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("STARRED")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "STARRED" 
                ? "bg-amber-500 text-white shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <Star size={13} className={cn(activeTab === "STARRED" ? "fill-white text-white" : "fill-amber-500 text-amber-500")} />
            <span>Starred</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black",
              activeTab === "STARRED" ? "bg-white/20 text-white" : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            )}>
              {starredNoticeIds.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ARCHIVED")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "ARCHIVED" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <Archive size={13} />
            <span>Archived</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black",
              activeTab === "ARCHIVED" ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900" : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            )}>
              {archivedNoticeIds.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("TRASH")}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "TRASH" 
                ? "bg-rose-600 text-white shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <Trash2 size={13} />
            <span>Trash</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black",
              activeTab === "TRASH" ? "bg-white/20 text-white" : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            )}>
              {deletedNoticeIds.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Notification Stream & Right Reading Pane */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Left Notification Stream Column */}
        <div className={cn(
          "w-full lg:w-[380px] xl:w-[420px] bg-slate-50/50 dark:bg-slate-950/60 border-r border-slate-200/80 dark:border-slate-800 flex flex-col shrink-0 h-full overflow-hidden transition-all duration-300",
          selectedItem ? "hidden lg:flex" : "flex"
        )}>
          {/* Search Box Header */}
          <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs">
            <div className="relative flex items-center">
              <Search size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search from notifications..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-850 focus:border-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* ALL CAUGHT UP STATE BANNER */}
          {unreadTotal === 0 && notificationItems.length > 0 && (
            <div className="m-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center gap-3 text-emerald-900 dark:text-emerald-200 animate-in fade-in duration-300 shrink-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black tracking-tight leading-tight">You're All Caught Up!</p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium truncate mt-0.5">
                  All notifications in your directory have been read.
                </p>
              </div>
            </div>
          )}

          {/* Grouped Notification List Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 subtle-scrollbar">
            {groupedSections.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3 px-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                  {showUnreadOnly ? "All Caught Up!" : "No Notifications"}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                  {showUnreadOnly 
                    ? "You have read all unread notifications in this section."
                    : "All member logs and requisitions are up to date."
                  }
                </p>
                {showUnreadOnly && (
                  <button
                    onClick={() => setShowUnreadOnly(false)}
                    className="px-3.5 py-1.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs"
                  >
                    View All Notifications
                  </button>
                )}
              </div>
            ) : (
              groupedSections.map(section => {
                const isCollapsed = collapsedSections.has(section.key);

                return (
                  <div key={section.key} className="space-y-2">
                    {/* Muted Section Divider Label where Unread/Read notifications start */}
                    <div className="flex items-center gap-2 pt-3 pb-1.5 px-1 select-none">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {section.isUnreadSection ? (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 animate-pulse" />
                        ) : (
                          <CheckCircle2 size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        )}
                        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                          {section.label} ({section.items.length})
                        </span>
                      </div>
                      <div className="h-[1px] bg-slate-200/80 dark:bg-slate-800 flex-1" />
                      <button
                        type="button"
                        onClick={() => toggleSectionCollapse(section.key)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        title={isCollapsed ? "Expand section" : "Collapse section"}
                      >
                        <ChevronDown size={14} className={cn("transition-transform duration-200", isCollapsed && "-rotate-90")} />
                      </button>
                    </div>

                    {/* Section Cards List */}
                    {!isCollapsed && (
                      <div className="space-y-2">
                        {section.items.map(item => {
                          const isSelected = selectedItemId === item.id;
                          const isRead = readNoticeIds.includes(item.id);
                          const isStarred = starredNoticeIds.includes(item.id);
                          const isArchived = archivedNoticeIds.includes(item.id);
                          const isDeleted = deletedNoticeIds.includes(item.id);
                          const senderPhoto = getUserPhoto(item.senderEmail, item.senderName, item.requisition?.requesterId);

                          return (
                            <div
                              key={item.id}
                              onClick={() => setSelectedItemId(prev => prev === item.id ? null : item.id)}
                              className={cn(
                                "group relative p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex flex-col gap-2 shadow-xs",
                                isSelected 
                                  ? "bg-white dark:bg-slate-900 border-indigo-500/80 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-md" 
                                  : isRead
                                    ? "bg-white/80 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-300 opacity-90"
                                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800"
                              )}
                            >
                              {/* Header Row: User Directory Avatar, Sender Name, Muted Read/Unread Status Pill, Timestamp */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {/* User Directory Photo or Fallback Gradient */}
                                  <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 shadow-xs border border-slate-200/80 dark:border-slate-700">
                                    {senderPhoto ? (
                                      <img 
                                        src={senderPhoto} 
                                        alt={item.senderName} 
                                        className="w-full h-full object-cover rounded-full" 
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className={cn("w-full h-full rounded-full flex items-center justify-center text-white font-black text-[10px] uppercase", item.avatarGradient)}>
                                        {item.senderName.charAt(0)}
                                      </div>
                                    )}
                                  </div>

                                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {item.senderName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* Muted Read / Unread Status Badge */}
                                  <span className={cn(
                                    "text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider border select-none",
                                    !isRead 
                                      ? "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800" 
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-700/60"
                                  )}>
                                    {!isRead ? "Unread" : "Read"}
                                  </span>
                                  <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
                                    {formatTimeString(item.timestamp)}
                                  </span>
                                </div>
                              </div>

                              {/* Title / Subject */}
                              <h4 className={cn(
                                "text-xs leading-snug line-clamp-1 transition-colors",
                                !isRead ? "font-black text-slate-900 dark:text-slate-100" : "font-bold text-slate-700 dark:text-slate-300"
                              )}>
                                {item.title}
                              </h4>

                              {/* Snippet preview */}
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                                {item.snippet}
                              </p>

                              {/* Tags & Card Quick Action Buttons */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 mt-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.tags.slice(0, 2).map((tag, tIdx) => (
                                    <span key={tIdx} className="text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60 uppercase">
                                      {tag}
                                    </span>
                                  ))}
                                  {item.tags.length > 2 && (
                                    <span className="text-[9px] font-mono text-slate-400 font-bold">
                                      +{item.tags.length - 2}
                                    </span>
                                  )}
                                </div>

                                {/* Quick Action Icons Row */}
                                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => toggleStar(e, item.id)}
                                    className={cn(
                                      "p-1 rounded-md transition-colors cursor-pointer",
                                      isStarred ? "text-amber-500" : "text-slate-300 hover:text-amber-500"
                                    )}
                                    title={isStarred ? "Unstar notification" : "Star notification"}
                                  >
                                    <Star size={13} className={isStarred ? "fill-amber-500" : ""} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => archiveNotice(e, item.id)}
                                    className={cn(
                                      "p-1 rounded-md transition-colors cursor-pointer",
                                      isArchived ? "text-indigo-600 dark:text-indigo-400" : "text-slate-300 hover:text-slate-600 dark:hover:text-slate-200"
                                    )}
                                    title={isArchived ? "Restore from archive" : "Archive notification"}
                                  >
                                    {isArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteAlert(e, item.id, item.rawId)}
                                    className={cn(
                                      "p-1 rounded-md transition-colors cursor-pointer",
                                      isDeleted ? "text-indigo-600 dark:text-indigo-400" : "text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                                    )}
                                    title={isDeleted ? "Restore from trash" : "Delete notification"}
                                  >
                                    {isDeleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Notification Detail / Reading Pane */}
        <div className={cn(
          "flex-1 bg-white dark:bg-slate-900 flex-col h-full overflow-hidden transition-all duration-300",
          selectedItem ? "flex" : "hidden lg:flex"
        )}>
          {selectedItem ? (() => {
            const detailSenderPhoto = getUserPhoto(selectedItem.senderEmail, selectedItem.senderName, selectedItem.requisition?.requesterId);

            return (
              <div className="flex flex-col h-full overflow-hidden">
                
                {/* Reading Pane Top Action Toolbar */}
                <div className="px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-4 shrink-0">
                  
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedItemId(null)}
                    className="lg:hidden flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 px-2 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                    <span>Back to Inbox</span>
                  </button>

                  {/* Left Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDeleteAlert(e, selectedItem.id, selectedItem.rawId)}
                      className={cn(
                        "p-2 rounded-xl transition-colors cursor-pointer",
                        deletedNoticeIds.includes(selectedItem.id)
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
                          : "text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      )}
                      title={deletedNoticeIds.includes(selectedItem.id) ? "Restore from trash" : "Delete notification"}
                    >
                      {deletedNoticeIds.includes(selectedItem.id) ? <RotateCcw size={16} /> : <Trash2 size={16} />}
                    </button>

                    <button
                      onClick={(e) => archiveNotice(e, selectedItem.id)}
                      className={cn(
                        "p-2 rounded-xl transition-colors cursor-pointer",
                        archivedNoticeIds.includes(selectedItem.id)
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                      title={archivedNoticeIds.includes(selectedItem.id) ? "Restore from archive" : "Archive notification"}
                    >
                      {archivedNoticeIds.includes(selectedItem.id) ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>

                    <button
                      onClick={() => {
                        const isCurrentlyRead = readNoticeIds.includes(selectedItem.id);
                        if (isCurrentlyRead) {
                          toggleNoticeRead(selectedItem.id, false);
                          setSelectedItemId(null);
                          triggerToast({
                            type: "SYSTEM_INFO",
                            severity: "LOW",
                            message: "Marked as unread & notification closed",
                            timestamp: new Date().toISOString()
                          });
                        } else {
                          toggleNoticeRead(selectedItem.id, true);
                          triggerToast({
                            type: "SYSTEM_INFO",
                            severity: "LOW",
                            message: "Marked as read",
                            timestamp: new Date().toISOString()
                          });
                        }
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                      title={readNoticeIds.includes(selectedItem.id) ? "Mark as unread & close" : "Mark as read"}
                    >
                      {readNoticeIds.includes(selectedItem.id) ? <Mail size={16} /> : <MailOpen size={16} />}
                    </button>

                    <button
                      onClick={(e) => toggleStar(e, selectedItem.id)}
                      className={cn(
                        "p-2 rounded-xl transition-colors cursor-pointer",
                        starredNoticeIds.includes(selectedItem.id) ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40" : "text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                      title={starredNoticeIds.includes(selectedItem.id) ? "Unstar" : "Star notification"}
                    >
                      <Star size={16} className={starredNoticeIds.includes(selectedItem.id) ? "fill-amber-500" : ""} />
                    </button>
                  </div>

                  {/* Right Action Icons */}
                  <div className="flex items-center gap-1.5">
                    {selectedItem.requisition && (
                      <button
                        onClick={() => onSelectRequisition(selectedItem.requisition!)}
                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                      >
                        <Eye size={14} />
                        <span>Open Requisition</span>
                      </button>
                    )}

                    <button 
                      onClick={() => {
                        triggerToast({
                          type: "SYSTEM_INFO",
                          severity: "LOW",
                          message: "Notification details copied to clipboard",
                          timestamp: new Date().toISOString()
                        });
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy info"
                    >
                      <ExternalLink size={16} />
                    </button>

                    <button 
                      onClick={() => setSelectedItemId(null)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Deselect notification"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Notification Full Content Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 subtle-scrollbar">
                  
                  {/* Header Information with User Directory Profile Photo */}
                  <div className="space-y-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="relative w-11 h-11 rounded-full overflow-hidden shrink-0 shadow-xs border border-slate-200 dark:border-slate-700">
                          {detailSenderPhoto ? (
                            <img 
                              src={detailSenderPhoto} 
                              alt={selectedItem.senderName} 
                              className="w-full h-full object-cover rounded-full" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className={cn("w-full h-full rounded-full flex items-center justify-center text-white font-black text-sm uppercase shadow-sm", selectedItem.avatarGradient)}>
                              {selectedItem.senderName.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100">
                            {selectedItem.senderName}
                          </h3>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {selectedItem.senderEmail}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 block">
                          {formatDateFull(selectedItem.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Main Notification Title Heading */}
                    <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                      {selectedItem.title}
                    </h2>

                    {/* To / Cc Recipients Pill Chips */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-400 font-bold">To:</span>
                        <span className="font-bold">{currentUser?.email || "treasury@pceastandrews.org"}</span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-400 font-bold">Cc:</span>
                        <span className="font-bold">audit@pceastandrews.org</span>
                      </div>
                    </div>
                  </div>

                  {/* Message Body Content */}
                  <div className="space-y-5 text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Dear {currentUser?.name || "Member"},
                    </p>

                    <p className="text-slate-700 dark:text-slate-300">
                      {selectedItem.message}
                    </p>

                    {/* Embedded Interactive Callout Banner / Action Card */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 my-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-mono">
                            System Directive Action
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {selectedItem.title}
                          </h4>
                        </div>

                        {selectedItem.requisition && (
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Total Request Value</span>
                            <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">
                              KES {selectedItem.requisition.amount.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-3 border-t border-slate-200/60 dark:border-slate-800 pt-3">
                        {successId === selectedItem.id ? (
                          <span className="px-4 py-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> Action Completed
                          </span>
                        ) : (
                          <button
                            onClick={async () => {
                              await selectedItem.action();
                            }}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                          >
                            <span>{selectedItem.actionLabel}</span>
                            <ArrowRight size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Summary / Requisition Breakdown Details */}
                    {selectedItem.requisition && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest font-mono">
                          Requisition Overview Summary:
                        </h4>
                        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span><strong>Requisition ID:</strong> #{selectedItem.requisition.id}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span><strong>Ministry / Group:</strong> {selectedItem.requisition.groupName}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span><strong>Submitted By:</strong> {selectedItem.requisition.requesterName}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span><strong>Current Lifecycle Status:</strong> {selectedItem.requisition.status}</span>
                          </li>
                        </ul>
                      </div>
                    )}

                    <p className="text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-800">
                      This notification is generated automatically by the St. Andrew's PCEA eRequisitions Portal.
                    </p>
                  </div>

                  {/* File Attachments Section */}
                  {selectedItem.attachments && selectedItem.attachments.length > 0 && (
                    <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                        <Paperclip size={14} />
                        <span>Attached File Documents ({selectedItem.attachments.length})</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {selectedItem.attachments.map((file, fIdx) => (
                          <div
                            key={fIdx}
                            onClick={() => {
                              if (selectedItem.requisition) {
                                onSelectRequisition(selectedItem.requisition);
                              }
                            }}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all cursor-pointer flex items-center gap-3 group"
                          >
                            <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 transition-colors">
                                {file.name}
                              </p>
                              <span className="text-[10px] font-mono text-slate-400 block">
                                {file.size}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-900 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1 shadow-xs border border-indigo-100 dark:border-indigo-900/50">
                <Bell size={32} />
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider font-mono">
                No Notification Selected
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                Select a notification from the list on the left to preview its contents, attached documents, and approval audit trail.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationHub;
