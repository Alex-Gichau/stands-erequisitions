/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext } from "react";
import { BudgetAlert } from "../types";

export interface NotificationContextType {
  alerts: BudgetAlert[];
  unreadCount: number;
  readNoticeIds: string[];
  markNoticeRead: (id: string, forceRead?: boolean) => void;
  markAllNoticesRead: (ids?: string[]) => void;
  triggerToast: (toast: Omit<BudgetAlert, "id" | "isRead"> & { isRead?: boolean }) => void;
  activeToasts: BudgetAlert[];
  removeToast: (id: string) => void;
}

export const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotificationContext(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotificationContext must be used within a NotificationProvider or RequisitionProvider");
  }
  return context;
}

export function useNotifications(): NotificationContextType {
  return useNotificationContext();
}
