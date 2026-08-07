import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = false,
  confirmDisabled = false,
  children
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slideUp">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-slate-500 leading-relaxed font-sans">{message}</p>
              {children && <div className="mt-4">{children}</div>}
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-500 transition-colors shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors tracking-wide uppercase"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-6 py-2 text-sm font-black text-white rounded-xl transition-all tracking-wide uppercase shadow-md ${
              confirmDisabled
                ? "bg-slate-300 shadow-none cursor-not-allowed opacity-50"
                : isDestructive
                  ? "bg-red-600 hover:opacity-90 shadow-red-600/20"
                  : "bg-indigo-600 hover:opacity-90 shadow-indigo-600/20"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
