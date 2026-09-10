/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { Requisition, Comment } from "../types";
import { resolveSenderName } from "../lib/utils";

const STORAGE_KEY_PREFIX = "st_andrews_comments_read_v1_";
const UPDATE_EVENT_NAME = "requisition_comments_read_updated";
const LAST_ACTIVE_USER_KEY = "st_andrews_last_active_user_email";

/**
 * Returns a sanitized document ID for storing read comment timestamps in database
 */
export function getDbDocIdForUser(currentUser: any): string {
  const raw = (
    currentUser?.email || 
    currentUser?.id || 
    currentUser?.uid || 
    "global"
  ).toLowerCase().trim();
  const sanitized = raw.replace(/[^a-z0-9]/g, "_");
  return `comment_reads_${sanitized}`;
}

/**
 * Derives consistent storage keys for the current logged in user.
 * Prioritizes email as the invariant canonical key, while also providing
 * fallbacks to id and uid for seamless backward compatibility.
 */
export function getUserCommentsStorageKeys(currentUser: any): string[] {
  const keys: string[] = [];
  if (!currentUser) {
    if (typeof window !== "undefined") {
      try {
        const lastEmail = localStorage.getItem(LAST_ACTIVE_USER_KEY);
        if (lastEmail) {
          keys.push(`${STORAGE_KEY_PREFIX}${lastEmail.toLowerCase().trim()}`);
        }
      } catch (err) {}
    }
    keys.push(`${STORAGE_KEY_PREFIX}anonymous`);
    return keys;
  }

  const email = currentUser.email ? String(currentUser.email).toLowerCase().trim() : "";
  const id = currentUser.id ? String(currentUser.id).toLowerCase().trim() : "";
  const uid = currentUser.uid ? String(currentUser.uid).toLowerCase().trim() : "";
  const username = currentUser.username ? String(currentUser.username).toLowerCase().trim() : "";

  // Canonical key is email (or id if email is not available)
  if (email) {
    keys.push(`${STORAGE_KEY_PREFIX}${email}`);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(LAST_ACTIVE_USER_KEY, email);
      } catch (err) {}
    }
  }
  if (id && !keys.includes(`${STORAGE_KEY_PREFIX}${id}`)) {
    keys.push(`${STORAGE_KEY_PREFIX}${id}`);
  }
  if (uid && !keys.includes(`${STORAGE_KEY_PREFIX}${uid}`)) {
    keys.push(`${STORAGE_KEY_PREFIX}${uid}`);
  }
  if (username && !keys.includes(`${STORAGE_KEY_PREFIX}${username}`)) {
    keys.push(`${STORAGE_KEY_PREFIX}${username}`);
  }

  if (keys.length === 0) {
    keys.push(`${STORAGE_KEY_PREFIX}user`);
  }

  return keys;
}

export function getUserCommentsStorageKey(currentUser: any): string {
  const keys = getUserCommentsStorageKeys(currentUser);
  return keys[0] || `${STORAGE_KEY_PREFIX}anonymous`;
}

/**
 * Retrieves the map of { [reqId: string]: number (timestamp in ms) } for the given user,
 * merging keys across email and ID records to ensure no read history is lost.
 */
export function getReadTimestampsMap(currentUser: any): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const keys = getUserCommentsStorageKeys(currentUser);
    const merged: Record<string, number> = {};
    
    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            for (const [reqId, ts] of Object.entries(parsed)) {
              const num = Number(ts);
              if (!isNaN(num) && num > 0) {
                merged[reqId] = Math.max(merged[reqId] || 0, num);
              }
            }
          }
        } catch (e) {}
      }
    }

    return merged;
  } catch (err) {
    console.error("Failed to parse comment read timestamps:", err);
    return {};
  }
}

/**
 * Persists read map to backend database asynchronously
 */
