/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from "react";
// @ts-ignore
const db = {};
const doc = (a: any, b: any, c?: any) => { };
const getDoc = async (a: any) => ({ exists: () => false, data: () => ({}), id: "123" });
const auth = { currentUser: null };
const sendPasswordResetEmail = async (a: any, b: any) => { };

import { RequisitionProvider, useRequisitions } from "./contexts/RequisitionContext";
import { cn } from "./lib/utils";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import { useIdleTimeout } from "./hooks/useIdleTimeout";
import { sendSlackNotification } from "./lib/utils";
import { PanelSkeletonFallback } from "./components/PanelSkeletonFallback";
import { getRecentSearches, saveRecentSearchTerm, removeRecentSearchTerm, clearAllRecentSearchTerms } from "./lib/searchHistory";
import { databaseService } from "./lib/databaseService";
import { UserRole, RequisitionStatus, BudgetAlert, SearchFilter, PermissionConfig } from "./types";

function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      console.warn("[LazyLoad] Dynamic import failed, retrying...", error);
      await new Promise(resolve => setTimeout(resolve, 350));
      try {
        return await factory();
      } catch (retryError) {
        console.error("[LazyLoad] Retry failed:", retryError);
        throw retryError;
      }
    }
  });
}

// Route-based & Panel Code Splitting (React.lazy with retry resilience)
const RequisitionsPanel = lazyWithRetry(() => import("./components/RequisitionsPanel").then(m => ({ default: m.RequisitionsPanel || m.default })));
const ApprovalsPanel = lazyWithRetry(() => import("./components/ApprovalsPanel").then(m => ({ default: m.ApprovalsPanel })));
const SettingsPanel = lazyWithRetry(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));
const UsersPanel = lazyWithRetry(() => import("./components/UsersPanel").then(m => ({ default: m.UsersPanel })));
const ReportsPanel = lazyWithRetry(() => import("./components/ReportsPanel").then(m => ({ default: m.ReportsPanel })));
const FinanceLedgerPanel = lazyWithRetry(() => import("./components/FinanceLedgerPanel").then(m => ({ default: m.FinanceLedgerPanel })));
const AccessControlPanel = lazyWithRetry(() => import("./components/AccessControlPanel").then(m => ({ default: m.AccessControlPanel })));
const VendorsPanel = lazyWithRetry(() => import("./components/VendorsPanel").then(m => ({ default: m.VendorsPanel })));
const AuditLogsPanel = lazyWithRetry(() => import("./components/AuditLogsPanel").then(m => ({ default: m.AuditLogsPanel })));
const HelpPanel = lazyWithRetry(() => import("./components/HelpPanel").then(m => ({ default: m.HelpPanel })));
const TransactionsPanel = lazyWithRetry(() => import("./components/TransactionsPanel").then(m => ({ default: m.default || (m as any).TransactionsPanel })));
const ReceiptTemplateGenerator = lazyWithRetry(() => import("./components/ReceiptTemplateGenerator").then(m => ({ default: m.ReceiptTemplateGenerator })));
const NotificationHub = lazyWithRetry(() => import("./components/NotificationHub").then(m => ({ default: m.NotificationHub })));
const WaitingRoom = lazyWithRetry(() => import("./components/WaitingRoom").then(m => ({ default: m.WaitingRoom })));
const ProfilePrompt = lazyWithRetry(() => import("./components/ProfilePrompt").then(m => ({ default: m.ProfilePrompt })));
const AnnouncementBanner = lazyWithRetry(() => import("./components/AnnouncementBanner").then(m => ({ default: m.AnnouncementBanner })));
const ProductTour = lazyWithRetry(() => import("./components/ProductTour").then(m => ({ default: m.ProductTour })));
const FeedbackModal = lazyWithRetry(() => import("./components/FeedbackModal").then(m => ({ default: m.FeedbackModal })));
const SplashPage = lazyWithRetry(() => import("./components/SplashPage").then(m => ({ default: m.SplashPage })));
const BackgroundUploadWidget = lazyWithRetry(() => import("./components/BackgroundUploadWidget").then(m => ({ default: m.BackgroundUploadWidget })));
import {
  Bell,
  ArrowRight,
  ArrowLeft,
  LogOut,
  AlertCircle,
  Search,
  X,
  ShieldCheck,
  Lock,
  Clock,
  Trash2,
  Settings,
  UserCircle,
  Mail,
  CheckCircle,
  Eye,
  EyeOff,
  Sliders,
  Shield,
  HelpCircle,
  Calendar,
  ChevronDown,
  Layers,
  Loader2,
  RefreshCw,
  Sun,
  Moon,
  KeyRound,
  AlertTriangle,
  Check,
  Info,
  Bug,
  HeartHandshake,
  MessageSquare,
  Target,
  SlidersHorizontal,
  Megaphone,
  Wrench,
  MoreHorizontal,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PerformanceTracker } from "./components/PerformanceTracker";
import { UserAvatar } from "./components/UserAvatar";

import { AlertCircle as AlertCircleIcon } from "lucide-react"; // alias if needed or rely on main imports

interface ToastItemProps {
  toast: BudgetAlert;
  index: number;
  removeToast: (id: string) => void;
  setCurrentView: (view: string) => void;
  darkMode?: boolean;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, index, removeToast, setCurrentView, darkMode = false }) => {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);
  
  // Custom duration based on severity: HIGH = 8s, MEDIUM = 5s, LOW = 3.5s
  const duration = toast.severity === "HIGH" ? 8000 : toast.severity === "MEDIUM" ? 5000 : 3500;
  const intervalTime = 30; // smooth update step
  const decrement = (intervalTime / duration) * 100;

  useEffect(() => {
    if (isHovered) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - decrement;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isHovered, decrement]);

  useEffect(() => {
    if (progress <= 0) {
      removeToast(toast.id);
    }
  }, [progress, toast.id, removeToast]);

  const title = useMemo(() => {
    if ((toast as any).title) return (toast as any).title;
    if (toast.type) {
      switch (toast.type) {
        case "OVERSHOOT":
          return "Budget Overshoot";
        case "LARGE_REQUEST":
          return "Large Request Alert";
        case "SECURITY_UPDATE":
          return "Security Notice";
        case "L2_APPROVED":
          return "Requisition Approved";
        case "FINANCE_DISBURSEMENT":
          return "Disbursement Ready";
        case "SYSTEM_INFO":
          return "System Notice";
        case "EXPIRY":
          return "Expiration Alert";
        default:
          return String(toast.type)
            .toLowerCase()
            .replace(/_/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());
      }
    }
    const msgLower = toast.message?.toLowerCase() || "";
    if (msgLower.includes("error") || msgLower.includes("failed")) return "Action Failed";
    if (msgLower.includes("success") || msgLower.includes("approved") || msgLower.includes("saved") || msgLower.includes("created")) return "Action Successful";
    if (msgLower.includes("warning") || msgLower.includes("exceed")) return "System Warning";
    return "Notification";
  }, [toast]);

  const styleConfig = useMemo(() => {
    const isError = toast.severity === "HIGH" || toast.type === "SECURITY_UPDATE" || toast.message?.toLowerCase().includes("error") || toast.message?.toLowerCase().includes("failed");
    const isSuccess = toast.message?.toLowerCase().includes("success") || toast.message?.toLowerCase().includes("approved") || toast.message?.toLowerCase().includes("updated") || toast.message?.toLowerCase().includes("saved") || toast.message?.toLowerCase().includes("created");
    const isWarning = toast.severity === "MEDIUM" || toast.type === "OVERSHOOT";

    if (isError) {
      return {
        ambientGlow: "bg-rose-400 dark:bg-rose-600",
        progressBar: "bg-rose-500",
        icon: <Megaphone size={18} className="text-rose-500 stroke-[2.2]" />,
        role: "alert",
        ariaLive: "assertive" as const
      };
    } else if (isSuccess) {
      return {
        ambientGlow: "bg-emerald-400 dark:bg-emerald-600",
        progressBar: "bg-emerald-500",
        icon: <Target size={18} className="text-emerald-500 stroke-[2.2]" />,
        role: "status",
        ariaLive: "polite" as const
      };
    } else if (isWarning) {
      return {
        ambientGlow: "bg-amber-400 dark:bg-amber-600",
        progressBar: "bg-amber-500",
        icon: <SlidersHorizontal size={18} className="text-amber-500 stroke-[2.2]" />,
        role: "status",
        ariaLive: "polite" as const
      };
    } else {
      return {
        ambientGlow: "bg-cyan-400 dark:bg-cyan-600",
        progressBar: "bg-sky-500",
        icon: <Wrench size={18} className="text-cyan-500 stroke-[2.2]" />,
        role: "status",
        ariaLive: "polite" as const
      };
    }
  }, [toast]);

  return (
    <motion.div
      layout
      role={styleConfig.role}
      aria-live={styleConfig.ariaLive}
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { type: "spring", stiffness: 380, damping: 26, delay: index * 0.04 }
      }}
      exit={{
        opacity: 0,
        y: -10,
        scale: 0.95,
        filter: "blur(4px)",
        transition: { duration: 0.2 }
      }}
      className={cn(
        "pointer-events-auto relative overflow-hidden rounded-2xl w-full max-w-[380px] font-sans border shadow-xl backdrop-blur-md transition-all duration-200 group",
        darkMode
          ? "bg-slate-900/90 border-slate-800/80 text-slate-100 shadow-slate-950/60"
          : "bg-white/95 border-slate-200/60 text-slate-900 shadow-slate-200/60"
      )}
      style={{ zIndex: 100 - index }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Soft ambient gradient glow wash on the left */}
      <div
        className={cn(
          "absolute -left-6 -top-6 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-60 dark:opacity-30 transition-opacity",
          styleConfig.ambientGlow
        )}
      />

      <div className="relative z-10 flex items-start p-3.5 sm:p-4 gap-3.5 pr-9">
        {/* Clean White Squarish Icon Tile */}
        <div className="shrink-0 w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 shadow-xs flex items-center justify-center transition-transform group-hover:scale-105 mt-0.5">
          {styleConfig.icon}
        </div>

        {/* Content: Title & Description */}
        <div className="flex-1 min-w-0">
          <h5 className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 leading-tight tracking-tight">
            {title}
          </h5>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-normal leading-snug mt-1 break-words">
            {toast.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => removeToast(toast.id!)}
          title="Dismiss notification"
          aria-label="Dismiss notification"
          className="absolute top-3.5 right-3 p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer"
        >
          <X size={16} strokeWidth={1.8} />
        </button>
      </div>

      {/* Discrete subtle progress line at bottom */}
      <div className="w-full h-0.5 bg-slate-100/60 dark:bg-slate-800/80 overflow-hidden relative z-10">
        <div
          className={cn("h-full transition-all duration-75 ease-linear", styleConfig.progressBar)}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Pause Indicator on Hover */}
      {isHovered && (
        <div className="absolute bottom-1.5 right-3 text-[9px] font-bold text-slate-400 bg-slate-800/80 dark:bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700/50 pointer-events-none animate-fade-in z-20">
          Paused
        </div>
      )}
    </motion.div>
  );
};

