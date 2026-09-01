/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * St. Andrew's PCEA eRequisitions Portal
 * Real-Time Virtualized Audit Log Terminal Mode (100vh Low-Demand Engine)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Terminal,
  Maximize2,
  Minimize2,
  X,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Sliders,
  Activity,
  Zap,
  Shield,
  CornerDownLeft,
  ChevronRight,
  ChevronDown,
  Info,
  Clock,
  User,
  Radio,
  ArrowDown,
  Layers,
  Sparkles,
  Database
} from "lucide-react";
import { SystemLog } from "../types";
import { cn } from "../lib/utils";

export interface AuditLogsTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: SystemLog[];
  onRefresh?: () => Promise<void> | void;
  systemLogLimit?: number;
  onSetSystemLogLimit?: (limit: number) => void;
}

export const AuditLogsTerminalModal: React.FC<AuditLogsTerminalModalProps> = ({
  isOpen,
  onClose,
  logs,
  onRefresh,
  systemLogLimit = 50,
  onSetSystemLogLimit,
}) => {
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cliInputRef = useRef<HTMLInputElement>(null);

  // View state
  const [searchTerm, setSearchTerm] = useState("");
  const [actionCategory, setActionCategory] = useState<string>("ALL");
  const [density, setDensity] = useState<"compact" | "standard">("compact");
  const [autoTail, setAutoTail] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(true);
  const [showTimestamps, setShowTimestamps] = useState<boolean>(true);
  const [wrapLines, setWrapLines] = useState<boolean>(true);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // CLI State
  const [cliInput, setCliInput] = useState<string>("");
  const [cliHistory, setCliHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [cliFeedback, setCliFeedback] = useState<{ text: string; type: "info" | "success" | "error" | "warn" } | null>(null);

  // Clock state
  const [currentTime, setCurrentTime] = useState<string>("");

  // Virtualization calculations
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

  // Row height in pixels based on density
  const ROW_HEIGHT = density === "compact" ? 30 : 44;
  const OVERSCAN = 5;

  // Real-time clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track viewport height using ResizeObserver for precision 100vh calculation
  useEffect(() => {
    if (!isOpen) return;

    const el = scrollContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [isOpen]);

  // Unique categories for filtering
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.action.includes("AUTH") || log.action.includes("USER") || log.action.includes("LOGIN") || log.action.includes("LOGOUT")) {
        set.add("AUTH");
      } else if (log.action.includes("APPROV") || log.action.includes("REVISE") || log.action.includes("REJECT")) {
        set.add("APPROVAL");
      } else if (log.action.includes("DISBURS") || log.action.includes("PAYMENT") || log.action.includes("TRANSACTION") || log.action.includes("LEDGER")) {
        set.add("FINANCE");
      } else if (log.action.includes("DELETE") || log.action.includes("ALERT") || log.action.includes("SECURITY") || log.action.includes("WARNING")) {
        set.add("SECURITY");
      } else if (log.action.includes("REQUISITION")) {
        set.add("REQUISITION");
      } else {
        set.add("SYSTEM");
      }
    });
    return ["ALL", ...Array.from(set)];
  }, [logs]);

  // Filter logs based on search & category
  const filteredLogs = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return logs.filter((log) => {
      const matchesSearch =
        !term ||
        log.details.toLowerCase().includes(term) ||
        log.performedBy.toLowerCase().includes(term) ||
        log.action.toLowerCase().includes(term) ||
        (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (actionCategory === "ALL") return true;
      if (actionCategory === "AUTH") return log.action.includes("AUTH") || log.action.includes("USER") || log.action.includes("LOGIN") || log.action.includes("LOGOUT");
      if (actionCategory === "APPROVAL") return log.action.includes("APPROV") || log.action.includes("REVISE") || log.action.includes("REJECT");
      if (actionCategory === "FINANCE") return log.action.includes("DISBURS") || log.action.includes("PAYMENT") || log.action.includes("TRANSACTION") || log.action.includes("LEDGER");
      if (actionCategory === "SECURITY") return log.action.includes("DELETE") || log.action.includes("ALERT") || log.action.includes("SECURITY") || log.action.includes("WARNING");
      if (actionCategory === "REQUISITION") return log.action.includes("REQUISITION");
      if (actionCategory === "SYSTEM") return !log.action.includes("AUTH") && !log.action.includes("APPROV") && !log.action.includes("DISBURS");

      return true;
    });
  }, [logs, searchTerm, actionCategory]);

  const totalCount = filteredLogs.length;
  const totalVirtualHeight = totalCount * ROW_HEIGHT;

  // Compute 100vh low-demand virtualization window
  const { startIndex, endIndex, topPadding, bottomPadding } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + 2 * OVERSCAN;
    const end = Math.min(totalCount, start + visibleCount);

    const top = start * ROW_HEIGHT;
    const bottom = Math.max(0, (totalCount - end) * ROW_HEIGHT);

    return {
      startIndex: start,
      endIndex: end,
      topPadding: top,
      bottomPadding: bottom,
    };
  }, [scrollTop, ROW_HEIGHT, viewportHeight, totalCount, OVERSCAN]);

  const visibleLogs = useMemo(() => {
    return filteredLogs.slice(startIndex, endIndex);
  }, [filteredLogs, startIndex, endIndex]);

  // Handle scroll events & detect auto-tail detachment
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const currentScrollTop = target.scrollTop;
    setScrollTop(currentScrollTop);

    const distanceFromBottom = target.scrollHeight - currentScrollTop - target.clientHeight;
    if (distanceFromBottom > 80) {
      setUserHasScrolledUp(true);
    } else {
      setUserHasScrolledUp(false);
    }
  }, []);

  // Auto-scroll to bottom if autoTail is active and new log arrives
  useEffect(() => {
    if (!isOpen || isPaused || !autoTail || userHasScrolledUp) return;

    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length, autoTail, isPaused, userHasScrolledUp, isOpen]);

  // Highlight latest log when it arrives
  const prevLogsCountRef = useRef(logs.length);
  useEffect(() => {
    if (logs.length > prevLogsCountRef.current && logs.length > 0) {
      const newest = logs[logs.length - 1];
      if (newest?.id) {
        setHighlightedId(newest.id);
        const timer = setTimeout(() => setHighlightedId(null), 2500);
        return () => clearTimeout(timer);
      }
    }
    prevLogsCountRef.current = logs.length;
  }, [logs]);

  // Resume auto-tail
  const handleResumeAutoTail = () => {
    setUserHasScrolledUp(false);
    setAutoTail(true);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setSearchTerm("");
        setCliFeedback({ text: "Terminal display buffer filter cleared.", type: "info" });
      } else if (e.key === "`" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        cliInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Copy logs to clipboard
  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((log, idx) => {
        const time = new Date(log.timestamp).toISOString();
        const meta = log.metadata ? ` | META: ${JSON.stringify(log.metadata)}` : "";
        return `[${String(idx + 1).padStart(4, "0")}] [${time}] [${log.action}] [@${log.performedBy}] ${log.details}${meta}`;
      })
      .join("\n");

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download raw .log file
  const handleDownloadLog = () => {
    const header = [
      "================================================================================",
      " ST. ANDREW'S PCEA eREQUISITIONS PORTAL — REAL-TIME AUDIT TRAIL STREAM",
      ` Generated At: ${new Date().toISOString()} | Total Records: ${filteredLogs.length}`,
      " Environment: Production / Verified Ledger Node",
      "================================================================================",
      "",
    ].join("\n");

    const body = filteredLogs
      .map((log, idx) => {
        const time = new Date(log.timestamp).toISOString();
        const meta = log.metadata ? `\n      METADATA: ${JSON.stringify(log.metadata, null, 2)}` : "";
        return `[${String(idx + 1).padStart(5, "0")}] ${time} [${log.action.padEnd(24, " ")}] BY:@${log.performedBy} -- ${log.details}${meta}`;
      })
      .join("\n");

    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `standrews_audit_stream_${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Trigger manual refresh
  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        setCliFeedback({ text: "Fetched latest real-time audit log stream from server.", type: "success" });
      } catch (err) {
        setCliFeedback({ text: "Failed to refresh audit log stream.", type: "error" });
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  // CLI Command Parser & Executor
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;

    // Add to history
    setCliHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCliInput("");

    const parts = cmd.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    switch (command) {
      case "help":
      case "?":
        setCliFeedback({
          text: "Commands: grep <term>, filter <category>, tail [on|off], pause, resume, limit <n>, clear, reset, copy, export, refresh, density, wrap, exit",
          type: "info",
        });
        break;

      case "grep":
      case "search":
      case "find":
        if (!args) {
          setSearchTerm("");
          setCliFeedback({ text: "Grep filter reset. Showing all logs.", type: "info" });
        } else {
          setSearchTerm(args);
          setCliFeedback({ text: `Applied grep filter: "${args}" (${filteredLogs.length} matches)`, type: "success" });
        }
        break;

      case "filter":
      case "cat":
      case "category":
        const catArg = args.toUpperCase();
        if (availableCategories.includes(catArg)) {
          setActionCategory(catArg);
          setCliFeedback({ text: `Filter set to category: [${catArg}]`, type: "success" });
        } else {
          setCliFeedback({
            text: `Invalid category. Available: ${availableCategories.join(", ")}`,
            type: "error",
          });
        }
        break;

      case "tail":
        if (args === "on" || args === "true" || args === "1") {
          setAutoTail(true);
          setUserHasScrolledUp(false);
          setCliFeedback({ text: "Auto-tail enabled (following latest stream).", type: "success" });
        } else if (args === "off" || args === "false" || args === "0") {
          setAutoTail(false);
          setCliFeedback({ text: "Auto-tail disabled.", type: "warn" });
        } else {
          setAutoTail((prev) => !prev);
          setCliFeedback({ text: `Auto-tail toggled ${!autoTail ? "ON" : "OFF"}.`, type: "info" });
        }
        break;

      case "pause":
        setIsPaused(true);
        setCliFeedback({ text: "Stream monitoring paused.", type: "warn" });
        break;

      case "resume":
      case "play":
        setIsPaused(false);
        setCliFeedback({ text: "Stream monitoring resumed (LIVE).", type: "success" });
        break;

      case "clear":
      case "cls":
        setSearchTerm("__NONE__");
        setCliFeedback({ text: "Display buffer cleared. Type 'reset' to reload logs.", type: "info" });
        break;

      case "reset":
      case "reload":
        setSearchTerm("");
        setActionCategory("ALL");
        setIsPaused(false);
        setUserHasScrolledUp(false);
        setAutoTail(true);
        setCliFeedback({ text: "Terminal views & filters reset to live stream defaults.", type: "success" });
        break;

      case "limit":
        const num = parseInt(args, 10);
        if (!isNaN(num) && num > 0 && onSetSystemLogLimit) {
          onSetSystemLogLimit(num);
          setCliFeedback({ text: `Stream sync limit updated to ${num} logs.`, type: "success" });
        } else {
          setCliFeedback({ text: "Usage: limit <number> (e.g. limit 250)", type: "error" });
        }
        break;

      case "copy":
        handleCopyLogs();
        setCliFeedback({ text: `Copied ${filteredLogs.length} audit logs to clipboard.`, type: "success" });
        break;

      case "export":
      case "download":
      case "save":
        handleDownloadLog();
        setCliFeedback({ text: "Generated and downloaded audit stream .log file.", type: "success" });
        break;

      case "refresh":
      case "sync":
        handleRefresh();
        break;

      case "density":
        setDensity((prev) => (prev === "compact" ? "standard" : "compact"));
        setCliFeedback({ text: `Switched row density to ${density === "compact" ? "standard" : "compact"}.`, type: "info" });
        break;

      case "wrap":
        setWrapLines((prev) => !prev);
        setCliFeedback({ text: `Text line wrapping toggled ${!wrapLines ? "ON" : "OFF"}.`, type: "info" });
        break;

      case "exit":
      case "quit":
      case "q":
        onClose();
        break;

      case "stats":
        setCliFeedback({
          text: `STATS: Total Logs: ${logs.length} | Visible/Rendered in 100vh DOM: ${visibleLogs.length} | Memory Footprint: LOW (Virtualized) | Viewport: ${viewportHeight}px`,
          type: "info",
        });
        break;

      default:
        setCliFeedback({
          text: `Unknown command: "${command}". Type "help" or "?" for list of terminal operations.`,
          type: "error",
        });
        break;
    }
  };

  // Navigate CLI history with up/down arrows
  const handleCliKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cliHistory.length === 0) return;
      const nextIndex = historyIndex === -1 ? cliHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCliInput(cliHistory[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= cliHistory.length) {
        setHistoryIndex(-1);
        setCliInput("");
      } else {
        setHistoryIndex(nextIndex);
        setCliInput(cliHistory[nextIndex]);
      }
    }
  };

  // Toggle log metadata expanded view
  const toggleExpand = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Color formatter for log actions
  const getActionColor = (action: string) => {
    if (action.includes("AUTH") || action.includes("LOGIN") || action.includes("LOGOUT")) {
      return "text-purple-400 border-purple-800/60 bg-purple-950/40";
    }
    if (action.includes("APPROVED_L1") || action.includes("APPROVED_L2") || action.includes("APPROV")) {
      return "text-emerald-400 border-emerald-800/60 bg-emerald-950/40";
    }
    if (action.includes("DISBURS") || action.includes("PAYMENT") || action.includes("LEDGER")) {
      return "text-teal-300 border-teal-800/60 bg-teal-950/40";
    }
    if (action.includes("REJECT") || action.includes("DELETE") || action.includes("FAIL") || action.includes("ERROR") || action.includes("ALERT")) {
      return "text-rose-400 border-rose-800/60 bg-rose-950/40";
    }
    if (action.includes("REQUISITION") || action.includes("CREATE") || action.includes("UPDATE")) {
      return "text-amber-400 border-amber-800/60 bg-amber-950/40";
    }
    if (action.includes("BACKUP") || action.includes("SYNC") || action.includes("REPORT")) {
      return "text-cyan-400 border-cyan-800/60 bg-cyan-950/40";
    }
    return "text-slate-300 border-slate-700/60 bg-slate-900/40";
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="fixed inset-0 z-50 flex flex-col bg-[#080c14] text-slate-200 font-mono select-text antialiased overflow-hidden"
      >
        {/* Terminal Header & Control Bar */}
        <header className="shrink-0 bg-[#0d131f] border-b border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
          {/* Left: Window Controls & Title */}
          <div className="flex items-center gap-3">
            {/* macOS Style Window Action Dots */}
            <div className="flex items-center gap-1.5 mr-1">
              <button
                onClick={onClose}
                title="Close Terminal (Esc)"
                className="w-3 h-3 rounded-full bg-rose-500 hover:bg-rose-600 transition-colors flex items-center justify-center cursor-pointer group"
              >
                <X size={8} className="opacity-0 group-hover:opacity-100 text-rose-950" />
              </button>
              <button
                onClick={() => setDensity((d) => (d === "compact" ? "standard" : "compact"))}
                title="Toggle Density"
                className="w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 transition-colors cursor-pointer"
              />
              <button
                onClick={() => setIsFullscreen((f) => !f)}
                title="Toggle Fullscreen"
                className="w-3 h-3 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Terminal size={15} className="text-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-black">root@standrews-pcea:</span>
              <span className="text-slate-400">~/audit-trail/live-stream.log</span>
              <span className="hidden md:inline-block px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 font-normal">
                PID: 4892 • TTY1
              </span>
            </div>
          </div>

          {/* Center: Live Stream Status Badge & 100vh Virtualization Indicator */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/80 text-[10px] font-bold text-emerald-300">
              <span className="relative flex h-2 w-2">
                {!isPaused && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={cn("relative inline-flex rounded-full h-2 w-2", isPaused ? "bg-amber-500" : "bg-emerald-500")}></span>
              </span>
              <span>{isPaused ? "STREAM PAUSED" : "LIVE STREAMING"}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
              <Layers size={11} className="text-cyan-400" />
              <span>100vh Low-Demand Virtualization:</span>
              <span className="text-cyan-300 font-bold">
                {visibleLogs.length} in DOM / {filteredLogs.length} total
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
              <Clock size={11} className="text-slate-400" />
              <span className="tabular-nums">{currentTime}</span>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Auto Tail Toggle */}
            <button
              onClick={() => setAutoTail((t) => !t)}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border transition-all cursor-pointer",
                autoTail
                  ? "bg-indigo-950/80 border-indigo-700 text-indigo-300 shadow-2xs"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              )}
              title="Toggle Auto-Scroll to Latest (Tail Mode)"
            >
              <Radio size={11} className={autoTail ? "text-indigo-400 animate-pulse" : "text-slate-500"} />
              <span>TAIL {autoTail ? "ON" : "OFF"}</span>
            </button>

            {/* Pause / Resume */}
            <button
              onClick={() => setIsPaused((p) => !p)}
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border transition-all cursor-pointer",
                isPaused
                  ? "bg-amber-950/80 border-amber-700 text-amber-300"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              )}
              title={isPaused ? "Resume Live Stream" : "Pause Stream"}
            >
              {isPaused ? <Play size={11} className="text-amber-400" /> : <Pause size={11} className="text-slate-400" />}
              <span>{isPaused ? "RESUME" : "PAUSE"}</span>
            </button>

            {/* Refresh */}
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-800/80 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Fetch Fresh Logs from Database"
              >
                <RefreshCw size={11} className={isRefreshing ? "animate-spin text-emerald-400" : ""} />
                <span className="hidden sm:inline">SYNC</span>
              </button>
            )}

            {/* Copy */}
            <button
              onClick={handleCopyLogs}
              className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-800/80 transition-all flex items-center gap-1 cursor-pointer"
              title="Copy Output to Clipboard"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span className="hidden sm:inline">{copied ? "COPIED" : "COPY"}</span>
            </button>

            {/* Download */}
            <button
              onClick={handleDownloadLog}
              className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-slate-900 border border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-800/80 transition-all flex items-center gap-1 cursor-pointer"
              title="Download .log File"
            >
              <Download size={11} />
              <span className="hidden sm:inline">EXPORT</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-800/80 transition-all cursor-pointer ml-1"
              title="Exit Terminal (Esc)"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        {/* Secondary Terminal Filter & Options Strip */}
        <div className="shrink-0 bg-[#090d16] border-b border-slate-850 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search / Grep Bar */}
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <div className="relative w-full">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-[11px]">
                grep &gt;
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter logs by keyword, user, action or ID..."
                className="w-full pl-16 pr-8 py-1 bg-[#0e1422] border border-slate-800 rounded text-[11px] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action Category Chips */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Filter:</span>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActionCategory(cat)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer border whitespace-nowrap",
                  actionCategory === cat
                    ? "bg-emerald-950 text-emerald-300 border-emerald-700 shadow-2xs"
                    : "bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300 hover:bg-slate-900"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Display Toggles */}
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <button
              onClick={() => setShowTimestamps((t) => !t)}
              className={cn("px-1.5 py-0.5 rounded border transition-colors cursor-pointer", showTimestamps ? "text-cyan-300 border-cyan-800 bg-cyan-950/40" : "border-slate-800 text-slate-600")}
              title="Toggle Timestamps"
            >
              TIME
            </button>
            <button
              onClick={() => setShowLineNumbers((l) => !l)}
              className={cn("px-1.5 py-0.5 rounded border transition-colors cursor-pointer", showLineNumbers ? "text-cyan-300 border-cyan-800 bg-cyan-950/40" : "border-slate-800 text-slate-600")}
              title="Toggle Line Numbers"
            >
              LNUM
            </button>
            <button
              onClick={() => setWrapLines((w) => !w)}
              className={cn("px-1.5 py-0.5 rounded border transition-colors cursor-pointer", wrapLines ? "text-cyan-300 border-cyan-800 bg-cyan-950/40" : "border-slate-800 text-slate-600")}
              title="Toggle Line Wrapping"
            >
              WRAP
            </button>
            <button
              onClick={() => setShowMetadata((m) => !m)}
              className={cn("px-1.5 py-0.5 rounded border transition-colors cursor-pointer", showMetadata ? "text-indigo-300 border-indigo-800 bg-indigo-950/40" : "border-slate-800 text-slate-600")}
              title="Toggle Metadata Inspector"
            >
              JSON META
            </button>
          </div>
        </div>

        {/* Floating Resume Auto-Tail Prompt (When User Scrolled Up) */}
        <AnimatePresence>
          {userHasScrolledUp && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={handleResumeAutoTail}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold uppercase rounded-full shadow-lg border border-indigo-400/50 flex items-center gap-2 cursor-pointer transition-all animate-bounce"
            >
              <ArrowDown size={13} />
              <span>Scroll to Live Tail ({filteredLogs.length} entries)</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Main Terminal Viewport (100vh Virtualized Stream Container) */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-auto relative bg-[#060910] scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent select-text p-2"
          style={{ willChange: "scroll-position" }}
        >
          {/* Total virtual spacer to allow real scroll bar dynamics */}
          <div style={{ height: `${totalVirtualHeight}px`, width: "100%", position: "relative" }}>
            {/* Render ONLY what intersects 100vh */}
            <div style={{ transform: `translateY(${topPadding}px)`, width: "100%" }}>
              {visibleLogs.map((log, localIdx) => {
                const actualIndex = startIndex + localIdx;
                const logTime = new Date(log.timestamp);
                const formattedTime = logTime.toISOString().replace("T", " ").substring(0, 19);
                const isNewHighlight = highlightedId === log.id;
                const isExpanded = expandedLogIds.has(log.id || `idx-${actualIndex}`);
                const actionBadgeClass = getActionColor(log.action);

                return (
                  <div
                    key={log.id || `virtual-log-${actualIndex}`}
                    onClick={() => log.metadata && toggleExpand(log.id || `idx-${actualIndex}`)}
                    className={cn(
                      "group font-mono transition-colors border-b border-slate-900/50 hover:bg-[#0f172a]/70 flex items-start gap-2.5 px-2 cursor-pointer select-text",
                      density === "compact" ? "py-1 text-[11px]" : "py-2 text-[12px]",
                      isNewHighlight && "bg-emerald-950/40 text-emerald-200 animate-pulse border-emerald-800/40",
                      wrapLines ? "whitespace-normal break-words" : "whitespace-nowrap"
                    )}
                  >
                    {/* Line Number */}
                    {showLineNumbers && (
                      <span className="text-slate-600 select-none text-[10px] w-10 text-right shrink-0 tabular-nums">
                        {String(actualIndex + 1).padStart(4, "0")}
                      </span>
                    )}

                    {/* Timestamp */}
                    {showTimestamps && (
                      <span className="text-slate-500 select-none text-[10px] shrink-0 tabular-nums">
                        [{formattedTime}]
                      </span>
                    )}

                    {/* Action Pill */}
                    <span
                      className={cn(
                        "px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase tracking-wider shrink-0 border",
                        actionBadgeClass
                      )}
                    >
                      {log.action}
                    </span>

                    {/* User Tag */}
                    <span className="text-indigo-400 font-bold shrink-0 text-[10px]">
                      @{log.performedBy}
                    </span>

                    {/* Details Message */}
                    <span className={cn("text-slate-300 font-normal flex-1 min-w-0", wrapLines ? "break-words" : "")}>
                      {log.details}
                    </span>

                    {/* Metadata Pill Indicator */}
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="shrink-0 flex items-center gap-1 text-[9px] text-slate-500 hover:text-slate-300">
                        <span className="px-1 py-0.2 rounded bg-slate-900 border border-slate-800">
                          JSON ({Object.keys(log.metadata).length})
                        </span>
                        {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </div>
                    )}

                    {/* Expanded JSON Inspector Block if active */}
                    {(isExpanded || showMetadata) && log.metadata && (
                      <div className="w-full mt-1.5 p-2.5 rounded bg-[#0b101c] border border-slate-800 text-[10px] font-mono text-cyan-300 overflow-x-auto">
                        <pre className="m-0 leading-relaxed whitespace-pre">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empty State */}
          {filteredLogs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center text-slate-500 space-y-3">
              <Terminal size={36} className="text-slate-700 animate-pulse" />
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                No matching audit logs in current buffer window
              </div>
              <p className="text-[10px] text-slate-600 max-w-sm">
                Try clearing the grep search query or selecting "ALL" from the category filters.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setActionCategory("ALL");
                }}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-emerald-400 text-[10px] font-bold uppercase rounded cursor-pointer transition-all"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* CLI Interactive Command Input Bar & Real-time Console Prompt */}
        <footer className="shrink-0 bg-[#0d131f] border-t border-slate-800/80 px-4 py-2.5 space-y-1.5 select-none">
          {/* CLI Feedback Alert Line */}
          {cliFeedback && (
            <div
              className={cn(
                "text-[10px] font-mono px-2.5 py-1 rounded flex items-center justify-between border transition-all",
                cliFeedback.type === "success" && "bg-emerald-950/60 border-emerald-800 text-emerald-300",
                cliFeedback.type === "error" && "bg-rose-950/60 border-rose-800 text-rose-300",
                cliFeedback.type === "warn" && "bg-amber-950/60 border-amber-800 text-amber-300",
                cliFeedback.type === "info" && "bg-cyan-950/60 border-cyan-800 text-cyan-300"
              )}
            >
              <span>{cliFeedback.text}</span>
              <button
                onClick={() => setCliFeedback(null)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Interactive Input Form */}
          <form onSubmit={handleCliSubmit} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-black shrink-0">
              <span>pcea@audit-server:~$</span>
            </div>
            <input
              ref={cliInputRef}
              type="text"
              value={cliInput}
              onChange={(e) => setCliInput(e.target.value)}
              onKeyDown={handleCliKeyDown}
              placeholder="Type terminal command (e.g. 'grep approval', 'tail on', 'clear', 'stats', 'export', 'help')..."
              className="flex-1 bg-transparent border-none text-slate-100 text-[12px] font-mono focus:outline-none placeholder-slate-600 caret-emerald-400"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase flex items-center gap-1 cursor-pointer transition-all border border-slate-700"
            >
              <CornerDownLeft size={10} />
              <span>RUN</span>
            </button>
          </form>

          {/* Bottom Quick Command Helper Chips */}
          <div className="flex items-center justify-between text-[9px] text-slate-500 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-600">Quick Commands:</span>
              {[
                { cmd: "help", label: "help" },
                { cmd: "grep approval", label: "grep approval" },
                { cmd: "grep auth", label: "grep auth" },
                { cmd: "tail on", label: "tail on" },
                { cmd: "stats", label: "stats" },
                { cmd: "clear", label: "clear" },
                { cmd: "reset", label: "reset" },
              ].map((item) => (
                <button
                  key={item.cmd}
                  type="button"
                  onClick={() => {
                    setCliInput(item.cmd);
                    cliInputRef.current?.focus();
                  }}
                  className="hover:text-emerald-400 hover:underline cursor-pointer"
                >
                  `{item.label}`
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center gap-3 text-slate-500">
              <span>Press <kbd className="px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">Esc</kbd> to exit</span>
              <span><kbd className="px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">Ctrl+L</kbd> to clear filter</span>
            </div>
          </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
};
