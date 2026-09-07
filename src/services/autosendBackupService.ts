/**
 * Autosend Backup & Disaster Recovery Service
 * Automatically compiles system database snapshots into AES-256-GCM encrypted JSON files,
 * supports Disaster Recovery verification, restoration, and email attachments.
 * Default Target Recipient: geeshau.standsmedia@gmail.com
 */

export const AUTOSEND_DEFAULT_EMAIL = "geeshau.standsmedia@gmail.com";

export type BackupFrequency = "WEEKLY" | "MONTHLY" | "EVERY_5_DAYS" | "DAILY" | "5-HOURS";

export interface BackupTargetFeatures {
  sendEmail: boolean;
  saveServerDiskSnapshot: boolean;
  includeAuditLogs: boolean;
  includeCalendarAndLedger: boolean;
  slackAlertEnabled: boolean;
  slackWebhookUrl?: string;
}

export interface BackupEmailLog {
  id: string;
  timestamp: string;
  targetEmail: string;
  fileName: string;
  sizeKb: number;
  status: "DELIVERED" | "SENT_ATTACHMENT" | "SIMULATED_LOCAL_STORE" | "FAILED";
  warning?: string | null;
  isEncrypted?: boolean;
  algorithm?: string;
  checksumSha256?: string;
  triggerType?: "MANUAL" | "SCHEDULED" | "SCHEDULED_WEEKLY" | "SCHEDULED_MONTHLY" | "SCHEDULED_5_DAYS";
  summary?: {
    totalRequisitions: number;
    totalUsers: number;
    totalProjects: number;
    totalGroups: number;
  };
}

export interface AutosendConfig {
  targetEmail: string;
  enabled: boolean;
  frequency: BackupFrequency;
  scheduleTime: string; // HH:mm e.g. "04:00"
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  dayOfMonth: number; // 1..31
  lastSentTimestamp: string | null;
  totalBackupsSent: number;
  encryptionEnabled?: boolean;
  encryptionAlgorithm?: string;
  backupPassphrase?: string;
  features: BackupTargetFeatures;
}

export interface DisasterRecoveryReadiness {
  score: number;
  grade: "A+" | "A" | "B" | "C";
  encryptionActive: boolean;
  encryptionAlgorithm: string;
  rpoTarget: string;
  rpoCurrentHours: number | null;
  rtoTarget: string;
  totalAvailableSnapshots: number;
  totalSnapshotStorageKb: number;
  lastBackupTimestamp: string | null;
  nextScheduledRun: string | null;
  activeCollectionsSummary: {
    requisitions: number;
    users: number;
    groups: number;
    ledgers: number;
  };
  storageLocation: string;
}

export interface DisasterRecoverySnapshot {
  fileName: string;
  sizeKb: number;
  createdAt: string;
  isEncrypted: boolean;
  algorithm: string;
  checksumSha256: string;
  summary?: {
    totalRequisitions?: number;
    totalUsers?: number;
    totalProjects?: number;
    totalGroups?: number;
    totalLedgers?: number;
  };
  createdVia?: string;
}

export interface BackupVerificationResult {
  success: boolean;
  verified: boolean;
  error?: string;
  summary?: {
    timestamp: string;
    version: string;
    encryptionStandard: string;
    checksumVerified: boolean;
    counts: {
      requisitions: number;
      users: number;
      churchGroups: number;
      projects: number;
      ledgerBooks: number;
      systemLogs: number;
      calendarEvents: number;
      fiscalYears: number;
      vendors: number;
    };
    hasSettings: boolean;
  };
}

const LOCAL_STORAGE_LOGS_KEY = "st_andrews_autosend_email_backup_logs";
const LOCAL_STORAGE_CONFIG_KEY = "st_andrews_autosend_email_backup_config";

export const DEFAULT_BACKUP_FEATURES: BackupTargetFeatures = {
  sendEmail: true,
  saveServerDiskSnapshot: true,
  includeAuditLogs: true,
  includeCalendarAndLedger: true,
  slackAlertEnabled: false,
  slackWebhookUrl: ""
};

