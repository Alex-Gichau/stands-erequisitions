import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, MessageSquare, Loader2, Sparkles } from "lucide-react";

interface FeedbackModalProps {
  onClose: () => void;
  currentUser: any;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose, currentUser }) => {
  const [category, setCategory] = useState("💡 Feature Suggestion");
  const [subject, setSubject] = useState("");
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !explanation.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject,
          explanation,
          email: currentUser?.email,
          username: currentUser?.name
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2500);
      } else {
        alert("Failed to submit feedback: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" id="feedback-modal-overlay" onClick={(e) => {
      if ((e.target as HTMLElement).id === "feedback-modal-overlay") onClose();
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        id="feedback-dialog"
      >
        {/* Subtle Gradient Indicator */}
        <div className="h-2 w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500" />

        {isSuccess ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4" id="feedback-success-state">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2"
            >
              <CheckCircle2 size={32} />
            </motion.div>
            <h3 className="text-2xl font-bold text-slate-800">Thank You!</h3>
            <p className="text-slate-500 text-sm">Your feedback has been submitted successfully and shared with the team.</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">System Portal Feedback & Suggestions Desk</h2>
                  <p className="text-xs text-slate-500 font-medium">Help us improve your experience</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors shadow-sm border border-slate-200"
                id="close-feedback-modal-btn"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5" id="feedback-form">
              {/* Pre-populated User Context */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                  {currentUser?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.name || "Authenticated User"}</p>
                  <p className="text-xs text-slate-500 truncate">{currentUser?.email}</p>
                </div>
              </div>

              {/* Category Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="feedback-category">Category</label>
                <select
                  id="feedback-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all appearance-none"
                >
                  <option>🎨 User Interface Enhancement</option>
                  <option>⚡ Speed & Performance</option>
                  <option>💡 Feature Suggestion</option>
                  <option>❓ Miscellaneous Question</option>
                </select>
              </div>

              {/* Subject Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="feedback-subject">Subject</label>
                <input
                  id="feedback-subject"
                  type="text"
                  required
                  placeholder="e.g., The ledger table columns are too wide on tablet view"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Detailed Explanation Textarea */}
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="feedback-explanation">Detailed Explanation</label>
                <textarea
                  id="feedback-explanation"
                  required
                  placeholder="Please describe your suggestion, thought process, or what you were trying to do..."
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all placeholder:text-slate-400 min-h-[120px] resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !subject.trim() || !explanation.trim()}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm shadow-violet-500/20"
                  id="submit-feedback-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <MessageSquare size={16} /> Submit Feedback
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
};
