import React, { useState, useEffect } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { 
  CloudUpload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Trash2, 
  FileText 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const BackgroundUploadWidget: React.FC = () => {
  const { activeUploadTasks, cancelBackgroundUploadTask, clearCompletedUploadTasks } = useRequisitions();
  const [isMinimized, setIsMinimized] = useState(false);

  // Auto-dismiss completed upload tasks 2.5s after finishing
  useEffect(() => {
    const completedTasks = activeUploadTasks.filter(t => t.status === "COMPLETED");
    if (completedTasks.length > 0) {
      const timer = setTimeout(() => {
        clearCompletedUploadTasks();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeUploadTasks, clearCompletedUploadTasks]);

  if (!activeUploadTasks || activeUploadTasks.length === 0) {
    return null;
  }

  const activeCount = activeUploadTasks.filter(t => t.status === "UPLOADING" || t.status === "QUEUED").length;
  const completedCount = activeUploadTasks.filter(t => t.status === "COMPLETED").length;
  const failedCount = activeUploadTasks.filter(t => t.status === "FAILED").length;

  // Compute average overall progress
  const totalProgressSum = activeUploadTasks.reduce((acc, t) => acc + t.progressPercent, 0);
  const overallProgress = Math.round(totalProgressSum / activeUploadTasks.length);

  return (
    <div className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full sm:w-96 select-none font-sans animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xl shadow-slate-900/10 dark:shadow-black/50 overflow-hidden">
        
        {/* Widget Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-lg flex items-center justify-center shrink-0 ${
              activeCount > 0 
                ? "bg-sky-500/20 text-sky-400 animate-pulse" 
                : failedCount > 0 
                  ? "bg-rose-500/20 text-rose-400" 
                  : "bg-emerald-500/20 text-emerald-400"
            }`}>
              {activeCount > 0 ? (
                <CloudUpload size={18} className="animate-bounce" />
              ) : failedCount > 0 ? (
                <AlertCircle size={18} />
              ) : (
                <CheckCircle2 size={18} />
              )}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-100 truncate flex items-center gap-1.5">
                <span>Background File Uploads</span>
                {activeCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-sky-500/30 text-sky-300 text-[9px] rounded-full font-mono font-bold">
                    {activeCount} active
                  </span>
                )}
              </h4>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                {activeCount > 0 
                  ? `Transferring files in background (${overallProgress}%)` 
                  : `${completedCount} completed, ${failedCount} failed`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {completedCount > 0 && (
              <button
                onClick={clearCompletedUploadTasks}
                title="Clear completed uploads"
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              title={isMinimized ? "Expand widget" : "Minimize widget"}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              onClick={clearCompletedUploadTasks}
              title="Dismiss toast message"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-0.5"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Global Progress Bar in Minimized state */}
        {isMinimized && (
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${
                activeCount > 0 ? "bg-sky-500" : failedCount > 0 ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        )}

        {/* Task List (when expanded) */}
        <AnimatePresence>
          {!isMinimized && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="max-h-72 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-100 dark:divide-slate-800/60"
            >
              {activeUploadTasks.map((task) => {
                const isUploading = task.status === "UPLOADING" || task.status === "QUEUED";
                const isDone = task.status === "COMPLETED";
                const isFail = task.status === "FAILED";

                return (
                  <div key={task.id} className="pt-2.5 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1 rounded-md shrink-0 ${
                          isUploading 
                            ? "bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400" 
                            : isFail 
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" 
                              : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                        }`}>
                          {isUploading ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isFail ? (
                            <AlertCircle size={12} />
                          ) : (
                            <FileText size={12} />
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={task.title}>
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          isUploading 
                            ? "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 border-sky-200 dark:border-sky-900/50" 
                            : isFail 
                              ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-900/50" 
                              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                        }`}>
                          {isUploading ? `${task.progressPercent}%` : isFail ? "Failed" : "Done"}
                        </span>
                        <button
                          onClick={() => cancelBackgroundUploadTask(task.id)}
                          title="Dismiss task"
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          isUploading ? "bg-sky-500" : isFail ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${task.progressPercent}%` }}
                      />
                    </div>

                    {/* Status & Active File detail */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <span className="truncate max-w-[220px] font-mono text-[9px]">
                        {isUploading ? `File: ${task.currentFileName}` : isFail ? task.error || "Upload error" : "All files saved to cloud"}
                      </span>
                      <span className="font-mono text-[9px]">
                        {task.completedFiles} / {task.totalFiles} files
                      </span>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
