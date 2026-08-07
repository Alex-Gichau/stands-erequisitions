/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  ShieldCheck, 
  Eye, 
  Zap, 
  Save, 
  ChevronRight, 
  Lock,
  Check,
  AlertCircle
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { UserRole, PermissionConfig } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

export const AccessControlPanel: React.FC = () => {
  const { permissionConfigs, updateRolePermissions, currentUser, systemSettings, updateSystemSettings } = useRequisitions();
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CHURCH_GROUP);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const roles = [
    UserRole.CHURCH_GROUP,
    UserRole.APPROVER_L1,
    UserRole.APPROVER_L2,
    UserRole.FINANCE,
    UserRole.ADMIN,
  ];

  const currentConfig = permissionConfigs.find(c => c.role === selectedRole) || {
    role: selectedRole,
    access: {
      dashboard: true,
      requisitions: selectedRole === UserRole.CHURCH_GROUP || selectedRole === UserRole.ADMIN || selectedRole === UserRole.APPROVER_L1 || selectedRole === UserRole.APPROVER_L2 || selectedRole === UserRole.FINANCE,
      approvals: [UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.ADMIN].includes(selectedRole),
      finance: selectedRole === UserRole.FINANCE || selectedRole === UserRole.ADMIN || selectedRole === UserRole.APPROVER_L1 || selectedRole === UserRole.APPROVER_L2 || selectedRole === UserRole.CHURCH_GROUP,
      reports: selectedRole === UserRole.FINANCE || selectedRole === UserRole.ADMIN,
      users: selectedRole === UserRole.ADMIN,
      settings: selectedRole === UserRole.ADMIN || selectedRole === UserRole.FINANCE,
      accessControl: false,
      notifications: true,
      auditTrail: [UserRole.ADMIN, UserRole.FINANCE].includes(selectedRole)
    },
    actions: {
      canCreateRequisition: selectedRole === UserRole.CHURCH_GROUP || selectedRole === UserRole.ADMIN,
      canApproveL1: selectedRole === UserRole.APPROVER_L1 || selectedRole === UserRole.ADMIN,
      canApproveL2: selectedRole === UserRole.APPROVER_L2 || selectedRole === UserRole.ADMIN,
      canDisburse: selectedRole === UserRole.FINANCE || selectedRole === UserRole.ADMIN,
      canDeleteRequisition: selectedRole === UserRole.ADMIN,
      canManageUsers: selectedRole === UserRole.ADMIN,
      canManageSettings: selectedRole === UserRole.ADMIN || selectedRole === UserRole.FINANCE,
    }
  };

  const handleToggleAccess = (viewId: string) => {
    const newConfig = {
      ...currentConfig,
      access: {
        ...currentConfig.access,
        [viewId]: !(currentConfig.access as any)[viewId]
      }
    };
    // Optimization: find and replace in local state if we want instant UI, 
    // but here we just wait for DB sync or pass to update function
  };

  const handleToggleAction = (actionId: string) => {
    const newConfig = {
      ...currentConfig,
      actions: {
        ...currentConfig.actions,
        [actionId]: !(currentConfig.actions as any)[actionId]
      }
    };
  };

  const saveConfig = (config: any) => {
    setIsSaving(true);
    updateRolePermissions(selectedRole, config)
      .then(() => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      })
      .catch((err) => {
        console.error("Failed to save role permissions:", err);
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const viewPermissions = [
    { id: "dashboard", label: "Dashboard Hub", description: "Main entry point and overview" },
    { id: "requisitions", label: "Requisitions Tracker", description: "Submit and follow requisition status" },
    { id: "approvals", label: "Authorization Hub", description: "Decision making for pending requests" },
    { id: "finance", label: "Budgets & Ledger", description: "Financial management and disbursement" },
    { id: "reports", label: "Impact Reports", description: "Analytics and historical snapshots" },
    { id: "users", label: "User Management", description: "Control authentication and role assignments" },
    { id: "settings", label: "System Triggers", description: "Security trace and system configuration" },
    { id: "auditTrail", label: "Dashboard Audit Trail", description: "Visibility of the live activity feed on user dashboards" },
  ];

  const actionPermissions = [
    { id: "canCreateRequisition", label: "Initiate Requisitions", description: "Permission to draft and submit new requests" },
    { id: "canApproveL1", label: "Level 1 Approval Authority", description: "Permission to grant first-tier authorization" },
    { id: "canApproveL2", label: "Level 2 Approval Authority", description: "Permission to grant final-tier authorization" },
    { id: "canDisburse", label: "Disbursement Authority", description: "Permission to process final payouts" },
    { id: "canDeleteRequisition", label: "Ledger Modification", description: "Permission to delete draft or error entries" },
    { id: "canManageUsers", label: "Identity Control", description: "Permission to invite and suspend users" },
    { id: "canManageSettings", label: "System Hardening", description: "Permission to modify audit policies" },
  ];

  return (
    <div className="p-4 md:p-8 bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="-mx-4 px-4 md:-mx-8 md:px-8 py-4 transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <ShieldCheck size={120} className="text-primary" />
            </div>
            
            <div className="space-y-2 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Sudo Control Core</h1>
                  <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Global Access Configuration</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 max-w-md font-medium leading-relaxed">
                Define recursive access rights and operational boundaries for all system roles. Changes propagate across the ecosystem in real-time.
              </p>
            </div>

            {currentUser?.role !== UserRole.SUPER_ADMIN && (
               <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                  <Lock className="text-amber-500" size={18} />
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Restricted Access: Super Admin Only</span>
               </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Role Selection Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 self-start space-y-3">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2 mb-4">Select Target Role</h2>
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-2xl transition-all border group",
                    selectedRole === role 
                      ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200" 
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="text-[11px] font-black uppercase tracking-widest">{role.replace("_", " ")}</span>
                    <span className={cn(
                      "text-[8px] font-bold uppercase tracking-tighter mt-1",
                      selectedRole === role ? "text-primary" : "text-slate-400"
                    )}>Access Boundaries</span>
                  </div>
                  <ChevronRight size={14} className={cn(
                    "transition-transform",
                    selectedRole === role ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                  )} />
                </button>
              ))}

              <div className="mt-8 p-6 bg-primary/5 border border-primary/10 rounded-[2rem] space-y-4">
                 <div className="flex items-center gap-2 text-primary">
                    <Zap size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Real-time Sync</span>
                 </div>
                 <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Modification of these parameters will immediately affect all active sessions for the target role group.
                 </p>
              </div>
            </div>
          </div>

          {/* Permissions Grid */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* View Access */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye size={18} className="text-slate-400" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Structural Visibility</h3>
                    <p className="text-[10px] text-slate-500 font-medium font-mono uppercase">Control view-level navigation access</p>
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-slate-50">
                {viewPermissions.map((view) => {
                  const isEnabled = (currentConfig.access as any)[view.id];
                  return (
                    <div key={view.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{view.label}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{view.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = {
                            ...currentConfig,
                            access: {
                              ...currentConfig.access,
                              [view.id]: !isEnabled
                            }
                          };
                          saveConfig(updated);
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500/40 shrink-0",
                          isEnabled ? "bg-emerald-500" : "bg-slate-300"
                        )}
                        aria-label={`Toggle ${view.label}`}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm",
                          isEnabled ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>
                  );
                })}

                {currentUser?.role === UserRole.SUPER_ADMIN && (
                  <>
                    {/* Header line for Global controls */}
                    <div className="bg-slate-50/70 px-6 py-4 border-t border-b border-slate-100 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-primary animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Global Structural Visibility Settings</span>
                      <span className="text-[8px] font-bold uppercase py-0.5 px-1.5 bg-primary/10 text-primary rounded-md ml-auto">Super-Admin Configuration</span>
                    </div>

                    {/* Toggle: Hide Supplementary Budget Button */}
                    <div className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Hide Supplementary Budget Button</p>
                        <p className="text-[10px] text-slate-500 font-medium">Hide the supplementary budget request button across all user dashboards</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateSystemSettings({ 
                            hideSupplementaryBudgetBtn: !systemSettings.hideSupplementaryBudgetBtn 
                          });
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500/40 shrink-0",
                          systemSettings.hideSupplementaryBudgetBtn ? "bg-emerald-500" : "bg-slate-300"
                        )}
                        aria-label="Toggle Hide Supplementary Budget Button"
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm",
                          systemSettings.hideSupplementaryBudgetBtn ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>

                    {/* Selector: Vendor List View Level */}
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Vendor Directory Access Level</p>
                        <p className="text-[10px] text-slate-500 font-medium">Specify who has visibility and access to the STANDS directory on the navigation bar</p>
                      </div>
                      <div className="relative shrink-0">
                        <select 
                          value={systemSettings.vendorListViewLevel || "ALL_USERS"}
                          onChange={(e) => {
                            updateSystemSettings({ vendorListViewLevel: e.target.value as any });
                          }}
                          className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-800 pl-4 pr-10 py-2.5 rounded-xl appearance-none focus:outline-none cursor-pointer focus:ring-2 focus:ring-primary/40 block min-w-[200px]"
                        >
                          <option value="ALL_USERS">🌍 Everyone (All Users)</option>
                          <option value="APPROVERS_UP">🛡️ Approvers & Higher</option>
                          <option value="FINANCE_UP">💼 Finance & Higher</option>
                          <option value="ADMINS_ONLY">🔐 Admins & Super Admin</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-550">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Setting: Requisition Expiry Period */}
                    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors border-t border-slate-100/50">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Requisition Expiry Period</p>
                        <p className="text-[10px] text-slate-500 font-medium">Set the number of days after which submitted requisitions automatically expire (currently set at {systemSettings?.requisitionExpiryDays ?? 7} days)</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={() => {
                              const current = systemSettings?.requisitionExpiryDays ?? 7;
                              if (current > 1) {
                                updateSystemSettings({ requisitionExpiryDays: current - 1 });
                              }
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-black transition-colors cursor-pointer"
                            title="Reduce expiry by 1 day"
                          >
                            -
                          </button>
                          <span className="text-xs font-black font-mono text-slate-800 w-16 text-center">
                            {systemSettings?.requisitionExpiryDays ?? 7} DAYS
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const current = systemSettings?.requisitionExpiryDays ?? 7;
                              updateSystemSettings({ requisitionExpiryDays: current + 1 });
                            }}
                            className="w-8 h-8 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-black transition-colors cursor-pointer"
                            title="Increase expiry by 1 day"
                          >
                            +
                          </button>
                        </div>

                        <input
                          type="number"
                          min="1"
                          placeholder="7"
                          className="w-20 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold focus:border-primary/50 outline-none text-center"
                          value={systemSettings?.requisitionExpiryDays ?? 7}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) {
                              updateSystemSettings({ requisitionExpiryDays: val });
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Section: Sudo Emergency System Shutdown */}
                    {systemSettings?.isSystemOffline ? (
                      <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-emerald-50/20 transition-colors border-t border-emerald-100 bg-emerald-50/10">
                        <div className="space-y-1">
                          <p className="text-[11px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            Emergency Bypass - System Offline
                          </p>
                          <p className="text-[10px] text-emerald-700/85 font-medium">The system is currently OFFLINE to standard users. You are browsing the environment using an administrator's bypass.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("🚨 Are you sure you want to RESTORE system access? This will bring the portal back online for all logged-in and new sessions immediately.")) {
                              updateSystemSettings({ isSystemOffline: false });
                            }
                          }}
                          className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 shrink-0 cursor-pointer"
                        >
                          <ShieldCheck size={12} />
                          Restore System Access
                        </button>
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-rose-50/20 transition-colors border-t border-rose-100 bg-rose-50/10">
                        <div className="space-y-1">
                          <p className="text-[11px] font-black text-rose-800 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                            Emergency System Shutdown
                          </p>
                          <p className="text-[10px] text-rose-600/80 font-medium">Instantly take the entire system offline. This renders the application unreachable with an offline screen for all users.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("🚨 WARNING: Are you sure you want to SHUT DOWN the system? This will immediately take the system offline for all active sessions.")) {
                              updateSystemSettings({ isSystemOffline: true });
                            }
                          }}
                          className="py-2.5 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-600/10 shrink-0 cursor-pointer"
                        >
                          <Lock size={12} />
                          Shutdown System
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action Matrix */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap size={18} className="text-slate-400" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Operational Powers</h3>
                    <p className="text-[10px] text-slate-500 font-medium font-mono uppercase">Discrete execution rights per role</p>
                  </div>
                </div>
              </div>
              
              <div className="divide-y divide-slate-50">
                {actionPermissions.map((action) => {
                  const isEnabled = (currentConfig.actions as any)[action.id];
                  return (
                    <div key={action.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{action.label}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{action.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = {
                            ...currentConfig,
                            actions: {
                              ...currentConfig.actions,
                              [action.id]: !isEnabled
                            }
                          };
                          saveConfig(updated);
                        }}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500/40 shrink-0",
                          isEnabled ? "bg-primary" : "bg-slate-300"
                        )}
                        aria-label={`Toggle ${action.label}`}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm",
                          isEnabled ? "left-7" : "left-1"
                        )} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Final Save Status Feedback */}
            <AnimatePresence>
              {isSaving && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-slate-900 text-white px-6 py-4 rounded-2xl flex items-center justify-between shadow-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Synchronizing Core Parameters...</span>
                  </div>
                </motion.div>
              )}
              {saveSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-emerald-500 text-white px-6 py-4 rounded-2xl flex items-center justify-between shadow-2xl shadow-emerald-500/20"
                >
                  <div className="flex items-center gap-3">
                    <Check size={18} strokeWidth={3} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ecosystem Updated Successfully</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>
    </div>
  );
};
