/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition, Comment } from "../types";
import { formatCurrency, cn, resolveSenderName } from "../lib/utils";
import { 
  Bell, 
  MessageSquare, 
  Smile, 
  ThumbsUp, 
  CheckCircle2, 
  ShieldCheck, 
  FilePlus, 
  Users, 
  KeyRound, 
  LogIn, 
  UserCog, 
  Search, 
  X, 
  Star, 
  Archive, 
  Trash2, 
  RotateCcw, 
  ArchiveRestore, 
  Mail, 
  MailOpen, 
  Filter, 
  Clock, 
  ExternalLink, 
  ChevronDown, 
  ChevronLeft, 
  ArrowRight, 
  Eye, 
  Paperclip, 
  FileText, 
  RefreshCw, 
  Laptop, 
  Globe, 
  Building2, 
  Sparkles, 
  Heart,
  CheckCircle,
  UserCheck,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserAvatar } from "./UserAvatar";
import { 
  isDesktopNotificationSupported, 
  getDesktopNotificationPermission, 
  requestDesktopNotificationPermission, 
  isDesktopNotificationEnabled, 
  setDesktopNotificationEnabled,
  sendDesktopNotification,
  DesktopNotificationPermission
} from "../lib/desktopNotifications";

interface NotificationHubProps {
  onSelectRequisition: (req: Requisition) => void;
}

export type NotificationHubCategory = 
  | "ALL"
  | "COMMENTS"
  | "REACTIONS"
  | "APPROVALS"
  | "SUBMISSIONS"
  | "GROUPS"
  | "SECURITY"
  | "STARRED"
  | "ARCHIVED"
  | "TRASH";

export interface NotificationItem {
  id: string;
  rawId?: string;
  type: 
    | "COMMENT" 
    | "REACTION" 
    | "APPROVAL" 
    | "SUBMISSION" 
    | "GROUP_ADDITION" 
    | "ACCOUNT_UPDATE" 
    | "NEW_LOGIN";
  category: "COMMENTS" | "REACTIONS" | "APPROVALS" | "SUBMISSIONS" | "GROUPS" | "SECURITY";
  senderName: string;
  senderEmail: string;
  senderRole?: string;
  avatarGradient: string;
  icon: React.ReactNode;
  badgeColor: string;
  badgeLabel: string;
  title: string;
  message: string;
  snippet: string;
  actionLabel: string;
  timestamp: string;
  tags: string[];
  attachments?: Array<{ name: string; size: string; type: string }>;
  requisition?: Requisition;
  action: () => Promise<void> | void;
  metadata?: Record<string, any>;
}

// Check RBAC access for a requisition
function canUserAccessRequisition(req: Requisition, currentUser: any): boolean {
  if (!currentUser) return false;
  const role = currentUser.role;

  // Admins, Super Admins, and Finance see all requisitions
  if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN || role === UserRole.FINANCE) {
    return true;
  }

  const filterGroups = currentUser.groups || [];
  const userGroups = filterGroups.length > 0 ? filterGroups : (currentUser.group ? [currentUser.group] : []);
  const userEmail = (currentUser.email || "").toLowerCase().trim();
  const userId = currentUser.id;

  // Group match
  if (req.groupId && userGroups.includes(req.groupId)) return true;
  if (req.groupName && userGroups.includes(req.groupName)) return true;
  if (Array.isArray(req.sharedGroups) && req.sharedGroups.some((sg: string) => userGroups.includes(sg))) return true;

  // Creator/Requester match
  if (req.requesterId === userId || req.createdBy === userId) return true;
  if (req.requesterEmail && req.requesterEmail.toLowerCase().trim() === userEmail) return true;

  // Notification emails
  if (Array.isArray(req.notificationEmails) && req.notificationEmails.some((e: string) => e.toLowerCase().trim() === userEmail)) return true;

  // Comment author match
  if (Array.isArray(req.comments)) {
    for (const c of req.comments) {
      if (!c) continue;
      if (c.authorId === userId || (c.authorEmail && c.authorEmail.toLowerCase().trim() === userEmail)) return true;
      if (Array.isArray(c.replies)) {
        for (const rep of c.replies) {
          if (!rep) continue;
          if (rep.authorId === userId || (rep.authorEmail && rep.authorEmail.toLowerCase().trim() === userEmail)) return true;
        }
      }
    }
  }

  // Approvers with no group restriction can see all
  if ((role === UserRole.APPROVER_L1 || role === UserRole.APPROVER_L2) && userGroups.length === 0) {
    return true;
  }

  return false;
}

