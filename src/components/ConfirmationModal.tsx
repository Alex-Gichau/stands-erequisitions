import React from "react";
import { AlertTriangle, X } from "lucide-react";
import { MobileConfirmationModal, MobileConfirmationDetailItem } from "./MobileConfirmationModal";

export { MobileConfirmationModal };
export type { MobileConfirmationDetailItem };

export interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isDestructive?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
  variant?: "default" | "mobile";
  processingText?: string;
  amount?: number | string;
  currency?: string;
  recipient?: string;
  details?: MobileConfirmationDetailItem[];
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
  children,
  variant = "default",
  processingText,
  amount,
  currency,
  recipient,
  details
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  if (variant === "mobile") {
    return (
      <MobileConfirmationModal
        isOpen={isOpen}
        onClose={onCancel}
        initialState="confirm"
        title={title}
        message={message}
        amount={amount}
        currency={currency}
        recipient={recipient}
        details={details}
        confirmText={confirmText}
        cancelText={cancelText}
        isDestructive={isDestructive}
        confirmDisabled={confirmDisabled}
        processingTitle={processingText || "Processing..."}
        processingSubtitle={message}
        successTitle="Success!"
        successSubtitle="Action completed successfully"
        buttonText="Nice one!"
        onConfirm={onConfirm}
        children={children}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slideUp">
        {/* Header Section - No background, follows dark and white theme */}
        <div className="p-6 bg-transparent">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full shrink-0 ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'}`}>
              <AlertTriangle size={24} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-sans">{message}</p>
              {children && <div className="mt-4">{children}</div>}
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-500 dark:hover:text-slate-300 transition-colors shrink-0 cursor-pointer"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        {/* Footer Section - Follows dark and white theme */}
        <div className="px-6 py-4 bg-transparent border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-xl transition-colors tracking-wide uppercase cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-6 py-2 text-sm font-black text-white rounded-xl transition-all tracking-wide uppercase shadow-md cursor-pointer ${
              confirmDisabled
                ? "bg-slate-300 dark:bg-slate-700 shadow-none cursor-not-allowed opacity-50"
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

