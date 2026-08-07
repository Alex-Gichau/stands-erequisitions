import { useEffect, useRef } from "react";

export function useIdleTimeout(
  onTimeout: () => void,
  onWarning: () => void,
  onActive: () => void,
  timeoutMs: number = 15 * 60 * 1000,
  warningMs: number = 60 * 1000
) {
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
  };

  const resetTimer = () => {
    clearTimers();

    const timeUntilWarning = Math.max(0, timeoutMs - warningMs);

    warningTimerRef.current = setTimeout(() => {
      onWarning();
      
      timeoutTimerRef.current = setTimeout(() => {
        onTimeout();
      }, warningMs);
    }, timeUntilWarning);
  };

  useEffect(() => {
    const handleActivity = () => {
      onActive();
      resetTimer();
    };

    // Set initial timer
    resetTimer();

    // Listen for common activity events
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("scroll", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    window.addEventListener("mousemove", handleActivity);

    return () => {
      clearTimers();
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      window.removeEventListener("mousemove", handleActivity);
    };
  }, [onTimeout, onWarning, onActive, timeoutMs, warningMs]);

  return { resetTimer };
}