export const generateBackupPayload = (contextData: any) => {
  return {
    timestamp: new Date().toISOString(),
    version: "4.2.0",
    targetAccount: "ict.team@pceastandrews.org",
    encryptionStandard: "AES-256-GCM",
    systemSettings: contextData.systemSettings || {},
    users: contextData.users || [],
    requisitions: contextData.requisitions || [],
    projects: contextData.projects || [],
    churchGroups: contextData.churchGroups || [],
    ledgerBooks: contextData.ledgerBooks || [],
    systemLogs: contextData.systemLogs || [],
    customCalendarEvents: contextData.customCalendarEvents || [],
    supplementaryRequests: contextData.supplementaryRequests || [],
    summary: {
      totalRequisitions: (contextData.requisitions || []).length,
      totalUsers: (contextData.users || []).length,
      totalProjects: (contextData.projects || []).length,
      totalGroups: (contextData.churchGroups || []).length,
      totalLedgers: (contextData.ledgerBooks || []).length
    }
  };
};

/**
 * Client-Side AES-256-GCM Encryption using Web Crypto API
 */
export const encryptBackupPayloadClient = async (
  rawPayload: any,
  passphrase?: string
): Promise<{ envelope: any; jsonStr: string; checksumSha256: string }> => {
  const secret = (passphrase && passphrase.trim().length > 0)
    ? passphrase.trim()
    : "STANDS_PCEA_EREQS_MASTER_SECURE_KEY_2026";

  const plaintextStr = typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload, null, 2);
  const enc = new TextEncoder();

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  // SHA-256 checksum of raw plaintext
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", enc.encode(plaintextStr));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const checksumSha256 = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  const additionalData = enc.encode("STANDS_PCEA_DISASTER_RECOVERY_ENCRYPTION");
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      additionalData: additionalData,
      tagLength: 128
    },
    key,
    enc.encode(plaintextStr)
  );

  const cipherBytes = new Uint8Array(ciphertextBuffer);
  // Separate ciphertext and 16-byte auth tag at the end of Web Crypto AES-GCM output
  const tagBytes = cipherBytes.slice(cipherBytes.length - 16);
  const dataBytes = cipherBytes.slice(0, cipherBytes.length - 16);

  // Convert binary to base64
  let binary = "";
  for (let i = 0; i < dataBytes.length; i++) {
    binary += String.fromCharCode(dataBytes[i]);
  }
  const ciphertextBase64 = window.btoa(binary);

  const envelope = {
    format: "STANDS_AES_256_GCM",
    version: "1.0.0",
    algorithm: "AES-256-GCM",
    timestamp: new Date().toISOString(),
    keyDerivation: {
      kdf: "PBKDF2",
      hash: "SHA-256",
      iterations: 100000,
      saltHex: Array.from(salt).map(b => b.toString(16).padStart(2, "0")).join("")
    },
    ivHex: Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join(""),
    authTagHex: Array.from(tagBytes).map(b => b.toString(16).padStart(2, "0")).join(""),
    checksumSha256,
    ciphertextBase64,
    metadata: {
      unencryptedSizeKb: Math.round(plaintextStr.length / 1024),
      summary: rawPayload?.summary,
      isEncrypted: true,
      createdVia: "CLIENT_BROWSER_WEB_CRYPTO"
    }
  };

  const jsonStr = JSON.stringify(envelope, null, 2);
  return { envelope, jsonStr, checksumSha256 };
};

