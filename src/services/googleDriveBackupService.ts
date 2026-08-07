/**
 * Google Drive Automated System Backup Service
 * Performs automated backups every 5 hours targeting ict.team@pceastandrews.org
 */

export interface BackupPayload {
  timestamp: string;
  version: string;
  targetAccount: string;
  systemSettings: any;
  users: any[];
  requisitions: any[];
  projects: any[];
  churchGroups: any[];
  ledgerBooks: any[];
  systemLogs: any[];
  customCalendarEvents: any[];
  supplementaryRequests: any[];
}

export interface BackupLogEntry {
  id: string;
  timestamp: string;
  status: "SUCCESS" | "FAILED" | "IN_PROGRESS";
  sizeKb: number;
  fileId?: string;
  fileName: string;
  targetEmail: string;
  message: string;
}

const BACKUP_LOG_STORAGE_KEY = "st_andrews_drive_backup_logs";
const LAST_BACKUP_TIME_KEY = "st_andrews_last_drive_backup_timestamp";
export const BACKUP_TARGET_EMAIL = "ict.team@pceastandrews.org";
export const BACKUP_INTERVAL_HOURS = 5;
export const BACKUP_INTERVAL_MS = BACKUP_INTERVAL_HOURS * 60 * 60 * 1000;

export const getBackupLogs = (): BackupLogEntry[] => {
  try {
    const raw = localStorage.getItem(BACKUP_LOG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addBackupLog = (log: BackupLogEntry) => {
  try {
    const current = getBackupLogs();
    const updated = [log, ...current].slice(0, 50); // Keep last 50
    localStorage.setItem(BACKUP_LOG_STORAGE_KEY, JSON.stringify(updated));
    if (log.status === "SUCCESS") {
      localStorage.setItem(LAST_BACKUP_TIME_KEY, log.timestamp);
    }
  } catch (e) {
    console.error("Failed to persist backup log:", e);
  }
};

export const getLastBackupTimestamp = (): string | null => {
  return localStorage.getItem(LAST_BACKUP_TIME_KEY);
};

export const generateBackupPayload = (contextData: any): BackupPayload => {
  return {
    timestamp: new Date().toISOString(),
    version: "4.2.0",
    targetAccount: BACKUP_TARGET_EMAIL,
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

/**
 * Uploads backup file directly to Google Drive via multipart API upload
 */
export const uploadBackupToGoogleDrive = async (
  accessToken: string,
  backupPayload: BackupPayload
): Promise<{ fileId: string; fileName: string; sizeKb: number }> => {
  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const sizeKb = Math.round(blob.size / 1024);
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const fileName = `PCEA_St_Andrews_Backup_${dateStr}.json`;

  const metadata = {
    name: fileName,
    mimeType: "application/json",
    description: `Automated PCEA St. Andrews Church Management System Backup for ${BACKUP_TARGET_EMAIL}`
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", blob);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: formData
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Drive API Upload Error (${res.status}): ${errorText}`);
  }

  const result = await res.json();
  return {
    fileId: result.id,
    fileName,
    sizeKb
  };
};

/**
 * Trigger local backup download file for fallback
 */
export const downloadBackupLocally = (backupPayload: BackupPayload) => {
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
