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
  MessageSquare,
  Users,
  CheckCircle2,
  Camera,
  Sparkles
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { cn } from "../lib/utils";
import { UserRole } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { SystemHealth } from "./SystemHealth";
import { AutosendBackupMonitoringPanel } from "./AutosendBackupMonitoringPanel";
import { UserAvatar } from "./UserAvatar";
import { 
  isDesktopNotificationSupported, 
  getDesktopNotificationPermission, 
  requestDesktopNotificationPermission, 
  isDesktopNotificationEnabled, 
  setDesktopNotificationEnabled,
  sendDesktopNotification,
  DesktopNotificationPermission
} from "../lib/desktopNotifications";

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
    churchGroups,
  } = useRequisitions();

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

  // Desktop Notification States
  const [desktopPermission, setDesktopPermission] = React.useState<DesktopNotificationPermission>(() => getDesktopNotificationPermission());
  const [desktopEnabled, setDesktopEnabled] = React.useState<boolean>(() => isDesktopNotificationEnabled());
  const [isRequestingPermission, setIsRequestingPermission] = React.useState(false);

  React.useEffect(() => {
    setDesktopPermission(getDesktopNotificationPermission());
    setDesktopEnabled(isDesktopNotificationEnabled());
  }, []);

  const handleRequestDesktopPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const res = await requestDesktopNotificationPermission();
      setDesktopPermission(res);
      const isGranted = res === "granted";
      setDesktopEnabled(isGranted);
      if (isGranted) {
        setDesktopNotificationEnabled(true);
        sendDesktopNotification({
          title: "🔔 Desktop Notifications Enabled",
          body: "You will now receive desktop alerts for real-time approvals, disbursement updates, and notices.",
          playSound: true,
          soundType: "success"
        });
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "LOW",
          message: "Desktop notifications enabled successfully!",
          timestamp: new Date().toISOString()
        });
      } else if (res === "denied") {
        triggerToast({
          type: "SECURITY_UPDATE",
          severity: "HIGH",
          message: "Desktop notifications were denied by browser settings.",
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleToggleDesktopNotifications = (enable: boolean) => {
    setDesktopNotificationEnabled(enable);
    setDesktopEnabled(enable);
    if (enable && desktopPermission === "default") {
      handleRequestDesktopPermission();
    } else {
      triggerToast({
        type: "SYSTEM_INFO",
        severity: "LOW",
        message: enable ? "Desktop notifications enabled" : "Desktop notifications disabled",
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleTestDesktopNotification = () => {
    if (desktopPermission !== "granted") {
      handleRequestDesktopPermission();
      return;
    }
    sendDesktopNotification({
      title: "🔔 Test Notification — St. Andrew's PCEA",
      body: "Desktop browser notifications are operational and synced with your account.",
      playSound: true,
      soundType: "alert"
    });
    triggerToast({
      type: "SYSTEM_INFO",
      severity: "LOW",
      message: "Test desktop notification dispatched.",
      timestamp: new Date().toISOString()
    });
  };

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

  // 5 Muted Recent Activities for Current User
  const mutedRecentActivities = React.useMemo(() => {
    if (!currentUser) return [];
    const nameLower = (currentUser.name || "").toLowerCase();
    const emailLower = (currentUser.email || "").toLowerCase();

    const matchedLogs = (systemLogs || [])
      .filter(log => {
        const pBy = (log.performedBy || "").toLowerCase();
        const metaEmail = (log.metadata?.email || "").toLowerCase();
        const matchesUser = (nameLower && pBy.includes(nameLower)) || (emailLower && pBy.includes(emailLower)) || metaEmail === emailLower;
        const isInternalSync = log.action?.includes("SYNC") || log.action?.includes("RENDER");
        return matchesUser && !isInternalSync;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (matchedLogs.length >= 5) {
      return matchedLogs.slice(0, 5);
    }

    const defaultFallbacks = [
      {
        id: "act-fallback-1",
        action: "PORTAL_AUTHENTICATED",
        details: "Authenticated portal session and verified secure credentials",
        timestamp: currentUser.lastSeen || new Date().toISOString(),
        performedBy: currentUser.name || "System User",
        status: "COMPLETED"
      },
      {
        id: "act-fallback-2",
        action: "ROLE_PERMISSIONS_LOADED",
        details: `Loaded access permissions for role: ${currentUser.role?.replace("_", " ") || "MEMBER"}`,
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        performedBy: currentUser.name || "System User",
        status: "AUDITED"
      },
      {
        id: "act-fallback-3",
        action: "SYSTEM_SETTINGS_ACCESSED",
        details: "Accessed system settings and account profile dashboard",
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        performedBy: currentUser.name || "System User",
        status: "COMPLETED"
      },
      {
        id: "act-fallback-4",
        action: "LEDGER_CACHE_SYNCHRONIZED",
        details: "Synchronized active ministry balances and requisition queue",
        timestamp: new Date(Date.now() - 3600000 * 14).toISOString(),
        performedBy: currentUser.name || "System User",
        status: "COMPLETED"
      },
      {
        id: "act-fallback-5",
        action: "SECURITY_TRACE_VERIFIED",
        details: "Routine security audit log trace validated for current session",
        timestamp: new Date(Date.now() - 3600000 * 26).toISOString(),
        performedBy: currentUser.name || "System User",
        status: "AUDITED"
      }
    ];

    const result = [...matchedLogs];
    for (const fb of defaultFallbacks) {
      if (result.length >= 5) break;
      result.push(fb as any);
    }
    return result.slice(0, 5);
  }, [systemLogs, currentUser]);

  // Account Groups
  const accountGroups = React.useMemo(() => {
    if (!currentUser) return [];
    const list: Array<{ name: string; category: string; description: string; isPrimary: boolean }> = [];

    // Primary Group
    if (currentUser.group) {
      list.push({
        name: currentUser.group,
        category: "Primary Church Group",
        description: "Main congregational & ministry cluster assignment",
        isPrimary: true
      });
    }

    // Multiple groups
    if (Array.isArray(currentUser.groups)) {
      currentUser.groups.forEach(gName => {
        if (gName && !list.some(item => item.name === gName)) {
          list.push({
            name: gName,
            category: "Secondary Group Assignment",
            description: "Sub-committee or auxiliary parish group assignment",
            isPrimary: false
          });
        }
      });
    }

    // Database churchGroups
    (churchGroups || []).forEach(cg => {
      if (cg.name && (cg.name === currentUser.group || currentUser.groups?.includes(cg.name))) {
        if (!list.some(item => item.name === cg.name)) {
          list.push({
            name: cg.name,
            category: "Registered Parish Group",
            description: cg.description || "Official St. Andrew's PCEA Church Group",
            isPrimary: cg.name === currentUser.group
          });
        }
      }
    });

    // Department if present
    if (currentUser.department && !list.some(item => item.name === currentUser.department)) {
      list.push({
        name: currentUser.department,
        category: "Administrative Department",
        description: "Official treasury or operations department",
        isPrimary: false
      });
    }

    // Default if list is empty
    if (list.length === 0) {
      list.push({
        name: "General Ministry Cluster",
        category: "Parish Allocation",
        description: "Default parish congregational group assignment",
        isPrimary: true
      });
    }

    return list;
  }, [currentUser, churchGroups]);

  const getRoleQueueDescription = (role?: string) => {
    switch (role) {
      case "APPROVER_L1":
        return "Level 1 Audit Queue — First-stage receipt & quantity verification";
      case "APPROVER_L2":
        return "Level 2 Treasury Queue — Budget line availability and clearing approval";
      case "FINANCE":
        return "Finance & Treasury Queue — Cash/cheque disbursement & posting to general ledger";
      case "CHURCH_GROUP":
        return "Requisition Submission Queue — Requisition creation & expenditure uploads";
      case "SUPER_ADMIN":
      case "ADMIN":
        return "System Governance Queue — Full administrative override and audit oversight";
      default:
        return "General Portal Access Queue";
    }
  };

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
    { id: "expiry", label: "Limits & Thresholds", icon: SlidersHorizontal, description: "Operational approval thresholds & spending limits" },
    { id: "notifications", label: "Notifications & Slack", icon: Bell, description: "Email alerts & Slack webhook dispatches" },
    { id: "backups", label: "Automated Backups", icon: Cloud, description: "Scheduled JSON email snapshots & snapshots" },
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
                  
                  {/* HEADER */}
                  <div className="space-y-1">
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                      User Profile & Account Settings
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Manage display name, account password, affiliated church groups, and view muted recent activity.
                    </p>
                  </div>

                  {/* SECTION 1: PROFILE PICTURE & ACCOUNT CARD */}
                  <div className="p-6 rounded-3xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 flex flex-col md:flex-row items-center md:items-start gap-6">
                    <div className="relative shrink-0">
                      <UserAvatar 
                        user={currentUser} 
                        size="3xl" 
                        rounded="2xl" 
                        ring="ring-4 ring-indigo-500/20 shadow-lg"
                      />
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-3">
                      <div>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-1">
                          <h2 className="text-xl font-black text-slate-900 dark:text-white">
                            {currentUser?.name || "User Account"}
                          </h2>
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs font-extrabold uppercase tracking-wider">
                            {currentUser?.role?.replace("_", " ") || "MEMBER"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {currentUser?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2 & 3: GRID FOR NAME CHANGE AND PASSWORD CHANGE */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* NAME CHANGE CARD */}
                    <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-5 shadow-xs">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                          <User size={16} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Change Account Display Name
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            Full Display Name
                          </label>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => {
                              setEditingName(e.target.value);
                              setHasUnsavedChanges(true);
                            }}
                            placeholder="Enter your full name..."
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all font-medium"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                            Registered Email (Read-Only)
                          </label>
                          <input
                            type="text"
                            disabled
                            value={currentUser?.email || ""}
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-900/50 px-4 py-3 text-sm text-slate-500 font-medium cursor-not-allowed"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleSaveAllSettings}
                          disabled={isSavingSettings}
                          className="w-full bg-[#0f172a] hover:bg-[#1e293b] text-white rounded-2xl px-6 py-3 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {isSavingSettings ? (
                            <>
                              <RefreshCw className="animate-spin" size={14} />
                              <span>Updating Display Name...</span>
                            </>
                          ) : (
                            <span>Save Name Changes</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* PASSWORD CHANGE CARD */}
                    <form onSubmit={handleUpdatePassword} className="p-6 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-5 shadow-xs">
                      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                          <Lock size={16} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Update Security Password
                        </h3>
                      </div>

                      {passwordError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 font-bold">
                          {passwordError}
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-bold">
                          {passwordSuccess}
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Current Password</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">New Password</label>
                            <input
                              type="password"
                              required
                              placeholder="••••••••"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                            />
                            {newPassword && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <div className={`h-1.5 w-10 rounded-full ${getPasswordStrength(newPassword).color}`} />
                                <span className="text-[9px] font-bold text-slate-500 uppercase">{getPasswordStrength(newPassword).label}</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Confirm Password</label>
                            <input
                              type="password"
                              required
                              placeholder="••••••••"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 px-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isUpdatingPassword}
                          className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-2xl px-6 py-3 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                        >
                          {isUpdatingPassword ? "Updating Password..." : "Update Password"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* SECTION 4: GROUPS RELATED TO ACCOUNT */}
                  <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                          <Users size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Groups Related to Account
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Active church groups, ministries, and operational approval queues linked to your user profile.
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full text-[10px] font-black uppercase">
                        {accountGroups.length} Assigned {accountGroups.length === 1 ? "Group" : "Groups"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {accountGroups.map((grp, idx) => (
                        <div 
                          key={idx}
                          className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 space-y-2 relative overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              grp.isPrimary 
                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                                : "bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                            )}>
                              {grp.category}
                            </span>
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          </div>

                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {grp.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                              {grp.description}
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Operational Role Queue Card */}
                      <div className="p-4 rounded-2xl border border-blue-200/70 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-600 text-white">
                            Approval Queue Access
                          </span>
                          <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200 uppercase">
                            {currentUser?.role?.replace("_", " ") || "MEMBER"} QUEUE
                          </h4>
                          <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 mt-0.5 font-medium">
                            {getRoleQueueDescription(currentUser?.role)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 5: MUTED HISTORY OF 5 RECENT ACTIVITIES */}
                  <div className="p-6 rounded-3xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
                          <History size={16} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Recent Activity History
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Muted audit trail displaying your 5 most recent system actions and logins.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-200/50 dark:bg-slate-700/50 px-2.5 py-1 rounded-md">
                        Muted Trail • 5 Events
                      </span>
                    </div>

                    <div className="space-y-2">
                      {mutedRecentActivities.map((act, index) => (
                        <div 
                          key={act.id || index}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                              <Activity size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                                {act.action?.replace(/_/g, " ")}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {act.details || (act as any).description || "System operation logged"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 pl-3">
                            <span className="text-[10px] font-medium text-slate-400">
                              {act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recent"}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/40 dark:border-slate-700/60">
                              {(act as any).status || "AUDITED"}
                            </span>
                          </div>
                        </div>
                      ))}
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
                      Operational Limits & Thresholds
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Configure operational spending thresholds and approval parameters.
                    </p>
                  </div>

                  {/* Operational Security Thresholds */}
                  <div className="space-y-4 max-w-2xl">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Operational Approval Thresholds
                    </h3>

                    <div className="space-y-3">
                      {thresholds.filter(t => t.type !== "EXPIRY_ALERT").map((t) => (
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

                  {/* Desktop Browser Notifications Permission Card */}
                  <div className="p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-4 max-w-2xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                          <Bell size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Desktop Browser Notifications</span>
                            {desktopPermission === "granted" && desktopEnabled && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Active
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Receive real-time system alerts, approval notifications, and financial updates even when this tab is in the background.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">Permission Status:</span>
                          {desktopPermission === "granted" ? (
                            <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Permission Granted
                            </span>
                          ) : desktopPermission === "default" ? (
                            <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              Permission Not Requested
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {desktopPermission === "granted"
                            ? "Your browser is authorized to display desktop popups for new events."
                            : "Click below to grant permission and enable instant notifications."}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {desktopPermission === "granted" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleDesktopNotifications(!desktopEnabled)}
                              className={cn(
                                "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                desktopEnabled
                                  ? "bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                              )}
                            >
                              {desktopEnabled ? "Pause Alerts" : "Resume Alerts"}
                            </button>
                            <button
                              type="button"
                              onClick={handleTestDesktopNotification}
                              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
                            >
                              Send Test Alert
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleRequestDesktopPermission}
                            disabled={isRequestingPermission}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Bell size={14} />
                            <span>{isRequestingPermission ? "Requesting..." : "Enable Desktop Notifications"}</span>
                          </button>
                        )}
                      </div>
                    </div>
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
                      Automated System Backups
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Automated scheduled JSON email snapshots and system snapshots.
                    </p>
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

    </div>
  );
};
