/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { Requisition, Comment } from "../types";
import { resolveSenderName } from "../lib/utils";

const STORAGE_KEY_PREFIX = "st_andrews_comments_read_v1_";
const UPDATE_EVENT_NAME = "requisition_comments_read_updated";

/**
 * Derives a consistent storage key for the current logged in user
 */
export function getUserCommentsStorageKey(currentUser: any): string {
  if (!currentUser) return `${STORAGE_KEY_PREFIX}anonymous`;
  const keyIdentifier = (
    currentUser.id || 
    currentUser.uid || 
    currentUser.email || 
    currentUser.name || 
    "user"
  ).toLowerCase().trim();
  return `${STORAGE_KEY_PREFIX}${keyIdentifier}`;
}

/**
 * Retrieves the map of { [reqId: string]: number (timestamp in ms) } for the given user
 */
export function getReadTimestampsMap(currentUser: any): Record<string, number> {
  if (typeof window === "undefined" || !currentUser) return {};
  try {
    const key = getUserCommentsStorageKey(currentUser);
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse comment read timestamps:", err);
    return {};
  }
}

/**
 * Saves the read timestamp for a specific requisition
 */
export function markRequisitionCommentsAsRead(reqId: string, currentUser: any, timestamp: number = Date.now()): void {
  if (typeof window === "undefined" || !currentUser || !reqId) return;
  try {
    const key = getUserCommentsStorageKey(currentUser);
    const map = getReadTimestampsMap(currentUser);
    map[reqId] = timestamp;
    localStorage.setItem(key, JSON.stringify(map));

    // Dispatch global custom event for instant reactivity across components
    window.dispatchEvent(
      new CustomEvent(UPDATE_EVENT_NAME, {
        detail: { reqId, timestamp, userId: currentUser.id || currentUser.email }
      })
    );
  } catch (err) {
    console.error("Failed to mark requisition comments as read:", err);
  }
}

/**
 * Marks all requisitions in the list as read
 */
export function markAllRequisitionsCommentsAsRead(requisitions: Requisition[], currentUser: any): void {
  if (typeof window === "undefined" || !currentUser || !Array.isArray(requisitions)) return;
  try {
    const key = getUserCommentsStorageKey(currentUser);
    const map = getReadTimestampsMap(currentUser);
    const now = Date.now();
    requisitions.forEach(req => {
      if (req && req.id) {
        map[req.id] = now;
      }
    });
    localStorage.setItem(key, JSON.stringify(map));

    window.dispatchEvent(
      new CustomEvent(UPDATE_EVENT_NAME, {
        detail: { reqId: "ALL", timestamp: now, userId: currentUser.id || currentUser.email }
      })
    );
  } catch (err) {
    console.error("Failed to mark all comments as read:", err);
  }
}

/**
 * Checks whether a comment or reply was authored by the current logged-in user
 */
export function isCommentAuthoredByCurrentUser(comment: any, currentUser: any): boolean {
  if (!comment || !currentUser) return false;

  const curId = currentUser.id ? String(currentUser.id).trim().toLowerCase() : "";
  const curUid = currentUser.uid ? String(currentUser.uid).trim().toLowerCase() : "";
  const curEmail = currentUser.email ? String(currentUser.email).trim().toLowerCase() : "";
  const curUsername = currentUser.username ? String(currentUser.username).trim().toLowerCase() : "";

  const aId = comment.authorId ? String(comment.authorId).trim().toLowerCase() : "";
  const aEmail = comment.authorEmail ? String(comment.authorEmail).trim().toLowerCase() : "";
  const aName = comment.authorName ? String(comment.authorName).trim().toLowerCase() : "";

  if (aId && (aId === "u-current" || aId === "__current_user__")) return true;
  if (curId && (aId === curId || aEmail === curId)) return true;
  if (curUid && (aId === curUid || aEmail === curUid)) return true;
  if (curEmail && (aId === curEmail || aEmail === curEmail)) return true;
  if (curUsername && (aId === curUsername || aName === curUsername)) return true;

  return false;
}

/**
 * Extracts a flattened list of all comments and sub-replies from a requisition
 */
export function extractAllCommentsAndReplies(req: Requisition): Comment[] {
  if (!req || !Array.isArray(req.comments) || req.comments.length === 0) return [];
  const list: Comment[] = [];

  req.comments.forEach((c: any) => {
    if (!c) return;
    list.push(c);
    if (Array.isArray(c.replies)) {
      c.replies.forEach((r: any) => {
        if (r) list.push(r);
      });
    }
  });

  return list;
}

export interface RequisitionUnreadCommentInfo {
  reqId: string;
  unreadCount: number;
  hasUnread: boolean;
  totalCommentsCount: number;
  latestUnreadComment: Comment | null;
  latestComment: Comment | null;
  unreadAuthors: string[];
  lastReadTimestamp: number;
  latestCommentTimestamp: number;
}

/**
 * Calculates unread comment details for a specific requisition
 */
