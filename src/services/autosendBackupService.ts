/**
 * Autosend Backup Service
 * Automatically compiles system database snapshots into JSON files and sends them as email attachments
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
  features: BackupTargetFeatures;
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
    systemSettings: contextData.systemSettings || {},
    users: contextData.users || [],
    requisitions: contextData.requisitions || [],
    projects: contextData.projects || [],
    churchGroups: contextData.churchGroups || [],
    ledgerBooks: contextData.ledgerBooks || [],
    systemLogs: contextData.systemLogs || [],
    customCalendarEvents: contextData.customCalendarEvents || [],
    supplementaryRequests: contextData.supplementaryRequests || []
  };
};

export const downloadBackupLocally = (backupPayload: any) => {
  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  a.href = url;
  a.download = `PCEA_St_Andrews_Backup_${dateStr}.json`;
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
  force: boolean = false
): Promise<{ success: boolean; message: string; log?: BackupEmailLog }> => {
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
        fileName: data.fileName || `STANDS_eReqs_Backup_${new Date().toISOString().slice(0, 10)}.json`,
        sizeKb: data.sizeKb || 0,
        status: data.status || "DELIVERED",
        warning: data.warning,
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
        log: logEntry
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