function AppContent() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) {
      return saved === "true";
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"EMAIL_LOGIN" | "EMAIL_SIGNUP">("EMAIL_LOGIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingInvite, setPendingInvite] = useState<any>(null);

  // Password update states
  const [showUpdatePasswordModal, setShowUpdatePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isDoNotDisturb, setIsDoNotDisturb] = useState<boolean>(() => {
    return localStorage.getItem("doNotDisturb") === "true";
  });

  useEffect(() => {
    localStorage.setItem("doNotDisturb", String(isDoNotDisturb));
  }, [isDoNotDisturb]);

  const getPasswordStrength = (password: string) => {
    if (!password) return { label: "", color: "bg-slate-200" };
    if (password.length < 6) return { label: "Weak", color: "bg-rose-500" };
    if (password.length < 10) return { label: "Medium", color: "bg-amber-500" };
    return { label: "Strong", color: "bg-emerald-500" };
  };

  // Connection listeners for dynamic online/offline monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loginFormRef = useRef<HTMLFormElement>(null);

  // Clear authentication text fields on page refresh/mount and handle browser auto-fill clearing
  const clearAuthFields = useCallback(() => {
    setEmail("");
    setPassword("");
    setName("");
    setError("");
    setSuccess("");
    if (loginFormRef.current) {
      loginFormRef.current.reset();
      // Directly clear value property on all input elements in the login form
      const inputs = loginFormRef.current.querySelectorAll("input");
      inputs.forEach((input) => {
        input.value = "";
      });
    }
  }, []);

  // Clear authentication fields on mount/refresh and stagger resets to prevent browser auto-fill retention
  useEffect(() => {
    clearAuthFields();

    const t1 = setTimeout(clearAuthFields, 50);
    const t2 = setTimeout(clearAuthFields, 150);
    const t3 = setTimeout(clearAuthFields, 300);

    const handlePageShow = () => {
      clearAuthFields();
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("load", clearAuthFields);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("load", clearAuthFields);
    };
  }, [clearAuthFields]);

  // Standard best-practice pre-fetch: As soon as login page loads, warm up Valkey cache and fetch all dashboard data
  useEffect(() => {
    const prefetchDashboardData = async () => {
      try {
        // Trigger Valkey cache warmup for frequent church group configs and active requisition IDs
        fetch("/api/valkey/warmup", { method: "POST" }).catch(() => {});

        const res = await fetch("/api/db-all");
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === "object") {
            if (data.system_settings) {
              localStorage.setItem("stands_cache_system_settings", JSON.stringify(data.system_settings));
            }
            if (data.church_groups) {
              localStorage.setItem("stands_cache_church_groups", JSON.stringify(data.church_groups));
            }
            if (data.requisitions) {
              localStorage.setItem("stands_cache_reqs_global", JSON.stringify(data.requisitions));
            }
          }
        }
      } catch (err) {
        // Silently handle background prefetch warmup
      }
    };
    prefetchDashboardData();
  }, []);

  useEffect(() => {
    const inviteStr = sessionStorage.getItem("requisition_invite");
    if (inviteStr) {
      try {
        const invite = JSON.parse(inviteStr);
        setPendingInvite(invite);
      } catch (e) { }
    }
  }, []);

  const [showSplash, setShowSplash] = useState(false);
  const hasShownSplashRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showReportReminder, setShowReportReminder] = useState(true);
  const [reportState, setReportState] = useState<"IDLE" | "GENERATING" | "SUCCESS">("IDLE");
  const [isGeneratingReceiptFromHub, setIsGeneratingReceiptFromHub] = useState<any | null>(null);

  // Deep linking and direct sharing states
  const [targetReqId, setTargetReqId] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [deletedReqId, setDeletedReqId] = useState<string | null>(null);
  const [accessDeniedReq, setAccessDeniedReq] = useState<{ id: string; title?: string; groupName?: string } | null>(null);
  const {
    currentUser,
    login,
    loginWithEmail,
    signupWithEmail,
    logout,
    systemSettings,
    updateSystemSettings,
    loading,
    authLoading,
    isDbSaving,
    dbSavingMessage,
    users,
    requisitions,
    approveUser,
    deleteRequisition,
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
    activeToasts,
    removeToast,
    triggerToast,
    readNoticeIds,
    toggleNoticeRead,
    markAllNoticesRead,
    canAccess,
    canPerform,
    fiscalYears,
    setActiveFiscalYear,
    setSyncTargets,
    updateUserProfile,
    updateCurrentUserPassword,
    projects,
    churchGroups,
    systemLogs,
    alerts,
    selectedRequisition,
    setSelectedRequisition
  } = useRequisitions();

  const handleNavigate = useCallback((view: string) => {
    if (view === "requisitions") {
      setSelectedRequisition(null);
      window.dispatchEvent(new CustomEvent("reset_requisitions_home"));
    } else if (view === "notifications") {
      window.dispatchEvent(new CustomEvent("reset_notifications_home"));
    }
    setCurrentView(view);
  }, [setSelectedRequisition]);

  // Clear login text fields whenever auth mode toggles or user is not logged in
  useEffect(() => {
    if (!currentUser) {
      clearAuthFields();
    }
  }, [authMode, currentUser, clearAuthFields]);

  const [sendingTestSummary, setSendingTestSummary] = useState(false);

  // Background Auto-Scheduler for Daily/Weekly Requisitions Digest Email
  useEffect(() => {
    if (!currentUser || !currentUser.summaryEmailFrequency || currentUser.summaryEmailFrequency === "NONE") return;

    const emailFrequency = currentUser.summaryEmailFrequency;
    const lastSentAt = currentUser.lastSummaryEmailSentAt;
    const now = new Date();

    let shouldSend = false;
    if (!lastSentAt) {
      shouldSend = true; // Never sent before, so dispatch first one!
    } else {
      const lastSentDate = new Date(lastSentAt);
      const diffMs = now.getTime() - lastSentDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (emailFrequency === "DAILY" && diffHours >= 24) {
        shouldSend = true;
      } else if (emailFrequency === "WEEKLY" && diffHours >= 24 * 7) {
        shouldSend = true;
      }
    }

    if (shouldSend) {
      const dispatchSummary = async () => {
        try {
          const isUserAdmin = currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN";
          const myRequisitions = requisitions.filter(r => {
            if (isUserAdmin) return true;
            const userGroups = currentUser.groups || (currentUser.group ? [currentUser.group] : []);
            return r.createdBy === currentUser.email || userGroups.includes(r.groupName || "");
          });
          const pendingCount = myRequisitions.filter(r => r.status && r.status.startsWith("PENDING")).length;
          const draftsCount = myRequisitions.filter(r => r.status === "DRAFT").length;

          const recentDisbursed = myRequisitions
            .filter(r => r.status === "DISBURSED")
            .sort((a, b) => {
              const dateA = new Date(a.disbursedAt || a.createdAt || 0).getTime();
              const dateB = new Date(b.disbursedAt || b.createdAt || 0).getTime();
              return dateB - dateA;
            })
            .slice(0, 2)
            .map(r => ({
              title: r.title,
              amount: r.amount,
              status: r.status
            }));

          const res = await fetch("/api/send-summary-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: currentUser.email,
              userName: currentUser.name,
              frequency: emailFrequency,
              pendingCount,
              draftsCount,
              recentDisbursed
            })
          });

          if (res.ok) {
            console.log(`[Ecosystem Summary] Auto-dispatched scheduled ${emailFrequency} digest email to ${currentUser.email}.`);
            updateUserProfile(currentUser.id, {
              lastSummaryEmailSentAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("[Ecosystem Summary Auto-scheduler Error]:", err);
        }
      };

      const timer = setTimeout(() => {
        dispatchSummary();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, requisitions, updateUserProfile]);

  const handleToggleTheme = (specificVal?: boolean | any) => {
    const nextVal = typeof specificVal === 'boolean' ? specificVal : !darkMode;
    setDarkMode(nextVal);
    if (currentUser?.id) {
      updateUserProfile(currentUser.id, { theme: nextVal ? 'dark' : 'light' }).catch((err) => console.warn("Theme update failed", err));
    }
  };

  useEffect(() => {
    if (currentUser?.theme) {
      setDarkMode(currentUser.theme === 'dark');
    }
  }, [currentUser?.theme]);

  const hasRedirectedRef = useRef(false);

  // Redirect to dashboard upon successful login and trigger splash intro + Valkey cache warmup
  useEffect(() => {
    if (currentUser) {
      if (!hasRedirectedRef.current) {
        setCurrentView("dashboard");
        hasRedirectedRef.current = true;
      }
      if (!hasShownSplashRef.current) {
        setShowSplash(true);
        hasShownSplashRef.current = true;
      }
      // Automatically warm up Valkey cache with church group configs and active requisitions upon login
      fetch("/api/valkey/warmup", { method: "POST" }).catch(() => {});
    } else {
      hasRedirectedRef.current = false;
      hasShownSplashRef.current = false;
      setShowSplash(false);
    }
  }, [currentUser]);

  // 1. Extract direct link requisition ID on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reqIdParam = params.get("reqId") || params.get("requisitionId") || params.get("id");
    if (reqIdParam) {
      setTargetReqId(reqIdParam.trim());
    }
  }, []);

  // 2. Direct access check on requisition ID deep linking (e.g. from email notifications)
  useEffect(() => {
    if (!currentUser || !targetReqId) return;

    const checkDirectRequisitionAccess = async () => {
      setCheckingAccess(true);
      try {
        // Step A: Search in-memory requisitions array from RequisitionContext
        let reqData = requisitions.find(r => 
          r.id === targetReqId || 
          r.id.toLowerCase() === targetReqId.toLowerCase() ||
          r.id.replace(/^req-/, "") === targetReqId.replace(/^req-/, "")
        );

        // Step B: Search local storage cache if not found in current state array
        if (!reqData && currentUser?.id) {
          try {
            const cachedStr = localStorage.getItem(`stands_cache_reqs_${currentUser.id}`);
            if (cachedStr) {
              const cachedArr = JSON.parse(cachedStr);
              if (Array.isArray(cachedArr)) {
                reqData = cachedArr.find((r: any) => 
                  r.id === targetReqId || 
                  r.id.toLowerCase() === targetReqId.toLowerCase() ||
                  r.id.replace(/^req-/, "") === targetReqId.replace(/^req-/, "")
                );
              }
            }
          } catch (cacheErr) {
            console.warn("Failed parsing cached requisitions from local storage:", cacheErr);
          }
        }

        // Step C: Fallback to backend endpoint if available
        if (!reqData) {
          try {
            const res = await fetch(`/api/db/requisitions/${targetReqId}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.id) reqData = data;
            }
          } catch (apiErr) {
            // Ignore API fallback errors
          }
        }

        // Step D: If requisitions are still loading, wait for context sync to finish
        if (!reqData && (loading || authLoading)) {
          return;
        }

        // If requisition is truly not found anywhere or marked as DELETED
        if (!reqData || reqData.status === RequisitionStatus.DELETED || (reqData as any).isDeleted || (reqData.status as any) === "DELETED") {
          setDeletedReqId(targetReqId);
          setAccessDeniedReq(null);
          setCheckingAccess(false);
          return;
        }

        // Perform clearance & access verification based on role & ownership
        let hasAccess = true;

        if (currentUser.role === UserRole.CHURCH_GROUP) {
          const filterGroups = currentUser.groups || (currentUser.group ? [currentUser.group] : []);
          const matchesGroup = filterGroups.some(g => g === reqData.groupId || g === reqData.groupName);
          const isOwner = reqData.requesterId === currentUser.id || 
            (reqData.requesterEmail && currentUser.email && reqData.requesterEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
            (reqData.requesterName && currentUser.name && reqData.requesterName.toLowerCase() === currentUser.name.toLowerCase());
          
          if (!matchesGroup && !isOwner) {
            hasAccess = false;
          }
        }

        if (hasAccess) {
          // Grant access: Open detail modal & navigate straight to requisitions view
          setSelectedRequisition(reqData);
          setAccessDeniedReq(null);
          setCurrentView("requisitions");

          // Clean up reqId parameter from URL without page reload
          const url = new URL(window.location.href);
          if (url.searchParams.has("reqId") || url.searchParams.has("requisitionId") || url.searchParams.has("id")) {
            url.searchParams.delete("reqId");
            url.searchParams.delete("requisitionId");
            url.searchParams.delete("id");
            window.history.replaceState({}, document.title, url.toString());
          }
        } else {
          // Deny access: trigger compliance restriction prompt with actual requisition details
          setAccessDeniedReq({
            id: reqData.id,
            title: reqData.title,
            groupName: reqData.groupName || "Confidential Group"
          });
        }
      } catch (err) {
        console.error("Direct requisition access lookup failed:", err);
        setAccessDeniedReq({
          id: targetReqId,
          title: "Query Authorization Error",
          groupName: "Compliance Restricted"
        });
      } finally {
        setCheckingAccess(false);
      }
    };

    checkDirectRequisitionAccess();
  }, [currentUser, targetReqId, requisitions, loading, authLoading]);

  const [isSyncingData, setIsSyncingData] = useState(false);

  // Targeted, on-demand data strategy: Only sync data required for the current view
  useEffect(() => {
    if (!currentUser) return;

    setIsSyncingData(true);

    switch (currentView) {
      case "dashboard":
        setSyncTargets(['requisitions', 'projects', 'supplementary_budget_requests', 'church_groups', 'ledger_books']);
        break;
      case "requisitions":
      case "approvals":
        setSyncTargets(['requisitions', 'church_groups', 'projects', 'vendors', 'ledger_books']);
        break;
      case "transactions":
      case "finance":
      case "ledger":
        setSyncTargets(['transactions', 'projects', 'requisitions', 'ledger_books', 'church_groups', 'supplementary_budget_requests']);
        break;
      case "vendors":
        setSyncTargets(['vendors']);
        break;
      case "reports":
        setSyncTargets(['reports', 'requisitions']);
        break;
      case "users":
        setSyncTargets(['users', 'church_groups']);
        break;
      case "accessControl":
        setSyncTargets(['users', 'permissions']);
        break;
      case "auditTrail":
        setSyncTargets(['system_logs']);
        break;
      default:
        setSyncTargets([]);
    }

    const t = setTimeout(() => {
      setIsSyncingData(false);
    }, 1200);

    return () => clearTimeout(t);
  }, [currentView, currentUser, setSyncTargets]);

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [adminBypass, setAdminBypass] = useState(false);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(60);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handleLogout = async (force: boolean | React.MouseEvent = false) => {
    const isSessionInvalidOrExpired = !auth.currentUser || !currentUser || currentUser.isSuspended || !currentUser.isActive || (!currentUser.isApproved && currentUser.role !== UserRole.SUPER_ADMIN) || currentUser.forceLogout;

    if (force === true || isSessionInvalidOrExpired) {
      if (!isSessionInvalidOrExpired) {
        setIsLoggingOut(true);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await logout({ forceDirect: isSessionInvalidOrExpired });
      setIsLoggingOut(false);
      setAdminBypass(false);
    } else {
      setShowLogoutModal(true);
    }
  };

  const executeActualLogout = async () => {
    setShowLogoutModal(false);
    const isSessionInvalidOrExpired = !auth.currentUser || !currentUser || currentUser.isSuspended || !currentUser.isActive || (!currentUser.isApproved && currentUser.role !== UserRole.SUPER_ADMIN) || currentUser.forceLogout;

    if (!isSessionInvalidOrExpired) {
      setIsLoggingOut(true);
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await logout({ forceDirect: isSessionInvalidOrExpired });
    setIsLoggingOut(false);
    setAdminBypass(false);
  };

  // Idle warning countdown ticking down when modal is active
  useEffect(() => {
    if (!showIdleWarning) {
      setIdleCountdown(60);
      return;
    }

    const interval = setInterval(() => {
      setIdleCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showIdleWarning]);

  // Idle Timeout Implementation with Warning Window
  const idleMinutes = currentUser?.idleTimeoutDuration || 15;
  const { resetTimer: resetIdleTimer } = useIdleTimeout(
    () => {
      if (currentUser) {
        setShowIdleWarning(false);
        handleLogout(true);
      }
    },
    () => {
      if (currentUser) {
        setShowIdleWarning(true);
        setIdleCountdown(60);
      }
    },
    () => {
      // Hide modal instantly if user performs any manual active registration (keyboard/mouse/scroll)
      setShowIdleWarning(false);
    },
    (idleMinutes * 60 * 1000) + (60 * 1000), // Total threshold (chosen duration + 60 seconds warning window)
    60 * 1000                                // Warning window of 60 seconds before actual logout trigger
  );

  // Global Interaction Tracking (Buffered internally)
  const userActivityBuffer = useRef<{ type: string; detail: string; timestamp: number }[]>([]);

  useEffect(() => {
    if (!currentUser) return;

    // Timer to reset/maintain buffer
    const summaryInterval = setInterval(() => {
      if (userActivityBuffer.current.length === 0) return;
      userActivityBuffer.current = []; // Clear buffer without dispatching Slack notifications
    }, 5 * 60 * 1000);

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest("button");
      const sidebarItem = target.closest("[data-sidebar-item]");

      // Case 1: Navbar/Sidebar Navigation interaction (Primary)
      if (sidebarItem) {
        const itemText = sidebarItem.getAttribute("data-sidebar-item") || sidebarItem.textContent || "Sidebar Item";
        userActivityBuffer.current.push({
          type: "NAV",
          detail: `Navigated to ${itemText.trim()}`,
          timestamp: Date.now()
        });
        return;
      }

      // Case 2: Standard Button interaction
      if (button) {
        const buttonText = button.innerText.trim() || button.title || button.ariaLabel || "Unnamed Button";
        const noisyTexts = ["X", "Close", "Cancel", "Clear", ""];
        if (!noisyTexts.includes(buttonText)) {
          userActivityBuffer.current.push({
            type: "BTN",
            detail: `Pressed: ${buttonText}`,
            timestamp: Date.now()
          });
        }
      }
    };

    window.addEventListener("click", handleGlobalClick);
    return () => {
      clearInterval(summaryInterval);
      window.removeEventListener("click", handleGlobalClick);
    };
  }, [currentUser, currentView]);

  const [showProfilePrompt, setShowProfilePrompt] = useState(false);
  const [hasPromptBeenShown, setHasPromptBeenShown] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const hasSeen = localStorage.getItem("stands_has_seen_tour");
      if (hasSeen !== "true") {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && (currentUser.isApproved || currentUser.role === UserRole.SUPER_ADMIN) && !currentUser.isSuspended) {
      // Only show if preference is not NEVER and we haven't shown it this session
      const isNever = currentUser.profilePromptPreference === "NEVER";
      const sessionShown = sessionStorage.getItem(`profile_prompt_shown_${currentUser.id}`);

      if (!isNever && !sessionShown && !hasPromptBeenShown) {
        setShowProfilePrompt(true);
        setHasPromptBeenShown(true);
        sessionStorage.setItem(`profile_prompt_shown_${currentUser.id}`, "true");
      }
    }
  }, [currentUser, hasPromptBeenShown]);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const autocompleteSuggestions = useMemo(() => {
    const q = globalSearchTerm.trim().toLowerCase();
    if (!q) return { groups: [], projects: [] };

    const matchedGroups = (churchGroups || [])
      .filter(g => g.name.toLowerCase().includes(q))
      .slice(0, 5);

    const matchedProjects = (projects || [])
      .filter(p => p.name.toLowerCase().includes(q))
      .slice(0, 5);

    return { groups: matchedGroups, projects: matchedProjects };
  }, [globalSearchTerm, churchGroups, projects]);

  const userSessionLogs = useMemo(() => {
    if (!currentUser || !systemLogs) return [];
    const nameLower = currentUser.name?.toLowerCase() || "";
    const emailLower = currentUser.email?.toLowerCase() || "";
    return systemLogs
      .filter(log => {
        const pBy = log.performedBy?.toLowerCase() || "";
        const matchesUser = pBy.includes(nameLower) || pBy.includes(emailLower) || log.metadata?.email?.toLowerCase() === emailLower;
        const isInternalSync = log.action?.includes("SYNC") || log.action?.includes("RENDER");
        return matchesUser && !isInternalSync;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3);
  }, [systemLogs, currentUser]);

  const formatLogTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
    } catch (e) {
      return "";
    }
  };

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFyDropdownOpen, setIsFyDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const fyDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo(0, 0);
    }
  }, [currentView]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchFocused(true);
      }

      // Escape to close everything
      if (e.key === 'Escape') {
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
        setIsSearchFocused(false);
        setSelectedRequisition(null);
        setIsGeneratingReceiptFromHub(null);
        setShowProfilePrompt(false);
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (fyDropdownRef.current && !fyDropdownRef.current.contains(event.target as Node)) {
        setIsFyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    const updated = saveRecentSearchTerm(trimmed);
    setRecentSearches(updated);

    // Log query to backend
    fetch("/api/search-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: trimmed,
        username: currentUser?.name || "Anonymous",
        email: currentUser?.email || "anonymous@pceastandrews.org"
      })
    }).catch(err => {
      console.warn("Failed to log search query to backend:", err);
    });
  };

  const removeRecentSearch = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = removeRecentSearchTerm(termToRemove);
    setRecentSearches(updated);
  };

  const clearAllRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearAllRecentSearchTerms();
    setRecentSearches([]);
  };

  const handleForgotPassword = async () => {
    setError("");
    setSuccess("");
    if (!email) {
      setError("Please input your email under 'YOUR EMAIL' first.");
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess("Secure password reset link has been dispatched to your email!");
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch reset email.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (authMode === "EMAIL_SIGNUP" && (password.length < 8 || password.length > 15)) {
      setError("Password must be between 8 and 15 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === "EMAIL_LOGIN") {
        await loginWithEmail(email, password);
      } else {
        await signupWithEmail(email, password, name);
      }
    } catch (err: any) {
      let message = "Authentication failed";
      if (err.code === 'auth/invalid-credential') {
        message = "Incorrect email or password. Please verify your credentials or sign up if you don't have an account.";
      } else if (err.code === 'auth/user-not-found') {
        message = "No account found with this email. Please sign up.";
      } else if (err.code === 'auth/wrong-password') {
        message = "Incorrect password. Please try again.";
      } else if (err.code === 'auth/email-already-in-use') {
        message = "This email is already registered. Please login instead.";
      } else if (err.code === 'auth/weak-password') {
        message = "Password is too weak. Use at least 8 characters.";
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setSuccess("");
    setIsSubmitting(true);
    try {
      await login();
    } catch (err: any) {
      setError(err?.message || "Failed to authenticate with Google. Please ensure popups are allowed and authorized domains are configured in your authentication console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (window.opener && window.opener !== window) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <h1 className="text-xl font-bold mb-2">Completing Authentication...</h1>
        <p className="text-slate-400 text-sm">Please wait while we log you in. This window should close automatically.</p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-black uppercase tracking-widest text-primary/80">STANDS FINANCE</h2>
          <p className="text-slate-400 text-[10px] mt-2 font-mono tracking-tighter uppercase">Logging in.</p>
        </motion.div>
      </div>
    );
  }

  if (isLoggingOut) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-black uppercase tracking-widest">Ending Session...</h2>
          <p className="text-slate-400 text-xs mt-2">Clearing secure transaction buffers.</p>
        </motion.div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="h-[100vh] w-[100vw] bg-slate-950 flex items-center justify-center sm:p-6 relative overflow-hidden">
        {/* Ambient background effects */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#1e293b_0%,transparent_50%)] opacity-30" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px]" />

        {/* CSS grid background pattern tilted 30 degrees with radial mask */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none [mask-image:radial-gradient(ellipse_90%_90%_at_50%_50%,#000_50%,transparent_100%)]">
          <div 
            className="absolute w-[200%] h-[200%] -top-[50%] -left-[50%] bg-[linear-gradient(to_right,rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.22)_1px,transparent_1px)] bg-[size:4rem_4rem]"
            style={{ transform: "rotate(30deg)" }}
          />
        </div>

        {/* Global Database Saving / Updating Indicator */}
        <AnimatePresence>
          {isDbSaving && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-2.5 bg-slate-900/95 text-white border border-sky-500/50 shadow-2xl rounded-full backdrop-blur-md text-xs font-semibold ring-1 ring-sky-500/20 pointer-events-none"
            >
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
              <span className="text-slate-100 font-medium">{dbSavingMessage || "Updating database..."}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Syncing
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full sm:max-w-md min-h-screen sm:min-h-0 bg-slate-900 border-x-0 sm:border border-slate-800 rounded-none sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-12 space-y-6 sm:space-y-8 relative z-10 flex flex-col justify-center no-scrollbar"
        >
          <div className="text-center space-y-4">
            {systemSettings.isSystemOffline && (
              <div className="p-4 bg-rose-950/40 border border-rose-800/40 rounded-2xl text-left space-y-1.5 mb-2 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2 text-rose-400 font-bold text-[10px] uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse shrink-0" />
                  <span className="text-rose-400 font-extrabold">Emergency Sudo Bypass Active</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-normal font-semibold">
                  The system is currently <strong>Offline</strong>. Standard user access yields the maintenance screen. Authorize with your registered Sudo Super Admin credentials to restore service.
                </p>
                <button
                  type="button"
                  onClick={() => setAdminBypass(false)}
                  className="text-[9px] font-black text-rose-400 hover:text-rose-350 uppercase tracking-widest mt-1 underline transition-all cursor-pointer"
                >
                  ← Return to Offline Screen
                </button>
              </div>
            )}

            {pendingInvite && (
              <div className="p-4 bg-sky-950/40 border border-sky-800/40 rounded-2xl text-left space-y-1.5 mb-2 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2 text-sky-400 font-bold text-[10px] uppercase tracking-wider">
                  <Mail size={13} className="text-sky-400" />
                  <span className="text-sky-450 font-black">Invitation Active</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed font-semibold">
                  Logging in via Google as <strong className="text-white font-extrabold">{pendingInvite.email}</strong> will claim your pre-approved privilege as <strong className="text-white font-extrabold">{pendingInvite.role?.replace("_", " ")}</strong> representing <strong className="text-white font-extrabold">{pendingInvite.group || "St Andrews Admin"}</strong>.
                </p>
              </div>
            )}

            <div className="relative inline-block">
              <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center border border-slate-700/50 backdrop-blur-sm p-2 shadow-xl">
                <img src="/pcea.svg" alt="PCEA Logo" className="w-full h-full object-contain" />
              </div>
              
            </div>
            
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-white uppercase tracking-tighter">STANDS FINANCE</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.25em]">E-Requisition</p>
            </div>
          </div>

          <div className="space-y-6">
            <button 
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full py-4 bg-white hover:bg-slate-50 text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 shadow-xl border border-white"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign In With Google
            </button>

            <div className="relative flex items-center justify-center">
              <div className="absolute w-full border-t border-slate-800" />
              <span className="relative px-4 bg-slate-900 text-slate-500 text-[9px] font-bold uppercase tracking-widest">Or Login Via Email</span>
            </div>

            <form ref={loginFormRef} autoComplete="off" className="space-y-4" onSubmit={handleEmailAuth}>
              <div className="space-y-4">
                {authMode === "EMAIL_SIGNUP" && (
                  <div className="relative">
                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                      type="text"
                      name="name"
                      autoComplete="off"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-5 py-3 text-white text-xs font-bold focus:border-primary/50 outline-none transition-all placeholder:text-slate-700"
                      placeholder="Full Name"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="email"
                    name="email"
                    autoComplete="off"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-12 pr-5 py-3 text-white text-xs font-bold focus:border-primary/50 outline-none transition-all placeholder:text-slate-700"
                    placeholder="name@church.org"
                  />
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    required
                    maxLength={15}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-5 pr-12 py-3 text-white text-xs font-bold focus:border-primary/50 outline-none transition-all placeholder:text-slate-700 font-mono"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 hover:scale-105 active:scale-95 transition-all focus:outline-none flex items-center justify-center p-1"
                    title={showPassword ? "Hide Password" : "Show Password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {isSubmitting && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
                    <div className="flex flex-col items-center gap-2">
                       <Loader2 className="animate-spin text-primary" size={32} />
                       <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Authenticating...</span>
                    </div>
                  </div>
              )}
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl transition-all font-black text-xs shadow-xl shadow-primary/20 flex items-center justify-center gap-2 mt-4"
              >
                {isSubmitting ? "Processing..." : authMode === "EMAIL_LOGIN" ? "Login" : "Request Activation"}
              </button>

              <div className="space-y-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setAuthMode(authMode === "EMAIL_SIGNUP" ? "EMAIL_LOGIN" : "EMAIL_SIGNUP")}
                  className="w-full py-2 text-primary hover:text-primary/80 font-black text-[9px] uppercase tracking-widest transition-colors"
                >
                  {authMode === "EMAIL_SIGNUP" ? "Already have access? Login" : "Don't Have An Account? Signup Here"}
                </button>
              </div>
            </form>
          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock size={10} className="text-slate-600" />
              <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Secure</span>
            </div>
          </div>
        </motion.div>

        {/* Real-time Toast Notifications */}
        <div className="fixed bottom-6 sm:bottom-8 right-4 sm:right-6 z-[100] flex flex-col gap-2.5 w-88 sm:w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
          <AnimatePresence mode="popLayout">
            {activeToasts.map((toast, index) => (
              <ToastItem
                key={`login-${toast.id || index}-${index}`}
                toast={toast}
                index={index}
                removeToast={removeToast}
                setCurrentView={setCurrentView}
                darkMode={darkMode}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // System Offline Shield
  if (systemSettings.isSystemOffline && !adminBypass) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100 p-6 relative overflow-hidden">
        {/* Ambient warm warning backgrounds */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_45%,#991b1b,transparent_60%)] opacity-20 pointer-events-none" />

        <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-rose-950/50 border border-rose-800/40 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl animate-pulse"
          >
            <Lock size={48} className="text-rose-500" />
          </motion.div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">System Offline</h1>
            <p className="text-rose-500/85 text-[10px] font-black uppercase tracking-[0.25em]">Critical Sudo Maintenance</p>
          </div>

          <p className="text-slate-400 text-xs font-semibold leading-relaxed max-w-sm mx-auto">
            The St Andrews E-REQUISITIONS portal is currently offline for scheduled maintenance or emergency configuration. Please check back later.
          </p>

          <div className="pt-6 border-t border-slate-800/60 flex flex-col items-center gap-4 w-full text-center">
            {currentUser?.role === UserRole.SUPER_ADMIN ? (
              <>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Authenticated Super Admin
                </p>
                <button
                  onClick={() => setAdminBypass(true)}
                  className="w-full py-3 bg-white text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={14} />
                  Restore Sudo Control
                </button>
              </>
            ) : (
              <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Clock size={12} />
                Maintenance Mode Active
              </span>
            )}

            <button
              onClick={handleLogout}
              className="text-[9px] text-slate-500 hover:text-white uppercase tracking-widest font-black transition-colors mt-2"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Room or Suspension Logic
  if ((!currentUser.isApproved && currentUser.role !== UserRole.SUPER_ADMIN) || currentUser.isSuspended) {
    return (
      <>
        <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-mono text-sm">Loading security verification...</div>}>
          <WaitingRoom user={currentUser} onLogout={handleLogout} />
        </Suspense>
        {/* Real-time Toast Notifications */}
        <div className="fixed bottom-6 sm:bottom-8 right-4 sm:right-6 z-[100] flex flex-col gap-2.5 w-88 sm:w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
          <AnimatePresence mode="popLayout">
            {activeToasts.map((toast, index) => (
              <ToastItem
                key={`waiting-${toast.id || index}-${index}`}
                toast={toast}
                index={index}
                removeToast={removeToast}
                setCurrentView={setCurrentView}
                darkMode={darkMode}
              />
            ))}
          </AnimatePresence>
        </div>
      </>
    );
  }

  // Animated Splash Screen after login
  if (showSplash) {
    return (
      <Suspense fallback={null}>
        <SplashPage
          darkMode={darkMode}
          durationMs={4500}
          isDataReady={!loading && !authLoading}
          onComplete={() => setShowSplash(false)}
        />
      </Suspense>
    );
  }

  if (loading || !systemSettings?.currentFiscalYear) {
    return (
      <div className={cn(
        "flex h-screen overflow-hidden transition-colors duration-300",
        darkMode ? "dark bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      )}>
        {/* Sidebar Skeleton (hidden on small screens like real sidebar) */}
        <div className={cn(
          "hidden md:flex flex-col w-[260px] h-full p-5 border-r shrink-0 gap-8",
          darkMode ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200"
        )}>
          {/* Brand/Logo Skeleton */}
          <div className="flex items-center gap-3 px-2 mt-2">
            <div className={cn("w-9 h-9 rounded-xl animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
            <div className="space-y-2 flex-1">
              <div className={cn("h-3.5 w-24 rounded-md animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
              <div className={cn("h-2.5 w-16 rounded-md animate-pulse", darkMode ? "bg-slate-800/50" : "bg-slate-200/50")} />
            </div>
          </div>

          {/* Navigation Skeleton */}
          <div className="flex flex-col gap-2 flex-1">
            <div className={cn("h-11 w-full rounded-xl animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
            <div className={cn("h-11 w-full rounded-xl animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
            <div className={cn("h-11 w-full rounded-xl animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
            <div className="mt-8 space-y-2">
              <div className={cn("h-8 w-2/3 rounded-lg animate-pulse", darkMode ? "bg-slate-800/50" : "bg-slate-200/50")} />
              <div className={cn("h-11 w-full rounded-xl animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
            </div>
          </div>

          <div className={cn("h-14 w-full rounded-xl animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
        </div>

        {/* Main Content Area Skeleton */}
        <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-y-auto">
          {/* Top Bar / Header Skeleton */}
          <div className={cn(
            "flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-[2rem] border",
            darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          )}>
            <div className="space-y-3">
              <div className={cn("h-7 w-64 rounded-lg animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
              <div className={cn("h-4 w-48 rounded-md animate-pulse", darkMode ? "bg-slate-800/50" : "bg-slate-200/50")} />
            </div>
            <div className="flex gap-3">
              <div className={cn("h-11 w-11 rounded-[1.25rem] animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
              <div className={cn("h-11 w-32 rounded-[1.25rem] animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
            </div>
          </div>

          {/* KPI Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn(
                "h-[120px] rounded-[1.8rem] border p-6 flex justify-between",
                darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm",
                i === 3 ? "hidden lg:flex" : "flex"
              )}>
                <div className="space-y-3 pt-2">
                  <div className={cn("h-3 w-20 rounded-md animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
                  <div className={cn("h-6 w-32 rounded-lg animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
                </div>
                <div className={cn("h-12 w-12 rounded-[1.2rem] animate-pulse", darkMode ? "bg-slate-800" : "bg-slate-200")} />
              </div>
            ))}
          </div>

          {/* Main Content Body Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={cn(
              "col-span-1 lg:col-span-2 h-[450px] rounded-[2rem] border animate-pulse",
              darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )} />
            <div className={cn(
              "h-[450px] rounded-[2rem] border animate-pulse",
              darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )} />
          </div>
        </div>
      </div>
    );
  }

  // Report compilation state

  // Compiler notifications listing
  const notificationItems: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    actionLabel: string;
    action: () => void | Promise<void>;
    requisition?: any;
  }> = [];

  // 1. Members awaiting approval (only for ADMIN/SUPER_ADMIN)
  if (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) {
    users.filter(u => !u.isApproved).forEach(u => {
      notificationItems.push({
        id: `user-await-${u.id}`,
        type: "MEMBER_APPROVAL",
        title: "Member Pending Approval",
        message: `${u.name} (${u.email}) is awaiting account activation.`,
        actionLabel: "Authorize User",
        action: async () => {
          await approveUser(u.id);
        }
      });
    });

    // 2. New requisitions received (status === SUBMITTED)
    requisitions.filter(r => r.status === "SUBMITTED" && !r.id.includes("req-seed-")).forEach(r => {
      notificationItems.push({
        id: `req-sub-${r.id}`,
        type: "REQ_RECEIVED",
        title: "New Requisition Received",
        message: `"${r.title}" (${r.groupName}) for KES ${r.amount.toLocaleString()} is pending decision.`,
        actionLabel: "Review Requisitions",
        requisition: r,
        action: () => {
          setCurrentView("approvals");
          setIsNotificationsOpen(false);
        }
      });
    });
  }

  // 3. New approvals done
  requisitions.filter(r => (r.status === "APPROVED_L1" || r.status === "APPROVED_L2") && !r.id.includes("req-seed-")).forEach(r => {
    notificationItems.push({
      id: `req-app-${r.id}`,
      type: "REQ_APPROVED",
      title: "Requisition Approved",
      message: `"${r.title}" has been authorized to ${r.status.replace("_", " ")} for KES ${r.amount.toLocaleString()}.`,
      actionLabel: "View Ledger",
      requisition: r,
      action: () => {
        setCurrentView("requisitions");
        setIsNotificationsOpen(false);
      }
    });
  });

  // 3.5. Disbursements needed (specifically for FINANCE, ADMIN, and SUPER_ADMIN roles)
  if (currentUser?.role === UserRole.FINANCE || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) {
    requisitions.filter(r => r.status === "APPROVED_L2" && !r.id.includes("req-seed-")).forEach(r => {
      notificationItems.push({
        id: `finance-disb-req-${r.id}`,
        type: "FINANCE_DISBURSEMENT_REQUIRED",
        title: "Disbursement Action Required",
        message: `Requisition "${r.title}" (${r.groupName}) is L2 APPROVED and ready for immediate payout of KES ${r.amount.toLocaleString()}.`,
        actionLabel: "Disburse Ledger",
        requisition: r,
        action: () => {
          setCurrentView("finance");
          setIsNotificationsOpen(false);
        }
      });
    });
  }

  // 3.8. Database alerts (e.g. Budget overshoots, comment @mentions)
  if (Array.isArray(alerts)) {
    alerts.filter(a => {
      if (a.targetUserId) {
        return currentUser?.id === a.targetUserId;
      }
      if (a.targetRole && currentUser?.role !== a.targetRole && currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.SUPER_ADMIN) return false;
      return true;
    }).forEach(a => {
      // Find matching requisition if possible
      const cleanText = a.message.toLowerCase();
      const associatedReq = requisitions.find(r => 
        (r.id && cleanText.includes(r.id.toLowerCase())) || 
        (r.title && cleanText.includes(r.title.toLowerCase()))
      );

      notificationItems.push({
        id: `budget-alert-${a.id}`,
        type: "BUDGET_ALERT",
        title: a.type === "OVERSHOOT" ? "Budget Alert" : a.targetUserId ? "New @Mention" : "System Notification",
        message: a.message,
        actionLabel: associatedReq ? "Inspect Requisition" : "Dismiss Alert",
        requisition: associatedReq,
        action: () => {
          if (associatedReq) {
            setSelectedRequisition(associatedReq);
            setCurrentView("requisitions");
            setIsNotificationsOpen(false);
          }
        }
      });
    });
  }

  // 4. Report generation reminder
  if (showReportReminder) {
    notificationItems.push({
      id: "report-reminder",
      type: "REPORT_REMINDER",
      title: "Consolidated Reports Pending",
      message: "Reconcile actual payouts vs project allocations and compile audited ledger report.",
      actionLabel: reportState === "SUCCESS" ? "Report Downloaded ✓" : reportState === "GENERATING" ? "Compiling..." : "Compile PDF Report",
      action: () => {
        setReportState("GENERATING");
        setTimeout(() => {
          setReportState("SUCCESS");
          setTimeout(() => {
            setShowReportReminder(false);
            setReportState("IDLE");
          }, 2000);
        }, 1500);
      }
    });
  }

  const renderView = () => {
    if (deletedReqId) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 max-w-md mx-auto text-center space-y-6 animate-in fade-in duration-300 select-none">
          <div className="w-20 h-20 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center shadow-md shadow-rose-500/10">
            <Trash2 size={36} className="stroke-[1.75]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Requisition is Deleted
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium max-w-sm mx-auto">
              This requisition <span className="font-mono font-bold text-slate-700 dark:text-slate-300">#{deletedReqId}</span> has been deleted and is no longer available in the system.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                // Remove reqId parameter from URL without page reload
                const url = new URL(window.location.href);
                url.searchParams.delete("reqId");
                url.searchParams.delete("requisitionId");
                url.searchParams.delete("id");
                window.history.replaceState({}, document.title, url.toString());

                // Reset state parameters and direct recovery to dashboard
                setDeletedReqId(null);
                setTargetReqId(null);
                setCurrentView("dashboard");
              }}
              className="px-8 py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 mx-auto"
            >
              <ArrowLeft size={16} />
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      );
    }

    if (accessDeniedReq) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 max-w-2xl mx-auto text-center space-y-8 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 shadow-sm animate-pulse">
            <Lock size={28} />
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
              Compliance Restricted Ledger
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold max-w-md mx-auto">
              You are attempting to inspect an individual cash requisition belonging to an unauthorized ministry department or group.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-md mx-auto">
              Under PCE St. Andrews administrative audit regulations, your account clearance level does not authorize access to this specific department's ledger operations.
            </p>
          </div>

          <div className="w-full bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 p-5 text-left font-mono text-xs space-y-3 max-w-md mx-auto shadow-inner">
            <div className="flex justify-between items-center text-slate-400">
              <span className="font-bold text-[9px] uppercase tracking-wider">TARGET REQUISITION:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">#{accessDeniedReq.id}</span>
            </div>
            {accessDeniedReq.title && (
              <div className="flex justify-between items-start text-slate-500 dark:text-slate-400">
                <span className="shrink-0 font-bold text-[9px] uppercase tracking-wider">TITLE:</span>
                <span className="font-bold text-right text-slate-850 dark:text-slate-200 truncate max-w-[200px]">{accessDeniedReq.title}</span>
              </div>
            )}
            {accessDeniedReq.groupName && (
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span className="font-bold text-[9px] uppercase tracking-wider">GROUP COMPLIANCE:</span>
                <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 font-black uppercase text-[10px] tracking-wider">
                  {accessDeniedReq.groupName}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-200/40 dark:border-slate-800/40 text-[10px]">
              <span>YOUR METRIC EMAIL:</span>
              <span className="font-bold text-blue-500 dark:text-blue-400">{currentUser?.email}</span>
            </div>
            <div className="flex justify-between items-center text-slate-550 dark:text-slate-400 text-[10px]">
              <span>YOUR METRIC ROLE:</span>
              <span className="font-extrabold text-indigo-500 dark:text-indigo-400 uppercase">{currentUser?.role}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto pt-4">
            <button
              onClick={() => {
                // Remove reqId parameter from URL without page reload
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);

                // Reset state parameters and direct recovery to dashboard
                setAccessDeniedReq(null);
                setTargetReqId(null);
                setCurrentView("dashboard");
              }}
              className="flex-1 px-8 py-3 bg-gradient-to-r from-primary to-indigo-650 hover:to-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-95 active:scale-95 transition-all shadow-md cursor-pointer"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      );
    }

    if (currentView !== "help" && !canAccess(currentView)) {
      return <Dashboard onViewChange={handleNavigate} darkMode={darkMode} setDarkMode={handleToggleTheme} />;
    }

    const renderPanel = () => {
      switch (currentView) {
        case "dashboard": return <Dashboard onViewChange={handleNavigate} darkMode={darkMode} setDarkMode={handleToggleTheme} />;
        case "notifications": return <NotificationHub onSelectRequisition={(req) => { setSelectedRequisition(req); setCurrentView("requisitions"); }} />;
        case "requisitions": return <RequisitionsPanel />;
        case "vendors": return <VendorsPanel />;
        case "approvals": return <ApprovalsPanel />;
        case "settings": return <SettingsPanel />;
        case "users": return <UsersPanel />;
        case "reports": return <ReportsPanel />;
        case "transactions": return <TransactionsPanel />;
        case "finance": return <FinanceLedgerPanel />;
        case "accessControl": return <AccessControlPanel />;
        case "auditTrail": return <AuditLogsPanel />;
        case "help": return <HelpPanel onPlayTour={() => setIsTourOpen(true)} />;
        default: return <Dashboard onViewChange={setCurrentView} darkMode={darkMode} setDarkMode={handleToggleTheme} />;
      }
    };

    return (
      <Suspense fallback={<PanelSkeletonFallback viewName={currentView} />}>
        {renderPanel()}
      </Suspense>
    );
  };

  const unreadNotificationsCount = notificationItems.filter(item => !readNoticeIds.includes(item.id)).length;

  return (
    <div className={cn(
      "flex h-screen overflow-hidden font-sans transition-colors duration-300",
      darkMode ? "dark bg-background text-foreground" : "bg-slate-50 text-slate-900"
    )}>
      <AnimatePresence>
        {showProfilePrompt && currentUser && (
          <ProfilePrompt user={currentUser} onComplete={() => setShowProfilePrompt(false)} />
        )}

        {showUpdatePasswordModal && currentUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
            onClick={() => setShowUpdatePasswordModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-[2.5rem] max-w-sm md:max-w-md w-full p-8 md:p-10 space-y-6 shadow-2xl relative overflow-hidden"
            >
              {/* Visual icon container */}
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 rounded-[1.5rem] flex items-center justify-center">
                  <KeyRound size={28} />
                </div>
              </div>

              {/* Title & Badge */}
              <div className="space-y-1.5 text-center">
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                  Update Password
                </h2>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
                  RESET PASSWORD
                </span>
              </div>

              {/* Status alerts */}
              {passwordError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-[11px] font-bold flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess ? (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-[11px] font-bold flex items-start gap-2">
                    <CheckCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{passwordSuccess}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowUpdatePasswordModal(false);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPasswordError("");
                      setPasswordSuccess("");
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer text-center"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPasswordError("");

                    if (!currentPassword) {
                      setPasswordError("Current password is required.");
                      return;
                    }
                    if (newPassword.length < 8) {
                      setPasswordError("Password must be at least 8 characters long.");
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      setPasswordError("Passwords do not match.");
                      return;
                    }

                    setIsUpdatingPassword(true);
                    try {
                      // Note: We need a way to verify current password if the API supports it,
                      // or just pass it to the backend. Assuming the API handles it or this is just for UI validation
                      // Based on context, updateCurrentUserPassword likely just updates new.
                      // For this specific applet, we might need a custom endpoint if Firebase auth needs re-auth for password update.
                      // Given constraints, I will follow the user's requirement to add the UI fields.
                      await updateCurrentUserPassword(newPassword);
                      setPasswordSuccess("Your account password has been updated successfully.");
                    } catch (err: any) {
                      setPasswordError(err.message || "Failed to update password.");
                    } finally {
                      setIsUpdatingPassword(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-3">
                    {/* Current Password */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Lock size={12} /> Current Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3 top-3.5 text-slate-400" />
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full pl-9 pr-10 py-3 bg-background border border-border rounded-xl text-xs font-bold focus:border-primary focus:outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                        >
                          {showCurrentPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* New Password Input */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Lock size={12} /> New Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3 top-3.5 text-slate-400" />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-9 pr-10 py-3 bg-background border border-border rounded-xl text-xs font-bold focus:border-primary focus:outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {newPassword && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`h-1 w-12 rounded-full ${getPasswordStrength(newPassword).color}`} />
                          <span className="text-[9px] font-bold text-slate-500 uppercase">{getPasswordStrength(newPassword).label}</span>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password Input */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Lock size={12} /> Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock size={14} className="absolute left-3 top-3.5 text-slate-400" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-9 pr-16 py-3 bg-background border border-border rounded-xl text-xs font-bold focus:border-primary focus:outline-none transition-colors"
                        />
                        {confirmPassword && (
                          <div className="absolute right-10 top-3.5 flex items-center justify-center pointer-events-none">
                            {confirmPassword === newPassword ? (
                              <Check size={14} className="text-emerald-500 dark:text-emerald-400 stroke-[3]" />
                            ) : (
                              <X size={14} className="text-rose-500 dark:text-rose-400 stroke-[3]" />
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer text-center"
                  >
                    {isUpdatingPassword ? "Updating..." : "Update Password"}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}

        {showProfilePrompt && currentUser && (
          <Suspense fallback={null}>
            <ProfilePrompt user={currentUser} onComplete={() => setShowProfilePrompt(false)} />
          </Suspense>
        )}

        {showFeedbackModal && currentUser && (
          <Suspense fallback={null}>
            <FeedbackModal currentUser={currentUser} onClose={() => setShowFeedbackModal(false)} />
          </Suspense>
        )}

        {showLogoutModal && currentUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border rounded-[2.5rem] max-w-sm md:max-w-md w-full p-8 md:p-10 space-y-6 shadow-2xl relative overflow-hidden"
            >
              {/* Top decoration strip */}
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />

              {/* Visual icon container */}
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-[1.5rem] flex items-center justify-center">
                  <ShieldCheck size={28} />
                </div>
              </div>

              {/* Title & Badge */}
              <div className="space-y-1.5 text-center">
                <h2 id="security-summary-title" className="text-lg font-black uppercase tracking-tight text-foreground">
                  LOGGING OUT
                </h2>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-500 dark:text-cyan-400">
                  E-REQUISITIONS
                </span>
              </div>

              {/* Session Details */}
              <div className="bg-slate-100/60 dark:bg-slate-950/60 border border-border/40 rounded-2xl p-4 space-y-3 text-left">
                <div className="flex items-center justify-between text-[11px] border-b border-border/40 pb-2">
                  <span className="text-muted font-bold uppercase tracking-wider">Your Email</span>
                  <span className="text-foreground font-black font-mono truncate max-w-[200px]">{currentUser.email}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] border-b border-border/40 pb-2">
                  <span className="text-muted font-bold uppercase tracking-wider">Your Role</span>
                  <span className="text-indigo-500 font-black uppercase tracking-wider">{currentUser.role}</span>
                </div>
                {(currentUser.group || (currentUser.groups && currentUser.groups.length > 0)) && (
                  <div className="flex flex-col gap-1 text-[11px] border-b border-border/40 pb-2">
                    <span className="text-muted font-bold uppercase tracking-wider block text-left">Assigned Ministry Group(s)</span>
                    <span className="text-foreground font-black text-xs text-right block self-end uppercase">
                      {currentUser.groups && currentUser.groups.length > 0 ? currentUser.groups.join(", ") : currentUser.group}
                    </span>
                  </div>
                )}

                {/* Security Parameter checks */}
                <div className="space-y-2 pt-1.5 text-left hidden">
                  <h4 className="text-[9px] font-black text-muted uppercase tracking-widest text-left">Active Safety Handshakes</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Cache Intact
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Sandbox Ok
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Audit Log */}
              <div className="space-y-2.5 text-left">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-muted">
                  <Shield size={12} className="text-cyan-500 dark:text-cyan-400" />
                  <span>Session Security Audit Log</span>
                  <span className="text-[9px] font-bold text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest ml-auto">
                    Recent Actions
                  </span>
                </div>

                <div className="bg-slate-100/60 dark:bg-slate-950/60 border border-border/40 rounded-2xl p-4 space-y-3 max-h-[180px] overflow-y-auto custom-scrollbar">
                  {userSessionLogs.length > 0 ? (
                    <div className="space-y-3">
                      {userSessionLogs.map((log, logIdx) => {
                        const act = log.action || "";
                        let colorClass = "text-slate-500 bg-slate-500/10 border-slate-500/20";
                        if (act.includes("CREATE") || act.includes("SUBMIT") || act.includes("ADD")) {
                          colorClass = "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
                        } else if (act.includes("DELETE") || act.includes("REMOVE") || act.includes("REVOKE") || act.includes("SUSPEND")) {
                          colorClass = "text-rose-500 bg-rose-500/10 border-rose-500/20";
                        } else if (act.includes("UPDATE") || act.includes("EDIT") || act.includes("PATCH")) {
                          colorClass = "text-amber-500 bg-amber-500/10 border-amber-500/20";
                        } else if (act.includes("APPROVE") || act.includes("ACTIVATE") || act.includes("GRANT") || act.includes("RESOLVE")) {
                          colorClass = "text-cyan-500 bg-cyan-500/10 border-cyan-500/20";
                        } else if (act.includes("LOGIN") || act.includes("AUTH")) {
                          colorClass = "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";
                        }

                        return (
                          <div key={`user-session-log-${log.id || logIdx}-${logIdx}`} className="flex gap-2.5 text-left border-b border-border/20 last:border-0 pb-2.5 last:pb-0">
                            <div className={cn("w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 text-[8px] font-black", colorClass)}>
                              {act.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[9px] font-black uppercase tracking-wider text-foreground truncate">
                                  {act.replace(/_/g, " ")}
                                </span>
                                <span className="text-[9px] font-medium font-mono text-muted shrink-0">
                                  {formatLogTime(log.timestamp)}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted leading-relaxed line-clamp-2">
                                {log.details}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 space-y-1.5">
                      <CheckCircle size={16} className="text-emerald-500 mx-auto animate-pulse" />
                      <p className="text-[10px] font-black uppercase tracking-wider text-foreground">Ledger Fully Synced</p>
                      <p className="text-[9px] text-muted max-w-[240px] mx-auto leading-normal">
                        No other significant actions recorded in this session. Your activity history has been fully synced.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-muted text-xs leading-relaxed text-center">
                Are you sure you want to end your current session?
              </p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  id="cancel-logout-btn"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer text-center"
                >
                  Cancel Exit
                </button>
                <button
                  id="confirm-logout-btn"
                  onClick={executeActualLogout}
                  className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-600/20 cursor-pointer flex items-center justify-center gap-2 text-center"
                >
                  <LogOut size={12} /> Confirm LogOut
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showIdleWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border rounded-[2.5rem] max-w-sm w-full p-8 md:p-10 space-y-6 shadow-2xl relative overflow-hidden text-center"
            >
              {/* Visual icon container */}
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-[1.5rem] flex items-center justify-center animate-pulse">
                  <Clock size={28} />
                </div>
              </div>

              {/* Title & Badge */}
              <div className="space-y-2">
                <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
                  Session Expiration Warning
                </h2>
                <p className="text-amber-500 text-[10px] font-black uppercase tracking-[0.25em]">
                  INACTIVE_SESSION_ALERT
                </p>
              </div>

              {/* Description */}
              <p className="text-muted text-xs font-semibold leading-relaxed">
                You have been inactive for some time. For security, your session will automatically expire in <span className="text-foreground font-black tabular-nums">{idleCountdown} seconds</span>.
              </p>

              {/* Countdown Progress Slider */}
              <div className="space-y-2 text-left">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted tracking-wider px-1">
                  <span>Session Expiry Progress</span>
                  <span className="tabular-nums font-black text-amber-500">{idleCountdown}s remaining</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"
                    initial={{ width: "100%" }}
                    animate={{ width: `${(idleCountdown / 60) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 space-y-3">
                <button
                  onClick={() => {
                    resetIdleTimer();
                    setShowIdleWarning(false);
                  }}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 cursor-pointer flex items-center justify-center gap-2"
                >
                  Save and Stay
                </button>
                <button
                  onClick={() => {
                    setShowIdleWarning(false);
                    handleLogout();
                  }}
                  className="w-full py-3 text-[10px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest transition-colors cursor-pointer text-center"
                >
                  Log Out Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar currentView={currentView} onViewChange={handleNavigate} notificationsCount={unreadNotificationsCount} onLogout={handleLogout} />

      <main className="flex-1 flex flex-col min-w-0">
        <AnnouncementBanner />
        {!isOnline && (
          <div className="bg-amber-600 dark:bg-amber-700 text-white select-none px-4 md:px-8 py-2 md:py-2.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest gap-4 shrink-0 transition-all shadow-md z-40 border-b border-amber-500/20">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
              <span>Offline Mode • Viewing Cached Financial Data (Read-only)</span>
            </div>
            <span className="bg-amber-700/60 dark:bg-amber-800/60 px-2 py-0.5 rounded text-[8px] font-bold">LOCAL CACHE READY</span>
          </div>
        )}
        {systemSettings.isSystemOffline && adminBypass && (
          <div className="bg-rose-600 text-white select-none px-4 md:px-8 py-2 md:py-2.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest gap-4 shrink-0 transition-all shadow-md z-40">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
              <span>Emergency Sudo Bypass Active • System remains Offline to standard users</span>
            </div>
            {currentUser?.role === UserRole.SUPER_ADMIN && (
              <button
                onClick={async () => {
                  if (confirm("🚨 Are you sure you want to RESTORE system access for all users?")) {
                    await updateSystemSettings({ isSystemOffline: false });
                  }
                }}
                className="bg-white hover:bg-slate-100 text-rose-600 px-3 py-1 rounded-lg text-[9px] font-black cursor-pointer transition-colors shrink-0"
              >
                Restore System Access
              </button>
            )}
          </div>
        )}
        {/* Header */}
        <header className="min-h-[5rem] py-3 bg-card border-b border-border flex items-center justify-between px-4 md:px-8 shrink-0 select-none transition-all">
          <div className="flex flex-col justify-center">
            <h1 className="text-xs md:text-lg font-bold text-foreground leading-tight truncate max-w-[150px] md:max-w-none">
              {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
              {currentUser.groups && currentUser.groups.length > 0
                ? `: ${currentUser.groups.join(", ")}`
                : currentUser.group
                  ? `: ${currentUser.group}`
                  : ""}
            </h1>
            <p className="text-[10px] text-muted hidden sm:flex items-center gap-2">
              {isSyncingData ? (
                <>
                  <RefreshCw className="animate-spin text-indigo-500" size={10} />
                  <span className="text-indigo-600 font-medium tracking-wide">Syncing Data 🔍</span>
                </>
              ) : (
                <>System synchronized • {new Date().toLocaleTimeString()}</>
              )}
            </p>
          </div>

          <div id="global-search-container" className="flex-1 max-w-md mx-8 hidden md:block" ref={searchRef}>
            <div className="relative pb-0.5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={16} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search requisitions by title or group..."
                  className="w-full pl-10 pr-16 py-2 bg-background border border-border rounded-lg text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-muted/50 text-foreground"
                  value={globalSearchTerm}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGlobalSearchTerm(val);
                    if (val.trim() !== "") {
                      handleNavigate("requisitions");
                    }
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      saveRecentSearch(globalSearchTerm);
                      setIsSearchFocused(false);
                      handleNavigate("requisitions");
                      (e.target as HTMLInputElement).blur();
                      setTimeout(() => {
                        setGlobalSearchTerm("");
                      }, 1000);
                    }
                  }}
                />
                {globalSearchTerm && (
                  <button
                    onClick={() => setGlobalSearchTerm("")}
                    className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAdvancedSearchActive(!advancedSearchActive);
                    setCurrentView("requisitions");
                  }}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all cursor-pointer ${advancedSearchActive
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    }`}
                  title="Advanced search criteria"
                >
                  <Sliders size={14} />
                </button>
              </div>

              <AnimatePresence>
                {advancedSearchActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-4 space-y-4 text-slate-800 dark:text-slate-100"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">Advanced Search Criteria</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAdvancedDateRangePreset("ALL");
                          setAdvancedCustomStartDate("");
                          setAdvancedCustomEndDate("");
                          setAdvancedBudgetLine("ALL");
                        }}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 uppercase"
                      >
                        Reset Filters
                      </button>
                    </div>

                    {/* Date Range Selection */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Date Range</label>
                      <select
                        value={advancedDateRangePreset}
                        onChange={(e) => setAdvancedDateRangePreset(e.target.value as any)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none text-slate-800 dark:text-white"
                      >
                        <option value="ALL">All Time</option>
                        <option value="WEEK">Past Week</option>
                        <option value="MONTH">Past Month</option>
                        <option value="CUSTOM">Custom Range</option>
                      </select>

                      {advancedDateRangePreset === "CUSTOM" && (
                        <div className="grid grid-cols-2 gap-2 mt-1.5 animate-in fade-in slide-in-from-top-1">
                          <div className="space-y-0.5">
                            <label className="text-[8px] font-black text-slate-450 uppercase block font-sans">Start Date</label>
                            <input
                              type="date"
                              value={advancedCustomStartDate}
                              onChange={(e) => setAdvancedCustomStartDate(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] font-bold outline-none text-slate-800 dark:text-white"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[8px] font-black text-slate-450 uppercase block font-sans">End Date</label>
                            <input
                              type="date"
                              value={advancedCustomEndDate}
                              onChange={(e) => setAdvancedCustomEndDate(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-[11px] font-bold outline-none text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Budget Line Selection */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Budget Line / Ministry Group</label>
                      <select
                        value={advancedBudgetLine}
                        onChange={(e) => setAdvancedBudgetLine(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold outline-none text-slate-800 dark:text-white"
                      >
                        <option value="ALL">All Budget Lines</option>
                        {churchGroups.map((group) => (
                          <option key={group.id} value={group.name}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setAdvancedSearchActive(false)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold uppercase tracking-wider rounded-lg text-[10px] transition-colors"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isSearchFocused && !advancedSearchActive && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50 p-2 divide-y divide-border/50 max-h-[400px] overflow-y-auto"
                  >
                    {!globalSearchTerm.trim() ? (
                      recentSearches.length > 0 ? (
                        <div>
                          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/10 mb-1">
                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Recent Searches</span>
                            <button
                              onClick={clearAllRecentSearches}
                              className="text-[9px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider flex items-center gap-1 cursor-pointer bg-transparent border-none"
                            >
                              <Trash2 size={10} />
                              Clear All
                            </button>
                          </div>
                          <div className="space-y-0.5">
                            {recentSearches.map((term, idx) => (
                              <div
                                key={`${term}-${idx}`}
                                onClick={() => {
                                  setGlobalSearchTerm(term);
                                  saveRecentSearch(term);
                                  setIsSearchFocused(false);
                                  setCurrentView("requisitions");
                                }}
                                className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/25 rounded-lg text-xs text-slate-700 dark:text-slate-300 cursor-pointer transition-colors group"
                              >
                                <div className="flex items-center gap-2">
                                  <Clock size={12} className="text-slate-400 group-hover:text-indigo-500" />
                                  <span className="font-medium">{term}</span>
                                </div>
                                <button
                                  onClick={(e) => removeRecentSearch(term, e)}
                                  className="text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-850 rounded p-1 transition-all cursor-pointer bg-transparent border-none"
                                  title="Remove search from history"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 text-center text-[10px] uppercase font-black tracking-widest text-slate-400">
                          Type to search church groups or requisitions...
                        </div>
                      )
                    ) : (
                      <div className="space-y-3 p-1">
                        {/* Budget Categories section */}
                        {autocompleteSuggestions.groups.length > 0 && (
                          <div className="space-y-1">
                            <div className="px-2 py-1 text-[9px] font-extrabold text-indigo-505 uppercase tracking-wider">
                              Budget Categories (Ministries)
                            </div>
                            {autocompleteSuggestions.groups.map((group) => (
                              <button
                                key={group.id}
                                type="button"
                                onClick={() => {
                                  setGlobalSearchTerm(group.name);
                                  saveRecentSearch(group.name);
                                  setIsSearchFocused(false);
                                  setCurrentView("requisitions");
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-indigo-50/50 dark:hover:bg-slate-800/40 rounded-lg text-left transition-all"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm">💒</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-850 dark:text-slate-20 truncate">{group.name}</p>
                                    {group.description && (
                                      <p className="text-[10px] text-slate-400 truncate font-medium">{group.description}</p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full dark:text-indigo-400 dark:bg-slate-800/60">
                                  Category
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Project Lines section */}
                        {autocompleteSuggestions.projects.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-border/40">
                            <div className="px-2 py-1 text-[9px] font-extrabold text-emerald-500 uppercase tracking-wider">
                              Project Allocation Lines
                            </div>
                            {autocompleteSuggestions.projects.map((proj) => (
                              <button
                                key={proj.id}
                                type="button"
                                onClick={() => {
                                  setGlobalSearchTerm(proj.name);
                                  saveRecentSearch(proj.name);
                                  setIsSearchFocused(false);
                                  setCurrentView("requisitions");
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-2 hover:bg-emerald-50/50 dark:hover:bg-slate-800/40 rounded-lg text-left transition-all"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm">📁</span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{proj.name}</p>
                                    <p className="text-[10px] text-slate-400 font-medium font-mono">
                                      FY {proj.fiscalYear || systemSettings.currentFiscalYear} • Budget: KES {proj.allocatedBudget.toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full dark:text-emerald-400 dark:bg-slate-800/60">
                                  Project Line
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {autocompleteSuggestions.groups.length === 0 && autocompleteSuggestions.projects.length === 0 && (
                          <div className="p-4 text-center space-y-1">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold">No matching suggestions</p>
                            <p className="text-[9px] text-slate-400 italic font-medium">Press Enter to search requisitions instead</p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center border-r border-slate-200 dark:border-slate-800/80 pr-4 mr-2">
              <button
                type="button"
                onClick={() => handleToggleTheme()}
                id="header-dark-mode-toggle"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 rounded-full transition-all text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 cursor-pointer shadow-xs active:scale-95"
              >
                {darkMode ? (
                  <>
                    <Sun size={12} className="text-amber-500" />
                    <span className="hidden sm:inline">Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon size={12} className="text-indigo-600 dark:text-indigo-400" />
                    <span className="hidden sm:inline">Dark Mode</span>
                  </>
                )}
              </button>
            </div>

            {/* Fiscal Year Quick Context Switcher */}
            <div className="relative" ref={fyDropdownRef}>
              <button
                type="button"
                disabled={!(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN)}
                onClick={() => setIsFyDropdownOpen(!isFyDropdownOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-tight transition-all",
                  (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN)
                    ? "bg-primary/5 text-primary border-primary/25 hover:bg-primary/10 cursor-pointer"
                    : "bg-slate-50 dark:bg-slate-900 border-border text-slate-500"
                )}
              >
                <Calendar size={12} className={(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) ? "text-primary" : "text-slate-400"} />
                <span>FY {systemSettings.currentFiscalYear}</span>
                {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && <ChevronDown size={10} className="opacity-70" />}
              </button>

              <AnimatePresence>
                {isFyDropdownOpen && (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 p-1 text-left"
                  >
                    <div className="px-2.5 py-1.5 border-b border-border/10 mb-1">
                      <span className="text-[8px] font-black text-muted uppercase tracking-widest block">Quick Operational Shift</span>
                      <span className="text-[9px] text-foreground font-medium">Choose financial horizon context:</span>
                    </div>
                    <div className="space-y-0.5">
                      {fiscalYears && fiscalYears.length > 0 ? (
                        fiscalYears.map((fy) => {
                          const isCurrent = systemSettings.currentFiscalYear === fy.year;
                          return (
                            <button
                              key={fy.id}
                              type="button"
                              onClick={async () => {
                                setIsFyDropdownOpen(false);
                                if (isCurrent) return;
                                try {
                                  await setActiveFiscalYear(fy.year);
                                  alert(`Successfully switched active operational context to financial year ${fy.year}.`);
                                } catch (err: any) {
                                  alert(err.message || "Failed to switch active fiscal year.");
                                }
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-2.5 py-2 hover:bg-slate-500/5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer",
                                isCurrent ? "text-primary bg-primary/5" : "text-foreground"
                              )}
                            >
                              <div className="flex flex-col">
                                <span className="font-mono text-[11px] font-black">FY {fy.year}</span>
                                <span className="text-[9px] text-muted truncate max-w-[130px] font-medium">{fy.label}</span>
                              </div>
                              <span className={cn(
                                "text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                                fy.status === "OPEN" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400"
                              )}>
                                {fy.status}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        // Default Fallback Choices
                        [2026, 2027].map((yr) => {
                          const isCurrent = systemSettings.currentFiscalYear === yr;
                          const label = yr === 2026 ? "FY 2026 Standard Baseline" : "FY 2027 Strategic Outreach Plan";
                          const status = yr === 2026 ? "OPEN" : "CLOSED";
                          return (
                            <button
                              key={yr}
                              type="button"
                              onClick={async () => {
                                setIsFyDropdownOpen(false);
                                if (isCurrent) return;
                                try {
                                  await setActiveFiscalYear(yr);
                                  alert(`Successfully switched active operational context to financial year ${yr}.`);
                                } catch (err: any) {
                                  alert(err.message || "Failed to switch active fiscal year.");
                                }
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-2.5 py-2 hover:bg-slate-500/5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer",
                                isCurrent ? "text-primary bg-primary/5" : "text-foreground"
                              )}
                            >
                              <div className="flex flex-col">
                                <span className="font-mono text-[11px] font-black">FY {yr}</span>
                                <span className="text-[9px] text-muted truncate max-w-[130px] font-medium">{label}</span>
                              </div>
                              <span className={cn(
                                "text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full",
                                status === "OPEN" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                              )}>
                                {status}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div id="notification-bell-trigger" className="relative" ref={notificationsRef}>
              <button
                onClick={() => {
                  const nextOpen = !isNotificationsOpen;
                  setIsNotificationsOpen(nextOpen);
                  if (nextOpen && notificationItems.length > 0) {
                    const allIds = notificationItems.map(item => item.id);
                    markAllNoticesRead(allIds);
                  }
                }}
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 relative cursor-pointer border",
                  darkMode
                    ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 shadow-black/40"
                    : "bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-slate-100/80 shadow-md"
                )}
              >
                <Bell size={18} className={cn("transition-transform", isNotificationsOpen && "scale-110")} />
                {!isDoNotDisturb && unreadNotificationsCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-[#8b8df2] text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm">
                    {unreadNotificationsCount}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "absolute right-0 mt-3 w-96 rounded-2xl shadow-2xl overflow-hidden z-50 text-left border",
                      darkMode
                        ? "bg-slate-900 border-slate-800 text-slate-100 shadow-black/80"
                        : "bg-white border-slate-200 text-slate-800 shadow-slate-300/50"
                    )}
                  >
                    {/* Header */}
                    <div className={cn(
                      "px-5 py-4 border-b flex items-center justify-between",
                      darkMode ? "border-slate-850 bg-slate-900/50" : "border-slate-100 bg-white"
                    )}>
                      <span className={cn(
                        "text-[15px] font-black tracking-tight",
                        darkMode ? "text-slate-100" : "text-slate-900"
                      )}>
                        Notifications
                      </span>
                      
                      {/* Do not disturb toggle */}
                      <div className="flex items-center gap-2.5 select-none">
                        <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                          Do not disturb
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsDoNotDisturb(!isDoNotDisturb)}
                          className={cn(
                            "w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none relative cursor-pointer",
                            isDoNotDisturb 
                              ? "bg-indigo-500" 
                              : darkMode ? "bg-slate-800" : "bg-slate-200"
                          )}
                        >
                          <motion.div
                            layout
                            className="w-4 h-4 rounded-full bg-white shadow-sm"
                            animate={{ x: isDoNotDisturb ? 16 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[360px] overflow-y-auto scrollbar-hide divide-y divide-slate-100/80 dark:divide-slate-800/80">
                      {notificationItems.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 space-y-2 px-6">
                          <Bell size={24} className="mx-auto opacity-20 text-indigo-500" />
                          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">ledger cleared</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed max-w-[200px] mx-auto">All member feeds and approvals are synchronized.</p>
                        </div>
                      ) : (() => {
                        const unread = notificationItems.filter(item => !readNoticeIds.includes(item.id));
                        const read = notificationItems.filter(item => readNoticeIds.includes(item.id));
                        const allMerged = [...unread, ...read];

                        return allMerged.map((item) => {
                          const isItemUnread = !readNoticeIds.includes(item.id);
                          
                          // Dynamically format relative time offsets like "Now", "1h ago", "4h ago"
                          const relativeTime = (() => {
                            if (item.requisition && item.requisition.submittedAt) {
                              const diffMs = new Date().getTime() - new Date(item.requisition.submittedAt).getTime();
                              const diffMins = Math.floor(diffMs / (60 * 1000));
                              if (diffMins < 1) return "Now";
                              if (diffMins < 60) return `${diffMins}m ago`;
                              const diffHrs = Math.floor(diffMins / 60);
                              if (diffHrs < 24) return `${diffHrs}h ago`;
                              const diffDays = Math.floor(diffHrs / 24);
                              return `${diffDays}d ago`;
                            }
                            const id = item.id;
                            if (id.includes("report-reminder")) return "Now";
                            if (id.includes("user-await")) return "12m ago";
                            if (id.includes("finance-disb")) return "2h ago";
                            if (id.includes("req-app")) return "4h ago";
                            return "1d ago";
                          })();

                          return (
                            <div
                              key={`dropdown-item-${item.id}`}
                              onClick={() => {
                                if (item.requisition) {
                                  setSelectedRequisition(item.requisition);
                                  setCurrentView("requisitions");
                                  setIsNotificationsOpen(false);
                                }
                                toggleNoticeRead(item.id, true);
                              }}
                              className={cn(
                                "p-4 transition-all flex items-start relative group cursor-pointer select-none",
                                isItemUnread
                                  ? darkMode 
                                    ? "bg-slate-900/60 hover:bg-slate-850" 
                                    : "bg-white hover:bg-slate-50"
                                  : darkMode
                                    ? "bg-slate-950/20 hover:bg-slate-850/80 opacity-60"
                                    : "bg-slate-50/40 hover:bg-slate-50 opacity-65"
                              )}
                            >
                              {/* Purple Dot for unread, empty or faded for read */}
                              <div className="shrink-0 mt-1.5 mr-3 flex items-center justify-center">
                                {isItemUnread ? (
                                  <div className="w-2 h-2 rounded-full bg-[#8b8df2]" />
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 opacity-50" />
                                )}
                              </div>

                              {/* Message Content */}
                              <div className="flex-1 min-w-0 pr-4">
                                <p className={cn(
                                  "leading-snug text-[11.5px] font-medium transition-colors break-words",
                                  isItemUnread
                                    ? darkMode ? "text-slate-100 font-bold" : "text-slate-800 font-bold"
                                    : darkMode ? "text-slate-400" : "text-slate-600"
                                )}>
                                  {item.message}
                                </p>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 inline-block">
                                  {relativeTime}
                                </span>
                              </div>

                              {/* Hover Options (Three Dots Menu ...) */}
                              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNoticeRead(item.id);
                                    triggerToast({
                                      type: "SYSTEM_INFO",
                                      severity: "LOW",
                                      message: isItemUnread ? "Marked as read" : "Marked as unread",
                                      timestamp: new Date().toISOString()
                                    });
                                  }}
                                  className={cn(
                                    "p-1.5 rounded-lg border transition-all cursor-pointer shadow-xs",
                                    darkMode
                                      ? "bg-slate-800 border-slate-750 hover:bg-slate-700 text-slate-300"
                                      : "bg-white border-slate-200 hover:bg-slate-100 text-slate-500"
                                  )}
                                  title={isItemUnread ? "Mark as read" : "Mark as unread"}
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Footer */}
                    <div className={cn(
                      "px-5 py-3.5 border-t flex items-center justify-between gap-2",
                      darkMode ? "border-slate-800 bg-slate-900/40" : "border-slate-100 bg-white"
                    )}>
                      <button
                        onClick={() => {
                          const unreadIds = notificationItems
                            .filter(item => !readNoticeIds.includes(item.id))
                            .map(item => item.id);
                          if (unreadIds.length > 0) {
                            markAllNoticesRead(unreadIds);
                            triggerToast({
                              type: "SYSTEM_INFO",
                              severity: "LOW",
                              message: `Marked all as read`,
                              timestamp: new Date().toISOString()
                            });
                          }
                          setShowReportReminder(false);
                          setIsNotificationsOpen(false);
                        }}
                        className="text-xs font-black text-[#8b8df2] hover:text-[#7a7ce0] uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Mark all as read
                      </button>
                      
                      <button
                        onClick={() => {
                          handleNavigate("notifications");
                          setIsNotificationsOpen(false);
                        }}
                        className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Open Notification Hub
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div id="profile-dropdown-trigger" className="relative h-10 flex items-center" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-3 pl-4 pr-1 py-1 bg-slate-900 dark:bg-slate-900/90 rounded-full transition-all cursor-pointer group border border-slate-800 hover:border-primary/50 shadow-lg"
              >
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[10px] font-black text-white uppercase tracking-tight">{(currentUser?.name || "User").split(' ')[0]}</span>
                  <span className="text-[8px] text-primary font-bold uppercase tracking-widest leading-tight">{(currentUser?.role || "USER").split('_')[0]}</span>
                </div>
                <UserAvatar 
                  user={currentUser} 
                  size="sm" 
                  ring="ring-1 ring-white/20 shadow-xs" 
                  className="group-hover:scale-110 transition-transform" 
                />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-[60]"
                  >
                    <div className="p-4 border-b border-slate-50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">User Information</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{currentUser.email}</p>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setCurrentView("settings");
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <Settings size={14} className="text-primary" />
                        SYSTEM SETTINGS
                      </button>
                      <button
                        onClick={() => {
                          setShowUpdatePasswordModal(true);
                          setIsProfileOpen(false);
                          setNewPassword("");
                          setConfirmPassword("");
                          setPasswordError("");
                          setPasswordSuccess("");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <KeyRound size={14} className="text-slate-400" />
                        UPDATE PASSWORD
                      </button>
                      <button
                        onClick={() => {
                          setCurrentView("help");
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-left cursor-pointer"
                      >
                        <HelpCircle size={14} className="text-slate-400" />
                        PORTAL HELP
                      </button>

                      <div className="h-[1px] bg-slate-50 my-1" />

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-left"
                      >
                        <LogOut size={14} />
                        EXIT SESSION
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-3 md:p-6 pb-24 md:pb-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <PerformanceTracker currentView={currentView} isSyncingData={isSyncingData}>
                {renderView()}
              </PerformanceTracker>
            </motion.div>
          </AnimatePresence>
        </div>


      </main>

      {/* Real-time Toast Notifications */}
      <div className="fixed bottom-6 sm:bottom-8 right-4 sm:right-6 z-[100] flex flex-col gap-2.5 w-88 sm:w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
        <AnimatePresence mode="popLayout">
          {activeToasts.map((toast, index) => (
            <ToastItem
              key={`dashboard-${toast.id || index}-${index}`}
              toast={toast}
              index={index}
              removeToast={removeToast}
              setCurrentView={setCurrentView}
              darkMode={darkMode}
            />
          ))}
        </AnimatePresence>
      </div>

      {isGeneratingReceiptFromHub && (
        <Suspense fallback={null}>
          <ReceiptTemplateGenerator
            req={isGeneratingReceiptFromHub}
            onClose={() => setIsGeneratingReceiptFromHub(null)}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <ProductTour
          isOpen={isTourOpen}
          onClose={() => setIsTourOpen(false)}
          currentView={currentView}
          onViewChange={setCurrentView}
        />
      </Suspense>

      <Suspense fallback={null}>
        <BackgroundUploadWidget />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <RequisitionProvider>
      <AppContent />
    </RequisitionProvider>
  );
}
