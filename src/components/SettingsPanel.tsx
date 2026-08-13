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
  Plus,
  RefreshCw,
  Power,
  Check,
  KeyRound,
  Cloud,
  Search,
  ArrowLeft,
  SlidersHorizontal,
  Compass,
  MessageSquare
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { cn } from "../lib/utils";
import { UserRole } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { SystemHealth } from "./SystemHealth";
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
    systemSettings, 
    updateSystemSettings,
    triggerToast,
    requisitions,
    logout,
  } = useRequisitions();

  const [isDriveBackupModalOpen, setIsDriveBackupModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"profile" | "security" | "expiry" | "notifications" | "backups" | "health" | "database">("profile");
  const [searchQuery, setSearchQuery] = React.useState("");

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

  // Slack Notification States and Live Dispatchers
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
  
  const INTERVAL_MODES = [
    { value: 500, label: "Aggressive", duration: "500ms" },
    { value: 2500, label: "Balanced", duration: "2500ms" },
    { value: 10000, label: "Power Saver", duration: "10s" }
  ];
  const updateInterval = INTERVAL_MODES[sliderIndex].value;

  const handleTestEmail = async () => {
    alert("Email test functionality is currently disabled as the Firebase backend has been removed.");
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

  const navItems = [
    { id: "profile", label: "Profile & Account", icon: User, description: "Personal details and display name" },
    { id: "security", label: "Security & Auth", icon: Lock, description: "Password, biometrics & connected devices" },
    { id: "expiry", label: "Limits & Expiry", icon: Clock, description: "Requisition duration & operational limits" },
    { id: "notifications", label: "Notifications & Slack", icon: Bell, description: "Email alerts & Slack webhook dispatches" },
    { id: "backups", label: "Drive & Auto Backups", icon: Cloud, description: "5-Hour Drive backup & JSON email snapshots" },
    { id: "health", label: "System Health & Logs", icon: Gauge, description: "Telemetry speed & real-time audit trails" },
    { id: "database", label: "Database & Compass", icon: Database, description: "MongoDB cluster, guides & dumps" }
  ];

  const filteredNavItems = navItems.filter(item => 
    !searchQuery || 
    item.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-[#f0f4f9] dark:bg-slate-950 p-3 sm:p-6 lg:p-8 rounded-[2.5rem] min-h-[820px] transition-colors">
      {/* Main Container Shell matching STANDS eRequisition Card Design */}
      <div className="max-w-7xl mx-auto bg-white dark:bg-slate-900 rounded-[2rem] border border-blue-100/80 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[750px]">
        
        {/* LEFT SUB-SIDEBAR (STANDS eRequisition Left Panel Style) */}
        <div className="w-full md:w-64 lg:w-72 bg-[#eef4fb] dark:bg-slate-950/80 p-5 lg:p-6 flex flex-col justify-between shrink-0 border-b md:border-b-0 md:border-r border-blue-100/60 dark:border-slate-800">
          <div className="space-y-6">
            
            {/* STANDS eRequisition Header Brand */}
            <div className="flex items-center gap-3 px-2 pt-1">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 font-black">
                <Settings2 size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                  STANDS eRequisition
                </h2>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Settings Portal
                </span>
              </div>
            </div>

            {/* Sub-Navigation List */}
            <nav className="space-y-1.5 pt-2">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-2xl flex items-center justify-between transition-all group cursor-pointer text-sm font-semibold",
                      isActive
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border-r-4 border-[#0f172a] dark:border-blue-500 font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/40"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon 
                        size={18} 
                        className={cn(
                          "shrink-0 transition-colors",
                          isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                        )} 
                      />
                      <span className="truncate">{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Profile Card at Bottom of Sub-Sidebar */}
          <div className="pt-6 border-t border-blue-100/80 dark:border-slate-800/80 mt-6 space-y-3">
            <div className="flex items-center gap-3 p-2 bg-white/70 dark:bg-slate-800/60 rounded-2xl border border-blue-100/50 dark:border-slate-700/50">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-sm shrink-0 shadow-sm">
                {currentUser?.name?.charAt(0) || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {currentUser?.name || "User"}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  @{currentUser?.role?.toLowerCase().replace("_", "") || "member"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between px-2 pt-1 text-slate-500">
              <button 
                onClick={() => logout()}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Power size={14} />
                <span>Sign out</span>
              </button>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => currentUser && updateUserProfile(currentUser.id, { theme: currentUser.theme === 'dark' ? 'light' : 'dark' })}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-all"
                  title="Toggle Light / Dark Mode"
                >
                  {currentUser?.theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT MAIN CONTENT AREA */}
        <div className="flex-1 bg-white dark:bg-slate-900 p-6 md:p-10 flex flex-col justify-between overflow-y-auto">
          
          <div>
            {/* Top Bar with Back Arrow and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const tabs: ("profile" | "security" | "expiry" | "notifications" | "backups" | "health" | "database")[] = [
                    "profile", "security", "expiry", "notifications", "backups", "health", "database"
                  ];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
                }}
                className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="Go to previous section"
              >
                <ArrowLeft size={18} />
              </button>

              {/* STANDS eRequisition Search Pill Bar */}
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your next Xperience"
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white dark:focus:bg-slate-800 transition-all"
                />
              </div>
            </div>

            {/* TAB CONTENT AREA */}
            <div className="py-8 space-y-8">

              {/* TAB 1: PROFILE & ACCOUNT */}
              {activeTab === "profile" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      User Profile & Identity
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Configure your official display name, user credentials, and active session identity.
                    </p>
                  </div>

                  <div className="space-y-6 max-w-2xl">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Full Name / Display
                      </label>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => {
                          setEditingName(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Name your profile..."
                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                        Account Email Address
                      </label>
                      <input
                        type="text"
                        disabled
                        value={currentUser?.email || ""}
                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3.5 text-sm text-slate-600 dark:text-slate-400 font-medium cursor-not-allowed"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Access Role
                        </label>
                        <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 px-5 py-3.5 text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                          {currentUser?.role?.replace("_", " ") || "MEMBER"}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Affiliated Group
                        </label>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          {currentUser?.group || "GLOBAL_CLUSTER"}
                        </div>
                      </div>
                    </div>

                    {/* STANDS eRequisition Dark Navy Action Button */}
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={handleSaveAllSettings}
                        disabled={isSavingSettings}
                        className="bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-2xl px-8 py-3.5 font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isSavingSettings ? (
                          <>
                            <RefreshCw className="animate-spin" size={16} />
                            <span>Updating Profile...</span>
                          </>
                        ) : (
                          <span>Save Changes</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SECURITY & AUTH */}
              {activeTab === "security" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Security & Authentication
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Manage password signatures, hardware biometric enrollment, and active connected devices.
                    </p>
                  </div>

                  {/* Password Form */}
                  <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-2xl bg-slate-50/60 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Lock size={16} className="text-blue-600" />
                      <span>Change Account Password</span>
                    </h3>

                    {passwordError && (
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold">
                        {passwordError}
                      </div>
                    )}
                    {passwordSuccess && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-bold">
                        {passwordSuccess}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Current Password</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">New Password</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all font-medium"
                          />
                          {newPassword && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className={`h-1.5 w-12 rounded-full ${getPasswordStrength(newPassword).color}`} />
                              <span className="text-[10px] font-bold text-slate-500 uppercase">{getPasswordStrength(newPassword).label}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Confirm Password</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition-all font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-2xl px-8 py-3.5 font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isUpdatingPassword ? "Updating Password..." : "Update Password"}
                    </button>
                  </form>

                  {/* Biometric Section */}
                  <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Fingerprint size={28} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Hardware Biometric Verification
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Authorize transactions using touch/fingerprint sensor verification.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => enrollBiometric(!biometricEnrolled)}
                      className={cn(
                        "rounded-2xl px-6 py-3 font-bold text-xs transition-all cursor-pointer shrink-0",
                        biometricEnrolled
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                      )}
                    >
                      {biometricEnrolled ? "Enrolled (Click to Revoke)" : "Initialize Enrollment"}
                    </button>
                  </div>

                  {/* Connected Devices List */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Smartphone size={16} className="text-blue-600" />
                      <span>Active Sessions ({devices.length})</span>
                    </h3>

                    {devices.map((device) => {
                      const localSessionId = typeof window !== "undefined" ? localStorage.getItem("device_session_id") : null;
                      const isCurrent = device.id === localSessionId;
                      return (
                        <div key={device.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {device.userAgent ? device.userAgent.slice(0, 60) : "Session Device"}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Logged in: {device.loginTime ? new Date(device.loginTime).toLocaleDateString() : 'N/A'} {isCurrent ? '• (This Device)' : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm("Revoke session for this device?")) {
                                const updated = devices.filter(d => d.id !== device.id);
                                setLocalActiveDevices(updated);
                                if (currentUser) updateUserProfile(currentUser.id, { activeDevices: updated });
                              }
                            }}
                            className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-all cursor-pointer"
                          >
                            Revoke
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: LIMITS & EXPIRY */}
              {activeTab === "expiry" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Limits & Requisition Expiry
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Configure default expiration periods and operational spending thresholds.
                    </p>
                  </div>

                  {currentUser?.role === UserRole.SUPER_ADMIN && (
                    <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-4 max-w-2xl">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock size={16} className="text-blue-600" />
                        <span>Default Requisition Expiry (Days)</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Submitted requisitions will automatically expire and archive after this period.
                      </p>

                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          className="w-32 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-bold text-slate-900 dark:text-slate-100"
                          value={systemSettings.requisitionExpiryDays ?? 7}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) updateSystemSettings({ requisitionExpiryDays: val });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => updateSystemSettings({ requisitionExpiryDays: 7 })}
                          className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-2xl px-5 py-3 text-xs font-bold transition-all cursor-pointer"
                        >
                          Reset Default (7 Days)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Operational Security Thresholds */}
                  <div className="space-y-4 max-w-2xl">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Operational Approval Thresholds
                    </h3>

                    <div className="space-y-3">
                      {thresholds.map((t) => (
                        <div key={t.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase">
                              {t.type.replace("_", " ")}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Trigger: {t.threshold} {t.type.toLowerCase().includes("budget") ? "%" : "KES"}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              value={t.threshold}
                              onChange={(e) => updateThreshold(t.id, { threshold: Number(e.target.value) })}
                              className="w-28 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-right font-mono"
                            />
                            <button
                              onClick={() => updateThreshold(t.id, { isEnabled: !t.isEnabled })}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer",
                                t.isEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                              )}
                            >
                              {t.isEnabled ? "Active" : "Disabled"}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: NOTIFICATIONS & SLACK */}
              {activeTab === "notifications" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Notifications & Slack Webhooks
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Configure target emails and force-dispatch Slack automated reports.
                    </p>
                  </div>

                  {/* Target Email Config */}
                  <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-4 max-w-2xl">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Mail size={16} className="text-blue-600" />
                      <span>Target Notification Email</span>
                    </h3>
                    
                    <div className="flex gap-3">
                      <input
                        type="email"
                        placeholder="admin@church.org"
                        className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-medium"
                        value={systemSettings.notificationEmail || ""}
                        onChange={(e) => updateSystemSettings({ ...systemSettings, notificationEmail: e.target.value })}
                      />
                      <button
                        onClick={() => alert("Email notification settings saved.")}
                        className="bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-2xl px-6 py-3 font-bold text-xs transition-all cursor-pointer"
                      >
                        Save Email
                      </button>
                    </div>
                  </div>

                  {/* Slack Integration Buttons Grid */}
                  <div className="space-y-4 max-w-3xl">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <MessageSquare size={16} className="text-indigo-600" />
                      <span>Slack Workflow Dispatch Triggers</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 space-y-3">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">☀️ Morning Briefing</p>
                        <p className="text-[11px] text-slate-500">Compiles pending tickets for L1/L2 verifiers.</p>
                        <button
                          onClick={dispatchMorningBriefing}
                          disabled={slackActionLoading["morning"]}
                          className="w-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                        >
                          Send Morning Brief
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 space-y-3">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">🌙 EOD Activity Snapshot</p>
                        <p className="text-[11px] text-slate-500">Dispatches active user counts & disbursements sum.</p>
                        <button
                          onClick={dispatchEodSnapshot}
                          disabled={slackActionLoading["eod"]}
                          className="w-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                        >
                          Send EOD Snapshot
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 space-y-3">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">⏳ Stale Requisitions Scan</p>
                        <p className="text-[11px] text-slate-500">Scans for submissions stagnant &gt;48 hours.</p>
                        <button
                          onClick={dispatchStaleScan}
                          disabled={slackActionLoading["stale"]}
                          className="w-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                        >
                          Dispatch Stale Scan
                        </button>
                      </div>

                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 space-y-3">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">🛡️ Irregular Velocity Spikes</p>
                        <p className="text-[11px] text-slate-500">Audits user velocity for multiple high-value items.</p>
                        <button
                          onClick={dispatchBehavioralAnomalies}
                          disabled={slackActionLoading["anomalies"]}
                          className="w-full bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                        >
                          Deploy Security Audit
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: BACKUPS & AUTO BACKUP */}
              {activeTab === "backups" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Drive Backup & Automated Monitoring
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      5-Hour Google Drive auto-backups and scheduled JSON email snapshots.
                    </p>
                  </div>

                  {/* Drive Backup Modal Launcher */}
                  <div className="p-6 rounded-3xl border border-blue-200/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/40 space-y-4 max-w-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Cloud size={24} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Google Drive 5-Hour Automated Backup
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Targets <strong>ict.team@pceastandrews.org</strong> every 5 hours.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDriveBackupModalOpen(true)}
                      className="bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-2xl px-8 py-3.5 font-bold text-sm shadow-md transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Cloud size={16} />
                      <span>Manage Drive Backup & View Logs</span>
                    </button>
                  </div>

                  {/* Autosend Backup Panel Component */}
                  <div className="max-w-3xl">
                    <AutosendBackupMonitoringPanel />
                  </div>
                </div>
              )}

              {/* TAB 6: SYSTEM HEALTH & DIAGNOSTICS */}
              {activeTab === "health" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      System Health & Diagnostics
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Adjust telemetry refresh loops and monitor live system memory/connections.
                    </p>
                  </div>

                  {/* Telemetry Loop Speed Tuner */}
                  <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-4 max-w-2xl">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Gauge size={16} className="text-blue-600" />
                        <span>Telemetry Refresh Speed</span>
                      </h3>
                      <span className="text-xs font-bold font-mono text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                        {INTERVAL_MODES[sliderIndex].label} ({INTERVAL_MODES[sliderIndex].duration})
                      </span>
                    </div>

                    <input 
                      type="range" 
                      min="0" 
                      max="2" 
                      step="1" 
                      value={sliderIndex}
                      onChange={(e) => setSliderIndex(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-slate-200 dark:bg-slate-700"
                    />

                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <button onClick={() => setSliderIndex(0)} className={sliderIndex === 0 ? "text-blue-600 font-black" : ""}>Aggressive (500ms)</button>
                      <button onClick={() => setSliderIndex(1)} className={sliderIndex === 1 ? "text-blue-600 font-black" : ""}>Balanced (2.5s)</button>
                      <button onClick={() => setSliderIndex(2)} className={sliderIndex === 2 ? "text-blue-600 font-black" : ""}>Power Saver (10s)</button>
                    </div>
                  </div>

                  {/* System Health Component */}
                  <div className="max-w-3xl">
                    <SystemHealth updateInterval={updateInterval} />
                  </div>

                  {/* Audit Logs */}
                  <div className="space-y-4 max-w-3xl">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <History size={16} className="text-blue-600" />
                      <span>Recent System Audit Feed</span>
                    </h3>

                    <div className="space-y-2">
                      {lastTenLogs.map((log, idx) => (
                        <div key={idx} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">{log.action}: </span>
                            <span className="text-slate-600 dark:text-slate-300">{log.details}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: DATABASE & COMPASS */}
              {activeTab === "database" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      MongoDB Visual Management & Compass
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Step-by-step guides for database management, seed imports, and backups.
                    </p>
                  </div>

                  <div className="space-y-6 max-w-3xl">
                    {/* Guide Selector Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-slate-800">
                      <button
                        onClick={() => setMongoTab(0)}
                        className={cn(
                          "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer",
                          mongoTab === 0 ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
                        )}
                      >
                        1. Ubuntu VPS Setup
                      </button>
                      <button
                        onClick={() => setMongoTab(1)}
                        className={cn(
                          "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer",
                          mongoTab === 1 ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
                        )}
                      >
                        2. MongoDB Compass Guide
                      </button>
                      <button
                        onClick={() => setMongoTab(2)}
                        className={cn(
                          "px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer",
                          mongoTab === 2 ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
                        )}
                      >
                        3. JSON File Import & Sync
                      </button>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-4">
                      {mongoTab === 0 && (
                        <div className="space-y-3">
                          <p>Install MongoDB Community Edition natively on your Ubuntu VPS server.</p>
                          <div className="rounded-2xl bg-slate-950 p-4 font-mono text-[11px] text-emerald-400 leading-relaxed whitespace-pre overflow-x-auto">
{`# Step 1: Start & enable services on reboot
sudo systemctl start mongod
sudo systemctl enable mongod`}
                          </div>
                        </div>
                      )}

                      {mongoTab === 1 && (
                        <div className="space-y-3">
                          <p>Connect MongoDB Compass on your desktop via SSH Tunnel to inspect live collections.</p>
                          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 dark:bg-slate-800 space-y-2">
                            <p className="font-bold text-slate-900 dark:text-white">Connection String:</p>
                            <code className="font-mono text-xs text-blue-600">mongodb://localhost:41282</code>
                          </div>
                        </div>
                      )}

                      {mongoTab === 2 && (
                        <div className="space-y-3">
                          <p>Database backup and seed commands:</p>
                          <div className="p-4 rounded-2xl bg-slate-950 text-slate-300 font-mono text-xs">
                            npm run seed:mongo
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* STANDS eRequisition Footer Note */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>STANDS eRequisition System & Profile Core</span>
            <span>St. Andrew's PCEA eRequisitions</span>
          </div>

        </div>

      </div>

      <DriveBackupModal 
        isOpen={isDriveBackupModalOpen} 
        onClose={() => setIsDriveBackupModalOpen(false)} 
      />
    </div>
  );
};