export function getRequisitionUnreadCommentInfo(
  req: Requisition,
  currentUser: any,
  users: any[] = [],
  readMap?: Record<string, number>
): RequisitionUnreadCommentInfo {
  const reqId = req?.id || "";
  const allComments = extractAllCommentsAndReplies(req);
  const totalCommentsCount = allComments.length;

  if (!req || totalCommentsCount === 0 || !currentUser) {
    return {
      reqId,
      unreadCount: 0,
      hasUnread: false,
      totalCommentsCount,
      latestUnreadComment: null,
      latestComment: null,
      unreadAuthors: [],
      lastReadTimestamp: 0,
      latestCommentTimestamp: 0
    };
  }

  const userReadMap = readMap || getReadTimestampsMap(currentUser);
  const lastReadTimestamp = userReadMap[reqId] || 0;

  let latestCommentTimestamp = 0;
  let latestComment: Comment | null = null;
  const unreadComments: Comment[] = [];
  const unreadAuthorsSet = new Set<string>();

  allComments.forEach((c: Comment) => {
    const rawTime = c.createdAt || c.timestamp || (c as any).created_at;
    const timeMs = rawTime ? new Date(rawTime).getTime() : 0;

    if (timeMs > latestCommentTimestamp) {
      latestCommentTimestamp = timeMs;
      latestComment = c;
    }

    const isMine = isCommentAuthoredByCurrentUser(c, currentUser);
    if (!isMine) {
      // It is a comment by someone else. Check if it was created after our last read time.
      if (timeMs > lastReadTimestamp) {
        unreadComments.push(c);
        const resolvedName = resolveSenderName(
          { id: c.authorId, email: c.authorEmail, name: c.authorName, role: c.authorRole },
          users
        ) || c.authorName || (c.authorEmail ? c.authorEmail.split("@")[0] : "Someone");
        
        if (resolvedName && !["User", "Someone", "anon"].includes(resolvedName)) {
          unreadAuthorsSet.add(resolvedName);
        } else {
          unreadAuthorsSet.add("Member");
        }
      }
    }
  });

  // Sort unread comments descending by time
  unreadComments.sort((a, b) => {
    const tA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const tB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return tB - tA;
  });

  const latestUnreadComment = unreadComments.length > 0 ? unreadComments[0] : null;

  return {
    reqId,
    unreadCount: unreadComments.length,
    hasUnread: unreadComments.length > 0,
    totalCommentsCount,
    latestUnreadComment,
    latestComment,
    unreadAuthors: Array.from(unreadAuthorsSet),
    lastReadTimestamp,
    latestCommentTimestamp
  };
}

/**
 * Custom React hook that subscribes to read/unread changes and provides real-time tracking
 */
export function useUnreadCommentsTracker(
  requisitions: Requisition[],
  currentUser: any,
  users: any[] = []
) {
  const [readMap, setReadMap] = useState<Record<string, number>>(() => getReadTimestampsMap(currentUser));
  const [version, setVersion] = useState(0);

  // Reload read map whenever the active user changes
  useEffect(() => {
    setReadMap(getReadTimestampsMap(currentUser));
  }, [currentUser?.id, currentUser?.email]);

  // Listen for real-time comment read events across the application and tabs
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      setReadMap(getReadTimestampsMap(currentUser));
      setVersion(v => v + 1);
    };

    const handleStorage = (e: StorageEvent) => {
      const expectedKey = getUserCommentsStorageKey(currentUser);
      if (e.key === expectedKey) {
        setReadMap(getReadTimestampsMap(currentUser));
        setVersion(v => v + 1);
      }
    };

    window.addEventListener(UPDATE_EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [currentUser]);

  // Compute map of requisition ID to unread information
  const unreadInfoMap = useMemo(() => {
    const map = new Map<string, RequisitionUnreadCommentInfo>();
    if (!Array.isArray(requisitions) || requisitions.length === 0 || !currentUser) {
      return map;
    }

    requisitions.forEach(req => {
      if (req && req.id) {
        const info = getRequisitionUnreadCommentInfo(req, currentUser, users, readMap);
        map.set(req.id, info);
      }
    });

    return map;
  }, [requisitions, currentUser, users, readMap, version]);

  const totalUnreadCount = useMemo(() => {
    let sum = 0;
    unreadInfoMap.forEach(info => {
      sum += info.unreadCount;
    });
    return sum;
  }, [unreadInfoMap]);

  const requisitionsWithUnreadCount = useMemo(() => {
    let count = 0;
    unreadInfoMap.forEach(info => {
      if (info.hasUnread) count++;
    });
    return count;
  }, [unreadInfoMap]);

  const getReqUnreadInfo = useCallback((req: Requisition): RequisitionUnreadCommentInfo => {
    if (!req || !req.id) {
      return {
        reqId: "",
        unreadCount: 0,
        hasUnread: false,
        totalCommentsCount: 0,
        latestUnreadComment: null,
        latestComment: null,
        unreadAuthors: [],
        lastReadTimestamp: 0,
        latestCommentTimestamp: 0
      };
    }
    return unreadInfoMap.get(req.id) || getRequisitionUnreadCommentInfo(req, currentUser, users, readMap);
  }, [unreadInfoMap, currentUser, users, readMap]);

  const markAsRead = useCallback((reqId: string) => {
    markRequisitionCommentsAsRead(reqId, currentUser);
    setReadMap(prev => ({
      ...prev,
      [reqId]: Date.now()
    }));
    setVersion(v => v + 1);
  }, [currentUser]);

  const markAllAsRead = useCallback(() => {
    markAllRequisitionsCommentsAsRead(requisitions, currentUser);
    const now = Date.now();
    setReadMap(prev => {
      const next = { ...prev };
      requisitions.forEach(r => {
        if (r && r.id) next[r.id] = now;
      });
      return next;
    });
    setVersion(v => v + 1);
  }, [requisitions, currentUser]);

  return {
    getReqUnreadInfo,
    markAsRead,
    markAllAsRead,
    totalUnreadCount,
    requisitionsWithUnreadCount,
    unreadInfoMap
  };
}