export const NotificationHub: React.FC<NotificationHubProps> = ({ onSelectRequisition }) => {
  const { 
    currentUser, 
    users, 
    requisitions, 
    systemLogs,
    alerts,
    approveUser,
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

  const [activeTab, setActiveTab] = useState<NotificationHubCategory>("ALL");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showOlderNotifications, setShowOlderNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [successId, setSuccessId] = useState<string | null>(null);

  // Desktop Browser Notification States
  const [desktopPermission, setDesktopPermission] = useState<DesktopNotificationPermission>(() => getDesktopNotificationPermission());
  const [desktopEnabled, setDesktopEnabled] = useState<boolean>(() => isDesktopNotificationEnabled());
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  useEffect(() => {
    setDesktopPermission(getDesktopNotificationPermission());
    setDesktopEnabled(isDesktopNotificationEnabled());
  }, []);

  const handleRequestDesktopPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const res = await requestDesktopNotificationPermission();
      setDesktopPermission(res);
      const isGranted = res === "granted";
      setDesktopEnabled(isGranted);
      if (isGranted) {
        setDesktopNotificationEnabled(true);
        sendDesktopNotification({
          title: "🔔 Desktop Notifications Activated",
          body: "You will now receive native desktop browser alerts for approvals, comments, and requisitions.",
          playSound: true,
          soundType: "success"
        });
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "LOW",
          message: "Desktop notifications enabled successfully!",
          timestamp: new Date().toISOString()
        });
      } else if (res === "denied") {
        triggerToast({
          type: "SECURITY_UPDATE",
          severity: "HIGH",
          message: "Desktop notifications were blocked in your browser settings. Please enable them in site permissions.",
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleToggleDesktopNotifications = (enable: boolean) => {
    setDesktopNotificationEnabled(enable);
    setDesktopEnabled(enable);
    if (enable && desktopPermission === "default") {
      handleRequestDesktopPermission();
    } else {
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: enable ? "Desktop browser alerts active" : "Desktop browser alerts paused",
        timestamp: new Date().toISOString()
      });
    }
  };

  // Listen for navigation button clicks to reset to home section of notifications
  useEffect(() => {
    const handleResetHome = () => {
      setSelectedItemId(null);
      setActiveTab("ALL");
      setShowUnreadOnly(false);
      setSearchQuery("");
      setShowOlderNotifications(false);
    };
    window.addEventListener("reset_notifications_home", handleResetHome);
    return () => window.removeEventListener("reset_notifications_home", handleResetHome);
  }, []);

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

  const handleDeleteNotification = (e: React.MouseEvent, itemId: string, rawId?: string) => {
    e.stopPropagation();
    toggleNoticeDeleted(itemId);
    if (rawId) {
      deleteAlert(rawId).catch(() => {});
    }
    triggerToast({
      type: "SYSTEM_INFO",
      severity: "LOW",
      message: deletedNoticeIds.includes(itemId) ? "Notification restored from Trash" : "Notification moved to Trash",
      timestamp: new Date().toISOString()
    });
  };

  // Compile Strictly Optimized Notification Items Stream:
  // 1. Comments
  // 2. Reactions
  // 3. Approvals
  // 4. Submissions
  // 5. Users added to groups
  // 6. Account details changes like password updates
  // 7. New login detected
  const notificationItems = useMemo(() => {
    const items: NotificationItem[] = [];
    const now = new Date().toISOString();

    const accessibleReqs = (requisitions || []).filter(r => canUserAccessRequisition(r, currentUser));

    // ==========================================
    // 1. COMMENTS (Discussions & Replies)
    // ==========================================
    accessibleReqs.forEach(r => {
      if (!r.comments || !Array.isArray(r.comments)) return;

      r.comments.forEach((c: any, cIdx: number) => {
        if (!c || !c.text) return;
        const commentId = c.id || `comment-${r.id}-${cIdx}`;
        const authorName = c.authorName || (c.authorEmail ? c.authorEmail.split("@")[0] : "Team Member");
        const authorEmail = c.authorEmail || "accounts@pceastandrews.org";
        const commentDate = c.createdAt || c.timestamp || r.updatedAt || now;

        items.push({
          id: `notif-comment-${r.id}-${commentId}`,
          type: "COMMENT",
          category: "COMMENTS",
          senderName: authorName,
          senderEmail: authorEmail,
          senderRole: c.authorRole || "Member",
          avatarGradient: "bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500",
          icon: <MessageSquare size={14} className="text-sky-500" />,
          badgeColor: "bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60",
          badgeLabel: "Comment",
          title: `Discussion comment on "${r.title || "Requisition"}"`,
          message: `${authorName} commented on requisition "${r.title}":\n\n"${c.text}"`,
          snippet: `"${c.text.length > 90 ? c.text.slice(0, 90) + '...' : c.text}"`,
          actionLabel: "View Discussion & Reply",
          timestamp: commentDate,
          tags: ["#COMMENT", `#${r.groupName || "Ministry"}`, `KES ${r.amount?.toLocaleString() || 0}`],
          requisition: r,
          action: () => {
            onSelectRequisition(r);
          }
        });

        // Nested Replies
        if (Array.isArray(c.replies)) {
          c.replies.forEach((rep: any, repIdx: number) => {
            if (!rep || !rep.text) return;
            const replyId = rep.id || `reply-${commentId}-${repIdx}`;
            const repAuthor = rep.authorName || (rep.authorEmail ? rep.authorEmail.split("@")[0] : "Contributor");
            const repEmail = rep.authorEmail || "accounts@pceastandrews.org";
            const replyDate = rep.createdAt || rep.timestamp || commentDate;

            items.push({
              id: `notif-reply-${r.id}-${replyId}`,
              type: "COMMENT",
              category: "COMMENTS",
              senderName: repAuthor,
              senderEmail: repEmail,
              senderRole: rep.authorRole || "Member",
              avatarGradient: "bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-500",
              icon: <MessageSquare size={14} className="text-blue-500" />,
              badgeColor: "bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60",
              badgeLabel: "Reply",
              title: `Reply to discussion on "${r.title || "Requisition"}"`,
              message: `${repAuthor} replied to a comment on requisition "${r.title}":\n\n"${rep.text}"`,
              snippet: `↳ "${rep.text.length > 90 ? rep.text.slice(0, 90) + '...' : rep.text}"`,
              actionLabel: "View Discussion & Reply",
              timestamp: replyDate,
              tags: ["#REPLY", `#${r.groupName || "Ministry"}`],
              requisition: r,
              action: () => {
                onSelectRequisition(r);
              }
            });
          });
        }

        // ==========================================
        // 2. REACTIONS (Emoji High-fives & Reactions)
        // ==========================================
        const reactionsArr = Array.isArray(c.reactions) 
          ? c.reactions 
          : (c.reactions ? Object.values(c.reactions) : []);

        reactionsArr.forEach((rx: any, rxIdx: number) => {
          if (!rx || !rx.emoji) return;
          const rxUser = rx.userName || (rx.userEmail ? rx.userEmail.split("@")[0] : "Team Member");
          const rxEmail = rx.userEmail || "";
          const rxDate = rx.createdAt || commentDate;
          const emoji = rx.emoji;

          items.push({
            id: `notif-rx-${r.id}-${commentId}-${rx.userId || rxEmail || rxIdx}-${emoji}`,
            type: "REACTION",
            category: "REACTIONS",
            senderName: rxUser,
            senderEmail: rxEmail,
            avatarGradient: "bg-gradient-to-tr from-amber-400 via-rose-500 to-pink-500",
            icon: <Smile size={14} className="text-amber-500" />,
            badgeColor: "bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60",
            badgeLabel: `${emoji} Reaction`,
            title: `Reaction ${emoji} on "${r.title || "Requisition"}"`,
            message: `${rxUser} reacted with ${emoji} to comment "${c.text.slice(0, 80)}" on requisition "${r.title}".`,
            snippet: `${emoji} Reacted to: "${c.text.length > 75 ? c.text.slice(0, 75) + '...' : c.text}"`,
            actionLabel: "Inspect Reaction",
            timestamp: rxDate,
            tags: ["#REACTION", emoji, `#${r.groupName || "Ministry"}`],
            requisition: r,
            action: () => {
              onSelectRequisition(r);
            }
          });
        });
      });
    });

    // ==========================================
    // 3. APPROVALS (L1, L2, Member Authorizations)
    // ==========================================
    // Requisition Approvals
    accessibleReqs.forEach(r => {
      if (r.id.includes("req-seed-")) return;

      const atts = Array.isArray(r.attachments) ? r.attachments.map((att, idx) => ({
        name: typeof att === "string" ? att.split("/").pop() || `Document-${idx+1}.pdf` : `Attachment-${idx+1}.pdf`,
        size: "280 KB",
        type: "application/pdf"
      })) : [];

      if (Array.isArray(r.approvalHistory) && r.approvalHistory.length > 0) {
        r.approvalHistory.forEach((note, noteIdx) => {
          if (!note) return;
          const approver = note.approverName || "Treasury Approver";
          const approverEmail = (note as any).approverEmail || "treasury@pceastandrews.org";
          const appDate = note.timestamp || (note as any).approvedAt || r.approvedAtL2 || r.approvedAtL1 || r.updatedAt || now;
          const levelName = (note as any).level || (note.role ? note.role.replace("_", " ") : r.status.replace("_", " "));

          items.push({
            id: `notif-app-note-${r.id}-${note.id || noteIdx}`,
            type: "APPROVAL",
            category: "APPROVALS",
            senderName: approver,
            senderEmail: approverEmail,
            senderRole: "Approver",
            avatarGradient: "bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500",
            icon: <CheckCircle2 size={14} className="text-emerald-500" />,
            badgeColor: "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60",
            badgeLabel: "Approved",
            title: `Requisition Approved (${levelName}): "${r.title || "Untitled"}"`,
            message: `Requisition "${r.title}" (${r.groupName}) for KES ${r.amount.toLocaleString()} has been approved by ${approver}.${note.note ? `\n\nApprover Notes: "${note.note}"` : ''}`,
            snippet: `✓ Approved by ${approver} for KES ${r.amount.toLocaleString()}`,
            actionLabel: "Inspect Approved Requisition",
            timestamp: appDate,
            tags: ["#APPROVED", `#${levelName}`, `KES ${r.amount.toLocaleString()}`],
            attachments: atts,
            requisition: r,
            action: () => {
              onSelectRequisition(r);
            }
          });
        });
      } else if (r.status === RequisitionStatus.APPROVED_L1 || r.status === RequisitionStatus.APPROVED_L2 || r.status === RequisitionStatus.DISBURSED) {
        const appDate = r.approvedAtL2 || r.approvedAtL1 || r.disbursedAt || r.updatedAt || now;
        items.push({
          id: `notif-app-status-${r.id}`,
          type: "APPROVAL",
          category: "APPROVALS",
          senderName: "Church Treasury & Governance",
          senderEmail: "treasury@pceastandrews.org",
          senderRole: "Approver",
          avatarGradient: "bg-gradient-to-tr from-emerald-400 via-teal-500 to-cyan-500",
          icon: <ShieldCheck size={14} className="text-teal-500" />,
          badgeColor: "bg-teal-50 dark:bg-teal-950/80 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60",
          badgeLabel: r.status.replace("_", " "),
          title: `Requisition Authorized: "${r.title || "Untitled"}"`,
          message: `Requisition "${r.title}" (${r.groupName}) for KES ${r.amount.toLocaleString()} has successfully reached status ${r.status.replace("_", " ")}.`,
          snippet: `Status updated to ${r.status.replace("_", " ")} for KES ${r.amount.toLocaleString()}`,
          actionLabel: "Inspect Requisition",
          timestamp: appDate,
          tags: ["#APPROVED", `#${r.status}`, `KES ${r.amount.toLocaleString()}`],
          attachments: atts,
          requisition: r,
          action: () => {
            onSelectRequisition(r);
          }
        });
      }
    });

    // Member Authorizations (for ADMIN / SUPER_ADMIN)
    if (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) {
      users.filter(u => !u.isApproved).forEach(u => {
        items.push({
          id: `notif-user-await-${u.id}`,
          type: "APPROVAL",
          category: "APPROVALS",
          senderName: u.name || "New Registration",
          senderEmail: u.email || "accounts@pceastandrews.org",
          senderRole: u.role || "Member",
          avatarGradient: "bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-500",
          icon: <UserCheck size={14} className="text-orange-500" />,
          badgeColor: "bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60",
          badgeLabel: "Authorization Required",
          title: `Member Pending Approval: ${u.name || u.email}`,
          message: `${u.name || "User"} (${u.email}) requested account authorization with assigned role "${u.role}". Approval is required to grant portal access.`,
          snippet: `Requested Role: ${u.role}. Click to authorize account.`,
          actionLabel: "Authorize Account",
          timestamp: (u as any).createdAt || (u as any).timestamp || now,
          tags: ["#USER_AUTH", `#${u.role}`, "Action Required"],
          action: async () => {
            await approveUser(u.id);
            setSuccessId(`notif-user-await-${u.id}`);
            setTimeout(() => setSuccessId(null), 3000);
          }
        });
      });
    }

    // ==========================================
    // 4. SUBMISSIONS (New Requisitions)
    // ==========================================
    accessibleReqs.filter(r => r.status === RequisitionStatus.SUBMITTED && !r.id.includes("req-seed-")).forEach(r => {
      const atts = Array.isArray(r.attachments) ? r.attachments.map((att, idx) => ({
        name: typeof att === "string" ? att.split("/").pop() || `Document-${idx+1}.pdf` : `Attachment-${idx+1}.pdf`,
        size: "245 KB",
        type: "application/pdf"
      })) : [];

      items.push({
        id: `notif-req-sub-${r.id}`,
        type: "SUBMISSION",
        category: "SUBMISSIONS",
        senderName: r.requesterName || r.groupName || "Ministry Group",
        senderEmail: r.requesterEmail || "requisitions@pceastandrews.org",
        senderRole: "Requester",
        avatarGradient: "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500",
        icon: <FilePlus size={14} className="text-indigo-500" />,
        badgeColor: "bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60",
        badgeLabel: "New Submission",
        title: `Requisition Submitted: "${r.title || "Untitled Requisition"}"`,
        message: `New expense requisition "${r.title}" for KES ${r.amount.toLocaleString()} was submitted by ${r.groupName} (${r.requesterName}) and is pending Level 1 verification.`,
        snippet: `Amount: KES ${r.amount.toLocaleString()} • Group: ${r.groupName}. Pending audit review.`,
        actionLabel: "Verify Requisition",
        timestamp: r.submittedAt || r.createdAt || now,
        tags: ["#SUBMISSION", `#${r.groupName}`, `KES ${r.amount.toLocaleString()}`],
        attachments: atts,
        requisition: r,
        action: () => {
          onSelectRequisition(r);
        }
      });
    });

    // ==========================================
    // 5. USERS ADDED TO GROUPS
    // ==========================================
    (systemLogs || []).forEach(log => {
      if (!log || !log.action) return;

      const act = log.action.toUpperCase();
      const isGroupAddition = 
        act === "USER_ADDED_TO_GROUP" || 
        act === "GROUP_ASSIGNMENT" ||
        (act === "USER_PRE_PROVISIONED" && (log.metadata?.group || log.metadata?.groups)) ||
        (act === "USER_PROFILE_UPDATE" && (log.details?.toLowerCase().includes("group") || log.metadata?.group || log.metadata?.groups));

      if (isGroupAddition) {
        const groupName = log.metadata?.group || (Array.isArray(log.metadata?.groups) ? log.metadata.groups.join(", ") : "") || "Ministry Group";
        const targetUser = log.metadata?.name || log.metadata?.email || log.performedBy || "Member";

        items.push({
          id: `notif-group-add-${log.id}`,
          type: "GROUP_ADDITION",
          category: "GROUPS",
          senderName: log.performedBy || "Administrator",
          senderEmail: log.metadata?.email || "admin@pceastandrews.org",
          senderRole: "Admin",
          avatarGradient: "bg-gradient-to-tr from-violet-500 via-purple-600 to-indigo-600",
          icon: <Building2 size={14} className="text-violet-500" />,
          badgeColor: "bg-violet-50 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/60",
          badgeLabel: "Group Addition",
          title: `User Assigned to Group: ${groupName}`,
          message: `${log.details || `${targetUser} was assigned to ${groupName}.`}`,
          snippet: `👥 ${targetUser} assigned to ${groupName}`,
          actionLabel: "Acknowledge Group Update",
          timestamp: log.timestamp || now,
          tags: ["#GROUP_UPDATE", `#${groupName}`, "Directory"],
          metadata: log.metadata,
          action: () => {
            triggerToast({
              type: "SYSTEM_INFO",
              severity: "LOW",
              message: "Group assignment confirmed in user directory",
              timestamp: new Date().toISOString()
            });
          }
        });
      }
    });

    // ==========================================
    // 6. ACCOUNT DETAILS & PASSWORD UPDATES
    // ==========================================
    (systemLogs || []).forEach(log => {
      if (!log || !log.action) return;

      const act = log.action.toUpperCase();
      const isPasswordUpdate = act === "PASSWORD_CHANGED" || act === "PASSWORD_RESET" || act === "PASSWORD_RESET_TRIGGERED";
      const isAccountDetailChange = 
        act === "USER_PROFILE_UPDATE" || 
        act === "USER_ROLE_UPDATE" || 
        act === "ELEVATED_ROLE_GRANTED";

      if (isPasswordUpdate) {
        const userEmail = log.metadata?.email || log.performedBy || currentUser?.email || "User Account";

        items.push({
          id: `notif-pwd-${log.id}`,
          type: "ACCOUNT_UPDATE",
          category: "SECURITY",
          senderName: log.performedBy || "Account Security Guard",
          senderEmail: userEmail,
          senderRole: "Security",
          avatarGradient: "bg-gradient-to-tr from-rose-500 via-pink-600 to-orange-500",
          icon: <KeyRound size={14} className="text-rose-500" />,
          badgeColor: "bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60",
          badgeLabel: "Password Update",
          title: `Account Password Updated: ${userEmail}`,
          message: `Security notice: The account password for ${userEmail} was changed successfully. If you did not initiate this change, contact the ICT & Security Administrator immediately.`,
          snippet: `🔒 Password changed for ${userEmail}`,
          actionLabel: "Verify Security Notice",
          timestamp: log.timestamp || now,
          tags: ["#SECURITY", "#PASSWORD_CHANGE", "Account Alert"],
          metadata: log.metadata,
          action: () => {
            triggerToast({
              type: "SECURITY_UPDATE",
              severity: "MEDIUM",
              message: "Account security state is healthy and authenticated.",
              timestamp: new Date().toISOString()
            });
          }
        });
      } else if (isAccountDetailChange) {
        const userEmail = log.metadata?.email || log.performedBy || "Member Account";
        const isElevated = act === "ELEVATED_ROLE_GRANTED";

        items.push({
          id: `notif-acc-update-${log.id}`,
          type: "ACCOUNT_UPDATE",
          category: "SECURITY",
          senderName: log.performedBy || "Administrator",
          senderEmail: userEmail,
          senderRole: "Admin",
          avatarGradient: isElevated ? "bg-gradient-to-tr from-red-500 via-amber-500 to-rose-600" : "bg-gradient-to-tr from-slate-600 via-slate-700 to-slate-900",
          icon: isElevated ? <ShieldAlert size={14} className="text-red-500" /> : <UserCog size={14} className="text-slate-600 dark:text-slate-400" />,
          badgeColor: isElevated 
            ? "bg-red-50 dark:bg-red-950/80 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/60"
            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60",
          badgeLabel: isElevated ? "Elevated Rights" : "Profile Update",
          title: isElevated ? `Elevated Rights Granted: ${userEmail}` : `Account Details Modified: ${userEmail}`,
          message: `${log.details || `Account settings and user profile attributes were updated for ${userEmail}.`}`,
          snippet: `⚙️ ${log.details || `Account settings updated for ${userEmail}`}`,
          actionLabel: "Review Profile Changes",
          timestamp: log.timestamp || now,
          tags: ["#ACCOUNT_UPDATE", isElevated ? "#ELEVATED_RIGHTS" : "#PROFILE", "Security"],
          metadata: log.metadata,
          action: () => {
            triggerToast({
              type: "SYSTEM_INFO",
              severity: "LOW",
              message: "Account profile audit entry verified.",
              timestamp: new Date().toISOString()
            });
          }
        });
      }
    });

    // ==========================================
    // 7. NEW LOGIN DETECTED
    // ==========================================
    (systemLogs || []).forEach(log => {
      if (!log || !log.action) return;

      const act = log.action.toUpperCase();
      const isLogin = act === "USER_LOGIN" || act === "LOGIN" || act === "SESSION_AUTH" || act === "NEW_DEVICE_LOGIN";

      if (isLogin) {
        const userEmail = log.metadata?.email || log.performedBy || "Authenticated User";
        const authMethod = log.metadata?.authProvider || "Session Authorization";
        const userAgent = log.metadata?.userAgent || "Web Browser Device";

        items.push({
          id: `notif-login-${log.id}`,
          type: "NEW_LOGIN",
          category: "SECURITY",
          senderName: log.performedBy || userEmail,
          senderEmail: userEmail,
          senderRole: "Authentication",
          avatarGradient: "bg-gradient-to-tr from-emerald-500 via-teal-600 to-cyan-600",
          icon: <LogIn size={14} className="text-emerald-500" />,
          badgeColor: "bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60",
          badgeLabel: "New Login",
          title: `New Login Detected: ${userEmail}`,
          message: `A new session was authenticated for ${userEmail} via ${authMethod}.\n\nDevice / Environment: ${userAgent}`,
          snippet: `🌐 Authenticated via ${authMethod} (${userEmail})`,
          actionLabel: "Verify Login Session",
          timestamp: log.timestamp || now,
          tags: ["#NEW_LOGIN", `#${authMethod.replace(/\s+/g, "_")}`, "Session Audit"],
          metadata: log.metadata,
          action: () => {
            triggerToast({
              type: "SYSTEM_INFO",
              severity: "LOW",
              message: "Session authentication log verified.",
              timestamp: new Date().toISOString()
            });
          }
        });
      }
    });

    // Deduplicate and sort descending by timestamp
    const uniqueMap = new Map<string, NotificationItem>();
    items.forEach(item => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [requisitions, users, systemLogs, currentUser, onSelectRequisition, approveUser, triggerToast]);

  // Real-time category unread and total counts
  const categoryCounts = useMemo(() => {
    const counts = {
      ALL: { total: 0, unread: 0 },
      COMMENTS: { total: 0, unread: 0 },
      REACTIONS: { total: 0, unread: 0 },
      APPROVALS: { total: 0, unread: 0 },
      SUBMISSIONS: { total: 0, unread: 0 },
      GROUPS: { total: 0, unread: 0 },
      SECURITY: { total: 0, unread: 0 },
      STARRED: { total: 0, unread: 0 },
      ARCHIVED: { total: 0, unread: 0 },
      TRASH: { total: 0, unread: 0 },
    };

    notificationItems.forEach(item => {
      const isUnread = !readNoticeIds.includes(item.id);
      const isDeleted = deletedNoticeIds.includes(item.id);
      const isArchived = archivedNoticeIds.includes(item.id);
      const isStarred = starredNoticeIds.includes(item.id);

      if (isDeleted) {
        counts.TRASH.total += 1;
        if (isUnread) counts.TRASH.unread += 1;
        return;
      }

      if (isArchived) {
        counts.ARCHIVED.total += 1;
        if (isUnread) counts.ARCHIVED.unread += 1;
        return;
      }

      counts.ALL.total += 1;
      if (isUnread) counts.ALL.unread += 1;

      if (item.category && counts[item.category]) {
        counts[item.category].total += 1;
        if (isUnread) counts[item.category].unread += 1;
      }

      if (isStarred) {
        counts.STARRED.total += 1;
        if (isUnread) counts.STARRED.unread += 1;
      }
    });

    return counts;
  }, [notificationItems, readNoticeIds, deletedNoticeIds, archivedNoticeIds, starredNoticeIds]);

  // Filter items based on active tab, search, unread filter, and time window
  const { filteredItems, currentWeekItems, olderItems, displayedItems } = useMemo(() => {
    let result = notificationItems;

    if (activeTab === "TRASH") {
      result = result.filter(i => deletedNoticeIds.includes(i.id));
    } else {
      result = result.filter(i => !deletedNoticeIds.includes(i.id));

      if (activeTab === "STARRED") {
        result = result.filter(i => starredNoticeIds.includes(i.id));
      } else if (activeTab === "ARCHIVED") {
        result = result.filter(i => archivedNoticeIds.includes(i.id));
      } else {
        result = result.filter(i => !archivedNoticeIds.includes(i.id));

        if (activeTab !== "ALL") {
          result = result.filter(i => i.category === activeTab);
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

    const sorted = [...result].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 7-day cutoff for recent week items
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const currentWeek = sorted.filter(item => {
      const t = new Date(item.timestamp).getTime();
      return isNaN(t) || t >= sevenDaysAgo;
    });
    const older = sorted.filter(item => {
      const t = new Date(item.timestamp).getTime();
      return !isNaN(t) && t < sevenDaysAgo;
    });

    const displayed = showOlderNotifications ? sorted : currentWeek;

    return {
      filteredItems: sorted,
      currentWeekItems: currentWeek,
      olderItems: older,
      displayedItems: displayed
    };
  }, [notificationItems, activeTab, showUnreadOnly, searchQuery, readNoticeIds, starredNoticeIds, archivedNoticeIds, deletedNoticeIds, showOlderNotifications]);

  // Keep selection synced
  useEffect(() => {
    if (selectedItemId && !filteredItems.some(i => i.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [filteredItems, selectedItemId]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return filteredItems.find(i => i.id === selectedItemId) || null;
  }, [filteredItems, selectedItemId]);

  // Auto mark opened item as read
  useEffect(() => {
    if (selectedItem?.id && !readNoticeIds.includes(selectedItem.id)) {
      toggleNoticeRead(selectedItem.id, true);
    }
  }, [selectedItem?.id, readNoticeIds, toggleNoticeRead]);

  // Group into Unread & Read Sections
  const groupedSections = useMemo(() => {
    const unreadItems: NotificationItem[] = [];
    const readItems: NotificationItem[] = [];

    displayedItems.forEach(item => {
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
  }, [displayedItems, readNoticeIds]);

  const unreadTotal = categoryCounts.ALL.unread;

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
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 md:px-6 py-3.5 shrink-0 flex flex-col gap-3.5">
        {/* Main Title & Utility Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 flex items-center justify-center font-black text-sm shadow-sm shrink-0">
              <Bell size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-slate-100 leading-none">
                  Notification Hub
                </h1>
                {unreadTotal > 0 ? (
                  <span className="text-[10px] font-black font-mono bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                    {unreadTotal} UNREAD
                  </span>
                ) : (
                  <span className="text-[10px] font-black font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                    <CheckCircle2 size={10} /> ALL CAUGHT UP
                  </span>
                )}
              </div>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1 hidden xs:block">
                Streamlined feed for comments, reactions, approvals, submissions, group & security alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop Notification Toggle / Permission Prompt Button */}
            {isDesktopNotificationSupported() && (
              <button
                onClick={() => {
                  if (desktopPermission !== "granted") {
                    handleRequestDesktopPermission();
                  } else {
                    handleToggleDesktopNotifications(!desktopEnabled);
                  }
                }}
                disabled={isRequestingPermission}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border select-none",
                  desktopPermission === "granted" && desktopEnabled
                    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                    : desktopPermission === "denied"
                    ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 opacity-80"
                    : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100 animate-pulse"
                )}
                title={
                  desktopPermission === "granted"
                    ? desktopEnabled
                      ? "Desktop notifications are active. Click to pause."
                      : "Desktop notifications are paused. Click to resume."
                    : desktopPermission === "denied"
                    ? "Desktop notifications are blocked by browser. Click to view instructions."
                    : "Enable native desktop notifications for instant alerts"
                }
              >
                <Bell size={13} className={desktopPermission === "granted" && desktopEnabled ? "text-emerald-600" : "text-amber-600"} />
                <span className="hidden sm:inline">
                  {desktopPermission === "granted"
                    ? desktopEnabled ? "Desktop Alerts: ON" : "Desktop Alerts: OFF"
                    : desktopPermission === "denied" ? "Alerts Blocked" : "Enable Desktop Alerts"}
                </span>
                <span className="sm:hidden">
                  {desktopPermission === "granted" ? (desktopEnabled ? "Desktop ON" : "Desktop OFF") : "Alerts"}
                </span>
              </button>
            )}

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
                  message: "Notification Hub synchronized",
                  timestamp: new Date().toISOString()
                });
              }}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Refresh Notifications"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Category Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {/* ALL / Primary */}
          <button
            onClick={() => setActiveTab("ALL")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "ALL" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <span>All</span>
            {categoryCounts.ALL.unread > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-indigo-500 text-white">
                {categoryCounts.ALL.unread}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {categoryCounts.ALL.total}
              </span>
            )}
          </button>

          {/* COMMENTS */}
          <button
            onClick={() => setActiveTab("COMMENTS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "COMMENTS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <MessageSquare size={13} className="text-sky-500" />
            <span>Comments</span>
            {categoryCounts.COMMENTS.unread > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-sky-500 text-white">
                {categoryCounts.COMMENTS.unread}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {categoryCounts.COMMENTS.total}
              </span>
            )}
          </button>

          {/* REACTIONS */}
          <button
            onClick={() => setActiveTab("REACTIONS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "REACTIONS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <Smile size={13} className="text-amber-500" />
            <span>Reactions</span>
            {categoryCounts.REACTIONS.unread > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-amber-500 text-white">
                {categoryCounts.REACTIONS.unread}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {categoryCounts.REACTIONS.total}
              </span>
            )}
          </button>

          {/* APPROVALS */}
          <button
            onClick={() => setActiveTab("APPROVALS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "APPROVALS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <CheckCircle2 size={13} className="text-emerald-500" />
            <span>Approvals</span>
            {categoryCounts.APPROVALS.unread > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-emerald-500 text-white">
                {categoryCounts.APPROVALS.unread}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {categoryCounts.APPROVALS.total}
              </span>
            )}
          </button>

          {/* SUBMISSIONS */}
          <button
            onClick={() => setActiveTab("SUBMISSIONS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "SUBMISSIONS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <FilePlus size={13} className="text-indigo-500" />
            <span>Submissions</span>
            {categoryCounts.SUBMISSIONS.unread > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-indigo-500 text-white">
                {categoryCounts.SUBMISSIONS.unread}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {categoryCounts.SUBMISSIONS.total}
              </span>
            )}
          </button>

          {/* GROUPS */}
          <button
            onClick={() => setActiveTab("GROUPS")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "GROUPS" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <Building2 size={13} className="text-violet-500" />
            <span>Group Updates</span>
            {categoryCounts.GROUPS.unread > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-violet-500 text-white">
                {categoryCounts.GROUPS.unread}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {categoryCounts.GROUPS.total}
              </span>
            )}
          </button>

          {/* SECURITY & LOGINS */}
          <button
            onClick={() => setActiveTab("SECURITY")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "SECURITY" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <KeyRound size={13} className="text-rose-500" />
            <span>Account & Logins</span>
            {categoryCounts.SECURITY.unread > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black bg-rose-500 text-white">
                {categoryCounts.SECURITY.unread}
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {categoryCounts.SECURITY.total}
              </span>
            )}
          </button>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

          {/* STARRED */}
          <button
            onClick={() => setActiveTab("STARRED")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "STARRED" 
                ? "bg-amber-500 text-white shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <Star size={13} className={cn(activeTab === "STARRED" ? "fill-white text-white" : "fill-amber-500 text-amber-500")} />
            <span>Starred</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-black/10 text-inherit">
              {starredNoticeIds.length}
            </span>
          </button>

          {/* ARCHIVED */}
          <button
            onClick={() => setActiveTab("ARCHIVED")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "ARCHIVED" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <Archive size={13} />
            <span>Archived</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-black/10 text-inherit">
              {archivedNoticeIds.length}
            </span>
          </button>

          {/* TRASH */}
          <button
            onClick={() => setActiveTab("TRASH")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer select-none",
              activeTab === "TRASH" 
                ? "bg-rose-600 text-white shadow-sm" 
                : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70"
            )}
          >
            <Trash2 size={13} />
            <span>Trash</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-black/10 text-inherit">
              {deletedNoticeIds.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Notification Stream & Right Reading Pane */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Left Notification Stream Column */}
        <div className={cn(
          "w-full lg:w-[400px] xl:w-[440px] bg-slate-50/50 dark:bg-slate-950/60 border-r border-slate-200/80 dark:border-slate-800 flex flex-col shrink-0 h-full overflow-hidden transition-all duration-300",
          selectedItem ? "hidden lg:flex" : "flex"
        )}>
          {/* Search Box Header */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xs">
            <div className="relative flex items-center">
              <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search comments, approvals, logins..."
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

          {/* ALL CAUGHT UP BANNER */}
          {unreadTotal === 0 && notificationItems.length > 0 && !showUnreadOnly && (
            <div className="m-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center gap-3 text-emerald-900 dark:text-emerald-200 animate-in fade-in duration-300 shrink-0">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black tracking-tight leading-tight">All Caught Up!</p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium truncate mt-0.5">
                  All activity logs and comments have been reviewed.
                </p>
              </div>
            </div>
          )}

          {/* Grouped Notification List Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 subtle-scrollbar">
            {groupedSections.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3 px-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  {showUnreadOnly ? "No Unread Notifications" : "No Notifications Found"}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[260px] mx-auto leading-relaxed">
                  {showUnreadOnly 
                    ? "You have reviewed all unread notifications in this category."
                    : olderItems.length > 0
                    ? `No notifications for the current week. ${olderItems.length} older notification${olderItems.length > 1 ? 's are' : ' is'} available.`
                    : "No comments, reactions, approvals, or login events recorded in this view."
                  }
                </p>

                {olderItems.length > 0 && !showOlderNotifications && (
                  <button
                    type="button"
                    onClick={() => setShowOlderNotifications(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2 mx-auto mt-2"
                  >
                    <Clock size={14} />
                    <span>Load Older Notifications ({olderItems.length})</span>
                  </button>
                )}

                {showUnreadOnly && (
                  <button
                    type="button"
                    onClick={() => setShowUnreadOnly(false)}
                    className="px-3.5 py-1.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs mt-2"
                  >
                    Show All
                  </button>
                )}
              </div>
            ) : (
              groupedSections.map(section => {
                const isCollapsed = collapsedSections.has(section.key);

                return (
                  <div key={section.key} className="space-y-2">
                    {/* Section Header Divider */}
                    <div className="flex items-center gap-2 pt-2 pb-1 px-1 select-none">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {section.isUnreadSection ? (
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 animate-pulse" />
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
                                "group relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex flex-col gap-2 shadow-xs",
                                isSelected 
                                  ? "bg-white dark:bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/30 shadow-md" 
                                  : isRead
                                    ? "bg-white/70 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 border-slate-200/60 dark:border-slate-800/60 opacity-85"
                                    : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800"
                              )}
                            >
                              {/* Header Row: Avatar, Sender, Category Badge, Time */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <UserAvatar 
                                    user={{ name: item.senderName, photoURL: senderPhoto }} 
                                    size="xs" 
                                    className="shrink-0 shadow-xs" 
                                  />
                                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {item.senderName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={cn(
                                    "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1",
                                    item.badgeColor
                                  )}>
                                    {item.icon}
                                    <span>{item.badgeLabel}</span>
                                  </span>
                                  <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500">
                                    {formatTimeString(item.timestamp)}
                                  </span>
                                </div>
                              </div>

                              {/* Title / Subject */}
                              <h4 className={cn(
                                "text-xs leading-snug line-clamp-1 transition-colors",
                                !isRead ? "font-black text-slate-900 dark:text-slate-100" : "font-semibold text-slate-700 dark:text-slate-300"
                              )}>
                                {item.title}
                              </h4>

                              {/* Snippet preview */}
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-sans">
                                {item.snippet}
                              </p>

                              {/* Footer Actions */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 mt-0.5">
                                <div className="flex items-center gap-1">
                                  {item.requisition && (
                                    <span className="text-[9px] font-mono font-bold text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
                                      {item.requisition.groupName}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
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
                                    onClick={(e) => handleDeleteNotification(e, item.id, item.rawId)}
                                    className={cn(
                                      "p-1 rounded-md transition-colors cursor-pointer",
                                      isDeleted ? "text-indigo-600 dark:text-indigo-400" : "text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                                    )}
                                    title={isDeleted ? "Restore from trash" : "Move to trash"}
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

            {/* Load More Older Notifications Toggle */}
            {olderItems.length > 0 && (
              <div className="pt-2 pb-4">
                {!showOlderNotifications ? (
                  <button
                    type="button"
                    onClick={() => setShowOlderNotifications(true)}
                    className="w-full py-2.5 px-4 bg-white dark:bg-slate-900 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80 rounded-2xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <Clock size={15} className="group-hover:rotate-[-45deg] transition-transform text-indigo-500" />
                    <span>Load Older Notifications ({olderItems.length})</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-slate-100/90 dark:bg-slate-900/90 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs font-medium text-slate-500">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      Loaded {olderItems.length} older notification{olderItems.length > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOlderNotifications(false)}
                      className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Current Week Only
                    </button>
                  </div>
                )}
              </div>
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
                    className="lg:hidden flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                    <span>Back</span>
                  </button>

                  {/* Left Utility Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDeleteNotification(e, selectedItem.id, selectedItem.rawId)}
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
                            message: "Marked as unread",
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
                      title={readNoticeIds.includes(selectedItem.id) ? "Mark as unread" : "Mark as read"}
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

                  {/* Right Primary Action */}
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
                      onClick={() => setSelectedItemId(null)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Close preview"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Full Notification Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 subtle-scrollbar">
                  
                  {/* Sender Header */}
                  <div className="space-y-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <UserAvatar 
                          user={{ name: selectedItem.senderName, email: selectedItem.senderEmail, photoURL: detailSenderPhoto }} 
                          size="xl" 
                          className="shrink-0 shadow-xs" 
                        />

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-slate-100">
                              {selectedItem.senderName}
                            </h3>
                            <span className={cn(
                              "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1",
                              selectedItem.badgeColor
                            )}>
                              {selectedItem.icon}
                              <span>{selectedItem.badgeLabel}</span>
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {selectedItem.senderEmail} {selectedItem.senderRole ? `• ${selectedItem.senderRole}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 block">
                          {formatDateFull(selectedItem.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Notification Title */}
                    <h2 className="text-lg md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                      {selectedItem.title}
                    </h2>

                    {/* Category Tags */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {selectedItem.tags.map((tag, tIdx) => (
                        <span 
                          key={tIdx}
                          className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border border-slate-200/60 dark:border-slate-700/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Message Body */}
                  <div className="space-y-5 text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line">
                    <p className="text-slate-800 dark:text-slate-200 font-normal">
                      {selectedItem.message}
                    </p>

                    {/* Interactive Action Callout Box */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 my-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-mono">
                            Event Directive
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {selectedItem.title}
                          </h4>
                        </div>

                        {selectedItem.requisition && (
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Requisition Amount</span>
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

                    {/* Attached Requisition Overview */}
                    {selectedItem.requisition && (
                      <div className="space-y-2 pt-2">
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest font-mono">
                          Requisition Context:
                        </h4>
                        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-mono">
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span><strong>Requisition:</strong> {selectedItem.requisition.title}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span><strong>Ministry Group:</strong> {selectedItem.requisition.groupName}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span><strong>Submitted By:</strong> {selectedItem.requisition.requesterName}</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            <span><strong>Lifecycle Status:</strong> {selectedItem.requisition.status}</span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* File Attachments */}
                  {selectedItem.attachments && selectedItem.attachments.length > 0 && (
                    <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1.5">
                        <Paperclip size={14} />
                        <span>Attached Documents ({selectedItem.attachments.length})</span>
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
                Select a comment, reaction, approval, submission, group update, or security notice from the left to view details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationHub;
