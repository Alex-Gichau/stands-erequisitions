/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { 
  Requisition, 
  RequisitionStatus, 
  UserRole, 
  UserProfile, 
  Project, 
  BudgetAlert,
  AlertThreshold,
  ForecastMonth,
  SystemLog,
  SavedReport,
  ApprovalNote,
  RecurrenceType,
  ChurchGroup,
  LedgerBook,
  SearchFilter,
  PermissionConfig,
  SystemSettings,
  SupplementaryBudgetRequest,
  Vendor,
  Transaction,
  TransactionType,
  TransactionStatus,
  FiscalYear,
  CustomCalendarEvent,
  BackgroundUploadTask
} from "../types";
import { getProjectRequisitions } from "../utils/budgetUtils";
import { databaseService } from "../lib/databaseService";
import { uploadAttachmentsToLocalServer, unwrapAttachmentTarget, sendSlackNotification, resolveSenderName } from "../lib/utils";
import { triggerAutosendBackupEmail, AUTOSEND_DEFAULT_EMAIL, getLocalAutosendConfig } from "../services/autosendBackupService";
import { initializeApp as initFirebaseApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword as updateAuthPassword
} from "firebase/auth";

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "fintech-requisitions.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "fintech-requisitions",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "fintech-requisitions.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "2730554389",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:2730554389:web:eaf336c107434ef442ca1c"
};

const firebaseApp = initFirebaseApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const getAuthHeaders = async () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      console.warn("Failed to get Firebase ID token:", e);
    }
  }
  return headers;
};

export function normalizeUserProfile(u: any): UserProfile {
  if (!u) return u;
  if (u.email && u.email.toLowerCase() === "gichaumburu@gmail.com") {
    u.role = UserRole.SUPER_ADMIN;
    u.isApproved = true;
    u.isActive = true;
    u.isSuspended = false;
  }
  let parsedGroups: string[] = [];
  if (u.groups) {
    if (Array.isArray(u.groups)) {
      parsedGroups = u.groups;
    } else if (typeof u.groups === "string" && u.groups.trim() !== "") {
      try {
        const parsed = JSON.parse(u.groups);
        if (Array.isArray(parsed)) {
          parsedGroups = parsed;
        } else {
          parsedGroups = [u.groups];
        }
      } catch (e) {
        parsedGroups = [u.groups];
      }
    } else if (typeof u.groups === "string") {
      parsedGroups = [];
    } else {
      parsedGroups = [];
    }
  } else {
    parsedGroups = u.group ? [u.group] : [];
  }
  return {
    ...u,
    groups: parsedGroups
  };
}

// @ts-ignore
const db = {}; // Dummy db to allow migration progress
// Supabase Auth usages replaced.
// auth stubs removed

// Supabase as Firestore Stubs
const collection = (db: any, table: string) => ({ table });
const doc = (db: any, table: string, id?: string) => {
  if (!id && typeof table !== 'string') {
     return { table: db.table, id: table }; // doc(collectionRef, id) form
  }
  return { table, id };
};

const getDocFromServer = async (docRef: any) => getDoc(docRef);
const deleteField = () => null;
const getFirestore = () => ({});
const initializeFirestore = (...args: any[]) => ({});

const mapCamelToSnake = (data: any): any => {
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const snakeData: any = {};
  for (const [key, val] of Object.entries(data)) {
    let snakeKey = key;
    if (key === 'photoURL') {
      snakeKey = 'photo_url';
    } else {
      snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
    snakeData[snakeKey] = val;
  }
  return snakeData;
};

const mapSnakeToCamel = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(mapSnakeToCamel);
  }
  if (typeof data === "object") {
    const camelData: any = {};
    for (const [key, val] of Object.entries(data)) {
      let camelKey = key;
      if (key === 'photo_url') {
        camelKey = 'photoURL';
      } else {
        camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      }
      let finalVal = mapSnakeToCamel(val);
      if (
        (camelKey === "amount" || 
         camelKey === "allocatedBudget" || 
         camelKey === "spentAmount" || 
         camelKey === "committedAmount" || 
         camelKey === "requisitionLimit" || 
         camelKey === "budgetLimit" || 
         camelKey === "allocated" || 
         camelKey === "spent" || 
         camelKey === "threshold") && 
        typeof finalVal === "string"
      ) {
        const parsed = Number(finalVal);
        if (!isNaN(parsed)) {
          finalVal = parsed;
        }
      }
      camelData[camelKey] = finalVal;
    }
    return camelData;
  }
  return data;
};

const setDoc = async (docRef: any, data: any, options?: any) => {
  let payload = mapCamelToSnake({ id: docRef.id, ...data });
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${docRef.table}/${docRef.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`setDoc error: table=${docRef.table}, id=${docRef.id}, status=${res.status}`);
    }
  } catch (err) {
    console.error("setDoc failed:", err);
  }
};

const updateDoc = async (docRef: any, data: any) => {
  let payload = mapCamelToSnake(data);
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${docRef.table}/${docRef.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`updateDoc: Document not found, skipping update: table=${docRef.table}, id=${docRef.id}`);
        return;
      }
      console.error(`updateDoc error: table=${docRef.table}, id=${docRef.id}, status=${res.status}`);
    }
  } catch (err) {
    console.error("updateDoc failed:", err);
  }
};

const deleteDoc = async (docRef: any) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${docRef.table}/${docRef.id}`, {
      method: "DELETE",
      headers
    });
    if (!res.ok) {
      console.error(`deleteDoc error: table=${docRef.table}, id=${docRef.id}, status=${res.status}`);
    }
  } catch (err) {
    console.error("deleteDoc failed:", err);
  }
};

const getDoc = async (docRef: any) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${docRef.table}/${docRef.id}`, { headers });
    if (!res.ok) return { exists: () => false, data: () => ({} as any), id: docRef.id };
    const data = await res.json();
    return { exists: () => true, data: () => mapSnakeToCamel(data), id: docRef.id };
  } catch (err) {
    console.error("getDoc failed:", err);
    return { exists: () => false, data: () => ({} as any), id: docRef.id };
  }
};

export function safeNormalizeAttachments(attachments: any): string[] {
  if (!attachments) return [];

  const extractItem = (item: any): string | null => {
    if (!item) return null;
    const unwrapped = unwrapAttachmentTarget(item);
    if (unwrapped.name && unwrapped.url) {
      return `${unwrapped.name}::${unwrapped.url}`;
    }
    if (unwrapped.url) return unwrapped.url;
    if (unwrapped.rawString) return unwrapped.rawString;
    return null;
  };

  if (typeof attachments === 'string') {
    let trimmed = attachments.trim();
    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
      try {
        const parsed = JSON.parse(trimmed);
        return safeNormalizeAttachments(parsed);
      } catch (e) {}
    }
    const res = extractItem(attachments);
    return res ? [res] : [];
  }

  if (Array.isArray(attachments)) {
    return attachments.map(extractItem).filter((x): x is string => Boolean(x));
  }
  if (typeof attachments === 'object' && attachments !== null) {
    return Object.values(attachments).map(extractItem).filter((x): x is string => Boolean(x));
  }
  return [];
}

export function safeNormalizeReceipts(receipts: any): string[] {
  return safeNormalizeAttachments(receipts);
}

export function safeNormalizeNotificationEmails(r: any): string[] {
  if (!r) return [];
  const list = r.notificationEmails ?? r.notification_emails ?? r.notification_list;
  if (Array.isArray(list)) {
    return list.map(e => (typeof e === 'string' ? e.trim() : String(e))).filter(e => e.length > 0);
  }
  if (Array.isArray(r.notification_emails) && r.notification_emails.length > 0) {
    return r.notification_emails.map((e: any) => (typeof e === 'string' ? e.trim() : String(e))).filter((e: string) => e.length > 0);
  }
  if (Array.isArray(r.notificationEmails) && r.notificationEmails.length > 0) {
    return r.notificationEmails.map((e: any) => (typeof e === 'string' ? e.trim() : String(e))).filter((e: string) => e.length > 0);
  }
  if (typeof list === 'object' && list !== null) {
    return Object.values(list).map(e => (typeof e === 'string' ? e.trim() : String(e))).filter((e: string) => e.length > 0);
  }
  return [];
}

export function safeNormalizeApprovalHistory(history: any): any[] {
  if (!history) return [];
  if (Array.isArray(history)) {
    return history.map((x: any) => {
      if (typeof x === 'string') {
        try {
          return JSON.parse(x);
        } catch (e) {
          console.error("Failed to parse individual stringified history item:", e);
          return null;
        }
      }
      return x;
    }).filter(Boolean);
  }
  if (typeof history === 'string') {
    const trimmed = history.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((x: any) => {
            if (typeof x === 'string') {
              try {
                return JSON.parse(x);
              } catch (e) {
                console.error("Failed to parse stringified history element:", e);
                return null;
              }
            }
            return x;
          }).filter(Boolean);
        }
      } catch (e) {
        console.error("Failed to parse stringified approvalHistory array:", e);
      }
    }
  }
  return [];
}

const limit = (val: number) => ({ type: 'limit', value: val });
const orderBy = (field: string, direction: string = 'asc') => ({ type: 'orderBy', field, direction });
const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });

const query = (col: any, ...constraints: any[]) => {
  let q = { ...col };
  constraints.forEach(c => {
    if (c.type === 'limit') q.limitCount = c.value;
    if (c.type === 'orderBy') {
      q.orderColumn = c.field;
      q.ascending = c.direction !== 'desc';
    }
    if (c.type === 'where') {
      q.whereColumn = c.field;
      q.whereOp = c.op;
      q.whereValue = c.value;
    }
  });
  return q;
};

