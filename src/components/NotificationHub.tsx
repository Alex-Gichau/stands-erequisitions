/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
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
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NotificationHubProps {
  onSelectRequisition: (req: Requisition) => void;
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
    triggerToast,
    deleteAlert
  } = useRequisitions();

  const [filterType, setFilterType] = useState<"ALL" | "ACTIONS" | "ALERTS">("ALL");
  const [successId, setSuccessId] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  const handleDeleteAlert = async (e: React.MouseEvent, itemId: string, rawId?: string) => {
    e.stopPropagation();
    if (!rawId) {
      // For derived items, we just mark as read if they can't be "deleted" from source
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

  const seenRequisitionsRef = React.useRef<Set<string>>(new Set());
  const isFirstMountRef = React.useRef(true);

  React.useEffect(() => {
    if (isFirstMountRef.current) {
      // Mark all existing requisitions as seen on mount
      requisitions.forEach(r => seenRequisitionsRef.current.add(r.id));
      isFirstMountRef.current = false;
      return;
    }

    // Check for newly added requisitions
    requisitions.forEach(r => {
      if (!seenRequisitionsRef.current.has(r.id)) {
        seenRequisitionsRef.current.add(r.id);

        // Only trigger toast if the requisition is SUBMITTED and is not a mock seed
        if (r.status === RequisitionStatus.SUBMITTED && !r.id.includes("req-seed-")) {
          const isUserAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
          
          const toastMessage = isUserAdmin
            ? `New Requisition: "${r.title}" for KES ${r.amount.toLocaleString()} submitted by ${r.requesterName}`
            : `New Requisition Submitted: "${r.title}"`;

          triggerToast({
            type: "LARGE_REQUEST",
            severity: "LOW", // LOW severity triggers 3s quick-dismiss
            message: toastMessage,
            timestamp: new Date().toISOString()
          });
        }
      }
    });
  }, [requisitions, currentUser, triggerToast]);

  // Re-compile notice list dynamically to match bell notifications
  const notificationItems = React.useMemo(() => {
    const items: Array<{
      id: string;
      rawId?: string;
      type: "MEMBER_APPROVAL" | "REQ_RECEIVED" | "REQ_APPROVED" | "FINANCE_DISBURSEMENT_REQUIRED" | "BUDGET_ALERT";
      title: string;
      message: string;
      actionLabel: string;
      timestamp: string;
      requisition?: Requisition;
      action: () => Promise<void> | void;
    }> = [];

    const now = new Date().toISOString();

    // 1. Members awaiting approval (only for ADMIN/SUPER_ADMIN)
    if (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) {
      users.filter(u => !u.isApproved).forEach(u => {
        items.push({
          id: `user-await-${u.id}`,
          type: "MEMBER_APPROVAL",
          title: "User Pending Authorization",
          message: `${u.name} (${u.email}) requested account activation as ${u.role}.`,
          actionLabel: "Authorize Account",
          timestamp: now,
          action: async () => {
            await approveUser(u.id);
            setSuccessId(`user-await-${u.id}`);
            setTimeout(() => setSuccessId(null), 3000);
          }
        });
      });

      // 2. New requisitions received (status === SUBMITTED)
      requisitions.filter(r => r.status === RequisitionStatus.SUBMITTED && !r.id.includes("req-seed-")).forEach(r => {
        items.push({
          id: `req-sub-${r.id}`,
          type: "REQ_RECEIVED",
          title: "Decision Required",
          message: `Requisition "${r.title}" (${r.groupName}) for KES ${r.amount.toLocaleString()} is pending verification.`,
          actionLabel: "Verify Requisition",
          timestamp: r.submittedAt,
          requisition: r,
          action: () => {
            onSelectRequisition(r);
          }
        });
      });
    }

    // 3. New approvals done
    requisitions.filter(r => (r.status === RequisitionStatus.APPROVED_L1 || r.status === RequisitionStatus.APPROVED_L2) && !r.id.includes("req-seed-")).forEach(r => {
      items.push({
        id: `req-app-${r.id}`,
        type: "REQ_APPROVED",
        title: "Requisition Approved",
        message: `"${r.title}" has been authorized to ${r.status.replace("_", " ")} for KES ${r.amount.toLocaleString()}.`,
        actionLabel: "Inspect Details",
        timestamp: r.approvedAtL2 || r.approvedAtL1 || now,
        requisition: r,
        action: () => {
          onSelectRequisition(r);
        }
      });
    });

    // 3.5. Disbursements needed (specifically for FINANCE, ADMIN, and SUPER_ADMIN roles)
    if (currentUser?.role === UserRole.FINANCE || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) {
      requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2 && !r.id.includes("req-seed-")).forEach(r => {
        items.push({
          id: `finance-disb-req-${r.id}`,
          type: "FINANCE_DISBURSEMENT_REQUIRED",
          title: "Payout Directives",
          message: `Requisition "${r.title}" (${r.groupName}) is L2 APPROVED and ready for immediate payout of KES ${r.amount.toLocaleString()}.`,
          actionLabel: "Execute Payout",
          timestamp: r.approvedAtL2 || now,
          requisition: r,
          action: () => {
            onSelectRequisition(r);
          }
        });
      });
    }

    // Include budget alerts that target this user's role or specifically mention them by targetUserId
    alerts.filter(a => {
      if (a.isRead) return false;
      if (a.targetUserId) {
        return currentUser?.id === a.targetUserId;
      }
      if (a.targetRole && currentUser?.role !== a.targetRole && currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.SUPER_ADMIN) return false;
      return true;
    }).forEach(a => {
      // Find matching requisition if possible
      const cleanText = a.message.toLowerCase();
      const associatedReq = requisitions.find(r => 
        (r.id && cleanText.includes(r.id.toLowerCase())) || 
        (r.title && cleanText.includes(r.title.toLowerCase()))
      );

      items.push({
        id: `budget-alert-${a.id}`,
        rawId: a.id,
        type: "BUDGET_ALERT",
        title: a.type === "OVERSHOOT" ? "Budget Overshoot Trigger" : "System Notification",
        message: a.message,
        actionLabel: associatedReq ? "Inspect Requisition" : "Dismiss Alert",
        timestamp: a.timestamp,
        requisition: associatedReq,
        action: () => {
          if (associatedReq) {
            onSelectRequisition(associatedReq);
          }
        }
      });
    });

    // Sort by timestamp if dynamic (descending)
    return items;
  }, [requisitions, users, alerts, currentUser, onSelectRequisition, approveUser]);

  const filteredItems = React.useMemo(() => {
    let baseList = notificationItems;
    if (filterType === "ACTIONS") {
      baseList = notificationItems.filter(item => item.type !== "BUDGET_ALERT");
    } else if (filterType === "ALERTS") {
      baseList = notificationItems.filter(item => item.type === "BUDGET_ALERT");
    }

    return [...baseList].sort((a, b) => {
      const aRead = readNoticeIds.includes(a.id);
      const bRead = readNoticeIds.includes(b.id);
      if (aRead && !bRead) return -1;
      if (!aRead && bRead) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [notificationItems, filterType, readNoticeIds]);

  const unreadCount = React.useMemo(() => {
    return notificationItems.filter(item => !readNoticeIds.includes(item.id)).length;
  }, [notificationItems, readNoticeIds]);

  const handleMarkAllRead = () => {
    const unreadIds = notificationItems
      .filter(item => !readNoticeIds.includes(item.id))
      .map(item => item.id);
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

  const getNoticeStyling = (type: string) => {
    switch (type) {
      case "MEMBER_APPROVAL":
        return {
          icon: UserCheck,
          accentBg: "bg-amber-50 border-amber-200",
          iconBg: "bg-amber-100 text-amber-700",
          pill: "bg-amber-50 text-amber-700 border-amber-200"
        };
      case "REQ_RECEIVED":
        return {
          icon: FilePlus,
          accentBg: "bg-indigo-50 border-indigo-200",
          iconBg: "bg-indigo-100 text-indigo-700",
          pill: "bg-indigo-50 text-indigo-700 border-indigo-200"
        };
      case "REQ_APPROVED":
        return {
          icon: FileCheck,
          accentBg: "bg-emerald-50 border-emerald-200",
          iconBg: "bg-emerald-100 text-emerald-700",
          pill: "bg-emerald-50 text-emerald-700 border-emerald-200"
        };
      case "FINANCE_DISBURSEMENT_REQUIRED":
        return {
          icon: DollarSign,
          accentBg: "bg-blue-50 border-blue-200",
          iconBg: "bg-blue-100 text-blue-700",
          pill: "bg-blue-50 text-blue-700 border-blue-200"
        };
      default:
        return {
          icon: AlertTriangle,
          accentBg: "bg-slate-50 border-slate-200",
          iconBg: "bg-slate-100 text-slate-700",
          pill: "bg-slate-100 text-slate-700 border-slate-200"
        };
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Notification Hub</h2>
          <p className="text-sm text-slate-500">All your notifications with action buttons updated here.</p>
        </div>
        
        {/* Statistics, Mark All as Read, or Status bar */}
        <div className="flex flex-wrap items-center gap-3">
          {unreadCount > 0 && (
            <button 
              type="button"
              onClick={handleMarkAllRead}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer hover:shadow-indigo-100"
            >
              <CheckCircle2 size={14} />
              <span>Mark All as Read ({unreadCount})</span>
            </button>
          )}

          <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setFilterType("ALL")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer",
                filterType === "ALL" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              All Logs ({notificationItems.length})
            </button>
            <button 
              onClick={() => setFilterType("ACTIONS")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer",
                filterType === "ACTIONS" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Actions ({notificationItems.filter(i => i.type !== "BUDGET_ALERT").length})
            </button>
            <button 
              onClick={() => setFilterType("ALERTS")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer",
                filterType === "ALERTS" ? "bg-amber-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Alerts ({notificationItems.filter(i => i.type === "BUDGET_ALERT").length})
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredItems.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, nIdx) => {
              const style = getNoticeStyling(item.type);
              const IconComp = style.icon;
              const hasRequisition = !!item.requisition;

              const isRead = readNoticeIds.includes(item.id);

              return (
                <motion.div 
                  key={`notice-hub-${item.id || nIdx}-${nIdx}`}
                  layoutId={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => {
                    // Mark as read automatically when clicked
                    toggleNoticeRead(item.id, true);
                    if (hasRequisition && item.requisition) {
                      onSelectRequisition(item.requisition);
                    }
                  }}
                  className={cn(
                    "rounded-2xl border p-4 md:p-6 transition-all duration-300 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 md:gap-6 relative group",
                    isRead 
                      ? "bg-slate-50 border-slate-200/70 opacity-75 hover:opacity-100 hover:bg-slate-100/80 hover:border-slate-300" 
                      : "bg-white border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5",
                    hasRequisition ? "cursor-pointer" : ""
                  )}
                >
                  <div className="flex items-start gap-3 md:gap-4 flex-1">
                    <div className={cn("p-2.5 md:p-3 rounded-xl shrink-0 shadow-inner", style.iconBg)}>
                      <IconComp size={18} />
                    </div>
                    <div className="space-y-1.5 max-w-2xl flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-[8px] md:text-[8.5px] font-black uppercase tracking-widest border px-2 py-0.5 rounded-full font-mono", style.pill)}>
                          {item.title}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                          <Calendar size={10} />
                          {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>

                        {/* Interactive Status Badge to mark as read/unread manually */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNoticeRead(item.id);
                          }}
                          className={cn(
                            "inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none cursor-pointer transition-all border",
                            isRead 
                              ? "text-emerald-700 bg-emerald-50 border-emerald-100 hover:bg-emerald-100" 
                              : "text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100 animate-pulse"
                          )}
                        >
                          {isRead ? (
                            <>
                              <Check size={9} /> Read
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block"></span> Unread
                            </>
                          )}
                        </button>
                      </div>
                      <p className={cn(
                        "font-bold text-xs md:text-[13px] leading-snug group-hover:text-indigo-950 transition-colors break-words",
                        isRead ? "text-slate-500 font-medium" : "text-slate-800"
                      )}>
                        {item.message}
                      </p>
                      {hasRequisition && item.requisition && (
                        <div className="inline-flex flex-wrap items-center gap-1.5 bg-slate-50 select-none border border-slate-100 rounded-lg px-2 p-1 text-[9px] md:text-[10px] text-slate-500 font-mono font-bold">
                          <span>VALUE: KES {item.requisition.amount.toLocaleString()}</span>
                          <span className="text-slate-300">•</span>
                          <span>GROUP: {item.requisition.groupName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center gap-2 overflow-hidden shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 w-full md:w-auto">
                    <div className="flex items-center gap-2 w-full md:w-auto overflow-hidden">
                      {/* Compact Mark as Read toggle button for mobile/desktop layout symmetry */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNoticeRead(item.id);
                        }}
                        className="flex-1 md:w-24 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase rounded-lg transition-colors border border-slate-200"
                      >
                        {isRead ? "Unread" : "Read"}
                      </button>

                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAlert(e, item.id, item.rawId)}
                          className="p-2 bg-rose-50 text-rose-500 border border-rose-100 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                          title="Delete notification permanentely"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {successId === item.id ? (
                      <span className="flex-1 md:w-full inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-4 py-2.5 rounded-xl text-[10px] md:text-xs font-bold uppercase justify-center">
                        <CheckCircle2 size={12} /> Success
                      </span>
                    ) : (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          toggleNoticeRead(item.id, true); // auto mark read on action click
                          await item.action();
                        }}
                        className={cn(
                          "flex-1 md:w-auto px-4 md:px-5 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer border shadow-sm",
                          hasRequisition 
                            ? "bg-slate-50 hover:bg-indigo-600 border-slate-200 text-slate-700 hover:text-white" 
                            : "bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white hover:border-indigo-600 hover:shadow-indigo-100"
                        )}
                      >
                        <span className="truncate">{item.actionLabel}</span>
                        <ArrowRight size={12} className="shrink-0" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        ) : (
          <div className="py-24 text-center bg-white border border-slate-200 rounded-3xl border-dashed">
            <Bell size={48} className="mx-auto text-slate-300 opacity-50 mb-3" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Inbox Clear</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">No active logs require system attention.</p>
          </div>
        )}
      </div>
    </div>
  );
};
