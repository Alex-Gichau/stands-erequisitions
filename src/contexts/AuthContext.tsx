/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext } from "react";
import { UserProfile, UserRole, PermissionConfig } from "../types";

export interface AuthContextType {
  currentUser: UserProfile | null;
  setCurrentUser?: (user: UserProfile | null) => void;
  users: UserProfile[];
  canPerform: (action: keyof PermissionConfig["actions"]) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isFinance: boolean;
  isApprover: boolean;
  isChurchGroup: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider or RequisitionProvider");
  }
  return context;
}

export function useAuth(): AuthContextType {
  return useAuthContext();
}
