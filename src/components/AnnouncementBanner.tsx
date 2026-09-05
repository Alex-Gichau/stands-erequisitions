import React, { useState, useEffect } from "react";
import { AlertCircle, Info, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { motion, AnimatePresence } from "motion/react";

export const AnnouncementBanner: React.FC = () => {
  const { systemSettings } = useRequisitions();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (systemSettings?.announcementIsActive && systemSettings?.announcementMessage) {
      // Check if this specific message was dismissed
      const dismissedMessage = localStorage.getItem("dismissed_announcement");
      if (dismissedMessage !== systemSettings.announcementMessage) {
        setIsVisible(true);
      } else {
        setIsVisible(false); // keep false if active but dismissed by me
      }
    } else {
      setIsVisible(false);
    }
  }, [systemSettings?.announcementIsActive, systemSettings?.announcementMessage]);

  if (!isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    if (systemSettings?.announcementMessage) {
      localStorage.setItem("dismissed_announcement", systemSettings.announcementMessage);
    }
  };

  const getThemeStyles = () => {
    switch (systemSettings?.announcementType) {
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50";
      case "alert":
        return "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/50";
      case "success":
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50";
      case "info":
      default:
        return "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/50";
    }
  };

  const getIcon = () => {
    switch (systemSettings?.announcementType) {
      case "warning":
        return <AlertTriangle size={16} className="shrink-0" />;
      case "alert":
        return <AlertCircle size={16} className="shrink-0" />;
      case "success":
        return <CheckCircle2 size={16} className="shrink-0" />;
      case "info":
      default:
        return <Info size={16} className="shrink-0" />;
    }
  };

  const getBadgeText = () => {
    switch (systemSettings?.announcementType) {
      case "alert":
        return "MAINTENANCE ALERT";
      case "warning":
        return "SYSTEM NOTICE";
      case "success":
        return "UPDATE RESOLVED";
      case "info":
      default:
        return "ANNOUNCEMENT";
    }
  };

  const getBadgeStyles = () => {
    switch (systemSettings?.announcementType) {
      case "alert":
        return "bg-rose-600 text-white border-rose-700";
      case "warning":
        return "bg-amber-500 text-white border-amber-600";
      case "success":
        return "bg-emerald-600 text-white border-emerald-700";
      case "info":
      default:
        return "bg-blue-600 text-white border-blue-700";
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className="w-full relative z-[60]"
        >
          <div className={`border-b shadow-sm ${getThemeStyles()}`}>
            <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 flex items-center gap-2">
                  {getIcon()}
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-xs ${getBadgeStyles()}`}>
                    {getBadgeText()}
                  </span>
                </div>
                <p className="text-[12px] md:text-sm font-semibold leading-snug truncate sm:whitespace-normal">
                  {systemSettings?.announcementMessage}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                title="Dismiss banner"
                className="p-1 hover:bg-black/10 dark:hover:bg-white/15 rounded-lg transition-colors shrink-0 text-current cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