export const downloadBackupLocally = async (backupPayload: any, encrypt: boolean = true, passphrase?: string) => {
  let fileContent: string;
  let fileExtension = "json";

  if (encrypt) {
    try {
      const encrypted = await encryptBackupPayloadClient(backupPayload, passphrase);
      fileContent = encrypted.jsonStr;
      fileExtension = "enc.json";
    } catch (e) {
      console.warn("Client encryption fallback to plain JSON:", e);
      fileContent = JSON.stringify(backupPayload, null, 2);
    }
  } else {
    fileContent = JSON.stringify(backupPayload, null, 2);
  }

  const blob = new Blob([fileContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  a.href = url;
  a.download = `PCEA_St_Andrews_Backup_${dateStr}.${fileExtension}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getLocalAutosendConfig = (): AutosendConfig => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        targetEmail: AUTOSEND_DEFAULT_EMAIL,
        enabled: true,
        frequency: "WEEKLY",
        scheduleTime: "04:00",
        dayOfWeek: 5, // Friday
        dayOfMonth: 1, // 1st
        lastSentTimestamp: null,
        totalBackupsSent: 0,
        encryptionEnabled: true,
        encryptionAlgorithm: "AES-256-GCM",
        backupPassphrase: "",
        ...parsed,
        features: {
          ...DEFAULT_BACKUP_FEATURES,
          ...(parsed?.features || {})
        }
      };
    }
  } catch (e) {
    console.error("Error reading local autosend config:", e);
  }
  return {
    targetEmail: AUTOSEND_DEFAULT_EMAIL,
    enabled: true,
    frequency: "WEEKLY",
    scheduleTime: "04:00",
    dayOfWeek: 5,
    dayOfMonth: 1,
    lastSentTimestamp: null,
    totalBackupsSent: 0,
    encryptionEnabled: true,
    encryptionAlgorithm: "AES-256-GCM",
    backupPassphrase: "",
    features: DEFAULT_BACKUP_FEATURES
  };
};

export const getNextBackupScheduledDate = (config?: Partial<AutosendConfig>): Date => {
  const now = new Date();
  const freq = config?.frequency || "WEEKLY";
  const lastSent = config?.lastSentTimestamp ? new Date(config.lastSentTimestamp) : null;
  const scheduleTimeStr = config?.scheduleTime || "04:00";
  const [targetHourStr, targetMinStr] = scheduleTimeStr.split(":");
  const targetHour = parseInt(targetHourStr || "4", 10);
  const targetMin = parseInt(targetMinStr || "0", 10);

  if (freq === "5-HOURS") {
    const base = lastSent || now;
    return new Date(base.getTime() + 5 * 60 * 60 * 1000);
  }

  if (freq === "EVERY_5_DAYS") {
    const base = lastSent || now;
    const nextDate = new Date(base.getTime() + 5 * 24 * 60 * 60 * 1000);
    nextDate.setHours(targetHour, targetMin, 0, 0);
    if (nextDate.getTime() <= now.getTime()) {
      nextDate.setDate(nextDate.getDate() + 5);
    }
    return nextDate;
  }

  if (freq === "DAILY") {
    const nextDaily = new Date(now);
    nextDaily.setHours(targetHour, targetMin, 0, 0);
    if (nextDaily.getTime() <= now.getTime()) {
      nextDaily.setDate(nextDaily.getDate() + 1);
    }
    return nextDaily;
  }

  if (freq === "WEEKLY") {
    const targetDay = typeof config?.dayOfWeek === "number" ? config.dayOfWeek : 5; // Default Friday
    const currentDay = now.getDay();
    let daysUntil = (targetDay - currentDay + 7) % 7;
    
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + daysUntil);
    candidate.setHours(targetHour, targetMin, 0, 0);

    if (daysUntil === 0 && now.getTime() >= candidate.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }
    return candidate;
  }

  if (freq === "MONTHLY") {
    const targetDayOfMonth = typeof config?.dayOfMonth === "number" ? config.dayOfMonth : 1; // Default 1st
    const candidate = new Date(now.getFullYear(), now.getMonth(), targetDayOfMonth, targetHour, targetMin, 0, 0);
    if (candidate.getTime() <= now.getTime()) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
};

export const saveLocalAutosendConfig = (config: AutosendConfig) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Error saving local autosend config:", e);
  }
};

export const getLocalBackupEmailLogs = (): BackupEmailLog[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading local backup email logs:", e);
  }
  return [];
};

export const addLocalBackupEmailLog = (log: BackupEmailLog) => {
  try {
    const current = getLocalBackupEmailLogs();
    const updated = [log, ...current].slice(0, 50);
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Error writing local backup email log:", e);
  }
};

export const fetchAutosendStatus = async (): Promise<{ config: AutosendConfig; logs: BackupEmailLog[] }> => {
  try {
    const res = await fetch("/api/backup-email-status");
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        if (data.config) saveLocalAutosendConfig(data.config);
        return {
          config: data.config || getLocalAutosendConfig(),
          logs: data.logs || getLocalBackupEmailLogs()
        };
      }
    }
  } catch (err) {
    console.warn("Failed to fetch backend backup email status, using local cache:", err);
  }
  return {
    config: getLocalAutosendConfig(),
    logs: getLocalBackupEmailLogs()
  };
};

export const updateAutosendConfigOnServer = async (configUpdate: Partial<AutosendConfig>): Promise<AutosendConfig> => {
  const current = getLocalAutosendConfig();
  
  // If master enabled is toggled OFF, automatically disable sendEmail feature
  let features = configUpdate.features || current.features;
  if (configUpdate.enabled === false) {
    features = { ...features, sendEmail: false };
  }

  const newConfig = { 
    ...current, 
    ...configUpdate,
    features
  };
  saveLocalAutosendConfig(newConfig);

  try {
    const res = await fetch("/api/backup-email-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.config) {
        saveLocalAutosendConfig(data.config);
        return data.config;
      }
    }
  } catch (err) {
    console.warn("Failed to update autosend config on server:", err);
  }
  return newConfig;
};

export const triggerAutosendBackupEmail = async (
  email?: string,
  contextData?: any,
  triggerType: "MANUAL" | "SCHEDULED" = "MANUAL",
  force: boolean = false,
  encrypt?: boolean,
  passphrase?: string
): Promise<{ success: boolean; message: string; log?: BackupEmailLog; isEncrypted?: boolean }> => {
  const targetEmail = (email || AUTOSEND_DEFAULT_EMAIL).trim();

  const payload = contextData ? {
    systemSettings: contextData.systemSettings || {},
    requisitions: contextData.requisitions || [],
    users: contextData.users || [],
    projects: contextData.projects || [],
    churchGroups: contextData.churchGroups || [],
    ledgerBooks: contextData.ledgerBooks || [],
    systemLogs: contextData.systemLogs || [],
    customCalendarEvents: contextData.customCalendarEvents || []
  } : {};

  try {
    const res = await fetch("/api/backup-autosend-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: targetEmail,
        triggerType,
        force,
        encrypt: encrypt !== undefined ? encrypt : true,
        passphrase,
        ...payload
      })
    });

    const data = await res.json();

    if (data.disabled || (!data.success && data.status === "DISABLED_IN_CONFIG")) {
      return {
        success: false,
        message: data.message || "Backup email dispatches are currently turned OFF in settings."
      };
    }

    if (res.ok && data.success) {
      const logEntry: BackupEmailLog = {
        id: `embak-${Date.now()}`,
        timestamp: data.timestamp || new Date().toISOString(),
        targetEmail: data.targetEmail || targetEmail,
        fileName: data.fileName || `STANDS_eReqs_Backup_${new Date().toISOString().slice(0, 10)}.enc.json`,
        sizeKb: data.sizeKb || 0,
        status: data.status || "DELIVERED",
        warning: data.warning,
        isEncrypted: data.isEncrypted,
        algorithm: data.algorithm,
        checksumSha256: data.checksumSha256,
        triggerType,
        summary: data.summary
      };

      addLocalBackupEmailLog(logEntry);

      const cfg = getLocalAutosendConfig();
      cfg.lastSentTimestamp = logEntry.timestamp;
      cfg.totalBackupsSent = (cfg.totalBackupsSent || 0) + 1;
      saveLocalAutosendConfig(cfg);

      return {
        success: true,
        message: data.message || `Autosend JSON backup sent to ${targetEmail}`,
        log: logEntry,
        isEncrypted: data.isEncrypted
      };
    } else {
      throw new Error(data.error || data.message || "Failed to autosend JSON backup email");
    }
  } catch (err: any) {
    console.error("Autosend backup email error:", err);
    const failedLog: BackupEmailLog = {
      id: `embak-err-${Date.now()}`,
      timestamp: new Date().toISOString(),
      targetEmail,
      fileName: `STANDS_eReqs_Backup_Error.json`,
      sizeKb: 0,
      status: "FAILED",
      warning: err.message || "Email dispatch failed",
      triggerType
    };
    addLocalBackupEmailLog(failedLog);
    return {
      success: false,
      message: err.message || "Failed to autosend JSON backup email",
      log: failedLog
    };
  }
};

// =========================================================================
// DISASTER RECOVERY & RESTORE API HELPERS
// =========================================================================

export const fetchDisasterRecoveryReadiness = async (): Promise<DisasterRecoveryReadiness | null> => {
  try {
    const res = await fetch("/api/disaster-recovery/readiness");
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.readiness) {
        return data.readiness;
      }
    }
  } catch (e) {
    console.error("Failed to fetch DR readiness:", e);
  }
  return null;
};

export const fetchDisasterRecoverySnapshots = async (): Promise<DisasterRecoverySnapshot[]> => {
  try {
    const res = await fetch("/api/disaster-recovery/snapshots");
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.snapshots)) {
        return data.snapshots;
      }
    }
  } catch (e) {
    console.error("Failed to fetch DR snapshots:", e);
  }
  return [];
};

export const createEmergencySnapshot = async (
  passphrase?: string,
  encrypt: boolean = true,
  tag: string = "EMERGENCY_SNAPSHOT"
): Promise<{ success: boolean; message: string; fileName?: string; sizeKb?: number }> => {
  try {
    const res = await fetch("/api/disaster-recovery/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        encrypt,
        passphrase,
        tag
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || "Snapshot created successfully!",
        fileName: data.fileName,
        sizeKb: data.sizeKb
      };
    }
    throw new Error(data.error || "Failed to create emergency snapshot");
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to create emergency snapshot"
    };
  }
};

export const verifyBackupFileOnServer = async (
  payloadOrFileName: { payload?: string; fileName?: string },
  passphrase?: string
): Promise<BackupVerificationResult> => {
  try {
    const res = await fetch("/api/disaster-recovery/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: payloadOrFileName.payload,
        fileName: payloadOrFileName.fileName,
        passphrase
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        verified: true,
        summary: data.summary
      };
    }
    return {
      success: false,
      verified: false,
      error: data.error || "Verification failed."
    };
  } catch (err: any) {
    return {
      success: false,
      verified: false,
      error: err.message || "Verification request failed."
    };
  }
};

export const executeDisasterRecoveryRestore = async (params: {
  payload?: string;
  fileName?: string;
  passphrase?: string;
  selectedCollections?: string[];
  performedBy?: string;
}): Promise<{ success: boolean; message: string; restoredCollections?: string[]; restoredCounts?: any }> => {
  try {
    const res = await fetch("/api/disaster-recovery/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        message: data.message || "Disaster recovery restoration completed successfully!",
        restoredCollections: data.restoredCollections,
        restoredCounts: data.restoredCounts
      };
    }
    throw new Error(data.error || "Failed to execute disaster recovery restoration.");
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Restoration failed."
    };
  }
};

export const deleteDisasterRecoverySnapshot = async (fileName: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/disaster-recovery/snapshot/${encodeURIComponent(fileName)}`, {
      method: "DELETE"
    });
    const data = await res.json();
    return res.ok && data.success;
  } catch (e) {
    console.error("Failed to delete snapshot:", e);
    return false;
  }
};
