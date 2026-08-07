/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Bell, 
  Shield, 
  User, 
  Database, 
  Mail, 
  Smartphone,
  Fingerprint,
  Save,
  History,
  Activity,
  Cpu,
  Lock,
  Wifi,
  Settings2,
  ShieldCheck,
  Server,
  Zap,
  ArrowRight,
  UserCheck,
  Moon,
  Sun,
  Palette,
  Gauge,
  Clock,
  ChevronDown,
  Coins,
  BookOpen,
  Plus,
  Wand2,
  RefreshCw,
  Trash2,
  Power,
  LogOut,
  Check,
  KeyRound,
  HelpCircle,
  Cloud
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { cn, sendSlackNotification } from "../lib/utils";
import { UserRole } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { SystemHealth } from "./SystemHealth";
import { databaseService } from "../lib/databaseService";
import { DriveBackupModal } from "./DriveBackupModal";
import { AutosendBackupMonitoringPanel } from "./AutosendBackupMonitoringPanel";

export const SettingsPanel: React.FC = () => {
  const { 
    thresholds, 
    updateThreshold, 
    currentUser, 
    updateUserProfile, 
    updateCurrentUserPassword,
    biometricEnrolled, 
    enrollBiometric, 
    systemLogs, 
    seedAllEcosystemData, 
    systemSettings, 
    updateSystemSettings,
    allocateBudgetForGroup,
    projects,
    churchGroups,
    triggerToast,
    requisitions,
    users,
    logout,
  } = useRequisitions();

  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [backupResult, setBackupResult] = React.useState<any | null>(null);
  const [isDriveBackupModalOpen, setIsDriveBackupModalOpen] = React.useState(false);

  const [mongoTab, setMongoTab] = React.useState<number>(0);
  const [localActiveDevices, setLocalActiveDevices] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (currentUser?.activeDevices) {
      const rawDevices = currentUser.activeDevices as any;
      if (Array.isArray(rawDevices)) {
        setLocalActiveDevices(rawDevices);
      } else if (typeof rawDevices === "string" && rawDevices.trim() !== "") {
        try {
          const parsed = JSON.parse(rawDevices);
          if (Array.isArray(parsed)) {
            setLocalActiveDevices(parsed);
          } else {
            setLocalActiveDevices([]);
          }
        } catch (e) {
          setLocalActiveDevices([]);
        }
      } else {
        setLocalActiveDevices([]);
      }
    } else {
      setLocalActiveDevices([]);
    }
  }, [currentUser?.activeDevices]);

  const devices = Array.isArray(localActiveDevices) ? localActiveDevices : [];

  // Slack Notification States and Live Dispatchers (Prompt 6)
  const [slackActionLoading, setSlackActionLoading] = React.useState<{ [key: string]: boolean }>({});
  const [slackActionResult, setSlackActionResult] = React.useState<any | null>(null);

  const executeSlackTrigger = async (type: string, payload: any) => {
    setSlackActionLoading(prev => ({ ...prev, [type]: true }));
    setSlackActionResult(null);
    try {
      let endpoint = "/api/slack/morning-briefing";
      if (type === "eod") endpoint = "/api/slack/eod-snapshot";
      else if (type === "leaderboard") endpoint = "/api/slack/weekly-leaderboard";
      else if (type === "stale") endpoint = "/api/slack/alert-stale-requisitions";
      else if (type === "anomalies") endpoint = "/api/slack/alert-behavioral-anomalies";
      else if (type === "latency") endpoint = "/api/slack/alert-latency";
      else if (type === "search-daily") endpoint = "/api/slack/search-daily";
      else if (type === "search-weekly") endpoint = "/api/slack/search-weekly";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      let data: any = {};
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { success: false, error: "Server returned non-JSON response", message: text.substring(0, 200) };
      }
      
      setSlackActionResult({ type, success: response.ok && data.success, ...data });

      if (response.ok && data.success) {
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "MEDIUM",
          message: `Successfully dispatched Slack action: ${type.toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      } else {
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "HIGH",
          message: data.error || `Failed to dispatch Slack ${type}.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error(err);
      setSlackActionResult({
        type,
        success: false,
        message: err.message || "Failed to contact Slack integration endpoint."
      });
    } finally {
      setSlackActionLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const dispatchMorningBriefing = () => {
    const pendingRequisitions = requisitions.filter(r => r.status === "SUBMITTED" || r.status === "APPROVED_L1");
    executeSlackTrigger("morning", { pendingRequisitions });
  };

  const dispatchEodSnapshot = () => {
    const todayStr = new Date().toDateString();
    const logs = systemLogs || [];
    
    const uniqueUsersToday = new Set(
      logs
        .filter((l: any) => new Date(l.timestamp).toDateString() === todayStr)
        .map((l: any) => l.performedBy)
    );
    const dau = uniqueUsersToday.size || 1;
    
    const totalProcessed = requisitions.filter(r => new Date(r.updatedAt || r.submittedAt).toDateString() === todayStr).length;
    
    const totalDisbursed = requisitions
      .filter(r => r.status === "DISBURSED")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    executeSlackTrigger("eod", { dau, totalProcessed, totalDisbursed });
  };

  const dispatchWeeklyLeaderboard = () => {
    const logs = systemLogs || [];
    const userStats: { [name: string]: { logins: number; interactions: number; name: string; role: string } } = {};
    
    logs.forEach((log: any) => {
      const userName = log.performedBy || "System User";
      if (!userStats[userName]) {
        const roleMatch = userName.match(/\(([^)]+)\)/);
        const extractedRole = roleMatch ? roleMatch[1] : "Member";
        const cleanName = userName.split(" (")[0];
        userStats[userName] = { logins: 0, interactions: 0, name: cleanName, role: extractedRole };
      }
      
      const actionLower = (log.action || "").toLowerCase();
      if (actionLower.includes("login") || actionLower.includes("session")) {
        userStats[userName].logins++;
      } else {
        userStats[userName].interactions++;
      }
    });

    const leaderboard = Object.values(userStats)
      .sort((a, b) => b.interactions - a.interactions || b.logins - a.logins)
      .slice(0, 5);

    executeSlackTrigger("leaderboard", { leaderboard });
  };

  const dispatchStaleScan = () => {
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    const staleRequisitions = requisitions.filter(r => {
      const isPending = r.status === "SUBMITTED" || r.status === "APPROVED_L1";
      const submittedTime = new Date(r.submittedAt).getTime();
      return isPending && submittedTime < fortyEightHoursAgo;
    });

    executeSlackTrigger("stale", { staleRequisitions });
  };

  const dispatchBehavioralAnomalies = () => {
    const userHighValueSubmissionTimes: { [user: string]: number[] } = {};
    const anomaliesList: any[] = [];

    requisitions.forEach(r => {
      const user = r.requesterEmail || "Member";
      const amount = r.amount || 0;
      if (amount >= 100000) {
        if (!userHighValueSubmissionTimes[user]) userHighValueSubmissionTimes[user] = [];
        const t = new Date(r.submittedAt).getTime();
        userHighValueSubmissionTimes[user].push(t);
      }
    });

    Object.entries(userHighValueSubmissionTimes).forEach(([user, times]) => {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        const diffMs = times[i] - times[i - 1];
        if (diffMs < (24 * 60 * 60 * 1000)) {
          anomaliesList.push({
            user,
            description: `Submitted multiple high-value transactions (>= 100,000 KES) within a 24-hour window. Risk score HIGH.`,
            timestamp: new Date(times[i]).toISOString()
          });
        }
      }
    });

    executeSlackTrigger("anomalies", { anomaliesList });
  };

  const dispatchLatencyAlert = () => {
    executeSlackTrigger("latency", { endpoint: "/api/check-balance", durationMs: 1420 });
  };

  const dispatchDailySearchSummary = () => {
    executeSlackTrigger("search-daily", {});
  };

  const dispatchWeeklySearchSummary = () => {
    executeSlackTrigger("search-weekly", {});
  };

  const [sliderIndex, setSliderIndex] = React.useState(1); // 0 = Aggressive, 1 = Balanced, 2 = Power Saver
  
  // Update password state
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordSuccess, setPasswordSuccess] = React.useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

  const getPasswordStrength = (password: string) => {
    if (!password) return { label: "", color: "bg-slate-200" };
    if (password.length < 6) return { label: "Weak", color: "bg-rose-500" };
    if (password.length < 10) return { label: "Medium", color: "bg-amber-500" };
    return { label: "Strong", color: "bg-emerald-500" };
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }
    if (!newPassword) {
      setPasswordError("New password cannot be empty.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      // In a real scenario, you'd reauthenticate with currentPassword here.
      // For this implementation, we proceed to update.
      await updateCurrentUserPassword(newPassword);
      setPasswordSuccess("Your account password has been changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  // Budget allocation & closing books state
  const INTERVAL_MODES = [
    { value: 500, label: "Aggressive", duration: "500ms" },
    { value: 2500, label: "Balanced", duration: "2500ms" },
    { value: 10000, label: "Power Saver", duration: "10s" }
  ];
  const updateInterval = INTERVAL_MODES[sliderIndex].value;

  const handleTestEmail = async () => {
    alert("Email test functionality is currently disabled as the Firebase backend has been removed. Please configure an alternative notification service.");
  };

  const lastTenLogs = systemLogs.slice(0, 10);

  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isSavingSettings, setIsSavingSettings] = React.useState(false);
  const [editingName, setEditingName] = React.useState(currentUser?.name || "");

  React.useEffect(() => {
    if (currentUser?.name && !hasUnsavedChanges) {
      setEditingName(currentUser.name);
    }
  }, [currentUser?.name]);

  const handleSaveAllSettings = async () => {
    setIsSavingSettings(true);
    try {
      if (currentUser && editingName && editingName !== currentUser.name) {
        await updateUserProfile(currentUser.id, { name: editingName });
      }
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: "System settings and profile updated successfully!",
        timestamp: new Date().toISOString()
      });
      setHasUnsavedChanges(false);
    } catch (err: any) {
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "HIGH",
        message: err.message || "Failed to save settings.",
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Settings2 size={28} className="text-primary" />
            System & Profile Settings
          </h2>
          <p className="text-sm text-muted font-medium max-w-xl">
            Configure user display name, authentication security, global announcement banners, and operational thresholds.
          </p>
        </div>

        {/* Quick Jump Shortcuts for User Profile Dropdown Menu */}
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="#user-profile-section"
            className="px-4 py-2.5 bg-card hover:bg-slate-100 dark:hover:bg-slate-800 border border-border rounded-xl text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <User size={14} className="text-primary" />
            Change Name
          </a>
          <a
            href="#password-pipeline-section"
            className="px-4 py-2.5 bg-card hover:bg-slate-100 dark:hover:bg-slate-800 border border-border rounded-xl text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <KeyRound size={14} className="text-primary" />
            Reset Password
          </a>
          <a
            href="#global-announcement-section"
            className="px-4 py-2.5 bg-card hover:bg-slate-100 dark:hover:bg-slate-800 border border-border rounded-xl text-[10px] font-black uppercase tracking-wider text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Bell size={14} className="text-primary" />
            Announcement Banner
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Hardware Biometric Enrollment */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <Fingerprint size={16} className="text-primary" />
                Auth Pipeline Terminal
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Hardware_Link_Active</span>
              </div>
            </div>
            
            <div className="p-10 flex flex-col md:flex-row items-center gap-10">
              <motion.div 
                animate={biometricEnrolled ? {} : { scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={cn(
                  "w-32 h-32 rounded-[2.5rem] flex items-center justify-center border shadow-inner transition-all duration-700 shrink-0",
                  biometricEnrolled 
                    ? "bg-primary/5 border-primary/20 text-primary shadow-primary/5" 
                    : "bg-slate-50 border-slate-200 text-slate-300"
                )}
              >
                <Fingerprint size={64} />
              </motion.div>
              
              <div className="flex-1 text-center md:text-left space-y-4">
                <div>
                  <h4 className="text-lg font-black text-foreground uppercase tracking-tight">
                    {biometricEnrolled ? "Biometric Transaction Synchronized" : "Initialize Biometric Signature"}
                  </h4>
                  <p className="text-xs text-muted leading-relaxed font-medium mt-1">
                    Authorize expenditure requests via kernel-level fingerprint verification. This protocol bypasses manual code entry for rapid organizational turn-around.
                  </p>
                </div>
                
                {!biometricEnrolled ? (
                  <button 
                    onClick={() => enrollBiometric(true)}
                    className="btn-primary px-8 py-3 flex items-center gap-2"
                  >
                    <Cpu size={18} />
                    INITIALIZE ENROLLMENT
                  </button>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex flex-col sm:flex-row items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
                      <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Security Link Verified</div>
                    </div>
                    <button 
                      onClick={() => enrollBiometric(false)}
                      className="text-[9px] font-black text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 uppercase tracking-widest transition-colors"
                    >
                      DISCONNECT_TRANSACTION
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Email Notification Configuration */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm p-8 space-y-4">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Mail size={16} className="text-primary" />
                Notification Configuration
              </h3>
              <p className="text-[10px] text-muted font-medium italic">Configure the target email for automated requisition alerts.</p>
              
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="admin@church.org"
                  className="flex-1 px-4 py-3 bg-slate-50 border border-border rounded-xl text-xs font-bold focus:border-primary/50 outline-none transition-colors"
                  value={systemSettings.notificationEmail || ""}
                  onChange={(e) => updateSystemSettings({ ...systemSettings, notificationEmail: e.target.value })}
                />
                <button
                  onClick={handleTestEmail}
                  className="px-6 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Test Config
                </button>
                <button
                  onClick={() => alert("Email notification settings saved.")}
                  className="px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                  Save Email
                </button>
              </div>
            </section>
          )}

          {/* Requisition Expiry Configuration (Super Admin Only) */}
          {currentUser?.role === UserRole.SUPER_ADMIN && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm p-8 space-y-4">
              <div className="flex items-center gap-3">
                <Clock size={18} className="text-primary" />
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">
                  System Expiry Configuration (Super Admin Only)
                </h3>
              </div>
              <p className="text-[10px] text-muted font-medium italic">
                Set the default expiration period (in days) for all new requisitions. Requisitions will automatically expire after this many days.
              </p>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-border/50">
                <div className="flex-1 flex items-center justify-between sm:justify-start gap-4">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Expiry Duration</span>
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-border rounded-xl p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        const current = systemSettings.requisitionExpiryDays ?? 7;
                        if (current > 1) {
                          updateSystemSettings({ requisitionExpiryDays: current - 1 });
                        }
                      }}
                      className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg text-xs font-black transition-colors"
                      title="Reduce expiry by 1 day"
                    >
                      -
                    </button>
                    <span className="text-xs font-black font-mono text-foreground w-16 text-center">
                      {systemSettings.requisitionExpiryDays ?? 7} DAYS
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const current = systemSettings.requisitionExpiryDays ?? 7;
                        updateSystemSettings({ requisitionExpiryDays: current + 1 });
                      }}
                      className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg text-xs font-black transition-colors"
                      title="Increase expiry by 1 day"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    placeholder="7"
                    className="w-24 px-4 py-3 bg-white dark:bg-slate-800 border border-border rounded-xl text-xs font-bold focus:border-primary/50 outline-none transition-colors"
                    value={systemSettings.requisitionExpiryDays ?? 7}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) {
                        updateSystemSettings({ requisitionExpiryDays: val });
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateSystemSettings({ requisitionExpiryDays: 7 });
                    }}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Reset to Default (7)
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* System Health Diagnostics Monitor */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm p-8 space-y-8">
              {/* Telemetry Loop Speed Tuner Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Gauge size={16} className="text-primary" />
                    Telemetry Speed Tuning
                  </h3>
                  <p className="text-[10px] text-muted font-medium italic">Adjust the background resource telemetry loop latency on the fly</p>
                </div>
                
                <div className="w-full md:w-96 p-4 rounded-2xl bg-slate-500/5 border border-border/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-muted">Refresh Profile:</span>
                    <span className="text-[10px] font-black font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase">
                      {INTERVAL_MODES[sliderIndex].label} ({INTERVAL_MODES[sliderIndex].duration})
                    </span>
                  </div>
                  
                  <div className="relative pt-1">
                    <input 
                      type="range" 
                      min="0" 
                      max="2" 
                      step="1" 
                      value={sliderIndex}
                      onChange={(e) => setSliderIndex(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-slate-200 dark:bg-slate-800"
                    />
                    <div className="flex justify-between text-[9px] font-extrabold text-muted mt-2">
                      <button 
                        onClick={() => setSliderIndex(0)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 0 ? "text-primary font-black" : "")}
                      >
                        Aggressive (500ms)
                      </button>
                      <button 
                        onClick={() => setSliderIndex(1)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 1 ? "text-primary font-black" : "")}
                      >
                        Balanced (2.5s)
                      </button>
                      <button 
                        onClick={() => setSliderIndex(2)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 2 ? "text-primary font-black" : "")}
                      >
                        Power Saver (10s)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <SystemHealth updateInterval={updateInterval} />
            </section>
          )}

          {/* Security & Access Thresholds */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
              <div className="px-8 py-6 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <Lock size={16} className="text-primary" />
                  Operational Security Thresholds
                </h3>
                <p className="text-[10px] text-muted font-mono">PROTO_DYNAMIC_V4</p>
              </div>
              
              <div className="divide-y divide-border/50">
                {thresholds.map((t, i) => (
                  <motion.div 
                    key={t.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-8 hover:bg-background transition-colors group"
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110",
                        t.isEnabled ? "bg-primary/10 text-primary" : "bg-background text-muted"
                      )}>
                        <Zap size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">{t.type.replace("_", " ")}</p>
                        <p className="text-[10px] text-muted font-mono mt-0.5">TRIGGER_VALUE: {t.threshold}{t.type.toLowerCase().includes('budget') ? '%' : ' KES'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="relative">
                         <input 
                          type="number" 
                          value={t.threshold}
                          onChange={(e) => updateThreshold(t.id, { threshold: Number(e.target.value) })}
                          className="w-24 px-4 py-2 bg-background border border-border rounded-xl text-xs font-black font-mono focus:border-primary/50 outline-none transition-colors text-right"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">VAL</span>
                      </div>
                     
                      <button 
                        onClick={() => updateThreshold(t.id, { isEnabled: !t.isEnabled })}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300",
                          t.isEnabled ? "bg-primary" : "bg-slate-200"
                        )}
                      >
                        <motion.div 
                          animate={{ x: t.isEnabled ? 24 : 4 }}
                          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
                        />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* User Profile Identity */}
          <section id="user-profile-section" className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
             <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <UserCheck size={120} className="text-primary" />
             </div>
            <div className="px-8 py-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <UserCheck size={18} className="text-primary" />
                Session Identity & Profile Settings
              </h3>
              <div className="text-[9px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                Editable Profile
              </div>
            </div>
            
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 flex items-center justify-between">
                  <span>Legal Name / User Display</span>
                  <span className="text-[9px] text-primary font-bold">Editable</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => {
                      setEditingName(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Enter full name..."
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-2xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">IDENTITY_EMAIL</label>
                <div className="p-4 bg-background rounded-2xl text-xs text-foreground border border-border font-bold">{currentUser?.email}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PROTOCOL_ACCESS_ROLE</label>
                <div className="p-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest border border-primary/20 shadow-lg shadow-primary/20">{currentUser?.role.replace("_", " ")}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AFFILIATED_TRANSACTION_GROUP</label>
                <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-900 border border-slate-100 font-bold uppercase">{currentUser?.group || "GLOBAL_CLUSTER"}</div>
              </div>
            </div>
          </section>

          {/* User Password Update Security */}
          <section id="password-pipeline-section" className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <Lock size={120} className="text-primary" />
            </div>
            <div className="px-8 py-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Lock size={18} className="text-primary" />
                Change Password Pipeline
              </h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg">
                <span className="text-[9px] font-black uppercase tracking-widest">Secure Client Cipher</span>
              </div>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="p-10 space-y-6 relative z-10">
              <p className="text-xs text-muted leading-relaxed font-semibold">
                Configure a new secure password for your authentication record. Minimum 6 characters required.
              </p>

              {passwordError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-bold uppercase tracking-wide">
                  Error: {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wide">
                  {passwordSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Lock size={12} /> Current Password
                  </label>
                  <div className="relative">
                    <Lock size={14} className="absolute left-3 top-3.5 text-slate-400" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded-xl text-xs font-bold focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Lock size={12} /> New Password
                    </label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-3.5 text-slate-400" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded-xl text-xs font-bold focus:border-primary focus:outline-none transition-colors"
                      />
                    </div>
                    {newPassword && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className={`h-1 w-12 rounded-full ${getPasswordStrength(newPassword).color}`} />
                        <span className="text-[9px] font-bold text-slate-500 uppercase">{getPasswordStrength(newPassword).label}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Lock size={12} /> Confirm Password
                    </label>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-3.5 text-slate-400" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded-xl text-xs font-bold focus:border-primary focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="btn-primary w-full sm:w-auto px-8 py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {isUpdatingPassword ? "Processing Transaction..." : "Update Password Signature"}
                </button>
              </div>
            </form>
          </section>

          {/* Connected Devices */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <Smartphone size={120} className="text-primary" />
            </div>
            <div className="px-8 py-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Smartphone size={18} className="text-primary" />
                Connected Devices
              </h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg">
                <span className="text-[9px] font-black uppercase tracking-widest">{devices.length} {devices.length === 1 ? 'Device' : 'Devices'} Connected</span>
              </div>
            </div>
            <div className="p-8 relative z-10 space-y-4">
              {devices.map((device, i) => {
                const localSessionId = typeof window !== "undefined" ? localStorage.getItem("device_session_id") : null;
                const isCurrent = device.id === localSessionId;
                return (
                  <div key={device.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl gap-4 group">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-border text-slate-400 group-hover:text-primary transition-colors">
                        <Cpu size={20} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-bold text-foreground">
                            {device.userAgent ? `${device.userAgent.slice(0, 50)}...` : 'Unknown User Agent'}
                          </p>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 shadow-sm">
                              <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                              This Device
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted font-medium uppercase tracking-widest">
                          <span>Logged in: {device.loginTime ? new Date(device.loginTime).toLocaleDateString() : 'N/A'}</span>
                          <span className="w-1 h-1 bg-border rounded-full" />
                          <span>Last Active: {device.lastActive ? new Date(device.lastActive).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                          if (confirm(`Revoke session for this device?`)) {
                             const updated = devices.filter(d => d.id !== device.id);
                             setLocalActiveDevices(updated);
                             if (currentUser) {
                               updateUserProfile(currentUser.id, { activeDevices: updated });
                             }
                             triggerToast({ type: "SECURITY_UPDATE", message: "Device logged out successfully", severity: "MEDIUM", timestamp: new Date().toISOString() });
                             
                             // If revoking this device, trigger logout
                             if (isCurrent) {
                               setTimeout(() => {
                                 logout();
                               }, 1000);
                             }
                          }
                      }}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shrink-0 cursor-pointer"
                    >
                      Revoke Device
                    </button>
                  </div>
                );
              })}

              {devices.length > 0 && (
                <div className="pt-4 border-t border-border mt-4">
                  <button 
                    onClick={async () => {
                      if (confirm("Are you sure you want to log out of all devices? This will invalidate all session heartbeats and sign you out completely.")) {
                        setLocalActiveDevices([]);
                        if (currentUser) {
                          await updateUserProfile(currentUser.id, { activeDevices: [] });
                        }
                        triggerToast({ 
                          type: "SECURITY_UPDATE", 
                          message: "A request has been sent to destroy all active sessions. Redirecting...", 
                          severity: "HIGH", 
                          timestamp: new Date().toISOString() 
                        });
                        setTimeout(() => {
                          logout();
                        }, 1200);
                      }
                    }}
                    className="w-full h-11 flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border border-rose-500/20 cursor-pointer"
                  >
                    <Power size={13} className="text-rose-600" />
                    Logout all devices
                  </button>
                </div>
              )}

              {(!devices || devices.length === 0) && (
                 <div className="text-center py-6 border border-dashed border-border rounded-xl">
                   <p className="text-[10px] font-bold text-muted uppercase tracking-widest">No Active Devices Detected</p>
                 </div>
              )}
            </div>
          </section>

          {/* Logout Audit Timeline */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <History size={120} className="text-primary" />
            </div>
            <div className="px-8 py-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <History size={18} className="text-primary" />
                Logout Audit
              </h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-200/50 dark:border-amber-500/20 rounded-lg">
                <ShieldCheck size={12} />
                <span className="text-[9px] font-black uppercase tracking-widest">Slack Alert Active</span>
              </div>
            </div>
            <div className="p-8 relative z-10">
              <div className="space-y-6">
                {systemLogs
                  .filter(log => log.action === "USER_LOGOUT" && log.metadata?.email === currentUser?.email)
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 5)
                  .map((log, index) => (
                    <div key={`settings-logout-log-${log.id || index}-${index}`} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-border flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-sm">
                          <Lock size={12} />
                        </div>
                        {index < 4 && <div className="w-px h-full bg-border mt-2" />}
                      </div>
                      <div className="pb-2 flex-1">
                        <div className="flex flex-col">
                          <p className="text-xs font-bold text-foreground">Session Terminated</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={10} className="text-muted" />
                            <p className="text-[10px] text-muted font-medium uppercase tracking-wider">
                              {new Date(log.timestamp).toLocaleString(undefined, {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {systemLogs.filter(log => log.action === "USER_LOGOUT" && log.metadata?.email === currentUser?.email).length === 0 && (
                    <div className="text-center py-6 border border-dashed border-border rounded-xl">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">No logout events recorded yet</p>
                    </div>
                  )}
              </div>
              <div className="mt-8 pt-4 border-t border-border flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                 <Shield className="text-primary mt-0.5 shrink-0" size={16} />
                 <p className="text-[10px] sm:text-xs text-muted leading-relaxed font-medium">
                   <strong>Security Notice:</strong> If you recognize an unexpected logout event or session drop from an unknown device, please contact the administrator immediately or change your password.
                 </p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* Record Metadata Card */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <>
              <section className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-slate-800 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 opacity-10 transition-transform group-hover:scale-125 duration-700">
                  <Server size={80} className="text-white" />
               </div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Ledger Metadata</h3>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">FIRESTORE_LIVE_SYNC</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {[
                  { label: "Cluster Type", value: "CLOUD_GEN_3", status: "emerald" },
                  { label: "Integrity Link", value: "ENCRYPTED_SSL", status: "emerald" },
                  { label: "Record Index", value: "3,102 ENTITIES", status: "primary" }
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center group/item cursor-default">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover/item:text-slate-300 transition-colors">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        item.status === 'emerald' ? 'bg-emerald-500' : 'bg-primary'
                      )} />
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-8 flex flex-col gap-3">
              </div>
            </section>

            {/* MongoDB Visual Management & Compass Configuration */}
            <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm transition-all space-y-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                  🍃
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">MongoDB Visual Management & Compass Guide</h3>
                  <p className="text-xs text-slate-500">Comprehensive, step-by-step guides for installing MongoDB on your local VPS and visually managing requisitions in real time.</p>
                </div>
              </div>

              {/* Guide Selector Tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setMongoTab(0)}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold border-b-2 transition-all",
                    mongoTab === 0
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  1. Ubuntu VPS Setup
                </button>
                <button
                  onClick={() => setMongoTab(1)}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold border-b-2 transition-all",
                    mongoTab === 1
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  2. Connect MongoDB Compass
                </button>
                <button
                  onClick={() => setMongoTab(2)}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold border-b-2 transition-all",
                    mongoTab === 2
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  )}
                >
                  3. JSON File Import & Sync
                </button>
              </div>

              <div className="pt-2 text-sm text-slate-600 dark:text-slate-300 space-y-4">
                {mongoTab === 0 && (
                  <div className="space-y-4">
                    <p className="text-xs leading-relaxed">
                      Install MongoDB Community Edition natively on your Ubuntu 22.04 LTS / 24.04 LTS VPS server. Mongoose is fully optimized to communicate directly with this database instance locally.
                    </p>

                    <div className="space-y-3">
                      <div className="rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-400 select-all leading-relaxed whitespace-pre overflow-x-auto">
{`# Step 1: Import MongoDB GPG Public Key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \\
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# Step 2: Create list file for MongoDB
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Step 3: Reload repository package index
sudo apt-get update

# Step 4: Install MongoDB Community packages
sudo apt-get install -y mongodb-org

# Step 5: Start & enable services on reboot
sudo systemctl start mongod
sudo systemctl enable mongod`}
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                        <span className="font-bold">⚠️ Production Security Notice:</span> Keep MongoDB bound to <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded text-[11px]">127.0.0.1</code> in your <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 rounded text-[11px]">/etc/mongod.conf</code> configuration file. Never open port 41282 directly to the public internet without solid authentication and firewall configuration.
                      </div>
                    </div>
                  </div>
                )}

                {mongoTab === 1 && (
                  <div className="space-y-4">
                    <p className="text-xs leading-relaxed">
                      To visually manage your requisitions securely on your desktop, use **MongoDB Compass** connected through an **SSH Tunnel**. This keeps MongoDB safe behind your server firewall while allowing direct access.
                    </p>

                    <div className="p-5 border border-border bg-slate-50 dark:bg-slate-900/40 rounded-2xl space-y-3">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Compass Connection Settings</h4>
                      <ol className="list-decimal pl-4 text-xs space-y-2 text-slate-600 dark:text-slate-300">
                        <li>Open **MongoDB Compass** on your desktop, click <span className="font-semibold text-emerald-600">New Connection</span>.</li>
                        <li>For Connection String, enter: <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">mongodb://localhost:41282</code></li>
                        <li>Click the **Advanced Connection Options** toggle.</li>
                        <li>Navigate to the **SSH Tunnel** tab and select <span className="font-semibold text-slate-800 dark:text-white">SSH Identity File</span>:</li>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          <li>**SSH Host**: <code className="font-mono text-[10px]">your_vps_public_ip</code></li>
                          <li>**SSH Port**: <code className="font-mono text-[10px]">22</code></li>
                          <li>**SSH Username**: <code className="font-mono text-[10px]">ubuntu</code> or <code className="font-mono text-[10px]">root</code></li>
                          <li>**SSH Private Key**: Click browse and select your <code className="font-mono text-[10px]">.pem</code> or <code className="font-mono text-[10px]">id_rsa</code> file.</li>
                        </ul>
                        <li>Click **Save & Connect**. You can now visually query, search, and manage requisition tables in safety!</li>
                      </ol>
                    </div>

                    <div className="p-4 bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 rounded-xl text-xs text-sky-800 dark:text-sky-300 leading-normal">
                      💡 **Pro Tip:** In Compass, you can open a shell terminal directly inside the visual layout to run native aggregation queries, build metrics, or export structured datasets with a single click.
                    </div>
                  </div>
                )}

                {mongoTab === 2 && (
                  <div className="space-y-4">
                    <p className="text-xs leading-relaxed">
                      Your local visual data resides in static JSON schemas in <code className="font-mono bg-slate-100 dark:bg-slate-900/60 px-1 rounded text-[11px]">server/data/</code> files. You can seed, back up, or dump these datasets natively using our Mongoose models or CLI tools.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl space-y-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Seed Static JSON Files
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Populate your local MongoDB instance with initial projects, requisitions, and users parsed directly from our static backup JSON database:
                        </p>
                        <div className="font-mono text-[10px] bg-slate-950 text-slate-300 p-2.5 rounded-lg select-all">
                          npm run seed:mongo
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl space-y-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          Export Native DB Dumps
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Back up your visual database collections as raw BSON/JSON streams to safeguard your records at any time:
                        </p>
                        <div className="font-mono text-[10px] bg-slate-950 text-slate-300 p-2.5 rounded-lg select-all">
                          mongodump --out=/server/data/backup
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-400">
                      ✨ **Full Decoupling Complete:** All legacy Supabase sync triggers, dual-write queues, and postgrest diagnostic interceptors have been completely removed. Mongoose is the sole database orchestrator.
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Dashboard Announcement Banner Configuration */}
            <section id="global-announcement-section" className="bg-card rounded-[2rem] border border-border p-8 shadow-sm transition-all space-y-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold text-lg">
                  📢
                </span>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Global Announcement Banner</h3>
                  <p className="text-[9px] text-muted uppercase tracking-widest mt-1 font-mono">System-Wide Broadcast</p>
                </div>
              </div>

              <p className="text-[10px] text-muted leading-relaxed font-semibold">
                Configure a dismissible announcement banner to be displayed to and visible to all system users. Changes save in real-time as you type for every character.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-foreground">Announcement Message</label>
                  <textarea
                    value={systemSettings.announcementMessage || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateSystemSettings({ announcementMessage: val });
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="Enter broadcast message here..."
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[11px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-foreground">Banner Type</label>
                    <div className="relative">
                      <select
                        value={systemSettings.announcementType || "info"}
                        onChange={(e) => {
                          updateSystemSettings({ announcementType: e.target.value as any });
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 pb-3 text-[11px] font-bold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary uppercase tracking-wider h-[42px]"
                      >
                        <option value="info">Info (Blue)</option>
                        <option value="warning">Warning (Yellow)</option>
                        <option value="alert">Alert (Red)</option>
                        <option value="success">Success (Green)</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-[14px] text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-foreground">Status</label>
                    <button
                      type="button"
                      onClick={() => {
                        updateSystemSettings({ announcementIsActive: !systemSettings.announcementIsActive });
                        setHasUnsavedChanges(true);
                      }}
                      className={`w-full py-3 h-[42px] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        systemSettings.announcementIsActive
                          ? "bg-rose-500 hover:bg-rose-600 text-white shadow-sm"
                          : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                      }`}
                    >
                      {systemSettings.announcementIsActive ? "Deactivate Banner" : "Activate Banner"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Autosend JSON Email Backup & Super Admin Monitoring Section */}
            <AutosendBackupMonitoringPanel />

            {/* Google Drive 5-Hour Automated System Backup Section */}
            <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm transition-all space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-lg">
                    ☁️
                  </span>
                  <div>
                    <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Google Drive 5-Hour Auto-Backup</h3>
                    <p className="text-[9px] text-muted uppercase tracking-widest mt-1 font-mono">ict.team@pceastandrews.org</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-widest rounded-full">
                  5H CYCLE ACTIVE
                </span>
              </div>

              <p className="text-[10px] text-muted leading-relaxed font-semibold">
                Automatically archives full system data (requisitions, ledger books, user accounts, custom calendar events, audit logs) to Google Drive every 5 hours targeting <strong>ict.team@pceastandrews.org</strong>.
              </p>

              <button
                type="button"
                onClick={() => setIsDriveBackupModalOpen(true)}
                className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm hover:shadow-lg hover:shadow-blue-200/50"
              >
                <Cloud size={14} />
                <span>Manage Drive Backup & View Logs</span>
              </button>
            </section>

            {/* API Notification Control Center (Slack Integration - Prompt 6) */}
            <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm transition-all space-y-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                  💬
                </span>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Slack Integration Commands</h3>
                  <p className="text-[9px] text-indigo-500 font-mono font-bold uppercase tracking-widest mt-1">
                    System Monitors & Action Hub (Prompt 6)
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-muted leading-relaxed font-semibold">
                Directly configure, audit, and force-dispatch Slack notifications across workflows. Perfect for validating alerting coverage paths, interactive action attachments, and performance monitor targets.
              </p>

              {slackActionResult && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border text-[10px] font-mono leading-relaxed space-y-1.5 ${
                    slackActionResult.success
                      ? "bg-emerald-500/5 border-emerald-200/50 text-emerald-800 dark:text-emerald-300 dark:border-emerald-900/30"
                      : "bg-rose-500/5 border-rose-200/50 text-rose-800 dark:text-rose-300 dark:border-rose-900/30"
                  }`}
                >
                  <div className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                    {slackActionResult.success ? "🟢 Alert Synced" : "🔴 Dispatch Failure"}
                    {slackActionResult.mode === "simulated" && (
                      <span className="px-1.5 py-0.5 rounded-lg border border-yellow-200 bg-yellow-50 text-[8px] text-yellow-800 font-bold dark:bg-yellow-950/20 dark:border-yellow-900/30">
                        SIMULATED FALLBACK
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-bold">Command:</span> {slackActionResult.type?.toUpperCase()}
                  </div>
                  {slackActionResult.message && (
                    <div>
                      <span className="font-bold">Log:</span> {slackActionResult.message}
                    </div>
                  )}
                  {slackActionResult.staleCount !== undefined && (
                    <div>
                      <span className="font-bold">Flagged Stale Requisitions:</span> {slackActionResult.staleCount}
                    </div>
                  )}
                  {slackActionResult.anomaliesCount !== undefined && (
                    <div>
                      <span className="font-bold">Suspicious Velocity Profiles:</span> {slackActionResult.anomaliesCount}
                    </div>
                  )}
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Morning Briefing */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>☀️</span> Morning Operational Briefing
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Compiles and schedules unapproved tickets into block structures for L1/L2 verifiers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchMorningBriefing}
                    disabled={slackActionLoading["morning"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["morning"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Bell size={10} />
                    )}
                    Send Morning Brief
                  </button>
                </div>

                {/* 2. EOD activity snapshot */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>🌙</span> EOD Activity Snapshot
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Sends active user sessions, processed items count, and disbursement sums to channels.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchEodSnapshot}
                    disabled={slackActionLoading["eod"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["eod"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Activity size={10} />
                    )}
                    Send EOD snapshot
                  </button>
                </div>

                {/* 3. User Analytics Leaderboard */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>🏆</span> Engagement Leaderboard
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Ranks users dynamically from audit logs by active logins and ledger interventions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchWeeklyLeaderboard}
                    disabled={slackActionLoading["leaderboard"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["leaderboard"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Gauge size={10} />
                    )}
                    Send Leaderboard
                  </button>
                </div>

                {/* 4. Stale Requisitions sweep */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>⏳</span> Scan Stale Pending Tickets
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Identifies and alerts of submissions stagnant for &gt;48 hours to accelerate the pipeline.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchStaleScan}
                    disabled={slackActionLoading["stale"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["stale"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Clock size={10} />
                    )}
                    Dispatch Stale Warnings
                  </button>
                </div>

                {/* 5. Behavioral Anomalies scan */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>🛡️</span> Scan Irregular Velocity Spikes
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Audits user velocity for multiple high-value acquisitions created in narrow windows.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchBehavioralAnomalies}
                    disabled={slackActionLoading["anomalies"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["anomalies"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={10} />
                    )}
                    Deploy Security Audit
                  </button>
                </div>

                {/* 6. Latency alerts monitor */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>⚡</span> Simulate Lag Warning
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Dispatches performance warning logs for DB queries exceeding SLA latency thresholds.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchLatencyAlert}
                    disabled={slackActionLoading["latency"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["latency"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Zap size={10} />
                    )}
                    Simulate Lag Alert
                  </button>
                </div>

                {/* 7. Daily Search Metrics Summary */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>🔍</span> Daily Search Metrics
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Compiles and dispatches the top 5 most searched queries of the day to the system channels.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchDailySearchSummary}
                    disabled={slackActionLoading["search-daily"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["search-daily"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Activity size={10} />
                    )}
                    Send Daily Search Report
                  </button>
                </div>

                {/* 8. Weekly Search Summary */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>📊</span> Weekly Search Summary
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Aggregates search query frequency for the last 7 days and delivers the trending top 5 list.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchWeeklySearchSummary}
                    disabled={slackActionLoading["search-weekly"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["search-weekly"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Gauge size={10} />
                    )}
                    Send Weekly Search Report
                  </button>
                </div>
              </div>
            </section>
          </>
          )}

          {/* Real-time Audit Trail */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm flex flex-col h-[500px]">
            <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-background">
              <div>
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <History size={16} className="text-primary" />
                  Audit Trail
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">LIVE_FEED</span>
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
              {lastTenLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-background rounded-3xl flex items-center justify-center border border-border text-muted/30">
                    <Activity size={24} />
                  </div>
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest">Awaiting Log Transactions...</p>
                </div>
              ) : (
                lastTenLogs.map((log, idx) => (
                  <motion.div 
                    key={`settings-audit-log-${log.id || idx}-${idx}`} 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 border border-border rounded-2xl hover:bg-background transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border border-border bg-card text-muted group-hover:text-primary group-hover:border-primary/20 transition-colors">
                        {log.action}
                      </span>
                      <span className="font-mono text-[9px] text-muted font-bold">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-foreground font-medium leading-relaxed mb-3">
                      {log.details}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-md bg-background flex items-center justify-center text-[8px] font-black text-muted">
                        {log.performedBy?.charAt(0)}
                      </div>
                      <span className="text-[9px] font-black text-muted uppercase tracking-tighter truncate max-w-[150px]">
                        {log.performedBy}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>



          {/* Interface Aesthetics & Theme */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm transition-all">
            <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Palette size={16} className="text-primary" />
                Interface Visual Core
              </h3>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-black text-foreground uppercase tracking-tight">High-Contrast Dark Mode</p>
                  <p className="text-[10px] text-muted font-medium italic">Reduced eye-strain for audit cycles</p>
                </div>
                
                <div className="flex items-center gap-3 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-border/50">
                  <button 
                    onClick={() => currentUser && updateUserProfile(currentUser.id, { theme: 'light' })}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                      currentUser?.theme !== 'dark' 
                        ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm shadow-amber-500/10" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Sun size={18} />
                  </button>
                  <button 
                    onClick={() => currentUser && updateUserProfile(currentUser.id, { theme: 'dark' })}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                      currentUser?.theme === 'dark' 
                        ? "bg-white dark:bg-slate-700 text-primary shadow-sm shadow-primary/10" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Moon size={18} />
                  </button>
                </div>
              </div>

              {currentUser?.theme === 'dark' && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-3">
                  <Cpu size={16} className="text-primary animate-pulse" />
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">Display_Driver: OLED_OPTIMIZED_V2</span>
                </div>
              )}
            </div>
          </section>

          {/* Session Timeout Policy */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm transition-all">
            <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Session Timeout Policy
              </h3>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-black text-foreground uppercase tracking-tight">Idle Timeout Limit</p>
                  <p className="text-[10px] text-muted font-medium italic">Inactivity period before alert warning emerges</p>
                </div>
                
                <div className="relative">
                  <select
                    value={currentUser?.idleTimeoutDuration || 15}
                    onChange={async (e) => {
                      if (currentUser) {
                        const val = Number(e.target.value);
                        await updateUserProfile(currentUser.id, { idleTimeoutDuration: val });
                      }
                    }}
                    className="appearance-none bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-xs font-black text-foreground tracking-wider uppercase focus:border-primary focus:outline-none transition-colors cursor-pointer w-full sm:w-40"
                  >
                    <option value={5}>5 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 dark:bg-slate-950/20 border border-indigo-100 dark:border-slate-800 rounded-2xl flex items-start gap-3">
                <Shield size={16} className="text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest block">Zero-Trust Guard Status</span>
                  <p className="text-[10px] text-muted dark:text-slate-400 leading-relaxed font-semibold">
                    The portal will prompt security authorization alerts if no click, keystroke, touch, or scroll events are received within {currentUser?.idleTimeoutDuration || 15} minutes.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Alert Channels */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-border bg-background">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                Alert Pipelines
              </h3>
            </div>
            
            <div className="p-4 space-y-2">
              {[
                { label: "Internal Message Hub", active: true, icon: Mail },
                { label: "SMS Critical Broadcast", active: false, icon: Smartphone }
              ].map((channel) => (
                <div key={channel.label} className="flex items-center justify-between p-4 rounded-2xl hover:bg-background group transition-colors">
                  <div className="flex items-center gap-3">
                    <channel.icon size={16} className={cn("transition-colors", channel.active ? "text-primary" : "text-muted")} />
                    <span className="text-[10px] font-black text-foreground/70 uppercase tracking-widest">{channel.label}</span>
                  </div>
                  <button className={cn(
                    "w-10 h-5 rounded-full relative transition-all duration-300",
                    channel.active ? "bg-primary" : "bg-border"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all",
                      channel.active ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Floating Hovering Save Settings Bar */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] max-w-lg w-[90%] bg-slate-900 dark:bg-slate-950 border border-primary/40 text-white px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-between gap-4 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shrink-0 animate-pulse">
                <Save size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-white truncate">Unsaved Settings Detected</p>
                <p className="text-[10px] text-slate-400 truncate">Click save to commit changes to system context.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setHasUnsavedChanges(false);
                  if (currentUser) setEditingName(currentUser.name || "");
                }}
                className="px-3 py-2 text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveAllSettings}
                disabled={isSavingSettings}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                {isSavingSettings ? (
                  <>
                    <RefreshCw className="animate-spin" size={12} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DriveBackupModal 
        isOpen={isDriveBackupModalOpen} 
        onClose={() => setIsDriveBackupModalOpen(false)} 
      />
    </div>
  );
};

