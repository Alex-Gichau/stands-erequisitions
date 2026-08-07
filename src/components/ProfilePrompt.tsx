/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  UserCircle, 
  Lock, 
  MessageSquare, 
  ChevronRight, 
  CheckCircle, 
  X,
  Smartphone,
  Briefcase,
  AlertCircle
} from "lucide-react";

interface ProfilePromptProps {
  user: UserProfile;
  onComplete: () => void;
}

export const ProfilePrompt: React.FC<ProfilePromptProps> = ({ user, onComplete }) => {
  const { updateUserProfile, addSystemLog } = useRequisitions();
  const [step, setStep] = useState<"INTRO" | "DETAILS" | "PASSWORD">("INTRO");
  const [phone, setPhone] = useState(user.phone || "");
  const [department, setDepartment] = useState(user.department || "");
  const [name, setName] = useState(user.name || "");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [preference, setPreference] = useState<"ASK" | "NEVER">("ASK");

  const handleUpdateDetails = async () => {
    setLoading(true);
    setError("");
    try {
      await updateUserProfile(user.id, { 
        phone, 
        department, 
        name,
        profilePromptPreference: preference 
      });
      setSuccess("Profile details updated successfully!");
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setLoading(true);
    setError("");
    alert("Password reset functionality is currently disabled as the Firebase backend has been removed. Please contact the administrator.");
    setLoading(false);
  };

  const handleSkip = async () => {
    if (preference === "NEVER") {
      setLoading(true);
      try {
        await updateUserProfile(user.id, { profilePromptPreference: "NEVER" });
      } catch (err) {
        console.error("Failed to save preference", err);
      } finally {
        setLoading(false);
        onComplete();
      }
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg h-full md:h-auto bg-card rounded-none md:rounded-[2.5rem] shadow-2xl overflow-y-auto relative border border-border flex flex-col justify-center"
      >
        <div className="p-8 md:p-10 space-y-8">
          <AnimatePresence mode="wait">
            {step === "INTRO" && (
              <motion.div 
                key="intro"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-4">
                    <UserCircle size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Complete Your Profile</h2>
                  <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
                    Welcome back, <span className="text-primary font-bold">{user.name}</span>! Would you like to update your security or add more personal details?
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => setStep("PASSWORD")}
                    className="flex items-center gap-4 p-5 bg-background hover:bg-background/80 rounded-3xl border border-border/50 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-card rounded-2xl flex items-center justify-center shadow-sm text-muted group-hover:text-primary transition-colors">
                      <Lock size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-foreground/80 text-[11px] uppercase tracking-widest mb-0.5">Security Hub</h3>
                      <p className="text-[10px] text-muted font-medium tracking-tight">Change or reinforce your password security.</p>
                    </div>
                    <ChevronRight size={16} className="text-muted/50" />
                  </button>

                  <button 
                    onClick={() => setStep("DETAILS")}
                    className="flex items-center gap-4 p-5 bg-background hover:bg-background/80 rounded-3xl border border-border/50 transition-all text-left group"
                  >
                    <div className="w-12 h-12 bg-card rounded-2xl flex items-center justify-center shadow-sm text-muted group-hover:text-primary transition-colors">
                      <MessageSquare size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-foreground/80 text-[11px] uppercase tracking-widest mb-0.5">Identity & Metadata</h3>
                      <p className="text-[10px] text-muted font-medium tracking-tight">Add contact details and department information.</p>
                    </div>
                    <ChevronRight size={16} className="text-muted/50" />
                  </button>
                </div>

                <div className="pt-4 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3 bg-background p-1.5 rounded-2xl border border-border/50">
                      <button 
                        onClick={() => setPreference("ASK")}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${preference === "ASK" ? "bg-card text-primary shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground"}`}
                      >
                        Ask Next Time
                      </button>
                      <button 
                        onClick={() => setPreference("NEVER")}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${preference === "NEVER" ? "bg-card text-primary shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground"}`}
                      >
                        Never Ask
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={handleSkip}
                    disabled={loading}
                    className="w-full py-4 text-muted hover:text-foreground font-black text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    Skip to Dashboard 
                    <X size={12} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === "DETAILS" && (
              <motion.div 
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-4 border-b border-border/50 pb-6">
                  <button onClick={() => setStep("INTRO")} className="p-2 hover:bg-background rounded-xl text-muted">
                    <ChevronRight size={20} className="rotate-180" />
                  </button>
                  <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Identity Details</h2>
                </div>

                {error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 text-xs font-bold">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500 text-xs font-bold">
                    <CheckCircle size={16} />
                    {success}
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Legal Full Name</label>
                    <div className="relative">
                      <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-background border border-border rounded-2xl pl-12 pr-5 py-3.5 text-xs font-bold focus:bg-card focus:border-primary transition-all outline-none"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Phone Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                      <input 
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-background border border-border rounded-2xl pl-12 pr-5 py-3.5 text-xs font-bold focus:bg-card focus:border-primary transition-all outline-none font-mono"
                        placeholder="+254 700 000 000"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Department / Office</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={16} />
                      <input 
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-background border border-border rounded-2xl pl-12 pr-5 py-3.5 text-xs font-bold focus:bg-card focus:border-primary transition-all outline-none"
                        placeholder="e.g. Finance, Missions"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <button 
                    onClick={() => setStep("INTRO")}
                    className="flex-1 py-4 bg-background text-muted rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-background/80 shadow-sm border border-border"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleUpdateDetails}
                    disabled={loading}
                    className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all hover:bg-primary/90 shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    {loading ? "Saving..." : "Save Identity Metadata"}
                    <CheckCircle size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === "PASSWORD" && (
              <motion.div 
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4 border-b border-border/50 pb-6">
                  <button onClick={() => setStep("INTRO")} className="p-2 hover:bg-background rounded-xl text-muted">
                    <ChevronRight size={20} className="rotate-180" />
                  </button>
                  <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Security Update</h2>
                </div>

                <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-3xl space-y-4">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-primary shadow-sm border border-blue-500/20">
                    <Lock size={18} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-black text-foreground text-sm uppercase tracking-tight">Dispatch Reset Link</h3>
                    <p className="text-xs text-muted leading-relaxed font-medium">
                      For security, we will send a temporary one-time password reset link to <strong className="text-primary">{user.email}</strong>.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-500 text-xs font-bold">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500 text-xs font-bold">
                    <CheckCircle size={16} />
                    {success}
                  </div>
                )}

                <div className="pt-2 space-y-4">
                  <button 
                    onClick={handlePasswordReset}
                    disabled={loading || !!success}
                    className="w-full py-5 bg-foreground text-background rounded-[1.8rem] font-black text-xs uppercase tracking-widest transition-all hover:opacity-90 shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {loading ? "Dispatching..." : success ? "Link Sent ✓" : "Authorize Password Update Loop"}
                    {loading && <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
                  </button>
                  
                  {!success && (
                    <button 
                      onClick={() => setStep("INTRO")}
                      className="w-full py-4 text-muted font-black text-[10px] uppercase tracking-widest hover:text-foreground transition-colors"
                    >
                      Maybe Later
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
