import React, { useState, useEffect } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { 
  getBackupLogs, 
  addBackupLog, 
  getLastBackupTimestamp, 
  generateBackupPayload, 
  uploadBackupToGoogleDrive, 
  downloadBackupLocally,
  BACKUP_TARGET_EMAIL,
  BACKUP_INTERVAL_HOURS,
  BACKUP_INTERVAL_MS,
  BackupLogEntry 
} from "../services/googleDriveBackupService";
import { triggerAutosendBackupEmail, AUTOSEND_DEFAULT_EMAIL } from "../services/autosendBackupService";
import { 
  Cloud, 
  CloudUpload, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  X, 
  HardDrive, 
  ShieldCheck, 
  FileText,
  Mail
} from "lucide-react";
import { motion } from "motion/react";

interface DriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DriveBackupModal: React.FC<DriveBackupModalProps> = ({ isOpen, onClose }) => {
  const contextData = useRequisitions();
  const { systemSettings, requisitions, users, projects, churchGroups, systemLogs, customCalendarEvents, supplementaryRequests } = contextData;
  
  const [backupLogs, setBackupLogs] = useState<BackupLogEntry[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [nextBackupTime, setNextBackupTime] = useState<string>("");

  const refreshLogsAndTimes = () => {
    const logs = getBackupLogs();
    setBackupLogs(logs);
    const lastTs = getLastBackupTimestamp();
    setLastBackup(lastTs);

    if (lastTs) {
      const nextDate = new Date(new Date(lastTs).getTime() + BACKUP_INTERVAL_MS);
      setNextBackupTime(nextDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " (" + nextDate.toLocaleDateString() + ")");
    } else {
      setNextBackupTime("Pending initial run");
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshLogsAndTimes();
    }
  }, [isOpen]);

  const executeBackupNow = async () => {
    setIsBackingUp(true);
    setStatusMessage("Packaging ecosystem data & dispatching Google Drive payload...");
    
    try {
      const payload = generateBackupPayload(contextData);
      
      const res = await fetch("/api/backup-all-to-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const logEntry: BackupLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          status: "SUCCESS",
          sizeKb: Math.round(JSON.stringify(payload).length / 1024),
          fileName: data.fileName || `PCEA_St_Andrews_Backup_${new Date().toISOString().slice(0, 10)}.json`,
          fileId: data.fileId,
          targetEmail: BACKUP_TARGET_EMAIL,
          message: data.message || `Successfully backed up to Google Drive for ${BACKUP_TARGET_EMAIL}`
        };
        addBackupLog(logEntry);
        setStatusMessage(`✅ ${data.message}`);
      } else {
        throw new Error(data.error || "Failed to complete Google Drive backup upload.");
      }
    } catch (err: any) {
      console.error("Backup error:", err);
      const logEntry: BackupLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: "FAILED",
        sizeKb: 0,
        fileName: `PCEA_St_Andrews_Backup_Error.json`,
        targetEmail: BACKUP_TARGET_EMAIL,
        message: err.message || "Failed backup attempt"
      };
      addBackupLog(logEntry);
      setStatusMessage(`⚠️ ${err.message || "Backup failed."}`);
    } finally {
      setIsBackingUp(false);
      refreshLogsAndTimes();
    }
  };

  const handleDownloadLocal = () => {
    const payload = generateBackupPayload(contextData);
    downloadBackupLocally(payload);
  };

  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSendEmailBackup = async () => {
    setIsSendingEmail(true);
    setStatusMessage(`Compiling database JSON snapshot & sending to ${AUTOSEND_DEFAULT_EMAIL}...`);
    try {
      const res = await triggerAutosendBackupEmail(AUTOSEND_DEFAULT_EMAIL, contextData, "AUTO_DRIVE", true);
      if (res.success) {
        setStatusMessage(`✅ Dispatched backup JSON email to ${AUTOSEND_DEFAULT_EMAIL}`);
      } else {
        setStatusMessage(`⚠️ ${res.message}`);
      }
    } catch (err: any) {
      setStatusMessage(`⚠️ ${err.message || "Failed to send backup email"}`);
    } finally {
      setIsSendingEmail(false);
      refreshLogsAndTimes();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-3xl max-w-2xl w-full border border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/20 rounded-2xl border border-blue-400/20 backdrop-blur-md">
              <Cloud className="text-blue-400" size={24} />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wider text-white">
                Google Drive System Backup
              </h3>
              <p className="text-[10px] text-slate-400 uppercase font-mono tracking-tight flex items-center gap-1 mt-0.5">
                <Mail size={12} className="text-blue-400" />
                Target: <span className="text-blue-300 font-bold">{BACKUP_TARGET_EMAIL}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Automated Schedule Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-200/80 p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="text-blue-600" size={18} />
                <span className="text-xs font-black uppercase tracking-wider text-blue-950">
                  Automated Schedule: Every {BACKUP_INTERVAL_HOURS} Hours
                </span>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Full database snapshots (Requisitions, Users, Church Groups, Ledger Books, System Settings, Audit Logs, and Calendar Events) are scheduled to automatically backup to Google Drive under <strong className="text-slate-800">{BACKUP_TARGET_EMAIL}</strong> every {BACKUP_INTERVAL_HOURS} hours.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2 text-[11px] font-mono border-t border-blue-200/60">
              <div>
                <span className="text-slate-400 uppercase text-[9px] block">Last Successful Backup</span>
                <span className="font-bold text-slate-800">
                  {lastBackup ? new Date(lastBackup).toLocaleString() : "None recorded"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 uppercase text-[9px] block">Next Scheduled Backup</span>
                <span className="font-bold text-blue-700">{nextBackupTime}</span>
              </div>
            </div>
          </div>

          {/* Direct Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={executeBackupNow}
              disabled={isBackingUp}
              className="w-full sm:w-auto flex-1 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={isBackingUp ? "animate-spin" : ""} />
              <span>{isBackingUp ? "Backing Up..." : "Trigger Drive Backup Now"}</span>
            </button>

            <button
              onClick={handleSendEmailBackup}
              disabled={isSendingEmail}
              className="w-full sm:w-auto px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-500 shadow-sm disabled:opacity-50"
            >
              <Mail size={16} className={isSendingEmail ? "animate-bounce" : ""} />
              <span>{isSendingEmail ? "Sending..." : "Email JSON Backup"}</span>
            </button>

            <button
              onClick={handleDownloadLocal}
              className="w-full sm:w-auto px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
            >
              <Download size={16} />
              <span>Download JSON</span>
            </button>
          </div>

          {statusMessage && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Backup Logs */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <FileText size={15} className="text-slate-500" />
              <span>Recent Backup History</span>
            </h4>

            {backupLogs.length === 0 ? (
              <p className="text-xs italic text-slate-400 p-4 bg-slate-50 rounded-xl text-center">
                No backup logs generated yet. Click "Trigger Drive Backup Now" to run an initial backup.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {backupLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {log.status === "SUCCESS" ? (
                          <CheckCircle2 size={14} className="text-emerald-500" />
                        ) : (
                          <AlertCircle size={14} className="text-rose-500" />
                        )}
                        <span className="font-bold text-slate-800">{log.fileName}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 pl-5">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
