import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, AlertCircle, ArrowRight } from "lucide-react";

export interface MobileConfirmationDetailItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export interface MobileConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Initial state: "confirm" | "processing" | "success"
   * Defaults to "confirm" if onConfirm, title, or message is provided, otherwise "processing".
   */
  initialState?: "confirm" | "processing" | "success";
  /**
   * Title during confirmation phase (defaults to "Confirm Action")
   */
  title?: string;
  /**
   * Message / subtitle during confirmation phase
   */
  message?: string;
  /**
   * Optional formatted amount or numeric value to highlight (e.g. 25000 or "25,000")
   */
  amount?: number | string;
  /**
   * Currency prefix (defaults to "KES")
   */
  currency?: string;
  /**
   * Optional recipient / target entity name
   */
  recipient?: string;
  /**
   * Key-value detail breakdown rows (e.g. Account, Category, Reference)
   */
  details?: MobileConfirmationDetailItem[];
  /**
   * Text for confirm button (defaults to "Confirm")
   */
  confirmText?: string;
  /**
   * Text for cancel button (defaults to "Cancel")
   */
  cancelText?: string;
  /**
   * Callback when confirm button is clicked. Can be synchronous or async Promise.
   * Automatically moves modal to "processing" and then "success" upon resolution.
   */
  onConfirm?: () => Promise<void> | void;
  /**
   * If true, styles the confirm button as destructive (red)
   */
  isDestructive?: boolean;
  /**
   * If true, disables the confirm button
   */
  confirmDisabled?: boolean;
  /**
   * Custom child content (e.g. safety checkboxes or custom advisories)
   */
  children?: React.ReactNode;
  /**
   * Title during processing phase (defaults to "Processing...")
   */
  processingTitle?: string;
  /**
   * Subtitle during processing phase (defaults to "Your transfer is processing")
   */
  processingSubtitle?: string;
  /**
   * Title during success phase (defaults to "Success!")
   */
  successTitle?: string;
  /**
   * Subtitle during success phase (defaults to "Your transfer was successful")
   */
  successSubtitle?: string;
  /**
   * Action button text during success phase (defaults to "Nice one!")
   */
  buttonText?: string;
  /**
   * Optional callback when "Nice one!" button is clicked. Defaults to onClose.
   */
  onSuccessButtonClick?: () => void;
  /**
   * Controlled state override: "confirm" | "processing" | "success"
   */
  state?: "confirm" | "processing" | "success";
  /**
   * If state transitions automatically from processing to success, delay in ms (default: 1800ms)
   */
  autoTransitionDelayMs?: number;
}

/**
 * Mobile Confirmation Popup matching modern mobile UI bottom-sheet confirmation screens:
 * - Top grab handle bar (iOS/Android sheet styling)
 * - Header has NO background, strictly adheres to dark and white theme
 * - Phase 1: Review & Confirm details (Amount pill, details card, Confirm & Cancel buttons)
 * - Phase 2: Animated Green Paper Airplane with motion speed lines + "Processing..."
 * - Phase 3: Animated Green Scalloped Rosette Checkmark Seal + "Success!" + "Nice one!" black pill button
 */
