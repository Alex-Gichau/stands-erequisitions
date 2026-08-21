/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  X,
  Trash2, 
  Pencil,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Paperclip,
  Printer,
  Download,
  ArrowUpDown,
  History,
  ShieldCheck,
  CalendarDays,
  MoreVertical,
  Loader2,
  Repeat,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Users,
  Flag,
  TrendingUp,
  Check,
  User,
  FileSignature,
  Fingerprint,
  KeyRound,
  Coins,
  ArrowRight,
  Activity,
  Camera,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  Copy,
  Share2,
  Store,
  ExternalLink,
  Maximize2,
  Minimize2,
  Lock,
  ArrowLeft,
  Info,
  HardDrive,
  Mail,
  UserPlus,
  MessageSquare,
  Send,
  Smile,
  Reply,
  SmilePlus,
  MoreHorizontal,
  Heart,
  ThumbsUp,
  ThumbsDown,
  CornerDownRight,
  Bell,
  Bold,
  Italic,
  List,
  ListOrdered,
  Layers,
  Split,
  Banknote,
  CheckCircle2
} from "lucide-react";
import { applyTextFormatting, renderFormattedCommentText } from "../lib/commentFormatUtils";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { useRequisitions, getActiveFiscalYear, safeNormalizeAttachments } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition, CommentReaction, Comment, RequisitionInstallment } from "../types";
import { compressImageFile } from "../lib/imageCompression";
import { databaseService } from "../lib/databaseService";
import { 
  formatCurrency, 
  formatDate, 
  cn, 
  getDaysSinceSubmission, 
  formatRequisitionAge, 
  isFinalStage, 
  normalizeAttachmentUrl, 
  getAttachmentFileName, 
  getAbsoluteAttachmentUrl, 
  handleImageError, 
  resolveSenderName, 
  getNamedImagePlaceholder 
} from "../lib/utils";
import { PdfThumbnailPreview, preloadPdfThumbnail } from "./PdfThumbnailPreview";
import { 
  useUnreadCommentsTracker, 
  markRequisitionCommentsAsRead, 
  getRequisitionUnreadCommentInfo 
} from "../utils/unreadCommentTracker";

// Relative time formatting helper (e.g., "1h ago", "2m ago", "just now")
function formatRelativeTime(timestamp?: string): string {
  if (!timestamp) return "just now";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "just now";

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 30) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getAvatarInitials(name: string): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";
}

function getAvatarBgColor(name: string): string {
  const bgColors = [
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-sky-600 text-white",
    "bg-purple-600 text-white",
    "bg-teal-600 text-white"
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return bgColors[Math.abs(hash) % bgColors.length];
}

// File extension pill helper with precise branded styling matching reference designs
function getFileTypeBadge(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['ppt', 'pptx'].includes(ext)) {
    return { bg: 'bg-[#E34426] text-white', label: 'P', iconColor: 'text-[#E34426]' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { bg: 'bg-[#107C41] text-white', label: 'X', iconColor: 'text-[#107C41]' };
  }
  if (['pdf'].includes(ext)) {
    return { bg: 'bg-[#D83B01] text-white', label: 'PDF', iconColor: 'text-[#D83B01]' };
  }
  if (['doc', 'docx'].includes(ext)) {
    return { bg: 'bg-[#2B579A] text-white', label: 'W', iconColor: 'text-[#2B579A]' };
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return { bg: 'bg-indigo-600 text-white', label: 'IMG', iconColor: 'text-indigo-600' };
  }
  return { bg: 'bg-slate-600 text-white', label: 'FILE', iconColor: 'text-slate-600' };
}

// Threaded replies summary formatter (e.g., "5 replies from Dom, Alice, Matt, and others")
export function formatRepliesSummary(replies: any[], users: any[] = []): { count: number; text: string; authors: { name: string; avatar: string }[] } {
  const count = replies.length;
  if (count === 0) return { count: 0, text: "", authors: [] };

  const authors: { name: string; avatar: string }[] = [];
  const seen = new Set<string>();

  for (const r of replies) {
    const userObj = users.find((u: any) => 
      (u.id && r.authorId && u.id === r.authorId) || 
      (u.email && r.authorEmail && u.email.toLowerCase() === r.authorEmail.toLowerCase())
    );
    const resolvedName = resolveSenderName(
      { id: r.authorId, email: r.authorEmail, name: r.authorName, role: r.authorRole },
      users
    ) || r.authorName || (r.authorEmail ? r.authorEmail.split("@")[0] : "User");

    const avatar = r.authorAvatar || r.authorPhotoURL || (userObj?.photoURL || (userObj as any)?.avatarUrl) || "";
    const key = resolvedName.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      authors.push({ name: resolvedName, avatar });
    }
  }

  const names = authors.map(a => a.name);
  const firstNames = authors.map(a => a.name.split(" ")[0]);
  let summaryText = "";

  if (count === 1) {
    summaryText = `1 reply from ${names[0]}`;
  } else if (names.length === 1) {
    summaryText = `${count} replies from ${names[0]}`;
  } else if (names.length === 2) {
    summaryText = `${count} replies from ${firstNames[0]} and ${firstNames[1]}`;
  } else if (names.length === 3) {
    summaryText = `${count} replies from ${firstNames[0]}, ${firstNames[1]}, and ${firstNames[2]}`;
  } else {
    summaryText = `${count} replies from ${firstNames[0]}, ${firstNames[1]}, ${firstNames[2]}, and others`;
  }

  return {
    count,
    text: summaryText,
    authors
  };
}

// Restricted Reactions Palette: Thumbs Up and Thumbs Down Only
export const REACTION_OPTIONS = [
  { emoji: "👍", label: "Thumbs Up" },
  { emoji: "👎", label: "Thumbs Down" },
];

export const ALLOWED_REACTION_EMOJIS = ["👍", "👎"];

// Compatibility aliases
export const WHATSAPP_QUICK_REACTION_OPTIONS = REACTION_OPTIONS;
export const WHATSAPP_EXTENDED_REACTION_OPTIONS: { emoji: string; label: string }[] = [];
export const COMMENT_REACTION_OPTIONS = REACTION_OPTIONS;

export function formatEmailToName(email: string): string {
  if (!email || typeof email !== "string" || !email.includes("@")) return "";
  const prefix = email.split("@")[0].replace(/[._-]/g, " ").trim();
  if (!prefix) return "";
  return prefix
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function buildUserLookupMap(allUsers: any[] = []): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(allUsers)) return map;

  allUsers.forEach((u: any) => {
    if (!u) return;
    const directName = u.name || u.displayName || u.username || resolveSenderName(u, allUsers) || "";
    const emailName = formatEmailToName(u.email || "");
    const resolvedName = directName || emailName;
    if (!resolvedName) return;

    if (u.id) map.set(String(u.id).trim().toLowerCase(), resolvedName);
    if (u.uid) map.set(String(u.uid).trim().toLowerCase(), resolvedName);
    if (u._id) map.set(String(u._id).trim().toLowerCase(), resolvedName);
    if (u.email) map.set(String(u.email).trim().toLowerCase(), resolvedName);
    if (u.username) map.set(String(u.username).trim().toLowerCase(), resolvedName);
  });

  return map;
}

export function buildUserProfilePicMap(allUsers: any[] = []): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(allUsers)) return map;

  allUsers.forEach((u: any) => {
    if (!u) return;
    const pic = u.photoURL || u.profilePicUrl || u.avatarUrl || u.photo_url || "";
    if (!pic) return;

    if (u.id) map.set(String(u.id).trim().toLowerCase(), pic);
    if (u.uid) map.set(String(u.uid).trim().toLowerCase(), pic);
    if (u._id) map.set(String(u._id).trim().toLowerCase(), pic);
    if (u.email) map.set(String(u.email).trim().toLowerCase(), pic);
    if (u.username) map.set(String(u.username).trim().toLowerCase(), pic);
  });

  return map;
}

export function getUserDirectoryProfilePic(
  identifier: any,
  allUsers: any[] = []
): string {
  if (!identifier) return "";
  if (!Array.isArray(allUsers) || allUsers.length === 0) {
    if (typeof identifier === "object") {
      return identifier.photoURL || identifier.profilePicUrl || identifier.avatarUrl || identifier.photo_url || identifier.userAvatar || "";
    }
    return "";
  }

  const uid = typeof identifier === "string" 
    ? identifier.trim().toLowerCase() 
    : (identifier.userDirectoryId || identifier.userId || identifier.id || identifier.uid || "").toString().trim().toLowerCase();
    
  const email = typeof identifier === "object" 
    ? (identifier.userEmail || identifier.email || "").toString().trim().toLowerCase() 
    : (typeof identifier === "string" && identifier.includes("@") ? identifier.trim().toLowerCase() : "");

  const matched = allUsers.find((u: any) => {
    if (!u) return false;
    const uId = u.id ? String(u.id).trim().toLowerCase() : "";
    const uUid = u.uid ? String(u.uid).trim().toLowerCase() : "";
    const uEmail = u.email ? String(u.email).trim().toLowerCase() : "";
    return (
      (uId && (uId === uid || (email && uId === email))) ||
      (uUid && (uUid === uid || (email && uUid === email))) ||
      (uEmail && ((uid && uEmail === uid) || (email && uEmail === email)))
    );
  });

  if (matched) {
    return matched.photoURL || matched.profilePicUrl || matched.avatarUrl || matched.photo_url || "";
  }

  if (typeof identifier === "object") {
    return identifier.photoURL || identifier.profilePicUrl || identifier.avatarUrl || identifier.photo_url || identifier.userAvatar || "";
  }

  return "";
}

/**
 * Requisition Ownership Discussion Row:
 * Renders small overlapping profile photos of people who commented on the requisition
 * and members receiving email/system updates directly on the table row under ownership.
 */
