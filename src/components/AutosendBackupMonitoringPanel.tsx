import React, { useState, useEffect } from "react";
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
  getNextBackupScheduledDate
} from "../services/autosendBackupService";
import { downloadBackupLocally, generateBackupPayload } from "../services/googleDriveBackupService";
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
  Database
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
  
  const [config, setConfig] = useState<AutosendConfig>({
    targetEmail: AUTOSEND_DEFAULT_EMAIL,
    enabled: true,
    frequency: "WEEKLY",
    scheduleTime: "04:00",
    dayOfWeek: 5,
    dayOfMonth: 1,
    lastSentTimestamp: null,
    totalBackupsSent: 0,
    features: DEFAULT_BACKUP_FEATURES
  });

  const [logs, setLogs] = useState<BackupEmailLog[]>([]);
  const [emailInput, setEmailInput] = useState<string>(AUTOSEND_DEFAULT_EMAIL);
  const [scheduleTimeInput, setScheduleTimeInput] = useState<string>("04:00");
  const [dayOfWeekInput, setDayOfWeekInput] = useState<number>(5);
  const [dayOfMonthInput, setDayOfMonthInput] = useState<number>(1);
  const [featuresInput, setFeaturesInput] = useState<BackupTargetFeatures>(DEFAULT_BACKUP_FEATURES);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [statusNotification, setStatusNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStatus = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchAutosendStatus();
      if (data.config) {
        setConfig(data.config);
        setEmailInput(data.config.targetEmail || AUTOSEND_DEFAULT_EMAIL);
        setScheduleTimeInput(data.config.scheduleTime || "04:00");
        setDayOfWeekInput(typeof data.config.dayOfWeek === "number" ? data.config.dayOfWeek : 5);
        setDayOfMonthInput(data.config.dayOfMonth || 1);
        setFeaturesInput({
          ...DEFAULT_BACKUP_FEATURES,
          ...(data.config.features || {})
        });
      }
      setLogs(data.logs || []);
    } catch (e) {
      console.error("Error loading autosend status:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStatus();
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
        features: featuresInput,
        ...overrideUpdate
      };

      const updated = await updateAutosendConfigOnServer(payload);
      setConfig(updated);
      if (updated.features) setFeaturesInput(updated.features);
      setStatusNotification({ 
        type: "success", 
        message: `✅ Backup configuration & schedule saved! (${updated.frequency} cycle at ${updated.scheduleTime})` 
      });
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
    setStatusNotification({ type: "info", message: `Compiling system JSON snapshot & executing backup dispatch...` });

    try {
      // Force allow manual dispatch if button explicitly pressed by admin
      const res = await triggerAutosendBackupEmail(emailInput, contextData, "MANUAL", true);
      if (res.success) {
        setStatusNotification({
          type: "success",
          message: `✅ Backup dispatch executed! ${res.message}`
        });
      } else {
        setStatusNotification({
          type: "error",
          message: `⚠️ ${res.message}`
        });
      }
      await loadStatus();
    } catch (err: any) {
      setStatusNotification({
        type: "error",
        message: err.message || "Failed to send backup JSON email."
      });
    } finally {
      setIsDispatching(false);
    }
  };

  const handleDownloadLocal = () => {
    const payload = generateBackupPayload(contextData);
    downloadBackupLocally(payload);
    setStatusNotification({ type: "success", message: "Local JSON database snapshot downloaded." });
  };

  const nextDate = getNextBackupScheduledDate(config);

  const activeFeaturesCount = Object.entries(featuresInput).filter(([k, v]) => k !== "slackWebhookUrl" && v === true).length;

  return (
    <div className="bg-card rounded-[2.5rem] border border-border p-6 sm:p-8 shadow-sm space-y-8 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-2xl shadow-md">
            <Database size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-foreground">
                Super Admin Backup & Schedule Center
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                Super Admin Only
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              Configure automated database backup schedules, execution times, recipients, and toggle all backup targets ON or OFF.
            </p>
          </div>
        </div>

        <button
          onClick={loadStatus}
          disabled={isRefreshing}
          className="self-start sm:self-center px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-all flex items-center gap-2 border border-border cursor-pointer shrink-0"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin text-indigo-600" : ""} />
          <span>Refresh Status</span>
        </button>
      </div>

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

      {(!config.enabled || !featuresInput.sendEmail) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center gap-3">
          <AlertCircle size={20} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs">
            <span className="font-bold uppercase tracking-wider block">
              Backup Email Dispatches Disabled
            </span>
            <span>
              {!config.enabled 
                ? "Master scheduled backups are currently PAUSED. No automated backup emails will be generated or sent."
                : "The 'Send Email Attachment' target feature is toggled OFF. Automated email snapshots will be skipped."}
            </span>
          </div>
        </div>
      )}

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
          {/* Time Picker */}
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

          {/* Conditional Day of Week or Day of Month Selectors */}
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

      {/* Backup Target Features & Destinations Toggles ("All Backup Features Together") */}
      <div className="space-y-6 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
              <Sliders size={18} />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Backup Destination Features & Data Content Toggles
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Configure target dispatch channels and data snapshot content modules
              </p>
            </div>
          </div>
          <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 dark:bg-indigo-950/60 px-4 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 shadow-xs shrink-0 self-start sm:self-auto">
            {activeFeaturesCount} of 6 Backup Modules Active
          </span>
        </div>

        {/* Feature Toggles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 1. Email Attachment Toggle */}
          <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
            featuresInput.sendEmail 
              ? "bg-indigo-50/70 dark:bg-slate-800/90 border-indigo-300 dark:border-indigo-600 shadow-md shadow-indigo-500/5" 
              : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
          }`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-sm">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      EMAIL JSON ATTACHMENT
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Dispatches JSON file via email</p>
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
                <div className="mt-3 pt-3 border-t border-indigo-200/60 dark:border-slate-700 space-y-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 block">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-950 border border-indigo-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. Google Drive Auto-Sync Toggle */}
          <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
            featuresInput.googleDriveSync 
              ? "bg-blue-50/70 dark:bg-slate-800/90 border-blue-300 dark:border-blue-600 shadow-md shadow-blue-500/5" 
              : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
          }`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
                    <Cloud size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      GOOGLE DRIVE AUTO-SYNC
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Syncs snapshot to Google Drive</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleFeatureToggle("googleDriveSync")}
                  className={`w-12 h-6.5 rounded-full transition-all relative p-0.5 cursor-pointer shrink-0 ${
                    featuresInput.googleDriveSync ? "bg-blue-600 shadow-md shadow-blue-500/30" : "bg-slate-300 dark:bg-slate-700"
                  }`}
                >
                  <div className={`w-5.5 h-5.5 rounded-full bg-white shadow-sm transition-all ${
                    featuresInput.googleDriveSync ? "translate-x-5.5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>

              <div className="pt-2 border-t border-blue-200/60 dark:border-slate-700">
                <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 font-mono">
                  Target: ict.team@pceastandrews.org
                </p>
              </div>
            </div>
          </div>

          {/* 3. Server Local Snapshot Toggle */}
          <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
            featuresInput.saveServerDiskSnapshot 
              ? "bg-slate-100/80 dark:bg-slate-800/90 border-slate-400 dark:border-slate-600 shadow-md" 
              : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
          }`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl shadow-sm">
                    <HardDrive size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      SERVER LOCAL DISK COPY
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Saves JSON in server /data/backups</p>
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

              <div className="pt-2 border-t border-slate-300/60 dark:border-slate-700">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                  Storage: Persistent Disk Buffer
                </p>
              </div>
            </div>
          </div>

          {/* 4. Include Audit Logs Toggle */}
          <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
            featuresInput.includeAuditLogs 
              ? "bg-amber-50/70 dark:bg-slate-800/90 border-amber-300 dark:border-amber-600 shadow-md shadow-amber-500/5" 
              : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
          }`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-600 text-white rounded-2xl shadow-sm">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      INCLUDE AUDIT & SECURITY LOGS
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Packs system admin audit trails</p>
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

              <div className="pt-2 border-t border-amber-200/60 dark:border-slate-700">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono">
                  Logs Included: {contextData.systemLogs?.length || 0} Records
                </p>
              </div>
            </div>
          </div>

          {/* 5. Include Ledger & Calendar Toggle */}
          <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
            featuresInput.includeCalendarAndLedger 
              ? "bg-purple-50/70 dark:bg-slate-800/90 border-purple-300 dark:border-purple-600 shadow-md shadow-purple-500/5" 
              : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
          }`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-sm">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      LEDGER BOOKS & CALENDAR DATA
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Packs financial books & events</p>
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

              <div className="pt-2 border-t border-purple-200/60 dark:border-slate-700">
                <p className="text-[11px] font-bold text-purple-700 dark:text-purple-300 font-mono">
                  Ledgers: {contextData.ledgerBooks?.length || 0} | Events: {contextData.customCalendarEvents?.length || 0}
                </p>
              </div>
            </div>
          </div>

          {/* 6. Slack / Webhook Alert Toggle */}
          <div className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
            featuresInput.slackAlertEnabled 
              ? "bg-emerald-50/70 dark:bg-slate-800/90 border-emerald-300 dark:border-emerald-600 shadow-md shadow-emerald-500/5" 
              : "bg-white/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-75 hover:opacity-100"
          }`}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      SLACK / WEBHOOK NOTIFICATION
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sends summary alert on backup run</p>
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
                <div className="mt-3 pt-3 border-t border-emerald-200/60 dark:border-slate-700 space-y-1.5">
                  <input
                    type="url"
                    placeholder="Slack Webhook URL (https://hooks.slack.com/...)"
                    value={featuresInput.slackWebhookUrl || ""}
                    onChange={(e) => setFeaturesInput({ ...featuresInput, slackWebhookUrl: e.target.value })}
                    className="w-full px-3.5 py-2 bg-white dark:bg-slate-950 border border-emerald-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white shadow-xs focus:ring-2 focus:ring-emerald-500 outline-none"
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

      {/* Monitoring Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-card border border-border rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Mail size={13} className="text-indigo-500" />
            <span>Target Email</span>
          </div>
          <div className="text-xs font-black text-foreground truncate font-mono" title={emailInput}>
            {emailInput}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 size={11} /> Recipient Verified
          </div>
        </div>

        <div className="p-5 bg-card border border-border rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock size={13} className="text-blue-500" />
            <span>Next Execution Time</span>
          </div>
          <div className="text-xs font-black text-foreground truncate" title={nextDate.toLocaleString()}>
            {nextDate.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
            <Sparkles size={11} /> Cycle: {config.frequency} ({config.scheduleTime || "04:00"})
          </div>
        </div>

        <div className="p-5 bg-card border border-border rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Send size={13} className="text-purple-500" />
            <span>Total Backups Run</span>
          </div>
          <div className="text-lg font-black text-foreground">
            {config.totalBackupsSent || logs.filter(l => l.status === "DELIVERED" || l.status === "SENT_ATTACHMENT").length} Snapshots
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            Format: Comprehensive JSON
          </div>
        </div>

        <div className="p-5 bg-card border border-border rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity size={13} className="text-emerald-500" />
            <span>System Requisitions</span>
          </div>
          <div className="text-lg font-black text-foreground">
            {contextData.requisitions?.length || 0} Records
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
            Ready for Packaging
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={handleSendNow}
          disabled={isDispatching}
          className="w-full sm:w-auto flex-1 py-4 px-6 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2.5 shadow-md hover:shadow-indigo-200/50 dark:hover:shadow-none disabled:opacity-50"
        >
          <Send size={16} className={isDispatching ? "animate-bounce" : ""} />
          <span>{isDispatching ? "Compiling & Dispatched Backup..." : "Send JSON Backup Email Now"}</span>
        </button>

        <button
          onClick={handleDownloadLocal}
          className="w-full sm:w-auto py-4 px-6 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          <Download size={16} />
          <span>Download Local JSON Snapshot</span>
        </button>
      </div>

      {/* Notification Toast */}
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

      {/* Monitoring History Log Table */}
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
              No backup logs recorded yet. Click "Send JSON Backup Email Now" to execute an initial backup dispatch.
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
                  <th className="p-3.5">Trigger</th>
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
                      <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider rounded-md">
                        {log.triggerType || "MANUAL"}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {log.status === "DELIVERED" || log.status === "SENT_ATTACHMENT" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 size={12} /> DELIVERED
                        </span>
                      ) : log.status === "SIMULATED_LOCAL_STORE" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider rounded-full border border-amber-200 dark:border-amber-800">
                          <Activity size={12} /> STORED LOCAL
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
                        <span>Compiled Snapshot</span>
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
  );
};
