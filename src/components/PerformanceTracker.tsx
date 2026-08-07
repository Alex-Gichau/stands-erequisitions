import React, { useEffect, useRef, Profiler } from 'react';
import { useRequisitions } from '../contexts/RequisitionContext';

interface PerformanceTrackerProps {
  currentView: string;
  isSyncingData: boolean;
  children: React.ReactNode;
}

export const PerformanceTracker: React.FC<PerformanceTrackerProps> = ({ 
  currentView, 
  isSyncingData, 
  children 
}) => {
  const { addSystemLog } = useRequisitions();
  const memoryAtStartRef = useRef<number | null>(null);
  
  // Track timestamps of dispatches to prevent infinite sync / render alerting storm loops
  const lastAlertTimesRef = useRef<{ [key: string]: number }>({});

  // Monitor Memory Usage during Sync with robust throttling
  useEffect(() => {
    if (isSyncingData && (performance as any).memory) {
      memoryAtStartRef.current = (performance as any).memory.usedJSHeapSize;
    } else if (!isSyncingData && memoryAtStartRef.current !== null && (performance as any).memory) {
      const memoryAtEnd = (performance as any).memory.usedJSHeapSize;
      const diffMB = (memoryAtEnd - memoryAtStartRef.current) / (1024 * 1024);
      
      // Threshold: 20MB memory increase during a single sync cycle
      if (diffMB > 20) {
         const now = Date.now();
         const lastAlert = lastAlertTimesRef.current["memory"] || 0;
         
         if (now - lastAlert >= 60000) { // 1 minute throttle
           lastAlertTimesRef.current["memory"] = now;
           addSystemLog(
             "SYNC_MEMORY_ALERT", 
             `High memory usage detected during data sync in ${currentView.toUpperCase()}. Increase: ${diffMB.toFixed(2)} MB.`, 
             { 
               view: currentView, 
               increaseMB: diffMB.toFixed(2) 
             }
           ).catch(console.error);
         } else {
           console.warn(`[Performance Tracker] Throttled SYNC_MEMORY_ALERT. Increase of ${diffMB.toFixed(2)} MB in ${currentView.toUpperCase()}.`);
         }
      }
      memoryAtStartRef.current = null;
    }
  }, [isSyncingData, currentView, addSystemLog]);

  // Monitor Component Render Time during Sync with robust throttling
  const onRenderCallback = (
    id: string,
    phase: "mount" | "update",
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    if (!isSyncingData) return;
    
    // Threshold: 150ms render time during sync
    if (actualDuration > 150) {
      const now = Date.now();
      const lastAlert = lastAlertTimesRef.current[`render:${id}`] || 0;
      
      if (now - lastAlert >= 60000) { // 1 minute throttle per component id
        lastAlertTimesRef.current[`render:${id}`] = now;
        addSystemLog(
          "SYNC_RENDER_ALERT", 
          `Slow component render detected during data sync in ${id}. Duration: ${actualDuration.toFixed(2)}ms.`, 
          {
            componentId: id,
            phase,
            actualDurationMs: actualDuration.toFixed(2),
          }
        ).catch(console.error);
      } else {
        console.warn(`[Performance Tracker] Throttled SYNC_RENDER_ALERT for ${id}. Duration: ${actualDuration.toFixed(2)}ms.`);
      }
    }
  };

  return (
    <Profiler id={`View-${currentView}`} onRender={onRenderCallback}>
      {children}
    </Profiler>
  );
};