export const RequisitionOwnershipDiscussionRow: React.FC<{
  req: Requisition;
  users: any[];
  currentUser?: any;
}> = ({ req, users, currentUser: propUser }) => {
  const { currentUser: ctxUser } = useRequisitions();
  const currentUser = propUser || ctxUser;
  const hasComments = Array.isArray(req.comments) && req.comments.length > 0;
  if (!hasComments) return null;

  // Real-time unread comments status
  const unreadInfo = getRequisitionUnreadCommentInfo(req, currentUser, users);

  // Gather commenters & subscribers
  const participantsMap = new Map<string, {
    id: string;
    name: string;
    avatar?: string;
    label: string;
    role?: string;
  }>();

  // 1. Commenters & Reply Authors
  req.comments.forEach((c: any) => {
    if (!c) return;
    const authorUser = (users || []).find((u: any) =>
      (u.id && c.authorId && u.id === c.authorId) ||
      (u.email && c.authorEmail && u.email.toLowerCase() === c.authorEmail.toLowerCase())
    );
    const resolvedName = resolveSenderName(
      { id: c.authorId, email: c.authorEmail, name: c.authorName, role: c.authorRole },
      users || []
    ) || c.authorName || (c.authorEmail ? c.authorEmail.split("@")[0] : "Commenter");

    const avatar = c.authorAvatar || c.authorPhotoURL || authorUser?.photoURL || (authorUser as any)?.avatarUrl || "";
    const key = (c.authorEmail || c.authorId || resolvedName).toLowerCase().trim();

    participantsMap.set(key, {
      id: key,
      name: resolvedName,
      avatar,
      label: "Commented",
      role: c.authorRole || authorUser?.role
    });

    // Check replies
    if (Array.isArray(c.replies)) {
      c.replies.forEach((r: any) => {
        if (!r) return;
        const rUser = (users || []).find((u: any) =>
          (u.id && r.authorId && u.id === r.authorId) ||
          (u.email && r.authorEmail && u.email.toLowerCase() === r.authorEmail.toLowerCase())
        );
        const rName = resolveSenderName(
          { id: r.authorId, email: r.authorEmail, name: r.authorName, role: r.authorRole },
          users || []
        ) || r.authorName || (r.authorEmail ? r.authorEmail.split("@")[0] : "Commenter");
        const rAvatar = r.authorAvatar || r.authorPhotoURL || rUser?.photoURL || (rUser as any)?.avatarUrl || "";
        const rKey = (r.authorEmail || r.authorId || rName).toLowerCase().trim();

        if (!participantsMap.has(rKey)) {
          participantsMap.set(rKey, {
            id: rKey,
            name: rName,
            avatar: rAvatar,
            label: "Commented",
            role: r.authorRole || rUser?.role
          });
        }
      });
    }
  });

  // 2. Members receiving updates (notificationEmails)
  const notificationEmailsList = Array.isArray(req.notificationEmails) 
    ? req.notificationEmails 
    : (Array.isArray((req as any).notification_emails) ? (req as any).notification_emails : []);

  notificationEmailsList.forEach((emailStr: string) => {
    if (!emailStr || typeof emailStr !== "string") return;
    const cleanEmail = emailStr.trim();
    if (!cleanEmail) return;

    const matchedUser = (users || []).find((u: any) =>
      u.email && u.email.toLowerCase() === cleanEmail.toLowerCase()
    );

    const key = cleanEmail.toLowerCase();
    const resolvedName = matchedUser?.name || matchedUser?.displayName || cleanEmail.split("@")[0].replace(/[._-]/g, " ").split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const avatar = matchedUser?.photoURL || (matchedUser as any)?.avatarUrl || "";

    if (participantsMap.has(key)) {
      const existing = participantsMap.get(key)!;
      existing.label = "Commented & Subscribed";
      if (!existing.avatar && avatar) existing.avatar = avatar;
    } else {
      participantsMap.set(key, {
        id: key,
        name: resolvedName,
        avatar,
        label: "Receiving updates",
        role: matchedUser?.role
      });
    }
  });

  // 3. User Reactions & Most Recent Reaction Log per User
  const userReactionLogMap = new Map<string, {
    userId: string;
    userName: string;
    userEmail: string;
    emoji: string;
    timestamp: string;
  }>();

  req.comments.forEach((c: any) => {
    if (!c) return;
    const processItemReactions = (item: any) => {
      if (Array.isArray(item?.reactions)) {
        item.reactions.forEach((r: any) => {
          if (!r) return;
          const userKey = (r.userEmail || r.userId || r.userName || "").toLowerCase().trim();
          if (!userKey) return;
          const resolvedName = resolveSenderName(
            { id: r.userId, email: r.userEmail, name: r.userName },
            users || []
          ) || r.userName || (r.userEmail ? r.userEmail.split("@")[0] : "User");

          const timeVal = r.timestamp || item.timestamp || req.updatedAt || new Date().toISOString();

          if (!userReactionLogMap.has(userKey) || new Date(timeVal).getTime() > new Date(userReactionLogMap.get(userKey)!.timestamp).getTime()) {
            userReactionLogMap.set(userKey, {
              userId: r.userId || userKey,
              userName: resolvedName,
              userEmail: r.userEmail || "",
              emoji: r.emoji,
              timestamp: timeVal
            });
          }
        });
      }
    };

    processItemReactions(c);
    if (Array.isArray(c.replies)) {
      c.replies.forEach((rep: any) => processItemReactions(rep));
    }
  });

  const userReactionsList = Array.from(userReactionLogMap.values());

  const participantList = Array.from(participantsMap.values());
  if (participantList.length === 0 && userReactionsList.length === 0) return null;

  const totalCommentCount = req.comments.reduce((acc: number, c: any) => acc + 1 + (Array.isArray(c.replies) ? c.replies.length : 0), 0);

  return (
    <div className="flex items-center gap-1.5 mt-1 pt-1 flex-wrap">
      {/* Overlapping profile photos */}
      {participantList.length > 0 && (
        <div className="flex -space-x-1.5 overflow-hidden items-center shrink-0">
          {participantList.slice(0, 3).map((p, idx) => (
            <div 
              key={idx} 
              className="relative inline-block shrink-0 group/avatar cursor-pointer" 
              title={`${p.name} (${p.label})`}
            >
              {p.avatar ? (
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] max-w-[18px] max-h-[18px] rounded-full object-cover ring-1.5 ring-white dark:ring-slate-900 shadow-2xs"
                  onError={handleImageError}
                />
              ) : (
                <div className={cn(
                  "w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full ring-1.5 ring-white dark:ring-slate-900 font-bold text-[7.5px] flex items-center justify-center shadow-2xs",
                  getAvatarBgColor(p.name)
                )}>
                  {getAvatarInitials(p.name)}
                </div>
              )}
            </div>
          ))}
          {participantList.length > 3 && (
            <div 
              className="w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-1.5 ring-white dark:ring-slate-900 font-bold text-[7px] flex items-center justify-center shrink-0 shadow-2xs"
              title={`${participantList.length - 3} more: ${participantList.slice(3).map(p => p.name).join(", ")}`}
            >
              +{participantList.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Real-time Unread Comments Flag */}
      {unreadInfo.hasUnread && (
        <div 
          className="inline-flex items-center gap-1 text-[7.5px] md:text-[8px] font-black text-white bg-gradient-to-r from-rose-500 via-rose-600 to-amber-500 px-2 py-0.5 rounded-full shadow-xs shrink-0 animate-pulse border border-rose-400/40"
          title={`${unreadInfo.unreadCount} unread comment${unreadInfo.unreadCount === 1 ? "" : "s"}${unreadInfo.unreadAuthors.length > 0 ? ` from ${unreadInfo.unreadAuthors.join(", ")}` : ""}`}
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-90"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
          </span>
          <MessageSquare size={8.5} className="fill-current shrink-0" />
          <span>{unreadInfo.unreadCount} NEW</span>
        </div>
      )}

      {/* Small thread indicator & subscriber count */}
      {totalCommentCount > 0 && (
        <div 
          className={cn(
            "inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded-md shrink-0 transition-colors",
            unreadInfo.hasUnread
              ? "font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/60"
              : "font-semibold text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80"
          )}
          title={`${totalCommentCount} comments in discussion${unreadInfo.hasUnread ? ` (${unreadInfo.unreadCount} unread)` : ""} • ${notificationEmailsList.length} member${notificationEmailsList.length === 1 ? "" : "s"} receiving updates`}
        >
          <MessageSquare size={8.5} className={cn("shrink-0", unreadInfo.hasUnread ? "text-rose-500 fill-rose-500" : "text-indigo-500")} />
          <span>{totalCommentCount}</span>
          {notificationEmailsList.length > 0 && (
            <span className="text-slate-400 dark:text-slate-500 font-normal">
              • <Bell size={8} className="inline text-amber-500 -mt-0.5" /> {notificationEmailsList.length}
            </span>
          )}
        </div>
      )}

      {/* Most Recent Reaction Log per user */}
      {userReactionsList.length > 0 && (
        <div 
          className="inline-flex items-center gap-1 text-[8px] font-bold text-slate-700 dark:text-slate-300 bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs"
          title={userReactionsList.map(r => `${r.emoji} ${r.userName} reacted (${formatRelativeTime(r.timestamp)})`).join(" • ")}
        >
          <span className="text-blue-600 dark:text-blue-400 font-black uppercase text-[7px] tracking-wider mr-0.5">Most Recent:</span>
          {userReactionsList.slice(0, 2).map((r, idx) => (
            <span key={idx} className="inline-flex items-center gap-0.5">
              <span>{r.emoji}</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold">{r.userName.split(" ")[0]}</span>
              <span className="text-slate-400 dark:text-slate-500 font-mono text-[7px]">({formatRelativeTime(r.timestamp)})</span>
              {idx < Math.min(userReactionsList.length, 2) - 1 && <span className="text-slate-300 dark:text-slate-600 font-bold ml-0.5">•</span>}
            </span>
          ))}
          {userReactionsList.length > 2 && (
            <span className="text-blue-600 dark:text-blue-400 font-bold text-[7.5px]">+{userReactionsList.length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
};

export function isUserReactionMatch(
  r: any,
  user: any,
  allUsers: any[] = []
): boolean {
  if (!r || !user) return false;
  if (r.userId === "u-current" || r.userId === "__current_user__") return true;

  const curId = user.id ? String(user.id).trim().toLowerCase() : "";
  const curUid = user.uid ? String(user.uid).trim().toLowerCase() : "";
  const curEmail = user.email ? String(user.email).trim().toLowerCase() : "";
  const curUsername = (user as any)?.username ? String((user as any).username).trim().toLowerCase() : "";
  const curName = user.name ? String(user.name).trim().toLowerCase() : "";

  const rUid = r.userId ? String(r.userId).trim().toLowerCase() : "";
  const rUemail = r.userEmail ? String(r.userEmail).trim().toLowerCase() : "";
  const rEmail = r.email ? String(r.email).trim().toLowerCase() : "";
  const rUname = r.userName ? String(r.userName).trim().toLowerCase() : (r.name ? String(r.name).trim().toLowerCase() : "");

  if (curId && (rUid === curId || rUemail === curId || rEmail === curId)) return true;
  if (curUid && (rUid === curUid || rUemail === curUid || rEmail === curUid)) return true;
  if (curEmail && (rUid === curEmail || rUemail === curEmail || rEmail === curEmail)) return true;
  if (curUsername && (rUid === curUsername || rUname === curUsername)) return true;
  if (curName && !["user", "anon", "someone", "parish member", "anonymous", "undefined", "null"].includes(curName) && rUname === curName) return true;

  return false;
}

export function sanitizeCommentReactions(
  rawReactions: any,
  currentUser: any = null,
  allUsers: any[] = []
): any[] {
  if (!rawReactions) return [];

  let rawList: any[] = [];
  if (typeof rawReactions === "string") {
    try {
      const parsed = JSON.parse(rawReactions);
      rawList = Array.isArray(parsed) ? parsed : (typeof parsed === "object" ? [parsed] : []);
    } catch (e) {
      rawList = [];
    }
  } else if (Array.isArray(rawReactions)) {
    rawList = rawReactions;
  } else if (typeof rawReactions === "object") {
    rawList = Array.isArray((rawReactions as any).reactions) ? (rawReactions as any).reactions : Object.values(rawReactions);
  }

  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const userMap = buildUserLookupMap(allUsers);
  const userPicMap = buildUserProfilePicMap(allUsers);

  // Normalize all incoming reaction formats into flat list of individual { emoji, name, userDirectoryId, profilePicUrl, ... } records
  const list: any[] = [];
  for (const item of rawList) {
    if (!item) continue;
    if (typeof item === "string") {
      // Legacy single emoji string
      let emoji = item;
      if (emoji !== "👍" && emoji !== "👎") {
        emoji = (emoji === "👎" || emoji === "dislike") ? "👎" : "👍";
      }
      list.push({
        emoji,
        name: "User",
        userName: "User",
        userDirectoryId: "anon",
        userId: "anon",
        profilePicUrl: "",
        photoURL: "",
        userAvatar: ""
      });
    } else if (typeof item === "object") {
      if (item.emoji && Array.isArray(item.userIds)) {
        // Schema { emoji: string, userIds: string[] }
        let emoji = item.emoji;
        if (emoji !== "👍" && emoji !== "👎") {
          emoji = (emoji === "👎" || emoji === "dislike") ? "👎" : "👍";
        }
        item.userIds.forEach((uid: any) => {
          if (uid) {
            const resolvedUid = typeof uid === "string" ? uid : (uid.id || uid.uid || uid.userId || uid.userDirectoryId || "anon");
            const resolvedEmail = typeof uid === "object" ? (uid.email || uid.userEmail || "") : "";
            const directName = typeof uid === "object" ? (uid.name || uid.userName || "") : "";
            const emailName = formatEmailToName(resolvedEmail);
            const lookupName = userMap.get(String(resolvedUid).toLowerCase()) || (resolvedEmail ? userMap.get(String(resolvedEmail).toLowerCase()) : "") || directName || emailName;
            const directoryPic = (resolvedUid && userPicMap.get(String(resolvedUid).toLowerCase())) || (resolvedEmail && userPicMap.get(String(resolvedEmail).toLowerCase())) || "";
            const directPic = typeof uid === "object" ? (uid.profilePicUrl || uid.photoURL || uid.userAvatar || uid.avatarUrl || "") : "";
            const profilePic = directoryPic || directPic;
            list.push({
              emoji,
              name: lookupName || directName || emailName || "User",
              userName: lookupName || directName || emailName || "User",
              userDirectoryId: resolvedUid,
              userId: resolvedUid,
              profilePicUrl: profilePic,
              photoURL: profilePic,
              userAvatar: profilePic,
              userEmail: resolvedEmail,
              email: resolvedEmail
            });
          }
        });
      } else if (item.emoji) {
        // Schema { emoji: string, name, userDirectoryId, profilePicUrl, ... }
        let emoji = item.emoji;
        if (emoji !== "👍" && emoji !== "👎") {
          emoji = (emoji === "👎" || emoji === "dislike") ? "👎" : "👍";
        }
        const rUid = item.userDirectoryId || item.userId || item.uid || "anon";
        const rUemail = item.userEmail || item.email || "";
        const emailName = formatEmailToName(rUemail);
        const recordedName = item.name || item.userName || item.authorName || emailName || (rUid && userMap.get(String(rUid).toLowerCase())) || "User";
        const directoryPic = (rUid && userPicMap.get(String(rUid).toLowerCase())) || (rUemail && userPicMap.get(String(rUemail).toLowerCase())) || "";
        const recordedPic = directoryPic || item.profilePicUrl || item.photoURL || item.userAvatar || item.avatarUrl || item.authorAvatar || "";

        list.push({
          ...item,
          emoji,
          name: recordedName,
          userName: recordedName,
          userDirectoryId: rUid,
          userId: rUid,
          profilePicUrl: recordedPic,
          photoURL: recordedPic,
          userAvatar: recordedPic,
          userEmail: rUemail,
          email: rUemail,
          userRole: item.userRole || item.role || "",
          createdAt: item.createdAt || item.timestamp || new Date().toISOString(),
          timestamp: item.createdAt || item.timestamp || new Date().toISOString()
        });
      } else {
        // Dictionary format { "👍": ["u1", "u2"], "👎": ["u3"] }
        Object.entries(item).forEach(([key, val]: [string, any]) => {
          let emoji = key;
          if (key === "thumbsUp" || key === "thumbs_up" || key === "like" || key === "heart" || key === "celebration" || key === "party") emoji = "👍";
          else if (key === "thumbsDown" || key === "thumbs_down" || key === "dislike") emoji = "👎";
          else if (emoji !== "👍" && emoji !== "👎") emoji = "👍";

          if (Array.isArray(val)) {
            val.forEach((u: any) => {
              const uId = typeof u === "string" ? u : (u?.userDirectoryId || u?.id || u?.uid || u?.userId || "anon");
              const uEmail = typeof u === "object" ? (u?.email || u?.userEmail || "") : "";
              const directName = typeof u === "object" ? (u?.name || u?.userName || "") : "";
              const emailName = formatEmailToName(uEmail);
              const lookupName = userMap.get(String(uId).toLowerCase()) || (uEmail ? userMap.get(String(uEmail).toLowerCase()) : "") || directName || emailName;
              const directoryPic = (uId && userPicMap.get(String(uId).toLowerCase())) || (uEmail && userPicMap.get(String(uEmail).toLowerCase())) || "";
              const directPic = typeof u === "object" ? (u?.profilePicUrl || u?.photoURL || u?.userAvatar || "") : "";
              const profilePic = directoryPic || directPic;
              list.push({
                emoji,
                name: lookupName || directName || emailName || "User",
                userName: lookupName || directName || emailName || "User",
                userDirectoryId: uId,
                userId: uId,
                profilePicUrl: profilePic,
                photoURL: profilePic,
                userAvatar: profilePic,
                userEmail: uEmail,
                email: uEmail
              });
            });
          } else if (typeof val === "boolean" && val) {
            list.push({
              emoji,
              name: "User",
              userName: "User",
              userDirectoryId: "anon",
              userId: "anon",
              profilePicUrl: "",
              photoURL: "",
              userAvatar: ""
            });
          }
        });
      }
    }
  }

  if (list.length === 0) return [];

  // Enforce STRICTLY ONE REACTION PER USER (deduplicate by userDirectoryId or email)
  // Store user info reactions as recorded on database schema without overriding with currentUser
  const userReactionMap = new Map<string, any>();

  for (const r of list) {
    if (!r || !r.emoji) continue;

    const rUid = r.userDirectoryId ? String(r.userDirectoryId).trim().toLowerCase() : (r.userId ? String(r.userId).trim().toLowerCase() : "");
    const rUemail = r.userEmail ? String(r.userEmail).trim().toLowerCase() : (r.email ? String(r.email).trim().toLowerCase() : "");
    const rName = r.name ? String(r.name).trim() : (r.userName ? String(r.userName).trim() : "");

    let userKey: string;
    if (rUid && !rUid.startsWith("anon") && rUid !== "user") {
      userKey = `id_${rUid}`;
    } else if (rUemail) {
      userKey = `email_${rUemail}`;
    } else if (rName && !["anon", "user", "someone", "parish member", "anonymous"].includes(rName.toLowerCase())) {
      userKey = `name_${rName.toLowerCase()}`;
    } else {
      userKey = `reaction_${Math.random().toString(36).substring(2, 8)}`;
    }

    userReactionMap.set(userKey, r);
  }

  return Array.from(userReactionMap.values());
}

/**
 * Dedicated Pure Logic Handler for Reactions:
 * When user reacts: records name, userDirectoryId, profilePicUrl, and reaction on comment schema data.
 * Enforces strictly ONE reaction per user per comment or reply.
 */
export function handleReactionLogic({
  item,
  targetEmoji,
  currentUser,
  users = []
}: {
  item: any;
  targetEmoji: string;
  currentUser: any;
  users?: any[];
}): {
  updatedItem: any;
  action: "ADDED" | "REMOVED" | "SWITCHED";
  previousEmoji?: string;
  newReactions: any[];
} {
  const currentDirectoryId = currentUser?.id || currentUser?.uid || currentUser?.email || "anon";
  const userEmailName = formatEmailToName(currentUser?.email || "");
  const currentUserName = currentUser?.name || (currentUser as any)?.displayName || userEmailName || "User";
  const currentUserEmail = currentUser?.email || "";
  const currentUserRole = currentUser?.role || "";
  
  // Use the same profile picture as the user directory for that user
  const directoryProfilePic = getUserDirectoryProfilePic(
    { id: currentUser?.id, uid: currentUser?.uid, userDirectoryId: currentDirectoryId, email: currentUserEmail },
    users
  );
  const currentProfilePic = directoryProfilePic || currentUser?.photoURL || (currentUser as any)?.avatarUrl || "";

  // 1. Sanitize all current reactions from comment schema
  const sanitized = sanitizeCommentReactions(item.reactions, currentUser, users);

  // 2. Check if the current user has a previous reaction using their userDirectoryId/email
  const previousReaction = sanitized.find((r: any) => {
    const rUid = r.userDirectoryId || r.userId;
    const rEmail = r.userEmail || r.email;
    if (currentDirectoryId && (rUid === currentDirectoryId || rUid === currentUser?.id || rUid === currentUser?.uid)) return true;
    if (currentUserEmail && rEmail && String(rEmail).toLowerCase() === String(currentUserEmail).toLowerCase()) return true;
    return isUserReactionMatch(r, currentUser, users);
  });

  const hasPreviousReaction = Boolean(previousReaction);
  const isSameEmoji = previousReaction?.emoji === targetEmoji;

  let newReactions: any[];
  let action: "ADDED" | "REMOVED" | "SWITCHED";
  let previousEmoji: string | undefined = previousReaction?.emoji;

  const isUserMatch = (r: any) => {
    const rUid = r.userDirectoryId || r.userId;
    const rEmail = r.userEmail || r.email;
    if (currentDirectoryId && (rUid === currentDirectoryId || rUid === currentUser?.id || rUid === currentUser?.uid)) return true;
    if (currentUserEmail && rEmail && String(rEmail).toLowerCase() === String(currentUserEmail).toLowerCase()) return true;
    return isUserReactionMatch(r, currentUser, users);
  };

  if (hasPreviousReaction && isSameEmoji) {
    // User clicked the exact same emoji: delete reaction (toggle OFF)
    newReactions = sanitized.filter((r: any) => !isUserMatch(r));
    action = "REMOVED";
  } else {
    // Record name, user directory ID, profile pic URL and reaction on the comment schema data
    const newReactionObj: CommentReaction = {
      emoji: targetEmoji,
      name: currentUserName,
      userName: currentUserName,
      userDirectoryId: currentDirectoryId,
      userId: currentDirectoryId,
      profilePicUrl: currentProfilePic,
      photoURL: currentProfilePic,
      userAvatar: currentProfilePic,
      userEmail: currentUserEmail,
      email: currentUserEmail,
      userRole: currentUserRole,
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    if (hasPreviousReaction && !isSameEmoji) {
      // User switched emoji
      newReactions = [
        ...sanitized.filter((r: any) => !isUserMatch(r)),
        newReactionObj
      ];
      action = "SWITCHED";
    } else {
      // User added new reaction
      newReactions = [...sanitized, newReactionObj];
      action = "ADDED";
    }
  }

  // 3. Compute recalculated reaction counts, user directory IDs list, and summary
  const reactionCounts: Record<string, number> = {};
  const reactedUserIds: string[] = [];
  newReactions.forEach((r: any) => {
    if (r && r.emoji) {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
      const uid = r.userDirectoryId || r.userId || r.userEmail;
      if (uid && !reactedUserIds.includes(uid)) {
        reactedUserIds.push(uid);
      }
    }
  });

  const reactionSummary = {
    counts: reactionCounts,
    userIds: reactedUserIds,
    total: newReactions.length
  };

  const updatedItem = {
    ...item,
    reactions: newReactions,
    reactionCounts,
    reactedUserIds,
    reactionSummary
  };

  return {
    updatedItem,
    action,
    previousEmoji,
    newReactions
  };
}

export function extractUserFirstName(user: any): string {
  if (!user) return "";
  if (typeof user === "string") {
    const trimmed = user.trim();
    if (!trimmed) return "";
    if (trimmed.includes("@")) {
      const emailPrefix = trimmed.split("@")[0].replace(/[._-]/g, " ").trim();
      const first = emailPrefix.split(" ")[0];
      return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : trimmed;
    }
    const first = trimmed.split(" ")[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : trimmed;
  }
  const nameCandidate = user.name || user.displayName || user.username || "";
  if (nameCandidate && typeof nameCandidate === "string" && nameCandidate.trim()) {
    const first = nameCandidate.trim().split(" ")[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
  }
  if (user.email && typeof user.email === "string" && user.email.includes("@")) {
    const emailPrefix = user.email.split("@")[0].replace(/[._-]/g, " ").trim();
    const first = emailPrefix.split(" ")[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
  }
  return "";
}

export function extractUserDisplayName(user: any): string {
  if (!user) return "";
  if (typeof user === "string") {
    const trimmed = user.trim();
    if (!trimmed) return "";
    if (trimmed.includes("@")) {
      return formatEmailToName(trimmed);
    }
    return trimmed.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  const nameCandidate = user.name || user.displayName || user.username || "";
  if (nameCandidate && typeof nameCandidate === "string" && nameCandidate.trim()) {
    return nameCandidate.trim().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  if (user.email && typeof user.email === "string" && user.email.includes("@")) {
    return formatEmailToName(user.email);
  }
  return "";
}

export function resolveReactorNames(
  reactionsList: any[],
  emoji: string,
  allUsers: any[] = [],
  currentLoggedInUser: any = null
): string[] {
  const sanitized = sanitizeCommentReactions(reactionsList, currentLoggedInUser, allUsers);
  const matching = sanitized.filter((r: any) => r && r.emoji === emoji);
  if (matching.length === 0) return [];
  
  const names: string[] = [];

  matching.forEach((r: any) => {
    // Fetch and display reactor user name recorded on database schema
    const recordedName = r.name || r.userName;
    if (recordedName && recordedName.trim().length > 0) {
      const isGeneric = [
        "user", "anon", "anonymous", "someone", "unknown", "system user", "member", "parish member", "undefined", "null"
      ].includes(recordedName.toLowerCase().trim());

      if (!isGeneric) {
        const first = extractUserFirstName(recordedName);
        if (first) {
          names.push(first);
          return;
        }
      }
    }

    const emailToParse = r.userEmail || r.email || "";
    if (emailToParse && emailToParse.includes("@")) {
      const first = extractUserFirstName(emailToParse);
      if (first) {
        names.push(first);
        return;
      }
    }

    const rUid = r.userDirectoryId || r.userId;
    if (rUid && !["anon", "user", "undefined", "null"].includes(rUid)) {
      names.push(rUid.length > 10 ? `User ${rUid.slice(0, 4)}` : rUid);
    } else {
      names.push("Someone");
    }
  });

  // Ensure unique names
  const uniqueNames = Array.from(new Set(names));
  return uniqueNames;
}

export function formatReactionTooltip(reactorNames: string[], emoji?: string): string {
  if (!reactorNames || reactorNames.length === 0) return '';

  const count = reactorNames.length;
  if (count === 1) {
    return `${reactorNames[0]} reacted`;
  }
  if (count === 2) {
    return `${reactorNames[0]}, ${reactorNames[1]} reacted`;
  }
  if (count === 3) {
    return `${reactorNames[0]}, ${reactorNames[1]}, ${reactorNames[2]} reacted`;
  }

  const others = count - 2;
  return `${reactorNames[0]}, ${reactorNames[1]} and ${others} other${others === 1 ? '' : 's'} reacted`;
}

export function resolveReactorsProfiles(
  reactionsList: any[],
  allUsers: any[] = [],
  currentLoggedInUser: any = null
): Array<{ id: string; name: string; avatar?: string; emoji: string; isCurrent: boolean; email?: string; role?: string; userDirectoryId?: string }> {
  const sanitized = sanitizeCommentReactions(reactionsList, currentLoggedInUser, allUsers);
  if (!sanitized || sanitized.length === 0) return [];

  const profiles: Array<{ id: string; name: string; avatar?: string; emoji: string; isCurrent: boolean; email?: string; role?: string; userDirectoryId?: string }> = [];
  const seen = new Set<string>();

  const curId = currentLoggedInUser?.id ? String(currentLoggedInUser.id).trim().toLowerCase() : "";
  const curEmail = currentLoggedInUser?.email ? String(currentLoggedInUser.email).trim().toLowerCase() : "";

  sanitized.forEach((r: any) => {
    if (!r || !r.emoji) return;
    const rDirId = r.userDirectoryId || r.userId || "";
    const rEmail = r.userEmail || r.email || "";

    const isCurrent = Boolean(
      currentLoggedInUser && (
        (curId && (String(rDirId).toLowerCase() === curId || String(rEmail).toLowerCase() === curId)) ||
        (curEmail && (String(rEmail).toLowerCase() === curEmail || String(rDirId).toLowerCase() === curEmail))
      )
    );

    // Fetch user info reactions as recorded on database schema, prioritizing user directory profile picture
    const recordedName = r.name || r.userName || (rEmail ? formatEmailToName(rEmail) : "Parish Member");
    const directoryAvatar = getUserDirectoryProfilePic(r, allUsers);
    const recordedAvatar = directoryAvatar || r.profilePicUrl || r.photoURL || r.userAvatar || r.avatarUrl || "";
    const recordedRole = r.userRole || r.role || "Member";

    const key = rDirId || rEmail || recordedName;

    if (!seen.has(key)) {
      seen.add(key);
      profiles.push({
        id: key,
        name: recordedName,
        avatar: recordedAvatar,
        emoji: r.emoji,
        isCurrent,
        email: rEmail,
        role: recordedRole,
        userDirectoryId: rDirId
      });
    }
  });

  return profiles;
}

export function hasUserReacted(reactionsList: any[], emoji: string, user: any, allUsers: any[] = []): boolean {
  if (!Array.isArray(reactionsList) || !user) return false;
  const sanitized = sanitizeCommentReactions(reactionsList, user, allUsers);
  const curId = user.id ? String(user.id).trim().toLowerCase() : "";
  const curUid = user.uid ? String(user.uid).trim().toLowerCase() : "";
  const curEmail = user.email ? String(user.email).trim().toLowerCase() : "";

  return sanitized.some((r: any) => {
    if (!r || r.emoji !== emoji) return false;
    const rDirId = r.userDirectoryId ? String(r.userDirectoryId).trim().toLowerCase() : "";
    const rUid = r.userId ? String(r.userId).trim().toLowerCase() : "";
    const rUemail = r.userEmail ? String(r.userEmail).trim().toLowerCase() : "";
    const rEmail = r.email ? String(r.email).trim().toLowerCase() : "";

    if (curId && (rDirId === curId || rUid === curId || rUemail === curId || rEmail === curId)) return true;
    if (curUid && (rDirId === curUid || rUid === curUid || rUemail === curUid || rEmail === curUid)) return true;
    if (curEmail && (rDirId === curEmail || rUid === curEmail || rUemail === curEmail || rEmail === curEmail)) return true;

    return false;
  });
}

// Robust, zero-crash AttachmentViewer replacing external DocViewer
const AttachmentViewer = ({ uri, fileName }: { uri: string; fileName: string }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string>("");
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);

  // Spreadsheet state
  const [spreadsheetSheets, setSpreadsheetSheets] = useState<{ [sheetName: string]: (string | number)[][] }>({});
  const [activeSheetName, setActiveSheetName] = useState<string>("");
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState<boolean>(false);
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
  const [spreadsheetSearch, setSpreadsheetSearch] = useState<string>("");

  const cleanUri = getAbsoluteAttachmentUrl(uri) || uri?.trim() || "";
  const [imageSrc, setImageSrc] = useState<string>(cleanUri);
  const lowerName = (fileName || cleanUri).toLowerCase();

  // Check if data URI payload is HTML
  const isDataUri = cleanUri.startsWith("data:");
  const isHtmlPayload = isDataUri && (
    cleanUri.includes("PCFkb2N0") || // <!doctype
    cleanUri.includes("PGh0bW") ||   // <html
    cleanUri.includes("PEhUTU") ||   // <HTML
    cleanUri.includes("PCFET0")      // <!DO
  );

  const isImage = !isHtmlPayload && (
    cleanUri.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(lowerName) ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(cleanUri.toLowerCase())
  );

  const isHtml = isHtmlPayload ||
    cleanUri.startsWith("data:text/html") ||
    /\.(html|htm)(\?.*)?$/i.test(lowerName) ||
    /\.(html|htm)(\?.*)?$/i.test(cleanUri.toLowerCase());

  const isPdf = !isHtml && (
    cleanUri.startsWith("data:application/pdf") ||
    (isDataUri && cleanUri.includes("JVBERi0")) || // %PDF-
    /\.pdf(\?.*)?$/i.test(lowerName) ||
    /\.pdf(\?.*)?$/i.test(cleanUri.toLowerCase())
  );

  const isXlsx = !isHtml && !isPdf && !isImage && (
    cleanUri.startsWith("data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") ||
    cleanUri.startsWith("data:application/vnd.ms-excel") ||
    cleanUri.startsWith("data:text/csv") ||
    cleanUri.startsWith("data:application/csv") ||
    cleanUri.startsWith("data:text/tab-separated-values") ||
    cleanUri.startsWith("data:text/tsv") ||
    cleanUri.startsWith("data:application/ods") ||
    cleanUri.startsWith("data:application/x-ods") ||
    cleanUri.startsWith("data:application/vnd.oasis.opendocument.spreadsheet") ||
    cleanUri.startsWith("data:application/vnd.ms-excel.sheet") ||
    /\.(xlsx|xls|csv|ods|tsv|xlsm|xlsb)(\?.*)?$/i.test(lowerName) ||
    /\.(xlsx|xls|csv|ods|tsv|xlsm|xlsb)(\?.*)?$/i.test(cleanUri.toLowerCase())
  );

  const isText = !isHtml && !isPdf && !isImage && !isXlsx && (
    cleanUri.startsWith("data:text/") ||
    /\.(txt|json|log|md|xml)(\?.*)?$/i.test(lowerName) ||
    /\.(txt|json|log|md|xml)(\?.*)?$/i.test(cleanUri.toLowerCase())
  );

  const isAudioVideo = !isHtml && !isPdf && !isImage && !isText && (
    cleanUri.startsWith("data:audio/") || cleanUri.startsWith("data:video/") ||
    /\.(mp3|wav|ogg|mp4|webm|mov)(\?.*)?$/i.test(lowerName)
  );

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setHasError(false);
    setTextContent(null);
    setHtmlContent(null);
    setPdfDataUri("");
    setImageSrc(cleanUri || uri);

    if (isHtml && isDataUri) {
      try {
        const parts = cleanUri.split(",");
        if (parts[1]) {
          const decoded = window.atob(parts[1]);
          setHtmlContent(decoded);
        }
      } catch (e) {
        // Fall back to cleanUri iframe
      }
    }

    if (isPdf && cleanUri) {
      if (cleanUri.startsWith("data:")) {
        if (cleanUri.includes("JVBERi0") || cleanUri.startsWith("data:application/pdf")) {
          setPdfDataUri(cleanUri);
        } else {
          setHasError(true);
        }
      } else {
        setIsLoadingPdf(true);
        fetch(cleanUri)
          .then((res) => {
            if (!res.ok) throw new Error("HTTP error " + res.status);
            const contentType = (res.headers.get("content-type") || "").toLowerCase();
            if (contentType.includes("text/html")) {
              throw new Error("Server returned HTML page instead of PDF file");
            }
            return res.blob();
          })
          .then(async (blob) => {
            const textSample = await blob.slice(0, 100).text();
            if (textSample.includes("<!DOCTYPE") || textSample.includes("<html")) {
              throw new Error("Blob content is HTML, not PDF");
            }
            const reader = new FileReader();
            reader.onload = () => {
              let resStr = reader.result as string;
              if (resStr && (resStr.includes("JVBERi0") || resStr.startsWith("data:application/pdf"))) {
                if (!resStr.startsWith("data:application/pdf")) {
                  resStr = resStr.replace(/^data:[^;]+;/, "data:application/pdf;");
                }
                setPdfDataUri(resStr);
              } else {
                setHasError(true);
              }
              setIsLoadingPdf(false);
            };
            reader.onerror = () => {
              setHasError(true);
              setIsLoadingPdf(false);
            };
            reader.readAsDataURL(blob);
          })
          .catch((err) => {
            console.warn("PDF fetch/load error:", err);
            setHasError(true);
            setIsLoadingPdf(false);
          });
      }
    }
  }, [uri, isPdf, isHtml, isDataUri, cleanUri]);

  useEffect(() => {
    if (isText && cleanUri && !cleanUri.startsWith("data:")) {
      setIsLoadingText(true);
      fetch(cleanUri)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load file text");
          return res.text();
        })
        .then((text) => setTextContent(text))
        .catch(() => setHasError(true))
        .finally(() => setIsLoadingText(false));
    } else if (isText && cleanUri.startsWith("data:")) {
      try {
        const parts = cleanUri.split(",");
        if (parts[1]) {
          const decoded = window.atob(parts[1]);
          setTextContent(decoded);
        }
      } catch (e) {
        setHasError(true);
      }
    }
  }, [isText, cleanUri]);

  // Parse spreadsheet workbook using SheetJS (XLSX)
  useEffect(() => {
    if (isXlsx && cleanUri) {
      setIsLoadingSpreadsheet(true);
      setSpreadsheetError(null);
      setSpreadsheetSheets({});
      setActiveSheetName("");
      setSpreadsheetSearch("");

      const processWorkbook = (wb: XLSX.WorkBook) => {
        try {
          if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
            throw new Error("Spreadsheet contains no sheets or invalid structure.");
          }
          const parsedMap: { [sheetName: string]: (string | number)[][] } = {};
          wb.SheetNames.forEach((name) => {
            const worksheet = wb.Sheets[name];
            if (worksheet) {
              const rows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
                header: 1,
                defval: "",
                raw: false
              });
              parsedMap[name] = rows;
            }
          });
          setSpreadsheetSheets(parsedMap);
          setActiveSheetName(wb.SheetNames[0]);
          setIsLoadingSpreadsheet(false);
        } catch (err: any) {
          console.error("Error processing workbook:", err);
          setSpreadsheetError(err?.message || "Failed to process spreadsheet structure");
          setIsLoadingSpreadsheet(false);
        }
      };

      if (cleanUri.startsWith("data:")) {
        try {
          const commaIdx = cleanUri.indexOf(",");
          if (commaIdx !== -1) {
            const meta = cleanUri.substring(0, commaIdx);
            const body = cleanUri.substring(commaIdx + 1);
            if (meta.includes(";base64")) {
              const wb = XLSX.read(body, { type: "base64", cellDates: true, raw: false });
              processWorkbook(wb);
            } else {
              const decoded = decodeURIComponent(body);
              const wb = XLSX.read(decoded, { type: "string", cellDates: true, raw: false });
              processWorkbook(wb);
            }
          } else {
            throw new Error("Invalid data URI payload format.");
          }
        } catch (err: any) {
          console.error("Data URI parse error:", err);
          setSpreadsheetError(err?.message || "Failed to decode spreadsheet data URL.");
          setIsLoadingSpreadsheet(false);
        }
      } else {
        fetch(cleanUri)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch file`);
            return res.arrayBuffer();
          })
          .then((arrayBuffer) => {
            const data = new Uint8Array(arrayBuffer);
            const wb = XLSX.read(data, { type: "array", cellDates: true, raw: false });
            processWorkbook(wb);
          })
          .catch((err) => {
            console.error("Fetch spreadsheet error:", err);
            setSpreadsheetError(err?.message || "Failed to fetch spreadsheet from server.");
            setIsLoadingSpreadsheet(false);
          });
      }
    }
  }, [isXlsx, cleanUri]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[350px] bg-slate-900/80 rounded-2xl border border-slate-800">
        <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mb-4 border border-rose-500/20">
          <AlertTriangle size={32} />
        </div>
        <h4 className="text-base font-bold text-slate-100 mb-1">Preview Unavailable</h4>
        <p className="text-xs text-slate-400 max-w-sm mb-6">
          The file format could not be rendered directly in preview. You can open it in a new window or download it to view.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={cleanUri}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950"
          >
            <Download size={14} /> Download File
          </a>
        </div>
      </div>
    );
  }

  if (isHtml) {
    return (
      <div className="flex flex-col h-full w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative min-h-[500px]">
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
          <a
            href={cleanUri}
            download={fileName.endsWith(".html") ? fileName : `${fileName}.html`}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Download size={13} /> Download HTML
          </a>
        </div>
        <iframe
          srcDoc={htmlContent || undefined}
          src={!htmlContent ? cleanUri : undefined}
          title={fileName}
          className="w-full h-full min-h-[500px] border-none bg-white rounded-xl"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    );
  }

  if (isImage) {
    return (
      <div className="flex flex-col h-full w-full relative overflow-hidden bg-slate-950 rounded-2xl border border-slate-800">
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-[11px] font-mono font-bold text-slate-300 px-1 min-w-[42px] text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-4 bg-slate-800 my-auto mx-0.5" />
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Rotate Clockwise"
          >
            <Repeat size={16} />
          </button>
          <button
            onClick={() => { setZoom(1); setRotation(0); }}
            className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer font-mono"
            title="Reset View"
          >
            1:1
          </button>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-6 min-h-[400px]">
          <img
            src={imageSrc}
            alt={fileName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const rawUrl = uri && uri.includes("::") ? uri.split("::")[1] : uri;
              if (rawUrl && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) && imageSrc !== rawUrl) {
                setImageSrc(rawUrl);
              } else {
                const placeholder = getNamedImagePlaceholder(fileName);
                if (imageSrc !== placeholder) {
                  setImageSrc(placeholder);
                } else {
                  setHasError(true);
                }
              }
            }}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: "transform 0.2s ease-out",
              maxHeight: zoom === 1 ? "80vh" : "none",
              maxWidth: zoom === 1 ? "100%" : "none",
              objectFit: "contain",
            }}
            className="rounded-lg shadow-2xl select-none"
          />
        </div>
      </div>
    );
  }

  if (isPdf) {
    const activeUri = pdfDataUri || cleanUri;
    return (
      <div className="flex flex-col h-full w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative min-h-[500px]">
        {isLoadingPdf && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm gap-2 text-slate-300">
            <Loader2 size={24} className="animate-spin text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider">Loading PDF...</span>
          </div>
        )}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl">
          <a
            href={activeUri}
            download={fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            <Download size={13} /> Download
          </a>
        </div>
        <iframe
          src={`${activeUri}#toolbar=1`}
          title={fileName}
          className="w-full h-full min-h-[500px] border-none bg-slate-900"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  if (isText) {
    return (
      <div className="flex flex-col h-full w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden p-4">
        {isLoadingText ? (
          <div className="flex items-center justify-center h-full min-h-[300px] text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin text-indigo-400" />
            <span className="text-xs">Loading document text...</span>
          </div>
        ) : (
          <pre className="w-full h-full min-h-[400px] overflow-auto p-4 bg-slate-900 rounded-xl font-mono text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed border border-slate-800/80">
            {textContent || "No text content available."}
          </pre>
        )}
      </div>
    );
  }

  if (isXlsx) {
    const sheetNames = Object.keys(spreadsheetSheets);
    const activeRows = spreadsheetSheets[activeSheetName] || [];
    
    // Filter rows based on search term
    const filteredRows = activeRows.filter((row, idx) => {
      if (idx === 0) return true; // Always show header row
      if (!spreadsheetSearch.trim()) return true;
      const searchLower = spreadsheetSearch.toLowerCase();
      return row.some((cell) => String(cell).toLowerCase().includes(searchLower));
    });

    const maxCols = Math.max(0, ...activeRows.map((r) => r.length));

    return (
      <div className="flex flex-col h-full w-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative min-h-[500px]">
        {/* Top Control Bar */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20 shrink-0">
              <FileSpreadsheet size={18} />
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-bold text-slate-100 truncate">{fileName}</h4>
              <p className="text-[10px] text-slate-400 font-mono">
                {isLoadingSpreadsheet
                  ? "Parsing spreadsheet..."
                  : spreadsheetError
                  ? "Parse Warning"
                  : `${activeRows.length} Rows • ${maxCols} Columns`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            {!isLoadingSpreadsheet && !spreadsheetError && activeRows.length > 0 && (
              <div className="relative flex items-center">
                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={spreadsheetSearch}
                  onChange={(e) => setSpreadsheetSearch(e.target.value)}
                  placeholder="Search in sheet..."
                  className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs rounded-lg outline-none w-36 sm:w-48 transition-all"
                />
                {spreadsheetSearch && (
                  <button
                    onClick={() => setSpreadsheetSearch("")}
                    className="absolute right-2 text-slate-500 hover:text-slate-300"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Download Button */}
            <a
              href={cleanUri}
              download={fileName}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-950/40 shrink-0"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </a>
          </div>
        </div>

        {/* Sheet Selector Tabs */}
        {sheetNames.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 overflow-x-auto scrollbar-thin">
            {sheetNames.map((name) => (
              <button
                key={name}
                onClick={() => setActiveSheetName(name)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                  activeSheetName === name
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                )}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 bg-slate-950 relative">
          {isLoadingSpreadsheet ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[350px] gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-emerald-400" />
              <span className="text-xs font-bold tracking-wide uppercase">Reading Spreadsheet Data...</span>
            </div>
          ) : spreadsheetError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[350px] bg-slate-900/80 rounded-2xl border border-slate-800">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mb-4 border border-amber-500/20">
                <AlertTriangle size={32} />
              </div>
              <h4 className="text-sm font-bold text-slate-200 mb-1">Interactive Viewer Notice</h4>
              <p className="text-xs text-slate-400 max-w-sm mb-5">
                {spreadsheetError || "Unable to display grid preview directly. Please download the file to view."}
              </p>
              <a
                href={cleanUri}
                download={fileName}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Download size={14} /> Download File ({fileName})
              </a>
            </div>
          ) : activeRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 gap-2">
              <FileSpreadsheet size={32} className="text-slate-600" />
              <span className="text-xs font-bold">Sheet is empty or has no content.</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-2xl max-h-[70vh]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-300 font-mono font-bold border-b border-slate-800 sticky top-0 z-10 shadow-sm">
                    <th className="p-2.5 text-[10px] text-slate-500 bg-slate-950/80 text-center border-r border-slate-800/80 w-12 select-none">
                      #
                    </th>
                    {Array.from({ length: maxCols }).map((_, cIdx) => (
                      <th
                        key={cIdx}
                        className="p-2.5 text-slate-300 border-r border-slate-800/80 whitespace-nowrap min-w-[100px]"
                      >
                        {activeRows[0] && activeRows[0][cIdx] !== undefined && activeRows[0][cIdx] !== ""
                          ? String(activeRows[0][cIdx])
                          : String.fromCharCode(65 + (cIdx % 26)) + (cIdx >= 26 ? Math.floor(cIdx / 26) : "")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-200">
                  {filteredRows.slice(1).map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-indigo-500/10 transition-colors group"
                    >
                      <td className="p-2 text-[10px] text-slate-500 font-mono text-center bg-slate-950/40 border-r border-slate-800/80 select-none group-hover:text-indigo-400">
                        {rIdx + 1}
                      </td>
                      {Array.from({ length: maxCols }).map((_, cIdx) => {
                        const cellVal = row[cIdx] !== undefined && row[cIdx] !== null ? String(row[cIdx]) : "";
                        const isMatch =
                          spreadsheetSearch.trim() &&
                          cellVal.toLowerCase().includes(spreadsheetSearch.toLowerCase());

                        return (
                          <td
                            key={cIdx}
                            className={cn(
                              "p-2 border-r border-slate-800/40 whitespace-pre-wrap max-w-xs break-words font-sans text-xs",
                              isMatch ? "bg-amber-500/20 text-amber-200 font-semibold" : ""
                            )}
                          >
                            {cellVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isAudioVideo) {
    const isVid = cleanUri.startsWith("data:video/") || /\.(mp4|webm|mov)(\?.*)?$/i.test(lowerName);
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] w-full bg-slate-950 rounded-2xl border border-slate-800 p-6">
        {isVid ? (
          <video src={cleanUri} controls className="max-h-[70vh] max-w-full rounded-xl border border-slate-800 shadow-2xl" />
        ) : (
          <div className="w-full max-w-md p-6 bg-slate-900 rounded-2xl border border-slate-800 text-center space-y-4">
            <div className="w-16 h-16 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-500/20">
              <Activity size={32} />
            </div>
            <p className="text-sm font-bold text-slate-200 truncate">{fileName}</p>
            <audio src={cleanUri} controls className="w-full mt-2" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[400px] bg-slate-900/90 rounded-2xl border border-slate-800">
      <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-3xl flex items-center justify-center mb-5 border border-indigo-500/20 shadow-xl">
        <FileText size={40} />
      </div>
      <h4 className="text-lg font-extrabold text-slate-100 mb-1 max-w-md truncate">{fileName}</h4>
      <p className="text-xs text-slate-400 max-w-sm mb-6">
        This document type can be viewed by downloading or opening directly in a new tab.
      </p>
      <div className="flex items-center gap-3">
        <a
          href={cleanUri}
          download={fileName}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-700"
        >
          <Download size={15} /> Download Document
        </a>
      </div>
    </div>
  );
};
import { printRequisitions, downloadRequisitionsHtml, downloadRequisitionsCsv, downloadRequisitionsPdf, printRequisitionVoucher, printInstallmentVoucher, printRequisitionReceipt } from "../utils/exportUtils";
import { NewRequisitionForm } from "./NewRequisitionForm";
import { ReceiptTemplateGenerator } from "./ReceiptTemplateGenerator";
import { ReceiptGallery } from "./ReceiptGallery";
import { CameraCapture } from "./CameraCapture";
import { ConfirmationModal } from "./ConfirmationModal";
import { CachedImage } from "./CachedImage";
import { getCachedMediaUrl, preloadMediaBatch } from "../lib/mediaCache";



const DocumentPreviewModal = ({ 
  attachments: rawAttachments = [], 
  initialIndex = 0, 
  onClose,
  requisition
}: { 
  attachments: string[]; 
  initialIndex: number; 
  onClose: () => void;
  requisition?: any;
}) => {
  const attachments = Array.isArray(rawAttachments) 
    ? rawAttachments 
    : (typeof rawAttachments === "string" && rawAttachments ? [rawAttachments] : []);

  const [activeDocIndex, setActiveDocIndex] = useState(initialIndex);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Prepare document objects for react-doc-viewer
  const docs = useMemo(() => {
    return attachments.map((att: any, idx: number) => {
      const absUrl = getAbsoluteAttachmentUrl(att);
      const name = getAttachmentFileName(att) || `Attachment-${idx + 1}`;
      return {
        uri: absUrl,
        fileName: name,
      };
    });
  }, [attachments]);

  if (!attachments || attachments.length === 0) return null;

  const currentDoc = docs[activeDocIndex] || docs[0];

  // Requester information
  const requesterName = requisition?.requesterName || "System User / Requester";
  const requesterEmail = requisition?.requesterEmail || "";
  const groupName = requisition?.groupName || "Ministry Group";
  const submittedAt = requisition?.submittedAt ? formatDate(requisition.submittedAt) : (requisition?.createdAt ? formatDate(requisition.createdAt) : null);
  const amountStr = requisition?.amount !== undefined ? formatCurrency(requisition.amount) : null;
  const title = requisition?.title || "Requisition Attachment";
  const reqId = requisition?.id || "";

  // Approvers information
  const approvalHistory: any[] = requisition?.approvalHistory || [];
  
  // Find L1, L2, and Disbursing approver notes if available
  const l1Note = approvalHistory.find((h: any) => 
    h.role === UserRole.APPROVER_L1 || h.role === UserRole.CHURCH_GROUP || h.role === "GROUP_LEADER" || h.role === "APPROVER_L1"
  );
  const l2Note = approvalHistory.find((h: any) => 
    h.role === UserRole.APPROVER_L2 || h.role === UserRole.FINANCE || h.role === "TREASURER" || h.role === "FINANCE" || h.role === "APPROVER_L2"
  );
  const disburseNote = approvalHistory.find((h: any) => h.decision === "DISBURSED" || h.note?.toLowerCase().includes("disbursed"));

  const isL1Approved = Boolean(requisition?.approvedAtL1 || l1Note?.decision === "APPROVE");
  const isL2Approved = Boolean(requisition?.approvedAtL2 || l2Note?.decision === "APPROVE");
  const isDisbursed = Boolean(requisition?.disbursedAt || disburseNote);

  // Unique list of all members involved/updated in this requisition
  const membersInvolved = useMemo(() => {
    const map = new Map<string, { name: string; role?: string; email?: string; action?: string; timestamp?: string }>();
    
    if (requesterName) {
      map.set("requester", {
        name: requesterName,
        email: requesterEmail,
        role: "Requester",
        action: "Created & Submitted Requisition",
        timestamp: submittedAt || undefined,
      });
    }

    approvalHistory.forEach((note: any) => {
      const key = note.approverId || note.approverName;
      if (key) {
        map.set(key, {
          name: note.approverName || "Approver",
          role: note.role || "Approver",
          action: note.decision === "APPROVE" ? "Approved Request" : note.decision === "REJECT" ? "Rejected Request" : note.decision === "ESCALATE" ? "Escalated Request" : "Reviewed & Updated Note",
          timestamp: note.timestamp ? formatDate(note.timestamp) : undefined,
        });
      }
    });

    return Array.from(map.values());
  }, [requesterName, requesterEmail, submittedAt, approvalHistory]);

  return (
    <div 
      className="fixed inset-0 z-[120] pointer-events-none flex items-center justify-end p-0 transition-all overflow-hidden"
    >
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className={cn(
          "bg-white dark:bg-slate-900 h-full shadow-2xl overflow-hidden border-l border-slate-200 dark:border-slate-800 flex flex-col relative text-slate-900 dark:text-slate-100 transition-all duration-300 pointer-events-auto",
          isFullscreen 
            ? "fixed inset-0 z-[200] rounded-none w-full max-w-none max-h-none p-0" 
            : "w-full sm:w-[480px] md:w-[540px] lg:w-[600px] xl:w-[660px] max-w-[90vw]"
        )}
      >
        {/* Header bar */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 select-none shrink-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black px-2 py-0.5 rounded-full font-mono uppercase border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-1">
                  <Eye size={10} /> SIDE PREVIEW
                </span>
                <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full font-mono uppercase border border-indigo-200 dark:border-indigo-800/40">
                  {reqId ? `#${reqId}` : "REQUISITION ATTACHMENT"}
                </span>
                <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full font-mono uppercase">
                  FILE {activeDocIndex + 1} OF {attachments.length}
                </span>
              </div>
              <h3 className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                {currentDoc?.fileName || title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle Info / Members Details Drawer */}
            <button
              onClick={() => setShowDetailsPanel(!showDetailsPanel)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                showDetailsPanel 
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-950" 
                  : "bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Toggle Requester & Approvers Details Panel"
            >
              <Users size={15} />
              <span className="hidden sm:inline">Details & Members</span>
              {membersInvolved.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-slate-200 dark:bg-slate-900 font-mono">
                  {membersInvolved.length}
                </span>
              )}
            </button>



            {/* Download */}
            {currentDoc?.uri && (
              <button
                onClick={() => {
                  const downloadUrl = getAbsoluteAttachmentUrl(currentDoc.uri) || currentDoc.uri;
                  const link = document.createElement("a");
                  link.href = downloadUrl;
                  link.download = currentDoc.fileName || "attachment";
                  link.target = "_blank";
                  link.rel = "noopener noreferrer";
                  link.click();
                }}
                className="p-2 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
                title="Download Document"
              >
                <Download size={16} />
              </button>
            )}

            {/* Fullscreen */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer hidden md:flex"
              title={isFullscreen ? "Exit Fullscreen" : "Maximize Modal"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:border-rose-300 dark:hover:border-rose-800 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Main Area */}
        <div className="flex-1 flex overflow-hidden relative bg-slate-100/70 dark:bg-slate-950">
          {/* Main Document Area using react-doc-viewer */}
          <div className="flex-1 flex flex-col h-full overflow-hidden relative p-2 md:p-4">
            {/* File Selector Tabs if multiple attachments */}
            {docs.length > 1 && (
              <div className="mb-2 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {docs.map((d, idx) => (
                  <button
                    key={`doc-tab-${idx}`}
                    onClick={() => setActiveDocIndex(idx)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all flex items-center gap-1.5 border ${
                      idx === activeDocIndex
                        ? "bg-indigo-600 border-indigo-500 text-white font-bold shadow-md"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <FileText size={13} />
                    <span className="truncate max-w-[160px]">{d.fileName}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Attachment preview container */}
            <div className="flex-1 w-full h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 relative flex flex-col">
              <AttachmentViewer
                uri={currentDoc?.uri || ""}
                fileName={currentDoc?.fileName || "Attachment"}
              />
            </div>
          </div>

          {/* Right Sidebar Details Panel: Requester, Approvers, Updated Members */}
          <AnimatePresence>
            {showDetailsPanel && (
              <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 300, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-full md:w-80 lg:w-96 bg-white/95 dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 flex flex-col h-full overflow-y-auto shrink-0 z-10 shadow-2xl"
              >
                {/* Sidebar Title */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 sticky top-0 z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                      Requisition Members & Approvals
                    </h4>
                  </div>
                  <button
                    onClick={() => setShowDetailsPanel(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 md:hidden cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-4 space-y-6">
                  {/* Requisition Meta Summary Card */}
                  <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400 block font-bold">
                          Title
                        </span>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-200 mt-0.5">{title}</p>
                      </div>
                      {amountStr && (
                        <div className="text-right">
                          <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-600 dark:text-emerald-500 block font-bold">
                            Amount
                          </span>
                          <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{amountStr}</p>
                        </div>
                      )}
                    </div>
                    {requisition?.description && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-2 leading-relaxed">
                        {requisition.description}
                      </p>
                    )}
                  </div>

                  {/* Requester Details Card */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono block">
                      1. Requester Info
                    </span>
                    <div className="bg-slate-50 dark:bg-slate-950/80 border border-indigo-200 dark:border-indigo-950/60 rounded-2xl p-3.5 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5 font-bold">
                        <User size={18} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{requesterName}</p>
                        {requesterEmail && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{requesterEmail}</p>
                        )}
                        <div className="flex items-center gap-2 pt-1 flex-wrap text-[10px]">
                          <span className="px-2 py-0.5 bg-indigo-50 dark:bg-slate-850 text-indigo-700 dark:text-indigo-300 rounded-md font-medium border border-indigo-100 dark:border-slate-800">
                            {groupName}
                          </span>
                          {submittedAt && (
                            <span className="text-slate-500 font-mono">
                              Submitted: {submittedAt}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Approvers Clearance Cards */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono block">
                      2. Approvers Clearance Level
                    </span>
                    <div className="space-y-2.5">
                      {/* Level 1 Approver */}
                      <div className={`border rounded-2xl p-3.5 space-y-2 transition-all ${
                        isL1Approved ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase font-mono flex items-center gap-1">
                            <ShieldCheck size={13} className={isL1Approved ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"} />
                            Level 1 (Group Leader)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black font-mono uppercase ${
                            isL1Approved ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30" : "bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/20"
                          }`}>
                            {isL1Approved ? "Verified & Endorsed" : "Pending L1"}
                          </span>
                        </div>
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-200">
                            {l1Note?.approverName || (requisition?.approvedAtL1 ? "Level 1 Official" : "Presbytery Official")}
                          </p>
                          {requisition?.approvedAtL1 && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Approved: {formatDate(requisition.approvedAtL1)}
                            </p>
                          )}
                          {l1Note?.note && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-900/80 p-2 rounded-lg mt-1 border border-slate-200 dark:border-slate-800/60">
                              "{l1Note.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Level 2 Approver */}
                      <div className={`border rounded-2xl p-3.5 space-y-2 transition-all ${
                        isL2Approved ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase font-mono flex items-center gap-1">
                            <ShieldCheck size={13} className={isL2Approved ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"} />
                            Level 2 (Finance / Treasurer)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black font-mono uppercase ${
                            isL2Approved ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30" : "bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/20"
                          }`}>
                            {isL2Approved ? "Authorized for Payout" : "Pending L2"}
                          </span>
                        </div>
                        <div className="text-xs space-y-0.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-200">
                            {l2Note?.approverName || (requisition?.approvedAtL2 ? "Finance Treasurer" : "Finance Officer")}
                          </p>
                          {requisition?.approvedAtL2 && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Authorized: {formatDate(requisition.approvedAtL2)}
                            </p>
                          )}
                          {l2Note?.note && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-900/80 p-2 rounded-lg mt-1 border border-slate-200 dark:border-slate-800/60">
                              "{l2Note.note}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Disbursing Status */}
                      {isDisbursed && (
                        <div className="border bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/40 rounded-2xl p-3.5 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase font-mono flex items-center gap-1">
                              <Coins size={13} />
                              Payout Settlement
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-black font-mono uppercase bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30">
                              Disbursed
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                            {disburseNote?.approverName || "PCE St. Andrews Treasury"}
                          </p>
                          {requisition?.disbursedAt && (
                            <p className="text-[10px] text-slate-500 font-mono">
                              Settlement Date: {formatDate(requisition.disbursedAt)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Updated Members & Audit History */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 font-mono block">
                      3. Involved Members & History Log ({membersInvolved.length})
                    </span>
                    <div className="space-y-2">
                      {membersInvolved.map((m, idx) => (
                        <div key={`member-${idx}`} className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex items-start gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs shrink-0 mt-0.5">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{m.name}</p>
                              <span className="text-[8px] font-mono px-1.5 py-0.2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 rounded uppercase font-bold shrink-0">
                                {m.role}
                              </span>
                            </div>
                            <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">{m.action}</p>
                            {m.timestamp && (
                              <p className="text-[9px] text-slate-500 font-mono mt-0.5">{m.timestamp}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === highlight.toLowerCase() 
          ? <mark key={i} className="bg-amber-200 text-amber-900 rounded-px px-px font-bold underline decoration-amber-500/30 decoration-2">{part}</mark> 
          : part
      )}
    </>
  );
};

export const RequisitionInstallmentScheduleBreakdown: React.FC<{ req: Requisition; compact?: boolean }> = ({ req, compact = false }) => {
  const { currentUser } = useRequisitions();
  const installments = req.installments || [];
  if (installments.length === 0) return null;

  const totalPlanned = installments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0) || req.amount;
  const paidAmount = installments.filter(i => i.status === "DISBURSED").reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const remainingAmount = Math.max(0, totalPlanned - paidAmount);
  const paidCount = installments.filter(i => i.status === "DISBURSED").length;
  const totalCount = installments.length;
  const pct = Math.round((paidAmount / (totalPlanned || 1)) * 100);
  const isFullySettled = paidCount === totalCount;

  if (compact) {
    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-1 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span>Milestone Breakdown</span>
          <span className="font-mono text-emerald-600 dark:text-emerald-400">{paidCount}/{totalCount} Disbursed</span>
        </div>
        <div className="space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800/80">
          {installments.map((inst, idx) => {
            const isDisbursed = inst.status === "DISBURSED";
            const instPct = inst.percentage || Math.round(((Number(inst.amount) || 0) / (totalPlanned || 1)) * 100);

            return (
              <div key={inst.id || idx} className={cn("pt-1.5 first:pt-0 flex items-start justify-between gap-2", isDisbursed && "text-emerald-700 dark:text-emerald-300")}>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-4 h-4 rounded-full flex items-center justify-center font-mono font-bold text-[8px] shrink-0 border",
                      isDisbursed ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {inst.installmentNumber || idx + 1}
                    </span>
                    <span className="font-bold text-[10px] text-slate-800 dark:text-slate-200 truncate">
                      {inst.title || inst.description || `Installment #${inst.installmentNumber || idx + 1}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[8.5px] text-slate-400 dark:text-slate-500 font-mono">
                    <span>Due: {inst.dueDate ? formatDate(inst.dueDate) : "On demand"}</span>
                    {isDisbursed && inst.disbursementReference && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">• Ref: {inst.disbursementReference}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-[10px] text-slate-900 dark:text-slate-100 block">
                    {formatCurrency(inst.amount)}
                  </span>
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-[7.5px] font-black uppercase px-1.5 py-0.2 rounded-full",
                    isDisbursed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  )}>
                    {isDisbursed ? <Check size={7} className="stroke-[3]" /> : <Clock size={7} />}
                    {isDisbursed ? "Paid" : "Pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 bg-white dark:bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "p-2 rounded-xl border shrink-0",
            isFullySettled 
              ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800" 
              : "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800"
          )}>
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Phased Installment Schedule
              </h5>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest font-mono",
                isFullySettled 
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
              )}>
                {paidCount} of {totalCount} Installments Disbursed ({pct}%)
              </span>
            </div>
            <p className="text-[9.5px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              Structured multi-milestone disbursement ledger for approved high-value requisition
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
          <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl font-bold">
            Settled: {formatCurrency(paidAmount)}
          </span>
          <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl font-bold">
            Remaining: {formatCurrency(remainingAmount)}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/60">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/70 dark:bg-slate-900 text-[8.5px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
              <th className="px-3.5 py-2.5">Milestone #</th>
              <th className="px-3.5 py-2.5">Phase Title / Description</th>
              <th className="px-3.5 py-2.5 text-right">Planned Amount</th>
              <th className="px-3.5 py-2.5">Scheduled Due Date</th>
              <th className="px-3.5 py-2.5 text-center">Status</th>
              <th className="px-3.5 py-2.5">Settlement Audit Trail</th>
              <th className="px-3.5 py-2.5 text-right">Voucher</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
            {installments.map((inst, idx) => {
              const isDisbursed = inst.status === "DISBURSED";
              const instPct = inst.percentage || Math.round(((Number(inst.amount) || 0) / (totalPlanned || 1)) * 100);

              return (
                <tr 
                  key={inst.id || idx}
                  className={cn(
                    "transition-colors text-[11px]",
                    isDisbursed ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "hover:bg-white/70 dark:hover:bg-slate-900/40"
                  )}
                >
                  <td className="px-3.5 py-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                    <span className={cn(
                      "w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-[9px] shrink-0 border",
                      isDisbursed 
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" 
                        : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      #{inst.installmentNumber || idx + 1}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {inst.title || `Phase ${inst.installmentNumber || idx + 1}`}
                    </p>
                    {inst.description && inst.description !== inst.title && (
                      <p className="text-[9.5px] text-slate-400 dark:text-slate-500 line-clamp-1 max-w-sm">{inst.description}</p>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                    <span>{formatCurrency(inst.amount)}</span>
                    <span className="text-[9px] font-normal text-slate-400 dark:text-slate-500 ml-1">({instPct}%)</span>
                  </td>
                  <td className="px-3.5 py-2.5 text-[10px] font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {inst.dueDate ? formatDate(inst.dueDate) : "On demand"}
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider",
                      isDisbursed 
                        ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                    )}>
                      {isDisbursed ? <Check size={10} className="stroke-[3]" /> : <Clock size={10} />}
                      {inst.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-[10px]">
                    {isDisbursed ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                          <span>{inst.paymentMethod || inst.disbursementMethod || "Cheque"}</span>
                          {inst.disbursementReference && (
                            <span className="font-mono text-[9px] bg-emerald-100/90 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-700">
                              Ref: {inst.disbursementReference}
                            </span>
                          )}
                        </div>
                        {inst.disbursedAt && (
                          <p className="text-[8.5px] font-mono text-slate-400 dark:text-slate-500">
                            Disbursed {formatDate(inst.disbursedAt)} {inst.disbursedByName ? `by ${inst.disbursedByName}` : ""}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[9.5px] text-slate-400 dark:text-slate-500 italic">
                        Pending finance voucher clearance
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => printInstallmentVoucher(req, inst, currentUser)}
                      title={`Print voucher for Installment #${inst.installmentNumber}`}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors"
                    >
                      <Printer size={10} />
                      <span>Print</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const RequisitionsPanel: React.FC = () => {
  const { 
    requisitions, 
    projects,
    deleteRequisition, 
    currentUser, 
    users,
    globalSearchTerm, 
    setGlobalSearchTerm,
    searchFilter,
    canPerform,
    loading,
    systemSettings,
    advancedSearchActive,
    advancedDateRangePreset,
    advancedCustomStartDate,
    advancedCustomEndDate,
    advancedBudgetLine,
    triggerToast
  } = useRequisitions();

  const handleCopyShareLinkForReq = async (req: Requisition) => {
    const rawUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${rawUrl}?reqId=${req.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Direct shareable link for Requisition "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy share link: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy shareable link to clipboard.",
        timestamp: new Date().toISOString()
      });
    }
  };

  // Budget logic
  const activeYear = getActiveFiscalYear();
  const projectSummaries = projects.filter(p => p.fiscalYear === activeYear || (!p.fiscalYear && activeYear === activeYear)).map(proj => {
    const reqs = requisitions.filter(r => 
      r.groupName === proj.groupId && 
      (r.fiscalYear === activeYear || (!r.fiscalYear && activeYear === activeYear))
    );
    const usedAmount = reqs
      .filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED].includes(r.status))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const spentAmount = reqs
      .filter(r => r.status === RequisitionStatus.DISBURSED)
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    return {
      ...proj,
      usedAmount,
      spentAmount,
      percentage: proj.allocatedBudget > 0 ? (usedAmount / proj.allocatedBudget) * 100 : 0
    };
  }).sort((a,b) => b.percentage - a.percentage);

  const [isAdding, setIsAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { selectedRequisition: viewingReq, setSelectedRequisition: setViewingReq } = useRequisitions();
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<Requisition | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterPreset, setFilterPreset] = useState<"ALL" | "URGENT" | "FLAGGED" | "OVERDUE" | "L1_APPROVED" | "UNREAD">("ALL");
  const [dateRangePreset, setDateRangePreset] = useState<"ALL" | "WEEK" | "MONTH" | "CUSTOM">("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
  const [editingReq, setEditingReq] = useState<Requisition | null>(null);
  const [requisitionToDelete, setRequisitionToDelete] = useState<Requisition | null>(null);
  const [isDeletingReq, setIsDeletingReq] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [now, setNow] = useState(Date.now());
  
  // Trending Searches Logic
  const [trendingSearches, setTrendingSearches] = useState<{term: string, count: number}[]>([]);
  const [showTrending, setShowTrending] = useState(false);

  useEffect(() => {
    // Load trending from localStorage on mount
    const saved = localStorage.getItem('trending_requisition_searches');
    if (saved) {
      try {
        setTrendingSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse trending searches", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!globalSearchTerm || globalSearchTerm.length < 3) return;

    const timer = setTimeout(() => {
      setTrendingSearches(prev => {
        const term = globalSearchTerm.trim().toLowerCase();
        const existing = prev.find(t => t.term === term);
        let updated;
        if (existing) {
          updated = prev.map(t => t.term === term ? { ...t, count: t.count + 1 } : t);
        } else {
          updated = [...prev, { term, count: 1 }];
        }
        
        const sorted = updated.sort((a, b) => b.count - a.count).slice(0, 5);
        localStorage.setItem('trending_requisition_searches', JSON.stringify(sorted));
        return sorted;
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [globalSearchTerm]);

  // Pagination state
  const [activePage, setActivePage] = useState(1);
  const [disbursedPage, setDisbursedPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const ITEMS_PER_PAGE = 15;

  // Track expanded installment payment breakdown schedules
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<Set<string>>(new Set());

  const toggleScheduleExpand = (reqId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedScheduleIds(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) {
        next.delete(reqId);
      } else {
        next.add(reqId);
      }
      return next;
    });
  };

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Unread comments tracker
  const { 
    getReqUnreadInfo, 
    markAsRead, 
    markAllAsRead, 
    totalUnreadCount, 
    requisitionsWithUnreadCount 
  } = useUnreadCommentsTracker(requisitions, currentUser, users);

  const projectMap = useMemo(() => {
    const map = new Map<string, typeof projects[0]>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  const filtered = requisitions.filter(req => {
    const term = globalSearchTerm.toLowerCase();
    
    let matchesSearch = false;
    if (!term) {
      matchesSearch = true;
    } else {
      const inTitle = req.title.toLowerCase().includes(term);
      const inGroup = req.groupName.toLowerCase().includes(term);
      const inRequester = req.requesterName?.toLowerCase().includes(term);
      const inId = req.id.toLowerCase().includes(term);

      if (searchFilter === "ALL") {
        matchesSearch = inTitle || inGroup || inRequester || inId;
      } else if (searchFilter === "TITLE") {
        matchesSearch = inTitle;
      } else if (searchFilter === "GROUP") {
        matchesSearch = inGroup;
      } else if (searchFilter === "REQUESTER") {
        matchesSearch = inRequester;
      }
    }

    const matchesStatus = filterStatus === "ALL" || req.status === filterStatus;
    
    const matchesDateRange = () => {
      const activePreset = advancedSearchActive ? advancedDateRangePreset : dateRangePreset;
      const activeStart = advancedSearchActive ? advancedCustomStartDate : customStartDate;
      const activeEnd = advancedSearchActive ? advancedCustomEndDate : customEndDate;

      if (activePreset === "ALL") return true;
      const submittedTime = req.submittedAt ? new Date(req.submittedAt).getTime() : (req.updatedAt ? new Date(req.updatedAt).getTime() : 0);
      const nowTime = Date.now();
      
      if (activePreset === "WEEK") {
        const oneWeekAgo = nowTime - 7 * 24 * 60 * 60 * 1000;
        return submittedTime >= oneWeekAgo;
      }
      if (activePreset === "MONTH") {
        const oneMonthAgo = nowTime - 30 * 24 * 60 * 60 * 1000;
        return submittedTime >= oneMonthAgo;
      }
      if (activePreset === "CUSTOM") {
        let matches = true;
        if (activeStart) {
          const start = new Date(activeStart + "T00:00:00").getTime();
          matches = matches && submittedTime >= start;
        }
        if (activeEnd) {
          const end = new Date(activeEnd + "T23:59:59").getTime();
          matches = matches && submittedTime <= end;
        }
        return matches;
      }
      return true;
    };

    const matchesPreset = () => {
      if (filterPreset === "ALL") return true;
      if (filterPreset === "UNREAD") return getReqUnreadInfo(req).hasUnread;
      if (filterPreset === "FLAGGED") return req.flaggedForAudit === true;
      if (filterPreset === "L1_APPROVED") return req.status === RequisitionStatus.APPROVED_L1;
      if (filterPreset === "OVERDUE") {
        const days = Math.ceil(Math.abs(Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
        return days > 3 && (req.status === RequisitionStatus.SUBMITTED || req.status === RequisitionStatus.APPROVED_L1);
      }
      if (filterPreset === "URGENT") {
        const hoursRemaining = req.expiresAt ? (new Date(req.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60) : null;
        return (hoursRemaining !== null && hoursRemaining < 48 && hoursRemaining > 0) || req.amount > 20000;
      }
      return true;
    };

    const matchesBudgetLine = () => {
      if (!advancedSearchActive || advancedBudgetLine === "ALL" || !advancedBudgetLine.trim()) return true;
      const budgetLineLower = advancedBudgetLine.toLowerCase();
      const inGroupName = req.groupName.toLowerCase().includes(budgetLineLower);
      const inGroupId = req.groupId?.toLowerCase().includes(budgetLineLower);
      const project = req.projectId ? projectMap.get(req.projectId) : undefined;
      const inProjectName = project ? project.name.toLowerCase().includes(budgetLineLower) : false;
      const inProjectId = req.projectId?.toLowerCase().includes(budgetLineLower);
      return inGroupName || inGroupId || inProjectName || inProjectId;
    };

    const canSee = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN || req.groupId === currentUser?.group;
    
    return matchesSearch && matchesStatus && matchesDateRange() && matchesPreset() && matchesBudgetLine() && canSee;
  }).sort((a, b) => {
    // Priority: submittedAt, then updatedAt, then 0
    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
    return sortDirection === "desc" ? timeB - timeA : timeA - timeB;
  });

  // Split into active, disbursed, and rejected/cancelled
  const activeList = filtered.filter(r => r.status !== RequisitionStatus.DISBURSED && r.status !== RequisitionStatus.REJECTED && r.status !== RequisitionStatus.CANCELLED);
  const disbursedList = filtered.filter(r => r.status === RequisitionStatus.DISBURSED);
  const rejectedList = filtered.filter(r => r.status === RequisitionStatus.REJECTED || r.status === RequisitionStatus.CANCELLED);

  // Paginated slices
  const activeItems = activeList.slice((activePage - 1) * ITEMS_PER_PAGE, activePage * ITEMS_PER_PAGE);
  const disbursedItems = disbursedList.slice((disbursedPage - 1) * ITEMS_PER_PAGE, disbursedPage * ITEMS_PER_PAGE);
  const rejectedItems = rejectedList.slice((rejectedPage - 1) * ITEMS_PER_PAGE, rejectedPage * ITEMS_PER_PAGE);

  const activeTotalPages = Math.max(1, Math.ceil(activeList.length / ITEMS_PER_PAGE));
  const disbursedTotalPages = Math.max(1, Math.ceil(disbursedList.length / ITEMS_PER_PAGE));
  const rejectedTotalPages = Math.max(1, Math.ceil(rejectedList.length / ITEMS_PER_PAGE));

  // Reset pages when filters change
  React.useEffect(() => {
    setActivePage(1);
    setDisbursedPage(1);
    setRejectedPage(1);
  }, [globalSearchTerm, filterStatus, dateRangePreset, customStartDate, customEndDate]);

  const Pagination = ({ current, total, onChange }: { current: number, total: number, onChange: (p: number) => void }) => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 sm:px-6">
      <div className="flex justify-between flex-1 sm:hidden">
        <button
          onClick={() => onChange(Math.max(1, current - 1))}
          disabled={current === 1}
          className="relative inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onChange(Math.min(total, current + 1))}
          disabled={current === total}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className="text-slate-900">{Math.min(total === 0 ? 0 : (current - 1) * ITEMS_PER_PAGE + 1, activeList.length + disbursedList.length)}</span> to <span className="text-slate-900">{Math.min(current * ITEMS_PER_PAGE, total === 0 ? 0 : 99999)}</span> of <span className="text-slate-900">{total * ITEMS_PER_PAGE > 0 ? "..." : 0}</span> results
          </p>
        </div>
        <div>
          <nav className="inline-flex -space-x-px rounded-md shadow-sm isolate" aria-label="Pagination">
            <button
              onClick={() => onChange(Math.max(1, current - 1))}
              disabled={current === 1}
              className="relative inline-flex items-center px-2 py-2 text-slate-400 border border-slate-300 rounded-l-md hover:bg-slate-50 focus:z-20 disabled:opacity-30"
            >
              <span className="sr-only">Previous</span>
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            {[...Array(total)].map((_, i) => (
              <button
                key={i}
                onClick={() => onChange(i + 1)}
                className={cn(
                  "relative inline-flex items-center px-4 py-2 text-xs font-black uppercase tracking-widest border focus:z-20",
                  current === i + 1
                    ? "z-10 bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-slate-300 text-slate-500 hover:bg-slate-50"
                )}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => onChange(Math.min(total, current + 1))}
              disabled={current === total}
              className="relative inline-flex items-center px-2 py-2 text-slate-400 border border-slate-300 rounded-r-md hover:bg-slate-50 focus:z-20 disabled:opacity-30"
            >
              <span className="sr-only">Next</span>
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );

  const getStatusColor = (status: RequisitionStatus) => {
    switch (status) {
      case RequisitionStatus.APPROVED_L2: return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case RequisitionStatus.DISBURSED: return "bg-blue-50 text-blue-600 border-blue-100";
      case RequisitionStatus.SUBMITTED: return "bg-amber-50 text-amber-600 border-amber-100";
      case RequisitionStatus.REJECTED: return "bg-rose-50 text-rose-600 border-rose-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkPrint = () => {
    const selectedReqs = requisitions.filter(r => selectedIds.has(r.id));
    printRequisitions(selectedReqs, "Consolidated Transaction Report", currentUser);
  };

  const handleBulkExportCsv = () => {
    const selectedReqs = requisitions.filter(r => selectedIds.has(r.id));
    downloadRequisitionsCsv(selectedReqs, "Bulk_Export_Transactions");
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || isBulkDeleting) return;
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} requisition(s)?`)) {
      setIsBulkDeleting(true);
      try {
        const count = selectedIds.size;
        const ids = Array.from(selectedIds);
        for (const id of ids) {
          await deleteRequisition(id);
        }
        setSelectedIds(new Set());
        if (triggerToast) {
          triggerToast({
            type: "SYSTEM_INFO",
            severity: "LOW",
            message: `Successfully deleted ${count} requisition(s).`,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err: any) {
        console.error("Bulk delete failed:", err);
        if (triggerToast) {
          triggerToast({
            type: "SECURITY_UPDATE",
            severity: "HIGH",
            message: err?.message || "Failed to delete selected requisitions.",
            timestamp: new Date().toISOString()
          });
        }
      } finally {
        setIsBulkDeleting(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8 animate-pulse p-4 md:p-8">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-48 bg-slate-100 rounded-md"></div>
          </div>
          <div className="flex gap-2">
             <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
             <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
             <div className="h-10 w-32 bg-slate-200 rounded-xl"></div>
          </div>
        </div>

        {/* Filter bar skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 flex-1 bg-slate-200 rounded-xl border border-slate-100"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl hidden md:block"></div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl hidden md:block"></div>
        </div>

        {/* Table skeleton */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
           <div className="h-8 bg-slate-100/50 rounded-xl mb-6"></div>
           {[...Array(6)].map((_, i) => (
             <div key={i} className="h-16 bg-slate-100/50 rounded-2xl border border-slate-100/80"></div>
           ))}
        </div>
      </div>
    );
  }

  if (viewingReq) {
    return (
      <RequisitionDetailModal 
        req={viewingReq} 
        onClose={() => setViewingReq(null)} 
        onDelete={() => {
          setRequisitionToDelete(viewingReq);
          setViewingReq(null);
        }}
        onGenerateReceipt={() => {
          setIsGeneratingReceipt(viewingReq);
        }}
        onEdit={() => {
          setEditingReq(viewingReq);
          setViewingReq(null);
        }}
        isPage={true}
      />
    );
  }

  if (editingReq) {
    return (
      <NewRequisitionForm 
        editReq={editingReq} 
        onClose={() => setEditingReq(null)} 
        isPage={true}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in transition-all duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Requisitions</h2>
          <p className="text-sm text-slate-500">Master ledger for all ministry group funding requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex bg-white border border-slate-200 rounded-xl shadow-sm">
             <button 
              onClick={() => printRequisitions(filtered, "Requisition Ledger", currentUser)}
              className="p-2.5 hover:bg-slate-50 border-r border-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Print Ledger"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="p-2.5 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
              title="Download Data"
            >
              <Download size={16} />
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 text-left">
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
                    Export Filtered Table ({filtered.length} transactions)
                  </div>
                  <button
                    onClick={() => {
                      downloadRequisitionsPdf(filtered, "Requisitions List Ledger", currentUser);
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Download PDF Document
                  </button>
                  <button
                    onClick={() => {
                      downloadRequisitionsCsv(filtered, "Requisitions List Ledger");
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Download CSV Sheet
                  </button>
                  <button
                    onClick={() => {
                      downloadRequisitionsHtml(filtered, "Requisitions List Ledger", currentUser);
                      setShowExportDropdown(false);
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
          
          {canPerform('canCreateRequisition') && (
            systemSettings?.fiscalYearStatus === "ARCHIVED" ? (
              <button 
                onClick={() => alert("This financial period is ARCHIVED. Creation of new requisitions is disabled.")}
                className="opacity-50 btn-primary flex items-center gap-2 cursor-not-allowed bg-slate-400 hover:bg-slate-400 border-none"
              >
                <Plus size={18} />
                ARCHIVED PERIOD
              </button>
            ) : (
              <button 
                onClick={() => setIsAdding(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} />
                NEW REQUISITION
              </button>
            )
          )}
        </div>
      </div>

      {systemSettings?.fiscalYearStatus === "ARCHIVED" && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-400 animate-in slide-in-from-top duration-300">
          <div className="p-2 bg-amber-500/15 rounded-xl">
            <History className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-0.5 animate-in fade-in">
            <p className="text-xs font-black uppercase tracking-wider">ARCHIVED FINANCIAL PERIOD VIEW</p>
            <p className="text-[10px] opacity-90 leading-relaxed">
              This financial period ({systemSettings?.currentFiscalYear}) has been **ARCHIVED**. All historical transactions are preserved in a read-only ledger. Editing, deletions, and operational state changes are suspended.
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterPreset("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer",
              filterPreset === "ALL" 
                ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            )}
          >
            Show All
          </button>
          <button
            onClick={() => setFilterPreset("URGENT")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "URGENT" 
                ? "bg-amber-500 text-white border-amber-500 shadow-sm" 
                : "bg-white text-amber-600 border-amber-200 hover:bg-amber-50"
            )}
          >
            <AlertTriangle size={12} />
            Urgent
          </button>
          <button
            onClick={() => setFilterPreset("FLAGGED")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "FLAGGED" 
                ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                : "bg-white text-rose-600 border-rose-200 hover:bg-rose-50"
            )}
          >
            <Flag size={12} />
            Flagged
          </button>
          <button
            onClick={() => setFilterPreset("OVERDUE")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "OVERDUE" 
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            )}
          >
            <History size={12} />
            Approvals Overdue
          </button>
          <button
            onClick={() => setFilterPreset("L1_APPROVED")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-2",
              filterPreset === "L1_APPROVED" 
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                : "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            )}
          >
            <CheckCircle size={12} />
            L1 Approved
          </button>
          <button
            onClick={() => setFilterPreset("UNREAD")}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer flex items-center gap-1.5",
              filterPreset === "UNREAD" 
                ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                : totalUnreadCount > 0
                  ? "bg-rose-50/80 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 animate-pulse"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            <MessageSquare size={12} className={totalUnreadCount > 0 ? "fill-rose-500 text-rose-500" : ""} />
            <span>Unread Threads</span>
            {totalUnreadCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[8.5px] font-mono font-black",
                filterPreset === "UNREAD" ? "bg-white text-rose-700" : "bg-rose-600 text-white"
              )}>
                {totalUnreadCount}
              </span>
            )}
          </button>
          {requisitionsWithUnreadCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAllAsRead();
              }}
              title="Mark all discussion threads as read"
              className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-300 transition-all flex items-center gap-1 cursor-pointer ml-auto sm:ml-0"
            >
              <Check size={11} className="text-rose-500" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search documents..." 
            className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
            onFocus={() => setShowTrending(true)}
            onBlur={() => setTimeout(() => setShowTrending(false), 200)}
          />
          
          {/* Trending Searches Dropdown */}
          <AnimatePresence>
            {showTrending && trendingSearches.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
              >
                <div className="p-3 border-bottom border-slate-50 flex items-center gap-2">
                  <TrendingUp size={12} className="text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trending Searches</span>
                </div>
                <div className="flex flex-col p-1">
                  {trendingSearches.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setGlobalSearchTerm(item.term);
                        setShowTrending(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-between group"
                    >
                      <span className="font-medium">"{item.term}"</span>
                      <span className="text-[9px] text-slate-400 group-hover:text-primary transition-colors bg-slate-50 px-1.5 py-0.5 rounded uppercase font-bold">
                        {item.count} searches
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[130px]">
            <Filter size={12} className="text-slate-400" />
            <select 
              className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">ALL STATUSES</option>
              {Object.values(RequisitionStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Date Range Preset Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 min-w-[150px]">
            <CalendarDays size={12} className="text-slate-400" />
            <select 
              className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
            >
              <option value="ALL">ALL TIME</option>
              <option value="WEEK">LAST WEEK</option>
              <option value="MONTH">LAST MONTH</option>
              <option value="CUSTOM">CUSTOM RANGE</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {dateRangePreset === "CUSTOM" && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 animate-fadeIn">
              <input 
                type="date"
                title="Start Date"
                className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer border-none p-0 focus:ring-0 w-24"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span className="text-[9px] text-slate-400 font-black uppercase">to</span>
              <input 
                type="date"
                title="End Date"
                className="bg-transparent text-[10px] font-bold text-slate-600 outline-none cursor-pointer border-none p-0 focus:ring-0 w-24"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="Clear Custom Dates"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Clock size={16} className="text-primary" />
            Active Requisitions 
            <span className="text-[10px] text-slate-400 normal-case font-medium ml-2">({activeList.length} total)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                    checked={activeList.length > 0 && activeList.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allActiveInSelected = activeList.every(r => selectedIds.has(r.id));
                      const newSelected = new Set(selectedIds);
                      activeList.forEach(r => {
                        if (allActiveInSelected) newSelected.delete(r.id);
                        else newSelected.add(r.id);
                      });
                      setSelectedIds(newSelected);
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2">
                    ID & Title
                    <button 
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 group text-primary whitespace-nowrap cursor-pointer"
                      title={sortDirection === "desc" ? "Switch to Newest Last" : "Switch to Newest First"}
                    >
                      <ArrowUpDown size={12} className={cn("transition-transform", sortDirection === "asc" && "rotate-180")} />
                      <span className="text-[7px] text-slate-400 font-bold group-hover:text-primary">{sortDirection === "desc" ? "DESC" : "ASC"}</span>
                    </button>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Requisition Ownership</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Days Old</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {activeItems.flatMap((req, i) => {
                  const updateAge = now - new Date(req.updatedAt).getTime();
                  const isRecentlyApprovedOrDisbursed = (req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) && updateAge < 8000;
                  const formattedAge = formatRequisitionAge(req.submittedAt || req.createdAt, req.status);
                  const compactAge = formatRequisitionAge(req.submittedAt || req.createdAt, req.status, { compact: true });

                  const hasInstallments = Boolean(req.installments && req.installments.length > 0);
                  const paidInstallments = hasInstallments ? req.installments!.filter(inst => inst.status === "DISBURSED").length : 0;
                  const totalInstallments = hasInstallments ? req.installments!.length : 0;
                  const isScheduleExpanded = expandedScheduleIds.has(req.id);
                  const paidAmount = hasInstallments ? req.installments!.filter(inst => inst.status === "DISBURSED").reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) : 0;
                  const totalPlannedAmount = hasInstallments ? (req.installments!.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) || req.amount) : req.amount;
                  const installmentProgressPct = hasInstallments ? Math.round((paidAmount / (totalPlannedAmount || 1)) * 100) : 0;

                  const mainRow = (
                    <motion.tr 
                      key={req.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ 
                          opacity: 1, 
                          y: 0,
                          backgroundColor: isRecentlyApprovedOrDisbursed ? "rgba(16, 185, 129, 0.08)" : undefined
                        }}
                        exit={{ opacity: 0, scale: 0.95, y: -15 }}
                        transition={{ 
                          opacity: { duration: 0.2 },
                          layout: { type: "spring", stiffness: 300, damping: 30 },
                          y: { type: "spring", stiffness: 300, damping: 30 }
                        }}
                        onClick={() => setViewingReq(req)}
                        className={cn(
                          "transition-colors group cursor-pointer border-l-2",
                          selectedIds.has(req.id) ? "bg-primary/5 border-l-primary" : 
                          isRecentlyApprovedOrDisbursed 
                            ? "border-l-emerald-500 shadow-[inset_4px_0_0_0_#10b981]" 
                            : "hover:bg-slate-50/80 border-l-transparent"
                        )}
                      >
                        <td className="px-4 md:px-6 py-2.5 md:py-4" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer"
                            checked={selectedIds.has(req.id)}
                            onChange={() => toggleSelect(req.id)}
                          />
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-4">
                          <div className="flex flex-col min-w-0 max-w-full md:max-w-none space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                              {getReqUnreadInfo(req).hasUnread && (
                                <span 
                                  title={`${getReqUnreadInfo(req).unreadCount} unread comment${getReqUnreadInfo(req).unreadCount === 1 ? "" : "s"}${getReqUnreadInfo(req).unreadAuthors.length > 0 ? ` from ${getReqUnreadInfo(req).unreadAuthors.join(", ")}` : ""}`}
                                  className="inline-flex items-center gap-1 text-[8px] md:text-[9px] font-black text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 shadow-2xs animate-pulse"
                                >
                                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600"></span>
                                  </span>
                                  <MessageSquare size={10} className="fill-rose-500 text-rose-600" />
                                  {getReqUnreadInfo(req).unreadCount} NEW
                                </span>
                              )}
                              <span className="font-bold text-slate-900 text-xs md:text-sm break-words leading-snug">
                                <HighlightText text={req.title} highlight={globalSearchTerm} />
                              </span>
                              {compactAge && (
                                <span className="text-[8px] md:text-[9px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0">
                                  {compactAge}
                                </span>
                              )}
                              {req.flaggedForAudit && (
                                <span title="Flagged for Audit" className="inline-flex shrink-0">
                                  <Flag size={11} className="text-rose-500 fill-rose-500" />
                                </span>
                              )}
                              {req.inProcurement && (
                                <span className="text-[8px] md:text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0">
                                  PROCUREMENT
                                </span>
                              )}
                              {req.requiresMoreInfo && (
                                <span className="text-[8px] md:text-[9px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0">
                                  INFO REQ
                                </span>
                              )}
                              {req.recurrence && req.recurrence !== "NONE" && (
                                <Repeat size={10} className="text-primary animate-pulse shrink-0" />
                              )}
                              {req.attachments && req.attachments.length > 0 && (
                                <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                  <Paperclip size={10} />
                                  {req.attachments.length}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[8px] md:text-[10px]">
                              <span className="font-mono text-slate-400 uppercase tracking-wider shrink-0">{req.id}</span>
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50/80 border border-indigo-200/50 text-indigo-700 rounded-md font-extrabold uppercase tracking-wider leading-none shrink-0">
                                💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                              </span>
                              <span className="inline-block lg:hidden text-slate-500 font-semibold truncate max-w-[140px]">
                                • {req.requesterName}
                              </span>
                            </div>

                            {/* Phased Installment Progress Badge & Toggle */}
                            {hasInstallments && (
                              <div className="mt-1 flex flex-wrap items-center gap-2 pt-0.5">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-50/90 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/60 rounded-md text-[9px]">
                                  <Layers size={11} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                  <span className="font-black uppercase tracking-wider text-purple-900 dark:text-purple-200 font-mono text-[8.5px]">
                                    {paidInstallments}/{totalInstallments} Disbursed
                                  </span>
                                  <div className="w-14 sm:w-16 h-1.5 bg-purple-200/80 dark:bg-purple-900/60 rounded-full overflow-hidden shrink-0">
                                    <div 
                                      className="h-full bg-purple-600 dark:bg-purple-400 transition-all duration-500 rounded-full" 
                                      style={{ width: `${Math.min(100, Math.max(0, installmentProgressPct))}%` }}
                                    />
                                  </div>
                                  <span className="text-[8px] font-mono font-bold text-purple-700 dark:text-purple-300">
                                    {installmentProgressPct}%
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => toggleScheduleExpand(req.id, e)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-purple-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-md text-[8.5px] font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                                >
                                  <Split size={9} className={cn("transition-transform duration-200", isScheduleExpanded && "rotate-180")} />
                                  <span>{isScheduleExpanded ? "Hide Schedule" : "View Schedule"}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-bold text-[11px] md:text-xs">
                              {req.requesterName}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-[8px]">
                              {req.groupName}
                            </span>
                            <RequisitionOwnershipDiscussionRow req={req} users={users} />
                          </div>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                          <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                        </td>
                        <td className="px-3 md:px-6 py-2.5 md:py-4">
                          <div className="flex justify-center">
                            <span className={cn(
                              "px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] shrink-0",
                              getStatusColor(req.status)
                            )}>
                              {req.status}
                            </span>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                          {formattedAge ? (
                            <div className="flex items-center gap-1.5">
                              <Clock size={11} className="text-slate-400" />
                              <span className="text-[10px] md:text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                {formattedAge}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingReq(req);
                              }}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyShareLinkForReq(req);
                              }}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                              title="Copy Shareable Link"
                            >
                              <Share2 size={16} />
                            </button>
                            {/* Edit button: Drafts can be edited by requester or admin/super-admin, others only if admin, rejected can NEVER be edited */}
                            {req.status !== RequisitionStatus.REJECTED && (
                              canPerform('canDeleteRequisition') || 
                              (req.status === RequisitionStatus.DRAFT && (req.requesterId === currentUser?.id || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN))
                            ) && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingReq(req);
                                }}
                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-amber-500 transition-all"
                                title="Edit Requisition"
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            {/* Delete button: only admins */}
                            {canPerform('canDeleteRequisition') && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRequisitionToDelete(req);
                                }}
                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-rose-500 transition-all"
                                title="Delete Permanently"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );

                    if (hasInstallments && isScheduleExpanded) {
                      const expandedRow = (
                        <motion.tr 
                          key={`${req.id}-schedule-expanded`} 
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="bg-purple-50/30 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/40"
                        >
                          <td colSpan={7} className="p-3 md:p-4 pl-8 md:pl-12" onClick={(e) => e.stopPropagation()}>
                            <RequisitionInstallmentScheduleBreakdown req={req} />
                          </td>
                        </motion.tr>
                      );
                      return [mainRow, expandedRow];
                    }

                    return [mainRow];
                  })}
              </AnimatePresence>
            </tbody>
            {activeList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Total Active Requisitions
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-rose-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(activeList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({activeList.length} items total)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Mobile Cards View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {activeItems.map((req) => {
              const updateAge = now - new Date(req.updatedAt).getTime();
              const isRecentlyApprovedOrDisbursed = (req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) && updateAge < 8000;
              const formattedAge = formatRequisitionAge(req.submittedAt || req.createdAt, req.status);
              const compactAge = formatRequisitionAge(req.submittedAt || req.createdAt, req.status, { compact: true });
              
              const hasInstallments = Boolean(req.installments && req.installments.length > 0);
              const paidInstallments = hasInstallments ? req.installments!.filter(inst => inst.status === "DISBURSED").length : 0;
              const totalInstallments = hasInstallments ? req.installments!.length : 0;
              const isScheduleExpanded = expandedScheduleIds.has(req.id);
              const paidAmount = hasInstallments ? req.installments!.filter(inst => inst.status === "DISBURSED").reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) : 0;
              const totalPlannedAmount = hasInstallments ? (req.installments!.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) || req.amount) : req.amount;
              const installmentProgressPct = hasInstallments ? Math.round((paidAmount / (totalPlannedAmount || 1)) * 100) : 0;

              const canEdit = req.status !== RequisitionStatus.REJECTED && (
                canPerform('canDeleteRequisition') || 
                (req.status === RequisitionStatus.DRAFT && (req.requesterId === currentUser?.id || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN))
              );

              return (
                <div 
                  key={req.id}
                  onClick={() => setViewingReq(req)}
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-3 relative border-l-4",
                    selectedIds.has(req.id) ? "bg-primary/5 border-l-primary" : 
                    isRecentlyApprovedOrDisbursed ? "border-l-emerald-500 bg-emerald-50/10" : "border-l-transparent hover:border-l-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 accent-primary cursor-pointer shrink-0"
                          checked={selectedIds.has(req.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(req.id);
                          }}
                        />
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          {req.id}
                        </span>
                        {req.flaggedForAudit && (
                          <Flag size={11} className="text-rose-500 fill-rose-500" />
                        )}
                        {req.attachments && req.attachments.length > 0 && (
                          <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            <Paperclip size={10} />
                            {req.attachments.length}
                          </span>
                        )}
                        {getReqUnreadInfo(req).hasUnread && (
                          <span 
                            title={`${getReqUnreadInfo(req).unreadCount} unread comment(s)`}
                            className="inline-flex items-center gap-1 text-[8px] font-black text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 shadow-2xs animate-pulse"
                          >
                            <span className="relative flex h-1.5 w-1.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-600"></span>
                            </span>
                            <MessageSquare size={9} className="fill-rose-500 text-rose-600" />
                            {getReqUnreadInfo(req).unreadCount} NEW
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        <HighlightText text={req.title} highlight={globalSearchTerm} />
                      </h4>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-[0.1em] shrink-0",
                      getStatusColor(req.status)
                    )}>
                      {req.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[9px] font-extrabold uppercase tracking-wider w-fit">
                        💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold truncate">
                        By {req.requesterName}
                      </span>
                      <RequisitionOwnershipDiscussionRow req={req} users={users} />
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatCurrency(req.amount)}
                      </span>
                      {compactAge && (
                        <span className="text-[9px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {compactAge}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Phased Installment Progress & Schedule Toggle for Mobile Cards */}
                  {hasInstallments && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className="p-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                            <Layers size={11} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-[8.5px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-200 font-mono mb-1">
                              <span>Installments: {paidInstallments}/{totalInstallments} Disbursed</span>
                              <span>{installmentProgressPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-600 dark:bg-purple-400 transition-all duration-500 rounded-full" 
                                style={{ width: `${Math.min(100, Math.max(0, installmentProgressPct))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleScheduleExpand(req.id, e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800 rounded-lg text-[8.5px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          <Split size={9} className={cn("transition-transform duration-200", isScheduleExpanded && "rotate-180")} />
                          <span>{isScheduleExpanded ? "Hide" : "View Schedule"}</span>
                        </button>
                      </div>

                      <AnimatePresence>
                        {isScheduleExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden pt-1"
                          >
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
                              <RequisitionInstallmentScheduleBreakdown req={req} compact />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Mobile Actions block */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setViewingReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                    <button 
                      onClick={() => handleCopyShareLinkForReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Share2 size={12} />
                      <span>Share</span>
                    </button>
                    {canEdit && (
                      <button 
                        onClick={() => setEditingReq(req)}
                        className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 hover:text-amber-650 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                      >
                        <Pencil size={12} />
                        <span>Edit</span>
                      </button>
                    )}
                    {canPerform('canDeleteRequisition') && (
                      <button 
                        onClick={() => setRequisitionToDelete(req)}
                        className="p-2 bg-slate-50 border border-slate-200 hover:bg-rose-50 rounded-xl text-slate-600 hover:text-rose-650 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Card List Summary Block */}
          {activeList.length > 0 && (
            <div className="block md:hidden p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between font-bold text-slate-800 text-xs">
              <span className="font-black uppercase tracking-wider">Total Active Requisitions</span>
              <div className="text-right">
                <p className="font-mono text-rose-600 font-extrabold text-sm">{formatCurrency(activeList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">{activeList.length} items total</p>
              </div>
            </div>
          )}

          {activeList.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search size={24} className="text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No matching active requisitions</h3>
              <p className="text-xs text-slate-400 mt-2">Adjust your filters or initiate a new request transaction.</p>
            </div>
          )}
        </div>
        {activeTotalPages > 1 && (
          <Pagination 
            current={activePage} 
            total={activeTotalPages} 
            onChange={setActivePage} 
          />
        )}
      </div>

      {/* Disbursed Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-blue-50/30">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle size={16} className="text-blue-600" />
            Disbursed History
            <span className="text-[10px] text-slate-400 normal-case font-medium ml-2">({disbursedList.length} total)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer"
                    checked={disbursedList.length > 0 && disbursedList.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allDisbursedInSelected = disbursedList.every(r => selectedIds.has(r.id));
                      const newSelected = new Set(selectedIds);
                      disbursedList.forEach(r => {
                        if (allDisbursedInSelected) newSelected.delete(r.id);
                        else newSelected.add(r.id);
                      });
                      setSelectedIds(newSelected);
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2">
                    ID & Title
                    <button 
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 group text-blue-600 whitespace-nowrap cursor-pointer"
                      title={sortDirection === "desc" ? "Switch to Newest Last" : "Switch to Newest First"}
                    >
                      <ArrowUpDown size={12} className={cn("transition-transform", sortDirection === "asc" && "rotate-180")} />
                      <span className="text-[7px] text-slate-400 font-bold group-hover:text-blue-600">{sortDirection === "desc" ? "DESC" : "ASC"}</span>
                    </button>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Requisition Ownership</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Date Disbursed</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {disbursedItems.flatMap((req, i) => {
                  const hasInstallments = Boolean(req.installments && req.installments.length > 0);
                  const paidInstallments = hasInstallments ? req.installments!.filter(inst => inst.status === "DISBURSED").length : 0;
                  const totalInstallments = hasInstallments ? req.installments!.length : 0;
                  const isScheduleExpanded = expandedScheduleIds.has(req.id);
                  const paidAmount = hasInstallments ? req.installments!.filter(inst => inst.status === "DISBURSED").reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) : 0;
                  const totalPlannedAmount = hasInstallments ? (req.installments!.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) || req.amount) : req.amount;
                  const installmentProgressPct = hasInstallments ? Math.round((paidAmount / (totalPlannedAmount || 1)) * 100) : 0;

                  const mainRow = (
                    <motion.tr 
                      key={req.id} 
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -15 }}
                      transition={{ 
                        opacity: { duration: 0.2 },
                        layout: { type: "spring", stiffness: 300, damping: 30 },
                        y: { type: "spring", stiffness: 300, damping: 30 }
                      }}
                      onClick={() => setViewingReq(req)}
                      className={cn(
                        "transition-colors group cursor-pointer border-l-2",
                        selectedIds.has(req.id) ? "bg-blue-50/50 border-l-blue-600" : "hover:bg-slate-50/80 border-l-transparent"
                      )}
                    >
                      <td className="px-4 md:px-6 py-2.5 md:py-4" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer"
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                        />
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4">
                        <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-none">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-[11px] md:text-sm truncate">
                              <HighlightText text={req.title} highlight={globalSearchTerm} />
                            </span>
                            {req.flaggedForAudit && (
                              <span title="Flagged for Audit" className="inline-flex shrink-0">
                                <Flag size={11} className="text-rose-500 fill-rose-500" />
                              </span>
                            )}
                            {req.attachments && req.attachments.length > 0 && (
                              <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                                <Paperclip size={10} />
                                {req.attachments.length}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                            <span className="text-[7.5px] md:text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate shrink-0">{req.id}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-50/80 border border-blue-200/50 text-blue-700 rounded-md text-[7.5px] md:text-[9px] font-extrabold uppercase tracking-wider leading-none w-fit">
                              💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                            </span>
                          </div>

                          {/* Phased Installment Progress & Schedule Toggle */}
                          {hasInstallments && (
                            <div className="mt-1 flex flex-wrap items-center gap-2 pt-0.5">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-50/90 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/60 rounded-md text-[9px]">
                                <Layers size={11} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                <span className="font-black uppercase tracking-wider text-purple-900 dark:text-purple-200 font-mono text-[8.5px]">
                                  {paidInstallments}/{totalInstallments} Disbursed
                                </span>
                                <div className="w-14 sm:w-16 h-1.5 bg-purple-200/80 dark:bg-purple-900/60 rounded-full overflow-hidden shrink-0">
                                  <div 
                                    className="h-full bg-purple-600 dark:bg-purple-400 transition-all duration-500 rounded-full" 
                                    style={{ width: `${Math.min(100, Math.max(0, installmentProgressPct))}%` }}
                                  />
                                </div>
                                <span className="text-[8px] font-mono font-bold text-purple-700 dark:text-purple-300">
                                  {installmentProgressPct}%
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => toggleScheduleExpand(req.id, e)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white hover:bg-purple-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-md text-[8.5px] font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                              >
                                <Split size={9} className={cn("transition-transform duration-200", isScheduleExpanded && "rotate-180")} />
                                <span>{isScheduleExpanded ? "Hide Schedule" : "View Schedule"}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold text-[11px] md:text-xs">
                            {req.requesterName}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-[8px]">
                            {req.groupName}
                          </span>
                          <RequisitionOwnershipDiscussionRow req={req} users={users} />
                        </div>
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                        <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4">
                        <div className="flex justify-center">
                          <span className="px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border border-blue-100 bg-blue-50 text-blue-600 text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] shrink-0">
                            {req.status}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                        <span className="text-[9px] md:text-[10px] font-mono font-bold text-slate-500">
                          {formatDate(req.updatedAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingReq(req);
                            }}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyShareLinkForReq(req);
                            }}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                            title="Copy Shareable Link"
                          >
                            <Share2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );

                  if (hasInstallments && isScheduleExpanded) {
                    const expandedRow = (
                      <motion.tr 
                        key={`${req.id}-disbursed-schedule-expanded`} 
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-purple-50/30 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/40"
                      >
                        <td colSpan={7} className="p-3 md:p-4 pl-8 md:pl-12" onClick={(e) => e.stopPropagation()}>
                          <RequisitionInstallmentScheduleBreakdown req={req} />
                        </td>
                      </motion.tr>
                    );
                    return [mainRow, expandedRow];
                  }

                  return [mainRow];
                })}
              </AnimatePresence>
            </tbody>
            {disbursedList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Total Disbursed Funds
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-blue-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(disbursedList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({disbursedList.length} items history)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Mobile Cards View */}
          <div className="block md:hidden divide-y divide-slate-100">
            {disbursedItems.map((req) => {
              const hasInstallments = Boolean(req.installments && req.installments.length > 0);
              const paidInstallments = hasInstallments ? req.installments!.filter(inst => inst.status === "DISBURSED").length : 0;
              const totalInstallments = hasInstallments ? req.installments!.length : 0;
              const isScheduleExpanded = expandedScheduleIds.has(req.id);
              const paidAmount = hasInstallments ? req.installments!.filter(inst => inst.status === "DISBURSED").reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) : 0;
              const totalPlannedAmount = hasInstallments ? (req.installments!.reduce((sum, inst) => sum + (Number(inst.amount) || 0), 0) || req.amount) : req.amount;
              const installmentProgressPct = hasInstallments ? Math.round((paidAmount / (totalPlannedAmount || 1)) * 100) : 0;

              return (
                <div 
                  key={req.id}
                  onClick={() => setViewingReq(req)}
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-3 relative border-l-4",
                    selectedIds.has(req.id) ? "bg-blue-50/50 border-l-blue-600" : "border-l-transparent hover:border-l-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 accent-blue-600 cursor-pointer shrink-0"
                          checked={selectedIds.has(req.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(req.id);
                          }}
                        />
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          {req.id}
                        </span>
                        {req.flaggedForAudit && (
                          <Flag size={11} className="text-rose-500 fill-rose-500" />
                        )}
                        {req.attachments && req.attachments.length > 0 && (
                          <span title="Attachments" className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                            <Paperclip size={10} />
                            {req.attachments.length}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        <HighlightText text={req.title} highlight={globalSearchTerm} />
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full border border-blue-100 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-[0.1em] shrink-0">
                      {req.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50/80 border border-blue-200/50 text-blue-700 rounded-md text-[9px] font-extrabold uppercase tracking-wider w-fit">
                        💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold truncate">
                        By {req.requesterName}
                      </span>
                      <RequisitionOwnershipDiscussionRow req={req} users={users} />
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatCurrency(req.amount)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                        Disbursed: {formatDate(req.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Phased Installment Progress & Schedule Toggle for Mobile Cards */}
                  {hasInstallments && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className="p-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                            <Layers size={11} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between text-[8.5px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-200 font-mono mb-1">
                              <span>Installments: {paidInstallments}/{totalInstallments} Disbursed</span>
                              <span>{installmentProgressPct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-purple-100 dark:bg-purple-900/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-purple-600 dark:bg-purple-400 transition-all duration-500 rounded-full" 
                                style={{ width: `${Math.min(100, Math.max(0, installmentProgressPct))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleScheduleExpand(req.id, e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800 rounded-lg text-[8.5px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          <Split size={9} className={cn("transition-transform duration-200", isScheduleExpanded && "rotate-180")} />
                          <span>{isScheduleExpanded ? "Hide" : "View Schedule"}</span>
                        </button>
                      </div>

                      <AnimatePresence>
                        {isScheduleExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden pt-1"
                          >
                            <div className="p-3 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
                              <RequisitionInstallmentScheduleBreakdown req={req} compact />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Mobile Actions block */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setViewingReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                    <button 
                      onClick={() => handleCopyShareLinkForReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Share2 size={12} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Card List Summary Block */}
          {disbursedList.length > 0 && (
            <div className="block md:hidden p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between font-bold text-slate-800 text-xs">
              <span className="font-black uppercase tracking-wider">Total Disbursed Funds</span>
              <div className="text-right">
                <p className="font-mono text-blue-600 font-extrabold text-sm">{formatCurrency(disbursedList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}</p>
                <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">{disbursedList.length} items history</p>
              </div>
            </div>
          )}

          {disbursedList.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <History size={24} className="text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No disbursed requisitions</h3>
              <p className="text-xs text-slate-400 mt-2">Disbursed items will appear here for historical archiving.</p>
            </div>
          )}
        </div>
        {disbursedTotalPages > 1 && (
          <Pagination 
            current={disbursedPage} 
            total={disbursedTotalPages} 
            onChange={setDisbursedPage} 
          />
        )}
      </div>

      {/* Rejected & Cancelled Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/30">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <XCircle size={16} className="text-rose-600" />
            Rejected & Cancelled Requisitions
            <span className="text-[10px] text-slate-400 normal-case font-medium ml-2">({rejectedList.length} total)</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="hidden md:table w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 accent-rose-600 cursor-pointer"
                    checked={rejectedList.length > 0 && rejectedList.every(r => selectedIds.has(r.id))}
                    onChange={() => {
                      const allRejectedInSelected = rejectedList.every(r => selectedIds.has(r.id));
                      const newSelected = new Set(selectedIds);
                      rejectedList.forEach(r => {
                        if (allRejectedInSelected) newSelected.delete(r.id);
                        else newSelected.add(r.id);
                      });
                      setSelectedIds(newSelected);
                    }}
                  />
                </th>
                <th className="px-4 md:px-6 py-3 md:py-4">
                  <div className="flex items-center gap-2">
                    ID & Title
                    <button 
                      onClick={() => setSortDirection(prev => prev === "asc" ? "desc" : "asc")}
                      className="p-1 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1 group text-rose-600 whitespace-nowrap cursor-pointer"
                      title={sortDirection === "desc" ? "Switch to Newest Last" : "Switch to Newest First"}
                    >
                      <ArrowUpDown size={12} className={cn("transition-transform", sortDirection === "asc" && "rotate-180")} />
                      <span className="text-[7px] text-slate-400 font-bold group-hover:text-rose-600">{sortDirection === "desc" ? "DESC" : "ASC"}</span>
                    </button>
                  </div>
                </th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Requisition Ownership</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Date Updated</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {rejectedItems.map((req) => (
                  <motion.tr 
                    key={req.id} 
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -15 }}
                    transition={{ 
                      opacity: { duration: 0.2 },
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                      y: { type: "spring", stiffness: 300, damping: 30 }
                    }}
                    onClick={() => setViewingReq(req)}
                    className={cn(
                      "transition-colors group cursor-pointer border-l-2",
                      selectedIds.has(req.id) ? "bg-rose-50/50 border-l-rose-600" : "hover:bg-slate-50/80 border-l-transparent"
                    )}
                  >
                    <td className="px-4 md:px-6 py-2.5 md:py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 accent-rose-600 cursor-pointer"
                        checked={selectedIds.has(req.id)}
                        onChange={() => toggleSelect(req.id)}
                      />
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-none">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-[11px] md:text-sm truncate">
                            <HighlightText text={req.title} highlight={globalSearchTerm} />
                          </span>
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={11} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                          <span className="text-[7.5px] md:text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate shrink-0">{req.id}</span>
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-rose-50/80 border border-rose-200/50 text-rose-700 rounded-md text-[7.5px] md:text-[9px] font-extrabold uppercase tracking-wider leading-none w-fit">
                            💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                          </span>
                        </div>
                        {req.rejectionReason && (
                          <p className="text-[10px] text-rose-600 mt-1 italic truncate max-w-xs">
                            Reason: {req.rejectionReason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                      <div className="flex flex-col">
                        <span className="text-slate-900 font-bold text-[11px] md:text-xs">
                          {req.requesterName}
                        </span>
                        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                          {req.groupName}
                        </span>
                        <RequisitionOwnershipDiscussionRow req={req} users={users} />
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                      <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex justify-center">
                        <span className="px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border border-rose-100 bg-rose-50 text-rose-600 text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] shrink-0">
                          {req.status}
                        </span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                      <span className="text-[9px] md:text-[10px] font-mono font-bold text-slate-500">
                        {formatDate(req.updatedAt)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingReq(req);
                          }}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyShareLinkForReq(req);
                          }}
                          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 transition-all"
                          title="Copy Shareable Link"
                        >
                          <Share2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
            {rejectedList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Total Rejected / Cancelled Value
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-rose-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(rejectedList.reduce((sum, r) => sum + (Number(r.amount) || 0), 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({rejectedList.length} items rejected/cancelled)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Mobile Cards View for Rejected */}
          <div className="block md:hidden divide-y divide-slate-100">
            {rejectedItems.map((req) => {
              return (
                <div 
                  key={req.id}
                  onClick={() => setViewingReq(req)}
                  className={cn(
                    "p-4 hover:bg-slate-50 transition-colors cursor-pointer space-y-3 relative border-l-4",
                    selectedIds.has(req.id) ? "bg-rose-50/50 border-l-rose-600" : "border-l-transparent hover:border-l-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500/20 accent-rose-600 cursor-pointer shrink-0"
                          checked={selectedIds.has(req.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(req.id);
                          }}
                        />
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          {req.id}
                        </span>
                        {req.flaggedForAudit && (
                          <Flag size={11} className="text-rose-500 fill-rose-500" />
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        <HighlightText text={req.title} highlight={globalSearchTerm} />
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full border border-rose-100 bg-rose-50 text-rose-600 text-[8px] font-black uppercase tracking-[0.1em] shrink-0">
                      {req.status}
                    </span>
                  </div>

                  {req.rejectionReason && (
                    <p className="text-[10px] text-rose-600 italic bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                      Reason: {req.rejectionReason}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50/80 border border-rose-200/50 text-rose-700 rounded-md text-[9px] font-extrabold uppercase tracking-wider w-fit">
                        💒 <HighlightText text={req.groupName} highlight={globalSearchTerm} />
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold truncate">
                        By {req.requesterName}
                      </span>
                      <RequisitionOwnershipDiscussionRow req={req} users={users} />
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="font-mono font-black text-slate-900 text-sm">
                        {formatCurrency(req.amount)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                        Updated: {formatDate(req.updatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => setViewingReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Eye size={12} />
                      <span>Details</span>
                    </button>
                    <button 
                      onClick={() => handleCopyShareLinkForReq(req)}
                      className="p-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-1.5 font-bold text-[9px] uppercase tracking-wider"
                    >
                      <Share2 size={12} />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {rejectedList.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100">
                <XCircle size={20} className="text-slate-300" />
              </div>
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">No rejected or cancelled requisitions</h3>
              <p className="text-[11px] text-slate-400 mt-1">Rejected and cancelled items will appear here.</p>
            </div>
          )}
        </div>
        {rejectedTotalPages > 1 && (
          <Pagination 
            current={rejectedPage} 
            total={rejectedTotalPages} 
            onChange={setRejectedPage} 
          />
        )}
      </div>

      {/* Budget Status Summaries */}
      {projectSummaries.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-6 mt-6">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Activity size={14} className="text-indigo-500" />
            Budget Allocations FY {activeYear}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projectSummaries.map((proj) => {
              const capHit = proj.percentage >= 100;
              const nearCap = proj.percentage > 85 && !capHit;
              
              return (
                <div key={proj.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 transition-colors hover:bg-slate-100/50">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-bold text-slate-900 truncate pr-2">{proj.groupId}</p>
                    <div className={cn(
                      "text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider",
                      capHit ? "bg-rose-100 text-rose-700" :
                      nearCap ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {proj.percentage.toFixed(0)}% Used
                    </div>
                  </div>
                  <div className="flex justify-between items-end mb-1">
                    <div className="flex flex-col">
                      <p className="text-lg font-black text-slate-900 tracking-tight leading-none">{formatCurrency(proj.usedAmount)}</p>
                      <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                        Spent: {formatCurrency(proj.spentAmount)}
                      </p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">/ {formatCurrency(proj.allocatedBudget)}</p>
                  </div>
                  
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-3">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(proj.percentage, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        capHit ? "bg-rose-500" :
                        nearCap ? "bg-amber-500" :
                        "bg-emerald-500"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 border border-slate-800 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-6 backdrop-blur-xl"
          >
            <div className="flex items-center gap-4 pr-6 border-r border-white/10">
              <div className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center font-black text-lg border border-primary/20">
                {selectedIds.size}
              </div>
              <div className="hidden md:block">
                <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-white/90">Items Selected</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Consolidated Batch Ready</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkPrint}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark rounded-xl transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95"
              >
                <Printer size={16} />
                Download PDF Reports
              </button>
              <button
                onClick={handleBulkExportCsv}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 border border-white/5"
              >
                <Download size={16} className="text-emerald-400" />
                Export Table
              </button>
              {canPerform('canDeleteRequisition') && (
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50"
                >
                  {isBulkDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  <span>{isBulkDeleting ? `Deleting (${selectedIds.size})...` : "Delete Selected"}</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              title="Clear Selection"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal for Adding */}
      <AnimatePresence>
        {isAdding && <NewRequisitionForm onClose={() => setIsAdding(false)} />}
      </AnimatePresence>

      {/* Modal for Details */}
      <AnimatePresence>
        {viewingReq && (
          <RequisitionDetailModal 
            req={viewingReq} 
            onClose={() => setViewingReq(null)} 
            onDelete={() => {
              setRequisitionToDelete(viewingReq);
              setViewingReq(null);
            }}
            onGenerateReceipt={() => {
              setIsGeneratingReceipt(viewingReq);
            }}
            onEdit={() => {
              setEditingReq(viewingReq);
              setViewingReq(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal for Editing */}
      <AnimatePresence>
        {editingReq && (
          <NewRequisitionForm 
            editReq={editingReq} 
            onClose={() => setEditingReq(null)} 
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {requisitionToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 dark:border-slate-800 text-center space-y-6"
            >
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 border border-rose-100 dark:border-rose-900/50 rounded-full flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Confirm Deletion</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to permanently delete requisition <strong className="text-slate-800 dark:text-slate-200 font-bold">{requisitionToDelete.title}</strong>? This action is irreversible and will erase the financial ledger entry.
                </p>
              </div>

              {isDeletingReq && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold animate-pulse">
                  <Loader2 size={16} className="animate-spin text-rose-600 dark:text-rose-400" />
                  <span>Deleting requisition record from database...</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  disabled={isDeletingReq}
                  onClick={() => setRequisitionToDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  disabled={isDeletingReq}
                  onClick={async () => {
                    if (isDeletingReq) return;
                    setIsDeletingReq(true);
                    try {
                      const deletedTitle = requisitionToDelete.title;
                      await deleteRequisition(requisitionToDelete.id);
                      if (triggerToast) {
                        triggerToast({
                          type: "SYSTEM_INFO",
                          severity: "LOW",
                          message: `Requisition "${deletedTitle}" deleted successfully.`,
                          timestamp: new Date().toISOString()
                        });
                      }
                      setRequisitionToDelete(null);
                    } catch (err: any) {
                      console.error("Delete failed:", err);
                      if (triggerToast) {
                        triggerToast({
                          type: "SECURITY_UPDATE",
                          severity: "HIGH",
                          message: err?.message || "Failed to delete requisition.",
                          timestamp: new Date().toISOString()
                        });
                      }
                    } finally {
                      setIsDeletingReq(false);
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 dark:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeletingReq ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>{isDeletingReq ? "Deleting..." : "Confirm Delete"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Receipt Generator */}
      <AnimatePresence>
        {isGeneratingReceipt && (
          <ReceiptTemplateGenerator 
            req={isGeneratingReceipt} 
            onClose={() => setIsGeneratingReceipt(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export interface DetailModalProps {
  req: Requisition;
  onClose: () => void;
  onDelete: () => void;
  onGenerateReceipt: () => void;
  onEdit?: () => void;
  isPage?: boolean;
}

export const RequisitionDetailModal: React.FC<DetailModalProps> = ({ req: initialReq, onClose, onDelete, onGenerateReceipt, onEdit, isPage }) => {
  const { currentUser, updateRequisitionStatus, updateRequisition, sendEmailNotification, uploadReceipts, globalSearchTerm, projects, triggerToast, vendors, requisitions, users, addAlert, canPerform } = useRequisitions();
  const req = requisitions.find(r => r.id === initialReq.id) || initialReq;
  const normalizedAttachments = React.useMemo(() => {
    const fromReq = safeNormalizeAttachments(req.attachments);
    if (fromReq.length > 0) return fromReq;
    return safeNormalizeAttachments(initialReq.attachments);
  }, [req.attachments, initialReq.attachments]);
  const [decisionNote, setDecisionNote] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [showDecisionForm, setShowDecisionForm] = useState<"APPROVE" | "REJECT" | "ESCALATE" | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark comments as read when requisition detail is viewed
  useEffect(() => {
    if (req?.id && currentUser) {
      markRequisitionCommentsAsRead(req.id, currentUser);
    }
  }, [req?.id, req?.comments?.length, currentUser]);
  const [loading, setLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isTimelineMinimizedManually, setIsTimelineMinimizedManually] = useState<boolean | null>(null);
  const isTimelineMinimized = isTimelineMinimizedManually !== null ? isTimelineMinimizedManually : (previewIndex !== null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [showAssignConfirm, setShowAssignConfirm] = useState(false);
  const [isGroupVerified, setIsGroupVerified] = useState(false);
  const [isAmountVerified, setIsAmountVerified] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [lastAddedEmail, setLastAddedEmail] = useState<string | null>(null);
  const decisionFormRef = useRef<HTMLDivElement>(null);

  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  // Comments & Threaded Discussion states
  const [optimisticComments, setOptimisticComments] = useState<any[] | null>(null);

  // Synchronize optimisticComments whenever req.comments or req.id changes from source
  useEffect(() => {
    setOptimisticComments(null);
  }, [req.comments, req.id]);

  const effectiveComments = React.useMemo(() => {
    return optimisticComments ?? (Array.isArray(req.comments) ? req.comments : []);
  }, [optimisticComments, req.comments]);

  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string; text: string } | null>(null);
  const [inlineReplyCommentId, setInlineReplyCommentId] = useState<string | null>(null);
  const [inlineReplyText, setInlineReplyText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);
  const [reactionDetailModalData, setReactionDetailModalData] = useState<{
    commentId: string;
    reactions: any[];
    isReply?: boolean;
  } | null>(null);
  const [reactionModalActiveTab, setReactionModalActiveTab] = useState<string>("ALL");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  // Ensure requisition detail page/modal always displays starting from the top
  useEffect(() => {
    if (leftPanelRef.current) leftPanelRef.current.scrollTop = 0;
    if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0;
    if (modalScrollRef.current) modalScrollRef.current.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [req.id]);

  const pendingReactionMapRef = useRef<Record<string, boolean>>({});

  const handleToggleReaction = (commentId: string, emoji: string) => {
    try {
      if (pendingReactionMapRef.current[commentId]) {
        console.log(`[Reaction Throttle] Click ignored: reaction update already in progress for comment ${commentId}`);
        return;
      }
      pendingReactionMapRef.current[commentId] = true;

      const currentComments = effectiveComments;
      let loggedActionResult: { action: string; previousEmoji?: string } = { action: 'TOGGLED' };

      const processReactionsUpdate = (item: any, targetId: string) => {
        // Execute pure logic handler
        const result = handleReactionLogic({
          item,
          targetEmoji: emoji,
          currentUser,
          users
        });

        loggedActionResult = { action: result.action, previousEmoji: result.previousEmoji };

        console.log(`[Reaction State Transition: Target ${targetId}]`, {
          action: result.action,
          targetId,
          user: { id: currentUser?.id, name: currentUser?.name, email: currentUser?.email },
          previousEmoji: result.previousEmoji,
          newEmoji: emoji,
          reactionsCount: result.newReactions.length,
          reactions: result.newReactions,
          reactionCounts: result.updatedItem.reactionCounts
        });

        return result.updatedItem;
      };

      const updatedComments = currentComments.map((c: any) => {
        if (c.id === commentId) {
          return processReactionsUpdate(c, commentId);
        }

        // Check if comment has nested replies
        if (Array.isArray(c.replies) && c.replies.some((r: any) => r.id === commentId)) {
          const updatedReplies = c.replies.map((reply: any) => {
            if (reply.id === commentId) {
              return processReactionsUpdate(reply, commentId);
            }
            return reply;
          });
          return {
            ...c,
            replies: updatedReplies
          };
        }

        return c;
      });

      // 1. Instantaneous optimistic update in UI (0ms latency)
      setOptimisticComments(updatedComments);

      console.log(`[Reaction State Transition: Persisting to Database]`, {
        requisitionId: req.id,
        targetCommentId: commentId,
        emoji,
        totalComments: updatedComments.length
      });

      // 2. Dispatch background persistence to Requisition
      updateRequisition(req.id, { comments: updatedComments }).then(() => {
        console.log(`[Reaction State Transition: Successfully Persisted to Database]`, {
          requisitionId: req.id,
          targetCommentId: commentId
        });

        // 3. Persist reaction history record to MongoDB user_reaction_histories collection
        const historyId = `rh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        databaseService.saveReactionHistory({
          id: historyId,
          requisitionId: req.id,
          commentId,
          userId: currentUser?.id || "anonymous",
          userName: resolveSenderName(currentUser, users) || currentUser?.name || currentUser?.email || "User",
          userEmail: currentUser?.email || "",
          emoji,
          action: loggedActionResult.action,
          timestamp: new Date().toISOString(),
          previousEmoji: loggedActionResult.previousEmoji || null
        }).catch(err => console.error("[Reaction History DB Log Failed]", err));

      }).catch(err => {
        console.error(`[Reaction State Transition: Database Persistence Failed]`, err);
        setOptimisticComments(null); // Rollback on persistence error
      }).finally(() => {
        pendingReactionMapRef.current[commentId] = false;
      });
    } catch (err) {
      console.error(`[Reaction State Transition: Failed]`, err);
      pendingReactionMapRef.current[commentId] = false;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Eagerly pre-warm PDF attachment thumbnails into global memory cache
  useEffect(() => {
    if (req && Array.isArray(req.attachments)) {
      req.attachments.forEach((att: any) => {
        const attUrl = typeof att === "string" ? att : (att?.url || "");
        if (attUrl && (attUrl.toLowerCase().includes(".pdf") || attUrl.startsWith("data:application/pdf"))) {
          preloadPdfThumbnail(attUrl).catch(() => {});
        }
      });
    }
  }, [req]);

  const filteredMentionUsers = React.useMemo(() => {
    if (mentionSearch === null) return [];
    const searchLower = mentionSearch.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(searchLower) || 
      u.email.toLowerCase().includes(searchLower)
    ).slice(0, 5);
  }, [mentionSearch, users]);

  const insertMention = (user: any) => {
    if (mentionIndex === -1) return;
    
    const beforeMention = commentText.substring(0, mentionIndex);
    const mentionText = `@${user.name} `;
    const afterCursor = commentText.substring(mentionIndex + (mentionSearch?.length || 0) + 1);
    
    setCommentText(beforeMention + mentionText + afterCursor);
    setMentionSearch(null);
    setMentionIndex(-1);
    
    if (commentTextareaRef.current) {
      commentTextareaRef.current.focus();
    }
  };

  const handleCommentTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const selectionStart = e.target.selectionStart || 0;
    const textBeforeCursor = val.substring(0, selectionStart);
    const words = textBeforeCursor.split(/[\s\n]/);
    const lastWord = words[words.length - 1];

    if (lastWord && lastWord.startsWith("@")) {
      const search = lastWord.substring(1);
      setMentionSearch(search);
      setMentionIndex(textBeforeCursor.lastIndexOf("@"));
    } else {
      setMentionSearch(null);
      setMentionIndex(-1);
    }
  };

  const handleAddComment = async (eOrCustomText?: React.FormEvent | string, customParent?: { id: string; authorName: string; text: string }) => {
    if (eOrCustomText && typeof eOrCustomText !== "string" && typeof (eOrCustomText as any).preventDefault === "function") {
      (eOrCustomText as React.FormEvent).preventDefault();
    }

    if (isSubmittingComment) return;

    const textToSubmit = typeof eOrCustomText === "string" ? eOrCustomText : commentText;
    const trimmed = textToSubmit.trim();
    if (!trimmed) return;

    setIsSubmittingComment(true);

    // Resolve author name cleanly and consistently from user profile
    const calculatedAuthorName = resolveSenderName(currentUser, users) || currentUser?.name || currentUser?.email || "User";
    const authorPhoto = currentUser?.photoURL || (currentUser as any)?.avatarUrl || "";
    const parent = customParent || replyingTo;

    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      authorId: currentUser?.id || "anonymous",
      authorName: calculatedAuthorName,
      authorEmail: currentUser?.email || "",
      authorRole: currentUser?.role || "USER",
      authorAvatar: authorPhoto,
      authorPhotoURL: authorPhoto,
      text: trimmed,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      parentId: parent ? parent.id : null,
      ...(parent ? { replyTo: { id: parent.id, authorName: parent.authorName, text: parent.text } } : {}),
      reactions: []
    };
    
    const currentComments = effectiveComments;
    const updatedComments = [...currentComments, newComment];

    // Optimistically update local UI & reset form fields instantly
    setOptimisticComments(updatedComments);
    setCommentText("");
    setInlineReplyText("");
    setInlineReplyCommentId(null);
    setMentionSearch(null);
    setMentionIndex(-1);
    setReplyingTo(null);
    setShowEmojiPicker(false);

    try {
      await updateRequisition(req.id, { comments: updatedComments });

      const authorEmail = currentUser?.email?.toLowerCase() || "";
      const authorId = currentUser?.id || "";

      const mentionedUsers = users.filter(user => {
        if (user.id === authorId || user.email?.toLowerCase() === authorEmail) return false;
        
        const nameMention = `@${user.name.toLowerCase()}`;
        const emailMention = `@${user.email?.toLowerCase()}`;
        const cleanText = trimmed.toLowerCase();
        
        return cleanText.includes(nameMention) || (user.email && cleanText.includes(emailMention));
      });

      for (const u of mentionedUsers) {
        addAlert({
          type: "SYSTEM_INFO",
          severity: "MEDIUM",
          message: `${calculatedAuthorName} mentioned you in a comment on Requisition "${req.title}" (ID: ${req.id}): "${trimmed.length > 55 ? trimmed.substring(0, 55) + '...' : trimmed}"`,
          targetUserId: u.id
        }).catch(() => {});

        if (u.email) {
          sendEmailNotification(
            req,
            "Comment Mention",
            `"${trimmed}"`,
            calculatedAuthorName,
            u.email,
            u.name
          ).catch(err => console.error("Failed to send mention email to", u.email, err));
        }
      }

      let requesterEmail = req.requesterEmail;
      let requesterName = req.requesterName;
      if (!requesterEmail) {
        const rUser = users.find(usr => usr.id === req.requesterId || usr.name === req.requesterName);
        if (rUser) {
          requesterEmail = rUser.email;
          requesterName = rUser.name;
        }
      }

      const receiversMap = new Map<string, string>();
      
      if (
        requesterEmail && 
        requesterEmail.toLowerCase() !== authorEmail && 
        !mentionedUsers.some(mu => mu.email?.toLowerCase() === requesterEmail?.toLowerCase())
      ) {
        receiversMap.set(requesterEmail.toLowerCase(), requesterName || "Requester");
      }

      const notificationEmailsList = req.notificationEmails || (req as any).notification_emails || [];
      if (Array.isArray(notificationEmailsList)) {
        notificationEmailsList.forEach(emailStr => {
          if (emailStr && typeof emailStr === "string") {
            const cleanEmail = emailStr.trim().toLowerCase();
            if (
              cleanEmail && 
              cleanEmail !== authorEmail && 
              !mentionedUsers.some(mu => mu.email?.toLowerCase() === cleanEmail)
            ) {
              const matchedUser = users.find(usr => usr.email?.toLowerCase() === cleanEmail);
              receiversMap.set(cleanEmail, matchedUser?.name || "Subscriber");
            }
          }
        });
      }

      for (const [recEmail, recName] of receiversMap.entries()) {
        sendEmailNotification(
          req,
          "New Comment Thread Activity",
          `"${trimmed}"`,
          calculatedAuthorName,
          recEmail,
          recName
        ).catch(err => console.error("Failed to send comment update email to", recEmail, err));
      }
    } catch (err) {
      console.error("Failed to persist comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: string, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    try {
      const currentComments = effectiveComments;
      const updatedComments = currentComments.map(c => 
        c.id === commentId ? { ...c, text: trimmed, isEdited: true, editedAt: new Date().toISOString() } : c
      );
      setOptimisticComments(updatedComments);
      setEditingCommentId(null);
      setEditingCommentText("");
      await updateRequisition(req.id, { comments: updatedComments });
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: "Comment updated.",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to update comment:", err);
      setOptimisticComments(null);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to update comment.",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const currentComments = effectiveComments;
      const updatedComments = currentComments.filter(c => c.id !== commentId);
      setOptimisticComments(updatedComments);
      await updateRequisition(req.id, { comments: updatedComments });
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: "Comment deleted.",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to delete comment:", err);
      setOptimisticComments(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50";
      case "ADMIN":
        return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50";
      case "APPROVER_L2":
        return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50";
      case "APPROVER_L1":
        return "bg-teal-100 text-teal-850 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50";
      case "FINANCE":
        return "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  const handleAddMember = async (emailToAdd: string) => {
    const norm = emailToAdd.trim().toLowerCase();
    if (!norm || !norm.includes("@") || !norm.includes(".")) {
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Please enter a valid email address.",
        timestamp: new Date().toISOString()
      });
      return;
    }

    const currentList = Array.isArray(req.notificationEmails) ? req.notificationEmails : [];
    if (currentList.some(e => (e || "").trim().toLowerCase() === norm)) {
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: "This email is already receiving updates.",
        timestamp: new Date().toISOString()
      });
      return;
    }

    setIsSavingMember(true);
    try {
      const updated = [...currentList, norm];
      await updateRequisition(req.id, { notificationEmails: updated });
      setLastAddedEmail(norm);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Added ${norm} to update recipients.`,
        timestamp: new Date().toISOString()
      });
      setNewMemberEmail("");
      setIsInputFocused(false);
    } catch (err) {
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to add member to recipients.",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleRemoveMember = async (emailToRemove: string) => {
    const norm = emailToRemove.trim().toLowerCase();
    const currentList = Array.isArray(req.notificationEmails) ? req.notificationEmails : [];
    const updated = currentList.filter(e => (e || "").trim().toLowerCase() !== norm);

    setIsSavingMember(true);
    try {
      await updateRequisition(req.id, { notificationEmails: updated });
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Removed ${norm} from update recipients.`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to remove recipient.",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSavingMember(false);
    }
  };

  const updateRecipients = React.useMemo(() => {
    const rawEmails = new Set<string>();

    if (req.requesterEmail) {
      rawEmails.add(req.requesterEmail.trim().toLowerCase());
    }

    if (Array.isArray(req.notificationEmails)) {
      req.notificationEmails.forEach((email) => {
        const norm = (email || "").trim().toLowerCase();
        if (norm) rawEmails.add(norm);
      });
    }

    if (rawEmails.size === 0 && req.groupName && users) {
      const grpLower = req.groupName.trim().toLowerCase();
      users.forEach((u) => {
        if (!u.email) return;
        const uGrp = (u.group || "").trim().toLowerCase();
        const inGroups = Array.isArray(u.groups) && u.groups.some(g => (g || "").trim().toLowerCase() === grpLower);
        const inDept = (u.department || "").trim().toLowerCase() === grpLower;
        if (uGrp === grpLower || inGroups || inDept) {
          rawEmails.add(u.email.trim().toLowerCase());
        }
      });
    }

    const result: Array<{
      email: string;
      name: string;
      roleOrGroup: string;
      isRequester: boolean;
    }> = [];

    rawEmails.forEach((email) => {
      const matchedUser = users?.find(
        (u) => u.email && u.email.trim().toLowerCase() === email
      );
      const isRequester =
        (req.requesterEmail && req.requesterEmail.trim().toLowerCase() === email) ||
        (matchedUser && matchedUser.name === req.requesterName) ||
        (!matchedUser && email.includes(req.requesterName.toLowerCase()));

      if (matchedUser) {
        result.push({
          email: matchedUser.email,
          name: matchedUser.name || email,
          roleOrGroup: matchedUser.group || matchedUser.department || matchedUser.role || "Member",
          isRequester: Boolean(isRequester)
        });
      } else {
        result.push({
          email,
          name: isRequester ? req.requesterName : email.split("@")[0],
          roleOrGroup: isRequester ? `${req.groupName} (Requester)` : "Notification Recipient",
          isRequester: Boolean(isRequester)
        });
      }
    });

    return result;
  }, [req, users]);

  const emailSuggestions = React.useMemo(() => {
    const search = newMemberEmail.trim().toLowerCase();
    if (!search) return [];

    const existingEmails = new Set(
      updateRecipients.map(r => (r.email || "").trim().toLowerCase())
    );

    return (users || [])
      .filter((u) => {
        if (!u.email) return false;
        const em = u.email.trim().toLowerCase();
        const nm = (u.name || "").trim().toLowerCase();
        return em.includes(search) || nm.includes(search);
      })
      .map((u) => ({
        user: u,
        alreadyAdded: existingEmails.has(u.email.trim().toLowerCase())
      }))
      .slice(0, 6);
  }, [newMemberEmail, users, updateRecipients]);

  useEffect(() => {
    if (showDecisionForm && decisionFormRef.current) {
      decisionFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showDecisionForm]);

  const handleCopyDetails = async () => {
    const formattedAmount = formatCurrency(req.amount);
    const timelineEvents = getConsolidatedTimeline();
    
    let text = `=========================================\n`;
    text += `REQUISITION: ${req.title}\n`;
    text += `=========================================\n`;
    text += `ID: ${req.id}\n`;
    text += `Status: ${req.status}\n`;
    text += `Amount: ${formattedAmount} (${req.amountWords || "N/A"})\n`;
    text += `Group: ${req.groupName || "N/A"}\n`;
    text += `Requester: ${req.requesterName}\n`;
    text += `Submitted At: ${formatDate(req.submittedAt)}\n`;
    text += `Expiry Date: ${req.expiresAt ? formatDate(req.expiresAt) : "N/A"}\n`;
    if (req.recurrence && req.recurrence !== "NONE") {
      text += `Recurrence: ${req.recurrence}\n`;
    }
    text += `\nDescription:\n${req.description}\n\n`;
    
    text += `=========================================\n`;
    text += `TIMELINE & AUDIT HISTORY\n`;
    text += `=========================================\n`;
    
    timelineEvents.forEach((event, idx) => {
      text += `${idx + 1}. ${formatDate(event.timestamp)} - [${event.type}] ${event.title}\n`;
      text += `   Requestor: ${event.actorName}${event.role ? ` (${event.role})` : ""}\n`;
      if (event.note) {
        text += `   Note: "${event.note}"\n`;
      }
      text += `-----------------------------------------\n`;
    });

    try {
      await navigator.clipboard.writeText(text);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Requisition details for "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy clipboard text: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy requisition details to clipboard. Please try again.",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleCopyShareLink = async () => {
    const rawUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${rawUrl}?reqId=${req.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Direct shareable link for Requisition "${req.title}" successfully copied to clipboard!`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to copy share link: ", err);
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "HIGH",
        message: "Failed to copy shareable link to clipboard.",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleCaptureReceipt = async (file: File) => {
    if (req.status !== RequisitionStatus.DISBURSED) {
      triggerToast({
        type: "SECURITY_UPDATE",
        severity: "MEDIUM",
        message: "Receipts can only be attached after all approvals are confirmed and disbursement is done.",
        timestamp: new Date().toISOString()
      });
      return;
    }
    setIsUploadingReceipt(true);
    try {
      let base64data = await compressImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
        mimeType: "image/webp",
      });

      const mime = file.type || "image/jpeg";
      if (!base64data.startsWith("data:")) {
        base64data = `data:${mime};base64,${base64data}`;
      } else if (base64data.startsWith("data:;base64,") || base64data.startsWith("data:undefined;base64,")) {
        base64data = base64data.replace(/^data:[^;]*;base64,/, `data:${mime};base64,`);
      }

      await uploadReceipts(req.id, [base64data]);
    } catch (error) {
      console.error("Error saving captured receipt physical photo:", error);
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const getConsolidatedTimeline = () => {
    interface TimelineEvent {
      id: string;
      timestamp: string;
      title: string;
      subtitle: string;
      type: "CREATED" | "L1_APPROVED" | "L2_APPROVED" | "DISBURSED" | "REJECTED" | "ESCALATED" | "GENERIC";
      actorName: string;
      role?: string;
      note?: string;
      method?: string;
      approvalCode?: string;
    }

    const timeline: TimelineEvent[] = [];

    // 1. Initial Submission
    timeline.push({
      id: "submission",
      timestamp: req.submittedAt,
      title: "Requisition Created",
      subtitle: "Requisition Submitted for approval",
      type: "CREATED",
      actorName: req.requesterName,
      role: "Church Group 代表 (General Rep)"
    });

    // 2. Map existing approvalHistory entries
    const historyArr = Array.isArray(req.approvalHistory) ? req.approvalHistory : [];
    if (historyArr.length > 0) {
      historyArr.forEach((note, idx) => {
        let type: TimelineEvent["type"] = "GENERIC";
        let title = "Process Step Documented";
        let subtitle = `Validated by ${note.approverName}`;

        const decision = note.decision;
        const roleStr = note.role || "";
        
        if (decision === "APPROVE") {
          if (roleStr.includes("L1") || roleStr.includes("APPROVER_L1") || roleStr.toLowerCase().includes("compliance")) {
            type = "L1_APPROVED";
            title = "L1 Approved";
            subtitle = "First level verification & audit clearance";
          } else if (roleStr.includes("L2") || roleStr.includes("APPROVER_L2") || roleStr.toLowerCase().includes("keymaster")) {
            type = "L2_APPROVED";
            title = "L2 Approved";
            subtitle = "Second level consensus consent";
          } else if (roleStr.toLowerCase().includes("finance") || (note.note || "").toLowerCase().includes("disburs") || (note.note || "").toLowerCase().includes("payment")) {
            type = "DISBURSED";
            title = "Requisition Funds Disbursed";
            subtitle = "Financial transaction settled and paid";
          } else {
            type = "GENERIC";
            title = "Validated & Approved";
          }
        } else if (decision === "REJECT") {
          type = "REJECTED";
          title = "Requisition Returned / Rejected";
          subtitle = "Process halted by reviewer";
        } else if (decision === "ESCALATE") {
          type = "ESCALATED";
          title = "Transaction Escalated";
          subtitle = "Review forwarded to higher authority";
        }

        timeline.push({
          id: note.id || `hist-${idx}`,
          timestamp: note.timestamp,
          title,
          subtitle,
          type,
          actorName: note.approverName,
          role: note.role,
          note: note.note,
          method: note.method,
          approvalCode: note.approvalCode
        });
      });
    }

    // 3. Robust checks for explicit timestamps to ensure no missed milestones
    if (req.approvedAtL1 && !timeline.some(t => t.type === "L1_APPROVED")) {
      timeline.push({
        id: "legacy-l1",
        timestamp: req.approvedAtL1,
        title: "L1 Approval Granted",
        subtitle: "First level approval completed",
        type: "L1_APPROVED",
        actorName: "Ministry L1 Approver"
      });
    }

    if (req.approvedAtL2 && !timeline.some(t => t.type === "L2_APPROVED")) {
      timeline.push({
        id: "legacy-l2",
        timestamp: req.approvedAtL2,
        title: "L2 Approval Granted",
        subtitle: "Second level approval cleared",
        type: "L2_APPROVED",
        actorName: "Ministry L2 Approver"
      });
    }

    if (req.disbursedAt && !timeline.some(t => t.type === "DISBURSED")) {
      timeline.push({
        id: "legacy-disbursal",
        timestamp: req.disbursedAt,
        title: "Requisition Funds Disbursed",
        subtitle: "Financial transaction settled and paid",
        type: "DISBURSED",
        actorName: "STANDS Finance Office"
      });
    }

    // Sort chronologically (oldest to newest)
    return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  const handleToggleAuditFlag = async () => {
    try {
      await updateRequisition(req.id, {
        flaggedForAudit: !req.flaggedForAudit
      });
    } catch (error) {
      console.error("Failed to toggle audit flag:", error);
    }
  };

  const canAct = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.SUPER_ADMIN) return true;
    if (canPerform('canApproveL1') && req.status === RequisitionStatus.SUBMITTED) return true;
    if (canPerform('canApproveL2') && (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED)) return true;
    return false;
  };

  const handleDecision = async (decision: "APPROVE" | "REJECT" | "ESCALATE") => {
    setLoading(true);
    try {
      let nextStatus = req.status;
      if (decision === "APPROVE") {
        nextStatus = req.status === RequisitionStatus.SUBMITTED ? RequisitionStatus.APPROVED_L1 : RequisitionStatus.APPROVED_L2;
      } else if (decision === "REJECT") {
        nextStatus = RequisitionStatus.REJECTED;
      } else if (decision === "ESCALATE") {
        nextStatus = RequisitionStatus.ESCALATED;
      }

      await updateRequisitionStatus(
        req.id, 
        nextStatus, 
        decision, 
        decisionNote, 
        "CODE", 
        decision === "REJECT" ? decisionNote : undefined,
        approvalCode
      );
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isSidePreviewOpen = previewIndex !== null;

  const containerClass = isPage
    ? cn(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-full shadow-sm flex flex-col h-[calc(100vh-110px)] min-h-[500px] select-text relative overflow-hidden transition-all duration-300",
        isSidePreviewOpen && "lg:mr-[520px] xl:mr-[600px] lg:max-w-[calc(100%-520px)] xl:max-w-[calc(100%-600px)]"
      )
    : cn(
        "bg-white dark:bg-slate-900 rounded-none md:rounded-2xl w-full max-w-4xl h-full md:h-[90vh] md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 dark:border-slate-800 flex flex-col max-w-full relative transition-all duration-300",
        isSidePreviewOpen && "lg:w-[calc(100vw-540px)] xl:w-[calc(100vw-620px)] lg:max-w-[calc(100vw-540px)] xl:max-w-[calc(100vw-620px)] lg:mr-[520px] xl:mr-[600px] lg:ml-2 xl:ml-4"
      );

  const mainContent = (
    <motion.div 
      initial={isPage ? { opacity: 0, y: 15 } : { scale: 0.95, opacity: 0 }}
      animate={isPage ? { opacity: 1, y: 0 } : { scale: 1, opacity: 1 }}
      exit={isPage ? { opacity: 0, y: 15 } : { scale: 0.95, opacity: 0 }}
      className={containerClass}
    >
      <div className={cn(
        "px-3 sm:px-6 md:px-8 py-3.5 md:py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-50 bg-white dark:bg-slate-900 gap-2 min-w-0 max-w-full shrink-0 shadow-xs",
        isPage ? "rounded-t-2xl" : "rounded-t-none md:rounded-t-2xl"
      )}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <span className={cn(
            "p-1.5 md:p-2 rounded-xl border shrink-0",
            req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50" : "bg-primary/5 text-primary border-primary/10"
          )}>
            <ShieldCheck size={18} className="md:w-5 md:h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap">
              <h3 className="text-[12px] md:text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-[0.05em] sm:tracking-[0.1em] truncate min-w-0 flex-1">
                <HighlightText text={req.title} highlight={globalSearchTerm || ""} />
              </h3>
              {req.flaggedForAudit && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded text-[8px] md:text-[9px] font-black uppercase tracking-[0.1em] shrink-0">
                  <Flag size={10} className="fill-current" />
                  Audit Flagged
                </span>
              )}
            </div>
            <p className="text-[8px] md:text-[10px] font-mono text-slate-400 uppercase tracking-widest truncate">{req.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 relative z-50">
          <motion.button 
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={onClose} 
            title="Close and go back (Esc)"
            className="flex sticky items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-full transition-all font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20 border border-rose-500/50 backdrop-blur-md"
          >
            <X size={16} className="stroke-[2.5]" />
            <span className="hidden sm:inline">Close & Go Back</span>
            <span className="sm:hidden">Close</span>
          </motion.button>
        </div>
      </div>

      <div ref={modalScrollRef} className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {/* Top workflow progress timeline component */}
          {(() => {
            const isRejected = req.status === RequisitionStatus.REJECTED;
            const isCancelled = req.status === RequisitionStatus.CANCELLED;
            const isEscalated = req.status === RequisitionStatus.ESCALATED;

            let currentStep = 0;
            if (req.status === RequisitionStatus.SUBMITTED) {
              currentStep = 0;
            } else if (req.status === RequisitionStatus.APPROVED_L1 || isEscalated) {
              currentStep = 1;
            } else if (req.status === RequisitionStatus.APPROVED_L2) {
              currentStep = 2;
            } else if (req.status === RequisitionStatus.DISBURSED) {
              currentStep = 3;
            }

            const steps = [
              {
                title: "Submitted",
                desc: "Submitted for approval",
                icon: User,
                status: currentStep > 0 ? "completed" : currentStep === 0 ? "current" : "upcoming"
              },
              {
                title: "L1 Approved",
                desc: "First Level Approval",
                icon: ShieldCheck,
                status: isRejected && req.rejectionReason?.includes("L1") ? "rejected" : (currentStep > 1 ? "completed" : currentStep === 1 ? "active" : "upcoming")
              },
              {
                title: "L2 Approved",
                desc: "Second Level Approval",
                icon: ShieldCheck,
                status: isEscalated ? "escalated" : (isRejected && !req.rejectionReason?.includes("L1") ? "rejected" : (currentStep > 2 ? "completed" : currentStep === 2 ? "active" : "upcoming"))
              },
              {
                title: "Disbursed",
                desc: "Funds Paid",
                icon: Coins,
                status: currentStep === 3 ? "completed" : "upcoming"
              }
            ];

            return (
              <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 md:p-8 shrink-0">
                <div className="max-w-4xl mx-auto">
                  <div className="relative grid grid-cols-4 gap-1 sm:gap-2 md:gap-0 items-start">
                    
                    {/* Horizontal connection line */}
                    <div className="absolute left-6 right-6 top-4 sm:top-5 md:top-6 -translate-y-1/2 h-1 bg-slate-200 z-0 rounded-full">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ 
                          width: `${
                            isRejected || isCancelled ? (currentStep * 33.33) :
                            currentStep === 3 ? 100 : (currentStep * 33.33 + 16.66)
                          }%` 
                        }}
                        className={cn(
                          "h-full transition-all duration-700 rounded-full",
                          isRejected || isCancelled ? "bg-rose-400" : isEscalated ? "bg-amber-400" : "bg-emerald-500"
                        )}
                      />
                    </div>

                    {steps.map((step, idx) => {
                      const StepIcon = step.icon;
                      const isUpcoming = step.status === "upcoming";
                      const isActive = step.status === "active" || step.status === "current";
                      const isCompleted = step.status === "completed";
                      const isError = step.status === "rejected";
                      const isWarning = step.status === "escalated";

                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5 sm:gap-3 z-10 w-full relative text-center">
                          <motion.div 
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className={cn(
                              "w-8 h-8 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-sm shrink-0",
                              isCompleted ? "bg-emerald-500 border-emerald-600 text-white shadow-emerald-200" :
                              isActive ? "bg-white border-primary text-primary shadow-primary/20 ring-4 ring-primary/10" :
                              isError ? "bg-rose-500 border-rose-600 text-white shadow-rose-200" :
                              isWarning ? "bg-amber-500 border-amber-600 text-white shadow-amber-200" :
                              "bg-slate-50 border-slate-200 text-slate-300"
                            )}
                          >
                            {isCompleted ? (
                              <Check size={16} className="stroke-[3] md:w-5 md:h-5" />
                            ) : (
                              <StepIcon size={16} className={cn("md:w-5 md:h-5", isActive && "animate-pulse")} />
                            )}
                          </motion.div>
                          
                          <div className="text-center space-y-0.5">
                            <h4 className={cn(
                              "text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-wider leading-tight",
                              isCompleted ? "text-emerald-700" :
                              isActive ? "text-primary" :
                              isError ? "text-rose-700" :
                              isWarning ? "text-amber-700" :
                              "text-slate-400"
                            )}>
                              {step.title}
                            </h4>
                            <p className="text-[7px] sm:text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-tighter hidden xs:block sm:block">
                              {step.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {(isRejected || isCancelled) && (
                    <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 shadow-sm">
                      <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                        <XCircle size={18} className="text-rose-600" />
                      </div>
                      <div className="space-y-0.5">
                         <p className="text-[10px] md:text-xs font-black uppercase tracking-wider">
                           Process Terminated: {req.status}
                         </p>
                         <p className="text-[9px] font-bold text-rose-600/70 uppercase">Requisition removed from active ledger workflow</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className={cn("flex-1 min-h-0 flex flex-col", !isSidePreviewOpen && "lg:grid lg:grid-cols-3")}>
            {/* Left Content */}
            <div ref={leftPanelRef} className={cn("p-4 md:p-8 space-y-5 md:space-y-8 h-auto overflow-visible", isSidePreviewOpen ? "w-full border-b-0" : "lg:col-span-2 border-b lg:border-b-0 lg:border-r border-slate-100")}>
              <section className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em]">Requisition Description</h4>
                </div>
                <div className="bg-slate-50 rounded-xl md:rounded-2xl p-3 md:p-6 border border-slate-100 space-y-4 text-[10px] md:text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                  <HighlightText text={req.description} highlight={globalSearchTerm || ""} />
                </div>
              </section>

              <div className="flex flex-col gap-3.5 md:gap-4 w-full">
                <section className="space-y-2 bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 w-full min-w-0">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Requested Amount</h4>
                  <div className="space-y-1 min-w-0">
                    <p className="text-lg md:text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono break-all">{formatCurrency(req.amount)}</p>
                    <p className="text-[9px] md:text-[11px] text-slate-500 dark:text-slate-400 italic font-medium leading-relaxed">{req.amountWords}</p>
                  </div>
                </section>

                <section className="space-y-2 bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 w-full min-w-0">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Individual Requestor</h4>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 text-primary font-bold text-xs md:text-base flex items-center justify-center shrink-0">
                      {req.requesterName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={req.requesterName}>{req.requesterName}</p>
                      <p className="text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title={req.groupName}>{req.groupName}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-2 bg-slate-50/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 w-full min-w-0">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest">Vendor</h4>
                  {(() => {
                    const vendorName = req.payableTo || "";
                    if (!vendorName.trim()) {
                      return (
                        <div className="text-xs text-slate-400 italic py-1">
                          No vendor specified
                        </div>
                      );
                    }
                    const matchedVendor = vendors.find(
                      v => v.name.trim().toLowerCase() === vendorName.trim().toLowerCase()
                    );
                    const vendorContact = matchedVendor?.contact || "N/A";
                    const reqCount = requisitions.filter(
                      r => r.payableTo && r.payableTo.trim().toLowerCase() === vendorName.trim().toLowerCase()
                    ).length;

                    return (
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-500/10 text-indigo-500 font-bold flex items-center justify-center shrink-0">
                          <Store size={16} className="md:w-5 md:h-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs md:text-sm font-bold text-slate-900 dark:text-slate-100 truncate" title={vendorName}>{vendorName}</p>
                          <p className="text-[8px] md:text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                            Contact: <span className="font-extrabold text-slate-700 dark:text-slate-300">{vendorContact}</span>
                          </p>
                          <div className="pt-0.5">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-200/60 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 rounded font-black uppercase tracking-wider font-mono text-[7px] md:text-[8px]">
                              Appeared in {reqCount} {reqCount === 1 ? "requisition" : "requisitions"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </section>
              </div>

              {/* Phased Installment Schedule Section (if present) */}
              {req.installments && req.installments.length > 0 && (
                <section className="space-y-3">
                  <RequisitionInstallmentScheduleBreakdown req={req} />
                </section>
              )}

              {/* Members Receiving Updates Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail size={12} className="text-indigo-500" />
                    Members Receiving Updates ({updateRecipients.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAddMemberOpen(!isAddMemberOpen)}
                    disabled={isSavingMember}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 rounded-xl text-[10px] font-bold transition-all cursor-pointer border border-indigo-200/50 dark:border-indigo-800/50 shrink-0 shadow-sm"
                  >
                    <UserPlus size={13} className="text-indigo-600 dark:text-indigo-400" />
                    <span>{isAddMemberOpen ? "Cancel" : "Add Members"}</span>
                  </button>
                </div>

                <AnimatePresence>
                  {isAddMemberOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-indigo-50/60 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3 relative overflow-visible"
                    >
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <UserPlus size={14} className="text-indigo-500" />
                          <span>Add Member to Receive Updates</span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400">Type email or name to search</span>
                      </div>

                      <div className="space-y-1 relative">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Email Address
                        </label>
                        <div className="flex gap-2 relative">
                          <input
                            type="email"
                            value={newMemberEmail}
                            onChange={(e) => {
                              setNewMemberEmail(e.target.value);
                              setIsInputFocused(true);
                            }}
                            onFocus={() => setIsInputFocused(true)}
                            onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
                            placeholder="Type email or search member name..."
                            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-200"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddMember(newMemberEmail);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleAddMember(newMemberEmail)}
                            disabled={isSavingMember || !newMemberEmail.trim()}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-sm cursor-pointer"
                          >
                            {isSavingMember ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Plus size={13} />
                            )}
                            Add Email
                          </button>
                        </div>

                        {/* Dropdown Suggestions */}
                        {isInputFocused && emailSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                            <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                              <span>Matching Church Members ({emailSuggestions.length})</span>
                              <span>Click to select</span>
                            </div>
                            {emailSuggestions.map(({ user, alreadyAdded }) => (
                              <button
                                key={user.id || user.email}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  if (alreadyAdded) {
                                    triggerToast({
                                      type: "SYSTEM_INFO",
                                      severity: "LOW",
                                      message: `${user.email} is already in the recipient list.`,
                                      timestamp: new Date().toISOString()
                                    });
                                  } else {
                                    handleAddMember(user.email);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 transition-colors flex items-center justify-between gap-2 text-xs group cursor-pointer"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6.5 h-6.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-indigo-200/40">
                                    {(user.name || user.email).charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                      {user.name || user.email.split("@")[0]}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                      {user.email}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {(user.group || user.department || user.role) && (
                                    <span className="text-[8.5px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                                      {user.group || user.department || user.role}
                                    </span>
                                  )}
                                  {alreadyAdded ? (
                                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded flex items-center gap-1">
                                      <Check size={9} /> Added
                                    </span>
                                  ) : (
                                    <span className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                      + Add
                                    </span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {updateRecipients.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                    {updateRecipients.map((rec) => {
                      const isRemoveable = Array.isArray(req.notificationEmails) &&
                        req.notificationEmails.some(e => (e || "").trim().toLowerCase() === rec.email.toLowerCase());
                      const isJustAdded = rec.email.toLowerCase() === lastAddedEmail?.toLowerCase();

                      return (
                        <div
                          key={rec.email}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl border shadow-sm text-xs transition-all",
                            isJustAdded
                              ? "bg-emerald-50/90 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700/80 ring-2 ring-emerald-500/40"
                              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-full font-bold flex items-center justify-center text-xs shrink-0 border",
                            isJustAdded
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40"
                          )}>
                            {rec.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[140px]">
                                {rec.name}
                              </span>
                              {rec.isRequester && (
                                <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[8px] font-black uppercase rounded tracking-wider">
                                  Requester
                                </span>
                              )}
                              {isJustAdded && (
                                <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[8px] font-black uppercase rounded tracking-wider flex items-center gap-0.5">
                                  <Check size={9} /> Added
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[180px]">
                              {rec.email}
                            </span>
                          </div>
                          {rec.roleOrGroup && (
                            <span className="ml-1 px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-100 dark:border-indigo-800/50 shrink-0">
                              {rec.roleOrGroup}
                            </span>
                          )}
                          {isRemoveable && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(rec.email)}
                              disabled={isSavingMember}
                              title="Remove from update recipients"
                              className="ml-1 p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 italic">
                    No members currently configured to receive updates for this requisition.
                  </div>
                )}
              </section>

              <section className="space-y-3 md:space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Attachments (Documents)
                    </h4>
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-[9px] font-bold">
                      {normalizedAttachments.length}
                    </span>
                  </div>
                </div>

                {/* Main Visual Thumbnail Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                   {/* Attachment Visual Cards */}
                   {normalizedAttachments.map((attachment: any, i: number) => {
                      let name = typeof attachment === 'string' ? attachment : (attachment?.name || 'Attachment');
                      let url = typeof attachment === 'string' ? attachment : (attachment?.url || '');
                      
                      if (typeof attachment === 'string' && attachment.includes("::")) {
                        const parts = attachment.split("::");
                        name = parts[0];
                        url = parts[1];
                      } else if (typeof attachment === 'string' && (attachment.startsWith("http") || attachment.startsWith("/"))) {
                        const parts = attachment.split("/");
                        const last = parts[parts.length - 1];
                        if (last && last.includes(".")) {
                          name = last;
                        }
                      }
                      
                      url = normalizeAttachmentUrl(url);
                      
                      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name) || /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || (typeof url === 'string' && (url.startsWith('data:image/') || url.startsWith('blob:')));
                      const fileExt = name.split('.').pop()?.toUpperCase() || "DOC";
                      const isDocx = fileExt === "DOCX" || /\.(docx)$/i.test(name) || /\.(docx)$/i.test(url);
                      const isXlsx = fileExt === "XLSX" || fileExt === "XLS" || fileExt === "CSV" || /\.(xlsx|xls|csv)$/i.test(name) || /\.(xlsx|xls|csv)$/i.test(url);
                      const isPdf = !isImage && !isDocx && !isXlsx && (fileExt === "PDF" || /\.(pdf)$/i.test(name) || /\.(pdf)$/i.test(url) || (typeof url === 'string' && url.startsWith('data:application/pdf')));

                      return (
                        <div 
                          key={`doc-${i}`} 
                          onClick={() => setPreviewIndex(i)}
                          className="aspect-[4/3] sm:aspect-square w-full bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl hover:border-indigo-500/50 dark:hover:border-indigo-400/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between overflow-hidden relative shadow-sm"
                          title={name}
                        >
                          {/* Card Content Header / Media */}
                          {isImage ? (
                            <CachedImage 
                              src={url} 
                              alt={name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : isPdf ? (
                            <PdfThumbnailPreview url={url} title={name} />
                          ) : isXlsx ? (
                            <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-gradient-to-b from-emerald-50/80 to-emerald-100/30 dark:from-emerald-950/30 dark:to-slate-900">
                              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform">
                                <FileSpreadsheet size={20} />
                              </div>
                              <span className="text-[9px] font-mono font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                {fileExt === "CSV" ? "CSV SHEET" : "EXCEL SHEET"}
                              </span>
                            </div>
                          ) : isDocx ? (
                            <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-gradient-to-b from-blue-50/80 to-blue-100/30 dark:from-blue-950/30 dark:to-slate-900">
                              <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform">
                                <FileText size={20} />
                              </div>
                              <span className="text-[9px] font-mono font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                WORD DOC
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-3 text-center w-full h-full bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-800 dark:to-slate-900">
                              <div className="w-10 h-10 rounded-2xl bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center mb-1 shadow-sm group-hover:scale-110 transition-transform">
                                <FileText size={20} />
                              </div>
                              <span className="text-[9px] font-mono font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">
                                {fileExt}
                              </span>
                            </div>
                          )}

                          {/* File Format Badge */}
                          <div className="absolute top-2 left-2 z-10">
                            <span className="px-2 py-0.5 bg-slate-900/80 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-wider rounded-lg border border-white/10 shadow-sm">
                              {isImage ? "IMAGE" : fileExt}
                            </span>
                          </div>

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 backdrop-blur-[2px]">
                            <span className="p-2.5 bg-white text-slate-900 rounded-xl shadow-lg hover:bg-slate-100 transition-transform active:scale-95 flex items-center gap-1.5 text-[10px] font-bold">
                              <Eye size={14} />
                              <span>{isPdf ? "Open Document" : "Preview"}</span>
                            </span>
                          </div>

                          {/* Bottom Title Bar */}
                          <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent">
                            <div className="text-[9px] font-bold text-white truncate drop-shadow-sm">
                              {name}
                            </div>
                          </div>
                        </div>
                      );
                   })}
                </div>

                {/* Empty State */}
                {normalizedAttachments.length === 0 && (
                  <div className="w-full py-8 flex flex-col items-center justify-center text-slate-300 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl gap-1">
                    <FileText size={24} className="text-slate-300 dark:text-slate-700" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No Attachments Provided</p>
                  </div>
                )}
              </section>

              {/* Discussion & Comments Thread (WhatsApp Channel Style Reference Design) */}
              <section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare size={14} className="text-indigo-500" />
                    <span>Comments ({effectiveComments.length})</span>
                  </h4>
                </div>
                
                <div className="space-y-5">
                  {/* Comments Feed List */}
                  {effectiveComments.length > 0 ? (() => {
                    const allComments = effectiveComments;
                    const topLevelComments = allComments.filter((c: any) => !c.parentId && !c.replyTo?.id);

                    return (
                      <div className="space-y-4">
                        {topLevelComments.map((comment: any) => {
                          const replies = allComments.filter((c: any) => (c.parentId && c.parentId === comment.id) || (!c.parentId && c.replyTo?.id === comment.id));

                          const isAuthor = comment.authorId === currentUser?.id || (comment.authorEmail && currentUser?.email && comment.authorEmail.toLowerCase() === currentUser.email.toLowerCase());
                          const canDelete = isAuthor || currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";
                          const diffMs = Date.now() - new Date(comment.createdAt || comment.timestamp).getTime();
                          const canEdit = isAuthor && (diffMs / 60000 <= 15);
                          
                          const commentUser = users.find((u: any) => 
                            (u.id && comment.authorId && u.id === comment.authorId) || 
                            (u.email && comment.authorEmail && u.email.toLowerCase() === comment.authorEmail.toLowerCase())
                          );

                          const displayName = resolveSenderName(
                            {
                              id: comment.authorId,
                              email: comment.authorEmail,
                              name: comment.authorName,
                              role: comment.authorRole
                            },
                            users
                          ) || comment.authorName || comment.authorEmail || "User";

                          const photoURL = comment.authorAvatar || comment.authorPhotoURL || (commentUser?.photoURL || (commentUser as any)?.avatarUrl) || (isAuthor ? (currentUser?.photoURL || (currentUser as any)?.avatarUrl) : "");

                          const reactions = sanitizeCommentReactions(comment.reactions, currentUser, users);
                          const reactionCounts = reactions.reduce((acc: any, r: any) => {
                            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                            return acc;
                          }, {});

                          // Attachments for this comment or requisition
                          const commentAttachments = Array.isArray(comment.attachments) && comment.attachments.length > 0
                            ? comment.attachments
                            : (comment === topLevelComments[0] && Array.isArray(req.attachments) && req.attachments.length > 0 ? req.attachments : []);

                          return (
                            <div key={comment.id} className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 relative transition-all group">
                              {/* Top-Level Comment Header */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  {photoURL ? (
                                    <img 
                                      src={photoURL} 
                                      alt={displayName} 
                                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700/80 shrink-0 shadow-2xs"
                                      onError={handleImageError}
                                    />
                                  ) : (
                                    <div className={`w-10 h-10 rounded-full ${getAvatarBgColor(displayName)} font-bold text-xs flex items-center justify-center text-white shrink-0 shadow-2xs`}>
                                      {getAvatarInitials(displayName)}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
                                      {displayName}
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-600 text-xs font-normal">•</span>
                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                                      {formatRelativeTime(comment.createdAt || comment.timestamp)}
                                    </span>
                                    {comment.isEdited && (
                                      <span className="text-[10px] text-slate-400 italic">(edited)</span>
                                    )}
                                    {comment.authorRole && (
                                      <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-bold">
                                        {comment.authorRole}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Top Right Comment Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Quick Copy Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(comment.text);
                                      setCopiedCommentId(comment.id);
                                      setTimeout(() => setCopiedCommentId(null), 2000);
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Copy comment text"
                                  >
                                    {copiedCommentId === comment.id ? (
                                      <Check size={14} className="text-emerald-500" />
                                    ) : (
                                      <Copy size={14} />
                                    )}
                                  </button>

                                  {/* Quick Reply Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInlineReplyCommentId(inlineReplyCommentId === comment.id ? null : comment.id);
                                      setInlineReplyText("");
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Reply to thread"
                                  >
                                    <Reply size={14} />
                                  </button>

                                  {/* Edit Button (Author within 15 mins) */}
                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingCommentText(comment.text);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                                      title="Edit comment"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                  )}

                                  {/* Delete Button (Author or Admin) */}
                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteComment(comment.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                      title="Delete comment"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Comment Body */}
                              {editingCommentId === comment.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingCommentText}
                                    onChange={(e) => setEditingCommentText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        e.preventDefault();
                                        setEditingCommentId(null);
                                        setEditingCommentText("");
                                      } else if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleUpdateComment(comment.id, editingCommentText);
                                      }
                                    }}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 resize-none"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-2 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setEditingCommentText("");
                                      }}
                                      className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateComment(comment.id, editingCommentText)}
                                      className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 cursor-pointer"
                                    >
                                      Save
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words whitespace-pre-wrap font-normal">
                                    {renderFormattedCommentText(comment.text)}
                                  </div>
                                </div>
                              )}

                              {/* Attached Files Section */}
                              {commentAttachments.length > 0 && (
                                <div className="bg-[#F2F4F8] dark:bg-slate-800/60 p-3.5 rounded-2xl space-y-2.5">
                                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
                                    {commentAttachments.length} {commentAttachments.length === 1 ? 'file' : 'files'}
                                  </span>
                                  <div className="flex flex-wrap gap-2">
                                    {commentAttachments.map((att: any, idx: number) => {
                                      const attUrl = typeof att === 'string' ? att : (att?.url || '');
                                      const fileName = getAttachmentFileName(attUrl);
                                      const badge = getFileTypeBadge(fileName);
                                      return (
                                        <a
                                          key={idx}
                                          href={getAbsoluteAttachmentUrl(attUrl)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs hover:shadow-xs transition-all cursor-pointer group/att"
                                        >
                                          <span className={`w-4 h-4 rounded text-[9px] font-black flex items-center justify-center ${badge.bg} shadow-2xs shrink-0`}>
                                            {badge.label}
                                          </span>
                                          <span className="truncate max-w-[200px] sm:max-w-[260px] group-hover/att:text-indigo-600 transition-colors">
                                            {fileName}
                                          </span>
                                        </a>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Thumbs Up & Thumbs Down Reactions and Action Bar */}
                              <div className="flex items-center gap-2 flex-wrap relative pt-1">
                                {/* Dedicated Thumbs Up & Thumbs Down Buttons */}
                                {REACTION_OPTIONS.map(({ emoji }) => {
                                  const count = reactionCounts[emoji] || 0;
                                  const hasReacted = hasUserReacted(reactions, emoji, currentUser, users);

                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleToggleReaction(comment.id, emoji)}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs border",
                                        hasReacted
                                          ? "bg-[#DDE9FD] text-[#1D4ED8] border-[#BFDBFE] dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700/80 font-bold ring-1 ring-blue-500/20"
                                          : count > 0
                                            ? "bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-700/80"
                                            : "bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/60 dark:border-slate-800 opacity-80 hover:opacity-100"
                                      )}
                                    >
                                      <span className="text-sm leading-none">{emoji}</span>
                                      {count > 0 && <span className="text-xs font-bold">{count}</span>}
                                    </button>
                                  );
                                })}

                                {/* Overlapping Reactor Profiles next to reaction icons with names */}
                                {reactions.length > 0 && (() => {
                                  const reactorProfiles = resolveReactorsProfiles(reactions, users, currentUser);
                                  const allReactors = resolveReactorNames(reactions, "👍", users, currentUser).concat(resolveReactorNames(reactions, "👎", users, currentUser));
                                  const uniqueReactors = Array.from(new Set(allReactors.length > 0 ? allReactors : reactorProfiles.map(p => p.name)));
                                  const namesSummary = formatReactionTooltip(uniqueReactors);

                                  return (
                                    <div className="inline-flex items-center ml-0.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReactionDetailModalData({ commentId: comment.id, reactions, isReply: false });
                                          setReactionModalActiveTab("ALL");
                                        }}
                                        className="inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                                      >
                                        <div className="inline-flex items-center -space-x-1.5">
                                          {reactorProfiles.slice(0, 4).map((p, pIdx) => (
                                            <div
                                              key={p.id || pIdx}
                                              className="relative inline-block shrink-0"
                                            >
                                              {p.avatar ? (
                                                <img
                                                  src={p.avatar}
                                                  alt={p.name}
                                                  className="w-5 h-5 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px] rounded-full object-cover ring-2 ring-white dark:ring-slate-900 shadow-2xs"
                                                  onError={handleImageError}
                                                />
                                              ) : (
                                                <div
                                                  className={cn(
                                                    "w-5 h-5 min-w-[20px] min-h-[20px] rounded-full ring-2 ring-white dark:ring-slate-900 font-bold text-[8.5px] flex items-center justify-center text-white shadow-2xs",
                                                    getAvatarBgColor(p.name)
                                                  )}
                                                >
                                                  {getAvatarInitials(p.name)}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                          {reactorProfiles.length > 4 && (
                                            <div
                                              className="w-5 h-5 min-w-[20px] min-h-[20px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900 font-bold text-[8px] flex items-center justify-center shrink-0 shadow-2xs"
                                            >
                                              +{reactorProfiles.length - 4}
                                            </div>
                                          )}
                                        </div>
                                        {namesSummary && (
                                          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                            {namesSummary}
                                          </span>
                                        )}
                                      </button>
                                    </div>
                                  );
                                })()}

                                {/* Inline Reply Trigger Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInlineReplyCommentId(inlineReplyCommentId === comment.id ? null : comment.id);
                                    setInlineReplyText("");
                                  }}
                                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors px-2.5 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Reply size={13} />
                                  <span>Reply</span>
                                </button>
                              </div>

                              {/* Inline Reply Composer Box */}
                              {inlineReplyCommentId === comment.id && (
                                <div className="pt-2 animate-in fade-in duration-150">
                                  <div className="flex gap-2.5 items-start bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 shadow-2xs">
                                    {currentUser?.photoURL || (currentUser as any)?.avatarUrl ? (
                                      <img
                                        src={currentUser?.photoURL || (currentUser as any)?.avatarUrl}
                                        alt={resolveSenderName(currentUser, users) || "User"}
                                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700 mt-0.5 shadow-2xs"
                                        onError={handleImageError}
                                      />
                                    ) : (
                                      <div className={`w-8 h-8 rounded-full ${getAvatarBgColor(resolveSenderName(currentUser, users) || "U")} text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs`}>
                                        {getAvatarInitials(resolveSenderName(currentUser, users) || "U")}
                                      </div>
                                    )}
                                    <div className="flex-1 space-y-2">
                                      <textarea
                                        value={inlineReplyText}
                                        onChange={(e) => setInlineReplyText(e.target.value)}
                                        placeholder={`Reply to ${displayName}...`}
                                        rows={2}
                                        maxLength={1000}
                                        autoFocus
                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none"
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            if (inlineReplyText.trim() && inlineReplyText.length <= 1000) {
                                              handleAddComment(inlineReplyText, { id: comment.id, authorName: displayName, text: comment.text });
                                            }
                                          }
                                        }}
                                      />
                                      <div className="flex items-center justify-between gap-2">
                                        <div className={cn(
                                          "text-[10px] font-mono font-medium transition-colors select-none",
                                          inlineReplyText.length >= 1000
                                            ? "text-rose-600 dark:text-rose-400 font-bold"
                                            : inlineReplyText.length >= 800
                                            ? "text-amber-600 dark:text-amber-400 font-semibold"
                                            : "text-slate-400 dark:text-slate-500"
                                        )}>
                                          {inlineReplyText.length}/1000
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setInlineReplyCommentId(null);
                                              setInlineReplyText("");
                                            }}
                                            className="px-3 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            disabled={!inlineReplyText.trim() || inlineReplyText.length > 1000 || isSubmittingComment}
                                            onClick={() => handleAddComment(inlineReplyText, { id: comment.id, authorName: displayName, text: comment.text })}
                                            className="px-3.5 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                          >
                                            {isSubmittingComment ? (
                                              <Loader2 size={11} className="animate-spin" />
                                            ) : (
                                              <Send size={11} />
                                            )}
                                            <span>Reply</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Nested Replies Section with Curved Branch Connector */}
                              {replies.length > 0 && (() => {
                                const summary = formatRepliesSummary(replies, users);

                                return (
                                  <div className="pt-2 space-y-3">
                                    {/* Replies Header Summary with Overlapping Avatars */}
                                    <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 font-medium pl-1">
                                      <div className="flex -space-x-2 overflow-hidden items-center">
                                        {summary.authors.slice(0, 4).map((author, idx) => (
                                          author.avatar ? (
                                            <img
                                              key={idx}
                                              src={author.avatar}
                                              alt={author.name}
                                              className="inline-block h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 object-cover shadow-2xs"
                                              onError={handleImageError}
                                            />
                                          ) : (
                                            <div
                                              key={idx}
                                              className={`inline-flex h-6 w-6 rounded-full ring-2 ring-white dark:ring-slate-900 ${getAvatarBgColor(author.name)} font-bold text-[10px] items-center justify-center text-white shadow-2xs`}
                                            >
                                              {getAvatarInitials(author.name)}
                                            </div>
                                          )
                                        ))}
                                      </div>
                                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                                        {summary.text}
                                      </span>
                                    </div>

                                    {/* Nested Replies with Smooth Curved Connectors */}
                                    <div className="relative pl-6 sm:pl-8 space-y-3 pt-1">
                                      {replies.map((reply: any, idx: number) => {
                                        const isReplyAuthor = reply.authorId === currentUser?.id || (reply.authorEmail && currentUser?.email && reply.authorEmail.toLowerCase() === currentUser.email.toLowerCase());
                                        const canDeleteReply = isReplyAuthor || currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN";
                                        
                                        const replyUser = users.find((u: any) => 
                                          (u.id && reply.authorId && u.id === reply.authorId) || 
                                          (u.email && reply.authorEmail && u.email.toLowerCase() === reply.authorEmail.toLowerCase())
                                        );

                                        const replyDisplayName = resolveSenderName(
                                          {
                                            id: reply.authorId,
                                            email: reply.authorEmail,
                                            name: reply.authorName,
                                            role: reply.authorRole
                                          },
                                          users
                                        ) || reply.authorName || reply.authorEmail || "User";

                                        const replyPhotoURL = reply.authorAvatar || reply.authorPhotoURL || (replyUser?.photoURL || (replyUser as any)?.avatarUrl) || (isReplyAuthor ? (currentUser?.photoURL || (currentUser as any)?.avatarUrl) : "");

                                        const replyReactions = sanitizeCommentReactions(reply.reactions, currentUser, users);
                                        const replyReactionCounts = replyReactions.reduce((acc: any, r: any) => {
                                          acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                                          return acc;
                                        }, {});

                                        return (
                                          <div key={reply.id} className="relative group/reply">
                                            {/* Curved connector branching in from left tree rail */}
                                            <div className="absolute -left-4 sm:-left-5 top-4 w-4 sm:w-5 h-5 border-l-2 border-b-2 border-slate-200 dark:border-slate-700/80 rounded-bl-xl pointer-events-none" />
                                            {idx < replies.length - 1 && (
                                              <div className="absolute -left-4 sm:-left-5 top-9 bottom-0 border-l-2 border-slate-200 dark:border-slate-700/80 pointer-events-none" />
                                            )}

                                            {/* Reply Card Container */}
                                            <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2 relative">
                                              {/* Reply Header */}
                                              <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                  {replyPhotoURL ? (
                                                    <img 
                                                      src={replyPhotoURL} 
                                                      alt={replyDisplayName} 
                                                      className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                                                      onError={handleImageError}
                                                    />
                                                  ) : (
                                                    <div className={`w-8 h-8 rounded-full ${getAvatarBgColor(replyDisplayName)} font-bold text-[10px] flex items-center justify-center text-white shrink-0 shadow-2xs`}>
                                                      {getAvatarInitials(replyDisplayName)}
                                                    </div>
                                                  )}
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                                      {replyDisplayName}
                                                    </span>
                                                    <span className="text-slate-300 dark:text-slate-600 text-xs font-normal">•</span>
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">
                                                      {formatRelativeTime(reply.createdAt || reply.timestamp)}
                                                    </span>
                                                  </div>
                                                </div>

                                                {/* Reply Actions */}
                                                <div className="flex items-center gap-1">
                                                  {/* Copy Reply Text */}
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(reply.text);
                                                      setCopiedCommentId(reply.id);
                                                      setTimeout(() => setCopiedCommentId(null), 2000);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                    title="Copy reply text"
                                                  >
                                                    {copiedCommentId === reply.id ? (
                                                      <Check size={13} className="text-emerald-500" />
                                                    ) : (
                                                      <Copy size={13} />
                                                    )}
                                                  </button>

                                                  {canDeleteReply && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteComment(reply.id)}
                                                      className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover/reply:opacity-100 transition-opacity cursor-pointer"
                                                      title="Delete reply"
                                                    >
                                                      <Trash2 size={13} />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Reply Body Text */}
                                              <div>
                                                <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed break-words whitespace-pre-wrap font-normal">
                                                  {renderFormattedCommentText(reply.text)}
                                                </div>
                                              </div>

                                              {/* Restricted 👍 and 👎 Reactions for Reply */}
                                              <div className="flex items-center gap-1.5 flex-wrap relative pt-0.5">
                                                {/* Dedicated Thumbs Up & Thumbs Down Buttons for Reply */}
                                                {REACTION_OPTIONS.map(({ emoji }) => {
                                                  const count = replyReactionCounts[emoji] || 0;
                                                  const hasReacted = hasUserReacted(replyReactions, emoji, currentUser, users);

                                                  return (
                                                    <button
                                                      key={emoji}
                                                      type="button"
                                                      onClick={() => handleToggleReaction(reply.id, emoji)}
                                                      className={cn(
                                                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs border",
                                                        hasReacted
                                                          ? "bg-[#DDE9FD] text-[#1D4ED8] border-[#BFDBFE] dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700/80 font-bold ring-1 ring-blue-500/20"
                                                          : count > 0
                                                            ? "bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 border-slate-200/60 dark:border-slate-700"
                                                            : "bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/60 dark:border-slate-800 opacity-80 hover:opacity-100"
                                                      )}
                                                    >
                                                      <span className="text-xs leading-none">{emoji}</span>
                                                      {count > 0 && <span className="text-[11px] font-bold">{count}</span>}
                                                    </button>
                                                  );
                                                })}

                                                {/* Overlapping Reactor Profiles for reply with names */}
                                                {replyReactions.length > 0 && (() => {
                                                  const reactorProfiles = resolveReactorsProfiles(replyReactions, users, currentUser);
                                                  const allReactors = resolveReactorNames(replyReactions, "👍", users, currentUser).concat(resolveReactorNames(replyReactions, "👎", users, currentUser));
                                                  const uniqueReactors = Array.from(new Set(allReactors.length > 0 ? allReactors : reactorProfiles.map(p => p.name)));
                                                  const namesSummary = formatReactionTooltip(uniqueReactors);

                                                  return (
                                                    <div className="inline-flex items-center ml-0.5">
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setReactionDetailModalData({ commentId: reply.id, reactions: replyReactions, isReply: true });
                                                          setReactionModalActiveTab("ALL");
                                                        }}
                                                        className="inline-flex items-center gap-1 py-0.5 px-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                                                      >
                                                        <div className="inline-flex items-center -space-x-1.5">
                                                          {reactorProfiles.slice(0, 4).map((p, pIdx) => (
                                                            <div
                                                              key={p.id || pIdx}
                                                              className="relative inline-block shrink-0"
                                                            >
                                                              {p.avatar ? (
                                                                <img
                                                                  src={p.avatar}
                                                                  alt={p.name}
                                                                  className="w-4 h-4 min-w-[16px] min-h-[16px] max-w-[16px] max-h-[16px] rounded-full object-cover ring-2 ring-white dark:ring-slate-900 shadow-2xs"
                                                                  onError={handleImageError}
                                                                />
                                                              ) : (
                                                                <div
                                                                  className={cn(
                                                                    "w-4 h-4 min-w-[16px] min-h-[16px] rounded-full ring-2 ring-white dark:ring-slate-900 font-bold text-[7.5px] flex items-center justify-center text-white shadow-2xs",
                                                                    getAvatarBgColor(p.name)
                                                                  )}
                                                                >
                                                                  {getAvatarInitials(p.name)}
                                                                </div>
                                                              )}
                                                            </div>
                                                          ))}
                                                          {reactorProfiles.length > 4 && (
                                                            <div
                                                              className="w-4 h-4 min-w-[16px] min-h-[16px] rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-slate-900 font-bold text-[7.5px] flex items-center justify-center shrink-0 shadow-2xs"
                                                            >
                                                              +{reactorProfiles.length - 4}
                                                            </div>
                                                          )}
                                                        </div>
                                                        {namesSummary && (
                                                          <span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                                                            {namesSummary}
                                                          </span>
                                                        )}
                                                      </button>
                                                    </div>
                                                  );
                                                })()}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })() : (
                    <div className="p-8 bg-slate-50/60 dark:bg-slate-900/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400">
                      <MessageSquare size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">No comments yet</p>
                      <p className="text-xs text-slate-400 mt-1">Be the first to post feedback or ask a question below.</p>
                    </div>
                  )}

                  <div ref={commentsEndRef} />

                  {/* Add Comment Input Card */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-3.5 shadow-sm space-y-2.5 relative">
                    {/* Replying Banner */}
                    {replyingTo && (
                      <div className="p-2.5 bg-indigo-50/80 dark:bg-indigo-950/60 border-l-4 border-indigo-500 rounded-r-2xl flex items-center justify-between gap-2 shadow-2xs">
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                            <Reply size={12} />
                            <span>Replying to {replyingTo.authorName}</span>
                          </p>
                          <p className="text-slate-600 dark:text-slate-300 truncate mt-0.5 text-[11px]">
                            {replyingTo.text}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplyingTo(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Emoji Quick Picker Bar */}
                    {showEmojiPicker && (
                      <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg flex items-center gap-1 flex-wrap z-30">
                        {["👍", "👎", "❤️", "🎉", "😢", "🚀", "👀", "🔥", "👏", "💡", "😊", "🙏", "✅", "💯", "⭐"].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setCommentText(prev => prev + emoji);
                              setShowEmojiPicker(false);
                            }}
                            className="p-1.5 text-base hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-transform active:scale-110 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Mention Suggestions Popover */}
                    {mentionSearch !== null && filteredMentionUsers.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl z-50 overflow-hidden max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/45 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                          <span className="text-[9px] font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase">Mention User</span>
                          <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded uppercase">Matching: {mentionSearch}</span>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-slate-800/40">
                          {filteredMentionUsers.map(u => {
                            const uPhoto = u.photoURL || (u as any).avatarUrl;
                            const initials = (u.name || u.email || "?").charAt(0).toUpperCase();
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => insertMention(u)}
                                className="w-full text-left px-3.5 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all group cursor-pointer"
                              >
                                {uPhoto ? (
                                  <img 
                                    src={uPhoto} 
                                    alt={u.name} 
                                    className="w-7 h-7 rounded-full object-cover border border-slate-250 dark:border-slate-700 shrink-0"
                                    onError={handleImageError}
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-250 dark:border-slate-700/80 font-bold text-xs flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-150 dark:group-hover:bg-indigo-950/40 dark:group-hover:text-indigo-300 dark:group-hover:border-indigo-900/60 transition-all shrink-0">
                                    {initials}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 justify-between">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate">
                                      {u.name}
                                    </p>
                                    <span className="text-[7.5px] px-1 py-0.2 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-extrabold uppercase shrink-0">
                                      {u.role}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                    {u.email}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Textarea Input */}
                    <textarea
                      ref={commentTextareaRef}
                      value={commentText}
                      onChange={handleCommentTextareaChange}
                      placeholder={replyingTo ? `Replying to ${replyingTo.authorName}...` : "Write a comment or use @name to tag team members..."}
                      rows={2}
                      maxLength={1000}
                      className="w-full px-3 py-2 text-xs bg-transparent border-0 focus:outline-none resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-0 min-h-[48px]"
                      onKeyDown={(e) => {
                        if (e.key === "Escape" && mentionSearch !== null) {
                          e.preventDefault();
                          setMentionSearch(null);
                          setMentionIndex(-1);
                        } else if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (commentText.trim() && commentText.length <= 1000) {
                            handleAddComment();
                          }
                        }
                      }}
                    />

                    {/* Bottom Controls Bar */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2 px-1">
                      <div className="flex items-center gap-1">
                        {/* Markdown Formatting Toolbar */}
                        <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-700/80 pr-1.5 mr-0.5">
                          <button
                            type="button"
                            onClick={() => applyTextFormatting(commentTextareaRef.current, commentText, setCommentText, "bold")}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Bold (**text**)"
                          >
                            <Bold size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTextFormatting(commentTextareaRef.current, commentText, setCommentText, "italic")}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Italic (*text*)"
                          >
                            <Italic size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTextFormatting(commentTextareaRef.current, commentText, setCommentText, "bullet")}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Bullet List (- item)"
                          >
                            <List size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => applyTextFormatting(commentTextareaRef.current, commentText, setCommentText, "number")}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Numbered List (1. item)"
                          >
                            <ListOrdered size={14} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(prev => !prev)}
                          className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Add Emoji"
                        >
                          <Smile size={16} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5">
                        {/* Character limit counter with typing feedback */}
                        <div
                          className={cn(
                            "text-[10px] font-mono font-medium transition-all px-2 py-0.5 rounded-md select-none",
                            commentText.length >= 1000
                              ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 font-bold"
                              : commentText.length >= 800
                              ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 font-semibold"
                              : "text-slate-400 dark:text-slate-500"
                          )}
                          title={`${1000 - commentText.length} characters remaining`}
                        >
                          <span>{commentText.length}</span>
                          <span className="text-slate-300 dark:text-slate-600">/</span>
                          <span>1000</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddComment()}
                          disabled={!commentText.trim() || commentText.length > 1000 || isSubmittingComment}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          {isSubmittingComment ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Send size={13} />
                          )}
                          <span>{replyingTo ? "Post Reply" : "Post Comment"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Decision Form integration */}
              {showDecisionForm && (
                <motion.div 
                  ref={decisionFormRef}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={cn(
                    "p-4 md:p-6 rounded-2xl border bg-slate-50",
                    showDecisionForm === "APPROVE" ? "border-emerald-100" : showDecisionForm === "REJECT" ? "border-rose-100" : "border-amber-100"
                  )}
                >
                  <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest mb-4">
                    {showDecisionForm === "APPROVE" ? "Approve Transaction" : showDecisionForm === "REJECT" ? "Reject Transaction" : "Escalate Transaction"}
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                        {showDecisionForm === "REJECT" ? "Reason For Rejection (Optional)" : showDecisionForm === "APPROVE" ? "Reason For Approval (Optional)" : "Reason For Escalation (Optional)"}
                      </label>
                      <textarea 
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        className="input-field bg-white text-xs"
                        placeholder={showDecisionForm === "REJECT" ? "Enter reason for rejection if any..." : "Provide reasoning if any..."}
                        rows={3}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                       <button 
                        onClick={() => setShowDecisionForm(null)}
                        className="px-4 md:px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button 
                        disabled={loading}
                        onClick={() => handleDecision(showDecisionForm)}
                        className={cn(
                          "btn-primary px-5 md:px-8 flex items-center gap-2",
                          showDecisionForm === "REJECT" ? "bg-rose-600 hover:bg-rose-700" : 
                          showDecisionForm === "ESCALATE" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : ""
                        )}
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span className="text-[10px] md:text-xs">CONFIRM</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Sidebar - History & Status (Hidden when side preview is open) */}
            {!isSidePreviewOpen && (
              <div ref={rightPanelRef} className="bg-slate-50/50 p-6 md:p-8 space-y-6 md:space-y-8 lg:h-full lg:overflow-y-auto h-auto overflow-visible lg:col-span-1">
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <h4 className="text-[10px] md:text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest shrink-0">
                    History & Audit Timeline
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <span className="text-[8px] font-mono font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {getConsolidatedTimeline().length} events
                    </span>
                    <button
                      onClick={() => setIsTimelineMinimizedManually(!isTimelineMinimized)}
                      className="px-2 py-0.5 bg-slate-200/60 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider"
                      title={isTimelineMinimized ? "Expand History Timeline" : "Minimize History Timeline"}
                    >
                      <span>{isTimelineMinimized ? "Expand" : "Collapse"}</span>
                      {isTimelineMinimized ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
                  </div>
                </div>

                {isTimelineMinimized ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <History size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">Timeline Minimized</p>
                        <p className="text-[9px] text-slate-500 font-mono truncate">{getConsolidatedTimeline().length} audit records saved</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsTimelineMinimizedManually(false)}
                      className="px-2.5 py-1 bg-indigo-50 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-slate-700 text-indigo-700 dark:text-slate-300 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-colors shrink-0 cursor-pointer ml-auto"
                    >
                      View All
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 relative ml-1">
                    {/* Vertical Timeline Connector Line */}
                    <div className="absolute left-3.5 top-3.5 bottom-3.5 w-[2px] bg-slate-200 rounded-full" />
                    
                    {getConsolidatedTimeline().map((event) => {
                    let StepIcon = Activity;
                    let cardColor = "blue";
                    
                    if (event.type === "CREATED") {
                      StepIcon = User;
                      cardColor = "blue";
                    } else if (event.type === "L1_APPROVED") {
                      StepIcon = ShieldCheck;
                      cardColor = "teal";
                    } else if (event.type === "L2_APPROVED") {
                      StepIcon = ShieldCheck;
                      cardColor = "indigo";
                    } else if (event.type === "DISBURSED") {
                      StepIcon = Coins;
                      cardColor = "emerald";
                    } else if (event.type === "REJECTED") {
                      StepIcon = XCircle;
                      cardColor = "rose";
                    } else if (event.type === "ESCALATED") {
                      StepIcon = AlertTriangle;
                      cardColor = "amber";
                    } else {
                      StepIcon = Activity;
                      cardColor = "slate";
                    }

                    // Security Method details
                    let methodLabel = "System authorization protocol";
                    let MethodIcon = Activity;
                    if (event.method === "CODE") {
                      methodLabel = "L1 Approval successful";
                      MethodIcon = KeyRound;
                    } else if (event.method === "FINGERPRINT") {
                      methodLabel = "Biometric authenticated";
                      MethodIcon = Fingerprint;
                    } else if (event.method === "SIGNATURE") {
                      methodLabel = "Cryptographic signature signed";
                      MethodIcon = FileSignature;
                    }

                    return (
                      <div key={event.id} className="relative pl-9 group">
                        {/* Circle badge marker with icon */}
                        <div className={cn(
                          "absolute left-0 top-1 w-7.5 h-7.5 rounded-full border-2 border-white flex items-center justify-center ring-4 transition-transform group-hover:scale-105 shadow-sm z-10",
                          cardColor === "blue" ? "bg-blue-50 text-blue-650 border-blue-200 ring-blue-50/50" :
                          cardColor === "teal" ? "bg-teal-50 text-teal-650 border-teal-200 ring-teal-50/50" :
                          cardColor === "indigo" ? "bg-indigo-50 text-indigo-650 border-indigo-200 ring-indigo-50/50" :
                          cardColor === "emerald" ? "bg-emerald-50 text-emerald-650 border-emerald-250 ring-emerald-50/50" :
                          cardColor === "rose" ? "bg-rose-50 text-rose-650 border-rose-200 ring-rose-50/50" :
                          cardColor === "amber" ? "bg-amber-50 text-amber-650 border-amber-200 ring-amber-50/50" :
                          "bg-slate-50 text-slate-500 border-slate-200 ring-slate-50/50"
                        )}>
                          <StepIcon size={13} className="stroke-[2.5]" />
                        </div>
                        
                        <div>
                          <p className="text-[9px] md:text-[10px] font-semibold text-slate-400 mb-0.5">{formatDate(event.timestamp)}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                            <h5 className="text-[11px] font-extrabold text-slate-900 leading-tight uppercase tracking-tight">{event.title}</h5>
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                              cardColor === "blue" ? "bg-blue-100 text-blue-850" :
                              cardColor === "teal" ? "bg-teal-100 text-teal-855" :
                              cardColor === "indigo" ? "bg-indigo-100 text-indigo-855" :
                              cardColor === "emerald" ? "bg-emerald-100 text-emerald-855" :
                              cardColor === "rose" ? "bg-rose-100 text-rose-855" :
                              cardColor === "amber" ? "bg-amber-100 text-amber-855" :
                              "bg-slate-100 text-slate-855"
                            )}>
                              {event.type}
                            </span>
                            {event.role && (
                              <span className="px-1 py-0.5 bg-slate-100 text-slate-500 rounded text-[6.5px] font-black uppercase tracking-wider">
                                {event.role.split('_').pop()?.replace(')', '')}
                              </span>
                            )}
                          </div>

                          <div className={cn(
                            "p-3 rounded-xl border space-y-2 bg-white transition-all shadow-sm",
                            cardColor === "blue" ? "hover:border-blue-200" :
                            cardColor === "teal" ? "hover:border-teal-200" :
                            cardColor === "indigo" ? "hover:border-indigo-200" :
                            cardColor === "emerald" ? "hover:border-emerald-200" :
                            cardColor === "rose" ? "hover:border-rose-200" :
                            cardColor === "amber" ? "hover:border-amber-200" :
                            "hover:border-slate-200"
                          )}>
                            <div className="flex items-center justify-between text-[9px] border-b border-slate-50 pb-1.5">
                              <span className="font-medium text-slate-405">Requestor:</span>
                              <span className="font-extrabold text-slate-800">{event.actorName}</span>
                            </div>

                            {/* Authentication and security info (only for non-created, non-legacy generic steps) */}
                            {event.type !== "CREATED" && (event.method || event.approvalCode) && (
                              <div className="flex items-center justify-between text-[8px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <MethodIcon size={10} className="text-slate-400" />
                                  {methodLabel}
                                </span>
                                {event.approvalCode && (
                                  <span className="font-mono bg-slate-50 px-1 py-0.5 rounded text-slate-500 font-extrabold uppercase tracking-wide">
                                    Auth block verified
                                  </span>
                                )}
                              </div>
                            )}

                            {event.type === "CREATED" && (
                              <div className="flex items-center justify-between text-[8px] text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Activity size={10} className="text-slate-400" />
                                  Requisition initiated and ready for approvals
                                </span>
                              </div>
                            )}

                            {/* Event text note or comments */}
                            {event.note && (
                              <div className="pt-2 border-t border-slate-50">
                                <p className="text-[9px] md:text-[9.5px] text-slate-600 leading-relaxed italic bg-emerald-50/15 p-2 rounded-lg border border-slate-100">
                                  "{event.note}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
              </section>

              <section className="pt-6 md:pt-8 border-t border-slate-200/60 dark:border-slate-800 space-y-3">
                 <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Metadata</h4>
                 <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] md:text-xs bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0 font-semibold">
                        <Users size={13} className="text-primary shrink-0" /> Church Group
                      </span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wider text-[9px] truncate max-w-full ml-auto">
                        {req.groupName || "N/A"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] md:text-xs bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0 font-semibold">
                        <CalendarDays size={13} className="text-indigo-500 shrink-0" /> Submitted
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 font-mono text-[10px] ml-auto">
                        {formatDate(req.submittedAt)}
                      </span>
                    </div>

                    {formatRequisitionAge(req.submittedAt || req.createdAt, req.status) && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] md:text-xs bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0 font-semibold">
                          <Clock size={13} className="text-amber-500 shrink-0" /> Days Old
                        </span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-mono text-[9px] ml-auto">
                          {formatRequisitionAge(req.submittedAt || req.createdAt, req.status)}
                        </span>
                      </div>
                    )}

                    {req.recurrence && req.recurrence !== "NONE" && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] md:text-xs bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0 font-semibold">
                          <Repeat size={13} className="text-emerald-500 shrink-0" /> Recurrence
                        </span>
                        <span className="font-black text-primary uppercase tracking-widest text-[9px] ml-auto">
                          {req.recurrence}
                        </span>
                      </div>
                    )}
                 </div>
              </section>
            </div>
            )}
          </div>
        </div>

        <div className="px-3 sm:px-6 md:px-8 py-3 md:py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end gap-3 w-full max-w-full shrink-0 sticky bottom-0 z-40 shadow-xs">
          {/* More Options Dropdown */}
          <div ref={moreMenuRef} className="relative shrink-0">
            <button 
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className="px-3.5 sm:px-5 py-2.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] md:text-xs font-black transition-all cursor-pointer uppercase tracking-widest flex items-center gap-1.5"
              title="More Options"
            >
              <MoreVertical size={14} />
              <span>Options</span>
              <ChevronDown size={12} className={cn("transition-transform duration-200", isMoreOpen && "rotate-180")} />
            </button>
            {isMoreOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl shadow-xl z-[100] py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                {/* Print Receipt */}
                <button 
                  onClick={() => {
                    setIsMoreOpen(false);
                    printRequisitionReceipt(req);
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <Printer size={15} className="text-slate-400" />
                  <span>Print Receipt</span>
                </button>

                {/* Generate Receipt */}
                <button 
                  onClick={() => {
                    setIsMoreOpen(false);
                    onGenerateReceipt();
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <FileText size={15} className="text-slate-400" />
                  <span>Generate Receipt</span>
                </button>

                {/* Copy Details */}
                <button 
                  onClick={() => {
                    setIsMoreOpen(false);
                    handleCopyDetails();
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <Copy size={15} className="text-slate-400" />
                  <span>Copy Details</span>
                </button>

                {/* Share Link */}
                <button 
                  onClick={() => {
                    setIsMoreOpen(false);
                    handleCopyShareLink();
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <Share2 size={15} className="text-slate-400" />
                  <span>Share Link</span>
                </button>

                {/* Audit Flag Toggle (Admins only) */}
                {currentUser?.role === UserRole.ADMIN && (
                  <button 
                    onClick={() => {
                      setIsMoreOpen(false);
                      handleToggleAuditFlag();
                    }}
                    className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <Flag size={15} className={cn("text-slate-400", req.flaggedForAudit && "text-rose-500 fill-rose-500")} />
                    <span>{req.flaggedForAudit ? "Remove Audit Flag" : "Flag for Audit"}</span>
                  </button>
                )}

                {/* Edit details */}
                {onEdit && req.status !== RequisitionStatus.REJECTED && (
                  currentUser?.role === UserRole.ADMIN ||
                  currentUser?.role === UserRole.SUPER_ADMIN ||
                  (req.status === RequisitionStatus.DRAFT && req.requesterId === currentUser?.id)
                ) && (
                  <button 
                    onClick={() => {
                      setIsMoreOpen(false);
                      onEdit();
                    }}
                    className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-800 mt-1 pt-2 cursor-pointer"
                  >
                    <Pencil size={15} className="text-slate-400" />
                    <span>Edit Details</span>
                  </button>
                )}

                {/* Delete Document */}
                <button 
                  onClick={() => {
                    setIsMoreOpen(false);
                    onDelete();
                    onClose();
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2 w-full text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors border-t border-slate-100 dark:border-slate-800 mt-1 pt-2 cursor-pointer"
                >
                  <Trash2 size={15} />
                  <span>Delete Document</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end flex-wrap sm:flex-nowrap">
            {!showDecisionForm && canAct() && (
              <div className="flex items-center gap-1.5 md:gap-2">
                {req.status !== RequisitionStatus.DISBURSED && (
                  <button 
                    onClick={() => setShowDecisionForm("REJECT")}
                    className="px-4 sm:px-6 py-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 rounded-xl text-[10px] md:text-xs font-black hover:bg-rose-100 transition-all cursor-pointer uppercase tracking-widest"
                  >
                    REJECT
                  </button>
                )}
                {req.status === RequisitionStatus.SUBMITTED && (
                  <>
                    <button 
                      onClick={() => setShowDecisionForm("ESCALATE")}
                      className="px-4 sm:px-6 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 rounded-xl text-[10px] md:text-xs font-black hover:bg-amber-100 transition-all cursor-pointer uppercase tracking-widest"
                    >
                      ESCALATE
                    </button>
                    <button 
                      disabled={loading}
                      onClick={() => handleDecision("APPROVE")}
                      className="px-4 sm:px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] md:text-xs font-black hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none disabled:opacity-50"
                    >
                      APPROVE
                    </button>
                  </>
                )}
                {(req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED) && (
                   <button 
                     disabled={loading}
                     onClick={() => handleDecision("APPROVE")}
                     className="px-4 sm:px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] md:text-xs font-black hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none disabled:opacity-50"
                   >
                     APPROVE L2
                   </button>
                )}
              </div>
            )}

            {req.status === RequisitionStatus.APPROVED_L2 && (
               <button 
                 onClick={() => {
                   setIsGroupVerified(false);
                   setIsAmountVerified(false);
                   setShowAssignConfirm(true);
                 }}
                 className="px-4 sm:px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] md:text-xs font-black hover:bg-indigo-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none"
               >
                ASSIGN TO BUDGET
              </button>
            )}
          </div>
        </div>

        <ConfirmationModal
          isOpen={showAssignConfirm}
          title="Verify Budget Assignment"
          message={`Are you sure you want to assign and move this requisition to the active budget pool? This will deduct the funds from the group's active allocation.`}
          confirmText="YES, ASSIGN NOW"
          confirmDisabled={!isGroupVerified || !isAmountVerified}
          onConfirm={async () => {
             setShowAssignConfirm(false);
             try {
               // Assign to matching budget project if missing
               let targetProjectId = req.projectId;
               if (!targetProjectId) {
                 const match = projects.find(p => p.groupId === req.groupName || p.name === req.groupName);
                 if (match) {
                   targetProjectId = match.id;
                   await updateRequisition(req.id, { projectId: match.id });
                 }
               }

               await updateRequisitionStatus(req.id, RequisitionStatus.DISBURSED, "APPROVE");
               
               alert(`Requisition successfully assigned to Budget Pool${targetProjectId ? ' and allocations deducted.' : '.'}`);
             } catch (err: any) {
               alert("Failed to assign to budget: " + err.message);
             }
          }}
          onCancel={() => setShowAssignConfirm(false)}
        >
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Double-Verification Safety Check</p>
            
            <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={isGroupVerified}
                onChange={(e) => setIsGroupVerified(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 mt-0.5 shrink-0"
              />
              <span>I verify destination Ministry/Group is: <strong className="text-indigo-600 block text-[11px] uppercase tracking-wide">{req.groupName}</strong></span>
            </label>

            <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none border-t border-slate-200/60 pt-2">
              <input 
                type="checkbox"
                checked={isAmountVerified}
                onChange={(e) => setIsAmountVerified(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 mt-0.5 shrink-0"
              />
              <span>I verify transaction amount is correct: <strong className="text-indigo-600 block text-[11px] font-mono">KES {req.amount.toLocaleString()}</strong></span>
            </label>
          </div>
        </ConfirmationModal>

        {/* Document Preview Overlay */}
        <AnimatePresence>
          {previewIndex !== null && normalizedAttachments.length > 0 && (
            <DocumentPreviewModal 
              attachments={normalizedAttachments}
              initialIndex={previewIndex}
              onClose={() => setPreviewIndex(null)} 
              requisition={req}
            />
          )}
          {isCameraOpen && (
            <CameraCapture 
              onCapture={handleCaptureReceipt} 
              onClose={() => setIsCameraOpen(false)} 
            />
          )}

          {/* Reactions Info Breakdown Modal */}
          {reactionDetailModalData && (() => {
            const allModalReactions = sanitizeCommentReactions(reactionDetailModalData.reactions, currentUser, users);
            const distinctEmojis = Array.from(new Set(allModalReactions.map((r: any) => r.emoji))).filter(Boolean);
            
            const filteredReactions = reactionModalActiveTab === "ALL" 
              ? allModalReactions 
              : allModalReactions.filter((r: any) => r.emoji === reactionModalActiveTab);

            return (
              <div 
                className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
                onClick={() => setReactionDetailModalData(null)}
              >
                <div 
                  className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs" />
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                        Reactions
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 text-xs font-bold font-mono">
                        {allModalReactions.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReactionDetailModalData(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Tab Filters */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar bg-slate-50/70 dark:bg-slate-950/40">
                    <button
                      type="button"
                      onClick={() => setReactionModalActiveTab("ALL")}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                        reactionModalActiveTab === "ALL"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700"
                      )}
                    >
                      <span>All</span>
                      <span className="opacity-90 font-mono">{allModalReactions.length}</span>
                    </button>

                    {distinctEmojis.map((emoji: string) => {
                      const count = allModalReactions.filter((r: any) => r.emoji === emoji).length;
                      const isSelected = reactionModalActiveTab === emoji;

                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setReactionModalActiveTab(emoji)}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700"
                          )}
                        >
                          <span className="text-sm">{emoji}</span>
                          <span className="opacity-90 font-mono">{count}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Reactor List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredReactions.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs font-medium">
                        No reactions found
                      </div>
                    ) : (
                      filteredReactions.map((r: any, idx: number) => {
                        const rUid = r.userId ? String(r.userId).trim().toLowerCase() : "";
                        const rUemail = r.userEmail ? String(r.userEmail).trim().toLowerCase() : "";
                        const isCurrent = Boolean(
                          rUid === "u-current" || 
                          rUid === "__current_user__" || 
                          (currentUser?.id && rUid === String(currentUser.id).toLowerCase()) ||
                          (currentUser?.email && (rUemail === String(currentUser.email).toLowerCase() || rUid === String(currentUser.email).toLowerCase()))
                        );

                        const emailName = formatEmailToName(r.userEmail || r.email || "");
                        const resolvedName = (isCurrent && extractUserDisplayName(currentUser))
                          ? extractUserDisplayName(currentUser)
                          : (resolveSenderName({ id: r.userId, email: r.userEmail, name: r.userName }, users) || (r.userName && !["user", "anon", "someone", "member"].includes(r.userName.toLowerCase()) ? r.userName : "") || emailName || "Parish Member");
                        const userObj = users.find((u: any) => 
                          (u.id && r.userId && u.id === r.userId) || 
                          (u.email && r.userEmail && u.email.toLowerCase() === r.userEmail.toLowerCase())
                        );
                        const directoryPic = getUserDirectoryProfilePic(r, users);
                        const avatar = directoryPic || (isCurrent 
                          ? (currentUser?.photoURL || (currentUser as any)?.avatarUrl) 
                          : (userObj?.photoURL || (userObj as any)?.avatarUrl || r.profilePicUrl || r.photoURL || r.userAvatar || r.userPhotoURL));

                        return (
                          <div key={idx} className={cn("flex items-center justify-between gap-3 pt-2.5 first:pt-0", idx > 0 && "pt-2.5")}>
                            <div className="flex items-center gap-3 min-w-0">
                              {avatar ? (
                                <img 
                                  src={avatar} 
                                  alt={resolvedName} 
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                                  onError={handleImageError}
                                />
                              ) : (
                                <div className={`w-9 h-9 rounded-full ${getAvatarBgColor(resolvedName)} font-bold text-xs flex items-center justify-center text-white shrink-0 shadow-2xs`}>
                                  {getAvatarInitials(resolvedName)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                                    {resolvedName}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                                  {userObj?.role || userObj?.department || r.userEmail || "Parish Member"}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-2xl leading-none">{r.emoji}</span>
                              {isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleToggleReaction(reactionDetailModalData.commentId, r.emoji);
                                    const updated = allModalReactions.filter((mr: any) => !(mr.emoji === r.emoji && isCurrent));
                                    if (updated.length === 0) {
                                      setReactionDetailModalData(null);
                                    } else {
                                      setReactionDetailModalData({
                                        ...reactionDetailModalData,
                                        reactions: updated
                                      });
                                    }
                                  }}
                                  className="text-[11px] font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 hover:underline cursor-pointer ml-1"
                                  title="Remove your reaction"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-[11px] flex items-center gap-1">
                      <span>Restricted Reactions</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReactionDetailModalData(null)}
                      className="px-4 py-1.5 font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </AnimatePresence>
      </motion.div>
    );

    if (isPage) {
      return mainContent;
    }

    return (
      <div className={cn(
        "fixed inset-0 z-[100] flex items-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-hidden transition-all duration-300",
        isSidePreviewOpen ? "justify-start pl-2 sm:pl-4 md:pl-6" : "justify-center"
      )}>
        {mainContent}
      </div>
    );
  };

export default RequisitionsPanel;
