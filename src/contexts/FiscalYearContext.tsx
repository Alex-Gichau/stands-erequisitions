/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext } from "react";
import { FiscalYear, SystemSettings } from "../types";

export interface FiscalYearContextType {
  fiscalYears: FiscalYear[];
  currentFiscalYear: string;
  setCurrentFiscalYear: (fy: string) => void;
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: Partial<SystemSettings>) => Promise<void>;
}

export const FiscalYearContext = createContext<FiscalYearContextType | null>(null);

export function useFiscalYearContext(): FiscalYearContextType {
  const context = useContext(FiscalYearContext);
  if (!context) {
    throw new Error("useFiscalYearContext must be used within a FiscalYearProvider or RequisitionProvider");
  }
  return context;
}
