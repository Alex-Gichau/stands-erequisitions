import React from "react";
import { Loader2 } from "lucide-react";

interface PanelSkeletonFallbackProps {
  viewName?: string;
}

export const PanelSkeletonFallback: React.FC<PanelSkeletonFallbackProps> = ({ viewName }) => {
  const formattedName = viewName
    ? viewName.charAt(0).toUpperCase() + viewName.slice(1).replace(/([A-Z])/g, " $1")
    : "Module";

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 animate-pulse max-w-7xl mx-auto w-full">
      {/* Header skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-primary/10 text-primary rounded-full flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />
              Loading {formattedName}...
            </span>
          </div>
          <div className="h-3 w-72 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-9 w-32 bg-primary/20 rounded-xl" />
        </div>
      </div>

      {/* Metric Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 bg-card/60 border border-border/50 rounded-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-7 w-7 bg-slate-200 dark:bg-slate-800 rounded-lg" />
            </div>
            <div className="h-7 w-28 bg-slate-300 dark:bg-slate-700 rounded-lg" />
            <div className="h-2.5 w-36 bg-slate-100 dark:bg-slate-800/40 rounded" />
          </div>
        ))}
      </div>

      {/* Main Table / Content Area skeleton */}
      <div className="p-6 bg-card/60 border border-border/50 rounded-2xl space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="h-9 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
        </div>

        <div className="space-y-2.5 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-14 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl flex items-center px-4 justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-2.5 w-24 bg-slate-150 dark:bg-slate-800 rounded" />
                </div>
              </div>
              <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
