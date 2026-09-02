/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Desktop Browser Notifications Service
 * Provides permission request, capability detection, audio chimes,
 * and system-level desktop notification dispatch for requisitions, approvals, and alerts.
 */

export type DesktopNotificationPermission = "default" | "granted" | "denied" | "unsupported";

const NOTIFICATION_SOUND_ENABLED_KEY = "desktop_notification_sound_enabled";
const NOTIFICATION_PREF_KEY = "desktop_notification_enabled";

/**
 * Check if the browser environment supports HTML5 Web Notifications API
 */
export function isDesktopNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Get current desktop notification permission status
 */
export function getDesktopNotificationPermission(): DesktopNotificationPermission {
  if (!isDesktopNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission as DesktopNotificationPermission;
}

/**
 * Request desktop notification permission from user
 */
export async function requestDesktopNotificationPermission(): Promise<DesktopNotificationPermission> {
  if (!isDesktopNotificationSupported()) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      localStorage.setItem(NOTIFICATION_PREF_KEY, "true");
    }
    return permission as DesktopNotificationPermission;
  } catch (error) {
    console.warn("[DesktopNotifications] Error requesting notification permission:", error);
    return getDesktopNotificationPermission();
  }
}

/**
 * Check if user has explicitly enabled desktop notifications in system preferences
 */
export function isDesktopNotificationEnabled(): boolean {
  if (!isDesktopNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const pref = localStorage.getItem(NOTIFICATION_PREF_KEY);
  // Default to true if permission is already granted unless explicitly disabled
  return pref !== "false";
}

/**
 * Toggle desktop notification preference
 */
export function setDesktopNotificationEnabled(enabled: boolean): void {
  localStorage.setItem(NOTIFICATION_PREF_KEY, enabled ? "true" : "false");
}

/**
 * Play a subtle, non-intrusive sound tone using Web Audio API
 */
export function playNotificationTone(type: "subtle" | "alert" | "success" = "subtle"): void {
  try {
    if (typeof window === "undefined") return;
    const soundPref = localStorage.getItem(NOTIFICATION_SOUND_ENABLED_KEY);
    if (soundPref === "false") return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "alert") {
      // Two-tone warning chime: 520Hz -> 660Hz
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(660, now + 0.1);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "success") {
      // Pleasant upward chord: 440Hz -> 554Hz -> 659Hz
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.08);
      osc.frequency.setValueAtTime(659, now + 0.16);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Subtle soft tap chime (880Hz)
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 1000);
  } catch {
    // Gracefully ignore audio synthesis errors
  }
}

export interface DesktopNotificationOptions {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: any;
  silent?: boolean;
  playSound?: boolean;
  soundType?: "subtle" | "alert" | "success";
  onClick?: () => void;
}

/**
 * Dispatch a native desktop notification to the operating system
 */
export function sendDesktopNotification(options: DesktopNotificationOptions): Notification | null {
  if (!isDesktopNotificationSupported()) {
    return null;
  }

  if (Notification.permission !== "granted") {
    return null;
  }

  if (!isDesktopNotificationEnabled()) {
    return null;
  }

  try {
    const iconUrl = options.icon || "/pcea.svg";
    const notification = new Notification(options.title, {
      body: options.body,
      icon: iconUrl,
      badge: options.badge || iconUrl,
      tag: options.tag || `stands-notif-${Date.now()}`,
      silent: options.silent ?? false,
      data: options.data,
    });

    if (options.playSound) {
      playNotificationTone(options.soundType || "subtle");
    }

    notification.onclick = function (event) {
      event.preventDefault();
      try {
        window.focus();
      } catch {
        // ignore
      }
      if (options.onClick) {
        options.onClick();
      }
      notification.close();
    };

    // Auto-dismiss desktop notification after 7 seconds
    setTimeout(() => {
      try {
        notification.close();
      } catch {
        // ignore
      }
    }, 7000);

    return notification;
  } catch (error) {
    console.warn("[DesktopNotifications] Failed to display desktop notification:", error);
    return null;
  }
}
