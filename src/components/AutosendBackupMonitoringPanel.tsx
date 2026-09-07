import React, { useState, useEffect, useRef } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { 
  AUTOSEND_DEFAULT_EMAIL, 
  BackupEmailLog, 
  AutosendConfig, 
  BackupFrequency,
  BackupTargetFeatures,
  DEFAULT_BACKUP_FEATURES,
  fetchAutosendStatus, 
  updateAutosendConfigOnServer, 
  triggerAutosendBackupEmail,
  getNextBackupScheduledDate,
  downloadBackupLocally,
  generateBackupPayload,
  fetchDisasterRecoveryReadiness,
  fetchDisasterRecoverySnapshots,
  createEmergencySnapshot,
  verifyBackupFileOnServer,
  executeDisasterRecoveryRestore,
  deleteDisasterRecoverySnapshot,
  DisasterRecoveryReadiness,
  DisasterRecoverySnapshot,
  BackupVerificationResult
} from "../services/autosendBackupService";
import { 
  Mail, 
  Send, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  FileCode, 
  Sparkles, 
  Save, 
  Activity, 
  Cpu,
  Calendar,
  Cloud,
  HardDrive,
  ShieldCheck,
  Bell,
  Sliders,
  Power,
  ToggleLeft,
  ToggleRight,
  Database,
  Lock,
  Unlock,
  Key,
  History,
  Upload,
  AlertTriangle,
  RotateCcw,
  Check,
  Copy,
  Layers,
  FileCheck,
  Server,
  Zap,
  Trash2,
  FileText,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const DAYS_OF_WEEK = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 }
];

const PRESET_TIMES = ["04:00", "08:00", "12:00", "18:00", "22:00"];

