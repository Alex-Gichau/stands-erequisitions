import { sendSlackNotification } from "./utils";

let isMonitoring = false;

export function getTimeUntilMidnightPT() {
  const now = new Date();
  
  // Midnight PT corresponds to 8:00 AM UTC (Standard Time) or 7:00 AM UTC (Daylight Saving Time).
  // Los Angeles Timezone
  const ptString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const ptDate = new Date(ptString);
  
  const nextMidnightPT = new Date(ptDate);
  nextMidnightPT.setHours(24, 0, 0, 0); // advance to tomorrow midnight

  const diffMs = nextMidnightPT.getTime() - ptDate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${diffHours} hours and ${diffMins} minutes (reset at Midnight Pacific Time)`;
}

// Throttle Slack notifications to avoid rate limiting
const recentErrors = new Set<string>();

export function initErrorMonitor() {
  if (isMonitoring) return;
  isMonitoring = true;

  const originalConsoleError = console.error;
  const originalFetch = window.fetch;

  const sendErrorAlert = (_errorMsg: string, _isFromConsole: boolean) => {
    // System Monitor Slack Notifications disabled per configuration
    return;
  };

  // Intercept window.fetch safely to capture 500/400 API errors directly
  const customFetch = async function (this: any, ...args: Parameters<typeof originalFetch>) {
    const input = args[0];
    const init = args[1];
    const url = typeof input === "string" ? input : (input instanceof Request ? input.url : String(input));
    const method = init?.method || "GET";

    try {
      const response = await originalFetch.apply(this, args);
      // Status 304 is Not Modified (Cache Hit) and not a failure
      if (!response.ok && response.status !== 304 && response.status !== 301 && response.status !== 302) {
        const cloned = response.clone();
        let errBody = "";
        try {
          errBody = await cloned.text();
        } catch {
          errBody = response.statusText;
        }

        const formattedError = `[API Failure ${response.status}] ${method.toUpperCase()} ${url} - ${errBody || response.statusText}`;

        // Avoid logging or dispatching recursion for Slack notification, health checks, or rate limits
        const isExcludedUrl = url.includes("/api/notify-slack") || 
                              url.includes("favicon") || 
                              url.includes("ws://") || 
                              url.includes("wss://") ||
                              url.includes("securetoken.googleapis.com") ||
                              url.includes("identitytoolkit.googleapis.com") ||
                              (response.status === 404 && url.includes("/api/db/notification_states"));

        if (!isExcludedUrl) {
          if (response.status === 429) {
            console.warn(`[API Rate Limit 429] ${method.toUpperCase()} ${url}: backing off.`);
          } else {
            originalConsoleError(formattedError);
            if (response.status >= 500) {
              sendErrorAlert(formattedError, true);
            }
          }
        }
      }
      return response;
    } catch (err: any) {
      const isExcludedUrl = url.includes("/api/notify-slack") || 
                            url.includes("securetoken.googleapis.com") || 
                            url.includes("identitytoolkit.googleapis.com");
      if (!isExcludedUrl) {
        console.warn(`[API Network Warning] ${method.toUpperCase()} ${url} - ${err?.message || err}`);
      }
      throw err;
    }
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true,
    });
  } catch (_err) {
    try {
      (window as any).fetch = customFetch;
    } catch (e) {
      originalConsoleError("[ErrorMonitor] Unable to patch window.fetch:", e);
    }
  }

  console.error = (...args: any[]) => {
    const errorMsg = args.map(arg => {
      if (arg instanceof Error) return arg.stack || arg.message;
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } catch { return 'Object'; }
      }
      return String(arg);
    }).join(' ');

    const lowerMsg = errorMsg.toLowerCase();
    if (
      lowerMsg.includes("database connection failed")
    ) {
      return;
    }

    if (
      lowerMsg.includes("websocket") ||
      lowerMsg.includes("[vite]") ||
      lowerMsg.includes("ws://") ||
      lowerMsg.includes("wss://")
    ) {
      // Still log to local console without reporting to monitor or alerts
      originalConsoleError(...args);
      return;
    }

    originalConsoleError(...args);

    if (errorMsg.includes('Slack notification failed') || errorMsg.includes('/api/notify-slack') || errorMsg.includes('SystemLogsPanel')) {
      return;
    }

    sendErrorAlert(errorMsg, true);
  };

  window.addEventListener("error", (event) => {
    const errorMsg = event.error ? (event.error.stack || event.error.message) : event.message;
    const msgStr = String(errorMsg);
    const lowerMsg = msgStr.toLowerCase();
    if (
      lowerMsg.includes("websocket") ||
      lowerMsg.includes("[vite]") ||
      lowerMsg.includes("ws://") ||
      lowerMsg.includes("wss://") ||
      lowerMsg.includes("closed without opened") ||
      lowerMsg.includes("database connection failed")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    sendErrorAlert(msgStr, false);
  }, { capture: true });

  window.addEventListener("unhandledrejection", (event) => {
    const errorMsg = event.reason ? (event.reason.stack || event.reason.message || String(event.reason)) : "Unhandled Promise Rejection";
    const msgStr = String(errorMsg);
    const lowerMsg = msgStr.toLowerCase();
    if (
      lowerMsg.includes("websocket") ||
      lowerMsg.includes("[vite]") ||
      lowerMsg.includes("ws://") ||
      lowerMsg.includes("wss://") ||
      lowerMsg.includes("closed without opened") ||
      lowerMsg.includes("database connection failed")
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    sendErrorAlert(msgStr, false);
  }, { capture: true });
}
