import React, { useState, useMemo, useRef, useCallback } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { Requisition, Comment, UserRole, RequisitionStatus } from "../types";
import { cn, resolveSenderName } from "../lib/utils";
import { renderFormattedCommentText } from "../lib/commentFormatUtils";
import { databaseService } from "../lib/databaseService";
import { handleReactionLogic } from "./RequisitionsPanel";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, 
  CheckCircle, 
  ExternalLink, 
  ThumbsUp, 
  Heart, 
  Sparkles, 
  Search, 
  Filter, 
  Clock, 
  ShieldCheck, 
  Layers, 
  Smile, 
  Tag, 
  MessageCircle,
  Share2,
  X,
  Send,
  User as UserIcon,
  CornerDownRight,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

interface RecentCommentsAndReactionsFeedProps {
  onViewChange?: (view: string) => void;
}

interface FlatCommentCardData {
  id: string; // comment or reply ID
  requisitionId: string;
  requisitionTitle: string;
  requisitionStatus: RequisitionStatus;
  groupName: string;
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorRole?: string;
  authorAvatar?: string;
  handle: string;
  text: string;
  timestamp: string;
  createdAtRaw: Date;
  isReply: boolean;
  replyCount: number;
  reactions: any[];
  reactionCounts: Record<string, number>;
  totalReactionCount: number;
  userReactedEmoji?: string;
  rawComment: Comment;
  rawRequisition: Requisition;
}

// Avatar Initials Helper
function getAvatarInitials(name: string): string {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
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

// Format date to "9:30 PM • Feb 17, 2026"
function formatSocialTimestamp(dateStr?: string): string {
  if (!dateStr) return "Just now";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    
    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    return `${timeStr} • ${datePart}`;
  } catch {
    return "Recently";
  }
}

// Calculate relative time e.g. "12m ago"
function formatRelativeShort(dateStr?: string): string {
  if (!dateStr) return "now";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "now";
    const diff = (Date.now() - d.getTime()) / 1000; // seconds
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return "now";
  }
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

const getAccessLevelLabel = (role?: string) => {
  if (!role) return "Member";
  switch (role) {
    case "CHURCH_GROUP":
      return "Church Group Rep";
    case "APPROVER_L1":
      return "Approver Level 1";
    case "APPROVER_L2":
      return "Approver Level 2";
    case "FINANCE":
      return "Finance Officer";
    case "SUPER_ADMIN":
      return "Super Admin";
    default:
      return role.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  }
};

