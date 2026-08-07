import React, { useState } from "react";
import { X, Bug, CheckCircle, AlertOctagon, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    name: string;
    email: string;
  };
}

export function BugReportModal({ isOpen, onClose, currentUser }: BugReportModalProps) {
  const [category, setCategory] = useState("Bug");
  const [severity, setSeverity] = useState("Medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Please fill out both the summary title and details description.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          description: description.trim(),
          severity,
          email: currentUser.email,
          username: currentUser.name
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess(true);
        setTitle("");
        setDescription("");
        setCategory("Bug");
        setSeverity("Medium");
      } else {
        setError(data.error || "Failed to submit report. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseSuccess = () => {
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 flex flex-col relative"
      >
        {/* Colorful visual indicator bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <Bug size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">System Portal Incident & Feedback Desk</h3>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">Submit bugs or suggest structural optimizations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form or Success State */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="py-12 flex flex-col items-center text-center space-y-4"
              >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-inner">
                  <CheckCircle size={36} strokeWidth={2} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase">Report Shared Successfully</h4>
                  <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed font-medium">
                    Thank you! Your feedback has been stored and a system incident notification has been dispatched to the ICT team channel (<span className="text-indigo-600 font-semibold">#system-logs</span>).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseSuccess}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
                >
                  Return to Portal
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="space-y-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {error && (
                  <div className="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-2xl border border-rose-100 flex items-start gap-3">
                    <AlertOctagon size={16} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submitter read-only banner */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-600">
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">SUBMITTER IDENTITY</p>
                    <p className="text-slate-800">{currentUser.name}</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">AUTHENTICATED EMAIL</p>
                    <p className="text-slate-800 font-mono">{currentUser.email}</p>
                  </div>
                </div>

                {/* Selection Fields (Category & Severity) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest">
                      Issue Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary/50 font-semibold"
                    >
                      <option value="Bug">🪲 System Bug / Error</option>
                      <option value="UI/UX Improvement">🎨 Interface / Design Feedback</option>
                      <option value="Performance Issue">⚡ Performance & Sluggishness</option>
                      <option value="Feature Suggestion">💡 Feature Request</option>
                      <option value="Other">❓ Miscellaneous Feedback</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest">
                      Severity Level
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary/50 font-semibold"
                    >
                      <option value="Low">🔵 Low (Minor inconvenience)</option>
                      <option value="Medium">🟡 Medium (Workaround exists)</option>
                      <option value="High">🟠 High (Core flow is disrupted)</option>
                      <option value="Critical">🔴 Critical (Blocking / Crash)</option>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest">
                    Summary Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Unable to upload PNG attachments in ledger modal"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary/50 font-semibold placeholder:text-slate-400"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-widest">
                    Detailed Explanation
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide exact replication steps, expected behavior versus what actually happened, and any helpful context."
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-primary/50 font-sans font-medium placeholder:text-slate-400 min-h-[100px] max-h-[250px]"
                  />
                </div>

                {/* Action buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors tracking-wide uppercase cursor-pointer"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-primary hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                  >
                    {isSubmitting ? "Dispatching..." : "Transmit Incident"}
                    <Send size={12} />
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