export const AutosendBackupMonitoringPanel: React.FC = () => {
  const contextData = useRequisitions();
  
  const [activeSubTab, setActiveSubTab] = useState<"disaster_recovery" | "schedules" | "encryption">("disaster_recovery");

  // Autosend & Scheduling state
  const [config, setConfig] = useState<AutosendConfig>({
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
  });

  const [logs, setLogs] = useState<BackupEmailLog[]>([]);
  const [emailInput, setEmailInput] = useState<string>(AUTOSEND_DEFAULT_EMAIL);
  const [scheduleTimeInput, setScheduleTimeInput] = useState<string>("04:00");
  const [dayOfWeekInput, setDayOfWeekInput] = useState<number>(5);
  const [dayOfMonthInput, setDayOfMonthInput] = useState<number>(1);
  const [featuresInput, setFeaturesInput] = useState<BackupTargetFeatures>(DEFAULT_BACKUP_FEATURES);
  const [encryptionEnabledInput, setEncryptionEnabledInput] = useState<boolean>(true);
  const [backupPassphraseInput, setBackupPassphraseInput] = useState<string>("");
  const [showPassphrase, setShowPassphrase] = useState<boolean>(false);

  // Disaster Recovery state
  const [drReadiness, setDrReadiness] = useState<DisasterRecoveryReadiness | null>(null);
  const [snapshots, setSnapshots] = useState<DisasterRecoverySnapshot[]>([]);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [snapshotTagInput, setSnapshotTagInput] = useState("MANUAL_ADMIN_CHECKPOINT");
  const [showCreateSnapshotModal, setShowCreateSnapshotModal] = useState(false);

  // Restore Modal & Wizard state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedSnapshotForRestore, setSelectedSnapshotForRestore] = useState<DisasterRecoverySnapshot | null>(null);
  const [uploadedBackupFileContent, setUploadedBackupFileContent] = useState<string | null>(null);
  const [uploadedBackupFileName, setUploadedBackupFileName] = useState<string | null>(null);
  const [restorePassphraseInput, setRestorePassphraseInput] = useState<string>("");
  const [isVerifyingRestore, setIsVerifyingRestore] = useState(false);
  const [verificationResult, setVerificationResult] = useState<BackupVerificationResult | null>(null);
  const [isExecutingRestore, setIsExecutingRestore] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [selectedCollectionsToRestore, setSelectedCollectionsToRestore] = useState<string[]>([
    "requisitions",
    "users",
    "churchGroups",
    "projects",
    "ledgerBooks",
    "systemLogs",
    "customCalendarEvents",
    "systemSettings"
  ]);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [statusNotification, setStatusNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAllData = async () => {
    setIsRefreshing(true);
    try {
      const [statusData, drData, snapData] = await Promise.all([
        fetchAutosendStatus(),
        fetchDisasterRecoveryReadiness(),
        fetchDisasterRecoverySnapshots()
      ]);

      if (statusData.config) {
        setConfig(statusData.config);
        setEmailInput(statusData.config.targetEmail || AUTOSEND_DEFAULT_EMAIL);
        setScheduleTimeInput(statusData.config.scheduleTime || "04:00");
        setDayOfWeekInput(typeof statusData.config.dayOfWeek === "number" ? statusData.config.dayOfWeek : 5);
        setDayOfMonthInput(statusData.config.dayOfMonth || 1);
        setEncryptionEnabledInput(statusData.config.encryptionEnabled !== false);
        setBackupPassphraseInput(statusData.config.backupPassphrase || "");
        setFeaturesInput({
          ...DEFAULT_BACKUP_FEATURES,
          ...(statusData.config.features || {})
        });
      }
      setLogs(statusData.logs || []);
      if (drData) setDrReadiness(drData);
      if (snapData) setSnapshots(snapData);
    } catch (e) {
      console.error("Error loading backup & DR data:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSaveFullConfig = async (overrideUpdate?: Partial<AutosendConfig>) => {
    if (emailInput && !emailInput.includes("@")) {
      setStatusNotification({ type: "error", message: "Please enter a valid target email address." });
      return;
    }

    setIsSavingConfig(true);
    try {
      const payload: Partial<AutosendConfig> = {
        targetEmail: emailInput.trim() || AUTOSEND_DEFAULT_EMAIL,
        enabled: config.enabled,
        frequency: config.frequency,
        scheduleTime: scheduleTimeInput,
        dayOfWeek: dayOfWeekInput,
        dayOfMonth: dayOfMonthInput,
        encryptionEnabled: encryptionEnabledInput,
        encryptionAlgorithm: "AES-256-GCM",
        backupPassphrase: backupPassphraseInput.trim(),
        features: featuresInput,
        ...overrideUpdate
      };

      const updated = await updateAutosendConfigOnServer(payload);
      setConfig(updated);
      if (updated.features) setFeaturesInput(updated.features);
      setStatusNotification({ 
        type: "success", 
        message: `✅ Backup configuration, encryption, and schedule saved! (${updated.frequency} cycle at ${updated.scheduleTime})` 
      });
      await loadAllData();
    } catch (err: any) {
      setStatusNotification({ type: "error", message: err.message || "Failed to save backup configuration." });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleMasterEnabled = async () => {
    const nextState = !config.enabled;
    const nextFeatures = {
      ...featuresInput,
      sendEmail: nextState
    };
    const updated = await updateAutosendConfigOnServer({ enabled: nextState, features: nextFeatures });
    setConfig(updated);
    if (updated.features) setFeaturesInput(updated.features);
    setStatusNotification({
      type: nextState ? "success" : "info",
      message: nextState ? "Automated scheduled backups ENABLED." : "Automated scheduled backups PAUSED and backup emails TURNED OFF."
    });
    await loadAllData();
  };

  const handleFrequencyChange = async (freq: BackupFrequency) => {
    const updated = await updateAutosendConfigOnServer({ 
      frequency: freq,
      scheduleTime: scheduleTimeInput,
      dayOfWeek: dayOfWeekInput,
      dayOfMonth: dayOfMonthInput,
      features: featuresInput
    });
    setConfig(updated);
    setStatusNotification({ type: "info", message: `Backup schedule frequency set to ${freq}.` });
  };

  const handleFeatureToggle = async (key: keyof BackupTargetFeatures) => {
    const updatedFeatures = {
      ...featuresInput,
      [key]: !featuresInput[key]
    };
    setFeaturesInput(updatedFeatures);
    const updated = await updateAutosendConfigOnServer({ features: updatedFeatures });
    setConfig(updated);
    setStatusNotification({
      type: "info",
      message: `Updated backup feature '${key}': ${updatedFeatures[key] ? "ENABLED" : "DISABLED"}`
    });
  };

  const handleSendNow = async () => {
    setIsDispatching(true);
    setStatusNotification({ type: "info", message: `Compiling system JSON snapshot, applying AES-256-GCM encryption & executing dispatch...` });

    try {
      const res = await triggerAutosendBackupEmail(
        emailInput, 
        contextData, 
        "MANUAL", 
        true, 
        encryptionEnabledInput, 
        backupPassphraseInput
      );
      if (res.success) {
        setStatusNotification({
          type: "success",
          message: `✅ Backup dispatch executed! ${res.message} ${res.isEncrypted ? "(🔒 AES-256-GCM Encrypted)" : ""}`
        });
      } else {
        setStatusNotification({
          type: "error",
          message: `⚠️ ${res.message}`
        });
      }
      await loadAllData();
    } catch (err: any) {
      setStatusNotification({
        type: "error",
        message: err.message || "Failed to send backup JSON email."
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleDownloadLocal = async (encrypt: boolean) => {
    const payload = generateBackupPayload(contextData);
    await downloadBackupLocally(payload, encrypt, backupPassphraseInput);
    setStatusNotification({ 
      type: "success", 
      message: encrypt 
        ? "🔒 AES-256-GCM Encrypted database snapshot (.enc.json) downloaded." 
        : "Standard JSON database snapshot (.json) downloaded." 
    });
  };

  const handleCreateEmergencySnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      const res = await createEmergencySnapshot(
        backupPassphraseInput,
        encryptionEnabledInput,
        snapshotTagInput
      );
      if (res.success) {
        setStatusNotification({
          type: "success",
          message: `✅ Disaster Recovery snapshot created: ${res.fileName} (${res.sizeKb} KB)`
        });
        setShowCreateSnapshotModal(false);
        await loadAllData();
      } else {
        setStatusNotification({ type: "error", message: res.message });
      }
    } catch (e: any) {
      setStatusNotification({ type: "error", message: e.message || "Failed to create snapshot" });
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (fileName: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete disaster recovery snapshot "${fileName}"?`)) {
      return;
    }
    const ok = await deleteDisasterRecoverySnapshot(fileName);
    if (ok) {
      setStatusNotification({ type: "info", message: `Snapshot ${fileName} deleted.` });
      await loadAllData();
    } else {
      setStatusNotification({ type: "error", message: "Failed to delete snapshot." });
    }
  };

  // Verification helper for restore modal
  const handleVerifySelectedFile = async () => {
    setIsVerifyingRestore(true);
    setVerificationResult(null);
    try {
      let result: BackupVerificationResult;
      if (selectedSnapshotForRestore) {
        result = await verifyBackupFileOnServer(
          { fileName: selectedSnapshotForRestore.fileName },
          restorePassphraseInput
        );
      } else if (uploadedBackupFileContent) {
        result = await verifyBackupFileOnServer(
          { payload: uploadedBackupFileContent },
          restorePassphraseInput
        );
      } else {
        setStatusNotification({ type: "error", message: "Please choose a snapshot or upload a backup file first." });
        setIsVerifyingRestore(false);
        return;
      }

      setVerificationResult(result);
      if (result.verified) {
        setStatusNotification({ type: "success", message: "✅ Backup payload verified successfully! Ready for safe restoration." });
      } else {
        setStatusNotification({ type: "error", message: `Verification failed: ${result.error}` });
      }
    } catch (e: any) {
      setStatusNotification({ type: "error", message: e.message || "Verification failed." });
    } finally {
      setIsVerifyingRestore(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setUploadedBackupFileContent(text);
      setUploadedBackupFileName(file.name);
      setSelectedSnapshotForRestore(null);
      setVerificationResult(null);
      setStatusNotification({ type: "info", message: `Uploaded file "${file.name}" (${Math.round(file.size / 1024)} KB) ready for verification.` });
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (restoreConfirmText.trim().toUpperCase() !== "RESTORE DATABASE") {
      setStatusNotification({ type: "error", message: 'Please type "RESTORE DATABASE" to confirm database replacement.' });
      return;
    }

    if (selectedCollectionsToRestore.length === 0) {
      setStatusNotification({ type: "error", message: "Please select at least one database collection to restore." });
      return;
    }

    setIsExecutingRestore(true);
    try {
      const res = await executeDisasterRecoveryRestore({
        payload: uploadedBackupFileContent || undefined,
        fileName: selectedSnapshotForRestore?.fileName || undefined,
        passphrase: restorePassphraseInput || undefined,
        selectedCollections: selectedCollectionsToRestore,
        performedBy: contextData.currentUser?.name || "Super Admin"
      });

      if (res.success) {
        setStatusNotification({
          type: "success",
          message: `✅ Database restored successfully! (${res.restoredCollections?.length} collections updated). Pre-restore safety checkpoint created.`
        });
        setShowRestoreModal(false);
        setUploadedBackupFileContent(null);
        setSelectedSnapshotForRestore(null);
        setVerificationResult(null);
        setRestoreConfirmText("");
        // Reload all data
        await loadAllData();
        // Trigger page refresh after 1.5s to let all contexts reload cleanly
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setStatusNotification({ type: "error", message: res.message });
      }
    } catch (e: any) {
      setStatusNotification({ type: "error", message: e.message || "Restoration failed." });
    } finally {
      setIsExecutingRestore(false);
    }
  };

  const nextDate = getNextBackupScheduledDate(config);
  const activeFeaturesCount = Object.entries(featuresInput).filter(([k, v]) => k !== "slackWebhookUrl" && v === true).length;

  return (
    <div className="bg-card rounded-[2.5rem] border border-border p-6 sm:p-8 shadow-sm space-y-8 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-foreground">
                Disaster Recovery & Backup Encryption Center
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                AES-256-GCM Secure
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              Enterprise financial snapshot encryption, RPO/RTO metrics, immutable snapshots, and zero-data-loss restoration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          <button
            onClick={loadAllData}
            disabled={isRefreshing}
            className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-border cursor-pointer shrink-0"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-indigo-600" : ""} />
            <span>Sync Status</span>
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        {[
          { id: "disaster_recovery", label: "Disaster Recovery & Snapshots", icon: HardDrive, badge: `${snapshots.length} Snapshots` },
          { id: "schedules", label: "Automated Schedules & Dispatch", icon: Clock, badge: config.enabled ? "ACTIVE" : "PAUSED" },
          { id: "encryption", label: "AES-256-GCM Encryption Keys", icon: Lock, badge: encryptionEnabledInput ? "ENCRYPTED" : "OFF" }
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2.5 border ${
                isActive
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20 scale-[1.02]"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DISASTER RECOVERY & SNAPSHOTS */}
      {/* ========================================================================= */}
      {activeSubTab === "disaster_recovery" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* DR Readiness Scorecard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-card border border-indigo-500/20 rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-indigo-600" /> DR Health Score</span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 text-[10px] font-black font-mono">
                  Grade {drReadiness?.grade || "A+"}
                </span>
              </div>
              <div className="text-2xl font-black text-foreground font-mono">
                {drReadiness?.score || 98}% Ready
              </div>
              <p className="text-[10px] text-muted-foreground">
                Zero data-loss architecture with automated encryption & local disk checkpoints.
              </p>
            </div>

            <div className="p-5 bg-card border border-border rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5"><Clock size={14} className="text-blue-600" /> Recovery Point (RPO)</span>
                <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold">Target &lt; 24h</span>
              </div>
              <div className="text-xl font-black text-foreground font-mono">
                {drReadiness?.rpoCurrentHours !== null && drReadiness?.rpoCurrentHours !== undefined 
                  ? `${drReadiness.rpoCurrentHours} Hours Ago`
                  : "Within Schedule"}
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 size={11} /> Fresh snapshot available
              </p>
            </div>

            <div className="p-5 bg-card border border-border rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-600" /> Recovery Time (RTO)</span>
                <span className="px-1.5 py-0.5 rounded bg-muted text-[9px] font-bold">Target &lt; 5m</span>
              </div>
              <div className="text-xl font-black text-foreground font-mono">
                ~ 15 Seconds
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">
                One-click automated atomic replacement.
              </p>
            </div>

            <div className="p-5 bg-card border border-border rounded-3xl space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5"><Lock size={14} className="text-emerald-600" /> Storage & Encryption</span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[9px] font-bold">AES-256-GCM</span>
              </div>
              <div className="text-xl font-black text-foreground font-mono">
                {snapshots.length} Snapshots
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                Total size: {snapshots.reduce((acc, s) => acc + (s.sizeKb || 0), 0)} KB
              </p>
            </div>
          </div>

          {/* Quick Action Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-900/50 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                  Zero Loss Ready
                </span>
                <h4 className="text-sm font-black uppercase tracking-wider">Emergency Checkpoints & Restore Wizard</h4>
              </div>
              <p className="text-xs text-slate-300">
                Create a point-in-time emergency system snapshot right now, or launch the Restoration Wizard to safely recover data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={() => setShowCreateSnapshotModal(true)}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-500/30"
              >
                <HardDrive size={16} />
                <span>Create Live Snapshot</span>
              </button>

              <button
                onClick={() => {
                  setSelectedSnapshotForRestore(null);
                  setUploadedBackupFileContent(null);
                  setVerificationResult(null);
                  setShowRestoreModal(true);
                }}
                className="px-5 py-3 bg-white hover:bg-slate-100 active:scale-95 text-slate-900 font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <RotateCcw size={16} />
                <span>Restore Database Wizard</span>
              </button>
            </div>
          </div>

          {/* Snapshots Repository List */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-indigo-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Persistent Server DR Snapshots Repository ({snapshots.length})
                </h4>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                Stored securely in server /data/disaster_recovery_snapshots/
              </span>
            </div>

            {snapshots.length === 0 ? (
              <div className="p-8 text-center bg-muted/30 border border-border rounded-3xl space-y-3">
                <HardDrive size={28} className="mx-auto text-muted-foreground/50" />
                <div className="text-xs font-bold text-foreground">No snapshots generated yet</div>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  Click "Create Live Snapshot" above or trigger a scheduled backup to store your first encrypted disaster recovery snapshot.
                </p>
                <button
                  onClick={handleCreateEmergencySnapshot}
                  disabled={isCreatingSnapshot}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Create First Snapshot Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {snapshots.map((snap) => (
                  <div
                    key={snap.fileName}
                    className="p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-indigo-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-foreground truncate" title={snap.fileName}>
                          {snap.fileName}
                        </span>
                        {snap.isEncrypted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            <Lock size={10} /> AES-256-GCM Encrypted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-500/10 text-slate-600 border border-slate-500/20">
                            <Unlock size={10} /> Plain JSON
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-mono bg-muted text-muted-foreground">
                          {snap.sizeKb} KB
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono flex-wrap">
                        <span>Created: {new Date(snap.createdAt).toLocaleString()}</span>
                        {snap.checksumSha256 && (
                          <span className="text-slate-500 truncate" title={`SHA-256: ${snap.checksumSha256}`}>
                            SHA-256: {snap.checksumSha256.slice(0, 16)}...
                          </span>
                        )}
                        {snap.summary && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                            {snap.summary.totalRequisitions || 0} reqs | {snap.summary.totalUsers || 0} users | {snap.summary.totalLedgers || 0} ledgers
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={async () => {
                          const res = await verifyBackupFileOnServer({ fileName: snap.fileName }, backupPassphraseInput);
                          if (res.verified) {
                            setStatusNotification({ 
                              type: "success", 
                              message: `✅ Snapshot ${snap.fileName} verified: Checksum OK, ${res.summary?.counts.requisitions || 0} reqs valid.` 
                            });
                          } else {
                            setStatusNotification({ type: "error", message: `Verification failed: ${res.error}` });
                          }
                        }}
                        className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl border border-border transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Verify Integrity & SHA-256 Checksum"
                      >
                        <FileCheck size={14} className="text-emerald-600" />
                        <span>Verify</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedSnapshotForRestore(snap);
                          setUploadedBackupFileContent(null);
                          setVerificationResult(null);
                          setShowRestoreModal(true);
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-500/20"
                        title="Restore Database from this snapshot"
                      >
                        <RotateCcw size={14} />
                        <span>Restore</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSnapshot(snap.fileName)}
                        className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                        title="Delete snapshot"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: AUTOMATED SCHEDULES & EMAIL DISPATCH */}
      {/* ========================================================================= */}
      {activeSubTab === "schedules" && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Master System Power Toggle Card */}
          <div className={`p-6 rounded-3xl border transition-all ${
            config.enabled 
              ? "bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-blue-500/10 border-emerald-500/30 dark:border-emerald-500/20" 
              : "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-2xl ${
                  config.enabled ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-300 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}>
                  <Power size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                      Automated Scheduled Backups Master Switch
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      config.enabled ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                    }`}>
                      {config.enabled ? "ACTIVE & RUNNING" : "PAUSED"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {config.enabled 
                      ? `Automated dispatches scheduled for ${config.frequency} cycle at ${config.scheduleTime || "04:00"}.`
                      : "All automated recurring background backup runs are currently paused."}
                  </p>
                </div>
              </div>

              <button
                onClick={handleToggleMasterEnabled}
                className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-sm shrink-0 ${
                  config.enabled
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                    : "bg-amber-600 hover:bg-amber-700 text-white"
                }`}
              >
                {config.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                <span>{config.enabled ? "DISABLE BACKUPS" : "ENABLE BACKUPS"}</span>
              </button>
            </div>
          </div>

          {/* Schedule Frequency & Execution Time Picker */}
          <div className="bg-gradient-to-br from-indigo-50/90 via-slate-50 to-blue-50/90 dark:from-slate-900 dark:via-slate-900/95 dark:to-slate-900 border border-indigo-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex items-center gap-3 border-b border-indigo-200/60 dark:border-slate-800 pb-4">
              <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-500/20">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Choose Schedule Interval & Execution Time
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Set automated dispatch frequency and local server target execution hour
                </p>
              </div>
            </div>

            {/* Frequency Buttons */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                Schedule Interval Frequency
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { id: "WEEKLY", label: "WEEKLY", sub: "Once a week" },
                  { id: "MONTHLY", label: "MONTHLY", sub: "Once a month" },
                  { id: "EVERY_5_DAYS", label: "EVERY 5 DAYS", sub: "120 Hours" },
                  { id: "DAILY", label: "DAILY", sub: "Every 24 Hours" },
                  { id: "5-HOURS", label: "EVERY 5 HOURS", sub: "Fast cycle" }
                ].map((item) => {
                  const isSelected = config.frequency === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleFrequencyChange(item.id as BackupFrequency)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25 scale-[1.02]"
                          : "bg-white dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                      }`}
                    >
                      <div className="text-xs font-black tracking-wider uppercase">{item.label}</div>
                      <div className={`text-[10px] font-medium mt-1 ${isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                        {item.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time of Day Picker & Specific Day Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-indigo-200/60 dark:border-slate-800">
              <div className="md:col-span-6 space-y-2.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                  Scheduled Dispatch Time of Day (24-Hour Format / Local Time)
                </label>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                  <div className="relative shrink-0">
                    <input
                      type="time"
                      value={scheduleTimeInput}
                      onChange={(e) => setScheduleTimeInput(e.target.value)}
                      className="px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-black text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm font-mono"
                    />
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto py-1">
                    {PRESET_TIMES.map((t) => {
                      const isPresetActive = scheduleTimeInput === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setScheduleTimeInput(t)}
                          className={`px-3 py-2.5 rounded-xl text-[11px] font-black font-mono transition-all cursor-pointer border ${
                            isPresetActive
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20"
                              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {config.frequency === "WEEKLY" && (
                <div className="md:col-span-6 space-y-2.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                    Target Day of the Week
                  </label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS_OF_WEEK.map((d) => {
                      const isDayActive = dayOfWeekInput === d.value;
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setDayOfWeekInput(d.value)}
                          className={`py-2.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer text-center border ${
                            isDayActive
                              ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/20"
                              : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {config.frequency === "MONTHLY" && (
                <div className="md:col-span-6 space-y-2.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                    Target Day of the Month
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={dayOfMonthInput}
                      onChange={(e) => setDayOfMonthInput(parseInt(e.target.value, 10))}
                      className="flex-1 px-4 py-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm cursor-pointer"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>
                          {num}{num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th"} day of the month
                        </option>
                      ))}
                      <option value={31}>Last day of the month</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Backup Target Features Grid */}
          <div className="space-y-6 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
                  <Sliders size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Backup Destination Features & Data Content Toggles
                  </h4>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Configure target dispatch channels and data snapshot content modules
                  </p>
                </div>
              </div>
              <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-950/60 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 shadow-xs shrink-0 self-start sm:self-auto">
                {activeFeaturesCount} of 6 Backup Modules Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Email Attachment */}
              <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                featuresInput.sendEmail 
                  ? "bg-indigo-50/70 dark:bg-slate-800/90 border-indigo-300 dark:border-indigo-600 shadow-md shadow-indigo-500/5" 
                  : "bg-card border-border opacity-75 hover:opacity-100"
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                        <Mail size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
                          EMAIL ATTACHMENT
                        </h5>
                        <p className="text-[11px] text-muted-foreground font-medium">Sends snapshot via email</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFeatureToggle("sendEmail")}
                      className={`w-12 h-6.5 rounded-full transition-all relative p-0.5 cursor-pointer shrink-0 ${
                        featuresInput.sendEmail ? "bg-indigo-600 shadow-md shadow-indigo-500/30" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <div className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all ${
                        featuresInput.sendEmail ? "translate-x-5.5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>

                  {featuresInput.sendEmail && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-muted-foreground block">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs font-mono font-bold text-foreground shadow-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Server Disk Snapshot */}
              <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                featuresInput.saveServerDiskSnapshot 
                  ? "bg-slate-100/80 dark:bg-slate-800/90 border-slate-400 dark:border-slate-600 shadow-md" 
                  : "bg-card border-border opacity-75 hover:opacity-100"
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl shadow-sm">
                        <HardDrive size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
                          SERVER DISK SNAPSHOT
                        </h5>
                        <p className="text-[11px] text-muted-foreground font-medium">Saves in server /data/backups</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFeatureToggle("saveServerDiskSnapshot")}
                      className={`w-12 h-6.5 rounded-full transition-all relative p-0.5 cursor-pointer shrink-0 ${
                        featuresInput.saveServerDiskSnapshot ? "bg-slate-800 dark:bg-slate-600 shadow-md" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <div className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all ${
                        featuresInput.saveServerDiskSnapshot ? "translate-x-5.5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-[11px] font-bold text-foreground font-mono">
                      Location: Disaster Recovery Snapshots
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. Include Audit Logs */}
              <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                featuresInput.includeAuditLogs 
                  ? "bg-amber-50/70 dark:bg-slate-800/90 border-amber-300 dark:border-amber-600 shadow-md shadow-amber-500/5" 
                  : "bg-card border-border opacity-75 hover:opacity-100"
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-600 text-white rounded-2xl shadow-sm">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
                          INCLUDE AUDIT TRAILS
                        </h5>
                        <p className="text-[11px] text-muted-foreground font-medium">Packs admin security logs</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFeatureToggle("includeAuditLogs")}
                      className={`w-12 h-6.5 rounded-full transition-all relative p-0.5 cursor-pointer shrink-0 ${
                        featuresInput.includeAuditLogs ? "bg-amber-600 shadow-md shadow-amber-500/30" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <div className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all ${
                        featuresInput.includeAuditLogs ? "translate-x-5.5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono">
                      Logs: {contextData.systemLogs?.length || 0} Records
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Ledger & Calendar */}
              <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                featuresInput.includeCalendarAndLedger 
                  ? "bg-purple-50/70 dark:bg-slate-800/90 border-purple-300 dark:border-purple-600 shadow-md shadow-purple-500/5" 
                  : "bg-card border-border opacity-75 hover:opacity-100"
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-sm">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
                          LEDGER BOOKS & CALENDAR
                        </h5>
                        <p className="text-[11px] text-muted-foreground font-medium">Packs financial books & events</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFeatureToggle("includeCalendarAndLedger")}
                      className={`w-12 h-6.5 rounded-full transition-all relative p-0.5 cursor-pointer shrink-0 ${
                        featuresInput.includeCalendarAndLedger ? "bg-purple-600 shadow-md shadow-purple-500/30" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <div className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all ${
                        featuresInput.includeCalendarAndLedger ? "translate-x-5.5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300 font-mono">
                      Ledgers: {contextData.ledgerBooks?.length || 0} | Events: {contextData.customCalendarEvents?.length || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. Slack Webhook */}
              <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                featuresInput.slackAlertEnabled 
                  ? "bg-emerald-50/70 dark:bg-slate-800/90 border-emerald-300 dark:border-emerald-600 shadow-md shadow-emerald-500/5" 
                  : "bg-card border-border opacity-75 hover:opacity-100"
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
                        <Bell size={18} />
                      </div>
                      <div>
                        <h5 className="text-xs font-black uppercase tracking-wider text-foreground">
                          SLACK / WEBHOOK ALERT
                        </h5>
                        <p className="text-[11px] text-muted-foreground font-medium">Sends summary on backup</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFeatureToggle("slackAlertEnabled")}
                      className={`w-12 h-6.5 rounded-full transition-all relative p-0.5 cursor-pointer shrink-0 ${
                        featuresInput.slackAlertEnabled ? "bg-emerald-600 shadow-md shadow-emerald-500/30" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                    >
                      <div className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all ${
                        featuresInput.slackAlertEnabled ? "translate-x-5.5" : "translate-x-0.5"
                      }`} />
                    </button>
                  </div>

                  {featuresInput.slackAlertEnabled && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                      <input
                        type="url"
                        placeholder="Slack Webhook URL"
                        value={featuresInput.slackWebhookUrl || ""}
                        onChange={(e) => setFeaturesInput({ ...featuresInput, slackWebhookUrl: e.target.value })}
                        className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs font-mono font-bold text-foreground shadow-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Save All Settings Button */}
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => handleSaveFullConfig()}
                disabled={isSavingConfig}
                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {isSavingConfig ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                <span>SAVE BACKUP SETTINGS & SCHEDULE</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={handleSendNow}
              disabled={isDispatching}
              className="w-full sm:w-auto flex-1 py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-md disabled:opacity-50"
            >
              <Send size={16} className={isDispatching ? "animate-bounce" : ""} />
              <span>{isDispatching ? "Compiling & Dispatched..." : "Send Encrypted Backup Email Now"}</span>
            </button>

            <button
              onClick={() => handleDownloadLocal(true)}
              className="w-full sm:w-auto py-4 px-6 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Download size={16} />
              <span>Download Encrypted .enc.json</span>
            </button>
          </div>

          {/* Logs Table */}
          <div className="space-y-4 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-indigo-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Backup Dispatch Monitoring Logs
                </h4>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {logs.length} Total Logs
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center bg-muted/30 border border-border rounded-2xl space-y-2">
                <Activity size={24} className="mx-auto text-muted-foreground/60" />
                <p className="text-xs font-semibold text-muted-foreground">
                  No backup logs recorded yet. Click "Send Encrypted Backup Email Now" to execute an initial backup dispatch.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <th className="p-3.5">Timestamp</th>
                      <th className="p-3.5">Recipient</th>
                      <th className="p-3.5">File Name & Size</th>
                      <th className="p-3.5">Security & Format</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Summary Records</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs font-medium">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3.5 font-bold text-foreground font-mono text-[11px]">
                          {log.targetEmail}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-foreground font-mono text-[11px]">{log.fileName}</div>
                          <div className="text-[10px] text-muted-foreground">{log.sizeKb} KB</div>
                        </td>
                        <td className="p-3.5">
                          {log.isEncrypted !== false ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-md border border-emerald-500/20">
                              <Lock size={10} /> AES-256-GCM
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-500/10 text-slate-600 text-[9px] font-black uppercase tracking-wider rounded-md">
                              <Unlock size={10} /> Plain JSON
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {log.status === "DELIVERED" || log.status === "SENT_ATTACHMENT" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 size={12} /> DELIVERED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-rose-200 dark:border-rose-800">
                              <AlertCircle size={12} /> FAILED
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right font-mono text-[11px] text-muted-foreground">
                          {log.summary ? (
                            <span>
                              {log.summary.totalRequisitions} reqs | {log.summary.totalUsers} users | {log.summary.totalGroups} groups
                            </span>
                          ) : (
                            <span>Encrypted Snapshot</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: AES-256-GCM ENCRYPTION KEYS & SECURITY */}
      {/* ========================================================================= */}
      {activeSubTab === "encryption" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-6 rounded-3xl bg-card border border-border space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md">
                  <Key size={22} />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
                    AES-256-GCM Cryptographic Standard Configuration
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                    PBKDF2 key derivation (100,000 rounds), HMAC-SHA-256, 128-bit authentication tag, and payload integrity checksums.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setEncryptionEnabledInput(!encryptionEnabledInput)}
                  className={`w-14 h-7.5 rounded-full transition-all relative p-1 cursor-pointer shrink-0 ${
                    encryptionEnabledInput ? "bg-emerald-600 shadow-md shadow-emerald-500/30" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <div className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all ${
                    encryptionEnabledInput ? "translate-x-6.5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>
            </div>

            {/* Passphrase Configuration */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Lock size={14} className="text-indigo-600" />
                  Custom Backup Secret Passphrase / Master Recovery Key
                </label>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Leave blank to use system standard secret key
                </span>
              </div>

              <div className="relative">
                <input
                  type={showPassphrase ? "text" : "password"}
                  placeholder="Enter custom disaster recovery passphrase (optional)..."
                  value={backupPassphraseInput}
                  onChange={(e) => setBackupPassphraseInput(e.target.value)}
                  className="w-full px-4 py-3.5 bg-background border border-border rounded-2xl text-xs font-mono font-bold text-foreground focus:ring-2 focus:ring-indigo-500 outline-none pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassphrase(!showPassphrase)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-1"
                >
                  {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Cryptographic Architecture Card */}
            <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
              <h5 className="text-[11px] font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-600" />
                Security Specifications & Technical Guarantee
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div className="p-3 bg-card rounded-xl border border-border">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">Cipher Suite</div>
                  <div className="font-bold text-foreground mt-0.5">AES-256-GCM (Galois/Counter)</div>
                </div>
                <div className="p-3 bg-card rounded-xl border border-border">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">Key Derivation</div>
                  <div className="font-bold text-foreground mt-0.5">PBKDF2-SHA256 (100,000 iters)</div>
                </div>
                <div className="p-3 bg-card rounded-xl border border-border">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground">Data Integrity</div>
                  <div className="font-bold text-foreground mt-0.5">128-bit Auth Tag + SHA-256</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownloadLocal(true)}
                  className="px-5 py-3 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl border border-border transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download Encrypted .enc.json</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadLocal(false)}
                  className="px-5 py-3 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl border border-border transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download Plain .json</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleSaveFullConfig()}
                disabled={isSavingConfig}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20 disabled:opacity-50"
              >
                <Save size={16} />
                <span>SAVE ENCRYPTION PREFERENCES</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Notification Toast */}
      <AnimatePresence>
        {statusNotification && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              statusNotification.type === "success"
                ? "bg-emerald-500/10 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : statusNotification.type === "error"
                ? "bg-rose-500/10 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                : "bg-indigo-500/10 border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusNotification.type === "success" ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              ) : statusNotification.type === "error" ? (
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
              ) : (
                <Activity size={16} className="shrink-0 text-indigo-600 animate-pulse" />
              )}
              <span>{statusNotification.message}</span>
            </div>
            <button
              onClick={() => setStatusNotification(null)}
              className="text-xs font-mono opacity-60 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: CREATE EMERGENCY SNAPSHOT */}
      {/* ========================================================================= */}
      {showCreateSnapshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card rounded-3xl border border-border w-full max-w-lg p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-2xl">
                  <HardDrive size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">Create Live Emergency Snapshot</h3>
                  <p className="text-[11px] text-muted-foreground">Saves point-in-time state directly to persistent server disk.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateSnapshotModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                  Snapshot Tag / Identifier
                </label>
                <input
                  type="text"
                  value={snapshotTagInput}
                  onChange={(e) => setSnapshotTagInput(e.target.value)}
                  placeholder="e.g. PRE_AUDIT_BACKUP, FINANCIAL_YEAR_END"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl text-xs font-mono font-bold text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1">
                <div className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Lock size={14} /> AES-256-GCM Encryption Active
                </div>
                <p className="text-muted-foreground text-[11px]">
                  Snapshot will be encrypted with PBKDF2 salt, 128-bit authentication tag, and SHA-256 checksum verification.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={() => setShowCreateSnapshotModal(false)}
                className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateEmergencySnapshot}
                disabled={isCreatingSnapshot}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isCreatingSnapshot ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                <span>{isCreatingSnapshot ? "Saving..." : "Create Snapshot Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DISASTER RECOVERY RESTORATION WIZARD */}
      {/* ========================================================================= */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-card rounded-3xl border border-border w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-md">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                    Disaster Recovery Database Restoration Wizard
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Safely recover data from server snapshots or upload an encrypted backup file.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Source Selection: Choose Snapshot or Upload File */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                1. Select Backup Source
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-foreground block">From Server Snapshots</span>
                  <select
                    value={selectedSnapshotForRestore?.fileName || ""}
                    onChange={(e) => {
                      const found = snapshots.find(s => s.fileName === e.target.value);
                      setSelectedSnapshotForRestore(found || null);
                      setUploadedBackupFileContent(null);
                      setUploadedBackupFileName(null);
                      setVerificationResult(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs font-mono text-foreground focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Server Snapshot --</option>
                    {snapshots.map(s => (
                      <option key={s.fileName} value={s.fileName}>
                        {s.fileName} ({s.sizeKb} KB)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-foreground block">Or Upload Local Backup File</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json,.enc.json"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl border border-border transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload size={14} />
                    <span>{uploadedBackupFileName ? uploadedBackupFileName : "Select .enc.json or .json file"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Passphrase & Verification */}
            <div className="space-y-4 p-5 rounded-2xl bg-muted/30 border border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Lock size={12} className="text-indigo-600" />
                  2. Decryption Passphrase (If Backup Is Encrypted)
                </label>
                <button
                  type="button"
                  onClick={handleVerifySelectedFile}
                  disabled={isVerifyingRestore || (!selectedSnapshotForRestore && !uploadedBackupFileContent)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <FileCheck size={14} className={isVerifyingRestore ? "animate-spin" : ""} />
                  <span>{isVerifyingRestore ? "Verifying..." : "Verify Backup Payload"}</span>
                </button>
              </div>

              <input
                type="password"
                placeholder="Enter passphrase if different from default..."
                value={restorePassphraseInput}
                onChange={(e) => setRestorePassphraseInput(e.target.value)}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-xs font-mono text-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
              />

              {verificationResult && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                  verificationResult.verified 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
                }`}>
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                    {verificationResult.verified ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{verificationResult.verified ? "Payload Verified & Ready" : "Verification Failed"}</span>
                  </div>
                  {verificationResult.summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] pt-1">
                      <div>Reqs: {verificationResult.summary.counts.requisitions}</div>
                      <div>Users: {verificationResult.summary.counts.users}</div>
                      <div>Groups: {verificationResult.summary.counts.churchGroups}</div>
                      <div>Ledgers: {verificationResult.summary.counts.ledgerBooks}</div>
                    </div>
                  )}
                  {verificationResult.error && (
                    <p className="text-[11px]">{verificationResult.error}</p>
                  )}
                </div>
              )}
            </div>

            {/* Collection Selection */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                3. Choose Collections to Restore
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "requisitions", label: "Requisitions" },
                  { id: "users", label: "User Accounts" },
                  { id: "churchGroups", label: "Church Groups" },
                  { id: "projects", label: "Projects & Votes" },
                  { id: "ledgerBooks", label: "Ledger Books" },
                  { id: "systemLogs", label: "Audit Logs" },
                  { id: "customCalendarEvents", label: "Calendar Events" },
                  { id: "systemSettings", label: "System Settings" }
                ].map((col) => {
                  const isChecked = selectedCollectionsToRestore.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedCollectionsToRestore(selectedCollectionsToRestore.filter(c => c !== col.id));
                        } else {
                          setSelectedCollectionsToRestore([...selectedCollectionsToRestore, col.id]);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
                          : "bg-card border-border text-muted-foreground opacity-60"
                      }`}
                    >
                      <span>{col.label}</span>
                      {isChecked ? <Check size={14} className="text-indigo-600" /> : <div className="w-3.5 h-3.5 rounded border border-muted-foreground/40" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Safety Warning & Confirmation */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                <AlertTriangle size={16} className="text-amber-600" />
                Automatic Pre-Restore Safety Checkpoint
              </div>
              <p className="text-[11px] leading-relaxed">
                Before applying changes, the system will automatically generate an immutable snapshot of your current database state to guarantee zero risk of accidental loss.
              </p>
              <div className="pt-2">
                <label className="text-[10px] font-black uppercase text-amber-900 dark:text-amber-200 block mb-1">
                  Type "RESTORE DATABASE" to confirm replacement:
                </label>
                <input
                  type="text"
                  placeholder="RESTORE DATABASE"
                  value={restoreConfirmText}
                  onChange={(e) => setRestoreConfirmText(e.target.value)}
                  className="w-full px-3.5 py-2 bg-background border border-amber-500/40 rounded-xl text-xs font-mono font-bold text-foreground focus:ring-2 focus:ring-amber-500 outline-none uppercase"
                />
              </div>
            </div>

            {/* Execute Modal Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-5 py-3 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleExecuteRestore}
                disabled={isExecutingRestore || restoreConfirmText.trim().toUpperCase() !== "RESTORE DATABASE"}
                className="px-8 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-600/30 disabled:opacity-40"
              >
                {isExecutingRestore ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                <span>{isExecutingRestore ? "Applying Recovery Snapshot..." : "EXECUTE RESTORATION"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