export const RecentCommentsAndReactionsFeed: React.FC<RecentCommentsAndReactionsFeedProps> = ({ onViewChange }) => {
  const { requisitions, currentUser, users, setSelectedRequisition, setGlobalSearchTerm } = useRequisitions();

  const [searchTerm, setSearchTerm] = useState("");
  const [displayLimit, setDisplayLimit] = useState(6);
  const [selectedPreviewCard, setSelectedPreviewCard] = useState<FlatCommentCardData | null>(null);

  // Get user's assigned group list
  const userGroups = useMemo(() => {
    if (!currentUser) return [];
    const filterGroups = currentUser.groups || [];
    return filterGroups.length > 0 ? filterGroups : (currentUser.group ? [currentUser.group] : []);
  }, [currentUser]);

  // Extract all flattened comment items from accessible requisitions
  const flatCommentsData = useMemo(() => {
    const list: FlatCommentCardData[] = [];
    if (!requisitions || requisitions.length === 0) return list;

    const accessibleReqs = requisitions.filter(req => canUserAccessRequisition(req, currentUser));

    accessibleReqs.forEach(req => {
      if (!req.comments || !Array.isArray(req.comments)) return;

      req.comments.forEach(c => {
        if (!c || !c.text) return;

        const processComment = (commentObj: Comment, isReply: boolean = false) => {
          const resolvedName = resolveSenderName(
            { id: commentObj.authorId, email: commentObj.authorEmail, name: commentObj.authorName, role: commentObj.authorRole },
            users || []
          ) || commentObj.authorName || (commentObj.authorEmail ? commentObj.authorEmail.split("@")[0] : "User");

          const userObj = users.find(u => 
            (u.id && commentObj.authorId && u.id === commentObj.authorId) ||
            (u.email && commentObj.authorEmail && u.email.toLowerCase() === commentObj.authorEmail.toLowerCase())
          );

          const avatar = commentObj.authorAvatar || commentObj.authorPhotoURL || userObj?.photoURL || (userObj as any)?.avatarUrl || "";
          const handle = `@${(commentObj.authorEmail ? commentObj.authorEmail.split("@")[0] : resolvedName.replace(/\s+/g, "").toLowerCase())}`;

          // Reactions
          const reactionsArr = Array.isArray(commentObj.reactions) 
            ? commentObj.reactions 
            : (commentObj.reactions ? Object.values(commentObj.reactions) : []);

          const currentUserId = currentUser?.id || currentUser?.email || "anon";
          const currentUserEmail = (currentUser?.email || "").toLowerCase().trim();

          let userReactedEmoji: string | undefined = undefined;
          const reactionCounts: Record<string, number> = {};

          reactionsArr.forEach((r: any) => {
            if (!r || !r.emoji) return;
            reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;

            const rDirId = r.userDirectoryId || r.userId;
            const curUid = (currentUser as any)?.uid;
            const isUser = (rDirId && (rDirId === currentUserId || rDirId === currentUser?.id || (curUid && rDirId === curUid))) ||
              (r.userEmail && r.userEmail.toLowerCase().trim() === currentUserEmail) ||
              (Array.isArray(r.userIds) && r.userIds.includes(currentUserId));

            if (isUser) {
              userReactedEmoji = r.emoji;
            }
          });

          const totalReactionCount = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
          const replyCount = Array.isArray(commentObj.replies) ? commentObj.replies.length : 0;
          const rawDateStr = commentObj.createdAt || commentObj.timestamp || req.updatedAt || new Date().toISOString();
          const createdAtRaw = new Date(rawDateStr);

          list.push({
            id: commentObj.id,
            requisitionId: req.id,
            requisitionTitle: req.title,
            requisitionStatus: req.status,
            groupName: req.groupName || "General Ministry",
            authorId: commentObj.authorId,
            authorName: resolvedName,
            authorEmail: commentObj.authorEmail || "",
            authorRole: commentObj.authorRole || userObj?.role || "Member",
            authorAvatar: avatar,
            handle,
            text: commentObj.text,
            timestamp: rawDateStr,
            createdAtRaw,
            isReply,
            replyCount,
            reactions: reactionsArr,
            reactionCounts,
            totalReactionCount,
            userReactedEmoji,
            rawComment: commentObj,
            rawRequisition: req
          });
        };

        // Process top-level comment
        processComment(c, false);

        // Process nested replies
        if (Array.isArray(c.replies)) {
          c.replies.forEach(rep => {
            if (rep && rep.text) {
              processComment(rep, true);
            }
          });
        }
      });
    });

    // Sort newest first
    list.sort((a, b) => b.createdAtRaw.getTime() - a.createdAtRaw.getTime());

    return list;
  }, [requisitions, currentUser, users]);

  // Apply Search Keyword Filter
  const filteredComments = useMemo(() => {
    if (!searchTerm.trim()) return flatCommentsData;

    const q = searchTerm.toLowerCase().trim();
    return flatCommentsData.filter(item => {
      const textMatch = item.text.toLowerCase().includes(q);
      const nameMatch = item.authorName.toLowerCase().includes(q);
      const handleMatch = item.handle.toLowerCase().includes(q);
      const reqMatch = item.requisitionId.toLowerCase().includes(q) || item.requisitionTitle.toLowerCase().includes(q);
      const groupMatch = item.groupName.toLowerCase().includes(q);

      return textMatch || nameMatch || handleMatch || reqMatch || groupMatch;
    });
  }, [flatCommentsData, searchTerm]);

  // Open Requisition Page directly with full details
  const handleJumpToRequisition = useCallback((reqObjOrId: Requisition | string) => {
    let targetReq: Requisition | undefined;
    if (typeof reqObjOrId === "string") {
      targetReq = requisitions.find(r => r.id === reqObjOrId);
    } else {
      targetReq = reqObjOrId;
    }

    if (targetReq) {
      setSelectedRequisition(targetReq);
      setGlobalSearchTerm(targetReq.id);
    } else if (typeof reqObjOrId === "string") {
      setGlobalSearchTerm(reqObjOrId);
    }

    if (onViewChange) {
      onViewChange("requisitions");
    }
  }, [requisitions, setSelectedRequisition, setGlobalSearchTerm, onViewChange]);

  // Ref for horizontal scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -340, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 340, behavior: "smooth" });
    }
  };

  const displayedCards = filteredComments;

  return (
    <div 
      id="recent-comments-reactions-feed-section"
      className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 md:p-8 space-y-6 my-8 relative overflow-hidden shadow-xs border border-slate-100 dark:border-slate-800"
    >
      {/* Decorative Accent Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1 px-2 bg-sky-50 dark:bg-sky-950/80 text-sky-600 dark:text-sky-400 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-sky-200/80 dark:border-sky-800/80">
              <Sparkles size={12} className="text-sky-500 animate-pulse" />
              Requisitions Discussion
            </span>

            <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-indigo-200/80 dark:border-indigo-800/80">
              {filteredComments.length} {filteredComments.length === 1 ? "Activity" : "Comments"}
            </span>
          </div>

          <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            Recent Comments & Reactions
          </h3>
          <p className="text-slate-400 dark:text-slate-500 text-[10px] md:text-xs font-medium leading-relaxed max-w-2xl">
            Realtime discussion cards and reactions from team members. Click any card or title badge to jump straight to the requisition details.
          </p>
        </div>

        {/* Search & Row Navigation Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search comments..."
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                ×
              </button>
            )}
          </div>

          {/* Left / Right Row Scroll Controls */}
          {displayedCards.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <button
                onClick={scrollLeft}
                aria-label="Scroll left"
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors shadow-2xs cursor-pointer"
                title="Scroll comments left"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={scrollRight}
                aria-label="Scroll right"
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 transition-colors shadow-2xs cursor-pointer"
                title="Scroll comments right"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Single-Row Horizontal Cards Carousel */}
      {displayedCards.length > 0 ? (
        <div 
          ref={scrollContainerRef}
          className="flex flex-row overflow-x-auto gap-4 md:gap-5 pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory focus:outline-none"
          style={{ scrollbarWidth: "thin" }}
        >
          {displayedCards.map((card) => {
            const existingReactions = Object.entries(card.reactionCounts).filter(([_, count]) => count > 0);

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                onClick={() => handleJumpToRequisition(card.rawRequisition)}
                className="min-w-[300px] sm:min-w-[340px] md:min-w-[370px] max-w-[370px] shrink-0 snap-start bg-slate-50/80 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-2xl md:rounded-3xl p-5 md:p-6 transition-all duration-200 relative group flex flex-col justify-between border border-slate-200/70 dark:border-slate-700/60 hover:border-sky-400/80 dark:hover:border-sky-500/80 hover:shadow-lg hover:shadow-sky-500/5 cursor-pointer select-none"
              >
                <div>
                  {/* Top Header: User Profile, Name, Verified Checkmark, Access Level, Title Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar Photo or Initial Circle */}
                      <div className="shrink-0 relative">
                        {card.authorAvatar ? (
                          <img
                            src={card.authorAvatar}
                            alt={card.authorName}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800 shadow-2xs"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className={cn(
                            "w-10 h-10 rounded-full ring-2 ring-slate-100 dark:ring-slate-800 font-bold text-xs flex items-center justify-center shadow-2xs",
                            getAvatarBgColor(card.authorName)
                          )}>
                            {getAvatarInitials(card.authorName)}
                          </div>
                        )}
                      </div>

                      {/* Name & Access Level */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={card.authorName}>
                            {card.authorName}
                          </h4>
                          
                          {/* Official Verified Blue Checkmark Icon */}
                          <span className="inline-flex items-center justify-center text-sky-500 shrink-0" title="Verified Portal User">
                            <svg className="w-4 h-4 fill-sky-500 text-white" viewBox="0 0 24 24">
                              <path fill="currentColor" d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.38-1.93-4.31-4.313-4.31-.495 0-.965.084-1.4.238C14.23 2.155 12.86 1.28 11.28 1.28c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.38 0-4.31 1.93-4.31 4.313 0 .495.084.965.238 1.4C.875 9.55 0 10.92 0 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.38 1.93 4.31 4.313 4.31.495 0 .965-.084 1.4-.238 1.28 1.273 2.65 2.148 4.23 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.38 0 4.31-1.93 4.31-4.313 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6zm-12.28 4.3l-4.2-4.2 1.41-1.41 2.79 2.79 6.29-6.29 1.41 1.41-7.7 7.7z"/>
                            </svg>
                          </span>
                        </div>

                        {/* Access Level / Role & Ministry Group */}
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate">
                          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{getAccessLevelLabel(card.authorRole)}</span>
                          <span className="text-slate-300 dark:text-slate-600 mx-1">•</span>
                          <span className="text-slate-500 dark:text-slate-400">{card.groupName}</span>
                        </p>
                      </div>
                    </div>

                    {/* Top Right Requisition Title Badge */}
                    <div
                      className="shrink-0 bg-sky-50 dark:bg-sky-950/60 group-hover:bg-sky-100 dark:group-hover:bg-sky-900/80 text-sky-600 dark:text-sky-400 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-sky-200/80 dark:border-sky-800/80 transition-all flex items-center gap-1 max-w-[130px] sm:max-w-[150px] truncate"
                      title={`Requisition: ${card.requisitionTitle}`}
                    >
                      <Tag size={10} className="text-sky-500 shrink-0" />
                      <span className="truncate">{card.requisitionTitle}</span>
                    </div>
                  </div>

                  {/* Main Comment Narrative Body with 3-line clamp */}
                  <div className="my-3 text-slate-800 dark:text-slate-100 text-xs md:text-sm font-normal leading-relaxed break-words font-sans line-clamp-3">
                    {renderFormattedCommentText(card.text)}
                  </div>

                  {/* Timestamp Line */}
                  <div className="text-[11px] font-sans text-slate-400 dark:text-slate-500 my-2 pt-2 border-t border-slate-100/80 dark:border-slate-800/80 flex items-center justify-between">
                    <span>{formatSocialTimestamp(card.timestamp)}</span>
                    <span className="text-[10px] font-mono text-slate-400">({formatRelativeShort(card.timestamp)})</span>
                  </div>
                </div>

                {/* Bottom Action / Reaction Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-slate-400 text-xs" onClick={(e) => e.stopPropagation()}>
                  {/* Icon 1: Reply / Comment Count */}
                  <button
                    onClick={() => setSelectedPreviewCard(card)}
                    className="flex items-center gap-1.5 hover:text-sky-500 transition-colors cursor-pointer text-[11px] font-medium"
                    title={`${card.replyCount} replies - Click for details`}
                  >
                    <MessageSquare size={15} className="text-slate-400 group-hover:text-sky-500" />
                    <span>{card.replyCount}</span>
                  </button>

                  {/* Icon 2: Read-Only Reactions Display */}
                  <div className="flex items-center gap-1">
                    {existingReactions.length > 0 ? (
                      existingReactions.map(([emoji, count]) => (
                        <span
                          key={emoji}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 font-medium select-none flex items-center gap-1 cursor-default"
                          title={`${count} reaction${count === 1 ? "" : "s"}`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-mono font-bold">{count}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-600 px-1 select-none">
                        No reactions
                      </span>
                    )}
                  </div>

                  {/* Icon 3: Requisition Workflow Status Pill */}
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0",
                    card.requisitionStatus === RequisitionStatus.DISBURSED
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-800"
                      : card.requisitionStatus === RequisitionStatus.APPROVED_L2
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:border-indigo-800"
                      : card.requisitionStatus === RequisitionStatus.APPROVED_L1
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-800"
                      : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                  )}>
                    {card.requisitionStatus}
                  </span>

                  {/* Icon 4: Open Full Requisition Details Button */}
                  <button
                    onClick={() => handleJumpToRequisition(card.rawRequisition)}
                    className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950 rounded-md transition-all cursor-pointer"
                    title="Open full requisition details page"
                  >
                    <ExternalLink size={15} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400">
          <MessageCircle size={36} className="text-slate-300 dark:text-slate-600" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mt-2">
            No recent comments found
          </p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-sm">
            {searchTerm 
              ? "Try adjusting your search query." 
              : "Discussion comments posted on your accessible requisitions will appear here."}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="mt-3 text-xs font-bold uppercase tracking-wider text-sky-600 hover:underline cursor-pointer"
            >
              Reset Search Filter
            </button>
          )}
        </div>
      )}

      {/* Quick Comment Detail Modal */}
      <AnimatePresence>
        {selectedPreviewCard && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-sky-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Discussion Card Details
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedPreviewCard(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Card Body */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full font-bold text-xs flex items-center justify-center",
                    getAvatarBgColor(selectedPreviewCard.authorName)
                  )}>
                    {getAvatarInitials(selectedPreviewCard.authorName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {selectedPreviewCard.authorName}
                      </h4>
                      <CheckCircle size={14} className="text-sky-500 fill-sky-500 text-white" />
                    </div>
                    <p className="text-xs text-slate-400">
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{getAccessLevelLabel(selectedPreviewCard.authorRole)}</span> • {selectedPreviewCard.groupName}
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-slate-100 text-sm leading-relaxed">
                  {renderFormattedCommentText(selectedPreviewCard.text)}
                </div>

                <div className="text-xs text-slate-400 font-medium">
                  Requisition: <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedPreviewCard.requisitionTitle}</span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedPreviewCard(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const rawReq = selectedPreviewCard.rawRequisition;
                    setSelectedPreviewCard(null);
                    handleJumpToRequisition(rawReq);
                  }}
                  className="px-4 py-2 text-xs font-bold bg-sky-600 text-white hover:bg-sky-500 rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open Full Requisition Details</span>
                  <ExternalLink size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
