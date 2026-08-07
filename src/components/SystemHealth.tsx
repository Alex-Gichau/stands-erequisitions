/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { 
  Cpu, 
  Activity, 
  Database, 
  CheckCircle,
  Clock,
  Terminal,
  Zap,
  RefreshCw,
  AlertTriangle,
  ServerCrash,
  Radio,
  BellRing,
  Send,
  Users,
  Calendar,
  ShieldAlert,
  Server,
  AlertCircle,
  Fingerprint,
  CheckCheck,
  Workflow
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";

export const SystemHealth: React.FC<{ updateInterval?: number }> = ({ updateInterval = 2500 }) => {
  const { addSystemLog, requisitions = [] } = useRequisitions();

  // Simulated failure states
  const [downtimeActive, setDowntimeActive] = useState(false);
  const [latencyActive, setLatencyActive] = useState(false);
  const [lastNotificationStatus, setLastNotificationStatus] = useState<string | null>(null);
  const [routingState, setRoutingState] = useState<string | null>(null);

  // Live feed resembling Slack's dynamic rendering
  const [slackConsoleFeed, setSlackConsoleFeed] = useState<Array<{
    timestamp: string;
    channel: string;
    title: string;
    detail: string;
    payload: any;
    simulated: boolean;
  }>>([
    {
      timestamp: "08:00 AM",
      channel: "#finance-approvals",
      title: "Automated Morning Briefing",
      detail: "Initialized daily outstanding records broadcast.",
      payload: null,
      simulated: true
    }
  ]);

  // Real-time fluctuating metrics
  const [cpuUsage, setCpuUsage] = useState(14.8);
  const [memoryUsage, setMemoryUsage] = useState(1.42); // in GB
  const [dbLatency, setDbLatency] = useState(32); // in ms
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uptimeSeconds, setUptimeSeconds] = useState(144210); // Simulated baseline: ~40 hours

  // Real Database Health State
  const [realHealth, setRealHealth] = useState<any>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);

  const fetchRealHealth = async () => {
    setIsHealthLoading(true);
    try {
      const res = await fetch("/api/system-health");
      if (res.ok) {
        const data = await res.json();
        setRealHealth(data);
        if (data.mongodb) {
          setDbLatency(15); // baseline fast response for local mongo
        }
      }
    } catch (err) {
      console.warn("Failed to fetch system health. Retrying later...", err);
    } finally {
      setIsHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchRealHealth();
    const hInterval = setInterval(fetchRealHealth, 30000); // Check every 30s
    return () => clearInterval(hInterval);
  }, []);

  // Helper to trigger advanced summaries/alerts from express server
  const triggerSlackCommand = async (url: string, bodyData: any, label: string) => {
    setIsRefreshing(true);
    setRoutingState(`Assembling ${label} parameters...`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();
      if (data.success) {
        setLastNotificationStatus(`${label} sent! Routed to ${data.targetChannel}`);
        setRoutingState(null);
        
        const newFeedItem = {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          channel: data.targetChannel || "#system-logs",
          title: label,
          detail: data.message || `Broadcast completed successfully.`,
          payload: data.payload,
          simulated: !!data.simulated
        };
        setSlackConsoleFeed(prev => [newFeedItem, ...prev].slice(0, 8));
      } else {
        setLastNotificationStatus(`Error trigger: ${data.error || "failed"}`);
        setRoutingState(null);
      }
    } catch (err: any) {
      setLastNotificationStatus(`Server contact failed: ${err.message}`);
      setRoutingState(null);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Preset triggers for summaries and advanced rules
  const handleTriggerMorningBriefing = () => {
    triggerSlackCommand("/api/slack-summary/morning", { requisitions }, "Morning Pending Brief");
  };

  const handleTriggerEODSnapshot = () => {
    triggerSlackCommand("/api/slack-summary/eod", { requisitions }, "EOD Operations Summary");
  };

  const handleTriggerWeeklyLeaderboard = () => {
    triggerSlackCommand("/api/slack-summary/weekly", { requisitions }, "Weekly User Engagement Leaderboard");
  };

  const handleTriggerStaleRequisitions = () => {
    triggerSlackCommand("/api/slack-alert/workflow", { requisitions, type: "stale" }, "SLA Stale Queue Review [>48h]");
  };

  const handleTriggerAnomalyDetection = () => {
    triggerSlackCommand("/api/slack-alert/workflow", { requisitions, type: "behavioral" }, "Anti-Tamper Velocity Anomaly Code");
  };

  const handleTriggerSyncIncoherency = () => {
  };

  // Simulate Drive Engagement metrics check (Prompt 6)
  const handleTriggerDriveEngagementAlert = async () => {
    setIsRefreshing(true);
    setRoutingState("Auditing Drive Access logs...");
    try {
      const timestamp = new Date().toISOString();
      const action = "UNUSUAL_DRIVE_DOC_ACCESS_WARNING";
      const details = "⚠️ AUDIT HIGHLIGHT: Multi-tenant Drive document 'STANDS_Voucher_Store_2026.pdf' experienced unusual access count: 48 views in the past hour from a single subnet.";
      const metadata = {
        documentName: "STANDS_Voucher_Store_2026.pdf",
        accessCountLastHour: 48,
        alertSeverity: "CRITICAL",
        compromisedSubnet: "172.56.23.xx"
      };

      await addSystemLog(action, details, metadata);
      setLastNotificationStatus("Drive engagement warning dispatched!");
      
      setSlackConsoleFeed(prev => [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          channel: "#system-logs",
          title: "Drive Document Engagement Leak Warning",
          detail: details,
          payload: {
            attachments: [{
              color: "#dc2626",
              blocks: [
                { type: "header", text: { type: "plain_text", text: "🔒 GOOGLE DRIVE PRIVATE DATA SECURITY WARNING" } },
                { type: "section", text: { type: "mrkdwn", text: details } }
              ]
            }]
          },
          simulated: true
        },
        ...prev
      ].slice(0, 8));
    } catch (e: any) {
      setLastNotificationStatus("Failed: " + e.message);
    } finally {
      setIsRefreshing(false);
      setRoutingState(null);
    }
  };

  // Simulate Drive Sync Upload tracking (Prompt 6)
  const handleTriggerDriveUploadTracking = async () => {
    setIsRefreshing(true);
    setRoutingState("Analyzing file synchronization queue...");
    try {
      const action = "RECEIPTS_UPLOADED";
      const details = "📁 DRIVE ACCESS: Synchronzied new attachments. Receipt 'Lawnmower_Receipt_FY26.jpg' successfully uploaded and synced to PCA St. Andrews Secure Drive bucket.";
      const metadata = {
        fileName: "Lawnmower_Receipt_FY26.jpg",
        size: "1.4 MB",
        syncStatus: "QUALIFIED_OK",
        driveId: "drv_st_andrews_9883"
      };

      await addSystemLog(action, details, metadata);
      setLastNotificationStatus("Drive upload notice dispatched!");

      setSlackConsoleFeed(prev => [
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          channel: "#system-logs",
          title: "Google Drive File Sync Tracker",
          detail: details,
          payload: {
            attachments: [{
              color: "#3b82f6",
              blocks: [
                { type: "header", text: { type: "plain_text", text: "📁 GOOGLE DRIVE DATA SYNCHRONIZATION" } },
                { type: "section", text: { type: "mrkdwn", text: details } }
              ]
            }]
          },
          simulated: true
        },
        ...prev
      ].slice(0, 8));
    } catch (e: any) {
      setLastNotificationStatus("Failed: " + e.message);
    } finally {
      setIsRefreshing(false);
      setRoutingState(null);
    }
  };

  // Update loop for lifelike, clean real-time metrics
  useEffect(() => {
    const interval = setInterval(() => {
      if (downtimeActive) {
        setCpuUsage(0);
        setDbLatency(999);
        return;
      }

      if (latencyActive) {
        setCpuUsage(prev => {
          const delta = (Math.random() - 0.5) * 4;
          const next = Math.min(Math.max(prev + delta, 82), 94);
          return Number(next.toFixed(1));
        });

        setDbLatency(prev => {
          const delta = Math.round((Math.random() - 0.5) * 15);
          const next = Math.min(Math.max(prev + delta, 340), 450);
          return next;
        });
        return;
      }

      setCpuUsage(prev => {
        const delta = (Math.random() - 0.5) * 4;
        const next = prev + delta;
        return Math.min(Math.max(Number(next.toFixed(1)), 5), 45); // bounded between 5% and 45%
      });

      setDbLatency(prev => {
        const delta = Math.round((Math.random() - 0.5) * 6);
        const next = prev + delta;
        return Math.min(Math.max(next, 18), 60); // bounded between 18ms and 60ms
      });

      setUptimeSeconds(prev => prev + updateInterval / 1000);
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval, downtimeActive, latencyActive]);

  // Format uptime cleanly
  const formatUptime = (totalSeconds: number) => {
    const rounded = Math.round(totalSeconds);
    const days = Math.floor(rounded / (3600 * 24));
    const hours = Math.floor((rounded % (3600 * 24)) / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = rounded % 60;
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const toggleDowntime = async () => {
    const nextState = !downtimeActive;
    setDowntimeActive(nextState);
    if (nextState) {
      setLatencyActive(false); // mutually exclusive
      setCpuUsage(0);
      setDbLatency(999);
      setLastNotificationStatus("Firing Outage Slack Alert...");
      try {
        await addSystemLog(
          "SYSTEM_DOWNTIME_DETECTED",
          "🚨 CRITICAL DOWNTIME ALERT: St. Andrews Church Group Portal experienced a total host container VPS network outage."
        );
        setLastNotificationStatus("Slack Outage Alert Fired successfully!");
      } catch (err) {
        setLastNotificationStatus("Failed to dispatch log to Database/Slack.");
      }
    } else {
      setLastNotificationStatus("Restored system status to online.");
      setCpuUsage(14.8);
      setDbLatency(32);
    }
  };

  const toggleLatencySpill = async () => {
    const nextState = !latencyActive;
    setLatencyActive(nextState);
    if (nextState) {
      setDowntimeActive(false); // mutually exclusive
      setDbLatency(380);
      setCpuUsage(84.5);
      setLastNotificationStatus("Firing Latency Underperformance Slack Alert...");
      try {
        await addSystemLog(
          "PERFORMANCE_UNDER_THRESHOLD",
          "⚠️ SYSTEM UNDERPERFORMANCE DEGRADATION: Database sync latency spike detected. Read/write operations averaging 380ms (standard limit is 60ms)."
        );
        setLastNotificationStatus("Slack under-performance alert dispatched!");
      } catch (err) {
        setLastNotificationStatus("Failed to dispatch log to Database/Slack.");
      }
    } else {
      setLastNotificationStatus("Latency normalized.");
      setCpuUsage(14.8);
      setDbLatency(32);
    }
  };

  const handleManualMetricsCheck = () => {
    if (downtimeActive || latencyActive) {
      setLastNotificationStatus("Restored all simulation states back to normal.");
      setDowntimeActive(false);
      setLatencyActive(false);
      setCpuUsage(14.8);
      setDbLatency(32);
      return;
    }
    setIsRefreshing(true);
    setTimeout(() => {
      setCpuUsage(Number((Math.random() * 15 + 8).toFixed(1)));
      setDbLatency(Math.round(Math.random() * 10 + 20));
      setIsRefreshing(false);
    }, 800);
  };

  // Simulated 14 days Uptime status
  const uptimeDays = [
    { day: "14d ago", status: "operational" },
    { day: "13d ago", status: "operational" },
    { day: "12d ago", status: "operational" },
    { day: "11d ago", status: "operational" },
    { day: "10d ago", status: "operational" },
    { day: "9d ago", status: "operational" },
    { day: "8d ago", status: "operational" },
    { day: "7d ago", status: "operational" },
    { day: "6d ago", status: "operational" },
    { day: "5d ago", status: "operational" },
    { day: "4d ago", status: "operational" },
    { day: "3d ago", status: "minor_latency" },
    { day: "2d ago", status: "operational" },
    { day: "Yesterday", status: "operational" },
    { day: "Today", status: "operational" }
  ];

  return (
    <div className="space-y-6">
      {/* Slack Integration Alert & Operations Intelligence Center */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h5 className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
              <Radio size={14} className="text-indigo-600 animate-pulse" />
              Slack Alerts Control & Telemetry Center
            </h5>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
              Admin interactive sandbox supporting advanced summaries, SLA checks, Google Drive view filters, and anti-tamper telemetry rules.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {lastNotificationStatus && (
              <div className="text-[8px] font-black text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-950 font-mono tracking-tight text-right">
                SIGNAL: {lastNotificationStatus}
              </div>
            )}
            {routingState && (
              <div className="text-[8px] font-bold text-amber-600 uppercase font-mono animate-pulse">
                {routingState}
              </div>
            )}
          </div>
        </div>

        {/* Section A: Health & SLA Performance Simulators */}
        <div className="space-y-2">
          <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">A. Immediate Outage & Incident Overloads</h6>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Outage simulator card */}
            <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between space-y-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${downtimeActive ? "bg-rose-500 animate-ping" : "bg-slate-300"}`} />
                  <span className="text-[9px] font-black text-rose-600 uppercase tracking-wider">Outage Simulator</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">
                  Trigger simulated Cloud Run downtime. Sends a high-severity critical service down alert block onto <code className="px-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-rose-500 font-mono">#system-logs</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleDowntime}
                className={`w-full py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  downtimeActive
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-md"
                    : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                }`}
              >
                <ServerCrash size={12} />
                {downtimeActive ? "Mute Incident" : "Trigger Service Outage"}
              </button>
            </div>

            {/* Underperformance simulator card */}
            <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between space-y-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${latencyActive ? "bg-amber-500 animate-pulse" : "bg-slate-300"}`} />
                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Latency / Overload Tester</span>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">
                  Generates artificial database congestion. Exceeds standard 60ms SLA threshold and fires a warning notification to <code className="px-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-amber-500 font-mono">#system-logs</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleLatencySpill}
                 className={`w-full py-2 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  latencyActive
                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-200/50"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                }`}
              >
                <AlertTriangle size={12} />
                {latencyActive ? "Normalize Latency" : "Simulate DB Congestion"}
              </button>
            </div>
          </div>
        </div>

        {/* Section B: Automated Workflow Summaries (Manual Triggers) */}
        <div className="space-y-3">
          <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">B. Dispatch Scheduled Reporting Briefs</h6>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={handleTriggerMorningBriefing}
              disabled={isRefreshing}
              className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left rounded-xl flex flex-col justify-between space-y-2 cursor-pointer transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 uppercase tracking-wider font-mono">8:00 AM Daily</span>
                <Calendar size={14} className="text-indigo-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 block">Sunrise Briefing</span>
                <span className="text-[8px] text-slate-400 block mt-0.5">Outstanding actions directed to <code className="text-indigo-400">#finance-approvals</code>.</span>
              </div>
            </button>

            <button
              onClick={handleTriggerEODSnapshot}
              disabled={isRefreshing}
              className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left rounded-xl flex flex-col justify-between space-y-2 cursor-pointer transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 uppercase tracking-wider font-mono">9:00 PM Daily</span>
                <Clock size={14} className="text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 block">EOD Activity Snapshot</span>
                <span className="text-[8px] text-slate-400 block mt-0.5">Calculates DAU and settled cash volume metrics to <code className="text-amber-400">#system-logs</code>.</span>
              </div>
            </button>

            <button
              onClick={handleTriggerWeeklyLeaderboard}
              disabled={isRefreshing}
              className="p-3 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left rounded-xl flex flex-col justify-between space-y-2 cursor-pointer transition-all shadow-xs group"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 uppercase tracking-wider font-mono">Weekly Mon</span>
                <Users size={14} className="text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 block">Engagement Leaderboard</span>
                <span className="text-[8px] text-slate-400 block mt-0.5">Aggregates unique logins and voucher audits in podium style.</span>
              </div>
            </button>
          </div>
        </div>

        {/* Section C: Advanced Monitoring Coverage */}
        <div className="space-y-3">
          <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">C. Advanced Audit & Security Scanners</h6>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <button
              onClick={handleTriggerStaleRequisitions}
              className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-left rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-all font-sans"
            >
              <Workflow size={14} className="text-orange-500 mb-1" />
              <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 block leading-tight">Muted Queue SLA</span>
              <span className="text-[8px] text-slate-400 mt-1 block">Highlight stalled items &gt; 48h to <code className="text-orange-400">#workflow-alerts</code></span>
            </button>

            <button
              onClick={handleTriggerAnomalyDetection}
              className="p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 text-left rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-all font-sans"
            >
              <ShieldAlert size={14} className="text-rose-500 mb-1" />
              <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 block leading-tight">Anti-Velocity</span>
              <span className="text-[8px] text-slate-400 mt-1 block">Inspects duplicated heavy vouchers in &lt; 2 hours window</span>
            </button>

  // Removed Drive/Sheets UI
          </div>
        </div>

        {/* Live Pseudo-Slack Feed Monitor Block */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-slate-300 space-y-3">
          {realHealth && realHealth.recommendations && realHealth.recommendations.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-black uppercase tracking-widest text-[9px]">
                <AlertCircle size={14} />
                Critical System Recommendations
              </div>
              {realHealth.recommendations.map((rec: string, i: number) => (
                <div key={i} className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-200 text-[10px] leading-relaxed">
                  {rec}
                </div>
              ))}
            </div>
          )}

          {realHealth && (
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="space-y-1">
                  <div className="text-[8px] text-slate-500 uppercase font-black">MongoDB Status</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${realHealth.mongodb?.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="text-[10px] font-bold text-slate-200">{realHealth.mongodb?.status === 'ok' ? 'CONNECTED' : 'DISCONNECTED'}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[8px] text-slate-500 uppercase font-black">Active Collections</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-200">
                      {realHealth.mongodb?.counts?.requisitions || 0} REQS | {realHealth.mongodb?.counts?.church_groups || 0} GROUPS | {realHealth.mongodb?.counts?.users || 0} USERS
                    </span>
                  </div>
                </div>
              </div>

              {realHealth.mongodb?.status === 'ok' && realHealth.mongodb?.counts?.church_groups === 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-[9px] leading-relaxed">
                  <span className="font-bold block mb-1">⚠️ DATABASE IS EMPTY</span>
                  Your MongoDB collections are currently empty. Wait for the server seeder to automatically populate from `server/data/*.json` on restart.
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 flex items-center justify-center text-[7px] text-white font-bold">#</span>
              <span className="text-slate-100 font-bold uppercase tracking-wider text-[9px]">Channeled Slack Simulator Console</span>
            </div>
            <div className="flex items-center gap-1.5 text-[8px] text-slate-500 font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
              SLACK WEBHOOK ENDPOINT LISTENING
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto space-y-3.5 pr-2 custom-scrollbar">
            {slackConsoleFeed.map((item, index) => {
              const attachColor = item.payload?.attachments?.[0]?.color || "#3b82f6";
              return (
                <div key={index} className="space-y-1.5 border-l-2 pl-3 py-0.5" style={{ borderColor: attachColor }}>
                  <div className="flex items-center justify-between text-[8px] text-slate-500">
                    <span className="font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                      🎯 Routed: {item.channel}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>
                  <div>
                    <span className="font-black text-purple-400">[{item.title}] </span>
                    <span className="text-slate-200">{item.detail}</span>
                  </div>
                  {item.payload?.attachments?.[0]?.blocks && (
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 mt-1 space-y-2">
                      {item.payload.attachments[0].blocks.map((blk: any, bIdx: number) => {
                        if (blk.type === "header") {
                          return (
                            <div key={bIdx} className="font-bold text-slate-100 uppercase tracking-tight border-b border-slate-900 pb-1 text-[9px]">
                              {blk.text?.text}
                            </div>
                          );
                        }
                        if (blk.type === "section") {
                          if (blk.fields) {
                            return (
                              <div key={bIdx} className="grid grid-cols-2 gap-2 text-[8px] text-slate-400">
                                {blk.fields.map((f: any, fIdx: number) => (
                                  <div key={fIdx} dangerouslySetInnerHTML={{ __html: f.text.replace(/\*(.*?)\*/g, '<b>$1</b>').replace(/\n/g, '<br />') }} />
                                ))}
                              </div>
                            );
                          }
                          return (
                            <div key={bIdx} className="text-[8px] text-slate-300 leading-normal" dangerouslySetInnerHTML={{ __html: blk.text?.text?.replace(/\*(.*?)\*/g, '<b>$1</b>').replace(/\n/g, '<br />') }} />
                          );
                        }
                        if (blk.type === "context") {
                          return (
                            <div key={bIdx} className="text-[7px] text-slate-500 italic pt-1 border-t border-slate-900">
                              {blk.elements?.[0]?.text}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
            <Activity size={16} className="text-primary animate-pulse" />
            Infrastructure Monitors
          </h4>
          <p className="text-[10px] text-muted font-medium mt-0.5 font-mono">Real-time workspace system resources & live sync parameters</p>
        </div>
        <button 
          onClick={handleManualMetricsCheck}
          disabled={isRefreshing}
          className="p-2 bg-background hover:bg-slate-500/5 dark:hover:bg-white/5 border border-border rounded-xl transition-all cursor-pointer flex items-center justify-center text-muted hover:text-foreground"
          title="Force System Status Verification"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CPU Resource Unit */}
        <div className="bg-background border border-border/80 p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">CPU Allocation</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Cpu size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-2xl font-black text-foreground font-mono tracking-tight">
                {downtimeActive ? "0.0%" : `${cpuUsage}%`}
              </span>
              {downtimeActive ? (
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-md animate-pulse">Crashed</span>
              ) : latencyActive ? (
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md">Overloaded</span>
              ) : (
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md">Healthy</span>
              )}
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${downtimeActive ? 0 : cpuUsage}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full ${downtimeActive ? "bg-rose-500" : latencyActive ? "bg-amber-500" : "bg-primary"}`}
              />
            </div>
            <p className="text-[9px] text-muted font-mono mt-2 uppercase tracking-tighter">Current Host Core Allocation</p>
          </div>
        </div>

        {/* System Memory (RAM) Unit */}
        <div className="bg-background border border-border/80 p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Memory Footprint</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Terminal size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-2xl font-black text-foreground font-mono tracking-tight">
                {downtimeActive ? "0.00 GB" : latencyActive ? "3.12 GB" : `${memoryUsage} GB`}
              </span>
              <span className="text-[9px] text-muted font-mono">
                {downtimeActive ? "0.00 GB of 4.00 GB" : "of 4.00 GB Max"}
              </span>
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                className={`h-full ${downtimeActive ? "bg-slate-300" : latencyActive ? "bg-amber-500" : "bg-primary"}`}
                style={{ width: `${downtimeActive ? 0 : latencyActive ? 78 : (memoryUsage / 4) * 100}%` }}
              />
            </div>
            <p className="text-[9px] text-muted font-mono mt-2 uppercase tracking-tighter">Container Allocation (Host VPS)</p>
          </div>
        </div>

        {/* Database Sync Latency Unit */}
        <div className="bg-background border border-border/80 p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest">Firestore Live Sync</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Database size={16} />
            </div>
          </div>
          <div>
            <div className="flex items-end justify-between mb-1.5">
              <span className={`text-2xl font-black font-mono tracking-tight ${downtimeActive ? "text-rose-500 animate-pulse" : "text-foreground"}`}>
                {downtimeActive ? "TIMEOUT" : `${dbLatency} ms`}
              </span>
              {downtimeActive ? (
                <span className="text-[9px] font-bold text-rose-500 uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                  Offline
                </span>
              ) : latencyActive ? (
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                  Degraded
                </span>
              ) : (
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                  Live Link
                </span>
              )}
            </div>
            
            {/* Visual Indicator Progress Bar */}
            <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
              <motion.div 
                animate={{ width: `${downtimeActive ? 100 : (dbLatency / 100) * 100}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full ${downtimeActive ? "bg-rose-500" : latencyActive ? "bg-amber-500" : "bg-primary"}`}
              />
            </div>
            <p className="text-[9px] text-muted font-mono mt-2 uppercase tracking-tighter">Read/Write Transaction Latency</p>
          </div>
        </div>
      </div>

      {/* System Availability & Calendar-Style Timeline (last 15 days) */}
      <div className="bg-background border border-border/80 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 className="text-[10px] font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
              {downtimeActive ? (
                <ServerCrash size={14} className="text-rose-500 animate-bounce" />
              ) : latencyActive ? (
                <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
              ) : (
                <CheckCircle size={14} className="text-emerald-500" />
              )}
              {downtimeActive ? "Core API Status: DOWN (Outage)" : latencyActive ? "Core API Status: DEGRADED" : "Core API availability"}
            </h5>
            <p className="text-[9px] text-muted font-medium mt-0.5 font-mono">
              {downtimeActive 
                ? "CRITICAL: Container health-checks failing on production Cloud Run host" 
                : latencyActive 
                ? "WARNING: Latency thresholds breached. Sluggish response speeds warning dispatched." 
                : "Continuous automated availability pings (Uptime: 99.98%)"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[10px] font-black font-mono text-foreground uppercase">
              <Clock size={12} className="text-muted" />
              Uptime:
            </div>
            <div className={`text-[10px] font-black font-mono px-3 py-1 rounded-lg border ${
              downtimeActive 
                ? "text-rose-600 bg-rose-50/50 border-rose-200" 
                : "text-primary bg-primary/5 border-primary/20"
            }`}>
              {downtimeActive ? "FROZEN" : formatUptime(uptimeSeconds)}
            </div>
          </div>
        </div>

        {/* Visual Pill Matrix for Availability history */}
        <div className="space-y-2">
          <div className="flex items-stretch justify-between gap-1 h-8">
            {uptimeDays.map((d, index) => {
              const isToday = index === uptimeDays.length - 1;
              const cellStatus = downtimeActive && isToday 
                ? "crashed" 
                : (latencyActive && isToday ? "minor_latency" : d.status);
              
              return (
                <div 
                  key={index} 
                  className="group relative flex-1 flex flex-col justify-end pointer-events-auto"
                >
                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                    {isToday ? "Today" : d.day}: {cellStatus === "operational" ? "100% Operational" : cellStatus === "crashed" ? "0% Host Outage Triggered" : "SLA breach (latency check triggered)"}
                  </div>
                  
                  <div className={`w-full rounded-md transition-all duration-300 hover:scale-y-110 ${
                    cellStatus === "operational" 
                      ? "bg-emerald-500 h-6 group-hover:bg-emerald-400" 
                      : cellStatus === "crashed"
                      ? "bg-rose-500 h-6 group-hover:bg-rose-400"
                      : "bg-amber-400 h-6 group-hover:bg-amber-300"
                  }`} />
                </div>
              );
            })}
          </div>
          
          <div className="flex justify-between items-center text-[8px] font-black text-muted uppercase tracking-wider pt-1 border-t border-border/30 font-mono">
            <span>14 Days Ago</span>
            <span className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Operational
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" /> Latency Spike
              </span>
              {(downtimeActive || latencyActive) && (
                <span className="flex items-center gap-1 text-rose-500 animate-pulse font-black uppercase">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" /> Active Simulation
                </span>
              )}
            </span>
            <span>{downtimeActive ? "Today (Crashed)" : latencyActive ? "Today (Degraded)" : "Today (Healthy)"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
