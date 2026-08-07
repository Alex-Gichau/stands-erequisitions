import React, { useState, useEffect } from "react";
import { X, Mail, Send, CheckCircle, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ContactFinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    name: string;
    email: string;
  };
}

export function ContactFinanceModal({ isOpen, onClose, currentUser }: ContactFinanceModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [mailtoUrl, setMailtoUrl] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSubject("");
      setBody("");
      setError("");
      setSuccess(false);
      setMailtoUrl("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setError("Please write an email subject.");
      return;
    }
    if (!body.trim()) {
      setError("Please write the email body / message details.");
      return;
    }

    setError("");
    const targetEmail = "finance@pceastandrews.org";
    const generatedUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(body.trim())}`;
    
    setMailtoUrl(generatedUrl);
    setSuccess(true);

    // Trigger the redirect
    window.location.href = generatedUrl;
  };

  return (
    <div id="contact-finance-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 flex flex-col relative"
      >
        {/* Top visual decoration bar in emerald green for finance */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Mail size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">Contact Finance Office</h3>
              <p className="text-[10px] text-slate-400 font-bold tracking-wider uppercase mt-0.5">Direct communication desk for accounting & disbursements</p>
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
                className="py-10 flex flex-col items-center text-center space-y-5"
              >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center shadow-inner">
                  <CheckCircle size={36} strokeWidth={2} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase">Opening Email Client</h4>
                  <p className="mt-2 text-sm text-slate-500 max-w-md leading-relaxed font-medium">
                    We have initiated a redirection to your system's default mail client pre-filled with your message.
                  </p>
                  <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                    If your email application did not launch automatically, click the button below to open it manually.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs justify-center pt-2">
                  <a
                    href={mailtoUrl}
                    className="flex-1 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <ExternalLink size={14} />
                    Open Manually
                  </a>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
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
                    <X size={16} className="shrink-0 mt-0.5 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submitter read-only banner */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-600">
                  <div className="space-y-0.5">
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">Sender Identity</p>
                    <p className="text-slate-800">{currentUser.name} ({currentUser.email})</p>
                  </div>
                  <div className="text-right space-y-0.5">
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest">Recipient</p>
                    <p className="text-emerald-700 font-extrabold uppercase">Finance Office</p>
                  </div>
                </div>

                {/* Email Subject Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Query regarding requisition voucher #REQ-105"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                {/* Message Body Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Message Body (Email Details)
                  </label>
                  <textarea
                    required
                    rows={6}
                    placeholder="Write your email body here. Provide context like requisition IDs, amounts, and specific questions for the finance office."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 focus:outline-none transition-all placeholder:text-slate-400 font-sans leading-relaxed resize-none"
                  />
                </div>

                {/* Info Note */}
                <p className="text-[10px] text-slate-400 leading-normal font-bold uppercase tracking-wider">
                  💡 Note: Sending will launch your local device mail client pre-addressed to <span className="text-emerald-600 font-extrabold font-mono text-xs">finance@pceastandrews.org</span>.
                </p>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2 text-center"
                  >
                    <Send size={12} />
                    Open Mail App
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