export const MobileConfirmationModal: React.FC<MobileConfirmationModalProps> = ({
  isOpen,
  onClose,
  initialState,
  title = "Confirm Action",
  message,
  amount,
  currency = "KES",
  recipient,
  details,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  isDestructive = false,
  confirmDisabled = false,
  children,
  processingTitle = "Processing...",
  processingSubtitle = "Your transfer is processing",
  successTitle = "Success!",
  successSubtitle = "Your transfer was successful",
  buttonText = "Nice one!",
  onSuccessButtonClick,
  state: controlledState,
  autoTransitionDelayMs = 1800
}) => {
  // Determine starting state
  const defaultInitial: "confirm" | "processing" | "success" =
    initialState || (onConfirm || message || amount ? "confirm" : "processing");

  const [internalState, setInternalState] = useState<"confirm" | "processing" | "success">(defaultInitial);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentState = controlledState || internalState;

  // Reset or initialize state whenever modal opens or initialState changes
  useEffect(() => {
    if (isOpen) {
      if (!controlledState) {
        setInternalState(defaultInitial);
      }
    }
  }, [isOpen, defaultInitial, controlledState]);

  // Handle auto-transition if starting or moving into "processing" without an async onConfirm
  useEffect(() => {
    if (isOpen && currentState === "processing" && !controlledState && !isSubmitting) {
      const timer = setTimeout(() => {
        setInternalState("success");
      }, autoTransitionDelayMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, currentState, controlledState, isSubmitting, autoTransitionDelayMs]);

  if (!isOpen) return null;

  const handleConfirmClick = async () => {
    if (confirmDisabled || isSubmitting) return;

    if (onConfirm) {
      try {
        setIsSubmitting(true);
        setInternalState("processing");
        const result = onConfirm();
        if (result && typeof (result as any).then === "function") {
          await result;
        } else {
          // Add brief natural delay for visual delight
          await new Promise((r) => setTimeout(r, autoTransitionDelayMs));
        }
        setInternalState("success");
      } catch (err) {
        console.error("MobileConfirmationModal error:", err);
        setInternalState("confirm");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setInternalState("processing");
    }
  };

  const handleSuccessAction = () => {
    if (onSuccessButtonClick) {
      onSuccessButtonClick();
    } else {
      onClose();
    }
  };

  const formattedAmount =
    amount !== undefined
      ? typeof amount === "number"
        ? amount.toLocaleString()
        : amount
      : undefined;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm transition-all"
        onClick={() => {
          // Block outside dismiss during processing to safeguard transaction state
          if (currentState !== "processing") {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[36px] sm:rounded-[36px] border-t sm:border border-slate-100 dark:border-slate-800 shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center select-none max-h-[90vh] overflow-y-auto"
        >
          {/* Header - Drag Handle with NO background, follows dark and white theme */}
          <div className="w-full bg-transparent flex flex-col items-center mb-6 relative">
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full cursor-grab" />
            {currentState !== "processing" && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-0 top-0 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Dynamic State Transition */}
          <div className="w-full min-h-[220px] flex flex-col items-center justify-center">
            {currentState === "confirm" ? (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center space-y-5 w-full"
              >
                {/* Amount Pill or Hero Indicator if provided */}
                {formattedAmount ? (
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Total Amount
                    </span>
                    <div className="px-5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-2">
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {currency}
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                        {formattedAmount}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                    isDestructive
                      ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40"
                      : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                  }`}>
                    {isDestructive ? <AlertCircle size={28} /> : <Check size={28} strokeWidth={2.5} />}
                  </div>
                )}

                {/* Title & Message */}
                <div className="space-y-1.5 px-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {title}
                  </h3>
                  {message && (
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      {message}
                    </p>
                  )}
                </div>

                {/* Details Breakdown Card if recipient or details exist */}
                {(recipient || (details && details.length > 0)) && (
                  <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
                    {recipient && (
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
                        <span className="text-slate-400 dark:text-slate-500 font-medium">To / Recipient</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{recipient}</span>
                      </div>
                    )}
                    {details?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1.5">
                          {item.icon}
                          {item.label}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom Children */}
                {children && <div className="w-full text-left">{children}</div>}

                {/* Action Buttons */}
                <div className="flex flex-col items-center gap-2.5 w-full pt-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: confirmDisabled ? 1 : 1.02 }}
                    whileTap={{ scale: confirmDisabled ? 1 : 0.98 }}
                    disabled={confirmDisabled || isSubmitting}
                    onClick={handleConfirmClick}
                    className={`w-full py-4 px-8 text-xs font-bold rounded-full shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      confirmDisabled
                        ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none"
                        : isDestructive
                          ? "bg-red-600 hover:bg-red-700 text-white shadow-red-600/25"
                          : "bg-[#18181b] hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-black/15"
                    }`}
                  >
                    <span>{confirmText}</span>
                    <ArrowRight size={14} />
                  </motion.button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {cancelText}
                  </button>
                </div>
              </motion.div>
            ) : currentState === "processing" ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center space-y-5"
              >
                {/* Paper Airplane Illustration with Motion Lines */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <motion.div
                    animate={{
                      y: [-2, 2, -2],
                      x: [-1, 2, -1],
                      rotate: [-1, 2, -1]
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 2.2,
                      ease: "easeInOut"
                    }}
                    className="relative"
                  >
                    {/* SVG Green Paper Airplane */}
                    <svg
                      width="88"
                      height="88"
                      viewBox="0 0 100 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="filter drop-shadow-sm"
                    >
                      {/* Top Wing Light Green */}
                      <path
                        d="M20 70 L90 28 L48 68 Z"
                        fill="#22c55e"
                      />
                      {/* Main Wing Emerald */}
                      <path
                        d="M20 70 L90 28 L54 84 Z"
                        fill="#16a34a"
                      />
                      {/* Fold Center Shadow */}
                      <path
                        d="M48 68 L54 84 L90 28 Z"
                        fill="#15803d"
                      />
                      {/* Keel fold bottom triangle */}
                      <path
                        d="M48 68 L52 76 L62 60 Z"
                        fill="#166534"
                        opacity="0.85"
                      />
                    </svg>

                    {/* Wind / Speed lines behind the airplane */}
                    <motion.div 
                      className="absolute -left-4 top-8"
                      animate={{ opacity: [0.3, 0.9, 0.3], x: [-3, 0, -3] }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                    >
                      <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                        <line x1="2" y1="8" x2="16" y2="8" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                        <line x1="6" y1="18" x2="24" y2="18" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
                        <line x1="10" y1="26" x2="20" y2="26" stroke="#10b981" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                      </svg>
                    </motion.div>
                  </motion.div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    {processingTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {processingSubtitle}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", damping: 16, stiffness: 260 }}
                className="flex flex-col items-center justify-center space-y-6 w-full"
              >
                {/* Green Rosette / Scalloped Seal with White Checkmark */}
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 14, stiffness: 200, delay: 0.05 }}
                  className="relative w-24 h-24 flex items-center justify-center"
                >
                  {/* Scalloped Rosette SVG */}
                  <svg
                    width="84"
                    height="84"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="filter drop-shadow-md"
                  >
                    {/* 12-lobed / Scalloped Rosette Path */}
                    <path
                      d="M50 4 
                         C56 4, 60 9, 65 11 
                         C71 13, 76 11, 80 16 
                         C85 20, 84 26, 88 32 
                         C92 37, 97 40, 97 46 
                         C97 52, 92 56, 91 62 
                         C89 68, 92 74, 88 78 
                         C84 83, 78 82, 73 86 
                         C68 90, 65 95, 59 96 
                         C53 97, 49 92, 44 92 
                         C38 92, 34 97, 28 95 
                         C23 93, 20 87, 16 84 
                         C12 80, 6 81, 4 75 
                         C2 69, 7 64, 6 58 
                         C6 52, 1 48, 2 42 
                         C3 36, 9 34, 11 28 
                         C13 22, 10 16, 15 12 
                         C20 8, 26 10, 31 7 
                         C36 4, 42 5, 50 4 Z"
                      fill="#16a34a"
                    />
                    {/* Inner Accent Ring */}
                    <path
                      d="M34 50 L45 61 L68 38"
                      stroke="#ffffff"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {successTitle}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {successSubtitle}
                  </p>
                </div>

                {/* Black Pill Button ("Nice one!") */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSuccessAction}
                  className="w-full max-w-[200px] py-3.5 px-8 bg-[#18181b] hover:bg-black text-white text-xs font-bold rounded-full shadow-lg shadow-black/15 transition-all cursor-pointer mt-2"
                >
                  {buttonText}
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