export async function persistReadMapToBackend(currentUser: any, map: Record<string, number>): Promise<void> {
  if (typeof window === "undefined" || !currentUser) return;
  const docId = getDbDocIdForUser(currentUser);
  try {
    await fetch(`/api/db/notification_states/${docId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: docId,
        userEmail: currentUser.email || "",
        userId: currentUser.id || currentUser.uid || "",
        commentReadTimestamps: map,
        updatedAt: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn("[Comment Tracker] Could not persist read state to database:", err);
  }
}

/**
 * Fetches read map from backend database
 */
export async function fetchReadMapFromBackend(currentUser: any): Promise<Record<string, number>> {
  if (typeof window === "undefined" || !currentUser) return {};
  const docId = getDbDocIdForUser(currentUser);
  try {
    const res = await fetch(`/api/db/notification_states/${docId}`);
    if (!res.ok) return {};
    const data = await res.json();
    const rawMap = data.comment_read_timestamps || data.commentReadTimestamps || {};
    if (rawMap && typeof rawMap === "object") {
      const valid: Record<string, number> = {};
      for (const [k, v] of Object.entries(rawMap)) {
        const num = Number(v);
        if (!isNaN(num) && num > 0) {
          valid[k] = num;
        }
      }
      return valid;
    }
  } catch (err) {
    console.warn("[Comment Tracker] Could not fetch read state from database:", err);
  }
  return {};
}

/**
 * Saves the read timestamp for a specific requisition
 */
export function markRequisitionCommentsAsRead(
  reqId: string, 
  currentUser: any, 
  timestamp?: number,
  req?: Requisition
): void {
  if (typeof window === "undefined" || !currentUser || !reqId) return;
  try {
    const keys = getUserCommentsStorageKeys(currentUser);
    const map = getReadTimestampsMap(currentUser);

    // If a requisition is provided, ensure timestamp is at least 1s higher than any existing comment
    let effectiveTimestamp = timestamp || Date.now();
    if (req && Array.isArray(req.comments) && req.comments.length > 0) {
      const allComments = extractAllCommentsAndReplies(req);
      for (const c of allComments) {
        const rawTime = c.createdAt || c.timestamp || (c as any).created_at;
        const timeMs = rawTime ? new Date(rawTime).getTime() : 0;
        if (timeMs > effectiveTimestamp) {
          effectiveTimestamp = timeMs + 1000;
        }
      }
    }

    map[reqId] = effectiveTimestamp;

    // Save to all associated keys in localStorage
    for (const key of keys) {
      localStorage.setItem(key, JSON.stringify(map));
    }

    // Persist to backend database for permanent persistence across reloads/devices
    persistReadMapToBackend(currentUser, map);

    // Dispatch global custom event for instant reactivity across components
    window.dispatchEvent(
      new CustomEvent(UPDATE_EVENT_NAME, {
        detail: { reqId, timestamp: effectiveTimestamp, userId: currentUser.id || currentUser.email }
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
    const keys = getUserCommentsStorageKeys(currentUser);
    const map = getReadTimestampsMap(currentUser);
    const now = Date.now();
    
    requisitions.forEach(req => {
      if (req && req.id) {
        let reqTs = now;
        if (Array.isArray(req.comments) && req.comments.length > 0) {
          const allComments = extractAllCommentsAndReplies(req);
          for (const c of allComments) {
            const rawTime = c.createdAt || c.timestamp || (c as any).created_at;
            const timeMs = rawTime ? new Date(rawTime).getTime() : 0;
            if (timeMs > reqTs) {
              reqTs = timeMs + 1000;
            }
          }
        }
        map[req.id] = reqTs;
      }
    });

    for (const key of keys) {
      localStorage.setItem(key, JSON.stringify(map));
    }

    // Persist to backend database
    persistReadMapToBackend(currentUser, map);

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

  // Reload read map whenever the active user changes, and fetch latest state from database
  useEffect(() => {
    let isMounted = true;
    const initialMap = getReadTimestampsMap(currentUser);
    setReadMap(initialMap);

    if (currentUser) {
      fetchReadMapFromBackend(currentUser).then(remoteMap => {
        if (!isMounted || !remoteMap || Object.keys(remoteMap).length === 0) return;
        const currentLocal = getReadTimestampsMap(currentUser);
        let hasNew = false;
        const merged: Record<string, number> = { ...currentLocal };

        for (const [rId, ts] of Object.entries(remoteMap)) {
          const num = Number(ts);
          if (!isNaN(num) && num > 0) {
            if (!merged[rId] || num > merged[rId]) {
              merged[rId] = num;
              hasNew = true;
            }
          }
        }

        if (hasNew) {
          const keys = getUserCommentsStorageKeys(currentUser);
          for (const k of keys) {
            try {
              localStorage.setItem(k, JSON.stringify(merged));
            } catch (e) {}
          }
          setReadMap(merged);
          setVersion(v => v + 1);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.uid]);

  // Listen for real-time comment read events across the application and tabs
  useEffect(() => {
    const handleUpdate = (e: Event) => {
      setReadMap(getReadTimestampsMap(currentUser));
      setVersion(v => v + 1);
    };

    const handleStorage = (e: StorageEvent) => {
      const expectedKeys = getUserCommentsStorageKeys(currentUser);
      if (e.key && expectedKeys.includes(e.key)) {
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
    const targetReq = requisitions.find(r => r.id === reqId);
    markRequisitionCommentsAsRead(reqId, currentUser, undefined, targetReq);
    setReadMap(getReadTimestampsMap(currentUser));
    setVersion(v => v + 1);
  }, [currentUser, requisitions]);

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