const getDocs = async (queryRef: any) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${queryRef.table}`, { headers });
    if (!res.ok) return { docs: [], empty: true, forEach: (cb: any) => {} };
    let data = await res.json();
    
    if (queryRef.whereColumn && queryRef.whereValue !== undefined) {
      const col = queryRef.whereColumn;
      const val = queryRef.whereValue;
      if (queryRef.whereOp === "==") data = data.filter((x: any) => x[col] === val);
      else if (queryRef.whereOp === ">") data = data.filter((x: any) => x[col] > val);
      else if (queryRef.whereOp === "<") data = data.filter((x: any) => x[col] < val);
    }
    
    const docs = data.map((d: any) => ({ data: () => mapSnakeToCamel(d), id: d.id, exists: () => true }));
    return { docs, empty: docs.length === 0, forEach: (cb: any) => docs.forEach(cb) };
  } catch (err) {
    console.error("getDocs failed:", err);
    return { docs: [], empty: true, forEach: (cb: any) => {} };
  }
};

const addDoc = async (col: any, data: any) => {
  try {
    const id = data.id || `doc-${Math.random().toString(36).substring(2, 11)}`;
    const payload = { ...data, id };
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${col.table}/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`addDoc error: table=${col.table}, status=${res.status}`);
      return { id: "mock" };
    }
    return { id };
  } catch (err) {
    console.error("addDoc failed:", err);
    return { id: "mock" };
  }
};

const onSnapshot = (queryRef: any, callback: (snap: any) => void, errorCallback?: (err: any) => void) => {
  const fetchData = async () => {
    try {
      if (queryRef.id) { 
        const res = await getDoc(queryRef);
        callback(res);
      } else {
        const res = await getDocs(queryRef);
        callback(res);
      }
    } catch (err) {
      if (errorCallback) errorCallback(err);
      else console.warn("onSnapshot fetch failed:", err);
    }
  };
  
  fetchData();
  const interval = setInterval(fetchData, 5000);
  return () => clearInterval(interval);
};

const handleFirestoreError = (a: any, b: any, c: any) => {};
enum OperationType { READ, WRITE, DELETE, UPDATE, CREATE, LIST, GET }
const initializeApp = (...args: any[]) => {};
const deleteApp = async (a: any) => {};

// Temporary fix until migration is fully cleaned up
const isFirestoreQuotaExceeded = () => false;

// Helper to recursively remove any fields with value undefined to prevent Firestore write/update failures
function cleanFirestoreData(data: any): any {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }
  if (typeof data === "object") {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        cleaned[key] = cleanFirestoreData(val);
      }
    }
    return cleaned;
  }
  return data;
}

interface RequisitionContextType {
  requisitions: Requisition[];
  projects: Project[];
  alerts: BudgetAlert[];
  thresholds: AlertThreshold[];
  forecastData: ForecastMonth[];
  currentUser: UserProfile | null;
  users: UserProfile[];
  loading: boolean;
  authLoading: boolean;
  isDbSaving: boolean;
  dbSavingMessage: string;
  syncingTargets: Set<string>;
  biometricEnrolled: boolean;
  enrollBiometric: (enabled?: boolean) => void;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: (options?: { forceDirect?: boolean }) => Promise<void>;
  addRequisition: (req: Omit<Requisition, "id" | "status" | "submittedAt" | "updatedAt" | "approvalHistory"> & { status?: RequisitionStatus }) => Promise<Requisition>;
  updateRequisition: (id: string, updates: Partial<Requisition>) => Promise<void>;
  sendEmailNotification: (req: Requisition, status: string, details?: string, approverName?: string, customRecipientEmail?: string, customRecipientName?: string) => Promise<void>;
  updateRequisitionStatus: (id: string, status: RequisitionStatus, decision: "APPROVE" | "REJECT" | "ESCALATE", note?: string, method?: any, rejectionReason?: string, approvalCode?: string) => Promise<void>;
  uploadReceipts: (id: string, receipts: string[]) => Promise<void>;
  deleteRequisition: (id: string, reason?: string) => Promise<void>;
  markAlertAsRead: (id: string) => Promise<void>;
  addAlert: (alert: Omit<BudgetAlert, "id" | "isRead" | "timestamp">) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  updateThreshold: (id: string, updates: Partial<AlertThreshold>) => Promise<void>;
  approveUser: (id: string) => Promise<void>;
  suspendUser: (id: string, isSuspended: boolean) => Promise<void>;
  updateUserRole: (id: string, role: UserRole) => Promise<void>;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  updateCurrentUserPassword: (pass: string) => Promise<void>;
  adminRegisterUser: (email: string, pass: string, name: string, role: UserRole, group?: string, approverCode?: string, groups?: string[]) => Promise<void>;
  adminResetUserPassword: (email: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  adminForceLogoutUser: (id: string) => Promise<void>;
  systemLogs: SystemLog[];
  addSystemLog: (action: string, details: string, metadata?: any) => Promise<void>;
  churchGroups: ChurchGroup[];
  lastGroupsSync: Date | null;
  addChurchGroup: (name: string, description?: string) => Promise<void>;
  deleteChurchGroup: (id: string) => Promise<void>;
  ledgerBooks: LedgerBook[];
  createLedgerBook: (ministryName: string, bookName: string, budgetLimit?: number) => Promise<void>;
  updateLedgerBookBudget: (id: string, newLimit: number) => Promise<void>;
  seedAllEcosystemData: () => Promise<void>;
  systemSettings: SystemSettings;
  updateSystemSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  allocateBudgetForGroup: (groupId: string, amount: number, fiscalYear: number, accountNumber?: string) => Promise<void>;
  updateProjectBudget: (id: string, amount: number) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  closeFinancialYear: (year: number) => Promise<void>;
  openFinancialYear: (year: number) => Promise<void>;
  supplementaryRequests: SupplementaryBudgetRequest[];
  applySupplementaryBudget: (projectId: string, amount: number, justification: string) => Promise<void>;
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, "id" | "createdAt" | "addedBy" | "status">) => Promise<void>;
  updateVendor: (id: string, updates: Partial<Omit<Vendor, "id" | "createdAt" | "addedBy">>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;
  reports: SavedReport[];
  saveReport: (report: Omit<SavedReport, "id" | "timestamp" | "generatedBy" | "generatedById">) => Promise<void>;
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  searchFilter: SearchFilter;
  setSearchFilter: (filter: SearchFilter) => void;
  advancedSearchActive: boolean;
  setAdvancedSearchActive: (active: boolean) => void;
  advancedDateRangePreset: "ALL" | "WEEK" | "MONTH" | "CUSTOM";
  setAdvancedDateRangePreset: (preset: "ALL" | "WEEK" | "MONTH" | "CUSTOM") => void;
  advancedCustomStartDate: string;
  setAdvancedCustomStartDate: (date: string) => void;
  advancedCustomEndDate: string;
  setAdvancedCustomEndDate: (date: string) => void;
  advancedBudgetLine: string;
  setAdvancedBudgetLine: (line: string) => void;
  activeToasts: BudgetAlert[];
  removeToast: (id: string) => void;
  triggerToast: (toast: Omit<BudgetAlert, "id" | "isRead"> & { isRead?: boolean }) => void;
  readNoticeIds: string[];
  toggleNoticeRead: (id: string, forceRead?: boolean) => void;
  markAllNoticesRead: (ids: string[]) => void;
  permissionConfigs: PermissionConfig[];
  canAccess: (viewId: string) => boolean;
  canPerform: (actionId: keyof PermissionConfig["actions"]) => boolean;
  updateRolePermissions: (roleId: string, updates: any) => Promise<void>;
  transactions: Transaction[];
  clearWebTransactions: () => Promise<void>;
  syncRealDisbursedTransactions: () => Promise<number>;
  fiscalYears: FiscalYear[];
  createFiscalYear: (year: number, label: string, status: "OPEN" | "CLOSED" | "ARCHIVED", notes?: string, startDate?: string, endDate?: string) => Promise<void>;
  updateFiscalYearDates: (year: number, startDate: string, endDate: string, label?: string, notes?: string) => Promise<void>;
  deleteFiscalYear: (id: string | number) => Promise<void>;
  toggleFiscalYearStatus: (id: string, status: "OPEN" | "CLOSED" | "ARCHIVED") => Promise<void>;
  setActiveFiscalYear: (year: number) => Promise<void>;
  cloneFiscalYearBudgets: (
    sourceYear: number, 
    targetYear: number, 
    targetLabel: string, 
    targetNotes?: string,
    setActiveImmediately?: boolean
  ) => Promise<void>;
  firestoreQuotaExceeded: boolean;
  setFirestoreQuotaExceeded: (val: boolean) => void;
  setSyncTargets: (targets: string[]) => void;
  systemLogLimit: number;
  setSystemLogLimit: (limit: number) => void;
  sendBulkEmail: (subject: string, content: string, recipients?: string[]) => Promise<{ success: boolean; total: number; successful: string[]; failed: any[]; simulated?: boolean; message?: string }>;
  customCalendarEvents: CustomCalendarEvent[];
  addCustomCalendarEvent: (event: Omit<CustomCalendarEvent, "id" | "createdAt" | "createdBy">) => Promise<void>;
  updateCustomCalendarEvent: (id: string, updates: Partial<CustomCalendarEvent>) => Promise<void>;
  deleteCustomCalendarEvent: (id: string) => Promise<void>;
  selectedRequisition: Requisition | null;
  setSelectedRequisition: (req: Requisition | null) => void;
  activeUploadTasks: BackgroundUploadTask[];
  startBackgroundUploadTask: (params: {
    title: string;
    files: string[];
    requisitionId?: string;
    onComplete?: (uploadedUrls: string[]) => Promise<void> | void;
  }) => string;
  cancelBackgroundUploadTask: (taskId: string) => void;
  clearCompletedUploadTasks: () => void;
}

const RequisitionContext = createContext<RequisitionContextType | undefined>(undefined);

const DEFAULT_PERMISSIONS: PermissionConfig[] = [
  {
    id: UserRole.CHURCH_GROUP,
    role: UserRole.CHURCH_GROUP,
    access: { dashboard: true, requisitions: true, approvals: false, finance: true, reports: false, users: false, settings: false, accessControl: false, auditTrail: false, transactions: true, vendors: true, notifications: true },
    actions: { canCreateRequisition: true, canApproveL1: false, canApproveL2: false, canDisburse: false, canDeleteRequisition: false, canManageUsers: false, canManageSettings: false, canViewTransactions: true, canExportReports: false, canManageBudgets: false }
  },
  {
    id: UserRole.APPROVER_L1,
    role: UserRole.APPROVER_L1,
    access: { dashboard: true, requisitions: true, approvals: true, finance: true, reports: false, users: false, settings: false, accessControl: false, auditTrail: false, transactions: true, vendors: true, notifications: true },
    actions: { canCreateRequisition: false, canApproveL1: true, canApproveL2: false, canDisburse: false, canDeleteRequisition: false, canManageUsers: false, canManageSettings: false, canViewTransactions: true, canExportReports: false, canManageBudgets: false }
  },
  {
    id: UserRole.APPROVER_L2,
    role: UserRole.APPROVER_L2,
    access: { dashboard: true, requisitions: true, approvals: true, finance: true, reports: false, users: false, settings: false, accessControl: false, auditTrail: false, transactions: true, vendors: true, notifications: true },
    actions: { canCreateRequisition: false, canApproveL1: false, canApproveL2: true, canDisburse: false, canDeleteRequisition: false, canManageUsers: false, canManageSettings: false, canViewTransactions: true, canExportReports: false, canManageBudgets: false }
  },
  {
    id: UserRole.FINANCE,
    role: UserRole.FINANCE,
    access: { dashboard: true, requisitions: true, approvals: false, finance: true, reports: true, users: false, settings: true, accessControl: false, auditTrail: true, transactions: true, vendors: true, notifications: true },
    actions: { canCreateRequisition: false, canApproveL1: false, canApproveL2: false, canDisburse: true, canDeleteRequisition: false, canManageUsers: false, canManageSettings: true, canViewTransactions: true, canExportReports: true, canManageBudgets: true }
  },
  {
    id: UserRole.ADMIN,
    role: UserRole.ADMIN,
    access: { dashboard: true, requisitions: true, approvals: true, finance: true, reports: true, users: true, settings: true, accessControl: true, auditTrail: true, transactions: true, vendors: true, notifications: true },
    actions: { canCreateRequisition: true, canApproveL1: true, canApproveL2: true, canDisburse: true, canDeleteRequisition: true, canManageUsers: true, canManageSettings: true, canViewTransactions: true, canExportReports: true, canManageBudgets: true }
  }
];

function normalizePermissionConfig(p: any): PermissionConfig {
  if (!p) return null as any;
  const rawAccess = p?.access || {};
  const rawActions = p?.actions || {};

  const access = {
    dashboard: Boolean(rawAccess.dashboard !== undefined ? rawAccess.dashboard : true),
    requisitions: Boolean(rawAccess.requisitions !== undefined ? rawAccess.requisitions : true),
    approvals: Boolean(rawAccess.approvals !== undefined ? rawAccess.approvals : false),
    finance: Boolean(rawAccess.finance !== undefined ? rawAccess.finance : true),
    reports: Boolean(rawAccess.reports !== undefined ? rawAccess.reports : false),
    users: Boolean(rawAccess.users !== undefined ? rawAccess.users : false),
    settings: Boolean(rawAccess.settings !== undefined ? rawAccess.settings : false),
    accessControl: Boolean(rawAccess.accessControl !== undefined ? rawAccess.accessControl : (rawAccess.access_control !== undefined ? rawAccess.access_control : false)),
    auditTrail: Boolean(rawAccess.auditTrail !== undefined ? rawAccess.auditTrail : (rawAccess.audit_trail !== undefined ? rawAccess.audit_trail : false)),
    transactions: Boolean(rawAccess.transactions !== undefined ? rawAccess.transactions : true),
    vendors: Boolean(rawAccess.vendors !== undefined ? rawAccess.vendors : true),
    notifications: Boolean(rawAccess.notifications !== undefined ? rawAccess.notifications : true),
  };

  const actions = {
    canCreateRequisition: Boolean(rawActions.canCreateRequisition !== undefined ? rawActions.canCreateRequisition : (rawActions.can_create_requisition !== undefined ? rawActions.can_create_requisition : false)),
    canApproveL1: Boolean(rawActions.canApproveL1 !== undefined ? rawActions.canApproveL1 : (rawActions.can_approve_l1 !== undefined ? rawActions.can_approve_l1 : (rawActions.can_approve_l_1 !== undefined ? rawActions.can_approve_l_1 : false))),
    canApproveL2: Boolean(rawActions.canApproveL2 !== undefined ? rawActions.canApproveL2 : (rawActions.can_approve_l2 !== undefined ? rawActions.can_approve_l2 : (rawActions.can_approve_l_2 !== undefined ? rawActions.can_approve_l_2 : false))),
    canDisburse: Boolean(rawActions.canDisburse !== undefined ? rawActions.canDisburse : (rawActions.can_disburse !== undefined ? rawActions.can_disburse : false)),
    canDeleteRequisition: Boolean(rawActions.canDeleteRequisition !== undefined ? rawActions.canDeleteRequisition : (rawActions.can_delete_requisition !== undefined ? rawActions.can_delete_requisition : false)),
    canManageUsers: Boolean(rawActions.canManageUsers !== undefined ? rawActions.canManageUsers : (rawActions.can_manage_users !== undefined ? rawActions.can_manage_users : false)),
    canManageSettings: Boolean(rawActions.canManageSettings !== undefined ? rawActions.canManageSettings : (rawActions.can_manage_settings !== undefined ? rawActions.can_manage_settings : false)),
    canViewTransactions: Boolean(rawActions.canViewTransactions !== undefined ? rawActions.canViewTransactions : (rawActions.can_view_transactions !== undefined ? rawActions.can_view_transactions : true)),
    canExportReports: Boolean(rawActions.canExportReports !== undefined ? rawActions.canExportReports : (rawActions.can_export_reports !== undefined ? rawActions.can_export_reports : false)),
    canManageBudgets: Boolean(rawActions.canManageBudgets !== undefined ? rawActions.canManageBudgets : (rawActions.can_manage_budgets !== undefined ? rawActions.can_manage_budgets : false)),
  };

  const role = (p?.role || p?.id || "") as UserRole;
  return {
    id: p?.id || role,
    role,
    access,
    actions
  };
}

export const RequisitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [churchGroups, setChurchGroups] = useState<ChurchGroup[]>([]);
  const [lastGroupsSync, setLastGroupsSync] = useState<Date | null>(null);
  const [ledgerBooks, setLedgerBooks] = useState<LedgerBook[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [forecastData, setForecastData] = useState<ForecastMonth[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [systemLogLimit, setSystemLogLimit] = useState<number>(50);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ currentFiscalYear: 2026, fiscalYearStatus: "OPEN" });
  const [supplementaryRequests, setSupplementaryRequests] = useState<SupplementaryBudgetRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);

  const [customCalendarEvents, setCustomCalendarEvents] = useState<CustomCalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem("st_andrews_custom_calendar_events");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load custom calendar events:", e);
    }
    return [
      {
        id: "evt-init-1",
        title: "Annual Fiscal Budget Meeting",
        description: "Mandatory annual meeting for all ministry leaders and treasurer.",
        date: "2026-07-28",
        time: "10:00 AM",
        category: "MEETING",
        badge: "Admin Meeting",
        createdBy: "Super Admin",
        createdAt: new Date().toISOString()
      }
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem("st_andrews_custom_calendar_events", JSON.stringify(customCalendarEvents));
    } catch (e) {
      console.error("Failed to save custom calendar events:", e);
    }
  }, [customCalendarEvents]);
  const [permissionConfigs, setPermissionConfigs] = useState<PermissionConfig[]>(() => {
    try {
      const cached = localStorage.getItem("stands_cache_permissions");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizePermissionConfig).filter(Boolean);
        }
      }
    } catch (e) {}
    return DEFAULT_PERMISSIONS;
  });
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [isDbSaving, setIsDbSaving] = useState(false);
  const [dbSavingMessage, setDbSavingMessage] = useState("Updating database...");

  const withDbLoading = useCallback(async <T,>(msg: string, fn: () => Promise<T>): Promise<T> => {
    setIsDbSaving(true);
    setDbSavingMessage(msg || "Updating database...");
    try {
      return await fn();
    } finally {
      setIsDbSaving(false);
    }
  }, []);
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState(() => {
    return isFirestoreQuotaExceeded();
  });
  const skipFirestore = true; // Route exclusively to local MongoDB/Mongoose server endpoints
  const [activeSyncTargets, setActiveSyncTargets] = useState<Set<string>>(new Set(['settings', 'alerts']));
  const [syncingTargets, setSyncingTargets] = useState<Set<string>>(new Set());

  const setSyncTargets = useCallback((targets: string[]) => {
    setActiveSyncTargets(new Set(['settings', 'alerts', ...targets]));
  }, []);

  const startSyncing = useCallback((target: string) => {
    setSyncingTargets(prev => new Set(prev).add(target));
  }, []);

  const stopSyncing = useCallback((target: string) => {
    setSyncingTargets(prev => {
      const next = new Set(prev);
      next.delete(target);
      return next;
    });
  }, []);

  const handleSyncError = useCallback((err: any, opType: OperationType, path: string) => {
    if (
      err?.code === "resource-exhausted" || 
      err?.message?.includes("Quota exceeded") || 
      String(err).includes("Quota exceeded")
    ) {
      setFirestoreQuotaExceeded(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("firestore_actual_quota_exceeded", "true");
      }
      console.log(`[Firestore Quota Exceeded] onSnapshot failed for ${path}: continuing with local cache.`);
      return;
    }
    handleFirestoreError(err, opType, path);
  }, []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("ALL");
  const [advancedSearchActive, setAdvancedSearchActive] = useState(false);
  const [advancedDateRangePreset, setAdvancedDateRangePreset] = useState<"ALL" | "WEEK" | "MONTH" | "CUSTOM">("ALL");
  const [advancedCustomStartDate, setAdvancedCustomStartDate] = useState("");
  const [advancedCustomEndDate, setAdvancedCustomEndDate] = useState("");
  const [advancedBudgetLine, setAdvancedBudgetLine] = useState("ALL");
  const [activeToasts, setActiveToasts] = useState<BudgetAlert[]>([]);
  const [activeUploadTasks, setActiveUploadTasks] = useState<BackgroundUploadTask[]>([]);
  const fetchedTargetsRef = useRef<Set<string>>(new Set());

  // Stabilize sync targets key to prevent redundant effect triggers when reference changes but content is same
  const syncTargetsKey = Array.from(activeSyncTargets).sort().join(',');
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("read_notification_ids");
        return saved ? JSON.parse(saved) : [];
      } catch (err) {
        console.error("Failed to parse read notices", err);
      }
    }
    return [];
  });

  const toggleNoticeRead = useCallback((id: string, forceRead?: boolean) => {
    setReadNoticeIds(prev => {
      let next;
      if (forceRead !== undefined) {
        if (forceRead) {
          next = prev.includes(id) ? prev : [...prev, id];
        } else {
          next = prev.filter(item => item !== id);
        }
      } else {
        next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("read_notification_ids", JSON.stringify(next));
        } catch (err) {
          console.error("Failed to save read notices", err);
        }
      }
      return next;
    });
  }, []);

  const markAllNoticesRead = useCallback((ids: string[]) => {
    setReadNoticeIds(prev => {
      const next = Array.from(new Set([...prev, ...ids]));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("read_notification_ids", JSON.stringify(next));
        } catch (err) {
          console.error("Failed to save read notices", err);
        }
      }
      return next;
    });
  }, []);

  const canAccess = useCallback((viewId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.SUPER_ADMIN) return true;
    
    if (viewId === "finance") {
      return [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(currentUser.role);
    }
    
    if (viewId === "vendors") {
      const viewLevel = systemSettings.vendorListViewLevel || "ALL_USERS";
      if (viewLevel === "ADMINS_ONLY") {
        return currentUser.role === UserRole.ADMIN;
      }
      if (viewLevel === "FINANCE_UP") {
        return [UserRole.FINANCE, UserRole.ADMIN].includes(currentUser.role);
      }
      if (viewLevel === "APPROVERS_UP") {
        return [UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.FINANCE, UserRole.ADMIN].includes(currentUser.role);
      }
      return true; // ALL_USERS
    }
    
    const config = permissionConfigs.find(c => c.role === currentUser.role);
    if (config && config.access && (config.access as any)[viewId] !== undefined) {
      return Boolean((config.access as any)[viewId]);
    }
    
    const defaults: Record<string, string[]> = {
      [UserRole.CHURCH_GROUP]: ["dashboard", "requisitions", "notifications", "finance", "transactions", "vendors"],
      [UserRole.APPROVER_L1]: ["dashboard", "requisitions", "approvals", "notifications", "finance", "transactions", "vendors"],
      [UserRole.APPROVER_L2]: ["dashboard", "requisitions", "approvals", "notifications", "finance", "transactions", "vendors"],
      [UserRole.FINANCE]: ["dashboard", "requisitions", "finance", "reports", "notifications", "settings", "auditTrail", "transactions", "vendors"],
      [UserRole.ADMIN]: ["dashboard", "requisitions", "vendors", "approvals", "finance", "reports", "users", "settings", "notifications", "auditTrail", "accessControl", "transactions"],
    };
    return defaults[currentUser.role]?.includes(viewId) ?? false;
  }, [currentUser, permissionConfigs, systemSettings]);

  const canPerform = useCallback((actionId: keyof PermissionConfig["actions"]) => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.SUPER_ADMIN) return true;

    const config = permissionConfigs.find(c => c.role === currentUser.role);
    if (config && config.actions && config.actions[actionId] !== undefined) {
      return Boolean(config.actions[actionId]);
    }

    if (actionId === 'canCreateRequisition') return currentUser.role === UserRole.CHURCH_GROUP || currentUser.role === UserRole.ADMIN;
    if (actionId === 'canApproveL1') return currentUser.role === UserRole.APPROVER_L1 || currentUser.role === UserRole.ADMIN;
    if (actionId === 'canApproveL2') return currentUser.role === UserRole.APPROVER_L2 || currentUser.role === UserRole.ADMIN;
    if (actionId === 'canDisburse') return currentUser.role === UserRole.FINANCE || currentUser.role === UserRole.ADMIN;
    if (actionId === 'canDeleteRequisition') return currentUser.role === UserRole.ADMIN;
    if (actionId === 'canManageUsers') return currentUser.role === UserRole.ADMIN;
    if (actionId === 'canManageSettings') return currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FINANCE;
    if (actionId === 'canViewTransactions') return true;
    if (actionId === 'canExportReports') return currentUser.role === UserRole.FINANCE || currentUser.role === UserRole.ADMIN;
    if (actionId === 'canManageBudgets') return currentUser.role === UserRole.FINANCE || currentUser.role === UserRole.ADMIN;
    return false;
  }, [currentUser, permissionConfigs]);

  const removeToast = useCallback((id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const isFetchingDbRef = React.useRef(false);
  const lastPresenceTimeRef = React.useRef(0);

  const triggerToast = useCallback((toast: Omit<BudgetAlert, "id" | "isRead"> & { isRead?: boolean }) => {
    const id = `toast-${Math.random().toString(36).substring(2, 9)}`;
    const newToast: BudgetAlert = {
      ...toast,
      id,
      isRead: toast.isRead ?? false
    };
    setActiveToasts(prev => [newToast, ...prev].slice(0, 5));
  }, []);

  // Track which alerts have already been sent to activeToasts
  const seenAlertsRef = React.useRef<Set<string>>(new Set());

  // Monitor for new high-priority alerts to show as toasts
  useEffect(() => {
    if (alerts.length === 0) return;

    // Latest 3 unread high/medium alerts from the last 5 minutes
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const seenNew = new Set<string>();
    const newPriorityAlerts = alerts.filter(a => {
      if (!a || !a.id) return false;
      if (seenNew.has(a.id)) return false;
      seenNew.add(a.id);
      return !a.isRead && 
        (a.severity === "HIGH" || a.severity === "MEDIUM") &&
        new Date(a.timestamp) > fiveMinutesAgo &&
        !seenAlertsRef.current.has(a.id) &&
        !a.id.includes("budget-p") &&
        !a.id.includes("req-seed-");
    });

    if (newPriorityAlerts.length > 0) {
      newPriorityAlerts.forEach(a => seenAlertsRef.current.add(a.id));
      setActiveToasts(prev => {
        const combined = [...newPriorityAlerts, ...prev];
        const seen = new Set<string>();
        const unique = combined.filter(item => {
          if (!item || !item.id) return false;
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        return unique.slice(0, 2);
      });
    }
  }, [alerts]);



  // Capture invitation parameter state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite") === "true") {
      const email = params.get("email");
      const role = params.get("role") as UserRole;
      const group = params.get("group");
      const code = params.get("code");

      if (email && role) {
        sessionStorage.setItem("requisition_invite", JSON.stringify({ email, role, group, code }));
        console.log("Captured secure system invitation in session storage for:", email);
      }

      // Clear search parameters cleanly for aesthetic UI experience
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Auth Sync (Firebase Auth)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userEmail = firebaseUser.email?.toLowerCase();

        // Dispatch Slack session login alert if not yet dispatched for this browser tab session
        if (typeof window !== "undefined" && userEmail) {
          const sessionKey = `slack_session_${firebaseUser.uid}`;
          if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, "true");
            dispatchLoginSlackAlert(userEmail, "Session Authorization", firebaseUser.uid).catch(e => {
              console.warn("Session Slack alert failed:", e);
            });
          }
        }

        try {
          const res = await fetch(`/api/auth/get-profile-by-email?email=${encodeURIComponent(userEmail || "")}`);
          const data = await res.json();
          if (res.ok && data.exists && data.profile) {
            const dbUser = data.profile;
            
            // Self-healing / alignment: if the profile's ID in database is different from the Firebase Auth UID
            if (dbUser.id !== firebaseUser.uid) {
              console.log(`[Auth Sync] Mismatch detected for ${userEmail}. Re-linking profile to new Firebase UID: ${firebaseUser.uid}`);
              await fetch("/api/auth/link-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  uid: firebaseUser.uid,
                  email: userEmail,
                  profileId: dbUser.id
                })
              });
              dbUser.id = firebaseUser.uid;
            }

            const isSuperAdmin = dbUser.role === UserRole.SUPER_ADMIN || dbUser.role === "SUPER_ADMIN";
            setCurrentUser(normalizeUserProfile({
              ...dbUser,
              approverCode: dbUser.approverCode || dbUser.approver_code,
              isActive: isSuperAdmin ? true : (dbUser.isActive !== undefined ? dbUser.isActive : (dbUser.is_active !== undefined ? dbUser.is_active : true)),
              isApproved: isSuperAdmin ? true : (dbUser.isApproved !== undefined ? dbUser.isApproved : (dbUser.is_approved !== undefined ? dbUser.is_approved : true)),
              isSuspended: dbUser.isSuspended !== undefined ? dbUser.isSuspended : (dbUser.is_suspended !== undefined ? dbUser.is_suspended : false),
              photoURL: dbUser.photoURL || dbUser.photo_url,
              tempPassword: dbUser.tempPassword || dbUser.temp_password,
              isOnline: dbUser.isOnline !== undefined ? dbUser.isOnline : (dbUser.is_online !== undefined ? dbUser.is_online : false),
              lastSeen: dbUser.lastSeen || dbUser.last_seen,
              idleTimeoutDuration: dbUser.idleTimeoutDuration || dbUser.idle_timeout_duration || 15
            } as UserProfile));
          } else {
            const isSuperAdminEmail = userEmail === "gichaumburu@gmail.com";
            const defaultUser = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || userEmail || "Alex Gichau",
              email: userEmail || "",
              role: (isSuperAdminEmail ? UserRole.SUPER_ADMIN : "CHURCH_GROUP") as UserRole,
              isActive: true,
              isApproved: true,
              isSuspended: false
            };
            setCurrentUser(defaultUser as any);
            await setDoc(doc(db, "users", firebaseUser.uid), defaultUser);
          }
        } catch (err) {
          console.warn("Could not fetch user profile from backend database, setting default:", err);
          const isSuperAdminEmail = userEmail === "gichaumburu@gmail.com";
          const fallbackUser = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || userEmail || "Alex Gichau",
            email: userEmail || "",
            role: (isSuperAdminEmail ? UserRole.SUPER_ADMIN : "CHURCH_GROUP") as UserRole,
            isActive: true,
            isApproved: true,
            isSuspended: false
          };
          setCurrentUser(fallbackUser as any);
          await setDoc(doc(db, "users", firebaseUser.uid), fallbackUser);
        }
        setAuthLoading(false);
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Sync currentUser with real-time polled users list from MongoDB
  useEffect(() => {
    if (!currentUser || !currentUser.id || users.length === 0) return;
    const dbProfile = users.find(u => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase());
    if (dbProfile) {
      const hasChanged = 
        dbProfile.role !== currentUser.role ||
        dbProfile.isApproved !== currentUser.isApproved ||
        dbProfile.isSuspended !== currentUser.isSuspended ||
        dbProfile.isActive !== currentUser.isActive ||
        dbProfile.group !== currentUser.group ||
        JSON.stringify(dbProfile.groups || []) !== JSON.stringify(currentUser.groups || []);

      if (hasChanged) {
        console.log("[Auth Sync] Aligning currentUser state with latest database profile:", dbProfile);
        setCurrentUser(prev => prev ? { ...prev, ...dbProfile } : null);
      }
    }
  }, [users, currentUser?.id, currentUser?.email]);

  const addSystemLog = useCallback(async (action: string, details: string, metadata?: any) => {
    try {
      const userEmail = currentUser?.email || metadata?.email || auth.currentUser?.email;
      const isSuperAdminEmail = userEmail === "gichaumburu@gmail.com";
      const userName = currentUser?.name || metadata?.name || (isSuperAdminEmail ? "Alex Gichau" : (userEmail ? userEmail.split('@')[0] : "System User"));
      const userRole = currentUser?.role || metadata?.role || (isSuperAdminEmail ? UserRole.SUPER_ADMIN : "USER");
      const userGroup = currentUser?.group || metadata?.group;
      const performedBy = `${userName} (${userRole})`;
      const timestamp = new Date().toISOString();

      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const logDoc = {
        id: logId,
        action,
        details,
        performedBy,
        timestamp,
        ...(userGroup && { groupId: userGroup }),
        ...(metadata && { metadata })
      };
      
      await databaseService.saveAuditLog(logDoc);

      // Notify Slack via our internal API proxy
      if (action !== "FINANCE_ALERT_TRIGGERED") {
        try {
          fetch("/api/notify-slack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              details,
              performedBy,
              timestamp,
              metadata: {
                ...metadata,
                name: metadata?.name || userName,
                email: metadata?.email || userEmail,
                role: metadata?.role || userRole,
                group: metadata?.group || userGroup || "General Ministry",
                userId: metadata?.userId || currentUser?.id || auth.currentUser?.uid || "N/A"
              }
            })
          }).catch(err => console.log("Slack background notify failed", err));
        } catch (slackErr) {
          console.log("Failed to start Slack notification", slackErr);
        }
      }
      
    } catch (err: any) {
      console.log("Failed to add system log:", err.message);
    }
  }, [currentUser]);

  const dispatchLoginSlackAlert = useCallback(async (userEmail: string, authProvider: string, userId?: string) => {
    try {
      const email = (userEmail || "").trim().toLowerCase();
      if (!email) return;

      let profile: any = null;
      try {
        const res = await fetch(`/api/auth/get-profile-by-email?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (res.ok && data.exists && data.profile) {
          profile = data.profile;
        }
      } catch (e) {}

      const isSuperAdmin = email === "gichaumburu@gmail.com";
      const name = profile?.name || (isSuperAdmin ? "Alex Gichau" : email.split('@')[0]);
      const role = profile?.role || (isSuperAdmin ? UserRole.SUPER_ADMIN : "CHURCH_GROUP");
      const group = profile?.group || "General Ministry";
      const uid = userId || profile?.id || auth.currentUser?.uid || "N/A";
      const isApproved = isSuperAdmin ? true : (profile?.isApproved ?? profile?.is_approved ?? true);
      const isActive = isSuperAdmin ? true : (profile?.isActive ?? profile?.is_active ?? true);
      const isSuspended = profile?.isSuspended ?? profile?.is_suspended ?? false;

      const loginMetadata = {
        name,
        email,
        role,
        group,
        authProvider,
        userId: uid,
        isApproved,
        isActive,
        isSuspended,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser"
      };

      await sendSlackNotification({
        action: "USER_LOGIN",
        details: `🔑 ${name} (${role}) authenticated successfully via ${authProvider}`,
        performedBy: `${name} (${role})`,
        metadata: loginMetadata
      });

      await addSystemLog("USER_LOGIN", `User logged in via ${authProvider}: ${email}`, loginMetadata);
    } catch (err) {
      console.warn("Failed to dispatch login Slack alert:", err);
    }
  }, [addSystemLog]);

  const seedAllEcosystemData = useCallback(async () => {
    console.log("Mock data seeding is disabled.");
  }, []);

  const updateSystemSettings = useCallback(async (updates: Partial<SystemSettings>) => {
    setSystemSettings(prev => {
      const nextSettings = { ...prev, ...updates };
      try {
        localStorage.setItem("stands_cache_system_settings", JSON.stringify(nextSettings));
      } catch (e) {}
      return nextSettings;
    });

    try {
      if (!skipFirestore) {
        await setDoc(doc(db, "settings", "system"), updates, { merge: true });
      }

      const headers = await getAuthHeaders();
      await fetch(`/api/db/settings/system`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ id: "system", ...updates })
      }).catch(e => console.warn("[DB Sync] Error updating system settings:", e));

      await addSystemLog("SYSTEM_SETTINGS_UPDATE", `System settings updated: ${JSON.stringify(updates)}`, { updates });
    } catch (err) {
      console.error("Failed to update system settings:", err);
    }
  }, [addSystemLog, skipFirestore]);

  const updateRolePermissions = useCallback(async (roleId: string, updates: any) => {
    let updatedConfig: PermissionConfig | null = null;
    setPermissionConfigs(prev => {
      const idx = prev.findIndex(p => p.role === roleId);
      if (idx >= 0) {
        const next = [...prev];
        updatedConfig = {
          ...next[idx],
          ...updates,
          role: roleId as any,
          access: { ...(next[idx].access || {}), ...(updates.access || {}) },
          actions: { ...(next[idx].actions || {}), ...(updates.actions || {}) }
        };
        next[idx] = updatedConfig;
        try {
          localStorage.setItem("stands_cache_permissions", JSON.stringify(next));
        } catch (e) {}
        return next;
      }
      updatedConfig = {
        id: roleId,
        role: roleId as any,
        access: { ...(updates.access || {}) },
        actions: { ...(updates.actions || {}) },
        ...updates
      };
      const next = [...prev, updatedConfig];
      try {
        localStorage.setItem("stands_cache_permissions", JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    try {
      if (!skipFirestore) {
        await setDoc(doc(db, "permissions", roleId), updates, { merge: true });
      }

      const headers = await getAuthHeaders();
      await fetch(`/api/db/permissions/${roleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          id: roleId,
          role: roleId,
          access: updatedConfig?.access || updates.access,
          actions: updatedConfig?.actions || updates.actions
        })
      }).catch(e => console.warn("[DB Sync] Error updating role permissions:", e));

      await addSystemLog("PERMISSIONS_UPDATED", `Access rights modified for role: ${roleId}`, { roleId, updates });
    } catch (err) {
      console.error("Failed to update role permissions:", err);
    }
  }, [db, addSystemLog, skipFirestore]);

  const allocateBudgetForGroup = useCallback(async (groupId: string, amount: number, fiscalYear: number, accountNumber?: string) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.FINANCE) {
      throw new Error("Unauthorized: Only Admins, Super Admins, and Finance can allocate group budgets.");
    }

    try {
      console.log("Allocating budget:", { groupId, amount, fiscalYear, accountNumber, projects });
      const match = projects.find(p => 
        p.groupId === groupId && 
        (p.fiscalYear === fiscalYear || (!p.fiscalYear && fiscalYear === 2026))
      );
      console.log("Found match:", match);
      if (match) {
        console.log("Updating project:", match.id);
        const updatedProject = {
          ...match,
          allocatedBudget: amount,
          status: "ACTIVE" as const,
          fiscalYear: fiscalYear,
          ...(accountNumber ? { accountNumber } : {})
        };
        await databaseService.saveProject(updatedProject);
        await addSystemLog("BUDGET_ALLOCATED", `Updated budget for '${groupId}' to KES ${amount.toLocaleString()} for FY ${fiscalYear}${accountNumber ? ` with Account Number ${accountNumber}` : ""}`, { groupId, amount, fiscalYear, accountNumber });
      } else {
        const newProjId = "p-" + Math.random().toString(36).substring(2, 9);
        const newProject = {
          id: newProjId,
          name: groupId,
          groupId: groupId,
          allocatedBudget: amount,
          spentAmount: 0,
          status: "ACTIVE" as const,
          color: "bg-indigo-500",
          fiscalYear: fiscalYear,
          accountNumber: accountNumber || ""
        };
        console.log("Creating new project:", newProject);
        await databaseService.saveProject(newProject);
        await addSystemLog("BUDGET_CREATED", `Allocated initial budget for '${groupId}' of KES ${amount.toLocaleString()} for FY ${fiscalYear}${accountNumber ? ` with Account Number ${accountNumber}` : ""}`, { groupId, amount, fiscalYear, accountNumber });
      }

      triggerToast({ type: "SYSTEM_INFO", message: `Budget for ${groupId} allocated for FY ${fiscalYear}`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to allocate budget:", err);
      throw err;
    }
  }, [currentUser, db, projects, addSystemLog, triggerToast]);

  const closeFinancialYear = useCallback(async (year: number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can close financial accounts.");
    }

    try {
      const yearProjects = projects.filter(p => !p.fiscalYear || p.fiscalYear === year);
      for (const p of yearProjects) {
        await updateDoc(doc(db, "projects", p.id), { status: "CLOSED" });
      }

      await updateSystemSettings({
        currentFiscalYear: year,
        fiscalYearStatus: "CLOSED"
      });

      await addSystemLog("FINANCIAL_YEAR_CLOSED", `Financial Year ${year} books closed successfully. No further disbursements or allocations permitted for this year.`, { year });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${year} has been CLOSED.`, severity: "HIGH", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to close financial year:", err);
      throw err;
    }
  }, [currentUser, db, projects, updateSystemSettings, addSystemLog, triggerToast]);

  const openFinancialYear = useCallback(async (year: number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can open financial accounts.");
    }

    try {
      await updateSystemSettings({
        currentFiscalYear: year,
        fiscalYearStatus: "OPEN"
      });

      const currentYearProjects = projects.filter(p => p.fiscalYear === (year - 1) || (!p.fiscalYear && year === 2027));
      
      if (currentYearProjects.length > 0) {
        for (const prevP of currentYearProjects) {
          const exists = projects.some(p => p.groupId === prevP.groupId && p.fiscalYear === year);
          if (!exists) {
            const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
            const nextProj = {
              id: nextProjId,
              name: prevP.name,
              groupId: prevP.groupId,
              allocatedBudget: 0,
              spentAmount: 0,
              status: "ACTIVE" as const,
              color: prevP.color || "bg-indigo-500",
              fiscalYear: year
            };
            await setDoc(doc(db, "projects", nextProjId), nextProj);
          }
        }
      } else {
        for (const cg of churchGroups) {
          const exists = projects.some(p => p.groupId === cg.name && p.fiscalYear === year);
          if (!exists) {
            const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
            const nextProj = {
              id: nextProjId,
              name: cg.name,
              groupId: cg.name,
              allocatedBudget: 0,
              spentAmount: 0,
              status: "ACTIVE" as const,
              color: "bg-indigo-500",
              fiscalYear: year
            };
            await setDoc(doc(db, "projects", nextProjId), nextProj);
          }
        }
      }

      await addSystemLog("FINANCIAL_YEAR_OPENED", `Financial Year ${year} books opened. Budget lines ready for deployment.`, { year });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${year} opened successfully!`, severity: "HIGH", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to open financial year:", err);
      throw err;
    }
  }, [currentUser, db, projects, churchGroups, updateSystemSettings, addSystemLog, triggerToast]);

  const updateProjectBudget = useCallback(async (id: string, amount: number) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can modify budgets.");
    }
    try {
      const projRef = doc(db, "projects", id);
      await updateDoc(projRef, { allocatedBudget: amount });
      await addSystemLog("BUDGET_ADJUSTMENT", `Admin adjusted budget for project ID ${id} to KES ${amount}`, { projectId: id, amount });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const deleteProject = useCallback(async (id: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can delete budgets.");
    }
    try {
      await deleteDoc(doc(db, "projects", id));
      await addSystemLog("BUDGET_DELETED", `Admin deleted budget line ID: ${id}`, { projectId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const createFiscalYear = useCallback(async (
    year: number, 
    label: string, 
    status: "OPEN" | "CLOSED" | "ARCHIVED", 
    notes?: string,
    startDate?: string,
    endDate?: string
  ) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can define fiscal years.");
    }

    try {
      const yearId = year.toString();
      const sDate = startDate || `${year}-01-01`;
      const eDate = endDate || `${year}-12-31`;
      const newFiscalYear: FiscalYear = {
        id: yearId,
        year,
        label,
        status,
        createdAt: new Date().toISOString(),
        startDate: sDate,
        endDate: eDate,
        notes: notes || ""
      };
      
      await setDoc(doc(db, "fiscal_years", yearId), cleanFirestoreData(newFiscalYear));

      await addSystemLog("FISCAL_YEAR_CREATED", `Admin defined new Financial Year ${year}: ${label}`, { year, label, status, startDate: sDate, endDate: eDate });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${year} has been created.`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `fiscal_years/${year}`);
    }
  }, [currentUser, db, addSystemLog, triggerToast]);

  const updateFiscalYearDates = useCallback(async (year: number, startDate: string, endDate: string, label?: string, notes?: string) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can update fiscal year dates.");
    }

    try {
      const yearId = year.toString();
      const updates: any = {
        id: yearId,
        year,
        startDate,
        endDate,
        updatedAt: new Date().toISOString()
      };
      if (label !== undefined) updates.label = label;
      if (notes !== undefined) updates.notes = notes;

      await setDoc(doc(db, "fiscal_years", yearId), updates, { merge: true });

      if (systemSettings.currentFiscalYear === year || !systemSettings.currentFiscalYear) {
        await updateSystemSettings({
          fiscalYearStartDate: startDate,
          fiscalYearEndDate: endDate
        });
      }

      await addSystemLog("FISCAL_YEAR_DATES_UPDATED", `Updated configuration for FY ${year}`, { year, startDate, endDate, label, notes });
      triggerToast({ type: "SYSTEM_INFO", message: `Fiscal Year ${year} configuration updated.`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiscal_years/${year}`);
    }
  }, [currentUser, db, systemSettings, updateSystemSettings, addSystemLog, triggerToast]);

  const deleteFiscalYear = useCallback(async (id: string | number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can delete fiscal years.");
    }

    const numericYear = typeof id === "number" ? id : parseInt(id);
    const yearId = numericYear.toString();

    if (systemSettings.currentFiscalYear === numericYear) {
      throw new Error(`Cannot delete FY ${numericYear} because it is currently the active fiscal year. Switch to another active fiscal year first.`);
    }

    try {
      await deleteDoc(doc(db, "fiscal_years", yearId));
      await addSystemLog("FISCAL_YEAR_DELETED", `Admin deleted Financial Year record for FY ${numericYear}`, { year: numericYear });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${numericYear} deleted successfully.`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `fiscal_years/${yearId}`);
    }
  }, [currentUser, db, systemSettings, addSystemLog, triggerToast]);

  const toggleFiscalYearStatus = useCallback(async (id: string, status: "OPEN" | "CLOSED" | "ARCHIVED") => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can modify fiscal years.");
    }

    try {
      await updateDoc(doc(db, "fiscal_years", id), { status });
      
      // If of the same currently active year, sync system settings
      if (systemSettings.currentFiscalYear === parseInt(id)) {
        await updateSystemSettings({ fiscalYearStatus: status });
      }

      await addSystemLog("FISCAL_YEAR_STATUS_TOGGLED", `Admin toggled Financial Year ${id} status to ${status}`, { id, status });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${id} status toggled to ${status}.`, severity: "MEDIUM", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiscal_years/${id}`);
    }
  }, [currentUser, db, systemSettings, updateSystemSettings, addSystemLog, triggerToast]);

  const setActiveFiscalYear = useCallback(async (year: number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can set the active fiscal year.");
    }

    try {
      const targetYearInfo = fiscalYears.find(f => f.year === year);
      const targetStatus = targetYearInfo ? targetYearInfo.status : "CLOSED";

      // Toggle active year in system settings
      await updateSystemSettings({
        currentFiscalYear: year,
        fiscalYearStatus: targetStatus
      });

      // Mirror the project copies creation if it is OPEN
      if (targetStatus === "OPEN") {
        const currentYearProjects = projects.filter(p => p.fiscalYear === (year - 1) || (!p.fiscalYear && year === 2027));
        
        if (currentYearProjects.length > 0) {
          for (const prevP of currentYearProjects) {
            const exists = projects.some(p => p.groupId === prevP.groupId && p.fiscalYear === year);
            if (!exists) {
              const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
              await setDoc(doc(db, "projects", nextProjId), {
                id: nextProjId,
                name: prevP.name,
                groupId: prevP.groupId,
                allocatedBudget: 0,
                spentAmount: 0,
                status: "ACTIVE",
                color: prevP.color || "bg-indigo-500",
                fiscalYear: year
              });
            }
          }
        } else {
          for (const cg of churchGroups) {
            const exists = projects.some(p => p.groupId === cg.name && p.fiscalYear === year);
            if (!exists) {
              const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
              await setDoc(doc(db, "projects", nextProjId), {
                id: nextProjId,
                name: cg.name,
                groupId: cg.name,
                allocatedBudget: 0,
                spentAmount: 0,
                status: "ACTIVE",
                color: "bg-indigo-500",
                fiscalYear: year
              });
            }
          }
        }
      }

      await addSystemLog("FISCAL_YEAR_ACTIVATED", `Admin set currently active Financial Year to ${year}`, { year });
      triggerToast({ type: "SYSTEM_INFO", message: `Active Financial Year switched to ${year} (${targetStatus})!`, severity: "HIGH", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to switch active fiscal year:", err);
      throw err;
    }
  }, [currentUser, db, fiscalYears, projects, churchGroups, updateSystemSettings, addSystemLog, triggerToast]);

  const cloneFiscalYearBudgets = useCallback(async (
    sourceYear: number, 
    targetYear: number, 
    targetLabel: string, 
    targetNotes?: string,
    setActiveImmediately?: boolean
  ) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can execute the New Year Setup wizard.");
    }

    try {
      // 1. Create target fiscal year if it doesn't exist
      const yearId = targetYear.toString();
      const existingFy = fiscalYears.find(f => f.year === targetYear);
      if (!existingFy) {
        const newFiscalYear: FiscalYear = {
          id: yearId,
          year: targetYear,
          label: targetLabel,
          status: "OPEN",
          createdAt: new Date().toISOString(),
          notes: targetNotes || ""
        };
        await setDoc(doc(db, "fiscal_years", yearId), cleanFirestoreData(newFiscalYear));
      }

      // 2. Map existing active projects of source year to duplicate in target year
      const sourceProjects = projects.filter(p => p.fiscalYear === sourceYear || (!p.fiscalYear && sourceYear === 2026));
      let clonedCount = 0;
      let totalValueCloned = 0;

      for (const p of sourceProjects) {
        // Find if target project already exists to avoid duplicate entries
        const targetProjMatch = projects.find(tp => tp.groupId === p.groupId && tp.fiscalYear === targetYear);
        if (!targetProjMatch) {
          const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
          const nextProject = {
            id: nextProjId,
            name: p.name,
            groupId: p.groupId,
            allocatedBudget: p.allocatedBudget,
            spentAmount: 0,
            status: "ACTIVE" as const,
            color: p.color || "bg-indigo-500",
            fiscalYear: targetYear
          };
          await setDoc(doc(db, "projects", nextProjId), cleanFirestoreData(nextProject));
          clonedCount++;
          totalValueCloned += p.allocatedBudget;
        } else {
          // Overwrite existing budget for high consistency
          const projRef = doc(db, "projects", targetProjMatch.id);
          await updateDoc(projRef, {
            allocatedBudget: p.allocatedBudget,
            status: "ACTIVE"
          });
          clonedCount++;
          totalValueCloned += p.allocatedBudget;
        }
      }

      // 3. Mark active if selected
      if (setActiveImmediately) {
        await updateSystemSettings({
          currentFiscalYear: targetYear,
          fiscalYearStatus: "OPEN"
        });
      }

      await addSystemLog("FISCAL_YEAR_CLONED", `Admin cloned ${clonedCount} group budget allocations (totaling KES ${totalValueCloned.toLocaleString()}) from FY ${sourceYear} to FY ${targetYear}.`, { sourceYear, targetYear, clonedCount, totalValueCloned, setActiveImmediately });
      
      triggerToast({ 
        type: "SYSTEM_INFO", 
        message: `FY ${targetYear} successfully configured. ${clonedCount} allocations cloned.`, 
        severity: "HIGH", 
        timestamp: new Date().toISOString() 
      });
    } catch (err) {
      console.error("Failed to clone fiscal year budgets:", err);
      throw err;
    }
  }, [currentUser, db, fiscalYears, projects, addSystemLog, triggerToast, updateSystemSettings]);

  const applySupplementaryBudget = useCallback(async (projectId: string, amount: number, justification: string) => {
    if (!currentUser) throw new Error("Authentication required");
    
    try {
      const budgetId = "sup-" + Math.random().toString(36).substring(2, 9);
      const proj = projects.find(p => p.id === projectId);
      const projectName = proj ? proj.name : "Church Allocation";
      
      const requestData = {
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        requesterEmail: currentUser.email,
        role: currentUser.role,
        projectId,
        projectName,
        amount,
        justification,
        submittedAt: new Date().toISOString(),
        status: "PENDING"
      };

      await setDoc(doc(db, "supplementary_budgets", budgetId), requestData);
      
      // Add alert for Admin/Super Admin
      const alertId = "alert-" + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, "alerts", alertId), {
        id: alertId,
        type: "THRESHOLD_WARN",
        severity: "MEDIUM",
        message: `Supplementary budget request (KES ${amount.toLocaleString()}) submitted by ${currentUser.name} for project: ${projectName}`,
        timestamp: new Date().toISOString(),
        isRead: false,
        targetRole: UserRole.SUPER_ADMIN
      });

      await addSystemLog("SUPPLEMENTARY_BUDGET_APPLY", `Supplementary budget of KES ${amount} submitted on terminal by ${currentUser.name} for ${projectName}`, { projectId, amount });
    } catch (err) {
      console.error("Failed to submit supplementary budget:", err);
      throw err;
    }
  }, [currentUser, db, projects, addSystemLog]);

  const addVendor = useCallback(async (vendor: Omit<Vendor, "id" | "createdAt" | "addedBy" | "status">) => {
    try {
      const vendorId = "vendor-" + Math.random().toString(36).substring(2, 9);
      const addedBy = currentUser ? currentUser.name : "System";
      
      // Determine initial status based on user role
      const isAdminRole = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
      const status = isAdminRole ? "APPROVED" : "PENDING";

      const newVendor: Vendor = {
        id: vendorId,
        ...vendor,
        createdAt: new Date().toISOString(),
        addedBy,
        status
      };

      await setDoc(doc(db, "vendors", vendorId), newVendor);
      await addSystemLog("VENDOR_CREATE", `${isAdminRole ? 'Registered' : 'Requested to add'} new STANDS vendor: ${vendor.name}`, { vendorId, ...vendor, status });
    } catch (err) {
      console.error("Failed to add vendor:", err);
      throw err;
    }
  }, [currentUser, db, addSystemLog]);

  const updateVendor = useCallback(async (id: string, updates: Partial<Omit<Vendor, "id" | "createdAt" | "addedBy">>) => {
    try {
      const vendorRef = doc(db, "vendors", id);
      await updateDoc(vendorRef, updates as any);
      await addSystemLog("VENDOR_UPDATE", `Updated vendor: ${id}`, { vendorId: id, updates });
    } catch (err) {
      console.error("Failed to update vendor:", err);
      throw err;
    }
  }, [db, addSystemLog]);

  const deleteVendor = useCallback(async (id: string) => {
    try {
      const vendorRef = doc(db, "vendors", id);
      const vendorSnap = await getDoc(vendorRef);
      const vendorName = vendorSnap.exists() ? (vendorSnap.data() as Vendor).name : id;
      
      await deleteDoc(vendorRef);
      await addSystemLog("VENDOR_DELETE", `Deleted STANDS vendor: ${vendorName}`, { vendorId: id });
    } catch (err) {
      console.error("Failed to delete vendor:", err);
      throw err;
    }
  }, [db, addSystemLog]);

  // System Settings Sync
  useEffect(() => {
    if (skipFirestore) return;
    const unsub = onSnapshot(doc(db, "settings", "system"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.currentFiscalYear === undefined) {
          setDoc(doc(db, "settings", "system"), { ...data, currentFiscalYear: 2026, fiscalYearStatus: "OPEN" }, { merge: true }).catch(() => {});
        }
        setSystemSettings(snap.data() as SystemSettings);
      } else {
        setDoc(doc(db, "settings", "system"), { currentFiscalYear: 2026, fiscalYearStatus: "OPEN" }).catch(() => {});
      }
    }, (err) => handleSyncError(err, OperationType.GET, "settings/system"));
    return () => unsub();
  }, [handleSyncError]);

  // background-refresh local caching strategy using localStorage
  useEffect(() => {
    if (currentUser && currentUser.id) {
      if (typeof window !== "undefined") {
        try {
          const cachedReqs = localStorage.getItem(`stands_cache_reqs_${currentUser.id}`);
          if (cachedReqs) {
            const parsed = JSON.parse(cachedReqs);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setRequisitions(parsed);
            }
          }

          const cachedProjects = localStorage.getItem(`stands_cache_projects_${currentUser.id}`);
          if (cachedProjects) {
            const parsed = JSON.parse(cachedProjects);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProjects(parsed);
            }
          }

          const cachedVendors = localStorage.getItem(`stands_cache_vendors_${currentUser.id}`);
          if (cachedVendors) {
            const parsed = JSON.parse(cachedVendors);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setVendors(parsed);
            }
          }

          const cachedSettings = localStorage.getItem("stands_cache_system_settings");
          if (cachedSettings) {
            setSystemSettings(JSON.parse(cachedSettings));
          }
        } catch (err) {
          console.log("[Cache] Failed to load cached data:", err);
        }
      }
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser && currentUser.id && requisitions.length > 0) {
      try {
        localStorage.setItem(`stands_cache_reqs_${currentUser.id}`, JSON.stringify(requisitions));
      } catch (err) {
        console.log("[Cache] Failed to cache requisitions:", err);
      }
    }
  }, [requisitions, currentUser?.id]);

  useEffect(() => {
    if (currentUser && currentUser.id && projects.length > 0) {
      try {
        localStorage.setItem(`stands_cache_projects_${currentUser.id}`, JSON.stringify(projects));
      } catch (err) {
        console.log("[Cache] Failed to cache projects:", err);
      }
    }
  }, [projects, currentUser?.id]);

  useEffect(() => {
    if (currentUser && currentUser.id && vendors.length > 0) {
      try {
        localStorage.setItem(`stands_cache_vendors_${currentUser.id}`, JSON.stringify(vendors));
      } catch (err) {
        console.log("[Cache] Failed to cache vendors:", err);
      }
    }
  }, [vendors, currentUser?.id]);

  useEffect(() => {
    if (systemSettings) {
      try {
        localStorage.setItem("stands_cache_system_settings", JSON.stringify(systemSettings));
      } catch (err) {
        console.log("[Cache] Failed to cache system settings:", err);
      }
    }
  }, [systemSettings]);

  // Stable properties of currentUser to avoid redundant subscription triggers
  const currentUserId = currentUser?.id || "";
  const currentUserRole = currentUser?.role || "";
  const currentUserGroup = currentUser?.group || "";
  const currentUserIsApproved = currentUser?.isApproved || currentUser?.role === UserRole.SUPER_ADMIN || false;
  const currentUserIsSuspended = currentUser?.isSuspended || false;
  const currentUserGroupsJSON = JSON.stringify(currentUser?.groups || []);

  // Real-time Sync for authenticated users (with filtering based on prototype settings)
  useEffect(() => {
    if (!currentUser || !currentUserId || !currentUserIsApproved || currentUserIsSuspended) {
      setRequisitions([]);
      setProjects([]);
      setAlerts([]);
      setThresholds([]);
      setUsers([]);
      setForecastData([]);
      setSystemLogs([]);
      setFiscalYears([]);
    }
  }, [currentUser, currentUserId, currentUserIsApproved, currentUserIsSuspended]);

  // Lazy Requisitions Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('requisitions')) return;
    const hidePrototype = true;
    const isGroupUser = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    let baseQuery = query(collection(db, "requisitions"), orderBy("submittedAt", "desc"), limit(250));

    let isFirstSnap = true;

    const unsubRequisitions = onSnapshot(baseQuery, (snap) => {
      let data = snap.docs.map(doc => {
        const r = doc.data() as any;
        return {
          id: doc.id,
          ...r,
          attachments: safeNormalizeAttachments(r?.attachments),
          receipts: safeNormalizeReceipts(r?.receipts),
          approvalHistory: safeNormalizeApprovalHistory(r?.approvalHistory || r?.approval_history),
          comments: r?.comments || [],
          notificationEmails: safeNormalizeNotificationEmails(r)
        } as Requisition;
      });
      if (hidePrototype) data = data.filter(req => !req.id.startsWith("req-seed-"));

      if (isFirstSnap) {
        isFirstSnap = false;
      } else {
        let hasAdded = false;
        let hasModified = false;
        
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const reqId = change.doc.id;
            if (!change.doc.metadata.hasPendingWrites && !reqId.startsWith("req-seed-")) {
              hasAdded = true;
            }
          } else if (change.type === "modified") {
            const reqId = change.doc.id;
            if (!change.doc.metadata.hasPendingWrites && !reqId.startsWith("req-seed-")) {
              hasModified = true;
            }
          }
        });

        if (hasAdded || hasModified) {
          triggerToast({
            type: "SYSTEM_INFO",
            severity: "LOW",
            message: `Data Updated: ${hasAdded && hasModified ? "New & Updated Requisitions Synced" : hasAdded ? "New Requisition Added" : "Requisitions Updated/Approved"}`,
            timestamp: new Date().toISOString()
          });
        }
      }

      setRequisitions(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "requisitions"));

    return () => unsubRequisitions();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError,
    triggerToast
  ]);

  // Lazy Projects Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('projects')) return;
    const hidePrototype = true;
    const shouldFilter = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      if (hidePrototype) data = data.filter(p => !["p1", "p2", "p3", "p4", "p5"].includes(p.id));
      setProjects(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "projects"));

    return () => unsubProjects();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Alerts Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('alerts')) return;
    const hidePrototype = true;
    const shouldFilter = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    const unsubAlerts = onSnapshot(query(collection(db, "alerts"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetAlert));
      if (shouldFilter && parsedGroups.length > 0) data = data.filter(a => parsedGroups.some(g => a.message.includes(g)));
      if (hidePrototype) {
        data = data.filter(a => !a.id.includes("req-seed-") && !a.id.match(/budget-p[0-9]+/));
      }
      setAlerts(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "alerts"));

    return () => unsubAlerts();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError
  ]);

  // One-time Fiscal Years Fetch
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('fiscal_years') || fetchedTargetsRef.current.has('fiscal_years')) return;
    
    const fetchFiscalYears = async () => {
      try {
        fetchedTargetsRef.current.add('fiscal_years');
        const snap = await getDocs(collection(db, "fiscal_years"));
        setFiscalYears(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FiscalYear)));
      } catch (err) {
        fetchedTargetsRef.current.delete('fiscal_years');
        handleSyncError(err, OperationType.LIST, "fiscal_years");
      }
    };
    fetchFiscalYears();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Transactions Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('transactions')) return;
    const hidePrototype = true;

    const unsubTransactions = onSnapshot(query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      if (hidePrototype) data = data.filter(t => !t.id.startsWith("trans-seed-"));
      setTransactions(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "transactions"));

    return () => unsubTransactions();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Forecast Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('forecast')) return;

    const unsubForecast = onSnapshot(collection(db, "forecast"), (snap) => {
      setForecastData(snap.docs.map(doc => doc.data() as ForecastMonth));
    }, (err) => handleSyncError(err, OperationType.LIST, "forecast"));

    return () => unsubForecast();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Reports Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('reports')) return;
    const hidePrototype = true;

    const unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedReport));
      if (hidePrototype) data = data.filter(r => !r.id.startsWith("rep-seed-"));
      setReports(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "reports"));

    return () => unsubReports();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy System Logs Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('system_logs')) return;
    const hidePrototype = true;
    const shouldFilter = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    let unsubLogs = () => {};
    if (currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.SUPER_ADMIN || currentUserRole === UserRole.FINANCE) {
      unsubLogs = onSnapshot(query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(systemLogLimit)), (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLog));
        if (shouldFilter && parsedGroups.length > 0) data = data.filter(log => parsedGroups.includes(log.groupId || "") || parsedGroups.some(g => log.details.includes(g)));
        if (hidePrototype) data = data.filter(log => !log.id.startsWith("log-seed-"));
        setSystemLogs(data);
      }, (err) => handleSyncError(err, OperationType.LIST, "system_logs"));
    } else {
      setSystemLogs([]);
    }

    return () => unsubLogs();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError,
    systemLogLimit
  ]);

  // Lazy Users Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('users')) return;
    const hidePrototype = true;
    const shouldFilter = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    let isFirstSnap = true;

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      let data = snap.docs.map(doc => normalizeUserProfile({ id: doc.id, ...doc.data() } as UserProfile));
      if (shouldFilter && parsedGroups.length > 0) data = data.filter(u => parsedGroups.includes(u.group || "") || (u.groups && u.groups.some(g => parsedGroups.includes(g))));
      if (hidePrototype) data = data.filter(u => !u.id.startsWith("u-"));

      if (isFirstSnap) {
        isFirstSnap = false;
      } else {
        let userChanges = false;
        snap.docChanges().forEach(change => {
          if ((change.type === "added" || change.type === "modified") && !change.doc.metadata.hasPendingWrites) {
            if (!change.doc.id.startsWith("u-")) {
              userChanges = true;
            }
          }
        });

        if (userChanges) {
          triggerToast({
            type: "SYSTEM_INFO",
            severity: "LOW",
            message: "Data Updated: User directories synced in real-time.",
            timestamp: new Date().toISOString()
          });
        }
      }

      setUsers(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "users"));

    return () => unsubUsers();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError,
    triggerToast
  ]);

  // Lazy Permissions Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('permissions')) return;

    const unsubPermissions = onSnapshot(collection(db, "permissions"), (snap) => {
      setPermissionConfigs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PermissionConfig)));
    }, (err) => handleSyncError(err, OperationType.LIST, "permissions"));

    return () => unsubPermissions();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Thresholds Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('thresholds')) return;
    const unsubThresholds = onSnapshot(collection(db, "thresholds"), (snap) => {
      setThresholds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AlertThreshold)));
    }, (err) => handleSyncError(err, OperationType.LIST, "thresholds"));
    return () => unsubThresholds();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    syncTargetsKey,
    handleSyncError
  ]);

  // Real-time Presence Heartbeat (Supabase & Firestore Unified)
  useEffect(() => {
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended) return;

    const updatePresence = async (onlineStatus: boolean) => {
      const now = Date.now();
      if (onlineStatus && now - lastPresenceTimeRef.current < 45000) return;
      lastPresenceTimeRef.current = now;

      const nowStr = new Date(now).toISOString();
      try {
        const headers = await getAuthHeaders();
        fetch(`/api/db/users/${currentUserId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            is_online: onlineStatus,
            isOnline: onlineStatus,
            last_seen: nowStr,
            lastSeen: nowStr
          })
        }).catch(() => {});
      } catch (_e) {}
    };

    // Trigger immediately on mount/load
    updatePresence(true);

    // Setup periodic heartbeat every 60 seconds
    const heartbeatInterval = setInterval(() => {
      updatePresence(true);
    }, 60000);

    const handleUnload = async () => {
      const headers = await getAuthHeaders();
      fetch(`/api/db/users/${currentUserId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_online: false, isOnline: false })
      }).catch(err => console.warn("Presence unload update error:", err));
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("beforeunload", handleUnload);
      // Clean up presence (offline) when unmounting
      updatePresence(false);
    };
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    skipFirestore
  ]);

  // Real-time Sync for Ledger Books
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended) return;
    const unsubLedgers = !activeSyncTargets.has('ledger_books') ? () => {} : onSnapshot(
      collection(db, "ledger_books"),
      (snap) => {
        setLedgerBooks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerBook)));
      },
      (err) => handleSyncError(err, OperationType.LIST, "ledger_books")
    );
    return () => unsubLedgers();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    db,
    syncTargetsKey,
    handleSyncError
  ]);

  // Real-time Sync for Supplementary Budget Requests
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended) return;
    const unsubSupplementary = !activeSyncTargets.has('supplementary_budget_requests') ? () => {} : onSnapshot(
      query(collection(db, "supplementary_budgets"), orderBy("submittedAt", "desc")),
      (snap) => {
        setSupplementaryRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplementaryBudgetRequest)));
      },
      (err) => {
         if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded") || String(err).includes("Quota exceeded")) {
           setFirestoreQuotaExceeded(true);
         }
         console.log("Supplementary budget sync failed/not initialized:", err);
      }
    );
    return () => unsubSupplementary();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    db,
    syncTargetsKey
  ]);

  // One-time Fetch for Vendors
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('vendors') || fetchedTargetsRef.current.has('vendors')) return;
    
    const fetchVendors = async () => {
      startSyncing('vendors');
      try {
        fetchedTargetsRef.current.add('vendors');
        const snap = await getDocs(query(collection(db, "vendors"), orderBy("createdAt", "desc")));
        setVendors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
      } catch (err) {
        fetchedTargetsRef.current.delete('vendors');
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded") || String(err).includes("Quota exceeded")) {
          setFirestoreQuotaExceeded(true);
        }
        console.log("Vendors fetch failed:", err);
      } finally {
        stopSyncing('vendors');
      }
    };
    fetchVendors();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    db,
    syncTargetsKey,
    startSyncing,
    stopSyncing
  ]);

  // Automated background expiry notifications watcher (Admin only for writing alerts)
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || (currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.SUPER_ADMIN) || requisitions.length === 0 || thresholds.length === 0) return;

    const checkExpiryAlerts = async () => {
      const expiryThreshold = thresholds.find(t => t.type === "EXPIRY_ALERT")?.threshold ?? 15;
      const budgetThreshold = thresholds.find(t => t.type === "BUDGET_OVERSHOOT")?.threshold ?? 90;
      const now = new Date();

      // Check Expiry
      for (const req of requisitions) {
        if ([RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1].includes(req.status)) {
          const submittedDate = new Date(req.submittedAt);
          const diffTime = Math.abs(now.getTime() - submittedDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= expiryThreshold) {
            const alertId = `expiry-${req.id}`;
            const alertExists = alerts.some(a => a.id === alertId);

            if (!alertExists) {
              const newAlert: BudgetAlert = {
                id: alertId,
                type: "EXPIRY",
                severity: "HIGH",
                message: `Requisition '${req.title}' from ${req.groupName} was submitted ${diffDays} days ago and is now EXPIRED. Requires immediate action.`,
                timestamp: now.toISOString(),
                isRead: false
              };
              try {
                await setDoc(doc(db, "alerts", alertId), newAlert);
                await addSystemLog("REQUISITION_EXPIRED", `Alert triggered: Requisition '${req.title}' is expired (pending ${diffDays} days)`, { requisitionId: req.id, diffDays });
              } catch (e) {
                handleFirestoreError(e, OperationType.CREATE, `alerts/${alertId}`);
              }
            }
          }
        }
      }

      // Check Budget Overshoot
      for (const project of projects) {
        const projectReqs = getProjectRequisitions(project, requisitions);
        const dynamicSpent = projectReqs
          .filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED].includes(r.status))
          .reduce((sum, r) => sum + r.amount, 0);

        const usage = (dynamicSpent / project.allocatedBudget) * 100;
        if (usage >= budgetThreshold) {
          const alertId = `budget-${project.id}-${Math.floor(usage)}`;
          const alertExists = alerts.some(a => a.id === alertId || (a.message.includes(project.name) && a.type === "OVERSHOOT" && !a.isRead));

          if (!alertExists) {
            const newAlert: BudgetAlert = {
              id: alertId,
              type: "OVERSHOOT",
              severity: usage >= 100 ? "HIGH" : "MEDIUM",
              message: `PROJECT BUDGET ALERT: '${project.name}' has reached ${usage.toFixed(1)}% utilization (${dynamicSpent.toLocaleString()} / ${project.allocatedBudget.toLocaleString()}).`,
              timestamp: now.toISOString(),
              isRead: false
            };
            try {
              await setDoc(doc(db, "alerts", alertId), newAlert);
              await addSystemLog("BUDGET_OVERSHOOT", `Budget threshold reached for ${project.name}: ${usage.toFixed(1)}%`, { projectId: project.id, usage: usage.toFixed(1) });
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, `alerts/${alertId}`);
            }
          }
        }
      }
    };

    checkExpiryAlerts();
  }, [requisitions, alerts, projects, thresholds, firestoreQuotaExceeded, currentUserId, currentUserRole, db, addSystemLog]);

  // Automated background trigger for FINANCE alerts on L2 Approved status
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || requisitions.length === 0) return;

    const checkL2ApprovedAlerts = async () => {
      const now = new Date();
      for (const req of requisitions) {
        if (req.status === RequisitionStatus.APPROVED_L2) {
          const alertId = `finance-l2-ready-${req.id}`;
          const alertExists = alerts.some(a => a.id === alertId);

          if (!alertExists) {
            const newAlert: BudgetAlert = {
              id: alertId,
              type: "L2_APPROVED",
              severity: "HIGH",
              message: `ATTENTION FINANCE: Requisition '${req.title}' from ${req.groupName} has reached APPROVED L2 status. Please verify entries and initiate disbursement of KES ${req.amount.toLocaleString()}.`,
              timestamp: now.toISOString(),
              isRead: false,
              targetRole: UserRole.FINANCE
            };
            try {
              await setDoc(doc(db, "alerts", alertId), newAlert);
              await addSystemLog("FINANCE_ALERT_TRIGGERED", `Automated alert dispatched to FINANCE team for L2 Approved requisition: '${req.title}'`, { requisitionId: req.id });
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, `alerts/${alertId}`);
            }
          }
        }
      }
    };

    checkL2ApprovedAlerts();
  }, [requisitions, alerts, firestoreQuotaExceeded, currentUserId, db, addSystemLog]);

  // Recurring Requisitions Watcher
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || requisitions.length === 0) return;

    const checkRecurring = async () => {
      const now = new Date();
      
      for (const req of requisitions) {
        if (!req.recurrence || req.recurrence === RecurrenceType.NONE) continue;

        // Check if we should generate a new one
        const lastGenerated = req.lastRecurrenceGeneratedAt ? new Date(req.lastRecurrenceGeneratedAt) : new Date(req.submittedAt);
        let shouldGenerate = false;
        
        if (req.recurrence === RecurrenceType.MONTHLY) {
          const nextDate = new Date(lastGenerated);
          nextDate.setMonth(nextDate.getMonth() + 1);
          if (now >= nextDate) shouldGenerate = true;
        } else if (req.recurrence === RecurrenceType.QUARTERLY) {
          const nextDate = new Date(lastGenerated);
          nextDate.setMonth(nextDate.getMonth() + 3);
          if (now >= nextDate) shouldGenerate = true;
        }

        if (shouldGenerate) {
          const draftId = `req-auto-${req.id}-${Date.now()}`;
          const expiryDays = systemSettings?.requisitionExpiryDays ?? 7;
          const newDraft: Requisition = {
            ...req,
            id: draftId,
            status: RequisitionStatus.DRAFT,
            submittedAt: now.toISOString(),
            updatedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
            approvalHistory: [],
            recurrence: RecurrenceType.NONE, // Spawned ones are one-off
            lastRecurrenceGeneratedAt: undefined
          };
          
          try {
            await setDoc(doc(db, "requisitions", draftId), newDraft);
            await updateDoc(doc(db, "requisitions", req.id), {
              lastRecurrenceGeneratedAt: now.toISOString()
            });
            await addSystemLog("AUTO_RECURRING", `Spawned recurring draft: ${req.title}`, { parentId: req.id });
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `requisitions/${draftId}`);
          }
        }
      }
    };

    checkRecurring();
  }, [requisitions, firestoreQuotaExceeded, currentUserId, db, addSystemLog, systemSettings]);

  // --- UNIFIED MONGODB DATA LOADER FOR ALL 15 DATASETS ---
  useEffect(() => {
    if (!currentUserId || currentUserIsSuspended) {
      setLoading(false);
      return;
    }

    let active = true;
    let pollInterval: any = null;

    const fetchAllFromMongoDB = async () => {
      if (isFetchingDbRef.current) return;
      isFetchingDbRef.current = true;

      const hidePrototype = true;
      const isGroupUser = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
      let filterGroups: string[] = [];
      try {
        filterGroups = JSON.parse(currentUserGroupsJSON || "[]") as string[];
      } catch (e) {
        console.error("Failed to parse user groups JSON:", e);
      }
      const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

      try {
        const headers = await getAuthHeaders();
        let response;
        try {
          response = await fetch("/api/db-all", { headers });
        } catch (fetchErr) {
          console.warn("Network Error when fetching database:", fetchErr);
          return;
        }

        if (!response || !response.ok) {
          if (response?.status === 429) {
            console.warn("[DB Sync] Rate limit hit on /api/db-all, skipping interval.");
          } else {
            console.warn(`[DB Sync] Server returned status ${response?.status || "unknown"}`);
          }
          return;
        }

        let dbData: any = null;
        try {
          dbData = await response.json();
        } catch (jsonErr) {
          console.error("[DB Sync] Malformed JSON received from backend:", jsonErr);
          return;
        }

        if (!active) return;
        if (!dbData || typeof dbData !== 'object') {
          console.warn("[DB Sync] Data received is not an object:", dbData);
          return;
        }

        // Process Requisitions
        try {
          if (dbData?.requisitions && Array.isArray(dbData.requisitions)) {
            let data = dbData.requisitions.map((r: any) => {
              if (!r) return null;
              return {
                id: r?.id || "",
                projectId: r?.project_id || r?.projectId || "",
                title: r?.title || "",
                description: r?.description || "",
                amount: Number(r?.amount) || 0,
                amountWords: r?.amount_words || r?.amountWords || "",
                groupId: r?.group_id || r?.groupId || "",
                groupName: r?.group_name || r?.groupName || "",
                requesterId: r?.requester_id || r?.requesterId || "",
                requesterName: r?.requester_name || r?.requesterName || "",
                requesterEmail: r?.requester_email || r?.requesterEmail || "",
                status: r?.status || "DRAFT",
                submittedAt: r?.submitted_at || r?.submittedAt || "",
                updatedAt: r?.updated_at || r?.updatedAt || "",
                expiresAt: r?.expires_at || r?.expiresAt || "",
                escalationLevel: Number(r?.escalation_level) || Number(r?.escalationLevel) || 0,
                escalationNotificationsSent: Boolean(r?.escalation_notifications_sent || r?.escalationNotificationsSent),
                approvedAtL1: r?.approved_at_l1 || r?.approvedAtL1 || "",
                approvedAtL2: r?.approved_at_l2 || r?.approvedAtL2 || "",
                disbursedAt: r?.disbursed_at || r?.disbursedAt || "",
                rejectionReason: r?.rejection_reason || r?.rejectionReason || "",
                approvalHistory: safeNormalizeApprovalHistory(r?.approval_history || r?.approvalHistory || []),
                comments: r?.comments || [],
                digitalSignature: r?.digital_signature || r?.digitalSignature || "",
                payableTo: r?.payable_to || r?.payableTo || "",
                recurrence: r?.recurrence || null,
                lastRecurrenceGeneratedAt: r?.last_recurrence_generated_at || r?.lastRecurrenceGeneratedAt || "",
                additionalInfo: r?.additional_info || r?.additionalInfo || null,
                attachments: safeNormalizeAttachments(r?.attachments),
                receipts: safeNormalizeReceipts(r?.receipts),
                notificationEmails: safeNormalizeNotificationEmails(r),
                isSharedRequisition: Boolean(r?.is_shared_requisition || r?.isSharedRequisition),
                sharedGroups: Array.isArray(r?.shared_groups) ? r.shared_groups : (Array.isArray(r?.sharedGroups) ? r.sharedGroups : []),
                flaggedForAudit: Boolean(r?.flagged_for_audit || r?.flaggedForAudit),
                inProcurement: Boolean(r?.in_procurement || r?.inProcurement),
                requiresMoreInfo: Boolean(r?.requires_more_info || r?.requiresMoreInfo),
                fiscalYear: Number(r?.fiscal_year || r?.fiscalYear) || undefined
              } as Requisition;
            }).filter(Boolean) as Requisition[];

            if (isGroupUser && parsedGroups.length > 0) {
              data = data.filter(req => req && ((req.groupId && (parsedGroups.includes(req.groupId) || parsedGroups.includes(req.groupName))) || (req.sharedGroups && Array.isArray(req.sharedGroups) && req.sharedGroups.some(sg => parsedGroups.includes(sg)))));
            }
            if (hidePrototype) {
              data = data.filter(req => req && req.id && !req.id.startsWith("req-seed-"));
            }
            setRequisitions(data);
          }
        } catch (reqErr) {
          console.error("[DB Sync] Error mapping requisitions:", reqErr);
        }

        // Process Projects
        try {
          if (dbData?.projects && Array.isArray(dbData.projects)) {
            let data = dbData.projects.map((p: any) => {
              if (!p) return null;
              return {
                id: p?.id || "",
                name: p?.name || "",
                groupId: p?.group_id || p?.groupId || "",
                allocatedBudget: Number(p?.allocated_budget) || Number(p?.allocatedBudget) || 0,
                spentAmount: Number(p?.spent_amount) || Number(p?.spentAmount) || 0,
                status: p?.status || "ACTIVE",
                color: p?.color || "",
                fiscalYear: p?.fiscal_year || p?.fiscalYear || 2026,
                requisitionLimit: Number(p?.requisition_limit) || Number(p?.requisitionLimit) || 0,
                accountNumber: p?.account_number || p?.accountNumber || ""
              } as Project;
            }).filter(Boolean) as Project[];

            if (hidePrototype) {
              data = data.filter(p => p && p.id && !["p1", "p2", "p3", "p4", "p5"].includes(p.id));
            }
            setProjects(data);
          }
        } catch (projErr) {
          console.error("[DB Sync] Error mapping projects:", projErr);
        }

        // Process Alerts
        try {
          if (dbData?.alerts && Array.isArray(dbData.alerts)) {
            let data = dbData.alerts.map((a: any) => {
              if (!a) return null;
              return {
                id: a?.id || "",
                type: a?.type || "",
                severity: a?.severity || "",
                message: a?.message || "",
                timestamp: a?.timestamp || "",
                isRead: Boolean(a?.is_read || a?.isRead),
                targetRole: a?.target_role || a?.targetRole,
                targetUserId: a?.target_user_id || a?.targetUserId
              } as BudgetAlert;
            }).filter(Boolean) as BudgetAlert[];

            if (isGroupUser && parsedGroups.length > 0) {
              data = data.filter(a => a && a.message && parsedGroups.some(g => a.message.includes(g)));
            }
            if (hidePrototype) {
              data = data.filter(a => a && a.id && !a.id.includes("req-seed-") && !a.id.match(/budget-p[0-9]+/));
            }
            setAlerts(data);
          }
        } catch (alertErr) {
          console.error("[DB Sync] Error mapping alerts:", alertErr);
        }

        // Process Fiscal Years
        try {
          if (dbData?.fiscal_years && Array.isArray(dbData.fiscal_years)) {
            const data = dbData.fiscal_years.map((fy: any) => {
              if (!fy) return null;
              return {
                id: fy?.id || "",
                year: Number(fy?.year) || 2026,
                label: fy?.label || "",
                status: fy?.status || "CLOSED",
                createdAt: fy?.created_at || fy?.createdAt || "",
                notes: fy?.notes || ""
              } as FiscalYear;
            }).filter(Boolean) as FiscalYear[];
            setFiscalYears(data);
          }
        } catch (fyErr) {
          console.error("[DB Sync] Error mapping fiscal years:", fyErr);
        }

        // Process Transactions
        try {
          if (dbData?.transactions && Array.isArray(dbData.transactions)) {
            const data = dbData.transactions.map((tx: any) => {
              if (!tx) return null;
              return {
                id: tx?.id || "",
                externalRef: tx?.external_ref || tx?.externalRef || "",
                sourceSystem: tx?.source_system || tx?.sourceSystem || "",
                amount: Number(tx?.amount) || 0,
                type: tx?.type || "",
                status: tx?.status || "",
                description: tx?.description || "",
                category: tx?.category || "",
                timestamp: tx?.timestamp || "",
                performedBy: tx?.performed_by || tx?.performedBy || "",
                metadata: tx?.metadata || null
              } as Transaction;
            }).filter(Boolean) as Transaction[];
            data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setTransactions(data);
          }
        } catch (txErr) {
          console.error("[DB Sync] Error mapping transactions:", txErr);
        }

        // Process Forecast
        try {
          if (dbData?.forecast && Array.isArray(dbData.forecast)) {
            const data = dbData.forecast.map((f: any) => {
              if (!f) return null;
              return {
                month: f?.month || "",
                projected: Number(f?.projected) || 0,
                actual: Number(f?.actual) || 0
              } as ForecastMonth;
            }).filter(Boolean) as ForecastMonth[];
            setForecastData(data);
          }
        } catch (forecastErr) {
          console.error("[DB Sync] Error mapping forecast:", forecastErr);
        }

        // Process Reports
        try {
          if (dbData?.reports && Array.isArray(dbData.reports)) {
            const data = dbData.reports.map((r: any) => {
              if (!r) return null;
              return {
                id: r?.id || "",
                title: r?.title || "",
                description: r?.description || "",
                generatedBy: r?.generated_by || r?.generatedBy || "",
                generatedById: r?.generated_by_id || r?.generatedById || "",
                timestamp: r?.timestamp || "",
                period: r?.period || "",
                stats: r?.stats || null,
                filters: r?.filters || null,
                itemCount: Number(r?.item_count) || Number(r?.itemCount) || 0
              } as SavedReport;
            }).filter(Boolean) as SavedReport[];
            setReports(data);
          }
        } catch (reportErr) {
          console.error("[DB Sync] Error mapping reports:", reportErr);
        }

        // Process System Logs
        try {
          if (dbData?.audit_logs && Array.isArray(dbData.audit_logs)) {
            const data = dbData.audit_logs.map((l: any) => {
              if (!l) return null;
              return {
                id: l?.id?.toString() || `log-${Math.random()}`,
                action: l?.action || "",
                details: l?.details || "",
                performedBy: l?.performed_by || l?.performedBy || "",
                timestamp: l?.timestamp || "",
                groupId: l?.group_id || l?.groupId || "",
                metadata: l?.metadata || null
              } as SystemLog;
            }).filter(Boolean) as SystemLog[];
            setSystemLogs(data);
          }
        } catch (logErr) {
          console.error("[DB Sync] Error mapping system logs:", logErr);
        }

        // Process Users
        try {
          if (dbData?.users && Array.isArray(dbData.users)) {
            const data = dbData.users.map((u: any) => {
              if (!u) return null;
              return normalizeUserProfile({
                id: u?.id || "",
                name: u?.name || "",
                email: u?.email || "",
                role: u?.role || "",
                group: u?.group || "",
                groups: u?.groups || [],
                approverCode: u?.approver_code || u?.approverCode || "",
                isActive: Boolean(u?.is_active !== undefined ? u?.is_active : u?.isActive),
                isApproved: Boolean(u?.is_approved !== undefined ? u?.is_approved : u?.isApproved),
                isSuspended: Boolean(u?.is_suspended !== undefined ? u?.is_suspended : u?.isSuspended),
                phone: u?.phone || "",
                department: u?.department || "",
                photoURL: u?.photo_url || u?.photoURL || "",
                tempPassword: u?.temp_password || u?.tempPassword || "",
                isOnline: Boolean(u?.is_online || u?.isOnline),
                lastSeen: u?.last_seen || u?.lastSeen || "",
                idleTimeoutDuration: Number(u?.idle_timeout_duration) || Number(u?.idleTimeoutDuration) || 15
              } as UserProfile);
            }).filter(Boolean) as UserProfile[];
            setUsers(data);
          }
        } catch (userErr) {
          console.error("[DB Sync] Error mapping users:", userErr);
        }

        // Process Permissions
        try {
          if (dbData?.permissions && Array.isArray(dbData.permissions)) {
            const data = dbData.permissions
              .map(normalizePermissionConfig)
              .filter(p => p && p.role) as PermissionConfig[];

            if (data.length > 0) {
              setPermissionConfigs(prev => {
                const map = new Map<string, PermissionConfig>();
                // 1. Base defaults
                DEFAULT_PERMISSIONS.forEach(p => map.set(p.role, p));
                // 2. Cached previous state
                prev.forEach(p => {
                  if (p && p.role) {
                    const existing = map.get(p.role);
                    map.set(p.role, normalizePermissionConfig({
                      id: p.id || existing?.id || p.role,
                      role: p.role,
                      access: { ...(existing?.access || {}), ...(p.access || {}) },
                      actions: { ...(existing?.actions || {}), ...(p.actions || {}) }
                    }));
                  }
                });
                // 3. Authoritative server database state
                data.forEach(p => {
                  const existing = map.get(p.role);
                  map.set(p.role, normalizePermissionConfig({
                    id: p.id || existing?.id || p.role,
                    role: p.role,
                    access: { ...(existing?.access || {}), ...(p.access || {}) },
                    actions: { ...(existing?.actions || {}), ...(p.actions || {}) }
                  }));
                });
                const result = Array.from(map.values());
                try {
                  localStorage.setItem("stands_cache_permissions", JSON.stringify(result));
                } catch (e) {}
                return result;
              });
            }
          }
        } catch (permErr) {
          console.error("[DB Sync] Error mapping permissions:", permErr);
        }

        // Process Settings
        try {
          if (dbData?.settings && Array.isArray(dbData.settings)) {
            const systemDoc = dbData.settings.find((s: any) => s?.id === "system" || s?.id === "settings_system");
            if (systemDoc) {
              setSystemSettings(prev => {
                const nextSettings = {
                  ...prev,
                  ...systemDoc,
                  hideSupplementaryBudgetBtn: Boolean(systemDoc.hide_supplementary_budget_btn !== undefined ? systemDoc.hide_supplementary_budget_btn : (systemDoc.hideSupplementaryBudgetBtn !== undefined ? systemDoc.hideSupplementaryBudgetBtn : prev.hideSupplementaryBudgetBtn)),
                  vendorListViewLevel: systemDoc.vendor_list_view_level || systemDoc.vendorListViewLevel || prev.vendorListViewLevel,
                  requisitionExpiryDays: Number(systemDoc.requisition_expiry_days || systemDoc.requisitionExpiryDays) || prev.requisitionExpiryDays,
                  isSystemOffline: Boolean(systemDoc.is_system_offline !== undefined ? systemDoc.is_system_offline : (systemDoc.isSystemOffline !== undefined ? systemDoc.isSystemOffline : prev.isSystemOffline))
                };
                try {
                  localStorage.setItem("stands_cache_system_settings", JSON.stringify(nextSettings));
                } catch (e) {}
                return nextSettings;
              });
            }
          }
        } catch (settingsErr) {
          console.error("[DB Sync] Error mapping settings:", settingsErr);
        }

        // Process Thresholds
        try {
          if (dbData?.thresholds && Array.isArray(dbData.thresholds)) {
            const data = dbData.thresholds.map((t: any) => {
              if (!t) return null;
              return {
                id: t?.id || "",
                type: t?.type || "",
                threshold: Number(t?.threshold) || 0,
                isEnabled: Boolean(t?.is_enabled !== undefined ? t?.is_enabled : t?.isEnabled),
                notifyEmail: t?.notify_email || t?.notifyEmail || ""
              } as AlertThreshold;
            }).filter(Boolean) as AlertThreshold[];
            setThresholds(data);
          }
        } catch (threshErr) {
          console.error("[DB Sync] Error mapping thresholds:", threshErr);
        }

        // Process Church Groups
        try {
          if (dbData?.church_groups && Array.isArray(dbData.church_groups)) {
            const data = dbData.church_groups.map((cg: any) => {
              if (!cg) return null;
              return {
                id: cg?.id || "",
                name: cg?.name || "",
                description: cg?.description || "",
                createdAt: cg?.created_at || cg?.createdAt || ""
              } as ChurchGroup;
            }).filter(Boolean) as ChurchGroup[];
            setChurchGroups(data);
            setLastGroupsSync(new Date());
          }
        } catch (cgErr) {
          console.error("[DB Sync] Error mapping church groups:", cgErr);
        }

        // Process Ledger Books
        try {
          if (dbData?.ledger_books && Array.isArray(dbData.ledger_books)) {
            const data = dbData.ledger_books.map((lb: any) => {
              if (!lb) return null;
              return {
                id: lb?.id || "",
                ministryId: lb?.ministry_id || lb?.ministryId || "",
                ministryName: lb?.ministry_name || lb?.ministryName || "",
                bookName: lb?.book_name || lb?.bookName || "",
                description: lb?.description || "",
                createdAt: lb?.created_at || lb?.createdAt || "",
                createdBy: lb?.created_by || lb?.createdBy || "",
                creatorName: lb?.creator_name || lb?.creatorName || "",
                budgetLimit: Number(lb?.budget_limit) || Number(lb?.budgetLimit) || 0,
                spentAmount: Number(lb?.spent_amount) || Number(lb?.spentAmount) || 0,
                notes: lb?.notes || "",
                status: lb?.status || "ACTIVE"
              } as LedgerBook;
            }).filter(Boolean) as LedgerBook[];
            setLedgerBooks(data);
          }
        } catch (lbErr) {
          console.error("[DB Sync] Error mapping ledger books:", lbErr);
        }

        // Process Supplementary Budgets
        try {
          if (dbData?.supplementary_budgets && Array.isArray(dbData.supplementary_budgets)) {
            const data = dbData.supplementary_budgets.map((sb: any) => {
              if (!sb) return null;
              return {
                id: sb?.id || "",
                requesterId: sb?.requester_id || sb?.requesterId || "",
                requesterName: sb?.requester_name || sb?.requesterName || "",
                requesterEmail: sb?.requester_email || sb?.requesterEmail || "",
                role: sb?.role || "",
                projectId: sb?.project_id || sb?.projectId || "",
                projectName: sb?.project_name || sb?.projectName || "",
                amount: Number(sb?.amount) || 0,
                justification: sb?.justification || "",
                submittedAt: sb?.submitted_at || sb?.submittedAt || "",
                status: sb?.status || "PENDING"
              } as SupplementaryBudgetRequest;
            }).filter(Boolean) as SupplementaryBudgetRequest[];
            setSupplementaryRequests(data);
          }
        } catch (sbErr) {
          console.error("[DB Sync] Error mapping supplementary budgets:", sbErr);
        }

        // Process Vendors
        try {
          if (dbData?.vendors && Array.isArray(dbData.vendors)) {
            const data = dbData.vendors.map((v: any) => {
              if (!v) return null;
              return {
                id: v?.id || "",
                name: v?.name || "",
                contact: v?.contact || "",
                location: v?.location || "",
                offerings: Array.isArray(v?.offerings) ? v.offerings.join(", ") : (typeof v?.offerings === "string" ? v.offerings : ""),
                createdAt: v?.created_at || v?.createdAt || "",
                addedBy: v?.added_by || v?.addedBy || "",
                status: v?.status || "ACTIVE"
              } as Vendor;
            }).filter(Boolean) as Vendor[];
            setVendors(data);
          }
        } catch (vendorErr) {
          console.error("[DB Sync] Error mapping vendors:", vendorErr);
        }

        console.log("✅ All data fetched and synchronized successfully!");
      } catch (err) {
        console.info("Critical issue pulling data from MongoDB:", err);
      } finally {
        isFetchingDbRef.current = false;
        setLoading(false);
      }
    };

    fetchAllFromMongoDB();
    // Background polling interval to keep UI reactive even without websockets
    pollInterval = setInterval(fetchAllFromMongoDB, 20000);

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    systemLogLimit
  ]);

  // 5-hour Automated Google Drive System Backup Runner
  useEffect(() => {
    const runAutoBackup = async () => {
      const LAST_BACKUP_TIME_KEY = "st_andrews_last_drive_backup_timestamp";
      const BACKUP_INTERVAL_MS = 5 * 60 * 60 * 1000;
      const lastTs = localStorage.getItem(LAST_BACKUP_TIME_KEY);
      const now = Date.now();

      if (!lastTs || now - new Date(lastTs).getTime() >= BACKUP_INTERVAL_MS) {
        try {
          const payload = {
            timestamp: new Date().toISOString(),
            version: "4.2.0",
            targetAccount: "ict.team@pceastandrews.org",
            systemSettings,
            users,
            requisitions,
            projects,
            churchGroups,
            ledgerBooks,
            systemLogs,
            customCalendarEvents,
            supplementaryRequests
          };

          const res = await fetch("/api/backup-all-to-drive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            localStorage.setItem(LAST_BACKUP_TIME_KEY, new Date().toISOString());
            console.log("[Google Drive Auto-Backup] 5-hour backup completed successfully for ict.team@pceastandrews.org.");
          }
        } catch (e) {
          console.warn("[Google Drive Auto-Backup] Scheduled backup check failed:", e);
        }
      }
    };

    runAutoBackup();
    const driveBackupInterval = setInterval(runAutoBackup, 30 * 60 * 1000); // Check every 30m if 5h elapsed
    return () => clearInterval(driveBackupInterval);
  }, [requisitions.length, users.length, projects.length]);



  const login = async () => {
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const email = result.user.email?.toLowerCase() || "";
        await dispatchLoginSlackAlert(email, "Google OAuth 2.0", result.user.uid);
      }
    } catch (error: any) {
      console.log("Login warning", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      email = email.trim().toLowerCase();
      
      const checkRes = await fetch(`/api/auth/check-pre-registered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
      }).catch(() => null);
      
      if (checkRes && checkRes.ok) {
        const checkData = await checkRes.json().catch(() => ({}));
        if (checkData.preRegistered && checkData.tempPasswordMatched) {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            if (userCredential.user) {
              fetch("/api/auth/link-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  uid: userCredential.user.uid,
                  email: email,
                  profileId: checkData.profileId
                })
              }).catch(e => console.warn("Failed link profile background:", e));
              
              dispatchLoginSlackAlert(email, "Pre-Registered Password Activation", userCredential.user.uid).catch(() => {});
              return;
            }
          } catch (signUpErr: any) {
            if (signUpErr.code === "auth/email-already-in-use") {
              const userCredential = await signInWithEmailAndPassword(auth, email, pass);
              if (userCredential.user) {
                fetch("/api/auth/link-profile", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    uid: userCredential.user.uid,
                    email: email,
                    profileId: checkData.profileId
                  })
                }).catch(e => console.warn("Failed link profile background:", e));
                
                dispatchLoginSlackAlert(email, "Email & Password", userCredential.user.uid).catch(() => {});
                return;
              }
            }
            throw signUpErr;
          }
        }
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        dispatchLoginSlackAlert(email, "Email & Password", userCredential.user.uid).catch(() => {});
      }
    } catch (error: any) {
      console.error("Login with email failed:", error);
      sendSlackNotification({
        action: "FAILED_LOGIN_ATTEMPT",
        details: `🛑 SECURITY ALERT: Failed login attempt for ${email}. Reason: ${error.message || error.code || "Invalid credentials"}`,
        performedBy: email || "Anonymous User",
        level: "critical",
        metadata: {
          email,
          errorCode: error.code || "auth/invalid-credential",
          errorMessage: error.message || "Invalid credentials",
          authProvider: "Email & Password",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser"
        }
      }).catch(() => {});
      throw error;
    }
  };

  const addChurchGroup = useCallback(async (name: string, description?: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can manage church groups.");
    }
    const id = `cg-${Math.random().toString(36).substr(2, 9)}`;
    const newGroup: ChurchGroup = {
      id,
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    try {
      await databaseService.saveChurchGroup(newGroup);
      await addSystemLog("GROUP_CREATED", `Church group '${name}' created by admin`, { groupId: id, name });
    } catch (err) {
      console.error("Error creating church group", err);
      throw err;
    }
  }, [currentUser, addSystemLog]);

  const deleteChurchGroup = useCallback(async (id: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can manage church groups.");
    }
    try {
      await databaseService.deleteChurchGroup(id);
      await addSystemLog("GROUP_DELETED", `Church group ID '${id}' deleted by admin`, { groupId: id });
    } catch (err) {
      console.error("Error deleting church group", err);
      throw err;
    }
  }, [currentUser, addSystemLog]);

  const createLedgerBook = useCallback(async (ministryName: string, bookName: string, budgetLimit: number = 0) => {
    if (!currentUser) throw new Error("Authentication required");
    if (!navigator.onLine) {
      throw new Error("Offline Mode: You are offline.");
    }

    const normalizedName = ministryName.trim();
    const existingBook = ledgerBooks.find(b => b.ministryName === normalizedName);
    if (existingBook) {
      throw new Error(`Invariance Violated: The ministry already has an active ledger book. Each ministry is strictly limited to one ledger book.`);
    }

    const id = `ledger-${Math.random().toString(36).substr(2, 9)}`;
    const newBook: LedgerBook = {
      id,
      ministryName: normalizedName,
      bookName: bookName.trim(),
      description: "Official Ministry Ledger Book",
      createdAt: new Date().toISOString(),
      createdBy: currentUser.email || currentUser.id || "system",
      creatorName: currentUser.name || "Unknown User",
      budgetLimit: budgetLimit,
      spentAmount: 0,
      status: "ACTIVE"
    };

    console.log("Creating ledger book with data:", cleanFirestoreData(newBook));
    try {
      await setDoc(doc(db, "ledger_books", id), cleanFirestoreData(newBook));
      await addSystemLog("LEDGER_BOOK_CREATED", `Created ledger book '${newBook.bookName}' for ministry '${newBook.ministryName}' with limit ${budgetLimit}`, {
        ledgerId: id,
        ministryName: newBook.ministryName,
        bookName: newBook.bookName,
        budgetLimit
      });
      triggerToast({ type: "SYSTEM_INFO", message: `Ledger book for ${newBook.ministryName} created successfully`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `ledger_books/${id}`);
    }
  }, [currentUser, ledgerBooks, addSystemLog, triggerToast]);

  const updateLedgerBookBudget = useCallback(async (id: string, newLimit: number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.FINANCE) {
      throw new Error("Unauthorized: Only Admin, Super Admin, and Finance users can edit ledger books.");
    }
    if (newLimit < 0) throw new Error("Budget limit must be larger than or equal to 0.");

    try {
      const ledgerRef = doc(db, "ledger_books", id);
      const ledgerSnap = await getDoc(ledgerRef);
      if (!ledgerSnap.exists()) throw new Error("Ledger book not found.");
      const ledgerData = ledgerSnap.data() as LedgerBook;

      await updateDoc(ledgerRef, {
        budgetLimit: newLimit
      });

      await addSystemLog("LEDGER_BOOK_UPDATED", `Updated budget limit of ledger book '${ledgerData.ministryName}' to KES ${newLimit.toLocaleString()}`, { ledgerId: id, ministryName: ledgerData.ministryName, newLimit });
      triggerToast({ type: "SYSTEM_INFO", message: `Ledger book budget for ${ledgerData.ministryName} updated.`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to update ledger book budget:", err);
      throw err;
    }
  }, [currentUser, db, addSystemLog, triggerToast]);

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    try {
      email = email.trim().toLowerCase();
      const checkRes = await fetch(`/api/auth/get-profile-by-email?email=${encodeURIComponent(email)}`);
      const checkData = await checkRes.json();
      if (checkRes.ok && checkData.exists && !checkData.profile?.temp_password && !checkData.profile?.tempPassword) {
        throw new Error("A user with this email already exists. Please login instead.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const uid = userCredential.user.uid;
        
        if (checkData.exists && checkData.profile) {
          await fetch("/api/auth/link-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid,
              email,
              profileId: checkData.profile.id
            })
          });
        } else {
          const newProfile = {
            id: uid,
            name: name,
            email: email,
            role: "CHURCH_GROUP" as UserRole,
            is_active: true,
            is_approved: true,
            is_suspended: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          const headers = await getAuthHeaders();
          await fetch(`/api/db/users/${uid}`, {
            method: "POST",
            headers,
            body: JSON.stringify(newProfile)
          });
        }
        await dispatchLoginSlackAlert(email, "Email Registration", uid);
        await addSystemLog("USER_PROVISIONED", `User successfully registered and approved via Email: ${email}`, { 
          email,
          name,
          role: "CHURCH_GROUP",
          authProvider: "Email Registration",
          userId: uid
        });
      }
    } catch (error: any) {
      console.warn("Signup warning", error);
      if (error.code === "auth/email-already-in-use" || error.message?.includes('already registered')) {
        throw new Error("This email is already registered. Please login instead.");
      }
      throw error;
    }
  };

  const logout = async (options?: { forceDirect?: boolean }) => {
    const userEmail = auth.currentUser?.email || currentUser?.email;
    const userName = currentUser?.name || (userEmail ? userEmail.split('@')[0] : "User");
    const userRole = currentUser?.role || "USER";
    const userGroup = currentUser?.group || "General Ministry";
    const currentUserId = currentUser?.id || auth.currentUser?.uid;

    // 1. Immediately reset state and local cache for instant UI response
    setCurrentUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("override_authorized_user_email");
      localStorage.removeItem("stands_cache_user");
      sessionStorage.removeItem("slack_session_");
    }

    // 2. Fire signOut immediately
    const signOutPromise = signOut(auth).catch(err => console.warn("SignOut warning:", err));

    // 3. Dispatch background logging & notifications without blocking UI execution
    (async () => {
      if (currentUserId && db) {
        try {
          await updateDoc(doc(db, "users", currentUserId), {
            isOnline: false,
            lastSeen: new Date().toISOString()
          });
        } catch (err) {
          console.warn("Failed to mark user offline on logout:", err);
        }
      }

      if (userEmail) {
        try {
          const logoutMeta = {
            name: userName,
            email: userEmail,
            role: userRole,
            group: userGroup,
            userId: currentUserId || auth.currentUser?.uid || "N/A",
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser"
          };
          await sendSlackNotification({
            action: "USER_LOGOUT",
            details: `✌️ ${userName} (${userRole}) signed out from the system`,
            performedBy: `${userName} (${userRole})`,
            metadata: logoutMeta
          });
          await addSystemLog("USER_LOGOUT", `👤 User logged out successfully: ${userEmail}`, logoutMeta);
        } catch (logErr) {
          console.log("Failed to log logout event", logErr);
        }
      }
    })();

    await signOutPromise;
  };

  const approveUser = useCallback(async (id: string) => {
    try {
      const existingUser = users.find(u => u.id === id);
      if (existingUser) {
        const updatedUser = { ...existingUser, isApproved: true };
        
        // Optimistic local state update
        setUsers(prev => {
          const next = prev.map(u => u.id === id ? updatedUser : u);
          try { localStorage.setItem("stands_cache_users", JSON.stringify(next)); } catch (e) {}
          return next;
        });
        if (currentUser?.id === id) {
          setCurrentUser(prev => prev ? { ...prev, isApproved: true } : prev);
        }

        // Asynchronous background sync
        databaseService.saveUserProfile(updatedUser).catch(e => console.warn("[User Sync] Background approve failed:", e));
        addSystemLog("USER_APPROVAL", `Admin approved/activated user ID: ${id}`, { userId: id }).catch(e => console.warn("[User Sync] Log failed:", e));
      }
    } catch (err) {
      console.error("Error approving user:", err);
    }
  }, [users, currentUser, addSystemLog]);

  const suspendUser = useCallback(async (id: string, isSuspended: boolean) => {
    try {
      const existingUser = users.find(u => u.id === id);
      if (existingUser) {
        const updatedUser = { ...existingUser, isSuspended };
        
        // Optimistic local state update
        setUsers(prev => {
          const next = prev.map(u => u.id === id ? updatedUser : u);
          try { localStorage.setItem("stands_cache_users", JSON.stringify(next)); } catch (e) {}
          return next;
        });
        if (currentUser?.id === id) {
          setCurrentUser(prev => prev ? { ...prev, isSuspended } : prev);
        }

        // Asynchronous background sync
        databaseService.saveUserProfile(updatedUser).catch(e => console.warn("[User Sync] Background suspend failed:", e));
        addSystemLog("USER_SUSPENSION", `Admin changed suspension for user ID: ${id} to ${isSuspended}`, { userId: id, isSuspended }).catch(e => console.warn("[User Sync] Log failed:", e));
      }
    } catch (err) {
      console.error("Error suspending user:", err);
    }
  }, [users, currentUser, addSystemLog]);

  const updateUserRole = useCallback(async (id: string, role: UserRole) => {
    try {
      const existingUser = users.find(u => u.id === id);
      if (existingUser) {
        const updatedUser = { ...existingUser, role };
        
        // Optimistic local state update
        setUsers(prev => {
          const next = prev.map(u => u.id === id ? updatedUser : u);
          try { localStorage.setItem("stands_cache_users", JSON.stringify(next)); } catch (e) {}
          return next;
        });
        if (currentUser?.id === id) {
          setCurrentUser(prev => prev ? { ...prev, role } : prev);
        }

        // Asynchronous background sync
        databaseService.saveUserProfile(updatedUser).catch(e => console.warn("[User Sync] Background role update failed:", e));

        const isElevated = [UserRole.ADMIN, UserRole.FINANCE, UserRole.APPROVER_L1, UserRole.APPROVER_L2].includes(role);
        const actionTitle = isElevated ? "ELEVATED_ROLE_GRANTED" : "USER_ROLE_UPDATE";
        const detailsText = isElevated 
          ? `🚨 SECURITY NOTICE: Admin granted ELEVATED rights (${role}) to user ID: ${id}`
          : `Admin changed role of user ID: ${id} to ${role}`;
          
        addSystemLog(actionTitle, detailsText, { userId: id, newRole: role, elevated: isElevated }).catch(e => console.warn("[User Sync] Log failed:", e));
      }
    } catch (err) {
      console.error("Error updating user role:", err);
    }
  }, [users, currentUser, addSystemLog]);

  const updateUserProfile = useCallback(async (id: string, updates: Partial<UserProfile>) => {
    try {
      const existingUser = users.find(u => u.id === id);
      const updatedUser = existingUser ? { ...existingUser, ...updates } : ({ id, ...updates } as UserProfile);

      // 1. Optimistic update: Update React state immediately (0ms UI lag)
      setUsers(prev => {
        const exists = prev.some(u => u.id === id);
        const next = exists 
          ? prev.map(u => u.id === id ? { ...u, ...updates } : u)
          : [...prev, updatedUser];
        try { localStorage.setItem("stands_cache_users", JSON.stringify(next)); } catch (e) {}
        return next;
      });

      if (currentUser?.id === id) {
        setCurrentUser(prev => prev ? { ...prev, ...updates } : prev);
      }

      // 2. Non-blocking asynchronous backend save (no full screen loading overlay)
      databaseService.saveUserProfile(updatedUser).catch(e => {
        console.warn("[User Sync] Background save profile failed:", e);
      });

      addSystemLog("USER_PROFILE_UPDATE", `Profile updated for user ID: ${id}`, { userId: id, updates }).catch(e => {
        console.warn("[User Sync] System log failed:", e);
      });
    } catch (err) {
      console.error("Error updating user profile:", err);
    }
  }, [users, currentUser, addSystemLog]);

  const updateCurrentUserPassword = useCallback(async (newPassword: string) => {
    try {
      if (!auth.currentUser) {
        throw new Error("No active authenticated session found.");
      }
      
      await updateAuthPassword(auth.currentUser, newPassword);
      
      await addSystemLog("PASSWORD_CHANGED", `User ${auth.currentUser.email} updated their account password`);
      triggerToast({
        type: 'SECURITY_UPDATE',
        severity: 'MEDIUM',
        message: 'Your account password has been updated successfully.',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.code === "auth/requires-recent-login" || error.message?.includes('requires-recent-login')) {
        throw new Error("For security, updating password requires a recent login. Please log out, log back in, and try again.");
      }
      throw error;
    }
  }, [addSystemLog, triggerToast]);

  const adminRegisterUser = useCallback(async (
    email: string,
    pass: string,
    name: string,
    role: UserRole,
    group?: string,
    approverCode?: string,
    groups?: string[]
  ) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can register new users.");
    }

    // Duplicate Detection
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      throw new Error(`User with email ${email} already exists.`);
    }

    try {
      // Instead of creating the Auth account immediately (which requires complex secondary apps),
      // we pre-provision the user in Firestore with a temporary password.
      // The manual password flow in loginWithEmail will handle the user's first login by
      // creating the real Auth account and transitioning this profile.
      
      const tempId = `pre-provisioned-${Math.random().toString(36).substring(2, 12)}`;
      
      const newProfile: UserProfile = {
        id: tempId,
        name,
        email: email.toLowerCase(),
        role,
        tempPassword: pass, // Stored encrypted/protected by security rules in production
        isActive: true,
        isApproved: true,
        isSuspended: false,
      };

      if (group) newProfile.group = group;
      if (groups) newProfile.groups = groups;
      if (approverCode) newProfile.approverCode = approverCode;

      // Store in users collection
      await setDoc(doc(db, "users", tempId), newProfile);
      
      await addSystemLog("USER_PRE_PROVISIONED", `Admin pre-registered user (manual activation required): ${email} as ${role}`, {
        tempId,
        email,
        role,
        group,
        groups
      });
    } catch (error) {
      console.error("Admin user pre-provisioning failed:", error);
      throw error;
    }
  }, [currentUser, db, users, addSystemLog]);

  const adminResetUserPassword = useCallback(async (email: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can reset user passwords.");
    }
    const { sendPasswordResetEmail } = await import("firebase/auth");
    await sendPasswordResetEmail(auth, email);
    await addSystemLog("PASSWORD_RESET_TRIGGERED", `Admin triggered password reset email for user: ${email}`, { email });
  }, [currentUser, addSystemLog]);
  
  const deleteUser = useCallback(async (id: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can delete users.");
    }
    
    // Prevent self-deletion
    if (currentUser.id === id) {
      throw new Error("Cannot delete your own administrative account.");
    }

    const userToDelete = users.find(u => u.id === id);
    if (!userToDelete) {
      throw new Error("User not found.");
    }

    // Prevent deletion of Super Admins by regular Admins
    if (userToDelete.role === UserRole.SUPER_ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Super Admins can delete other Super Admins.");
    }

    // Optimistic removal from React state & localStorage
    setUsers(prev => {
      const next = prev.filter(u => u.id !== id);
      try { localStorage.setItem("stands_cache_users", JSON.stringify(next)); } catch (e) {}
      return next;
    });

    try {
      deleteDoc(doc(db, "users", id)).catch(e => console.warn("[User Sync] Delete doc failed:", e));
      const headers = await getAuthHeaders();
      fetch(`/api/db/users/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers }
      }).catch(e => console.warn("[User Sync] Delete API failed:", e));

      addSystemLog("USER_DELETED", `User deleted: ${userToDelete.email} (${userToDelete.role})`, { 
        userId: id, 
        email: userToDelete.email, 
        role: userToDelete.role 
      }).catch(e => console.warn("[User Sync] Log failed:", e));
    } catch (err) {
      console.error("Error deleting user:", err);
    }
  }, [currentUser, users, addSystemLog]);

  const adminForceLogoutUser = useCallback(async (id: string) => {
    if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Super Admins can force logout users.");
    }
    try {
      await setDoc(doc(db, "users", id), { forceLogout: true }, { merge: true });
      await addSystemLog("USER_FORCE_LOGOUT", `Super Admin forced logout for user ID: ${id}`, { userId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const syncProjectAmounts = useCallback(async (projectId: string) => {
    if (!projectId) return;
    try {
      const projectRef = doc(db, "projects", projectId);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) return;
      const project = { id: projectSnap.id, ...projectSnap.data() } as Project;

      const reqSnap = await getDocs(collection(db, "requisitions"));
      const allReqs = reqSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Requisition));
      const projectReqs = getProjectRequisitions(project, allReqs);
      
      let spentSum = 0;
      let committedSum = 0;
      
      projectReqs.forEach((req) => {
        if (req.status === RequisitionStatus.DISBURSED) {
          spentSum += req.amount;
        }
        
        if ([
          RequisitionStatus.SUBMITTED,
          RequisitionStatus.APPROVED_L1,
          RequisitionStatus.APPROVED_L2,
          RequisitionStatus.ESCALATED,
          RequisitionStatus.DISBURSED
        ].includes(req.status)) {
          committedSum += req.amount;
        }
      });
      
      await updateDoc(projectRef, {
        spentAmount: spentSum,
        committedAmount: committedSum
      });
    } catch (err) {
      console.error("Error syncing project amounts:", err);
    }
  }, [db]);

  const sendEmailNotification = useCallback(async (
    req: Requisition, 
    status: string, 
    details?: string,
    approverName?: string,
    customRecipientEmail?: string,
    customRecipientName?: string
  ) => {
    let targetEmail = customRecipientEmail || req.requesterEmail;
    
    if (!targetEmail) {
      // Fallback: search in loaded users
      const user = users.find(u => u.id === req.requesterId || u.name === req.requesterName);
      if (user) targetEmail = user.email;
    }

    const isCustomPersonal = Boolean(customRecipientEmail);
    const notificationEmailsList = isCustomPersonal ? [] : (req.notificationEmails || []);

    if (!targetEmail && notificationEmailsList.length === 0) {
      console.log("Cannot send email: Requisition has no requesterEmail and no notificationEmails", req.id);
      return;
    }
    
    const origin = typeof window !== "undefined" && window.location?.origin 
      ? window.location.origin 
      : "https://stands-erequisitions.org";
    const requisitionUrl = `${origin}?reqId=${encodeURIComponent(req.id)}`;

    try {
      const resp = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetEmail || notificationEmailsList[0] || "",
          notificationEmails: notificationEmailsList,
          requesterName: customRecipientName || req.requesterName || "Requester",
          requesterEmail: req.requesterEmail || targetEmail,
          amount: req.amount,
          title: req.title,
          requisitionId: req.id,
          requisitionUrl: requisitionUrl,
          status: status,
          details: details,
          groupName: req.groupName || "General Ministry",
          description: req.description || "",
          payableTo: req.payableTo || "N/A",
          submittedAt: req.submittedAt || new Date().toISOString(),
          approverName: approverName || resolveSenderName(currentUser, users),
          approvalReason: details || ""
        })
      });

      const resData = await resp.json().catch(() => ({}));
      const isSimulated = resData?.simulated || !resData?.success;
      
      // Log to system audit trail
      await addSystemLog(
        isSimulated ? "EMAIL_SIMULATED" : "EMAIL_DISPATCH",
        `Email notification (${status}) sent to <${targetEmail || notificationEmailsList[0] || "recipient"}> regarding '${req.title}'`,
        {
          recipientEmail: targetEmail || notificationEmailsList[0] || "",
          recipientName: customRecipientName || req.requesterName,
          notificationEmails: notificationEmailsList,
          requisitionId: req.id,
          requisitionTitle: req.title,
          status: isSimulated ? "SIMULATED" : "DELIVERED",
          workflowStatus: status,
          amount: req.amount,
          simulated: isSimulated
        }
      ).catch(e => console.warn("[Email Notification] Audit log failed:", e));
    } catch (err) {
      console.error("Failed to trigger email notification:", err);
    }
  }, [users, currentUser, addSystemLog]);

  const addRequisition = useCallback(async (reqData: any) => {
    return withDbLoading("Submitting requisition to database...", async () => {
      if (!navigator.onLine) {
        throw new Error("Offline Mode: You are offline. All financial data is in read-only mode, and modifications/creations are currently locked.");
      }

      if (systemSettings?.fiscalYearStatus === "ARCHIVED") {
        throw new Error("This fiscal year is ARCHIVED. Creation or submission of new requisitions is blocked.");
      }

      if (!canPerform('canCreateRequisition')) {
        throw new Error("Permission Denied: You do not possess permission to initiate or submit requisitions.");
      }

    const id = `req-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiryDays = systemSettings?.requisitionExpiryDays ?? 7;
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000); // dynamic days from now

    // Requisition Limit Check: Every single requisition must be within the group's requisition limit
    const matchingProj = projects.find(p => p.id === reqData.projectId || p.groupId === reqData.groupId || p.name === reqData.groupName);
    if (matchingProj) {
      const requisitionLimit = matchingProj.requisitionLimit || matchingProj.allocatedBudget || 0;
      if (reqData.amount > requisitionLimit) {
        throw new Error(`Group is not allocated a budget : Requisition Limit Violation. This requisition amount of KES ${reqData.amount.toLocaleString()} exceeds the group's ('${matchingProj.name}') maximum requisition limit of KES ${requisitionLimit.toLocaleString()}.`);
      }
    }

    const newReq: Requisition = {
      ...reqData,
      id,
      requesterEmail: reqData.requesterEmail || currentUser?.email || "",
      status: reqData.status || RequisitionStatus.SUBMITTED,
      submittedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      escalationLevel: 0,
      approvalHistory: [],
      flaggedForAudit: reqData.flaggedForAudit !== undefined ? reqData.flaggedForAudit : false,
      fiscalYear: systemSettings.currentFiscalYear || 2026,
      attachments: safeNormalizeAttachments(reqData.attachments),
    };

    // OPTIMISTIC UPDATE: Instantly reflect new requisition in React state for zero UI delay
    setRequisitions(prev => [newReq, ...prev.filter(r => r.id !== id)]);

    if (isFirestoreQuotaExceeded()) {
      console.log("[Quota Fallback] Firestore Daily limits exceeded. Adding requisition local state.");
      addSystemLog("QUOTA_FALLBACK_ACTIVE", `Firestore daily write quota exceeded. Requisition '${newReq.title}' saved locally.`, {
        requisitionId: id,
        title: newReq.title,
        amount: newReq.amount,
        group: newReq.groupName
      }).catch(() => {});

      if (newReq.status === RequisitionStatus.SUBMITTED) {
        sendEmailNotification(newReq, "SUBMITTED").catch(() => {});
      }
      return newReq;
    }

    try {
      // Async database persistence
      await databaseService.saveRequisition(cleanFirestoreData(newReq));
      
      // Fire-and-forget non-blocking background tasks
      addSystemLog("REQUISITION_CREATED", `Requisition '${newReq.title}' created (amount KES ${newReq.amount.toLocaleString()})`, {
        requisitionId: id,
        title: newReq.title,
        amount: newReq.amount,
        group: newReq.groupName
      }).catch(() => {});
      
      if (newReq.status === RequisitionStatus.SUBMITTED) {
        sendEmailNotification(newReq, "SUBMITTED").catch(() => {});
      }
      
      if (newReq.projectId) {
        syncProjectAmounts(newReq.projectId).catch(() => {});
      }
      return newReq;
    } catch (err) {
      // Rollback optimistic state if persistence fails
      setRequisitions(prev => prev.filter(r => r.id !== id));
      handleFirestoreError(err, OperationType.CREATE, `requisitions/${id}`);
    }
    });
  }, [addSystemLog, systemSettings, projects, syncProjectAmounts, setRequisitions, withDbLoading]);

  const updateRequisitionStatus = useCallback(async (
    id: string, 
    status: RequisitionStatus, 
    decision: "APPROVE" | "REJECT" | "ESCALATE",
    note: string = "", 
    method: any = "CODE",
    rejectionReason?: string,
    approvalCode?: string
  ) => {
    return withDbLoading("Updating requisition approval status...", async () => {
      if (!navigator.onLine) {
        throw new Error("Offline Mode: You are offline. All financial data is in read-only mode, and status updates are currently locked.");
      }

      if (systemSettings?.fiscalYearStatus === "ARCHIVED") {
        throw new Error("This fiscal year is ARCHIVED. Approving or rejecting requisitions is blocked.");
      }

    const historyAction: ApprovalNote = cleanFirestoreData({
      id: `an-${Math.random().toString(36).substr(2, 9)}`,
      approverId: currentUser?.id || "sys",
      approverName: currentUser?.name || "System",
      role: currentUser?.role || UserRole.ADMIN,
      note,
      decision,
      rejectionReason,
      approvalCode, // In real app, this would be salted/hashed
      method,
      timestamp: new Date().toISOString(),
    });

    if (isFirestoreQuotaExceeded()) {
      console.log("[Quota Fallback] Firestore limits exceeded. Executing updateRequisitionStatus offline fallback.");
      const req = requisitions.find(r => r.id === id);
      if (!req) return;

      // Security check: Restricted approver can only approve requisitions of their affiliated groups
      const isRestrictedRole = currentUser?.role ? [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2].includes(currentUser.role) : false;
      if (isRestrictedRole) {
        const filterGroups = currentUser?.groups || [];
        const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUser?.group ? [currentUser.group] : []);
        const belongsToAffiliatedGroup = parsedGroups.includes(req.groupId) || parsedGroups.includes(req.groupName);
        if (!belongsToAffiliatedGroup) {
          throw new Error("Security Violation: You are not authorized to approve, reject, or modify requisitions for this church group.");
        }
      }

      const updates: any = {
        status,
        updatedAt: new Date().toISOString(),
        approvalHistory: [...req.approvalHistory, historyAction],
      };

      if (status === RequisitionStatus.APPROVED_L1) updates.approvedAtL1 = new Date().toISOString();
      if (status === RequisitionStatus.APPROVED_L2) updates.approvedAtL2 = new Date().toISOString();
      if (status === RequisitionStatus.DISBURSED) updates.disbursedAt = new Date().toISOString();

      const updatedReq: Requisition = {
        ...req,
        ...updates
      };

      setRequisitions(prev => prev.map(r => r.id === id ? updatedReq : r));

      addSystemLog("QUOTA_FALLBACK_ACTIVE", `Firestore write limits exceeded. Requisition '${req.title}' updated locally to status '${status}'.`, {
        requisitionId: id,
        newStatus: status
      }).catch(() => {});

      if (status === RequisitionStatus.APPROVED_L1 || status === RequisitionStatus.APPROVED_L2 || status === RequisitionStatus.DISBURSED || status === RequisitionStatus.REJECTED) {
         sendEmailNotification(
           updatedReq, 
           status, 
           decision === "REJECT" ? (rejectionReason || note) : note,
           currentUser?.name || currentUser?.email || "Reviewing Official"
         );
      }

      return;
    }

    try {
      const reqRef = doc(db, "requisitions", id);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const req = reqSnap.data() as Requisition;

      // Security check: Verify permission rights for specific workflow transitions
      if (status === RequisitionStatus.APPROVED_L1 && !canPerform('canApproveL1')) {
        throw new Error("Permission Denied: You do not possess Level 1 Approval Authority.");
      }
      if (status === RequisitionStatus.APPROVED_L2 && !canPerform('canApproveL2')) {
        throw new Error("Permission Denied: You do not possess Level 2 Approval Authority.");
      }
      if (status === RequisitionStatus.DISBURSED && !canPerform('canDisburse')) {
        throw new Error("Permission Denied: You do not possess Disbursement Authority.");
      }

      // Security check: Restricted approver can only approve requisitions of their affiliated groups
      const isRestrictedRole = currentUser?.role ? [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2].includes(currentUser.role) : false;
      if (isRestrictedRole) {
        const filterGroups = currentUser?.groups || [];
        const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUser?.group ? [currentUser.group] : []);
        const belongsToAffiliatedGroup = parsedGroups.includes(req.groupId) || parsedGroups.includes(req.groupName);
        if (!belongsToAffiliatedGroup) {
          throw new Error("Security Violation: You are not authorized to approve, reject, or modify requisitions for this church group.");
        }
      }

      // Check if financial books for this year are CLOSED
      const activeYear = systemSettings.currentFiscalYear || 2026;
      if (systemSettings.fiscalYearStatus === "CLOSED" && (status === RequisitionStatus.APPROVED_L1 || status === RequisitionStatus.APPROVED_L2 || status === RequisitionStatus.DISBURSED)) {
        throw new Error(`Forbidden: Financial books for the year ${activeYear} are CLOSED. No further approvals or disbursements can be processed until the next financial year is opened.`);
      }

      // Requisition limit enforcement for disburse and final L2 approval (per-request limit instead of cumulative budget limit)
      if (status === RequisitionStatus.DISBURSED || status === RequisitionStatus.APPROVED_L2) {
        if (req.projectId) {
          const projectRef = doc(db, "projects", req.projectId);
          const projectSnap = await getDoc(projectRef);
          if (projectSnap.exists()) {
            const projData = projectSnap.data();
            const requisitionLimit = projData.requisitionLimit || projData.allocatedBudget || 0;
            
            if (req.amount > requisitionLimit) {
              throw new Error(`Requisition Limit Violation: Action blocked. This requisition amount of KES ${req.amount.toLocaleString()} exceeds the group's ('${projData.name}') maximum requisition limit of KES ${requisitionLimit.toLocaleString()}.`);
            }
          }
        }
      }

      const updates: any = {
        status,
        updatedAt: new Date().toISOString(),
        approvalHistory: [...req.approvalHistory, historyAction],
      };

      if (status === RequisitionStatus.APPROVED_L1) updates.approvedAtL1 = new Date().toISOString();
      if (status === RequisitionStatus.APPROVED_L2) {
        updates.approvedAtL2 = new Date().toISOString();
        const alertId = `finance-l2-ready-${id}`;
        const newAlert = {
          id: alertId,
          type: "L2_APPROVED",
          severity: "HIGH",
          message: `ATTENTION FINANCE: Requisition '${req.title}' from ${req.groupName} has reached APPROVED L2 status. Please verify entries and initiate disbursement of KES ${req.amount.toLocaleString()}.`,
          timestamp: new Date().toISOString(),
          isRead: false,
          targetRole: UserRole.FINANCE
        };
        try {
          await setDoc(doc(db, "alerts", alertId), newAlert);
          addSystemLog("FINANCE_ALERT_TRIGGERED", `Automated alert dispatched to FINANCE team for L2 Approved requisition: '${req.title}'`, { requisitionId: id, alertId }).catch(() => {});
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `alerts/${alertId}`);
        }
      }
      if (status === RequisitionStatus.DISBURSED) {
        updates.disbursedAt = new Date().toISOString();

        // Auto-create transaction record for Web Transactions
        const txId = `tx-disb-${id}`;
        const transactionObj: Transaction = {
          id: txId,
          externalRef: `MPESA-DISB-${id.toUpperCase().replace(/^REQ-/, '')}`,
          sourceSystem: "PCE St. Andrews Disbursed Treasury",
          amount: req.amount,
          type: TransactionType.DEBIT,
          status: TransactionStatus.COMPLETED,
          description: `Disbursement: ${req.title}${req.payableTo ? ` (Payable to: ${req.payableTo})` : ''}`,
          category: req.groupName || "General Disbursed Fund",
          timestamp: updates.disbursedAt,
          performedBy: currentUser?.name || req.requesterName || "Finance Treasury",
          metadata: {
            requisitionId: req.id,
            payableTo: req.payableTo,
            groupId: req.groupId,
            isRealDisbursed: true
          }
        };

        // Optimistic update for transactions state
        setTransactions(prev => [transactionObj, ...prev.filter(t => t.id !== txId)]);

        // Asynchronous database write
        if (!skipFirestore && db) {
          setDoc(doc(db, "transactions", txId), cleanFirestoreData(transactionObj), { merge: true }).catch(() => {});
        }
      }

      const localReq = requisitions.find(r => r.id === id);
      const reqAttachments = safeNormalizeAttachments(req?.attachments);
      const localAttachments = safeNormalizeAttachments(localReq?.attachments);
      const finalAttachments = reqAttachments.length > 0 ? reqAttachments : localAttachments;

      const updatedReq = {
        ...localReq,
        ...req,
        attachments: finalAttachments,
        ...updates,
        id
      };

      // OPTIMISTIC UPDATE: Update React state immediately so UI updates instantly (0ms latency feel)
      setRequisitions(prev => prev.map(r => r.id === id ? updatedReq : r));

      // Asynchronous database write
      await updateDoc(reqRef, cleanFirestoreData(updates));
      await databaseService.saveRequisition(cleanFirestoreData(updatedReq));
      
      // Fire-and-forget background operations
      if (status === RequisitionStatus.APPROVED_L1 || status === RequisitionStatus.APPROVED_L2 || status === RequisitionStatus.DISBURSED || status === RequisitionStatus.REJECTED) {
         sendEmailNotification(
           updatedReq, 
           status, 
           decision === "REJECT" ? (rejectionReason || note) : note,
           currentUser?.name || currentUser?.email || "Reviewing Official"
         ).catch(() => {});
      }

      addSystemLog("STATUS_CHANGE", `Requisition '${req.title}' decision: ${decision} -> New Status: ${status}`, {
        requisitionId: id,
        title: req.title,
        previousStatus: req.status,
        newStatus: status,
        decision,
        note
      }).catch(() => {});

      if (req.projectId) {
        syncProjectAmounts(req.projectId).catch(() => {});
      }

      if (status === RequisitionStatus.APPROVED_L2 || (req.status !== RequisitionStatus.APPROVED_L2 && status === RequisitionStatus.DISBURSED)) {
         getDocs(query(collection(db, "ledger_books"), where("ministryName", "==", req.groupName))).then(ledgerQuerySnap => {
           if (!ledgerQuerySnap.empty) {
             const ledgerDoc = ledgerQuerySnap.docs[0];
             updateDoc(ledgerDoc.ref, {
               spentAmount: (ledgerDoc.data().spentAmount || 0) + req.amount
             }).catch(() => {});
           }
         }).catch(() => {});
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requisitions/${id}`);
    }
    });
  }, [currentUser, addSystemLog, systemSettings, syncProjectAmounts, setRequisitions, withDbLoading]);

  const enrollBiometric = useCallback((enabled: boolean = true) => {
    setBiometricEnrolled(enabled);
  }, []);

  const deleteRequisition = useCallback(async (id: string, reason?: string) => {
    const targetReq = requisitions.find(r => r.id === id);
    const isOwnerOfDraft = targetReq?.status === RequisitionStatus.DRAFT && (targetReq?.requesterId === currentUser?.id || targetReq?.requesterEmail === currentUser?.email);
    if (!canPerform('canDeleteRequisition') && !isOwnerOfDraft) {
      throw new Error("Permission Denied: You do not have permission to delete requisitions from the ledger.");
    }

    // OPTIMISTIC DELETE: Immediately remove from UI
    setRequisitions(prev => prev.filter(r => r.id !== id));

    return withDbLoading("Deleting requisition from database...", async () => {
      if (!navigator.onLine) {
        if (targetReq) setRequisitions(prev => [targetReq, ...prev]);
        throw new Error("Offline Mode: You are offline. Deleting requisitions is locked.");
      }

      try {
        const reqRef = doc(db, "requisitions", id);
        const reqSnap = await getDoc(reqRef);
        let reqToDelete = targetReq;
        if (reqSnap.exists()) {
          const docData = { id: reqSnap.id, ...reqSnap.data() } as Requisition;
          reqToDelete = reqToDelete ? { ...docData, ...reqToDelete } : docData;
        }

        const projectId = reqToDelete?.projectId || (reqSnap.exists() ? (reqSnap.data() as Requisition).projectId : null);

        await databaseService.deleteRequisition(id);
        addSystemLog("REQUISITION_DELETED", `Requisition ID '${id}' deleted`, { requisitionId: id }).catch(() => {});

        if (reqToDelete) {
          sendEmailNotification(
            reqToDelete, 
            "DELETED", 
            reason || "Requisition has been deleted from the portal", 
            currentUser?.name || currentUser?.email || "Reviewing Official"
          ).catch(() => {});
        }

        if (projectId) {
          syncProjectAmounts(projectId).catch(() => {});
        }
      } catch (err) {
        if (targetReq) setRequisitions(prev => [targetReq, ...prev]);
        handleFirestoreError(err, OperationType.DELETE, `requisitions/${id}`);
      }
    });
  }, [requisitions, setRequisitions, addSystemLog, syncProjectAmounts, sendEmailNotification, currentUser, withDbLoading]);

  const updateRequisition = useCallback(async (id: string, updates: Partial<Requisition>) => {
    return withDbLoading("Saving requisition changes...", async () => {
      if (!navigator.onLine) {
        throw new Error("Offline Mode: You are offline. All financial data is in read-only mode, and modifications are currently locked.");
      }

      if (systemSettings?.fiscalYearStatus === "ARCHIVED") {
        throw new Error("This fiscal year is ARCHIVED. Editing requisitions is blocked.");
      }

    if (isFirestoreQuotaExceeded()) {
      console.log("[Quota Fallback] Firestore limits exceeded. Executing updateRequisition offline fallback.");
      const currentReq = requisitions.find(r => r.id === id);
      if (!currentReq) return;

      const newAmount = updates.amount !== undefined ? updates.amount : currentReq.amount;
      const cleanedUpdates = {
        ...updates,
        updatedAt: new Date().toISOString(),
        flaggedForAudit: updates.flaggedForAudit !== undefined ? updates.flaggedForAudit : (currentReq.flaggedForAudit || false)
      };

      const updatedReq: Requisition = {
        ...currentReq,
        ...cleanedUpdates
      };

      setRequisitions(prev => prev.map(r => r.id === id ? updatedReq : r));

      addSystemLog("QUOTA_FALLBACK_ACTIVE", `Firestore write limits exceeded. Requisition '${id}' edited locally.`, {
        requisitionId: id,
        updates
      }).catch(() => {});

      if (updates.status === RequisitionStatus.SUBMITTED && currentReq.status !== RequisitionStatus.SUBMITTED) {
        sendEmailNotification(updatedReq, "SUBMITTED").catch(() => {});
      }

      return;
    }

    try {
      let updatedReq: Requisition | undefined;

      setRequisitions(prev => {
        const currentReq = prev.find(r => r.id === id);
        if (currentReq) {
          const cleanedUpdates = {
            ...updates,
            updatedAt: new Date().toISOString(),
            flaggedForAudit: updates.flaggedForAudit !== undefined ? updates.flaggedForAudit : (currentReq.flaggedForAudit || false)
          };
          if (updates.attachments) {
            cleanedUpdates.attachments = safeNormalizeAttachments(updates.attachments);
          }
          updatedReq = { ...currentReq, ...cleanedUpdates };
          return prev.map(r => r.id === id ? updatedReq! : r);
        }
        return prev;
      });

      if (!updatedReq) {
        try {
          const res = await fetch(`/api/db/requisitions/${id}`);
          if (res.ok) {
            const dbReq = await res.json();
            if (dbReq && dbReq.id) {
              const camelReq = mapSnakeToCamel(dbReq);
              const cleanedUpdates = {
                ...updates,
                updatedAt: new Date().toISOString()
              };
              if (updates.attachments) {
                cleanedUpdates.attachments = safeNormalizeAttachments(updates.attachments);
              }
              updatedReq = {
                ...camelReq,
                ...cleanedUpdates,
                id
              } as Requisition;
              setRequisitions(prev => [updatedReq!, ...prev.filter(r => r.id !== id)]);
            }
          }
        } catch (e) {
          console.warn("Failed to fetch requisition for update:", e);
        }
      }

      if (!updatedReq) return;
      
      await databaseService.saveRequisition(cleanFirestoreData(updatedReq));

      if (!skipFirestore && db) {
        try {
          const reqRef = doc(db, "requisitions", id);
          await updateDoc(reqRef, cleanFirestoreData(updates));
        } catch (fErr) {
          console.log("[Firestore Sync] updateDoc failed or skipped:", fErr);
        }
      }

      await addSystemLog("REQUISITION_EDITED", `Requisition '${id}' updated`, { requisitionId: id, updates });

      if (updates.status === RequisitionStatus.SUBMITTED && updatedReq.status === RequisitionStatus.SUBMITTED) {
        sendEmailNotification(updatedReq, "SUBMITTED").catch(() => {});
      }

      if (updatedReq.projectId) {
        await syncProjectAmounts(updatedReq.projectId);
      }
    } catch (err) {
      console.error("[updateRequisition Error]:", err);
    }
    });
  }, [addSystemLog, db, systemSettings, syncProjectAmounts, requisitions, setRequisitions, withDbLoading]);

  const startBackgroundUploadTask = useCallback((params: {
    title: string;
    files: string[];
    requisitionId?: string;
    onComplete?: (uploadedUrls: string[]) => Promise<void> | void;
  }): string => {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const totalCount = params.files.length;

    const newTask: BackgroundUploadTask = {
      id: taskId,
      requisitionId: params.requisitionId,
      title: params.title,
      totalFiles: totalCount,
      completedFiles: 0,
      currentFileName: totalCount > 0 ? "Preparing attachments..." : "Done",
      progressPercent: 0,
      status: "UPLOADING",
      startedAt: new Date().toISOString()
    };

    setActiveUploadTasks(prev => [newTask, ...prev]);

    (async () => {
      try {
        const uploadedUrls = await uploadAttachmentsToLocalServer(params.files, (completed, total, currentFile) => {
          setActiveUploadTasks(prev => prev.map(task => {
            if (task.id === taskId) {
              const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
              return {
                ...task,
                completedFiles: completed,
                progressPercent: percent,
                currentFileName: currentFile || "Processing..."
              };
            }
            return task;
          }));
        });

        if (params.onComplete) {
          await params.onComplete(uploadedUrls);
        }

        setActiveUploadTasks(prev => prev.map(task => {
          if (task.id === taskId) {
            return {
              ...task,
              completedFiles: totalCount,
              progressPercent: 100,
              currentFileName: "Upload complete",
              status: "COMPLETED"
            };
          }
          return task;
        }));

        await addSystemLog("BACKGROUND_UPLOAD_SUCCESS", `Completed uploading ${totalCount} files for ${params.title}`, { taskId, requisitionId: params.requisitionId });
      } catch (err: any) {
        console.error("[Background Upload Failed]:", err);
        setActiveUploadTasks(prev => prev.map(task => {
          if (task.id === taskId) {
            return {
              ...task,
              status: "FAILED",
              error: err?.message || "Failed to process attachments"
            };
          }
          return task;
        }));

        triggerToast({
          type: "SECURITY_UPDATE",
          severity: "HIGH",
          message: `Background upload failed for ${params.title}: ${err?.message || "Error processing files"}`,
          timestamp: new Date().toISOString()
        });
      }
    })();

    return taskId;
  }, [triggerToast, addSystemLog]);

  const cancelBackgroundUploadTask = useCallback((taskId: string) => {
    setActiveUploadTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const clearCompletedUploadTasks = useCallback(() => {
    setActiveUploadTasks(prev => prev.filter(t => t.status === "UPLOADING" || t.status === "QUEUED"));
  }, []);

  const uploadReceipts = useCallback(async (id: string, newReceipts: string[]) => {
    try {
      const existingReq = requisitions.find(r => r.id === id);
      if (existingReq && existingReq.status !== RequisitionStatus.DISBURSED) {
        triggerToast({
          type: "SECURITY_UPDATE",
          severity: "MEDIUM",
          message: "Receipts can only be attached after all approvals are confirmed and disbursement is done.",
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!newReceipts || newReceipts.length === 0) return;

      const reqTitle = existingReq?.title || `Requisition ${id}`;

      startBackgroundUploadTask({
        title: `Receipts for ${reqTitle}`,
        requisitionId: id,
        files: newReceipts,
        onComplete: async (uploadedReceipts) => {
          if (!skipFirestore && db) {
            const reqRef = doc(db, "requisitions", id);
            const reqSnap = await getDoc(reqRef);
            if (reqSnap.exists()) {
              const data = reqSnap.data() as Requisition;
              const currentReceipts = data.receipts || [];
              const updatedReceipts = [...currentReceipts, ...uploadedReceipts];
              const updatedAt = new Date().toISOString();
              await updateDoc(reqRef, { receipts: updatedReceipts, updatedAt });
              setRequisitions(prev => prev.map(r => r.id === id ? { ...r, receipts: updatedReceipts, updatedAt } : r));
              await addSystemLog("RECEIPTS_UPLOADED", `Uploaded ${newReceipts.length} receipts to Requisition ID: ${id}`, { requisitionId: id, currentReceiptCount: updatedReceipts.length });
              return;
            }
          }

          const updatedAt = new Date().toISOString();
          setRequisitions(prev => prev.map(r => {
            if (r.id === id) {
              const currentReceipts = r.receipts || [];
              return { ...r, receipts: [...currentReceipts, ...uploadedReceipts], updatedAt };
            }
            return r;
          }));
          await addSystemLog("RECEIPTS_UPLOADED", `Uploaded ${newReceipts.length} receipts to Requisition ID: ${id}`, { requisitionId: id });
        }
      });

      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: `Receipt upload started in the background (${newReceipts.length} file(s)).`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requisitions/${id}`);
    }
  }, [addSystemLog, db, requisitions, setRequisitions, skipFirestore, startBackgroundUploadTask, triggerToast]);

  const clearWebTransactions = useCallback(async () => {
    return withDbLoading("Clearing web transactions from database...", async () => {
      try {
        if (!skipFirestore && db) {
          const snap = await getDocs(collection(db, "transactions"));
          const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
        }
        setTransactions([]);
        await addSystemLog("WEB_TRANSACTIONS_CLEARED", "Cleared web transaction records from the database.");
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "LOW",
          message: "All web transactions have been cleared successfully.",
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error clearing web transactions:", err);
      }
    });
  }, [db, skipFirestore, addSystemLog, triggerToast, withDbLoading]);

  const syncRealDisbursedTransactions = useCallback(async (): Promise<number> => {
    return withDbLoading("Storing disbursed funds transactions on website...", async () => {
      try {
        const disbursedReqs = requisitions.filter(r => r.status === RequisitionStatus.DISBURSED);
        const realTxs: Transaction[] = disbursedReqs.map(req => {
          const txId = `tx-disb-${req.id}`;
          return {
            id: txId,
            externalRef: `MPESA-DISB-${req.id.toUpperCase().replace(/^REQ-/, '')}`,
            sourceSystem: "PCE St. Andrews Disbursed Treasury",
            amount: req.amount,
            type: TransactionType.DEBIT,
            status: TransactionStatus.COMPLETED,
            description: `Disbursement: ${req.title}${req.payableTo ? ` (Payable to: ${req.payableTo})` : ''}`,
            category: req.groupName || "General Disbursed Fund",
            timestamp: req.disbursedAt || req.updatedAt || req.submittedAt || new Date().toISOString(),
            performedBy: req.requesterName || "Finance Treasury",
            metadata: {
              requisitionId: req.id,
              payableTo: req.payableTo,
              groupId: req.groupId,
              groupName: req.groupName,
              amountWords: req.amountWords,
              isRealDisbursed: true
            }
          };
        });

        if (!skipFirestore && db && realTxs.length > 0) {
          for (const tx of realTxs) {
            await setDoc(doc(db, "transactions", tx.id), tx, { merge: true });
          }
        }

        realTxs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setTransactions(realTxs);

        await addSystemLog("REAL_TRANSACTIONS_STORED", `Stored ${realTxs.length} disbursed funds transaction details on the website.`, { count: realTxs.length });

        triggerToast({
          type: "FINANCE_DISBURSEMENT",
          severity: "LOW",
          message: `Successfully synchronized and stored ${realTxs.length} disbursed funds transaction detail(s).`,
          timestamp: new Date().toISOString()
        });

        return realTxs.length;
      } catch (err) {
        console.error("Error syncing disbursed transactions:", err);
        return 0;
      }
    });
  }, [requisitions, db, skipFirestore, addSystemLog, triggerToast, withDbLoading]);

  const markAlertAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, "alerts", id), { isRead: true });
      await addSystemLog("ALERT_READ", `Alert ID '${id}' marked as read`, { alertId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `alerts/${id}`);
    }
  }, [addSystemLog]);

  const addAlert = useCallback(async (alertData: Omit<BudgetAlert, "id" | "isRead" | "timestamp">) => {
    try {
      const alertId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newAlert: BudgetAlert = {
        ...alertData,
        id: alertId,
        isRead: false,
        timestamp: new Date().toISOString()
      };
      await setDoc(doc(db, "alerts", alertId), newAlert);
      await addSystemLog("ALERT_CREATE", `Created notification alert: ${alertId}`, { alertId });
    } catch (err) {
      console.error("Failed to add alert:", err);
      throw err;
    }
  }, [db, addSystemLog]);

  const deleteAlert = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, "alerts", id));
      await addSystemLog("ALERT_DELETE", `Deleted system notification: ${id}`, { alertId: id });
    } catch (err) {
      console.error("Failed to delete alert:", err);
      throw err;
    }
  }, [db, addSystemLog]);

  const updateThreshold = useCallback(async (id: string, updates: Partial<AlertThreshold>) => {
    try {
      await updateDoc(doc(db, "thresholds", id), updates);
      await addSystemLog("THRESHOLD_UPDATED", `Budget threshold ID '${id}' updated`, { thresholdId: id, updates });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `thresholds/${id}`);
    }
  }, [addSystemLog]);

  const saveReport = useCallback(async (reportData: any) => {
    if (!currentUser) return;
    const id = `rep-${Date.now()}`;
    const report: SavedReport = {
      ...reportData,
      id,
      timestamp: new Date().toISOString(),
      generatedBy: currentUser.name,
      generatedById: currentUser.id
    };
    try {
      await setDoc(doc(db, "reports", id), report);
      await addSystemLog("REPORT_SAVED", `Audit report saved: ${report.title}`, { reportId: id, title: report.title, period: report.period });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${id}`);
    }
  }, [currentUser, addSystemLog]);

  // Defensive deduplication to avoid "duplicate key" React warnings from backend data sync
  const uniqueRequisitions = React.useMemo(() => {
    const seen = new Set<string>();
    return requisitions.filter(r => {
      if (!r || !r.id) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [requisitions]);

  const uniqueProjects = React.useMemo(() => {
    const seen = new Set<string>();
    return projects.filter(p => {
      if (!p || !p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [projects]);

  const uniqueAlerts = React.useMemo(() => {
    const seen = new Set<string>();
    return alerts.filter(a => {
      if (!a || !a.id) return false;
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [alerts]);

  const uniqueThresholds = React.useMemo(() => {
    const seen = new Set<string>();
    return thresholds.filter(t => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [thresholds]);

  const uniqueChurchGroups = React.useMemo(() => {
    const seen = new Set<string>();
    return churchGroups.filter(cg => {
      if (!cg || !cg.id) return false;
      if (seen.has(cg.id)) return false;
      seen.add(cg.id);
      return true;
    });
  }, [churchGroups]);

  const uniqueActiveToasts = React.useMemo(() => {
    const seen = new Set<string>();
    return activeToasts.filter(t => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [activeToasts]);

  const uniqueLedgerBooks = React.useMemo(() => {
    const seen = new Set<string>();
    return ledgerBooks.filter(lb => {
      if (!lb || !lb.id) return false;
      if (seen.has(lb.id)) return false;
      seen.add(lb.id);
      return true;
    });
  }, [ledgerBooks]);

  const sendBulkEmail = useCallback(async (subject: string, content: string, recipients?: string[]) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/send-bulk-email", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ subject, content, recipients })
      });
      const responseText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server returned non-JSON response (${response.status}): ${responseText.slice(0, 300)}`);
      }
      if (!response.ok) {
        throw new Error(data.error || `Bulk email dispatch failed with status: ${response.status}`);
      }
      return data;
    } catch (err: any) {
      console.error("Failed to trigger bulk email newsletter:", err);
      throw err;
    }
  }, []);

  const addCustomCalendarEvent = useCallback(async (event: Omit<CustomCalendarEvent, "id" | "createdAt" | "createdBy">) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      alert("Unauthorized: Only Admin or Super Admin can create calendar events.");
      return;
    }
    const newEvent: CustomCalendarEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdBy: currentUser.name || currentUser.email || "Admin",
      createdAt: new Date().toISOString()
    };
    setCustomCalendarEvents(prev => [newEvent, ...prev]);
    await addSystemLog("CALENDAR_EVENT_CREATED", `Custom calendar event '${event.title}' scheduled for ${event.date}`, { eventId: newEvent.id });
  }, [currentUser, addSystemLog]);

  const updateCustomCalendarEvent = useCallback(async (id: string, updates: Partial<CustomCalendarEvent>) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      alert("Unauthorized: Only Admin or Super Admin can update calendar events.");
      return;
    }
    setCustomCalendarEvents(prev => prev.map(evt => evt.id === id ? { ...evt, ...updates } : evt));
    await addSystemLog("CALENDAR_EVENT_UPDATED", `Updated calendar event ID: ${id}`, { updates });
  }, [currentUser, addSystemLog]);

  const deleteCustomCalendarEvent = useCallback(async (id: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      alert("Unauthorized: Only Admin or Super Admin can delete calendar events.");
      return;
    }
    setCustomCalendarEvents(prev => prev.filter(evt => evt.id !== id));
    await addSystemLog("CALENDAR_EVENT_DELETED", `Deleted calendar event ID: ${id}`);
  }, [currentUser, addSystemLog]);

  const uniqueUsers = React.useMemo(() => {
    const seen = new Set<string>();
    return users.filter(u => {
      if (!u || !u.id) return false;
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [users]);

  const uniqueFiscalYears = React.useMemo(() => {
    const seen = new Set<string>();
    return fiscalYears.filter(fy => {
      if (!fy || !fy.id) return false;
      if (seen.has(fy.id)) return false;
      seen.add(fy.id);
      return true;
    });
  }, [fiscalYears]);

  const uniqueVendors = React.useMemo(() => {
    const seen = new Set<string>();
    return vendors.filter(v => {
      if (!v || !v.id) return false;
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [vendors]);

  const uniqueTransactions = React.useMemo(() => {
    const seen = new Set<string>();
    const txList: Transaction[] = [];

    // Add state transactions
    transactions.forEach(t => {
      if (t && t.id && !seen.has(t.id)) {
        seen.add(t.id);
        txList.push(t);
      }
    });

    // Auto derive transactions for any DISBURSED requisition
    requisitions.filter(r => r.status === RequisitionStatus.DISBURSED).forEach(req => {
      const txId = `tx-disb-${req.id}`;
      if (!seen.has(txId)) {
        seen.add(txId);
        txList.push({
          id: txId,
          externalRef: `MPESA-DISB-${req.id.toUpperCase().replace(/^REQ-/, '')}`,
          sourceSystem: "PCE St. Andrews Disbursed Treasury",
          amount: req.amount,
          type: TransactionType.DEBIT,
          status: TransactionStatus.COMPLETED,
          description: `Disbursement: ${req.title}${req.payableTo ? ` (Payable to: ${req.payableTo})` : ''}`,
          category: req.groupName || "General Disbursed Fund",
          timestamp: req.disbursedAt || req.updatedAt || req.submittedAt || new Date().toISOString(),
          performedBy: req.requesterName || "Finance Treasury",
          metadata: {
            requisitionId: req.id,
            payableTo: req.payableTo,
            groupId: req.groupId,
            isRealDisbursed: true
          }
        });
      }
    });

    // Filter web transactions to strictly ONLY contain disbursed funds
    return txList.filter(t => t.status === TransactionStatus.COMPLETED || t.metadata?.isRealDisbursed || t.id.startsWith("tx-disb-"));
  }, [transactions, requisitions]);

  const uniqueReports = React.useMemo(() => {
    const seen = new Set<string>();
    return reports.filter(rep => {
      if (!rep || !rep.id) return false;
      if (seen.has(rep.id)) return false;
      seen.add(rep.id);
      return true;
    });
  }, [reports]);

  return (
    <RequisitionContext.Provider value={{
      requisitions: uniqueRequisitions,
      projects: uniqueProjects,
      alerts: uniqueAlerts,
      thresholds: uniqueThresholds,
      forecastData,
      currentUser,
      users: uniqueUsers,
      loading,
      authLoading,
      isDbSaving,
      dbSavingMessage,
      churchGroups: uniqueChurchGroups,
      lastGroupsSync,
      addChurchGroup,
      deleteChurchGroup,
      ledgerBooks: uniqueLedgerBooks,
      createLedgerBook,
      updateLedgerBookBudget,
      biometricEnrolled,
      enrollBiometric,
      login,
      loginWithEmail,
      signupWithEmail,
      logout,
      addRequisition,
      updateRequisition,
      sendEmailNotification,
      updateRequisitionStatus,
      uploadReceipts,
      deleteRequisition,
      markAlertAsRead,
      addAlert,
      updateThreshold,
      approveUser,
      suspendUser,
      updateUserRole,
      updateUserProfile,
      updateCurrentUserPassword,
      adminRegisterUser,
      adminResetUserPassword,
      deleteUser,
      adminForceLogoutUser,
      systemSettings,
      updateSystemSettings,
      allocateBudgetForGroup,
      updateProjectBudget,
      deleteProject,
      closeFinancialYear,
      openFinancialYear,
      supplementaryRequests,
      applySupplementaryBudget,
      vendors: uniqueVendors,
      addVendor,
      updateVendor,
      deleteVendor,
      systemLogs,
      addSystemLog,
      systemLogLimit,
      setSystemLogLimit,
      seedAllEcosystemData,
      reports: uniqueReports,
      saveReport,
      globalSearchTerm,
      setGlobalSearchTerm,
      searchFilter,
      setSearchFilter,
      advancedSearchActive,
      setAdvancedSearchActive,
      advancedDateRangePreset,
      setAdvancedDateRangePreset,
      advancedCustomStartDate,
      setAdvancedCustomStartDate,
      advancedCustomEndDate,
      setAdvancedCustomEndDate,
      advancedBudgetLine,
      setAdvancedBudgetLine,
      activeToasts: uniqueActiveToasts,
      removeToast,
      triggerToast,
      readNoticeIds,
      toggleNoticeRead,
      markAllNoticesRead,
      permissionConfigs,
      canAccess,
      canPerform,
      updateRolePermissions,
      deleteAlert,
      transactions: uniqueTransactions,
      clearWebTransactions,
      syncRealDisbursedTransactions,
      fiscalYears: uniqueFiscalYears,
      createFiscalYear,
      updateFiscalYearDates,
      deleteFiscalYear,
      toggleFiscalYearStatus,
      setActiveFiscalYear,
      cloneFiscalYearBudgets,
      firestoreQuotaExceeded,
      setFirestoreQuotaExceeded,
      setSyncTargets,
      syncingTargets,
      sendBulkEmail,
      customCalendarEvents,
      addCustomCalendarEvent,
      updateCustomCalendarEvent,
      deleteCustomCalendarEvent,
      selectedRequisition,
      setSelectedRequisition,
      activeUploadTasks,
      startBackgroundUploadTask,
      cancelBackgroundUploadTask,
      clearCompletedUploadTasks
    }}>
      {children}
    </RequisitionContext.Provider>
  );
};


export const useRequisitions = () => {
  const context = useContext(RequisitionContext);
  if (context === undefined) {
    throw new Error("useRequisitions must be used within a RequisitionProvider");
  }
  return context;
};

export const useActiveFiscalYear = () => {
  const { systemSettings } = useRequisitions();
  const year = systemSettings?.currentFiscalYear;
  return {
    year: year || null,
    isLoading: !year,
  };
};

export const getActiveFiscalYear = () => {
  const { systemSettings } = useRequisitions();
  return systemSettings?.currentFiscalYear || 2026;
};


