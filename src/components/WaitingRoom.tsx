/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Clock, ShieldAlert, LogOut, ShieldCheck, Cpu, UserX } from "lucide-react";
import { UserProfile } from "../types";
import { cn } from "../lib/utils";
import { motion } from "motion/react";

interface WaitingRoomProps {
  user: UserProfile;
  onLogout: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ user, onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient background effects */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_10%,#1e293b_0%,transparent_50%)] opacity-30" />
        <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none">
          {user.isSuspended ? (
            <UserX size={300} className="text-rose-500" />
          ) : (
            <ShieldAlert size={300} className="text-white" />
          )}
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl p-12 text-center space-y-10 relative z-10"
        >
          <div className="relative inline-block">
            <div className={cn("w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto border-2 shadow-xl", user.isSuspended ? "bg-rose-500/10 border-rose-500/20" : "bg-primary/10 border-primary/20")}>
              {user.isSuspended ? (
                <UserX size={40} className="text-rose-500 animate-pulse" />
              ) : (
                <Clock size={40} className="text-primary animate-pulse" />
              )}
            </div>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className={cn("absolute -inset-4 border border-dashed rounded-full", user.isSuspended ? "border-rose-500/20" : "border-primary/20")}
            />
          </div>

          <div className="space-y-4">
            <div className={cn("inline-block px-4 py-1.5 border rounded-full", user.isSuspended ? "bg-rose-500/10 border-rose-500/20" : "bg-primary/10 border-primary/20")}>
              <p className={cn("text-[10px] font-black uppercase tracking-[0.2em]", user.isSuspended ? "text-rose-500" : "text-primary")}>
                {user.isSuspended ? "ACCESS REVOKED" : "Waiting Room"}
              </p>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
              {user.isSuspended ? "Account Administratively Suspended" : "Awaiting Administrative\nAccount Activation"}
            </h1>
            <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
              {user.isSuspended ? (
                <>Welcome, <span className="text-white font-bold">{user.name}</span>. Your account has been suspended by system administrators. You cannot access the system yet at this time.</>
              ) : (
                <>Welcome, <span className="text-white font-bold">{user.name}</span>. Your account has been registered, but requires authorization by the Finance admin access is granted. Please wait.</>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6 border-y border-slate-800">
             <div className="flex items-center gap-4 text-left p-4 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-slate-700 transition-all">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 transition-colors">
                  <ShieldCheck size={20} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">System Security</p>
                   <p className="text-[11px] font-black text-white uppercase mt-0.5">Your account is secured.</p>
                </div>
             </div>
             <div className="flex items-center gap-4 text-left p-4 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-slate-700 transition-all">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 transition-colors">
                  <Cpu size={20} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Current Access</p>
                   <p className="text-[11px] font-black text-white uppercase mt-0.5">{user.isSuspended ? "Suspended" : "Waiting on Admin"}</p>
                </div>
             </div>
          </div>

          <div className="space-y-6">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest italic">
              {user.isSuspended ? "Contact administration for appeal." : "Administrators have been notified of your request."}
            </p>
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-3 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 border border-slate-700"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </motion.div>
      </div>
  );
};
